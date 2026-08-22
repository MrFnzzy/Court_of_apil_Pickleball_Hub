import { v4 as uuidv4 } from "uuid";
import { prisma } from "./prisma";
import { sendFeedbackRequestEmail } from "./email";

// Philippines is UTC+8. Same conversion used everywhere else (/api/slots,
// the /book page) so "has this booking's time fully passed?" is computed
// consistently across the app.
function manilaNow(): Date {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000);
}

type FinishedBooking = {
  id: string;
  date: Date;
  startHours: number[];
  email: string;
  customerName: string;
};

/**
 * Finds CONFIRMED bookings whose reserved time has fully elapsed and that
 * haven't had a "thanks for playing" email sent yet, sends it (with a link
 * to a short feedback form), and records that it was sent so it never goes
 * out twice.
 *
 * A single visit can end up spread across more than one Booking row for the
 * same customer on the same day — e.g. two separate checkouts, one for the
 * 1-2pm slot and another for 2-3pm — and each row would finish independently.
 * To avoid emailing that person twice for one visit, finished bookings are
 * grouped by (email, date) first, and only one email goes out per group,
 * listing every slot they played that day.
 *
 * This function can run concurrently — it's called from several different
 * request handlers (booking, slots, admin bookings), so more than one may be
 * in flight at once. To guarantee a group is never emailed twice even under
 * that concurrency, every booking in a group is claimed in a single atomic
 * `updateMany(... where: feedbackEmailSentAt: null ...)`. Only the caller
 * that successfully claims every row in the group goes on to send the
 * email; if another concurrent run got there first (or got only part of
 * it), this run backs off entirely for that group rather than risk marking
 * a booking "sent" without actually emailing it — any booking left
 * unclaimed just gets picked up again on the next sweep.
 *
 * This runs as a lazy sweep on read rather than a scheduled cron job — it's checked whenever bookings/slots are
 * fetched, so no extra infrastructure is needed and it always reflects the
 * current time on the next request.
 */
export async function sendFeedbackEmailsForFinishedBookings(): Promise<void> {
  const manila = manilaNow();
  const todayStr = manila.toISOString().slice(0, 10);
  const manilaHour = manila.getUTCHours();

  // Only bookings dated today-or-earlier can possibly be finished, so this
  // stays a small, cheap query even as the bookings table grows.
  const candidates: FinishedBooking[] = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      feedbackEmailSentAt: null,
      date: { lte: new Date(`${todayStr}T00:00:00.000Z`) },
    },
    select: {
      id: true,
      date: true,
      startHours: true,
      email: true,
      customerName: true,
    },
  });

  const finished = candidates.filter((b) => {
    const bookingDateStr = b.date.toISOString().slice(0, 10);
    if (bookingDateStr < todayStr) return true; // the whole day is already over
    const lastHour = Math.max(...b.startHours);
    // An hour-long slot starting at `h` runs until `h + 1`, so the booking
    // is only fully finished once the clock has passed that end hour.
    return bookingDateStr === todayStr && lastHour + 1 <= manilaHour;
  });

  if (finished.length === 0) return;

  // Group by customer email + booking date, so one visit that's split
  // across multiple booking rows collapses into a single email.
  const groups = new Map<string, FinishedBooking[]>();
  for (const b of finished) {
    const key = `${b.email.trim().toLowerCase()}|${b.date.toISOString().slice(0, 10)}`;
    const existing = groups.get(key);
    if (existing) existing.push(b);
    else groups.set(key, [b]);
  }

  for (const group of groups.values()) {
    const ids = group.map((b) => b.id);

    // Atomically claim every booking in this group in one statement. The
    // `feedbackEmailSentAt: null` condition means a row only gets touched
    // if it's still unsent, so a concurrent run racing on the same group
    // can never both succeed.
    const claim = await prisma.booking.updateMany({
      where: { id: { in: ids }, feedbackEmailSentAt: null },
      data: { feedbackEmailSentAt: new Date() },
    });

    if (claim.count !== ids.length) {
      // Someone else (a concurrent sweep) already claimed some or all of
      // this group — don't send. Whatever's left unclaimed will simply
      // reappear as a candidate on the next sweep.
      continue;
    }

    const [primary] = group;
    const feedbackToken = uuidv4();
    const allStartHours = Array.from(new Set(group.flatMap((b) => b.startHours))).sort((a, c) => a - c);

    try {
      await prisma.booking.update({
        where: { id: primary.id },
        data: { feedbackToken },
      });
    } catch (e) {
      console.error("Failed to set feedback token for booking group", primary.id, e);
      continue;
    }

    try {
      await sendFeedbackRequestEmail({
        email: primary.email,
        customerName: primary.customerName,
        date: primary.date,
        startHours: allStartHours,
        feedbackToken,
      });
    } catch (e) {
      // Never let an email failure stop the sweep or the request that
      // triggered it — this is a best-effort notification. The bookings are
      // already marked as sent so we won't spam retries; that's an
      // acceptable trade-off since the customer can always be reached
      // again by the venue directly if needed.
      console.error("Feedback request email failed:", e);
    }
  }
}
