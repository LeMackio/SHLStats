// SHLstats service worker: network first, so the app always shows fresh data when online,
// and falls back to the last copy it saw when offline. The build stamps its version into the
// cache name below, which makes the browser install a new worker after every update.
// It also shows push notifications (goals, face-off reminders, final scores) for the followed team.
const CACHE = 'shlstats-__BUILD__';
const PUSH = 'shlstats-push'; // notification settings and which notifications were already shown
const RELAY = 'https://shlstats-live.marcuskbroman.workers.dev';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // Drop caches from older builds (the notification settings are kept)
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== PUSH).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // logos, photos and video load normally
  e.respondWith((async () => {
    try {
      // The page itself and the data are always checked with the server (the browser may otherwise reuse a copy
      // for up to 10 minutes after a new version is published); versioned files (?v=) can come from the browser cache
      const fresh = req.mode === 'navigate' || /\.json$/.test(url.pathname) || url.pathname.endsWith('/');
      const res = await fetch(req, fresh ? { cache: 'no-cache' } : undefined);
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

// Push: the relay sends a wake-up without text; the latest texts for the followed team are fetched from it
const readJson = async (cache, key, fallback) => { try { const r = await cache.match(key); return r ? await r.json() : fallback; } catch { return fallback; } };
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(PUSH);
    const conf = await readJson(c, '/push-config', {}), seen = await readJson(c, '/push-seen', []);
    let list = [];
    try { list = (await (await fetch(`${RELAY}/push/events?teams=${encodeURIComponent((conf.teams || []).join(','))}`, { cache: 'no-store' })).json()).events || []; } catch { /* offline */ }
    const fresh = list.filter((ev) => !seen.includes(ev.id) && Date.now() - ev.at < 30 * 60e3 && conf.prefs?.[ev.kind] !== false).slice(0, 3).reverse();
    if (!fresh.length) fresh.push(list[0] || { id: 'shlstats', title: 'SHLstats', body: 'Nytt i ditt lags match.', url: './' }); // a push must always show something
    for (const ev of fresh) {
      await self.registration.showNotification(ev.title, { body: ev.body, tag: ev.id, icon: 'icons/icon-192.png', badge: 'icons/favicon-64.png', data: { url: ev.url || './' } });
    }
    await c.put('/push-seen', new Response(JSON.stringify([...fresh.map((x) => x.id), ...seen].slice(0, 100))));
  })());
});

// Tapping a notification opens the game (in the open app if there is one)
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || './';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) if ('focus' in w) { try { await w.navigate(url); } catch { /* keep the current page */ } return w.focus(); }
    return self.clients.openWindow(url);
  })());
});
