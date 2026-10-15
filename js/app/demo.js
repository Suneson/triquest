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
    // per-sport XP, so each demo athlete has a different best sport
    sport_xp: { bike: 900 + seed * 410, run: 700 + ((seed * 530) % 3900), swim: 200 + ((seed * 290) % 1700), gym: (seed * 370) % 2600 },
  };
}

/** Friends, chats and notifications for the Chat tab and the bell (same shapes as Supabase). */
export function demoSocial(now = Date.now()) {
  const ago = (min) => new Date(now - min * 60000).toISOString();
  const f = (id, name, username, status, incoming, min) => ({
    friendship_id: Number(id.slice(2)), user_id: id, display_name: name, username, avatar: null, status, incoming, created_at: ago(min),
  });
  const friends = [
    f('d-01', 'Marta Eklund', 'marta_e', 'accepted', false, 9000),
    f('d-05', 'Amara Okafor', 'amara_runs', 'accepted', true, 7000),
    f('d-08', 'Kenji Watanabe', 'kenji_w', 'accepted', false, 5000),
    f('d-03', 'Saanvi Raman', 'saanvi', 'pending', true, 30),
    f('d-10', 'Rafael Costa', 'rafa_c', 'pending', false, 600),
  ];
  let id = 100;
  const m = (from, to, body, min, read = true) => ({ id: id++, sender: from, recipient: to, body, created_at: ago(min), read_at: read ? ago(min - 1) : null });
  const messages = [
    m('d-01', DEMO_ME, 'Brick session tomorrow? 60 min bike, 20 min run.', 2900),
    m(DEMO_ME, 'd-01', 'In. 7am at the usual spot?', 2880),
    m('d-01', DEMO_ME, 'Perfect. Bring a spare tube this time 😄', 2870),
    m('d-05', DEMO_ME, 'New PR on the squat today!', 95, false),
    m('d-05', DEMO_ME, '105 kg × 5, it moved fast', 94, false),
    m(DEMO_ME, 'd-08', 'How was the long swim?', 3000),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const notifications = [
    { id: 3, user_id: DEMO_ME, kind: 'friend_request', title: 'Saanvi Raman wants to be friends', body: null, data: { user_id: 'd-03', friendship_id: 3 }, created_at: ago(30), read_at: null },
    { id: 2, user_id: DEMO_ME, kind: 'friend_accepted', title: 'Kenji Watanabe accepted your friend request', body: null, data: { user_id: 'd-08' }, created_at: ago(4000), read_at: null },
    { id: 1, user_id: null, kind: 'app_update', title: 'New: chat with your friends', body: 'Add friends from Ranks or by username in the Chat tab, then message them. Gym sessions you log now earn XP without Strava.', data: {}, created_at: ago(60), read_at: null },
  ];
  return { me: { id: DEMO_ME, username: 'lucia_f' }, friends, messages, notifications };
}

/** The General room for ?demo=1: same shapes as room_messages and room_authors(). */
export function demoRoom(now = Date.now()) {
  const ago = (min) => new Date(now - min * 60000).toISOString();
  const handle = { 'd-01': 'marta_e', 'd-02': 'joaco', 'd-03': 'saanvi', 'd-04': 'oskar_l', 'd-05': 'amara_runs', 'd-06': 'teo_w',
    'd-07': 'lucia_f', 'd-08': 'kenji_w', 'd-09': 'elin_b', 'd-10': 'rafa_c', 'd-11': 'hannah_s', 'd-12': 'yusuf_d' };
  const authors = ATHLETES.map(([user_id, display_name, xp]) => ({ user_id, display_name, username: handle[user_id], avatar: null, xp }));
  const lines = [
    ['d-02', 'Anyone racing the Valencia half in December?', 300],
    ['d-01', 'Me. Target is sub 1:35, legs permitting.', 296],
    ['d-06', 'Same here. First time on that course.', 290],
    ['d-09', 'Pool was empty at 6am, best set in weeks.', 240],
    ['d-04', 'Long ride Sunday, 120 km, easy pace. Who is in?', 200],
    ['d-10', 'Count me in if it stays dry.', 196],
    ['d-12', 'Is it normal for the gym timer to keep going when I close the app? It stopped when I tapped Finish.', 150],
    ['d-05', 'Yes, it keeps your rest running in the background.', 148],
    ['d-03', 'Tempo run done. 6 × 1 km at threshold, the last two hurt.', 90],
    ['d-08', 'Nice. Recovery day for me.', 85],
    ['d-11', 'Swim tips for breathing on both sides?', 40],
    ['d-09', 'Every third stroke on easy laps, until it feels boring.', 36],
    ['d-01', 'And exhale fully under water, that fixed it for me.', 33],
    ['d-02', 'Week path all green so far. Six to go.', 12],
    ['d-06', 'Congrats on the podium spot this month, Marta.', 6],
  ];
  const messages = lines.map(([user_id, body, min], i) => ({ id: 1000 + i, user_id, body, client_id: null, created_at: ago(min), deleted_at: null }));
  messages.splice(9, 0, { id: 1100, user_id: 'd-04', body: '', client_id: null, created_at: ago(88), deleted_at: ago(80) });
  return { authors, messages, blocked: [], isAdmin: false };
}
