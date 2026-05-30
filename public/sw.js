// Minimal service worker — enables PWA installability.
// No offline caching; all requests pass through to the network.

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request))
})
