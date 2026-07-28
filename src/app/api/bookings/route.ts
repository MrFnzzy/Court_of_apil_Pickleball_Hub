import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { priceForSlot, rentalPrice } from "@/lib/pricing";
import { getPricingSettings } from "@/lib/pricingSettings";
import type { Prisma as PrismaNS } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerName,
      contactNumber,
      email,
      date: dateStr,
      hours,
      paddleCount = 0,
      paymentMethod,
      referenceNumber,
      amountSent,
      proofOfPaymentUrl,
    } = body;

    // ---- Validation ----
    if (!customerName || typeof customerName !== "string" || customerName.trim().length < 2) {
      return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
    }
    if (!/^\d{11}$/.test(contactNumber || "")) {
      return NextResponse.json({ error: "Contact number must be exactly 11 digits (numbers only)." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (!dateStr || isNaN(new Date(dateStr).getTime())) {
      return NextResponse.json({ error: "Invalid date." }, { status: 400 });
    }
    if (!Array.isArray(hours) || hours.length === 0 || hours.some((h) => typeof h !== "number" || h < 0 || h > 23)) {
      return NextResponse.json({ error: "Please select at least one valid time slot." }, { status: 400 });
    }
    if (![0, 1, 2].includes(paddleCount)) {
      return NextResponse.json({ error: "Invalid rental selection." }, { status: 400 });
    }
    if (!["GCASH", "MAYA", "BPI"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method." }, { status: 400 });
    }
    if (!referenceNumber || !/^[a-zA-Z0-9\-]{4,40}$/.test(referenceNumber)) {
      return NextResponse.json({ error: "Reference number is required and must be numeric/alphanumeric." }, { status: 400 });
    }
    if (typeof amountSent !== "number" || amountSent <= 0) {
      return NextResponse.json({ error: "Amount sent must be a valid number." }, { status: 400 });
    }
    if (!proofOfPaymentUrl) {
      return NextResponse.json({ error: "Please attach proof of payment." }, { status: 400 });
    }

    const date = new Date(dateStr + "T00:00:00.000Z");
    const pricing = await getPricingSettings();

    // Reject past dates/hours
    const now = new Date();
    const manilaNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const manilaDateStr = manilaNow.toISOString().slice(0, 10);
    const manilaHour = manilaNow.getUTCHours();
    for (const h of hours) {
      if (dateStr < manilaDateStr || (dateStr === manilaDateStr && h <= manilaHour)) {
        return NextResponse.json({ error: "One or more selected slots are already in the past." }, { status: 400 });
      }
    }

    const courtTotal = hours.reduce((sum: number, h: number) => sum + priceForSlot(date, h, pricing), 0);
    const rentalTotal = rentalPrice(paddleCount, pricing);
    const grandTotal = courtTotal + rentalTotal;

    // ---- Race-safe booking: unique (date,hour) constraint on Slot guarantees
    // that if two people submit the same slot simultaneously, only one transaction succeeds. ----
    const booking = await prisma.$transaction(async (tx: PrismaNS.TransactionClient) => {
      const created = await tx.booking.create({
        data: {
          customerName: customerName.trim(),
          contactNumber,
          email,
          date,
          startHours: hours,
          courtTotal,
          paddleCount,
          rentalTotal,
          grandTotal,
          paymentMethod,
          referenceNumber,
          amountSent,
          proofOfPaymentUrl,
          status: "PENDING",
        },
      });

      await tx.slot.createMany({
        data: hours.map((h: number) => ({ date, hour: h, bookingId: created.id })),
      });

      return created;
    });

    return NextResponse.json({ success: true, bookingId: booking.id });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Sorry — one of the slots you selected was just booked by someone else. Please pick another slot." },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
