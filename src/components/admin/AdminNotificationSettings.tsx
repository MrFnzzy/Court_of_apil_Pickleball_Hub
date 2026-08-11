"use client";

import { useEffect, useState } from "react";

// Converts the VAPID public key (a base64url string) into the raw byte
// array the Push API's applicationServerKey option actually wants.
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray.buffer;
}

type Status = "unsupported" | "unconfigured" | "default" | "denied" | "checking" | "subscribed" | "unsubscribed";

/**
 * Lets the admin turn on real OS-level notifications (new bookings, etc.)
 * for this browser/device. Uses the Web Push standard via the service
 * worker already registered by InstallAppButton — works in any Chrome/
 * Edge/Firefox tab, and on iPhone once the app has been "Added to Home
 * Screen" (Apple's requirement — push doesn't work in a plain Safari tab).
 */
export default function AdminNotificationSettings() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (!publicKey) {
        setStatus("unconfigured");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "subscribed" : "unsubscribed");
      } catch {
        setStatus("unsubscribed");
      }
    }
    check();
  }, [publicKey]);

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "unsubscribed");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      const label = /iphone|ipad|ipod/i.test(navigator.userAgent)
        ? "iPhone"
        : /android/i.test(navigator.userAgent)
          ? "Android"
          : "Desktop browser";

      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, label }),
      });
      if (!res.ok) throw new Error("Failed to save subscription.");
      setStatus("subscribed");
    } catch (err: any) {
      setError(err.message || "Couldn't enable notifications on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/admin/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("unsubscribed");
    } catch (err: any) {
      setError(err.message || "Couldn't turn off notifications.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking") return null;

  return (
    <div className="rounded-court bg-white border-2 border-court-ink/10 shadow-court p-5 sm:p-6">
      <h3 className="font-display font-600 text-lg text-court-ink mb-1">Push notifications</h3>
      <p className="text-sm text-court-ink/60 mb-4">
        Get a real notification on this device — right in your notification bar — the moment a new booking comes in.
      </p>

      {status === "unsupported" && (
        <p className="text-sm text-court-ink/50 italic">This browser doesn't support push notifications.</p>
      )}

      {status === "unconfigured" && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Not set up yet — the site owner needs to add VAPID keys to the environment (see DEPLOYMENT.md) before this can be turned on.
        </p>
      )}

      {status === "denied" && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          Notifications are blocked for this site in your browser settings. Re-enable them from your browser's site settings, then reload this page.
        </p>
      )}

      {(status === "subscribed" || status === "unsubscribed" || status === "default") && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={status === "subscribed" ? disable : enable}
            disabled={busy}
            className={`focus-ring rounded-full px-5 py-2 text-sm font-semibold shadow-court disabled:opacity-50 ${
              status === "subscribed"
                ? "bg-white text-court-ink/70 border-2 border-court-ink/15 hover:bg-court-ink/5"
                : "bg-court-orange text-white hover:bg-court-orange-dark"
            }`}
          >
            {busy ? "Working…" : status === "subscribed" ? "Turn off for this device" : "Enable on this device"}
          </button>
          {status === "subscribed" && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-court-blue-dark">
              <span className="h-1.5 w-1.5 rounded-full bg-court-blue-dark" /> On for this device
            </span>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      <p className="text-xs text-court-ink/40 mt-4 leading-relaxed">
        This only turns notifications on for the browser/device you're using right now — enable it separately on
        each phone or computer you want to hear from. On iPhone, this only works after you've added the admin
        app to your Home Screen first (Apple's requirement).
      </p>
    </div>
  );
}
