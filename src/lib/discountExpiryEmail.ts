import { prisma } from "./prisma";
import { sendDiscountExpiryReminderEmail, sendDiscountExpiredEmail } from "./email";

// How many days before expiry the "you haven't used this yet" reminder
// goes out. One admin-wide number for now — simple, and matches how the
// spin-wheel invite/result emails aren't per-code configurable either.
const REMINDER_DAYS_BEFORE_EXPIRY = 5;

/**
 * Reminds a customer when their unused, spin-wheel-won discount code is
 * about to expire, and separately notifies them once it actually has.
 *
 * Scope: only ever emails SPIN_WHEEL-sourced codes, because those are the
 * only ones with a known customer attached (via the SpinInvite that
 * generated them — see the `spinInvites` relation on Discount). Admin-typed
 * MANUAL codes have no associated customer email to notify, by design —
 * they're shared/public codes, not issued to one specific person.
 *
 * Like sendSpinInvitesForFinishedBookings, this runs as a lazy sweep on
 * read rather than a real cron job (this app has none) — see the call
 * sites in the bookings/slots routes. Each code is only ever emailed once
 * per stage (reminder, then expired), tracked via expiryReminderSentAt /
 * expiredNotificationSentAt, so re-running this sweep constantly is safe.
 */
export async function sendDiscountExpiryNotifications(): Promise<void> {
  const now = new Date();
  const reminderCutoff = new Date(now.getTime() + REMINDER_DAYS_BEFORE_EXPIRY * 24 * 60 * 60 * 1000);

  // --- Stage 1: "expires in N days, you haven't used it yet" -------------
  const reminderCandidates = await prisma.discount.findMany({
    where: {
      source: "SPIN_WHEEL",
      active: true,
      redemptionCount: 0,
      expiryReminderSentAt: null,
      endDate: { not: null, gte: now, lte: reminderCutoff },
    },
    include: { spinInvites: { take: 1, orderBy: { sentAt: "desc" } } },
  });

  for (const discount of reminderCandidates) {
    const invite = discount.spinInvites[0];
    if (!invite?.email) continue; // no customer to notify — shouldn't happen for SPIN_WHEEL codes, but skip safely

    // Atomically claim before sending so two overlapping sweeps can't ever
    // double-send the same reminder.
    const claim = await prisma.discount.updateMany({
      where: { id: discount.id, expiryReminderSentAt: null },
      data: { expiryReminderSentAt: now },
    });
    if (claim.count === 0) continue;

    const daysLeft = Math.max(1, Math.ceil((discount.endDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

    try {
      await sendDiscountExpiryReminderEmail({
        email: invite.email,
        customerName: invite.customerName,
        code: discount.code,
        percentage: discount.percentage,
        expiresAt: discount.endDate!,
        daysLeft,
      });
    } catch (e) {
      // Best-effort — the claim already stuck, so this won't retry (same
      // trade-off the spin invite sweep makes: avoiding a duplicate email
      // matters more here than guaranteeing delivery of a reminder).
      console.error("Discount expiry reminder email failed:", e);
    }
  }

  // --- Stage 2: "this has now expired" ------------------------------------
  const expiredCandidates = await prisma.discount.findMany({
    where: {
      source: "SPIN_WHEEL",
      redemptionCount: 0,
      expiredNotificationSentAt: null,
      endDate: { not: null, lt: now },
    },
    include: { spinInvites: { take: 1, orderBy: { sentAt: "desc" } } },
  });

  for (const discount of expiredCandidates) {
    const invite = discount.spinInvites[0];
    if (!invite?.email) continue;

    const claim = await prisma.discount.updateMany({
      where: { id: discount.id, expiredNotificationSentAt: null },
      data: { expiredNotificationSentAt: now },
    });
    if (claim.count === 0) continue;

    try {
      await sendDiscountExpiredEmail({
        email: invite.email,
        customerName: invite.customerName,
        code: discount.code,
        percentage: discount.percentage,
      });
    } catch (e) {
      console.error("Discount expired notification email failed:", e);
    }
  }
}
