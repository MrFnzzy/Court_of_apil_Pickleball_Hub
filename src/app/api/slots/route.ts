import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALL_HOURS, priceForSlot } from "@/lib/pricing";
import { getPricingSettings } from "@/lib/pricingSettings";
import { getSiteSettings } from "@/lib/siteSettings";
import { isAdminAuthed } from "@/lib/auth";
import { sendFeedbackEmailsForFinishedBookings } from "@/lib/feedbackEmail";
import { sendSpinInvitesForFinishedBookings } from "@/lib/spinWheelEmail";

export const dynamic = "force-dynamic";

// GET /api/slots?date=YYYY-MM-DD&admin=1
// Returns the full 24-hour grid for the given date with status per hour:
// "past" | "available" | "pending" | "booked"
//
// When admin=1 is passed AND the request carries a valid admin session,
// each occupied slot also includes a `booking` summary (renter name,
// contact, totals, payment ref, status) so the admin dashboard's schedule
// grid can show who booked a slot without a second request. Public callers
// (the customer-facing /book page) never receive these fields. Admin
// requests also get an open past hour back as "available" rather than
// "past" (flagged via `isPast` instead) so a manual/walk-in booking can
// still be logged into it after the fact — see the note below. Admin
// requests also get a `linkedBooking` field on any booking that's part of
// a multi-day pair (see groupId on the Booking model) — the other date +
// hours it was booked together with — so the dashboard can flag it as a
// multi-day booking and show both halves without a second lookup.
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

  // When editing an existing booking, its own currently-held slots would
  // otherwise show up "booked"/"pending" and be unpickable — this lets the
  // admin edit form report them as available instead, so the admin can
  // keep or re-toggle the same hours as part of the same booking.
  const excludeBookingId = isAdmin ? req.nextUrl.searchParams.get("excludeBookingId") : null;

  // NOTE: pending bookings are intentionally never auto-rejected here, even
  // once their reserved time has passed — they still need a human admin
  // decision either way (see the "past" cutoff below, which only affects
  // display/availability, not the booking's actual status in the database).
  // Best-effort: email anyone whose confirmed booking time just finished.
  await sendFeedbackEmailsForFinishedBookings();
  await sendSpinInvitesForFinishedBookings();

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
              ballCount: true,
              ballTotal: true,
              grandTotal: true,
              paddleCount: true,
              paymentMethod: true,
              referenceNumber: true,
              amountSent: true,
              adminNote: true,
              groupId: true,
            }
          : { status: true, customerName: true, contactNumber: true },
      },
    },
  });

  // A booking made together with another date (see groupId on the Booking
  // model) shows up here as just its own single-date row — so for admin
  // requests, look up the sibling row(s) sharing the same groupId and
  // attach a compact summary of the *other* date/hours onto each booking,
  // so the dashboard's popover can flag it as a multi-day booking and show
  // where the other half of it lives.
  let linkedByBookingId = new Map<string, { date: string; startHours: number[] }>();
  if (isAdmin) {
    const groupIds = Array.from(
      new Set(
        slots
          .map((s: (typeof slots)[number]) => (s.booking as any)?.groupId as string | null | undefined)
          .filter((g): g is string => !!g)
      )
    );
    if (groupIds.length > 0) {
      const groupRows = await prisma.booking.findMany({
        where: { groupId: { in: groupIds } },
        select: { id: true, groupId: true, date: true, startHours: true },
      });
      const byGroup = new Map<string, typeof groupRows>();
      for (const row of groupRows) {
        const arr = byGroup.get(row.groupId as string) || [];
        arr.push(row);
        byGroup.set(row.groupId as string, arr);
      }
      for (const s of slots as (typeof slots)[number][]) {
        const b = s.booking as any;
        if (!b?.groupId) continue;
        const siblings = byGroup.get(b.groupId) || [];
        const other = siblings.find((r) => r.id !== b.id);
        if (other && !linkedByBookingId.has(b.id)) {
          linkedByBookingId.set(b.id, {
            date: other.date.toISOString().slice(0, 10),
            startHours: other.startHours,
          });
        }
      }
    }
  }

  const pricing = await getPricingSettings();
  const siteSettings = await getSiteSettings();
  const closedHours = new Set(siteSettings.closedHours);

  // Philippines is UTC+8; convert "now" to a Manila-local instant for
  // comparing against each slot's start time.
  const now = new Date();
  const manilaNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  const grid = ALL_HOURS.map((hour) => {
    const slot = slots.find((s: (typeof slots)[number]) => s.hour === hour);
    let status: "past" | "available" | "pending" | "booked" | "closed" = "available";

    // Booking cutoff: an hour-slot stops being offered once it's been
    // sitting empty for 10 minutes *after its own start time* — e.g. the
    // 5:00 AM slot is still bookable at 5:00, 5:05, etc., and only flips
    // to unavailable at 5:10 if nobody's grabbed it. This only ever
    // affects that hour itself: it never reaches forward to flag the
    // *next* hour early just because the current one is close to over.
    // (Computed as real timestamps, not just an hour comparison, so the
    // 10-minute grace period is exact.)
    const slotStartManila = new Date(date.getTime() + hour * 60 * 60 * 1000);
    const bookingCutoff = new Date(slotStartManila.getTime() + 10 * 60 * 1000);
    const isPast = manilaNow >= bookingCutoff;

    if (slot) {
      status = slot.booking.status === "PENDING" ? "pending" : slot.booking.status === "CONFIRMED" ? "booked" : "available";
    }
    if (excludeBookingId && slot && slot.bookingId === excludeBookingId) {
      status = "available";
    }
    if (status === "available" || status === "pending") {
      if (isPast) {
        // Admins can still log a manual/walk-in booking into an hour whose
        // start time has already passed (e.g. writing up a walk-in after
        // the fact, or catching a slot nobody used) — so for admin
        // requests, a genuinely open hour (no real booking sitting in it)
        // keeps reading as "available" here instead of flipping to "past".
        // It's still flagged via `isPast` below so the dashboard can show
        // it visually distinct from a normal upcoming slot. A slot that's
        // PENDING doesn't get this treatment — that's an unresolved
        // existing reservation, not an empty hour, and still needs an
        // explicit approve/reject decision rather than being silently
        // bookable over.
        if (!(isAdmin && status === "available")) {
          status = "past";
        }
      } else if (status === "available" && closedHours.has(hour)) {
        // Admin sees this hour flagged as "closed" so it can be reopened
        // from the Hours & alerts tab. Customers never see the distinction
        // — it simply reads the same as any other unavailable slot.
        status = isAdmin ? "closed" : "past";
      }
    }

    return {
      hour,
      status,
      price: priceForSlot(date, hour, pricing),
      booking:
        isAdmin && slot
          ? {
              ...(slot.booking as any),
              linkedBooking: linkedByBookingId.get((slot.booking as any).id) || null,
            }
          : undefined,
      // Only meaningful for admin's own use (see note above) — lets the
      // dashboard show a still-bookable past hour distinctly from a normal
      // upcoming one, without it affecting selectability either way.
      isPast,
    };
  });

  return NextResponse.json({ date: dateParam, grid });
}
