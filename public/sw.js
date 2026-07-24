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
