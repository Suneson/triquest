// sw.js — offline-first service worker. Precaches the app shell and serves
// cache-first, falling back to the network (and to index.html for navigations).

const CACHE = 'triquest-v33';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app/main.js',
  './js/app/store.js',
  './js/app/ui.js',
  './js/app/editor.js',
  './js/app/effects.js',
  './js/app/config.js',
  './js/app/auth.js',
  './js/app/strava-client.js',
  './js/app/leaderboard.js',
  './js/app/profile.js',
  './js/app/profile-game.js',
  './js/app/shop.js',
  './js/app/ai.js',
  './js/app/onboarding.js',
  './js/app/stores/local-store.js',
  './js/app/stores/supabase-client.js',
  './js/app/stores/supabase-store.js',
  './js/core/dates.js',
  './js/core/scoring.js',
  './js/core/streaks.js',
  './js/core/badges.js',
  './js/core/plan.js',
  './js/core/poses.js',
  './js/core/icons.js',
  './js/core/strava.js',
  './js/core/sync.js',
  './js/core/load.js',
  './js/core/disciplines.js',
  './js/core/calendar.js',
  './icons/logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const sameOrigin = new URL(request.url).origin === self.location.origin;

  // Network-first for same-origin app code so updates always apply when online;
  // cache is the offline fallback. (Avoids the stale-asset trap of cache-first.)
  if (sameOrigin) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); }
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || (request.mode === 'navigate' ? caches.match('./index.html') : Promise.reject(new Error('offline')))))
    );
    return;
  }

  // Cross-origin (e.g. CDN): cache-first.
  e.respondWith(caches.match(request).then((c) => c || fetch(request)));
});
