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
type Candidate = {
  id: string;
  date: Date;
  startHours: number[];
  email: string;
  customerName: string;
  referenceNumber: string;
  groupId: string | null;
};

function hasFullyElapsed(b: { date: Date; startHours: number[] }, todayStr: string, manilaHour: number): boolean {
  const bookingDateStr = b.date.toISOString().slice(0, 10);
  if (bookingDateStr < todayStr) return true; // the whole day is already over
  const lastHour = Math.max(...b.startHours);
  return bookingDateStr === todayStr && lastHour + 1 <= manilaHour;
}

export async function autoRejectExpiredPendingBookings(): Promise<void> {
  const manila = manilaNow();
  const todayStr = manila.toISOString().slice(0, 10);
  const manilaHour = manila.getUTCHours();

  // Only bookings dated today-or-earlier can possibly have fully elapsed,
  // so this stays a small, cheap query even as the bookings table grows.
  const candidates: Candidate[] = await prisma.booking.findMany({
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
      groupId: true,
    },
  });

  const expired = candidates.filter((b) => hasFullyElapsed(b, todayStr, manilaHour));

  // A multi-day booking is one reservation split across rows that share a
  // groupId (see groupId in the admin bookings routes) — auto-reject the
  // whole group together and send a single email, not one row + one email
  // at a time, so a customer with a 2-day pending booking doesn't get two
  // separate "not confirmed" emails as each date happens to elapse.
  const singleRowGroups: Candidate[][] = [];
  const seenGroupIds = new Set<string>();
  for (const b of expired) {
    if (!b.groupId) {
      singleRowGroups.push([b]);
      continue;
    }
    if (seenGroupIds.has(b.groupId)) continue;
    seenGroupIds.add(b.groupId);
  }

  const groupsToProcess: Candidate[][] = [...singleRowGroups];
  for (const groupId of seenGroupIds) {
    // Pull every row of the group (not just the ones that individually
    // matched the cheap `date <= today` candidate query above) so we can
    // tell whether the *entire* reservation has elapsed, not just its
    // earliest date.
    const groupRows: Candidate[] = await prisma.booking.findMany({
      where: { groupId, status: "PENDING" },
      select: {
        id: true,
        date: true,
        startHours: true,
        email: true,
        customerName: true,
        referenceNumber: true,
        groupId: true,
      },
    });
    if (groupRows.length === 0) continue;
    const allElapsed = groupRows.every((row) => hasFullyElapsed(row, todayStr, manilaHour));
    if (!allElapsed) continue; // still awaiting a future date in the group — leave the whole thing pending
    groupsToProcess.push(groupRows);
  }

  for (const group of groupsToProcess) {
    // Atomically claim every row in the group. If another concurrent sweep
    // (or an admin who just clicked approve/reject) already changed one of
    // them, this touches 0 rows for that id and we skip the whole group —
    // never overwrite a real human decision with an auto-rejection.
    const claims = await Promise.all(
      group.map((b) =>
        prisma.booking.updateMany({
          where: { id: b.id, status: "PENDING" },
          data: { status: "REJECTED", adminNote: AUTO_REJECT_NOTE },
        })
      )
    );
    if (claims.some((c) => c.count === 0)) continue;

    try {
      // Free the slot(s) back up, same as a manual rejection does.
      await prisma.slot.deleteMany({ where: { bookingId: { in: group.map((b) => b.id) } } });
    } catch (e) {
      console.error(
        "Failed to free slots for auto-rejected booking group",
        group.map((b) => b.id),
        e
      );
    }

    const first = group[0];
    try {
      await sendRejectionEmail({
        email: first.email,
        customerName: first.customerName,
        dates: group.map((b) => ({ date: b.date, startHours: b.startHours })),
        referenceNumber: first.referenceNumber,
        reason: AUTO_REJECT_NOTE,
      });
    } catch (e) {
      // Best-effort — never let an email failure stop the sweep. The
      // booking is already rejected and its slot already freed either way.
      console.error("Auto-reject email failed:", e);
    }
  }
}
