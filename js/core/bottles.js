// bottles.js — the MOSKE sports bottles: our potions (MOSKE APP/Island/BOTTLES.md, docs/BOTTLES.md). Pure.
// The server (0042_bottles.sql) runs the same rules: it rolls a chest's bottles when it makes the chest, you own
// them once the chest is opened, and drinking one is a row of its own, so the count is always derived.
//
//   1. A chest has a few slots, each with a chance of holding a bottle: rarer chests have more slots and better
//      chances (BOTTLE_RULES.slots).
//   2. A filled slot picks a bottle by its strength: weak ones are common, strong ones rare, and the rarer the
//      chest the more it leans to the strong ones (BOTTLE_RULES.weights, one weight per strength 1-4).
//   3. One of a kind works at a time: a bottle that's still working can't be drunk again till it's done.
//
// What each does:
//   recovery-mix   stamina to full (your drills' stamina lives on the device, so the app fills it)
//   electro-surge  +50% XP on workouts for 24 h, as a fuel boost (the most a session's fuel can give)
//   build-brew     every builder works 10x as fast for 1 hour: each running job loses up to 9 h at once
//   chest-charge   your next workout chest comes one rarity higher
//   vo2-max        (not dropping yet: it waits for the stadium race to use it)

import { TIERS, CHEST_RULES } from './rewards.js';

export const BOTTLE_RULES = {
  /** In order, weakest first. `drops: false` bottles never come out of a chest. */
  bottles: {
    'recovery-mix': { strength: 1, drops: true },
    'electro-surge': { strength: 2, drops: true, boostBp: 5000, hours: 24 },
    'build-brew': { strength: 3, drops: true, speed: 10, hours: 1 },
    'chest-charge': { strength: 4, drops: true },
    'vo2-max': { strength: 4, drops: false },
  },
  /** Each chest's slots: the chance of each holding a bottle. */
  slots: {
    common: [0.12],
    uncommon: [0.3],
    rare: [0.6],
    epic: [0.8],
    legendary: [1, 0.4],
    mythic: [1, 1, 0.5],
  },
  /** A filled slot's pick, by strength 1-4: how likely each strength is in each chest. */
  weights: {
    common: [60, 30, 10, 0],
    uncommon: [50, 30, 15, 5],
    rare: [40, 30, 20, 10],
    epic: [30, 30, 25, 15],
    legendary: [25, 30, 27, 18],
    mythic: [15, 25, 32, 28],
  },
};

export const BOTTLE_IDS = Object.keys(BOTTLE_RULES.bottles);
export const bottleArt = (id, small = false) => `icons/Bottles/${id}${small ? '-s' : ''}.webp`;

/** A bottle's weight in a tier's chest (0: it can't come out of one). */
export function bottleWeight(tier, id) {
  const b = BOTTLE_RULES.bottles[id];
  if (!b?.drops) return 0;
  return (BOTTLE_RULES.weights[tier] || BOTTLE_RULES.weights.common)[b.strength - 1] || 0;
}

/**
 * The bottles a chest of `tier` holds, from a source of numbers in [0, 1) (Math.random by default): each slot
 * takes one number for whether it's filled and, if it is, one for which bottle.
 */
export function rollBottles(tier, rand = Math.random) {
  const out = [];
  const total = BOTTLE_IDS.reduce((n, id) => n + bottleWeight(tier, id), 0);
  if (!total) return out;
  for (const chance of BOTTLE_RULES.slots[tier] || []) {
    if (!(rand() < chance)) continue;
    let x = rand() * total;
    let pick = null;
    for (const id of BOTTLE_IDS) {
      const w = bottleWeight(tier, id);
      if (!w) continue;
      pick = id;
      if (x < w) break;
      x -= w;
    }
    if (pick) out.push(pick);
  }
  return out;
}

/** The chance (0-1) that a chest of `tier` holds at least one bottle, and the bottles you'd expect from it. */
export function bottleOdds(tier) {
  const slots = BOTTLE_RULES.slots[tier] || [];
  const none = slots.reduce((p, c) => p * (1 - c), 1);
  const expected = slots.reduce((n, c) => n + c, 0);
  const total = BOTTLE_IDS.reduce((n, id) => n + bottleWeight(tier, id), 0);
  const each = Object.fromEntries(BOTTLE_IDS.map((id) => [id, total ? (expected * bottleWeight(tier, id)) / total : 0]));
  return { any: 1 - none, expected, each };
}

/** The next tier up that has an animation (a Chest Charger's chest); mythic stays mythic. */
export function tierUp(tier) {
  const i = TIERS.indexOf(tier);
  for (let k = i + 1; k < TIERS.length; k++) if (CHEST_RULES.enabled[TIERS[k]]) return TIERS[k];
  return tier;
}

/** Bottles held: { id: n } from the opened chests' bottles less the ones drunk. */
export function bottlesHeld(chests, drinks) {
  const held = Object.fromEntries(BOTTLE_IDS.map((id) => [id, 0]));
  for (const c of chests || []) if (c.opened_at) for (const id of c.bottles || []) if (id in held) held[id] += 1;
  for (const d of drinks || []) if (d.bottle in held) held[d.bottle] -= 1;
  return held;
}

/**
 * Can this bottle be drunk now? { ok } or { ok: false, reason }:
 *   none     you hold none
 *   active   one of the kind is still working (a charge waiting for its chest, the surge's 24 h, the brew's hour)
 *   fuel     another fuel boost is on (the surge is one, and only one fuel works at a time)
 *   idle     a Build Brew with no builder at work would be wasted
 *   soon     not out yet (VO2 Max)
 */
export function canDrink(id, { held = 0, active = {}, fuelOn = false, jobsRunning = 0 } = {}) {
  const b = BOTTLE_RULES.bottles[id];
  if (!b || !b.drops) return { ok: false, reason: 'soon' };
  if (active[id]) return { ok: false, reason: 'active' };
  if (!(held > 0)) return { ok: false, reason: 'none' };
  if (id === 'electro-surge' && fuelOn) return { ok: false, reason: 'fuel' };
  if (id === 'build-brew' && !(jobsRunning > 0)) return { ok: false, reason: 'idle' };
  return { ok: true };
}

/** When a running job finishes once Build Brew is drunk at `now` (ms): 10x as fast for the brew's hour. */
export function brewedFinish(finishesAt, now) {
  const { speed, hours } = BOTTLE_RULES.bottles['build-brew'];
  const left = finishesAt - now;
  if (left <= 0) return finishesAt;
  const hour = hours * 3600e3;
  return left <= speed * hour ? now + left / speed : finishesAt - (speed - 1) * hour;
}
