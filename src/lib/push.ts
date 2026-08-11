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

/**
 * Sends a push notification to every device the admin has enabled
 * notifications on. Best-effort: a device that's uninstalled the app or
 * revoked permission will fail with a 404/410 from the push service, which
 * we treat as "no longer valid" and clean up automatically so the
 * subscriptions table doesn't accumulate dead entries.
 *
 * No-ops quietly (logs once) if VAPID keys aren't configured yet, so this
 * is always safe to call from booking flows even before push is set up.
 */
export async function sendAdminPushNotification(payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) {
    console.warn("Push notifications not configured — set VAPID_PRIVATE_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY to enable them.");
    return;
  }

  const subs = await prisma.adminPushSubscription.findMany();
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err: any) {
        // 404/410 = the push subscription is dead (uninstalled, permission
        // revoked, or the browser rotated it) — remove it so we stop
        // wasting a send attempt on it every time.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await prisma.adminPushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error("Push send failed:", err?.statusCode, err?.body || err);
        }
      }
    })
  );
}
