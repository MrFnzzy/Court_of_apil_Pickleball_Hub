import webpush from "web-push";
import { prisma } from "./prisma";

// Web Push (the same standard behind real browser/PWA notifications) needs a
// VAPID keypair so push services (Google's FCM for Chrome, Apple's push
// service for Safari/iOS, etc.) can verify these notifications are actually
// coming from this app and not being spoofed. Generate your own with
// `npx web-push generate-vapid-keys` and set them as env vars — see
// DEPLOYMENT.md. VAPID_SUBJECT should be a mailto: link or site URL; it's
// how push services can contact you if something's misbehaving.
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@heidespickleballhub.local";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Path to open (e.g. "/admin") when the notification is tapped. */
  url?: string;
  /** Groups related notifications so a burst of events (e.g. several
   * bookings at once) replaces rather than stacks in the notification
   * shade — same idea as Android/iOS notification "tags". */
  tag?: string;
};

export type PushResult = {
  sent: number;
  failed: number;
  /** No admin device has ever enabled notifications yet. */
  noSubscriptions: boolean;
  /** VAPID env vars aren't set at all. */
  notConfigured: boolean;
  errors: string[];
};

/**
 * Sends a push notification to every device the admin has enabled
 * notifications on. Best-effort per device: a device that's uninstalled the
 * app or revoked permission fails with a 404/410 from the push service,
 * which we treat as "no longer valid" and clean up automatically so the
 * subscriptions table doesn't accumulate dead entries. Other failures (e.g.
 * a mismatched VAPID key) are reported back in `errors` instead of just
 * logged, so a caller like the "Send test notification" button can show the
 * admin exactly what went wrong instead of a silent no-op.
 */
export async function sendAdminPushNotification(payload: PushPayload): Promise<PushResult> {
  if (!ensureConfigured()) {
    console.warn("Push notifications not configured — set VAPID_PRIVATE_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY to enable them.");
    return { sent: 0, failed: 0, noSubscriptions: false, notConfigured: true, errors: [] };
  }

  const subs = await prisma.adminPushSubscription.findMany();
  if (subs.length === 0) {
    return { sent: 0, failed: 0, noSubscriptions: true, notConfigured: false, errors: [] };
  }

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  await Promise.all(
    subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string; label: string | null }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        sent++;
      } catch (err: any) {
        failed++;
        // 404/410 = the push subscription is dead (uninstalled, permission
        // revoked, or the browser rotated it) — remove it so we stop
        // wasting a send attempt on it every time.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await prisma.adminPushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          errors.push(`${sub.label || "A device"}: subscription expired and was removed — re-enable notifications on that device.`);
        } else if (err?.statusCode === 401 || err?.statusCode === 403) {
          errors.push(
            `${sub.label || "A device"}: rejected as unauthorized — this almost always means the VAPID key changed since that device subscribed. Turn notifications off and back on for that device.`
          );
        } else {
          console.error("Push send failed:", err?.statusCode, err?.body || err);
          errors.push(`${sub.label || "A device"}: ${err?.statusCode ? `HTTP ${err.statusCode}` : "send failed"} — ${err?.body || err?.message || "unknown error"}`);
        }
      }
    })
  );

  return { sent, failed, noSubscriptions: false, notConfigured: false, errors };
}
