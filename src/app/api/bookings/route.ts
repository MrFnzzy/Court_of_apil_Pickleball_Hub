import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { priceForSlot, rentalPrice, ballPrice, activeQuantities } from "@/lib/pricing";
import { getPricingSettings } from "@/lib/pricingSettings";
import { getActiveRentalProducts } from "@/lib/rentalProducts";
import { sendFeedbackEmailsForFinishedBookings } from "@/lib/feedbackEmail";
import { sendSpinInvitesForFinishedBookings } from "@/lib/spinWheelEmail";
import { findDiscountByCode, checkDiscountUsable } from "@/lib/discounts";
import { sendAdminPushNotification } from "@/lib/push";
import { verifyRecaptcha } from "@/lib/recaptcha";
import type { Prisma as PrismaNS } from "@prisma/client";

type Selection = { date: string; hours: number[] };

export async function POST(req: NextRequest) {
  try {
    // NOTE: a PENDING booking's slot is never auto-freed here, even once
    // its reserved time has passed — it stays held until an admin manually
    // approves or rejects it, so it can't be silently re-booked out from
    // under a pending request.
    // Best-effort: email anyone whose confirmed booking time just finished.
    await sendFeedbackEmailsForFinishedBookings();
    await sendSpinInvitesForFinishedBookings();

    const body = await req.json();
    const {
      customerName,
      contactNumber,
      email,
      // New multi-day shape: selections = [{ date, hours }, ...]
      // (up to 2 groups — any two dates — booked together in one
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
      // Promo code the customer typed in at checkout — optional. Re-validated
      // from scratch here regardless of anything the client claims about it,
      // since this is the only place the discount actually gets committed.
      promoCode,
      // Invisible reCAPTCHA v3 token generated client-side right before this
      // request — see verifyRecaptcha() for what happens if it's missing,
      // stale, or scored too low.
      recaptchaToken,
    } = body;

    const captcha = await verifyRecaptcha(recaptchaToken);
    if (!captcha.ok) {
      return NextResponse.json(
        { error: "We couldn't verify this submission wasn't automated. Please refresh the page and try again." },
        { status: 400 }
      );
    }

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
    // A booking may span a single day, or combine slots from two different
    // dates (any two dates, not just "today" + "tomorrow") in one
    // transaction. Just make sure the two selections aren't the same date
    // duplicated (the client always groups by date, so this should only
    // trip on a malformed request).
    if (selections.length === 2) {
      const dates = selections.map((s) => s.date).sort();
      if (dates[0] === dates[1]) {
        return NextResponse.json(
          { error: "Please combine slots from two different dates, or select one date." },
          { status: 400 }
        );
      }
    }
    const rentalProducts = await getActiveRentalProducts();
    if (paddleCount !== 0 && !activeQuantities("PADDLE", rentalProducts).includes(paddleCount)) {
      return NextResponse.json({ error: "Invalid rental selection." }, { status: 400 });
    }
    if (ballCount !== 0 && !activeQuantities("BALL", rentalProducts).includes(ballCount)) {
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
    const rentalTotal = rentalPrice(paddleCount, rentalProducts);
    const ballTotal = ballPrice(ballCount, rentalProducts);
    const groupId = orderedSelections.length > 1 ? randomUUID() : null;

    // Precompute each day's court total up front so we know the full order
    // subtotal (needed to validate/size the promo code) before touching the
    // database transaction.
    const courtTotalsBySelection = orderedSelections.map((sel) => {
      const date = new Date(sel.date + "T00:00:00.000Z");
      return sel.hours.reduce((sum: number, h: number) => sum + priceForSlot(date, h, pricing), 0);
    });
    const orderSubtotal = courtTotalsBySelection.reduce((a, b) => a + b, 0) + rentalTotal + ballTotal;

    // ---- Promo code (optional) ----
    // Fail fast with a clear error if the code doesn't check out, before we
    // ever open the booking transaction. The actual redemption count is
    // still claimed atomically inside the transaction below, since another
    // request could exhaust the code in between this check and that claim.
    let appliedDiscount: { id: string; percentage: number; maxRedemptions: number | null } | null = null;
    let discountAmount = 0;
    if (promoCode && typeof promoCode === "string" && promoCode.trim()) {
      const discount = await findDiscountByCode(promoCode);
      const result = await checkDiscountUsable(discount, orderSubtotal, email);
      if (!result.valid) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      appliedDiscount = {
        id: result.discount.id,
        percentage: result.discount.percentage,
        maxRedemptions: result.discount.maxRedemptions,
      };
      discountAmount = result.discountAmount;
    }

    // The customer sends ONE payment covering the whole multi-day booking,
    // so the full amountSent/reference/proof are recorded on every group —
    // only courtTotal/rentalTotal/grandTotal are split per day so each
    // row's own price is accurate (and totals summed across rows still
    // add up to the true grand total, since rental — and any discount —
    // is only counted once, on the first day's row).

    // ---- Race-safe booking: unique (date,hour) constraint on Slot guarantees
    // that if two people submit the same slot simultaneously, only one
    // transaction succeeds. All groups are created in a single DB
    // transaction, so either the whole multi-day booking succeeds or none
    // of it does. ----
    const bookings = await prisma.$transaction(async (tx: PrismaNS.TransactionClient) => {
      // Atomically claim the promo code's redemption slot. Using an
      // updateMany with the redemption cap baked into the `where` means a
      // second concurrent request that would exceed maxRedemptions simply
      // claims 0 rows, rather than both requests reading a stale count and
      // both succeeding.
      if (appliedDiscount) {
        const claim = await tx.discount.updateMany({
          where: {
            id: appliedDiscount.id,
            active: true,
            OR: [{ maxRedemptions: null }, { redemptionCount: { lt: appliedDiscount.maxRedemptions ?? Number.MAX_SAFE_INTEGER } }],
          },
          data: { redemptionCount: { increment: 1 } },
        });
        if (claim.count === 0) {
          throw new Error("PROMO_CODE_EXHAUSTED");
        }
      }

      const created = [];
      for (let i = 0; i < orderedSelections.length; i++) {
        const sel = orderedSelections[i];
        const date = new Date(sel.date + "T00:00:00.000Z");
        const courtTotal = courtTotalsBySelection[i];
        const isFirstGroup = i === 0;
        const groupRentalTotal = isFirstGroup ? rentalTotal : 0;
        const groupPaddleCount = isFirstGroup ? paddleCount : 0;
        const groupBallTotal = isFirstGroup ? ballTotal : 0;
        const groupBallCount = isFirstGroup ? ballCount : 0;
        const groupDiscountAmount = isFirstGroup ? discountAmount : 0;

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
            grandTotal: courtTotal + groupRentalTotal + groupBallTotal - groupDiscountAmount,
            paymentMethod,
            referenceNumber,
            amountSent,
            proofOfPaymentUrl,
            status: "PENDING",
            groupId,
            discountId: isFirstGroup ? appliedDiscount?.id ?? null : null,
            discountPercent: isFirstGroup ? appliedDiscount?.percentage ?? 0 : 0,
            discountAmount: groupDiscountAmount,
          },
        });

        if (isFirstGroup && appliedDiscount) {
          await tx.discountRedemption.create({
            data: { discountId: appliedDiscount.id, email, bookingId: row.id },
          });
        }

        await tx.slot.createMany({
          data: sel.hours.map((h: number) => ({ date, hour: h, bookingId: row.id })),
        });

        created.push(row);
      }
      return created;
    });

    // Best-effort — a customer's booking should never fail just because a
    // push notification couldn't be delivered (e.g. VAPID not configured
    // yet, or every admin device's subscription happens to be stale).
    const first = bookings[0];
    const nights = bookings.length;
    sendAdminPushNotification({
      title: "Dink dink! New booking, don't blink 🏓",
      body:
        nights > 1
          ? `${first.customerName} booked ${nights} sessions starting ${first.date.toISOString().slice(0, 10)}.`
          : `${first.customerName} booked ${first.date.toISOString().slice(0, 10)} — ₱${first.grandTotal.toLocaleString("en-PH")}.`,
      url: "/admin",
      tag: "new-booking",
    }).catch((e) => console.error("Admin push notification failed:", e));

    return NextResponse.json({ success: true, bookingIds: bookings.map((b: { id: string }) => b.id) });
  } catch (err: any) {
    if (err?.message === "PROMO_CODE_EXHAUSTED") {
      return NextResponse.json(
        { error: "Sorry — that promo code just reached its redemption limit. Please remove it and try again." },
        { status: 409 }
      );
    }
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
