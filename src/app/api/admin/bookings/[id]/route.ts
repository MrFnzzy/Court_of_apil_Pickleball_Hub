import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { sendConfirmationEmail, sendRejectionEmail, sendRescheduleEmail } from "@/lib/email";
import { priceForSlot, rentalPrice, ballPrice } from "@/lib/pricing";
import { getPricingSettings } from "@/lib/pricingSettings";
import { getActiveRentalProducts } from "@/lib/rentalProducts";
import type { Prisma as PrismaNS } from "@prisma/client";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { status, adminNote, date: dateStr, hours, mode } = body;

  // Full edit branch — admin editing any field of an existing booking
  // (customer details, slots, rentals, status, and the free/paid tags)
  // from the edit form. Distinct from the plain reschedule branch below,
  // which only ever touches date/hours and is used by the lighter-weight
  // "Reschedule" modal.
  if (mode === "edit") {
    const {
      customerName,
      contactNumber,
      email,
      paddleCount = 0,
      ballCount = 0,
      isFree = false,
      isPaid = true,
      isDownpayment = false,
      downpaymentNote,
      status: editStatus,
      adminNote: editAdminNote,
    } = body;

    if (typeof customerName !== "string" || !customerName.trim()) {
      return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
    }
    if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
    }
    if (!Array.isArray(hours) || hours.length === 0 || !hours.every((h: unknown) => typeof h === "number" && Number.isInteger(h) && h >= 0 && h <= 23)) {
      return NextResponse.json({ error: "Select at least one valid time slot." }, { status: 400 });
    }
    if (editStatus !== undefined && !["PENDING", "CONFIRMED", "REJECTED", "CANCELLED"].includes(editStatus)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const existing = await prisma.booking.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

    const newDate = new Date(dateStr + "T00:00:00.000Z");
    const pricing = await getPricingSettings();
    const rentalProducts = await getActiveRentalProducts();
    const courtTotal = hours.reduce((sum: number, h: number) => sum + priceForSlot(newDate, h, pricing), 0);
    const rentalTotal = rentalPrice(paddleCount, rentalProducts);
    const ballTotal = ballPrice(ballCount, rentalProducts);
    const subtotal = courtTotal + rentalTotal + ballTotal;
    // Re-derive the discount peso amount from the (unchanged) percentage
    // against the new subtotal, same approach the reschedule branch uses.
    const discountAmount = existing.discountPercent > 0
      ? Math.min(subtotal, Math.round((subtotal * existing.discountPercent) / 100))
      : existing.discountAmount;
    const grandTotal = subtotal - discountAmount;

    const hoursChanged =
      dateStr !== existing.date.toISOString().slice(0, 10) ||
      hours.length !== existing.startHours.length ||
      hours.slice().sort((a: number, b: number) => a - b).join(",") !== existing.startHours.slice().sort((a: number, b: number) => a - b).join(",");

    try {
      const updated = await prisma.$transaction(async (tx: PrismaNS.TransactionClient) => {
        if (hoursChanged) {
          await tx.slot.deleteMany({ where: { bookingId: params.id } });
          await tx.slot.createMany({
            data: hours.map((h: number) => ({ date: newDate, hour: h, bookingId: params.id })),
          });
        }
        return tx.booking.update({
          where: { id: params.id },
          data: {
            customerName: customerName.trim(),
            contactNumber: contactNumber || existing.contactNumber,
            email: email || existing.email,
            date: newDate,
            startHours: hours,
            courtTotal,
            paddleCount,
            rentalTotal,
            ballCount,
            ballTotal,
            discountAmount,
            grandTotal,
            isFree: !!isFree,
            isPaid: isFree ? true : !!isPaid,
            isDownpayment: !!isDownpayment,
            downpaymentNote: isDownpayment ? (downpaymentNote?.trim() || null) : null,
            ...(editStatus !== undefined ? { status: editStatus } : {}),
            ...(editAdminNote !== undefined ? { adminNote: editAdminNote } : {}),
          },
        });
      });

      // Freeing up slots on the way out to REJECTED/CANCELLED mirrors the
      // plain status-update branch further down.
      if (editStatus === "REJECTED" || editStatus === "CANCELLED") {
        await prisma.slot.deleteMany({ where: { bookingId: updated.id } });
      }

      return NextResponse.json({ success: true, booking: updated });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return NextResponse.json({ error: "One of those slots is already booked." }, { status: 409 });
      }
      console.error("Booking edit failed:", err);
      return NextResponse.json({ error: "Failed to save changes." }, { status: 500 });
    }
  }

  // Reschedule branch — admin moving a PENDING (still awaiting verification)
  // or CONFIRMED (already paid) booking to a different date/time. Any other
  // status (REJECTED/CANCELLED) is a dead booking with no slots to move, so
  // it's excluded below.
  if (dateStr !== undefined || hours !== undefined) {
    if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
    }
    if (!Array.isArray(hours) || hours.length === 0 || !hours.every((h: unknown) => typeof h === "number" && Number.isInteger(h) && h >= 0 && h <= 23)) {
      return NextResponse.json({ error: "Select at least one valid time slot." }, { status: 400 });
    }

    const existing = await prisma.booking.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    if (existing.status !== "PENDING" && existing.status !== "CONFIRMED") {
      return NextResponse.json({ error: "Only pending or confirmed bookings can be rescheduled." }, { status: 400 });
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

      // The customer already got a confirmation email for the old slot —
      // let them know it moved. Pending bookings never got one yet, so
      // there's nothing to correct for them.
      if (existing.status === "CONFIRMED" && rescheduled.email) {
        try {
          await sendRescheduleEmail({
            email: rescheduled.email,
            customerName: rescheduled.customerName,
            oldDate: existing.date,
            oldStartHours: existing.startHours,
            newDate: rescheduled.date,
            newStartHours: rescheduled.startHours,
            grandTotal: rescheduled.grandTotal,
            referenceNumber: rescheduled.referenceNumber,
          });
        } catch (e) {
          console.error("Reschedule email send failed:", e);
        }
      }

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

  const target = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  // A multi-day booking is really one reservation split across two Booking
  // rows (one per date) that share a groupId — approving/rejecting one
  // should approve/reject the whole thing in one action, not leave its
  // other date sitting pending.
  const groupBookings = target.groupId
    ? await prisma.booking.findMany({ where: { groupId: target.groupId } })
    : [target];

  await prisma.$transaction(
    groupBookings.map((b) =>
      prisma.booking.update({ where: { id: b.id }, data: { status, adminNote } })
    )
  );

  // If admin cancels/rejects, free up the slots (for every date in the
  // group) so others can book them.
  if (status === "REJECTED" || status === "CANCELLED") {
    await prisma.slot.deleteMany({ where: { bookingId: { in: groupBookings.map((b) => b.id) } } });
  }

  if (status === "CONFIRMED") {
    for (const b of groupBookings) {
      try {
        await sendConfirmationEmail({
          email: b.email,
          customerName: b.customerName,
          date: b.date,
          startHours: b.startHours,
          courtTotal: b.courtTotal,
          rentalTotal: b.rentalTotal,
          ballTotal: b.ballTotal,
          grandTotal: b.grandTotal,
          paddleCount: b.paddleCount,
          referenceNumber: b.referenceNumber,
          bookingRef: b.bookingRef,
        });
      } catch (e) {
        console.error("Email send failed:", e);
      }
    }
  }

  if (status === "REJECTED") {
    for (const b of groupBookings) {
      try {
        await sendRejectionEmail({
          email: b.email,
          customerName: b.customerName,
          date: b.date,
          startHours: b.startHours,
          referenceNumber: b.referenceNumber,
          reason: adminNote,
        });
      } catch (e) {
        console.error("Email send failed:", e);
      }
    }
  }

  const booking = groupBookings.find((b) => b.id === params.id) ?? groupBookings[0];
  return NextResponse.json({ success: true, booking, groupBookingIds: groupBookings.map((b) => b.id) });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.slot.deleteMany({ where: { bookingId: params.id } });
  await prisma.booking.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
