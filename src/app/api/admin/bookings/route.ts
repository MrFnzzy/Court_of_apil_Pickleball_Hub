import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { priceForSlot, rentalPrice, ballPrice } from "@/lib/pricing";
import { getPricingSettings } from "@/lib/pricingSettings";
import { sendFeedbackEmailsForFinishedBookings } from "@/lib/feedbackEmail";
import { sendSpinInvitesForFinishedBookings } from "@/lib/spinWheelEmail";
import { sendManualBookingAdminNotification, sendConfirmationEmail, defaultAdminEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/siteSettings";
import type { Prisma as PrismaNS } from "@prisma/client";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // NOTE: pending bookings are never auto-rejected — even once their
  // reserved time has passed, they stay PENDING until an admin explicitly
  // approves or rejects them, so this list (and the Pending tab/count)
  // keeps surfacing them for a manual decision.
  // Best-effort: email anyone whose confirmed booking time just finished.
  await sendFeedbackEmailsForFinishedBookings();
  await sendSpinInvitesForFinishedBookings();


  const dateParam = req.nextUrl.searchParams.get("date");
  const where = dateParam ? { date: new Date(dateParam + "T00:00:00.000Z") } : {};

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { discount: { select: { code: true } } },
  });

  return NextResponse.json({ bookings });
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
      date: dateStr,
      hours,
      paddleCount = 0,
      ballCount = 0,
      status = "CONFIRMED",
      adminNote,
      notifyCustomer = false,
    } = body;

    if (!customerName || !dateStr || !Array.isArray(hours) || hours.length === 0) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const date = new Date(dateStr + "T00:00:00.000Z");
    const pricing = await getPricingSettings();
    const courtTotal = hours.reduce((sum: number, h: number) => sum + priceForSlot(date, h, pricing), 0);
    const rentalTotal = rentalPrice(paddleCount, pricing);
    const ballTotal = ballPrice(ballCount, pricing);

    const booking = await prisma.$transaction(async (tx: PrismaNS.TransactionClient) => {
      const created = await tx.booking.create({
        data: {
          customerName,
          contactNumber: contactNumber || "00000000000",
          email: email || "walkin@heidespickleballhub.local",
          date,
          startHours: hours,
          courtTotal,
          paddleCount,
          rentalTotal,
          ballCount,
          ballTotal,
          grandTotal: courtTotal + rentalTotal + ballTotal,
          paymentMethod: "GCASH",
          referenceNumber: "ADMIN-MANUAL",
          amountSent: courtTotal + rentalTotal + ballTotal,
          proofOfPaymentUrl: "",
          status,
          adminNote: adminNote || "Manually added by admin",
        },
      });

      await tx.slot.createMany({
        data: hours.map((h: number) => ({ date, hour: h, bookingId: created.id })),
      });

      return created;
    });

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
          courtTotal: booking.courtTotal,
          rentalTotal: booking.rentalTotal,
          ballTotal: booking.ballTotal,
          grandTotal: booking.grandTotal,
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
          courtTotal: booking.courtTotal,
          rentalTotal: booking.rentalTotal,
          ballTotal: booking.ballTotal,
          grandTotal: booking.grandTotal,
          paddleCount: booking.paddleCount,
          referenceNumber: booking.referenceNumber,
        });
      } catch (e) {
        console.error("Manual booking customer confirmation failed:", e);
      }
    }

    return NextResponse.json({ success: true, booking });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "One of those slots is already booked." }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to create booking." }, { status: 500 });
  }
}
