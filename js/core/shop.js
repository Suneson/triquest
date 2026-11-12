// shop.js: the markets on the island's market plot (docs/MARKETS.md). Pure.
//
// Six spots, two rows of three, on the rebuilt market plot. A market is built on a spot and goes up
// to level 8. Each level opens one more slot (1 at level 1, all 8 at level 8) and holds more of
// each item. You buy stock wholesale into your storeroom (up to 1000 of each item), put it in a
// slot, and it sells on its own, one unit at a time, for more than you paid. Tap to collect.
//
// Training moves it (each a check made when the coins are collected, nothing running meanwhile):
//   - demand: a swim, bike, run or gym session in the last 4 hours, and that sport's gear sells
//     for 30% more (a brick counts as a bike and a run)
//   - foot traffic: this week's minutes of training (60, 150, 300) sell everything 10 to 20% faster
//   - a brick day: two sports on one day (or a brick) brings a pro athlete to your best market once
//     that day, who buys everything on its shelves at 1.5 times the price
//   - wholesale crates: every reward chest opened brings one; a crate fills a market's slots free
//   - a specialty shop: every open slot of a market filled with one sport's gear sells for 10% more
//
// The server keeps the same rules (supabase/migrations/0035_shop.sql, shop_rules()) and is the one
// that pays: tests/shop-sql.test.js holds the two together.

export const SHOP_RULES = {
  spots: 6,
  /** What the 1st, 2nd, ... 6th market costs to build. */
  buildCost: [300, 600, 1000, 1500, 2200, 3000],
  /** Per level: open slots, units each slot holds, and the price of the upgrade to reach it. */
  levels: [
    { level: 1, slots: 1, capacity: 10 },
    { level: 2, slots: 2, capacity: 15, cost: 400 },
    { level: 3, slots: 3, capacity: 20, cost: 700 },
    { level: 4, slots: 4, capacity: 25, cost: 1100 },
    { level: 5, slots: 5, capacity: 30, cost: 1600 },
    { level: 6, slots: 6, capacity: 35, cost: 2300 },
    { level: 7, slots: 7, capacity: 40, cost: 3200 },
    { level: 8, slots: 8, capacity: 50, cost: 4500 },
  ],
  /** By an item's tier (1..8, the market level that unlocks it): wholesale price, shop price, minutes to sell one. */
  buy: [2, 3, 5, 8, 12, 18, 26, 40],
  sell: [3, 5, 8, 12, 18, 27, 40, 60],
  minutes: [6, 8, 10, 12, 15, 18, 22, 30],
  stockMax: 1000,
  demand: { hours: 4, bonus: 0.3 },
  /** This week's minutes of training: how much faster everything sells. */
  traffic: [{ id: 'quiet', min: 0, f: 1 }, { id: 'busy', min: 60, f: 0.9 }, { id: 'bustling', min: 150, f: 0.85 }, { id: 'festival', min: 300, f: 0.8 }],
  specialty: 0.1,
  vip: 1.5,
  /** Reward chests opened from this day on bring a crate each. */
  cratesSince: '2026-11-12',
};

/** The four sports, in the order of the market screen's tabs. */
export const SPORTS = ['gym', 'bike', 'run', 'swim'];

// Fifteen items a sport, cheapest first: two a tier, one at tier 8. Pictures: icons/Market/items/<id>.webp
// (cut by tools/cut-shop.py from the generated sheets).
const NAMES = {
  gym: ['rope', 'bands', 'shaker', 'towel', 'mat', 'gloves', 'roller', 'dumbbells', 'kettlebell', 'protein', 'medball', 'belt', 'massager', 'boots', 'gold-kettlebell'],
  bike: ['bottle', 'gloves', 'pump', 'repair', 'cap', 'lights', 'bars', 'jersey', 'shoes', 'helmet', 'computer', 'pedals', 'aero', 'wheel', 'gold-frame'],
  run: ['socks', 'headband', 'cap', 'flask', 'gels', 'trainers', 'shorts', 'singlet', 'belt', 'vest', 'shades', 'hrstrap', 'watch', 'racers', 'gold-watch'],
  swim: ['cap', 'goggles', 'plugs', 'towel', 'kickboard', 'buoy', 'paddles', 'fins', 'snorkel', 'mirror', 'bag', 'robe', 'trisuit', 'wetsuit', 'gold-goggles'],
};
/** Every item: { id, sport, tier }, by sport (the tabs' order) and then tier. */
export const SHOP_ITEMS = SPORTS.flatMap((sport) => NAMES[sport].map((n, i) => ({ id: `${sport}-${n}`, sport, tier: Math.min(8, (i >> 1) + 1) })));

const BY_ID = new Map(SHOP_ITEMS.map((i) => [i.id, i]));
export const shopItem = (id) => BY_ID.get(id) || null;
export const itemBuy = (id) => SHOP_RULES.buy[shopItem(id).tier - 1];
export const itemSell = (id) => SHOP_RULES.sell[shopItem(id).tier - 1];
export const itemPicture = (id) => `icons/Market/items/${id}.webp`;
export const marketPicture = (level) => `icons/Market/market-${Math.max(1, Math.min(8, Number(level) || 1))}.webp`;

/** The rules at a market's level. */
export const shopLevel = (level) => SHOP_RULES.levels[Math.max(1, Math.min(8, Number(level) || 1)) - 1];
/** The next level's rules, or null at the top. */
export const shopNext = (level) => SHOP_RULES.levels[Number(level) || 1] || null;
/** What the next market costs to build, with `owned` built already (null when all six are). */
export const buildCostFor = (owned) => SHOP_RULES.buildCost[owned] ?? null;

