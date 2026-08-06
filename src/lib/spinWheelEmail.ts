import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import { sendSpinWheelInviteEmail } from "./email";
import { getSpinWheelSettings } from "./spinWheelSettings";

// Philippines is UTC+8 — same conversion used everywhere else in the app.
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
 * Finds CONFIRMED bookings whose reserved time has fully elapsed, that
 * haven't already had a spin-wheel invite sent, and that fall on or after
 * the admin's configured start date — then emails each one a one-time spin
 * link.
 *
 * This is gated behind the spin wheel feature's `enabled` switch: while
 * it's off, this function is a no-op, so flipping it on never causes a
 * flood of invites for bookings that finished while the feature was off —
 * only bookings finishing *after* it's turned on (and on/after startDate)
 * ever get emailed, since spinInviteSentAt is only ever set right before a
 * successful send.
 *
 * Runs as a lazy sweep on read, same pattern as
 * sendFeedbackEmailsForFinishedBookings — no extra cron infrastructure
 * needed.
 */
export async function sendSpinInvitesForFinishedBookings(): Promise<void> {
  const settings = await getSpinWheelSettings();
  if (!settings.enabled) return;

  const manila = manilaNow();
  const todayStr = manila.toISOString().slice(0, 10);
  const manilaHour = manila.getUTCHours();

  const dateFilter: { lte: Date; gte?: Date } = { lte: new Date(`${todayStr}T00:00:00.000Z`) };
  if (settings.startDate) {
    dateFilter.gte = settings.startDate;
  }

  const candidates: FinishedBooking[] = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      spinInviteSentAt: null,
      date: dateFilter,
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
    if (bookingDateStr < todayStr) return true;
    const lastHour = Math.max(...b.startHours);
    return bookingDateStr === todayStr && lastHour + 1 <= manilaHour;
  });

  if (finished.length === 0) return;

  // One invite per visit (email + date), same grouping logic as the
  // feedback sweep, so a visit split across multiple booking rows doesn't
  // get emailed twice.
  const groups = new Map<string, FinishedBooking[]>();
  for (const b of finished) {
    const key = `${b.email.trim().toLowerCase()}|${b.date.toISOString().slice(0, 10)}`;
    const existing = groups.get(key);
    if (existing) existing.push(b);
    else groups.set(key, [b]);
  }

  for (const group of groups.values()) {
    const ids = group.map((b) => b.id);

    // Atomically claim every row in the group so a concurrent sweep can
    // never send the same invite twice.
    const claim = await prisma.booking.updateMany({
      where: { id: { in: ids }, spinInviteSentAt: null },
      data: { spinInviteSentAt: new Date() },
    });
    if (claim.count !== ids.length) continue;

    const [primary] = group;
    const token = randomUUID();

    try {
      await prisma.spinInvite.create({
        data: {
          token,
          bookingId: primary.id,
          email: primary.email,
          customerName: primary.customerName,
        },
      });
    } catch (e) {
      console.error("Failed to create spin invite for booking", primary.id, e);
      continue;
    }

    try {
      await sendSpinWheelInviteEmail({
        email: primary.email,
        customerName: primary.customerName,
        token,
      });
    } catch (e) {
      // Best-effort — the invite row already exists, so the customer can
      // always be resent the link manually by the venue if needed.
      console.error("Spin wheel invite email failed:", e);
    }
  }
}
