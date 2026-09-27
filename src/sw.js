// SHLstats service worker: network first, so the app always shows fresh data when online,
// and falls back to the last copy it saw when offline. The build stamps its version into the
// cache name below, which makes the browser install a new worker after every update.
const CACHE = 'shlstats-__BUILD__';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // Drop caches from older builds
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // logos, photos and video load normally
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    } catch {
      // Offline: same file ignoring the ?v= version, or the app shell for page loads
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      if (req.mode === 'navigate') return (await caches.match('./index.html')) || (await caches.match('./'));
      return new Response('', { status: 503, statusText: 'Offline' });
    }
  })());
});
