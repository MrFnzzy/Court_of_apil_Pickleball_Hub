import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { priceForSlot, rentalPrice } from "@/lib/pricing";
import { getPricingSettings } from "@/lib/pricingSettings";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dateParam = req.nextUrl.searchParams.get("date");
  const where = dateParam ? { date: new Date(dateParam + "T00:00:00.000Z") } : {};

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
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
      status = "CONFIRMED",
      adminNote,
    } = body;

    if (!customerName || !dateStr || !Array.isArray(hours) || hours.length === 0) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const date = new Date(dateStr + "T00:00:00.000Z");
    const pricing = await getPricingSettings();
    const courtTotal = hours.reduce((sum: number, h: number) => sum + priceForSlot(date, h, pricing), 0);
    const rentalTotal = rentalPrice(paddleCount, pricing);

    const booking = await prisma.booking.create({
      data: {
        customerName,
        contactNumber: contactNumber || "00000000000",
        email: email || "walkin@courtofapil.local",
        date,
        startHours: hours,
        courtTotal,
        paddleCount,
        rentalTotal,
        grandTotal: courtTotal + rentalTotal,
        paymentMethod: "GCASH",
        referenceNumber: "ADMIN-MANUAL",
        amountSent: courtTotal + rentalTotal,
        proofOfPaymentUrl: "",
        status,
        adminNote: adminNote || "Manually added by admin",
      },
    });

    return NextResponse.json({ success: true, booking });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "One of those slots is already booked." }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to create booking." }, { status: 500 });
  }
}
