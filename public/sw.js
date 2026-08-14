// Minimal service worker. Its only real job is to make this site
// installable as a PWA on Android/Chrome. We deliberately do NOT cache
// API responses or pages aggressively — booking availability and admin
// data must always be fresh, never served stale from a cache.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch handler. Having a fetch handler at all (even one
// that just re-fetches from the network) is what qualifies the app for
// "Add to Home Screen" / install prompts on Android.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

// ── Push notifications ───────────────────────────────────────────────────
// Shows a real OS-level notification (notification shade on Android,
// Notification Center on iOS 16.4+ — but only for an installed/"Add to
// Home Screen" PWA, Apple's requirement, not a browser tab) whenever the
// server sends a push message, e.g. for a new booking. Works even if the
// app isn't open, since service workers run independently of any open tab.
self.addEventListener("push", (event) => {
  let data = { title: "Dink dink! New booking 🏓", body: "You have a new notification.", url: "/admin" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Fall back to the default above if the payload isn't valid JSON.
  }

  event.waitUntil(
    (async () => {
      // NOTE on sound: the Web Notifications API has no option to attach a
      // custom audio file — every major browser (Chrome, Firefox, Safari)
      // ignores anything other than the OS/browser's own default alert
      // sound here, on every platform including iOS/Android. There is no
      // web API that can swap it for our paddle-tap + chime cue. What we
      // CAN do is reach any admin tab/PWA window that happens to be open
      // right now and have that page itself play the real cheerful cue
      // (see playPushChime in adminAlarmSound.ts) — so on a phone with
      // the dashboard open, the admin still hears "Dink dink, new
      // booking, don't blink!" instead of a generic ping. This only
      // covers the case where a window is open; a fully closed/background
      // app still falls back to the OS's own default notification sound.
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        client.postMessage({ type: "HEIDES_PLAY_CHIME" });
      }

      return self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icons/admin-192.png",
        badge: "/icons/admin-192.png",
        tag: data.tag || "heides-notification",
        data: { url: data.url || "/admin" },
        silent: false,
        // Two short taps then a slightly longer buzz — echoes "dink
        // dink... new booking" instead of one long urgent buzz. This is
        // the one extra bit of "presence" the platform allows us to
        // customize, on Android (iOS Safari ignores vibrate).
        vibrate: [80, 60, 80, 140, 220],
      });
    })()
  );
});

// Tapping the notification focuses an already-open admin tab if there is
// one, otherwise opens a new one at the target URL.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/admin";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
