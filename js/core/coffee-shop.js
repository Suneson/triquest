// coffee-shop.js — the coffee shop's rules (MOSKE APP/Island/COFFEE-SHOP.md). Pure: no DOM, no clock.
//
// A customer asks for a drink at the counter. You make it at the bar (grind, tamp, brew; milk drinks: the fridge,
// the pitcher, the steam wand) and finish it (ice, syrup, toppings), then serve it. Each step scores 0 to 1;
// their mean gives 1-3 stars.
//   Closed sign: the 4 builders come in, each once every 48 h; a coffee cuts their next build (tuned later).
//   Open sign:   bosses come in, 6-8 a day, and pay coins by the stars.
//
//   saved: { level, open, builders: { <who>: at }, day: { key, n, cap }, coins, bonus: { <who>: min } }

/** The shop's levels: 1 to 6 (its pictures, icons/Items/coffee-shop-t<n>). */
export const MAX_LEVEL = 6;
const lvl = (n) => Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(n) || 1)));
export const levelOf = (saved) => lvl(saved?.level);

/** The four builders (builders.js), in their hut colours. */
export const BUILDERS = ['blue', 'red', 'green', 'gold'];
/** A builder can have one coffee every this often. */
export const BUILDER_EVERY = 48 * 3600e3;
/** What a builder's coffee cuts off their next build, in minutes, by stars (a first guess). */
export const BUILDER_CUT = [0, 15, 30, 60];
/** What a boss pays, in coins, by stars (a first guess). */
export const BOSS_PAY = [0, 20, 40, 70];
/** Bosses a day while the shop is open: from DAY_MIN to DAY_MAX, picked by the date. */
export const DAY_MIN = 6;
export const DAY_MAX = 8;

// ---- the drinks ----
// cup:   the cup it's made in (icons/Coffee/<cup>.webp)
// shots: espresso shots (1 or 2); water: topped up with hot water (or cold, iced)
// milk:  'milk' | 'oat' | null, and its foam on top: 'foam' | 'heart' | 'tulip' | 'rosetta' (the latte art)
// ice:   scoops of ice; syrup: { <syrup>: pumps }; tops: toppings in the order they go on
const D = (id, level, cup, o = {}) => ({ id, level, cup, shots: 1, water: false, milk: null, foam: null, ice: 0, syrup: {}, tops: [], ...o });
export const DRINKS = [
  D('espresso', 1, 'cup-espresso'),
  D('americano', 1, 'mug', { shots: 2, water: true }),
  D('latte', 2, 'glass-latte', { milk: 'milk', foam: 'heart' }),
  D('cappuccino', 2, 'cup-cappuccino', { milk: 'milk', foam: 'foam', tops: ['cocoa'] }),
  D('iced-latte', 3, 'glass-iced', { shots: 2, milk: 'milk', ice: 2 }),
  D('mocha', 3, 'cup-cappuccino', { milk: 'milk', syrup: { chocolate: 2 }, tops: ['cream'] }),
  D('flat-white', 4, 'cup-espresso', { shots: 2, milk: 'milk', foam: 'rosetta' }),
  D('caramel-macchiato', 4, 'glass-latte', { milk: 'milk', syrup: { caramel: 2 }, foam: 'foam' }),
  D('affogato', 5, 'glass-coupe', { tops: ['icecream'] }),
  D('cold-brew', 5, 'glass-iced', { shots: 2, water: true, ice: 2 }),
  D('protein-mocha', 6, 'mug', { shots: 2, milk: 'milk', syrup: { chocolate: 1 }, tops: ['cocoa'] }),
  D('honey-oat-latte', 6, 'glass-latte', { milk: 'oat', foam: 'tulip', syrup: { vanilla: 1 } }),
];
export const drinkById = (id) => DRINKS.find((d) => d.id === id) || null;
/** The drinks a shop of this level makes. */
export const menu = (level) => DRINKS.filter((d) => d.level <= lvl(level));
export const SYRUPS = ['vanilla', 'caramel', 'hazelnut', 'chocolate', 'berry', 'maple'];
export const TOPS = ['cream', 'cocoa', 'cinnamon', 'icecream'];

