import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { sendConfirmationEmail, sendRejectionEmail } from "@/lib/email";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { status, adminNote } = body;

  if (!["PENDING", "CONFIRMED", "REJECTED", "CANCELLED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const booking = await prisma.booking.update({
    where: { id: params.id },
    data: { status, adminNote },
  });

  // Note: availability is derived from Booking.startHours + status directly —
  // there's no separate Slot table, so no extra cleanup step is needed here.
  // Once status is REJECTED/CANCELLED, the schedule grid should treat these
  // hours as free again automatically.

  if (status === "CONFIRMED") {
    try {
      await sendConfirmationEmail({
        email: booking.email,
        customerName: booking.customerName,
        date: booking.date,
        startHours: booking.startHours,
        courtTotal: booking.courtTotal,
        rentalTotal: booking.rentalTotal,
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

  await prisma.booking.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
