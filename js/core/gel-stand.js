// gel-stand.js — the gel stand's rules (docs/KITCHEN.md, "The gel stand"). Pure: no DOM, no clock.
//
// You pick a final gel from the stand's menu (the stand's level opens more of them), its ingredients are
// taken from your stock, and you make it step by step: pour into the jug, salt, caffeine, stir, fill the
// pouch, seal it. Each step scores 0 to 1 from how close you got; their mean gives 1-3 stars, and the
// stars scale the gel's boost (an XP boost on your next workout).
//
//   stock: { <ingredient>: n }          what you hold (water is free and never counted)
//   bag:   [{ id, stars, at }]          gels made, waiting to be switched on

/** The eight ingredients on the shelf, in shelf order: cost in grams of carbs per unit. */
export const INGREDIENTS = {
  malto: { cost: 20, colour: '#E8DCBF' },
  fructose: { cost: 20, colour: '#E4F1FA' },
  honey: { cost: 15, colour: '#F0B23A' },
  maple: { cost: 20, colour: '#B4652B' },
  beet: { cost: 20, colour: '#8E1F4C' },
  salt: { cost: 10, colour: '#FFFFFF' },
  caffeine: { cost: 30, colour: '#6A3D25' },
  water: { cost: 0, colour: '#BFE2F4', free: true },
};
export const SHELF = Object.keys(INGREDIENTS);

/** The stand's levels: 1 to 6 (its pictures, icons/Items/gel-stand-t<n>). Levels 5 and 6 open gels still to come. */
export const MAX_LEVEL = 6;
/** What the stars multiply a boost by. */
export const STAR_MULT = [0, 0.7, 1, 1.15];
/** Buying a gel ready-made costs this many times its ingredients. */
export const READY_MADE = 5;

// the steps, as data. pour/fill `to`: the jug's (or pouch's) level to stop at, 0-1, counted from the bottom
const pour = (ing, to) => ({ kind: 'pour', ing, to });
const salt = (to) => ({ kind: 'dial', ing: 'salt', to });
const drops = (n) => ({ kind: 'drops', ing: 'caffeine', n });
const stir = (turns) => ({ kind: 'stir', turns });
const FILL = { kind: 'fill', to: 0.85 };
const SEAL = { kind: 'seal' };

/**
 * The final gels, in menu order.
 * uses:    ingredient units taken when you start (water is free)
 * boostBp: the XP boost at 2 stars, in basis points (100 = +1%)
 * sport:   a bigger boost when the next workout is that sport ({ run: bp })
 * fuel:    the shop's fuel id it stands for, when there is one (gear.js FUEL_ITEMS)
 * colour:  the pouch's colour; liquid: the gel's own, as it's mixed and poured
 */
export const GELS = [
  // level 1: the basics
  { id: 'classic', liquid: '#EBC37E', level: 1, colour: '#5BB4E5', fuel: 'gel', boostBp: 3000, uses: { malto: 1, fructose: 1, salt: 1 },
    steps: [pour('malto', 0.3), pour('fructose', 0.54), pour('water', 0.8), salt(0.45), stir(3), FILL, SEAL] },
  { id: 'honey', liquid: '#E9A83A', level: 1, colour: '#F0B23A', boostBp: 2500, uses: { honey: 2, salt: 1 },
    steps: [pour('honey', 0.5), pour('water', 0.75), salt(0.35), stir(2), FILL, SEAL] },
  // level 2: stronger, one of them for rides
  { id: 'maple', liquid: '#B8692E', level: 2, colour: '#B4652B', boostBp: 3500, uses: { maple: 2, salt: 1 },
    steps: [pour('maple', 0.55), pour('water', 0.78), salt(0.55), stir(2), FILL, SEAL] },
  { id: 'hydro', liquid: '#8FDCE3', level: 2, colour: '#3CC7D6', boostBp: 3500, sport: { bike: 5000 }, uses: { malto: 1, salt: 2 },
    steps: [pour('malto', 0.2), pour('water', 0.85), salt(0.8), stir(2), FILL, SEAL] },
  // level 3: caffeine, and one for runs
  { id: 'caffeine', liquid: '#C98A4E', level: 3, colour: '#C8382E', fuel: 'gel-caffeine', boostBp: 4000, uses: { malto: 1, fructose: 1, salt: 1, caffeine: 1 },
    steps: [pour('malto', 0.3), pour('fructose', 0.54), pour('water', 0.8), salt(0.45), drops(2), stir(3), FILL, SEAL] },
  { id: 'beet', liquid: '#9C2F5A', level: 3, colour: '#8E1F4C', boostBp: 4000, sport: { run: 5500 }, uses: { beet: 1, malto: 1, fructose: 1, salt: 1 },
    steps: [pour('beet', 0.25), pour('malto', 0.5), pour('fructose', 0.7), salt(0.4), stir(3), FILL, SEAL] },
  // level 4: the race gel (levels 5 and 6: gels still to come, docs/KITCHEN.md)
  { id: 'race', liquid: '#DDB25E', level: 4, colour: '#16264D', fuel: 'gel-race', boostBp: 5000, uses: { malto: 1, fructose: 1, salt: 1, caffeine: 1, honey: 1 },
    steps: [pour('malto', 0.25), pour('fructose', 0.45), pour('honey', 0.6), pour('water', 0.8), salt(0.5), drops(3), stir(4), FILL, SEAL] },
];
export const gelById = (id) => GELS.find((g) => g.id === id) || null;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lvl = (n) => Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(n) || 1)));

