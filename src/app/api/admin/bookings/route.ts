import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { priceForSlot, rentalPrice, ballPrice } from "@/lib/pricing";
import { getPricingSettings } from "@/lib/pricingSettings";
import { getActiveRentalProducts } from "@/lib/rentalProducts";
import { sendFeedbackEmailsForFinishedBookings } from "@/lib/feedbackEmail";
import { sendSpinInvitesForFinishedBookings } from "@/lib/spinWheelEmail";
import { autoRejectExpiredPendingBookings } from "@/lib/autoReject";
import { sendManualBookingAdminNotification, sendConfirmationEmail, defaultAdminEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/siteSettings";
import { generateBookingRef } from "@/lib/bookingRef";
import type { Prisma as PrismaNS } from "@prisma/client";

type Selection = { date: string; hours: number[] };

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // NOTE: a PENDING booking is auto-rejected once its own reserved time has
  // fully elapsed without an admin decision (see autoRejectExpiredPendingBookings
  // below) — it is never auto-*confirmed*, only auto-*rejected*, so a real
  // approval always still requires a human.
  await autoRejectExpiredPendingBookings();
  // Best-effort: email anyone whose confirmed booking time just finished.
  await sendFeedbackEmailsForFinishedBookings();
  await sendSpinInvitesForFinishedBookings();


  const dateParam = req.nextUrl.searchParams.get("date");
  // A single reservation that spans two dates is stored as two linked
  // Booking rows sharing a groupId (see POST below). Letting the caller
  // fetch straight by groupId is how the admin edit form loads every leg
  // of a multi-day booking at once, instead of just whichever single row
  // happened to be clicked in the schedule list.
  const groupIdParam = req.nextUrl.searchParams.get("groupId");
  const where = groupIdParam
    ? { groupId: groupIdParam }
    : dateParam
    ? { date: new Date(dateParam + "T00:00:00.000Z") }
    : {};

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { discount: { select: { code: true } } },
  });

  // Attach every row's full multi-day span (`linkedSlots`) so a list or
  // card showing just one date's booking can still render the *whole*
  // reservation (e.g. "10PM–12AM, (Sep 2 – 12AM–1AM)") instead of only
  // the hours that happen to fall on the date currently being viewed.
  const groupIds = Array.from(new Set(bookings.map((b) => b.groupId).filter((g): g is string => !!g)));
  const groupRows = groupIds.length > 0
    ? await prisma.booking.findMany({
        where: { groupId: { in: groupIds } },
        select: { groupId: true, date: true, startHours: true },
      })
    : [];
  const linkedByGroup = new Map<string, { date: string; startHours: number[] }[]>();
  for (const row of groupRows) {
    if (!row.groupId) continue;
    const list = linkedByGroup.get(row.groupId) || [];
    list.push({ date: row.date.toISOString(), startHours: row.startHours });
    linkedByGroup.set(row.groupId, list);
  }
  const enriched = bookings.map((b) => ({
    ...b,
    linkedSlots: b.groupId ? (linkedByGroup.get(b.groupId) || []).sort((a, c) => a.date.localeCompare(c.date)) : undefined,
  }));

  return NextResponse.json({ bookings: enriched });
}