// ---- training: what the workouts do -------------------------------------------------------------

const done = (w) => w && w.completed !== false;
/** The sports a session counts as: a brick is a bike and a run. */
export const sportsOf = (w) => (w?.type === 'brick' ? ['bike', 'run'] : SPORTS.includes(w?.type) ? [w.type] : []);

/** The sports in demand at `nowMs`: those with a session finished in the last 4 hours. */
export function demandAt(workouts, nowMs) {
  const from = nowMs - SHOP_RULES.demand.hours * 3600e3;
  const out = new Set();
  for (const w of workouts || []) {
    const t = Date.parse(w?.completed_at ?? w?.completedAt);
    if (done(w) && Number.isFinite(t) && t > from && t <= nowMs) sportsOf(w).forEach((s) => out.add(s));
  }
  return out;
}

/** Monday (UTC) of the week `nowMs` is in, as YYYY-MM-DD. */
export function weekStart(nowMs) {
  const d = new Date(nowMs); const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
}
/** Minutes trained this week (from Monday, UTC, up to today). */
export function weekMinutes(workouts, nowMs) {
  const from = weekStart(nowMs), to = new Date(nowMs).toISOString().slice(0, 10);
  return (workouts || []).filter((w) => done(w) && String(w.date) >= from && String(w.date) <= to)
    .reduce((n, w) => n + Math.max(0, Number(w.duration_min ?? w.durationMin) || 0), 0);
}
/** The foot traffic for this week's minutes: { id, min, f, next } (next: the step up, or null). */
export function trafficFor(minutes) {
  const T = SHOP_RULES.traffic;
  const i = T.reduce((k, t, j) => (minutes >= t.min ? j : k), 0);
  return { ...T[i], next: T[i + 1] || null };
}
/** Is `day` (YYYY-MM-DD) a brick day: two sports, or a brick? */
export function brickDay(workouts, day) {
  const s = new Set();
  for (const w of workouts || []) if (done(w) && String(w.date) === day) sportsOf(w).forEach((x) => s.add(x));
  return s.size >= 2;
}

// ---- a market's slots: rows { slot, item, units, since } ------------------------------------------

/** How long one unit of an item takes to sell, in ms, at a traffic factor. */
export const periodOf = (id, f = 1) => SHOP_RULES.minutes[shopItem(id).tier - 1] * 60e3 * f;

/** Units of a slot sold by `nowMs`. */
export function soldIn(slot, nowMs, f = 1) {
  if (!slot?.item || !(slot.units > 0)) return 0;
  return Math.max(0, Math.min(slot.units, Math.floor((nowMs - Date.parse(slot.since)) / periodOf(slot.item, f))));
}

/** Is every open slot of a market (two or more) filled with one sport's gear? (The specialty bonus.) */
export function specialty(slots, level) {
  const open = shopLevel(level).slots;
  const items = (slots || []).filter((s) => s.slot <= open && s.item && s.units > 0);
  if (open < 2 || items.length < open) return false;
  return new Set(items.map((s) => shopItem(s.item).sport)).size === 1;
}

/**
 * What a market has sold by `nowMs` and what it pays: { coins, sold: [{ slot, units }] }.
 * `ctx`: { f (traffic), demand (Set of sports) }. Each slot pays floor(units × price × (1 + bonuses)).
 */
export function marketSales(level, slots, nowMs, ctx = {}) {
  const f = ctx.f ?? 1; const demand = ctx.demand || new Set();
  const spec = specialty(slots, level) ? SHOP_RULES.specialty : 0;
  const open = shopLevel(level).slots;
  let coins = 0; const sold = [];
  for (const s of slots || []) {
    if (s.slot > open) continue;
    const n = soldIn(s, nowMs, f);
    if (!n) continue;
    const mult = 1 + spec + (demand.has(shopItem(s.item).sport) ? SHOP_RULES.demand.bonus : 0);
    coins += Math.floor(n * itemSell(s.item) * mult + 1e-9);
    sold.push({ slot: s.slot, units: n });
  }
  return { coins, sold };
}

/** A slot after `n` sales are taken: fewer units, its clock moved on by what was sold. */
export function settleSlot(slot, n, f = 1) {
  if (!n) return slot;
  return { ...slot, units: slot.units - n, since: new Date(Date.parse(slot.since) + n * periodOf(slot.item, f)).toISOString() };
}

/** When a slot sells out (ms), or null when it's empty. */
export function sellsOutAt(slot, f = 1) {
  if (!slot?.item || !(slot.units > 0)) return null;
  return Date.parse(slot.since) + slot.units * periodOf(slot.item, f);
}

/** Crates left: one for every reward chest opened since cratesSince, less those used. */
export const cratesLeft = (chests, moves) => (chests || []).filter((c) => c?.opened_at && String(c.opened_at).slice(0, 10) >= SHOP_RULES.cratesSince).length
  - (moves || []).filter((m) => m.kind === 'crate').length;

/** A restock: the units missing from each slot with an item, from the storeroom first, the rest bought. */
export function restockCost(level, slots, stock) {
  const { capacity: cap, slots: open } = shopLevel(level);
  const left = { ...(stock || {}) };
  let coins = 0, units = 0;
  for (const s of slots || []) {
    if (s.slot > open || !s.item) continue;
    const need = cap - s.units; if (need <= 0) continue;
    const have = Math.min(need, Number(left[s.item]) || 0);
    left[s.item] = (Number(left[s.item]) || 0) - have;
    coins += (need - have) * itemBuy(s.item); units += need;
  }
  return { coins, units };
}
