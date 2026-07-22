import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { sendConfirmationEmail } from "@/lib/email";

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
        grandTotal: booking.grandTotal,
        paddleCount: booking.paddleCount,
        referenceNumber: booking.referenceNumber,
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
