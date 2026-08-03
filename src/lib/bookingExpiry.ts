import { prisma } from "./prisma";
import { sendRejectionEmail } from "./email";

// Philippines is UTC+8. Mirrors the same conversion used in /api/slots and
// the /book page so "is this hour past?" is computed consistently everywhere.
function manilaNow(): Date {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000);
}

/**
 * Auto-rejects bookings that are still PENDING once their reserved time has
 * fully passed without an admin approving them. There's no real payment
 * hold on a "pending" slot — it's just blocking the calendar — so once the
 * court time is gone, the request can no longer be honored either way.
 *
 * This runs as a lazy sweep (checked whenever slots/bookings are read)
 * rather than a scheduled cron job, so it needs no extra infrastructure and
 * always reflects the current time on the next request.
 */
export async function expireStalePendingBookings(): Promise<void> {
  const manila = manilaNow();
  const todayStr = manila.toISOString().slice(0, 10);
  const manilaHour = manila.getUTCHours();

  // Only bookings dated today-or-earlier can possibly have an elapsed hour,
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
    if (bookingDateStr < todayStr) return true; // the whole day is already gone
    const lastHour = Math.max(...b.startHours);
    // Same convention as /api/slots: an hour counts as past once it has
    // started (hour <= current hour), so the booking expires once its
    // latest reserved hour has begun.
    return bookingDateStr === todayStr && lastHour <= manilaHour;
  });

  for (const booking of expired) {
    try {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "REJECTED",
          adminNote: "Automatically rejected — the reserved time passed before it was approved.",
        },
      });
      // Free the slots immediately so they can't keep blocking the calendar.
      await prisma.slot.deleteMany({ where: { bookingId: booking.id } });
    } catch (e) {
      console.error("Failed to auto-expire booking", booking.id, e);
      continue;
    }

    try {
      await sendRejectionEmail({
        email: booking.email,
        customerName: booking.customerName,
        date: booking.date,
        startHours: booking.startHours,
        referenceNumber: booking.referenceNumber,
        reason: "Your booking wasn't approved in time and the reserved slot has now passed.",
      });
    } catch (e) {
      // Never let an email failure stop the sweep or the request that
      // triggered it — this is a best-effort notification.
      console.error("Auto-expire rejection email failed:", e);
    }
  }
}
