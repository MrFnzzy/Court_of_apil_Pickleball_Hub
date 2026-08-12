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
  let data = { title: "Heide's Pickleball Hub", body: "You have a new notification.", url: "/admin" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Fall back to the default above if the payload isn't valid JSON.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/admin-192.png",
      badge: "/icons/admin-192.png",
      tag: data.tag || "heides-notification",
      data: { url: data.url || "/admin" },
      // NOTE on sound: the Web Notifications API has no option to attach a
      // custom audio file — every major browser (Chrome, Firefox, Safari)
      // ignores anything other than the OS/browser's own default alert
      // sound here. `silent: false` (the default) just makes sure the OS
      // doesn't suppress that default sound; there's no web API to swap
      // it for a custom clip like a branded chime. `vibrate` is the one
      // extra bit of "presence" the platform does allow, on Android.
      silent: false,
      vibrate: [200, 100, 200, 100, 400],
    })
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