// Manual booking creation by admin (e.g. phone-in / walk-in reservations)
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      customerName,
      contactNumber,
      email,
      // New multi-day shape: selections = [{ date, hours }, ...] — up to 2
      // groups (any two dates, don't need to be consecutive) created
      // together and linked with a shared groupId, same as the
      // customer-facing flow. Legacy single-day shape (date + hours) is
      // still accepted and normalized into `selections`.
      selections: rawSelections,
      date: legacyDateStr,
      hours: legacyHours,
      paddleCount = 0,
      ballCount = 0,
      status = "CONFIRMED",
      adminNote,
      notifyCustomer = false,
      isFree = false,
      isPaid = true,
      isDownpayment = false,
      downpaymentNote,
    } = body;

    const selections: Selection[] = Array.isArray(rawSelections) && rawSelections.length > 0
      ? rawSelections
      : legacyDateStr && legacyHours
      ? [{ date: legacyDateStr, hours: legacyHours }]
      : [];

    if (!customerName || selections.length === 0 || selections.length > 2) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    for (const sel of selections) {
      if (!sel.date || !Array.isArray(sel.hours) || sel.hours.length === 0) {
        return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
      }
    }
    if (selections.length === 2 && selections[0].date === selections[1].date) {
      return NextResponse.json(
        { error: "Please combine slots from two different dates, or select one date." },
        { status: 400 }
      );
    }

    const orderedSelections = [...selections].sort((a, b) => a.date.localeCompare(b.date));
    const pricing = await getPricingSettings();
    const rentalProducts = await getActiveRentalProducts();
    const rentalTotal = rentalPrice(paddleCount, rentalProducts);
    const ballTotal = ballPrice(ballCount, rentalProducts);
    const groupId = orderedSelections.length > 1 ? randomUUID() : null;

    const bookings = await prisma.$transaction(async (tx: PrismaNS.TransactionClient) => {
      const bookingRef = await generateBookingRef(tx);
      const created = [];
      for (let i = 0; i < orderedSelections.length; i++) {
        const sel = orderedSelections[i];
        const date = new Date(sel.date + "T00:00:00.000Z");
        const courtTotal = sel.hours.reduce((sum: number, h: number) => sum + priceForSlot(date, h, pricing), 0);
        const isFirstGroup = i === 0;
        const groupRentalTotal = isFirstGroup ? rentalTotal : 0;
        const groupPaddleCount = isFirstGroup ? paddleCount : 0;
        const groupBallTotal = isFirstGroup ? ballTotal : 0;
        const groupBallCount = isFirstGroup ? ballCount : 0;
        const groupGrandTotal = courtTotal + groupRentalTotal + groupBallTotal;

        const row = await tx.booking.create({
          data: {
            customerName,
            contactNumber: contactNumber || "00000000000",
            email: email || "walkin@heidespickleballhub.local",
            date,
            startHours: sel.hours,
            courtTotal,
            paddleCount: groupPaddleCount,
            rentalTotal: groupRentalTotal,
            ballCount: groupBallCount,
            ballTotal: groupBallTotal,
            grandTotal: groupGrandTotal,
            paymentMethod: "GCASH",
            referenceNumber: "ADMIN-MANUAL",
            amountSent: groupGrandTotal,
            proofOfPaymentUrl: "",
            status,
            groupId,
            bookingRef,
            isFree: !!isFree,
            isPaid: isFree ? true : !!isPaid,
            isDownpayment: !!isDownpayment,
            downpaymentNote: isDownpayment ? (downpaymentNote || null) : null,
            adminNote: adminNote || "Manually added by admin",
          },
        });

        await tx.slot.createMany({
          data: sel.hours.map((h: number) => ({ date, hour: h, bookingId: row.id })),
        });

        created.push(row);
      }
      return created;
    });

    const booking = bookings[0];

    // Best-effort notifications — never let email trouble fail the booking
    // itself, since the reservation is already saved at this point.
    try {
      const siteSettings = await getSiteSettings();
      const notifyTo = siteSettings.adminNotificationEmail || defaultAdminEmail();
      if (notifyTo) {
        await sendManualBookingAdminNotification(notifyTo, {
          customerName: booking.customerName,
          contactNumber: booking.contactNumber,
          email: booking.email,
          date: booking.date,
          startHours: booking.startHours,
          courtTotal: bookings.reduce((s, b) => s + b.courtTotal, 0),
          rentalTotal: booking.rentalTotal,
          ballTotal: booking.ballTotal,
          grandTotal: bookings.reduce((s, b) => s + b.grandTotal, 0),
          status: booking.status,
          adminNote: booking.adminNote,
        });
      }
    } catch (e) {
      console.error("Manual booking admin notification failed:", e);
    }

    if (notifyCustomer && email && status === "CONFIRMED") {
      try {
        await sendConfirmationEmail({
          email: booking.email,
          customerName: booking.customerName,
          date: booking.date,
          startHours: booking.startHours,
          courtTotal: bookings.reduce((s, b) => s + b.courtTotal, 0),
          rentalTotal: booking.rentalTotal,
          ballTotal: booking.ballTotal,
          grandTotal: bookings.reduce((s, b) => s + b.grandTotal, 0),
          paddleCount: booking.paddleCount,
          referenceNumber: booking.referenceNumber,
          bookingRef: booking.bookingRef,
        });
      } catch (e) {
        console.error("Manual booking customer confirmation failed:", e);
      }
    }

    return NextResponse.json({ success: true, booking, bookingIds: bookings.map((b) => b.id) });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "One of those slots is already booked." }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to create booking." }, { status: 500 });
  }
}
