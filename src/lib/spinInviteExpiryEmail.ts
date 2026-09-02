import { prisma } from "./prisma";
import { sendSpinInviteExpiryReminderEmail } from "./email";

// How many days before expiry the "you haven't spun yet" reminder goes
// out. Matches the same constant used for the won-discount-code expiry
// reminder (discountExpiryEmail.ts) for consistency, though this covers a
// different thing: the invite itself expiring, not a prize already won.
const REMINDER_DAYS_BEFORE_EXPIRY = 5;

/**
 * Reminds a customer when their unused spin-the-wheel invite is about to
 * expire — a nudge for someone who was emailed a spin link and never got
 * around to using it.
 *
 * Scope: only unspun, un-revoked invites with a known expiresAt (invites
 * sent while inviteExpiryDays was null never expire, so there's nothing to
 * remind about). Like the other sweeps in this app, this runs lazily on
 * read rather than a real cron job — see the call sites in the
 * bookings/slots routes. Each invite is only ever emailed once, tracked via
 * inviteExpiryReminderSentAt, so re-running this constantly is safe.
 */
export async function sendSpinInviteExpiryReminders(): Promise<void> {
  const now = new Date();
  const reminderCutoff = new Date(now.getTime() + REMINDER_DAYS_BEFORE_EXPIRY * 24 * 60 * 60 * 1000);

  const candidates = await prisma.spinInvite.findMany({
    where: {
      spunAt: null,
      revokedAt: null,
      inviteExpiryReminderSentAt: null,
      expiresAt: { not: null, gte: now, lte: reminderCutoff },
    },
  });

  for (const invite of candidates) {
    if (!invite.email) continue;

    // Atomically claim before sending so two overlapping sweeps can't ever
    // double-send the same reminder.
    const claim = await prisma.spinInvite.updateMany({
      where: { id: invite.id, inviteExpiryReminderSentAt: null },
      data: { inviteExpiryReminderSentAt: now },
    });
    if (claim.count === 0) continue;

    const daysLeft = Math.max(1, Math.ceil((invite.expiresAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

    try {
      await sendSpinInviteExpiryReminderEmail({
        email: invite.email,
        customerName: invite.customerName,
        token: invite.token,
        expiresAt: invite.expiresAt!,
        daysLeft,
      });
    } catch (e) {
      // Best-effort — the claim already stuck, so this won't retry (same
      // trade-off the other expiry-reminder sweep makes: avoiding a
      // duplicate email matters more here than guaranteeing delivery).
      console.error("Spin invite expiry reminder email failed:", e);
    }
  }
}
