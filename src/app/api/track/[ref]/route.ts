import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/track/[ref]
// Public lookup by the customer-facing booking reference code (NOT the
// payment reference number — see the bookingRef schema comment). Returns
// every Booking row created in that checkout (a multi-day booking has more
// than one) plus a single overall status summarizing them, so the /track
// page can show one coherent result even when, say, one day got approved
// and the other got rejected.
export async function GET(_req: NextRequest, { params }: { params: { ref: string } }) {
  const ref = (params.ref || "").trim().toUpperCase();
  if (!ref) {
    return NextResponse.json({ error: "Please enter a booking reference number." }, { status: 400 });
  }

  const rows = await prisma.booking.findMany({
    where: { bookingRef: ref },
    select: {
      id: true,
      customerName: true,
      contactNumber: true,
      email: true,
      date: true,
      startHours: true,
      courtTotal: true,
      rentalTotal: true,
      ballTotal: true,
      grandTotal: true,
      paddleCount: true,
      ballCount: true,
      paymentMethod: true,
      amountSent: true,
      status: true,
      adminNote: true,
      createdAt: true,
    },
    orderBy: { date: "asc" },
  });

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "We couldn't find a booking with that reference number. Double-check the code and try again." },
      { status: 404 }
    );
  }

  const statuses = new Set(rows.map((r) => r.status));
  let overallStatus: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "MIXED";
  if (statuses.size === 1) {
    overallStatus = [...statuses][0] as any;
  } else if (statuses.has("PENDING")) {
    // Still at least one day awaiting a decision — treat the whole booking
    // as pending so the customer keeps checking back rather than assuming
    // it's fully settled.
    overallStatus = "PENDING";
  } else {
    overallStatus = "MIXED";
  }

  const first = rows[0];
  return NextResponse.json({
    bookingRef: ref,
    customerName: first.customerName,
    contactNumber: first.contactNumber,
    email: first.email,
    paymentMethod: first.paymentMethod,
    amountSent: first.amountSent,
    createdAt: first.createdAt,
    overallStatus,
    grandTotal: rows.reduce((sum, r) => sum + r.grandTotal, 0),
    days: rows.map((r) => ({
      id: r.id,
      date: r.date,
      startHours: r.startHours,
      courtTotal: r.courtTotal,
      rentalTotal: r.rentalTotal,
      ballTotal: r.ballTotal,
      grandTotal: r.grandTotal,
      paddleCount: r.paddleCount,
      ballCount: r.ballCount,
      status: r.status,
      adminNote: r.status === "REJECTED" ? r.adminNote : null,
    })),
  });
}
