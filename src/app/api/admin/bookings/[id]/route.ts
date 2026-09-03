import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { sendConfirmationEmail, sendRejectionEmail, sendRescheduleEmail } from "@/lib/email";
import { priceForSlot, rentalPrice, ballPrice } from "@/lib/pricing";
import { getPricingSettings } from "@/lib/pricingSettings";
import { getActiveRentalProducts } from "@/lib/rentalProducts";
import type { Prisma as PrismaNS } from "@prisma/client";

type Selection = { date: string; hours: number[] };

// Cap on how many distinct dates a single booking's edit can combine —
// same generous limit as creation.
const MAX_BOOKING_DATES = 20;

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
      // Multi-day shape (same as manual-booking creation): any number of
      // { date, hours } groups (up to MAX_BOOKING_DATES) covering the whole
      // reservation. The legacy single date/hours shape (still sent by any
      // older client) is normalized into this below.
      selections: rawSelections,
    } = body;

    const selections: Selection[] = Array.isArray(rawSelections) && rawSelections.length > 0
      ? rawSelections
      : typeof dateStr === "string" && Array.isArray(hours)
      ? [{ date: dateStr, hours }]
      : [];

    if (typeof customerName !== "string" || !customerName.trim()) {
      return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
    }
    if (selections.length === 0 || selections.length > MAX_BOOKING_DATES) {
      return NextResponse.json(
        selections.length > MAX_BOOKING_DATES
          ? { error: `A single booking can only combine slots from up to ${MAX_BOOKING_DATES} dates.` }
          : { error: "Select at least one time slot on the schedule." },
        { status: 400 }
      );
    }
    for (const sel of selections) {
      if (typeof sel.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(sel.date)) {
        return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
      }
      if (!Array.isArray(sel.hours) || sel.hours.length === 0 || !sel.hours.every((h: unknown) => typeof h === "number" && Number.isInteger(h) && h >= 0 && h <= 23)) {
        return NextResponse.json({ error: "Select at least one valid time slot." }, { status: 400 });
      }
    }
    {
      const dates = selections.map((s) => s.date);
      if (new Set(dates).size !== dates.length) {
        return NextResponse.json({ error: "Please select each date only once." }, { status: 400 });
      }
    }
    if (editStatus !== undefined && !["PENDING", "CONFIRMED", "REJECTED", "CANCELLED"].includes(editStatus)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const existing = await prisma.booking.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

    // A booking that spans two dates is really two linked rows sharing a
    // groupId (see POST in the sibling route) — pull in every row of that
    // group (not just the one row whose Edit button was clicked) so
    // reshaping the date/slot selection can update, add, or drop legs of
    // the *whole* reservation instead of silently orphaning the other date.
    const groupExisting = existing.groupId
      ? await prisma.booking.findMany({ where: { groupId: existing.groupId } })
      : [existing];
    const sortedExisting = groupExisting.slice().sort((a, b) => a.date.getTime() - b.date.getTime());

    const orderedSelections = [...selections].sort((a, b) => a.date.localeCompare(b.date));
    const pricing = await getPricingSettings();
    const rentalProducts = await getActiveRentalProducts();
    const rentalTotal = rentalPrice(paddleCount, rentalProducts);
    const ballTotal = ballPrice(ballCount, rentalProducts);
    // Collapsing 2 dates -> 1 drops the groupId entirely; growing 1 -> 2
    // needs a fresh one (or keeps the existing one it already had).
    const newGroupId = orderedSelections.length > 1 ? existing.groupId ?? randomUUID() : null;

    try {
      const updatedRows = await prisma.$transaction(async (tx: PrismaNS.TransactionClient) => {
        const rows = [];
        for (let i = 0; i < orderedSelections.length; i++) {
          const sel = orderedSelections[i];
          const newDate = new Date(sel.date + "T00:00:00.000Z");
          const courtTotal = sel.hours.reduce((sum: number, h: number) => sum + priceForSlot(newDate, h, pricing), 0);
          // Rentals/balls only ever bill on the first (earliest-date) leg
          // of the reservation, same convention as manual-booking creation.
          const isFirst = i === 0;
          const rowRentalTotal = isFirst ? rentalTotal : 0;
          const rowPaddleCount = isFirst ? paddleCount : 0;
          const rowBallTotal = isFirst ? ballTotal : 0;
          const rowBallCount = isFirst ? ballCount : 0;
          const subtotal = courtTotal + rowRentalTotal + rowBallTotal;
          const targetRow = sortedExisting[i];
          // Re-derive the discount peso amount from that row's own
          // (unchanged) percentage against its new subtotal — a newly
          // added leg (no prior row to inherit from) simply has none.
          const discountAmount = targetRow && targetRow.discountPercent > 0
            ? Math.min(subtotal, Math.round((subtotal * targetRow.discountPercent) / 100))
            : 0;
          const grandTotal = subtotal - discountAmount;

          const data = {
            customerName: customerName.trim(),
            contactNumber: contactNumber || existing.contactNumber,
            email: email || existing.email,
            date: newDate,
            startHours: sel.hours,
            courtTotal,
            paddleCount: rowPaddleCount,
            rentalTotal: rowRentalTotal,
            ballCount: rowBallCount,
            ballTotal: rowBallTotal,
            discountAmount,
            grandTotal,
            groupId: newGroupId,
            isFree: !!isFree,
            isPaid: isFree ? true : !!isPaid,
            isDownpayment: !!isDownpayment,
            downpaymentNote: isDownpayment ? (downpaymentNote?.trim() || null) : null,
            ...(editStatus !== undefined ? { status: editStatus } : {}),
            ...(editAdminNote !== undefined ? { adminNote: editAdminNote } : {}),
          };

          if (targetRow) {
            await tx.slot.deleteMany({ where: { bookingId: targetRow.id } });
            await tx.slot.createMany({ data: sel.hours.map((h: number) => ({ date: newDate, hour: h, bookingId: targetRow.id })) });
            rows.push(await tx.booking.update({ where: { id: targetRow.id }, data }));
          } else {
            const created = await tx.booking.create({
              data: {
                ...data,
                paymentMethod: existing.paymentMethod,
                referenceNumber: existing.referenceNumber,
                amountSent: grandTotal,
                proofOfPaymentUrl: "",
                bookingRef: existing.bookingRef,
                status: editStatus ?? existing.status,
                adminNote: editAdminNote ?? existing.adminNote,
              },
            });
            await tx.slot.createMany({ data: sel.hours.map((h: number) => ({ date: newDate, hour: h, bookingId: created.id })) });
            rows.push(created);
          }
        }
        // A leg that existed before but has no matching selection anymore
        // (2 dates trimmed down to 1) is genuinely gone — free its slots
        // and remove the row rather than leaving a stale half-booking.
        for (let j = orderedSelections.length; j < sortedExisting.length; j++) {
          await tx.slot.deleteMany({ where: { bookingId: sortedExisting[j].id } });
          await tx.booking.delete({ where: { id: sortedExisting[j].id } });
        }
        return rows;
      });

      // Freeing up slots on the way out to REJECTED/CANCELLED mirrors the
      // plain status-update branch further down — applies to every leg.
      if (editStatus === "REJECTED" || editStatus === "CANCELLED") {
        await prisma.slot.deleteMany({ where: { bookingId: { in: updatedRows.map((r) => r.id) } } });
      }

      const primary = updatedRows.find((r) => r.id === params.id) ?? updatedRows[0];
      return NextResponse.json({ success: true, booking: primary, bookingIds: updatedRows.map((r) => r.id) });
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

  // A multi-day booking is one reservation split across multiple rows (one
  // per date, linked by groupId) — send ONE confirmation/rejection email
  // covering every date, not one email per row.
  if (status === "CONFIRMED") {
    const first = groupBookings[0];
    try {
      await sendConfirmationEmail({
        email: first.email,
        customerName: first.customerName,
        dates: groupBookings.map((b) => ({ date: b.date, startHours: b.startHours })),
        courtTotal: groupBookings.reduce((sum, b) => sum + b.courtTotal, 0),
        rentalTotal: groupBookings.reduce((sum, b) => sum + b.rentalTotal, 0),
        ballTotal: groupBookings.reduce((sum, b) => sum + b.ballTotal, 0),
        grandTotal: groupBookings.reduce((sum, b) => sum + b.grandTotal, 0),
        paddleCount: groupBookings.reduce((sum, b) => sum + b.paddleCount, 0),
        referenceNumber: first.referenceNumber,
        bookingRef: first.bookingRef,
      });
    } catch (e) {
      console.error("Email send failed:", e);
    }
  }

  if (status === "REJECTED") {
    const first = groupBookings[0];
    try {
      await sendRejectionEmail({
        email: first.email,
        customerName: first.customerName,
        dates: groupBookings.map((b) => ({ date: b.date, startHours: b.startHours })),
        referenceNumber: first.referenceNumber,
        reason: adminNote,
      });
    } catch (e) {
      console.error("Email send failed:", e);
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
