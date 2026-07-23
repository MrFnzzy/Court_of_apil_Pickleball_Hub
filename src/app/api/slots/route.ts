import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALL_HOURS, priceForSlot } from "@/lib/pricing";
import { getPricingSettings } from "@/lib/pricingSettings";

export const dynamic = "force-dynamic";

// GET /api/slots?date=YYYY-MM-DD
// Returns the full 24-hour grid for the given date with status per hour:
// "past" | "available" | "pending" | "booked"
export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  if (!dateParam) {
    return NextResponse.json({ error: "Missing date param" }, { status: 400 });
  }

  const date = new Date(dateParam + "T00:00:00.000Z");
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const slots = await prisma.slot.findMany({
    where: { date },
    include: { booking: { select: { status: true, customerName: true, contactNumber: true } } },
  });

  const pricing = await getPricingSettings();

  const now = new Date();
  const isToday = now.toISOString().slice(0, 10) === dateParam;
  const currentHour = now.getUTCHours();
  // Philippines is UTC+8; convert "now" to Manila local hour for past-slot comparison
  const manilaNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const manilaDateStr = manilaNow.toISOString().slice(0, 10);
  const manilaHour = manilaNow.getUTCHours();

  const grid = ALL_HOURS.map((hour) => {
    const slot = slots.find((s: (typeof slots)[number]) => s.hour === hour);
    let status: "past" | "available" | "pending" | "booked" = "available";

    const isPast =
      manilaDateStr > dateParam || (manilaDateStr === dateParam && hour <= manilaHour);

    if (slot) {
      status = slot.booking.status === "PENDING" ? "pending" : slot.booking.status === "CONFIRMED" ? "booked" : "available";
    }
    if (status === "available" && isPast) status = "past";

    return {
      hour,
      status,
      price: priceForSlot(date, hour, pricing),
    };
  });

  return NextResponse.json({ date: dateParam, grid });
}