/** The steps of a drink, in order: at the bar, then at the finish. */
export function steps(d) {
  const out = [{ kind: 'grind', to: d.shots === 2 ? 0.85 : 0.6 }, { kind: 'tamp' }, { kind: 'lock' }, { kind: 'brew', to: d.shots === 2 ? 0.8 : 0.5 }];
  if (d.water) out.push({ kind: 'water', to: 0.75 });
  if (d.milk) out.push({ kind: 'carton', milk: d.milk, to: 0.6 }, { kind: 'steam', to: 0.7 }, { kind: 'pour', foam: d.foam });
  if (d.ice) out.push({ kind: 'ice', n: d.ice });
  for (const [s, n] of Object.entries(d.syrup)) out.push({ kind: 'syrup', syrup: s, n });
  for (const top of d.tops) out.push({ kind: 'top', top });
  out.push({ kind: 'serve' });
  return out;
}
/** Steps done at the bar (the rest at the finish). */
export const BAR = new Set(['grind', 'tamp', 'lock', 'brew', 'water', 'carton', 'steam', 'pour']);

// ---- scoring: 0 (way off) to 1 (spot on) ----
const clamp01 = (x) => Math.max(0, Math.min(1, x));
/** A level stopped at (grind, brew, water, milk, steam) against its mark. */
export const scoreLevel = (v, to) => clamp01(1 - Math.max(0, Math.abs(v - to) - 0.03) / 0.2);
/** The green on a meter, where a level scores 0.8 or more: [lo, hi]. */
export const sweetSpot = (to) => [Math.max(0, to - 0.07), Math.min(1, to + 0.07)];
/** The tamp: the press held to its green (0.65-0.85 of the way down). */
export const scoreTamp = (v) => clamp01(1 - Math.max(0, Math.abs(v - 0.75) - 0.1) / 0.25);
/** A count (ice scoops, syrup pumps): exact is perfect, one out is half. */
export const scoreCount = (n, want) => (n === want ? 1 : Math.abs(n - want) === 1 ? 0.5 : 0);

/** How a step went, for its pop. */
export function verdict(score, value = 0, to = 0) {
  if (score >= 0.95) return 'exact';
  if (score >= 0.6) return 'good';
  return value > to ? 'over' : 'under';
}
/** Stars from the steps' scores; a topping or syrup it didn't ask for takes some off. */
export function stars(scores, extras = 0) {
  if (!scores.length) return 1;
  const m = scores.reduce((a, b) => a + b, 0) / scores.length - 0.15 * extras;
  return m >= 0.9 ? 3 : m >= 0.65 ? 2 : 1;
}

// ---- who comes in ----
/** A date's key, local: '2026-11-23'. */
export const dayKey = (now) => { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
/** How many bosses come in on this day (6-8, the same all day). */
export const dayCap = (key) => DAY_MIN + (hash(key) % (DAY_MAX - DAY_MIN + 1));
/** Today's count, made safe: { key, n, cap }. */
export function today(saved, now) {
  const key = dayKey(now);
  const d = saved?.day;
  return d?.key === key ? { key, n: Math.max(0, Number(d.n) || 0), cap: dayCap(key) } : { key, n: 0, cap: dayCap(key) };
}
/** When a builder can next have a coffee (ms; 0 = now). */
export const builderReady = (saved, who, now) => Math.max(0, (Number(saved?.builders?.[who]) || 0) + BUILDER_EVERY - now);

/** Pick a drink for a customer: any on the menu, `rand` 0-1. */
export const pickDrink = (level, rand) => { const m = menu(level); return m[Math.floor(rand * m.length) % m.length]; };

/**
 * A drink served: what it earns and the saved state after it.
 * who: { kind: 'builder', id } | { kind: 'boss', id }
 */
export function served(saved, who, starsN, now) {
  const s = { ...saved };
  if (who.kind === 'builder') {
    s.builders = { ...(saved?.builders || {}), [who.id]: now };
    const cut = BUILDER_CUT[starsN] || 0;
    s.bonus = { ...(saved?.bonus || {}), [who.id]: (Number(saved?.bonus?.[who.id]) || 0) + cut };
    return { saved: s, cut, coins: 0 };
  }
  const d = today(saved, now);
  s.day = { key: d.key, n: d.n + 1 };
  const coins = BOSS_PAY[starsN] || 0;
  s.coins = (Number(saved?.coins) || 0) + coins;
  return { saved: s, cut: 0, coins };
}