/** The menu at a stand level: every gel, with whether it's open. */
export const menu = (level) => GELS.map((g) => ({ ...g, open: g.level <= lvl(level) }));

/** What a gel's ingredients cost, in grams of carbs. */
export const gelCost = (g) => Object.entries(g.uses).reduce((n, [ing, k]) => n + (INGREDIENTS[ing]?.cost || 0) * k, 0);
/** What it costs bought ready-made. */
export const readyMadeCost = (g) => gelCost(g) * READY_MADE;

/** A saved stand, made safe: { stock, bag }. */
export function normalise(saved) {
  const stock = {};
  for (const ing of SHELF) {
    if (INGREDIENTS[ing].free) continue;
    const n = Math.floor(Number(saved?.stock?.[ing]));
    stock[ing] = Number.isFinite(n) && n > 0 ? n : 0;
  }
  const bag = (Array.isArray(saved?.bag) ? saved.bag : []).filter((b) => gelById(b?.id) && b.stars >= 1 && b.stars <= 3);
  return { stock, bag };
}

/** The units of each ingredient a gel needs that the stock lacks: { ing: n } (empty when it can be made). */
export function missing(stock, g) {
  const out = {};
  for (const [ing, k] of Object.entries(g.uses)) {
    const short = k - (Number(stock?.[ing]) || 0);
    if (short > 0) out[ing] = short;
  }
  return out;
}

/** What the missing ingredients would cost to buy. */
export const missingCost = (stock, g) => Object.entries(missing(stock, g)).reduce((n, [ing, k]) => n + INGREDIENTS[ing].cost * k, 0);

/** Buy `n` units of an ingredient: { stock, carbs } or { error: 'free' | 'carbs' }. */
export function buy(stock, ing, n, carbs) {
  const i = INGREDIENTS[ing];
  if (!i || i.free) return { error: 'free' };
  const k = Math.max(1, Math.floor(n));
  const cost = i.cost * k;
  if (cost > carbs) return { error: 'carbs' };
  return { stock: { ...stock, [ing]: (Number(stock[ing]) || 0) + k }, carbs: carbs - cost, cost };
}

/** Start making a gel: its ingredients come out of the stock. { stock } or { error: 'locked' | 'stock' }. */
export function start(stock, g, level) {
  if (g.level > lvl(level)) return { error: 'locked' };
  if (Object.keys(missing(stock, g)).length) return { error: 'stock' };
  const next = { ...stock };
  for (const [ing, k] of Object.entries(g.uses)) next[ing] -= k;
  return { stock: next };
}

// ---- scoring a step: 0 (way off) to 1 (spot on) ----

/** A pour or a fill: the level you stopped at against the line. `from`: the level before you poured. */
export function scorePour(level, to, from = 0) {
  const off = Math.max(0, Math.abs(level - to) - 0.012);       // a hair's breadth is perfect
  const tol = Math.max(0.06, 0.45 * Math.abs(to - from));       // small pours are judged as fairly as big ones
  return clamp01(1 - off / tol);
}
/** The salt dial (0-1) against its mark. */
export const scoreDial = (v, to) => clamp01(1 - Math.max(0, Math.abs(v - to) - 0.025) / 0.25);
/** Drops of caffeine: exact is perfect, one out is half. */
export const scoreDrops = (n, want) => (n === want ? 1 : Math.abs(n - want) === 1 ? 0.5 : 0);
/** Stirring: done is done, but rushing it (over 2.5 turns a second) splashes. */
export const scoreStir = (turns, secs) => (turns / Math.max(0.1, secs) > 2.5 ? 0.7 : 1);
/** The seal: how much of the pouch's top the swipe covered (0-1). */
export const scoreSeal = (cover) => clamp01((cover - 0.5) / 0.45);

/** Stars from the steps' scores. */
export function stars(scores) {
  if (!scores.length) return 1;
  const m = scores.reduce((a, b) => a + b, 0) / scores.length;
  return m >= 0.9 ? 3 : m >= 0.65 ? 2 : 1;
}

/** A gel's XP boost in basis points for its stars, and for a sport when given. */
export function boostOf(g, starsN, sport = null) {
  const base = (sport && g.sport?.[sport]) || g.boostBp;
  return Math.round(base * STAR_MULT[Math.max(1, Math.min(3, starsN))]);
}

/** Put a finished gel in the bag. */
export const bagged = (bag, id, starsN, at) => [...bag, { id, stars: starsN, at }];
