import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { priceForSlot, rentalPrice, ballPrice } from "@/lib/pricing";
import { getPricingSettings } from "@/lib/pricingSettings";
import { sendFeedbackEmailsForFinishedBookings } from "@/lib/feedbackEmail";
import type { Prisma as PrismaNS } from "@prisma/client";

function manilaTodayStr(): string {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 10);
}

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

type Selection = { date: string; hours: number[] };

export async function POST(req: NextRequest) {
  try {
    // NOTE: a PENDING booking's slot is never auto-freed here, even once
    // its reserved time has passed — it stays held until an admin manually
    // approves or rejects it, so it can't be silently re-booked out from
    // under a pending request.
    // Best-effort: email anyone whose confirmed booking time just finished.
    await sendFeedbackEmailsForFinishedBookings();

    const body = await req.json();
    const {
      customerName,
      contactNumber,
      email,
      // New multi-day shape: selections = [{ date, hours }, ...]
      // (up to 2 groups — today + tomorrow — booked together in one
      // transaction). Legacy single-day shape (date + hours) is still
      // accepted below and normalized into `selections`.
      selections: rawSelections,
      date: legacyDateStr,
      hours: legacyHours,
      paddleCount = 0,
      ballCount = 0,
      paymentMethod,
      referenceNumber,
      amountSent,
      proofOfPaymentUrl,
      promoCodeId = null,
      discountPercent = 0,
    } = body;

    const selections: Selection[] = Array.isArray(rawSelections)
      ? rawSelections
      : legacyDateStr && legacyHours
      ? [{ date: legacyDateStr, hours: legacyHours }]
      : [];

    // ---- Validation ----
    if (!customerName || typeof customerName !== "string" || customerName.trim().length < 2) {
      return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
    }
    if (!/^\d{11}$/.test(contactNumber || "")) {
      return NextResponse.json({ error: "Contact number must be exactly 11 digits (numbers only)." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (selections.length === 0 || selections.length > 2) {
      return NextResponse.json({ error: "Please select at least one valid time slot." }, { status: 400 });
    }
    for (const sel of selections) {
      if (!sel.date || isNaN(new Date(sel.date).getTime())) {
        return NextResponse.json({ error: "Invalid date." }, { status: 400 });
      }
      if (
        !Array.isArray(sel.hours) ||
        sel.hours.length === 0 ||
        sel.hours.some((h) => typeof h !== "number" || h < 0 || h > 23)
      ) {
        return NextResponse.json({ error: "Please select at least one valid time slot." }, { status: 400 });
      }
    }
    // A booking may only span a single day, or exactly "today" + "tomorrow"
    // (Manila time) booked together — never any other combination of dates.
    if (selections.length === 2) {
      const today = manilaTodayStr();
      const tomorrow = addDaysStr(today, 1);
      const dates = selections.map((s) => s.date).sort();
      if (dates[0] !== today || dates[1] !== tomorrow) {
        return NextResponse.json(
          { error: "A single booking can only combine today and tomorrow's slots." },
          { status: 400 }
        );
      }
    }
    if (![0, 1, 2].includes(paddleCount)) {
      return NextResponse.json({ error: "Invalid rental selection." }, { status: 400 });
    }
    if (![0, 1, 3].includes(ballCount)) {
      return NextResponse.json({ error: "Invalid ball rental selection." }, { status: 400 });
    }
    if (!["GCASH", "MAYA", "BPI"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method." }, { status: 400 });
    }
    if (!referenceNumber || !/^[a-zA-Z0-9\-]{4,40}$/.test(referenceNumber)) {
      return NextResponse.json({ error: "Reference number is required and must be numeric/alphanumeric." }, { status: 400 });
    }
    if (typeof amountSent !== "number" || amountSent <= 0) {
      return NextResponse.json({ error: "Amount sent must be a valid number." }, { status: 400 });
    }
    if (!proofOfPaymentUrl) {
      return NextResponse.json({ error: "Please attach proof of payment." }, { status: 400 });
    }

    const pricing = await getPricingSettings();

    // ---- Server-side promo code validation (prevents client-side manipulation) ----
    let validatedDiscountPercent = 0;
    let validatedPromoCodeId: string | null = null;
    if (promoCodeId) {
      const promo = await prisma.promoCode.findUnique({
        where: { id: promoCodeId },
        include: { _count: { select: { redemptions: true } } },
      });
      if (!promo || !promo.active) {
        return NextResponse.json({ error: "Promo code is no longer active." }, { status: 400 });
      }
      const now = new Date();
      if (now < promo.startDate || now > promo.endDate) {
        return NextResponse.json({ error: "Promo code is expired or not yet active." }, { status: 400 });
      }
      if (promo.maxRedemptions !== null && promo._count.redemptions >= promo.maxRedemptions) {
        return NextResponse.json({ error: "Promo code has reached its redemption limit." }, { status: 400 });
      }
      const customerUses = await prisma.promoRedemption.count({
        where: { promoCodeId: promo.id, email: email.toLowerCase().trim() },
      });
      if (customerUses >= promo.maxPerCustomer) {
        return NextResponse.json({ error: "You have already used this promo code the maximum number of times." }, { status: 400 });
      }
      // Use the server-authoritative discount percent, ignore any client-supplied value
      validatedDiscountPercent = promo.discountPercent;
      validatedPromoCodeId = promo.id;
    }

    // Reject past dates/hours
    const now = new Date();
    const manilaNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const manilaDateStr = manilaNow.toISOString().slice(0, 10);
    const manilaHour = manilaNow.getUTCHours();
    for (const sel of selections) {
      for (const h of sel.hours) {
        if (sel.date < manilaDateStr || (sel.date === manilaDateStr && h <= manilaHour)) {
          return NextResponse.json({ error: "One or more selected slots are already in the past." }, { status: 400 });
        }
      }
    }

    // Sort groups chronologically so rental gear is attached to the
    // earliest date (rental is a one-time add-on, not charged per day).
    const orderedSelections = [...selections].sort((a, b) => a.date.localeCompare(b.date));
    const rentalTotal = rentalPrice(paddleCount, pricing);
    const ballTotal = ballPrice(ballCount, pricing);
    const groupId = orderedSelections.length > 1 ? randomUUID() : null;

    // The customer sends ONE payment covering the whole multi-day booking,
    // so the full amountSent/reference/proof are recorded on every group —
    // only courtTotal/rentalTotal/grandTotal are split per day so each
    // row's own price is accurate (and totals summed across rows still
    // add up to the true grand total, since rental is only counted once).

    // ---- Race-safe booking: unique (date,hour) constraint on Slot guarantees
    // that if two people submit the same slot simultaneously, only one
    // transaction succeeds. All groups are created in a single DB
    // transaction, so either the whole multi-day booking succeeds or none
    // of it does. ----
    // Compute the full subtotal across all groups to apply the discount proportionally
    const totalSubtotal = orderedSelections.reduce((sum, sel) => {
      const date = new Date(sel.date + "T00:00:00.000Z");
      return sum + sel.hours.reduce((s: number, h: number) => s + priceForSlot(date, h, pricing), 0);
    }, 0) + rentalTotal + ballTotal;
    const totalDiscount = validatedPromoCodeId
      ? Math.round(totalSubtotal * (validatedDiscountPercent / 100))
      : 0;

    const bookings = await prisma.$transaction(async (tx: PrismaNS.TransactionClient) => {
      const created: { id: string }[] = [];
      let discountRemaining = totalDiscount;

      for (let i = 0; i < orderedSelections.length; i++) {
        const sel = orderedSelections[i];
        const date = new Date(sel.date + "T00:00:00.000Z");
        const courtTotal = sel.hours.reduce((sum: number, h: number) => sum + priceForSlot(date, h, pricing), 0);
        const isFirstGroup = i === 0;
        const isLastGroup = i === orderedSelections.length - 1;
        const groupRentalTotal = isFirstGroup ? rentalTotal : 0;
        const groupPaddleCount = isFirstGroup ? paddleCount : 0;
        const groupBallTotal = isFirstGroup ? ballTotal : 0;
        const groupBallCount = isFirstGroup ? ballCount : 0;
        const groupSubtotal = courtTotal + groupRentalTotal + groupBallTotal;

        // Distribute discount: last group gets whatever is left to avoid rounding gaps
        const groupDiscount = isLastGroup ? discountRemaining : Math.round(groupSubtotal / totalSubtotal * totalDiscount);
        discountRemaining -= groupDiscount;

        const row = await tx.booking.create({
          data: {
            customerName: customerName.trim(),
            contactNumber,
            email,
            date,
            startHours: sel.hours,
            courtTotal,
            paddleCount: groupPaddleCount,
            rentalTotal: groupRentalTotal,
            ballCount: groupBallCount,
            ballTotal: groupBallTotal,
            grandTotal: Math.max(0, groupSubtotal - groupDiscount),
            paymentMethod,
            referenceNumber,
            amountSent,
            proofOfPaymentUrl,
            status: "PENDING",
            groupId,
          },
        });

        await tx.slot.createMany({
          data: sel.hours.map((h: number) => ({ date, hour: h, bookingId: row.id })),
        });

        created.push(row);
      }

      // Record promo redemption (once per booking group, not per day)
      if (validatedPromoCodeId) {
        const firstBookingId = created[0]?.id;
        await tx.promoRedemption.create({
          data: {
            promoCodeId: validatedPromoCodeId,
            bookingId: firstBookingId,
            email: email.toLowerCase().trim(),
          },
        });
        await tx.promoCode.update({
          where: { id: validatedPromoCodeId },
          data: { totalRedemptions: { increment: 1 } },
        });
      }

      return created;
    });

    return NextResponse.json({ success: true, bookingIds: bookings.map((b: { id: string }) => b.id) });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Sorry — one of the slots you selected was just booked by someone else. Please pick another slot." },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
