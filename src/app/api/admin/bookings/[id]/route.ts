import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { sendConfirmationEmail, sendRejectionEmail } from "@/lib/email";
import { priceForSlot } from "@/lib/pricing";
import { getPricingSettings } from "@/lib/pricingSettings";
import type { Prisma as PrismaNS } from "@prisma/client";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { status, adminNote, date: dateStr, hours } = body;

  // Reschedule branch — admin moving a still-pending booking to a
  // different date/time before deciding whether to approve it. Kept
  // separate from the status-change branch below (and gated to PENDING
  // bookings only) so a confirmed/paid booking can never be silently
  // shifted this way — that would need its own customer-notification
  // flow, which this endpoint doesn't handle.
  if (dateStr !== undefined || hours !== undefined) {
    if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
    }
    if (!Array.isArray(hours) || hours.length === 0 || !hours.every((h: unknown) => Number.isInteger(h) && h >= 0 && h <= 23)) {
      return NextResponse.json({ error: "Select at least one valid time slot." }, { status: 400 });
    }

    const existing = await prisma.booking.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "Only pending bookings can be rescheduled." }, { status: 400 });
    }

    const newDate = new Date(dateStr + "T00:00:00.000Z");
    const pricing = await getPricingSettings();
    const courtTotal = hours.reduce((sum: number, h: number) => sum + priceForSlot(newDate, h, pricing), 0);
    const subtotal = courtTotal + existing.rentalTotal + existing.ballTotal;
    // Re-derive the discount peso amount from the (unchanged) percentage
    // against the new subtotal, same formula used at checkout — a flat
    // peso amount would drift out of sync with a different court total.
    const discountAmount = existing.discountPercent > 0
      ? Math.min(subtotal, Math.round((subtotal * existing.discountPercent) / 100))
      : existing.discountAmount;
    const grandTotal = subtotal - discountAmount;

    try {
      const rescheduled = await prisma.$transaction(async (tx: PrismaNS.TransactionClient) => {
        await tx.slot.deleteMany({ where: { bookingId: params.id } });
        await tx.slot.createMany({
          data: hours.map((h: number) => ({ date: newDate, hour: h, bookingId: params.id })),
        });
        return tx.booking.update({
          where: { id: params.id },
          data: { date: newDate, startHours: hours, courtTotal, discountAmount, grandTotal },
        });
      });
      return NextResponse.json({ success: true, booking: rescheduled });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return NextResponse.json({ error: "One of those slots is already booked." }, { status: 409 });
      }
      console.error("Reschedule failed:", err);
      return NextResponse.json({ error: "Failed to reschedule booking." }, { status: 500 });
    }
  }

  if (!["PENDING", "CONFIRMED", "REJECTED", "CANCELLED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const booking = await prisma.booking.update({
    where: { id: params.id },
    data: { status, adminNote },
  });

  // If admin cancels/rejects, free up the slots so others can book them
  if (status === "REJECTED" || status === "CANCELLED") {
    await prisma.slot.deleteMany({ where: { bookingId: booking.id } });
  }

  if (status === "CONFIRMED") {
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
      console.error("Email send failed:", e);
    }
  }

  if (status === "REJECTED") {
    try {
      await sendRejectionEmail({
        email: booking.email,
        customerName: booking.customerName,
        date: booking.date,
        startHours: booking.startHours,
        referenceNumber: booking.referenceNumber,
        reason: adminNote,
      });
    } catch (e) {
      console.error("Email send failed:", e);
    }
  }

  return NextResponse.json({ success: true, booking });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.slot.deleteMany({ where: { bookingId: params.id } });
  await prisma.booking.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
