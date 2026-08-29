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
  contactNumber: string;
};

// --- Same-person matching -------------------------------------------------
// A customer can end up with more than one Booking row on the same day
// (e.g. a separate morning and afternoon checkout) and may not type their
// details identically each time — but any two rows that share an email, a
// phone number, or a name are almost certainly the same person, and this
// feature should only ever invite that person once per day no matter how
// many of their bookings match or how they're split up.

function normEmail(email: string): string | null {
  const v = email.trim().toLowerCase();
  return v || null;
}

function normPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  // Compare only the last 10 digits so "09171234567", "+639171234567", and
  // "639171234567" (same PH number, different formatting/country-code
  // habits) all match. Too-short input is ambiguous enough to skip rather
  // than risk falsely merging two different people.
  return digits.length >= 7 ? digits.slice(-10) : null;
}

function normName(name: string): string | null {
  const v = name.trim().toLowerCase().replace(/\s+/g, " ");
  return v.length >= 2 ? v : null;
}

// Groups same-day bookings into "same person" clusters using a small
// union-find: any two bookings on the same calendar day that share a
// normalized email, phone, or name get merged into one group, regardless
// of which field happened to match or how many bookings are chained
// together by it (A matches B on phone, B matches C on email -> A, B, and
// C all end up in one group together).
function groupSamePersonSameDay(bookings: FinishedBooking[]): FinishedBooking[][] {
  const parent = new Map<string, string>();
  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    while (parent.get(x) !== root) {
      const next = parent.get(x)!;
      parent.set(x, root);
      x = next;
    }
    return root;
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  for (const b of bookings) parent.set(b.id, b.id);

  const byKey = new Map<string, string[]>();
  function index(field: string, dateStr: string, key: string | null, id: string) {
    if (!key) return;
    const bucket = `${field}|${dateStr}|${key}`;
    const ids = byKey.get(bucket);
    if (ids) ids.push(id);
    else byKey.set(bucket, [id]);
  }
  for (const b of bookings) {
    const dateStr = b.date.toISOString().slice(0, 10);
    index("email", dateStr, normEmail(b.email), b.id);
    index("phone", dateStr, normPhone(b.contactNumber), b.id);
    index("name", dateStr, normName(b.customerName), b.id);
  }
  for (const ids of byKey.values()) {
    for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);
  }

  const groups = new Map<string, FinishedBooking[]>();
  for (const b of bookings) {
    const root = find(b.id);
    const arr = groups.get(root);
    if (arr) arr.push(b);
    else groups.set(root, [b]);
  }
  return [...groups.values()];
}


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
      contactNumber: true,
    },
  });

  const finished = candidates.filter((b) => {
    const bookingDateStr = b.date.toISOString().slice(0, 10);
    if (bookingDateStr < todayStr) return true;
    const lastHour = Math.max(...b.startHours);
    return bookingDateStr === todayStr && lastHour + 1 <= manilaHour;
  });

  if (finished.length === 0) return;

  // One invite per *person* per day, not per booking row or even per exact
  // email — see groupSamePersonSameDay() above. This is what makes "book 2
  // hours in the morning, then 2 more in the afternoon" collapse into a
  // single invite even when the two checkouts don't type in identical
  // contact details.
  const groups = groupSamePersonSameDay(finished);

  for (const group of groups.values()) {
    // Eligibility gate: the visit's total booked hours (across every slot
    // in the visit — e.g. two separate 1-hour bookings on the same day
    // both count) must meet the admin's configured minimum. A visit that
    // doesn't qualify is left alone entirely — not marked as sent — so if
    // the customer books more hours later that day (or the admin lowers
    // the threshold), the sweep can still pick it up next time.
    const totalHours = group.reduce((sum, b) => sum + b.startHours.length, 0);
    if (totalHours < settings.minHoursForSpin) continue;

    const ids = group.map((b) => b.id);

    // Atomically claim every row in the group so a concurrent sweep can
    // never send the same invite twice.
    const claim = await prisma.booking.updateMany({
      where: { id: { in: ids }, spinInviteSentAt: null },
      data: { spinInviteSentAt: new Date() },
    });
    if (claim.count !== ids.length) continue;

    // Cross-run same-person check: groupSamePersonSameDay() above only
    // sees bookings that are *still eligible this run* — a morning booking
    // that already got its invite in an earlier sweep has spinInviteSentAt
    // set, so it's excluded from `candidates` and can't be unioned with
    // this afternoon booking directly. Look it up separately: any other
    // CONFIRMED booking on the same day that matches this group on email,
    // phone, or name and has already been sent an invite means this is the
    // same person getting a second visit that day, not a new one — so
    // these newly-claimed rows stay marked as sent (preventing a future
    // duplicate) but don't trigger another email or SpinInvite row.
    const dateStr = group[0].date.toISOString().slice(0, 10);
    const dayPeers = await prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        date: { gte: new Date(`${dateStr}T00:00:00.000Z`), lte: new Date(`${dateStr}T23:59:59.999Z`) },
        id: { notIn: ids },
        spinInviteSentAt: { not: null },
      },
      select: { email: true, contactNumber: true, customerName: true },
    });
    const groupEmails = new Set(group.map((b) => normEmail(b.email)).filter((v): v is string => !!v));
    const groupPhones = new Set(group.map((b) => normPhone(b.contactNumber)).filter((v): v is string => !!v));
    const groupNames = new Set(group.map((b) => normName(b.customerName)).filter((v): v is string => !!v));
    const alreadyInvitedToday = dayPeers.some((p: { email: string; contactNumber: string; customerName: string }) => {
      const e = normEmail(p.email);
      const ph = normPhone(p.contactNumber);
      const n = normName(p.customerName);
      return (e && groupEmails.has(e)) || (ph && groupPhones.has(ph)) || (n && groupNames.has(n));
    });
    if (alreadyInvitedToday) continue;

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
