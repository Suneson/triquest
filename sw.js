// sw.js — offline-first service worker. Precaches the app shell and serves
// cache-first, falling back to the network (and to index.html for navigations).

const CACHE = 'triquest-v69';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './fonts/silkscreen-400.woff2',
  './fonts/silkscreen-700.woff2',
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
  './js/app/swipe.js',
  './js/app/nav.js',
  './js/app/sheet.js',
  './js/app/haptics.js',
  './js/app/pull.js',
  './js/app/stamp.js',
  './js/app/vt.js',
  './js/app/room.js',
  './js/app/room-view.js',
  './js/app/i18n-dom.js',
  './js/app/lang-toggle.js',
  './js/app/checkin.js',
  './js/app/gear-state.js',
  './js/app/gear-view.js',
  './js/app/feats-state.js',
  './js/app/feats-view.js',
  './js/app/challenges-state.js',
  './js/app/challenges-view.js',
  './js/core/challenges.js',
  './js/core/feats.js',
  './js/app/gel-chip.js',
  './js/app/xp-split.js',
  './js/core/room.js',
  './js/app/shop.js',
  './js/app/ai.js',
  './js/app/demo.js',
  './js/app/quest-sync.js',
  './js/app/motion.js',
  './js/app/game.js',
  './js/app/share.js',
  './js/app/onboarding.js',
  './js/app/gym-logger.js',
  './js/app/chat.js',
  './js/app/social.js',
  './js/app/gym-picker.js',
  './js/app/gym-routines.js',
  './js/app/drag-sort.js',
  './js/app/gym-history.js',
  './js/app/pixel-chart.js',
  './js/app/stores/local-store.js',
  './js/app/stores/supabase-client.js',
  './js/app/stores/supabase-store.js',
  './js/core/dates.js',
  './js/core/i18n.js',
  './js/core/locales/en.js',
  './js/core/locales/es.js',
  './js/core/locales/plan-es.js',
  './js/core/plan-i18n.js',
  './js/core/xp-rules.js',
  './js/core/geo.js',
  './js/core/gear.js',
  './js/core/wallet.js',
  './js/core/boosts.js',
  './js/core/scoring.js',
  './js/core/gesture.js',
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
  './js/core/quests.js',
  './js/core/quest-claims.js',
  './js/core/rest.js',
  './js/core/path.js',
  './js/core/ranks.js',
  './js/core/scenes.js',
  './js/core/coach-lines.js',
  './js/core/exercises.js',
  './js/core/sets.js',
  './js/core/gym-log.js',
  './js/core/gym-edit.js',
  './js/core/gym-stats.js',
  './js/core/gym-split.js',
  './js/core/social.js',
  './icons/trainer/portrait.png',
  './icons/trainer/full.png',
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
