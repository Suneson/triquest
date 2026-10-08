// demo.js — `?demo=1` fixture mode. Ranks, Shop and public profiles render
// realistic data with no network, so they can be screenshotted and reviewed
// offline (the build sandbox can't reach Supabase or Shopify). Nothing here is
// ever written to storage or sent anywhere; leave the flag off and it's inert.

export const isDemo = () => {
  try { return new URLSearchParams(location.search).get('demo') === '1'; } catch { return false; }
};

/** In demo mode "you" are this athlete, so the rival row and rank badge show. */
export const DEMO_ME = 'd-07';

const ATHLETES = [
  ['d-01', 'Marta Eklund', 18420, ['run', 'bike', 'swim']],
  ['d-02', 'Joaquín Herrera', 16975, ['bike', 'run']],
  ['d-03', 'Saanvi Raman', 15108, ['swim', 'run']],
  ['d-04', 'Oskar Lindqvist', 13342, ['bike']],
  ['d-05', 'Amara Okafor', 12731, ['run', 'swim']],
  ['d-06', 'Teodor Wiśniewski', 11064, ['run', 'bike', 'swim']],
  ['d-07', 'Lucía Fernández', 9876, ['run']],
  ['d-08', 'Kenji Watanabe', 8452, ['bike', 'swim']],
  ['d-09', 'Elin Bergström', 7310, ['swim']],
  ['d-10', 'Rafael Costa', 6127, ['run', 'bike']],
  ['d-11', 'Hannah Schäfer', 4985, ['run']],
  ['d-12', 'Yusuf Demir', 3268, ['bike']],
];

/** Same shape as the `leaderboard` RPC rows. The season view scales XP down. */
export function demoLeaderboard(view) {
  const k = view === 'season' ? 0.17 : 1;
  return ATHLETES.map(([user_id, display_name, xp, sports]) => ({
    user_id, display_name, xp: Math.round(xp * k), sports, avatar: null,
  }));
}

/** Same shape as the Shopify collection nodes shop.js reads. */
export function demoShop() {
  const p = (title, handle, amount) => ({
    title, handle, onlineStoreUrl: null, featuredImage: null,
    priceRange: { minVariantPrice: { amount: String(amount), currencyCode: 'EUR' } },
  });
  return [
    p('SS26 Race Singlet: Navy', 'ss26-race-singlet', 54),
    p('SS26 Tri Suit: Long Course', 'ss26-tri-suit', 189),
    p('Training Cap: Black', 'training-cap', 29),
    p('Bottle 750 ml: One of Few', 'bottle-750', 14),
    p('Merino Base Layer', 'merino-base', 79),
    p('Transition Towel', 'transition-towel', 22),
  ];
}

/** Same shape as the `public_profile` RPC: per-day counts over the last 60 days. */
export function demoPublicProfile(uid) {
  const seed = Number(String(uid).replace(/\D/g, '')) || 3;
  const days = [];
  const today = new Date();
  for (let i = 59; i >= 0; i--) {
    if ((i * 7 + seed) % 3 === 0) continue; // rest days
    const d = new Date(today); d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const n = 1 + ((i + seed) % 4 === 0 ? 1 : 0);
    days.push({ date: iso, n, min: n * (40 + ((i * 13 + seed) % 50)) });
  }
  const total = days.reduce((a, d) => a + d.min, 0);
  return {
    display_name: (ATHLETES.find((a) => a[0] === uid) || ATHLETES[0])[1],
    completed: days.reduce((a, d) => a + d.n, 0),
    total_km: Math.round(total * 0.21),
    total_min: total,
    dates: days.map((d) => d.date),
    days,
  };
}
