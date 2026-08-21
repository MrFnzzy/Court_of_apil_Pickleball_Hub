import { prisma } from "./prisma";
import { sendRejectionEmail } from "./email";

// Philippines is UTC+8 — same conversion used everywhere else (/api/slots,
// feedbackEmail.ts) so "has this booking's time fully passed?" is computed
// consistently across the app.
function manilaNow(): Date {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000);
}

const AUTO_REJECT_NOTE =
  "Auto-rejected: the reserved time passed without an admin verifying the payment.";

/**
 * Finds PENDING bookings whose reserved hour(s) have fully elapsed —
 * i.e. nobody ever approved or rejected the payment proof before the slot's
 * own time ran out — and automatically rejects them, freeing the slot back
 * up and notifying the customer, instead of leaving them stuck PENDING
 * forever with no possible outcome.
 *
 * A booking is only auto-rejected once its *last* hour has fully ended
 * (start of latest hour + 1), same "fully finished" rule used for the
 * post-play feedback email sweep — a booking spanning 8-9am and 9-10am only
 * auto-rejects once 10:00 has passed, not at 9:00.
 *
 * Runs as a lazy sweep on read (called from /api/slots and
 * /api/admin/bookings) rather than a scheduled job, same pattern as
 * feedbackEmail.ts and spinWheelEmail.ts — no extra infrastructure needed,
 * and it always reflects the current time on the next request.
 *
 * Uses the same atomic-claim approach as the feedback sweep: the status
 * update is conditioned on `status: "PENDING"` still being true at write
 * time, so two concurrent sweeps (or a sweep racing an admin's manual
 * approve/reject click) can never both act on the same booking.
 */
export async function autoRejectExpiredPendingBookings(): Promise<void> {
  const manila = manilaNow();
  const todayStr = manila.toISOString().slice(0, 10);
  const manilaHour = manila.getUTCHours();

  // Only bookings dated today-or-earlier can possibly have fully elapsed,
  // so this stays a small, cheap query even as the bookings table grows.
  const candidates = await prisma.booking.findMany({
    where: {
      status: "PENDING",
      date: { lte: new Date(`${todayStr}T00:00:00.000Z`) },
    },
    select: {
      id: true,
      date: true,
      startHours: true,
      email: true,
      customerName: true,
      referenceNumber: true,
    },
  });

  const expired = candidates.filter((b) => {
    const bookingDateStr = b.date.toISOString().slice(0, 10);
    if (bookingDateStr < todayStr) return true; // the whole day is already over
    const lastHour = Math.max(...b.startHours);
    return bookingDateStr === todayStr && lastHour + 1 <= manilaHour;
  });

  for (const booking of expired) {
    // Atomically claim this booking. If another concurrent sweep (or an
    // admin who just clicked approve/reject in the dashboard) already
    // changed its status, this claim touches 0 rows and we skip it —
    // never overwrite a real human decision with an auto-rejection.
    const claim = await prisma.booking.updateMany({
      where: { id: booking.id, status: "PENDING" },
      data: { status: "REJECTED", adminNote: AUTO_REJECT_NOTE },
    });
    if (claim.count === 0) continue;

    try {
      // Free the slot(s) back up, same as a manual rejection does.
      await prisma.slot.deleteMany({ where: { bookingId: booking.id } });
    } catch (e) {
      console.error("Failed to free slots for auto-rejected booking", booking.id, e);
    }

    try {
      await sendRejectionEmail({
        email: booking.email,
        customerName: booking.customerName,
        date: booking.date,
        startHours: booking.startHours,
        referenceNumber: booking.referenceNumber,
        reason: AUTO_REJECT_NOTE,
      });
    } catch (e) {
      // Best-effort — never let an email failure stop the sweep. The
      // booking is already rejected and its slot already freed either way.
      console.error("Auto-reject email failed:", e);
    }
  }
}
