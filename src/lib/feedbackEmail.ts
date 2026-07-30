import { v4 as uuidv4 } from "uuid";
import { prisma } from "./prisma";
import { sendFeedbackRequestEmail } from "./email";

// Philippines is UTC+8. Same conversion used everywhere else (bookingExpiry,
// /api/slots, the /book page) so "has this booking's time fully passed?" is
// computed consistently across the app.
function manilaNow(): Date {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000);
}

/**
 * Finds CONFIRMED bookings whose reserved time has fully elapsed and that
 * haven't had a "thanks for playing" email sent yet, sends it (with a link
 * to a short feedback form), and records that it was sent so it never goes
 * out twice.
 *
 * Like expireStalePendingBookings, this runs as a lazy sweep on read rather
 * than a scheduled cron job — it's checked whenever bookings/slots are
 * fetched, so no extra infrastructure is needed and it always reflects the
 * current time on the next request.
 */
export async function sendFeedbackEmailsForFinishedBookings(): Promise<void> {
  const manila = manilaNow();
  const todayStr = manila.toISOString().slice(0, 10);
  const manilaHour = manila.getUTCHours();

  // Only bookings dated today-or-earlier can possibly be finished, so this
  // stays a small, cheap query even as the bookings table grows.
  const candidates = await prisma.booking.findMany({
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

  for (const booking of finished) {
    const feedbackToken = uuidv4();

    try {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { feedbackToken, feedbackEmailSentAt: new Date() },
      });
    } catch (e) {
      console.error("Failed to mark feedback email as sent for booking", booking.id, e);
      continue;
    }

    try {
      await sendFeedbackRequestEmail({
        email: booking.email,
        customerName: booking.customerName,
        date: booking.date,
        startHours: booking.startHours,
        feedbackToken,
      });
    } catch (e) {
      // Never let an email failure stop the sweep or the request that
      // triggered it — this is a best-effort notification. The booking is
      // already marked as sent so we won't spam retries; that's an
      // acceptable trade-off since the customer can always be reached
      // again by the venue directly if needed.
      console.error("Feedback request email failed:", e);
    }
  }
}
