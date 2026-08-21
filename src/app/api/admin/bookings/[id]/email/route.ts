import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { sendCustomAdminEmail } from "@/lib/email";

// Lets an admin send a one-off message to a specific booking's customer
// from the "Email customer" tab — separate from the automatic transactional
// emails (confirmation/rejection/reschedule/etc.), which stay untouched.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!subject) return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  // Walk-in/manual bookings without a real email fall back to a local
  // placeholder address (see the manual-booking POST route) — nothing to
  // send there.
  if (!booking.email || booking.email.endsWith("@heidespickleballhub.local")) {
    return NextResponse.json({ error: "This booking has no email address on file." }, { status: 400 });
  }

  try {
    await sendCustomAdminEmail({
      email: booking.email,
      customerName: booking.customerName,
      subject,
      message,
      date: booking.date,
      startHours: booking.startHours,
      referenceNumber: booking.referenceNumber,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Custom admin email failed:", e);
    return NextResponse.json(
      { error: "Failed to send email. Check that GMAIL_USER / GMAIL_APP_PASSWORD are configured." },
      { status: 500 }
    );
  }
}
