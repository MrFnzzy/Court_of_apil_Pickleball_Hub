import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALL_HOURS, priceForSlot } from "@/lib/pricing";
import { getPricingSettings } from "@/lib/pricingSettings";
import { isAdminAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/slots?date=YYYY-MM-DD&admin=1
// Returns the full 24-hour grid for the given date with status per hour:
// "past" | "available" | "pending" | "booked"
//
// When admin=1 is passed AND the request carries a valid admin session,
// each occupied slot also includes a `booking` summary (renter name,
// contact, totals, payment ref, status) so the admin dashboard's schedule
// grid can show who booked a slot without a second request. Public callers
// (the customer-facing /book page) never receive these fields.
export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  if (!dateParam) {
    return NextResponse.json({ error: "Missing date param" }, { status: 400 });
  }

  const date = new Date(dateParam + "T00:00:00.000Z");
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const wantsAdminDetail = req.nextUrl.searchParams.get("admin") === "1";
  const isAdmin = wantsAdminDetail && (await isAdminAuthed());

  const slots = await prisma.slot.findMany({
    where: { date },
    include: {
      booking: {
        select: isAdmin
          ? {
              id: true,
              status: true,
              customerName: true,
              contactNumber: true,
              email: true,
              startHours: true,
              courtTotal: true,
              rentalTotal: true,
              grandTotal: true,
              paddleCount: true,
              paymentMethod: true,
              referenceNumber: true,
              amountSent: true,
              adminNote: true,
            }
          : { status: true, customerName: true, contactNumber: true },
      },
    },
  });

  const pricing = await getPricingSettings();

  // Philippines is UTC+8; convert "now" to Manila local hour for past-slot comparison
  const now = new Date();
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
      booking: isAdmin && slot ? (slot.booking as any) : undefined,
    };
  });

  return NextResponse.json({ date: dateParam, grid });
}
