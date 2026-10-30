// rewards.js — the chest a finished session leaves behind (docs/REWARDS.md).
// Pure. The server (0027_reward_chests.sql) runs the same rules: it makes the
// chests, rolls them and pays them, so nothing here can mint coins.
//
//   1. A session earns a chest when it earns XP, from CHEST_RULES.since on, lasts
//      at least minMinutes, and is among the first perDay chests of its day.
//   2. Its difficulty bracket comes from what was measured: how long, how far, what
//      sport. The plan's intensity label moves it one bracket at most, and only a
//      long or milestone session (or a race of an hour or more) is brutal.
//   3. The tier is rolled once, by the server, against the bracket's odds. A tier
//      that's switched off (epic, until its animation exists) rolls as the tier
//      below it, so the rare tiers stay exactly as rare.
//   4. Opening it pays a bonus on top of what the session already earned: a flat
//      amount for the tier plus a share of the session's own coins and carbs.
//
// The session's own coins and carbs are not the chest's: training pays them the
// moment it syncs (wallet.js). The chest only reveals them, with its bonus.

import { GEAR_RULES } from './gear.js';
import { xpLedger, ledgerOrder } from './xp-rules.js';

export const TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export const DIFFICULTIES = ['easy', 'moderate', 'hard', 'brutal'];

export const CHEST_RULES = {
  /** Sessions on or after this day leave a chest (earlier history doesn't). */
  since: '2026-10-30',
  /** Shorter sessions earn their XP but no chest. */
  minMinutes: 20,
  /** At most this many chests a day. */
  perDay: 3,
  /** Tiers with an animation. A disabled tier rolls as the enabled tier below it. */
  enabled: { common: true, uncommon: true, rare: true, epic: false, legendary: true, mythic: true },
  /** The chance of each tier, in percent, by difficulty (each row is normalised to its sum). */
  odds: {
    easy: { common: 82, uncommon: 15, rare: 2.9, epic: 0.09, legendary: 0.01, mythic: 0 },
    moderate: { common: 68, uncommon: 24, rare: 7.4, epic: 0.55, legendary: 0.05, mythic: 0.005 },
    hard: { common: 48, uncommon: 36, rare: 13, epic: 2.8, legendary: 0.19, mythic: 0.01 },
    brutal: { common: 32, uncommon: 42, rare: 19, epic: 6.5, legendary: 0.45, mythic: 0.05 },
  },
  /** What opening pays: flat coins and grams of carbs, plus pct% of the session's own. */
  bonus: {
    common: { coins: 10, carbs: 15, pct: 10 },
    uncommon: { coins: 25, carbs: 40, pct: 20 },
    rare: { coins: 60, carbs: 90, pct: 35 },
    epic: { coins: 120, carbs: 180, pct: 50 },
    legendary: { coins: 250, carbs: 400, pct: 75 },
    mythic: { coins: 600, carbs: 900, pct: 100 },
  },
  /** Minutes that set the bracket: under 45 easy, under 90 moderate, under 150 hard, else brutal. */
  minutes: [45, 90, 150],
  /** Plan labels that push a session up one bracket (never past hard). */
  hardLabels: ['threshold', 'quality', 'vo2'],
  /** Measured milestones that make a session brutal, in km by sport (a brick of 90 min too). */
  milestoneKm: { bike: 100, run: 21, swim: 3.8 },
  brickMinutes: 90,
  /** A race of at least this long is brutal; a shorter one is hard. */
  raceMinutes: 60,
};

const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** The minutes a session lasted: what Strava measured, else what was logged. */
export function sessionMinutes(w) {
  const moving = num(w?.actual?.movingSec);
  if (moving != null) return moving / 60;
  return Math.max(0, num(w?.durationMin) ?? 0);
}

/** The kilometres a session covered: what Strava measured, else what was logged. */
export function sessionKm(w) {
  return Math.max(0, num(w?.actual?.distanceKm) ?? num(w?.metrics?.distanceKm) ?? 0);
}

/** A session's difficulty bracket: 'easy' | 'moderate' | 'hard' | 'brutal'. */
export function workoutDifficulty(w) {
  const R = CHEST_RULES;
  const min = sessionMinutes(w);
  const km = sessionKm(w);
  if (w?.type === 'mobility') return 'easy';
  if ((R.milestoneKm[w?.type] != null && km >= R.milestoneKm[w.type]) || (w?.type === 'brick' && min >= R.brickMinutes)) return 'brutal';
  let i = min < R.minutes[0] ? 0 : min < R.minutes[1] ? 1 : min < R.minutes[2] ? 2 : 3;
  if (w?.intensity === 'race') i = Math.max(i, min >= R.raceMinutes ? 3 : 2);
  else if (R.hardLabels.includes(w?.intensity)) i = Math.max(i, Math.min(2, i + 1));
  return DIFFICULTIES[i];
}

/**
 * The odds a bracket rolls with, after switched-off tiers have passed their
 * share down: { tier: percent } over the enabled tiers, summing to 100.
 */
export function chestOdds(difficulty) {
  const row = CHEST_RULES.odds[difficulty] || CHEST_RULES.odds.easy;
  const total = TIERS.reduce((n, t) => n + row[t], 0);
  const out = {};
  let carry = 0;
  // from the top down, a disabled tier's share joins the next enabled tier below
  for (let i = TIERS.length - 1; i >= 0; i--) {
    const t = TIERS[i];
    const p = row[t] + carry;
    if (CHEST_RULES.enabled[t]) { out[t] = (p / total) * 100; carry = 0; } else carry = p;
  }
  if (carry) out.common = (out.common || 0) + (carry / total) * 100;
  return Object.fromEntries(TIERS.filter((t) => t in out).map((t) => [t, out[t]]));
}

/**
 * Roll a chest tier. `r` is a number in [0, 1): the server passes its own
 * random(), tests and previews pass any. The same r always gives the same tier.
 */
export function rollChestTier(difficulty, r = Math.random()) {
  const odds = chestOdds(difficulty);
  const x = Math.min(Math.max(Number(r) || 0, 0), 0.999999999) * 100;
  let acc = 0;
  let last = 'common';
  for (const t of TIERS) {
    if (!(t in odds)) continue;
    acc += odds[t];
    last = t;
    if (x < acc) return t;
  }
  return last;
}

/** A session's own coins and carbs, before the daily caps: what a chest's share is taken from. */
export const sessionBase = (xp) => ({
  coins: Math.floor(Math.max(0, Number(xp) || 0) * GEAR_RULES.coinsPerXp),
  carbs: Math.floor(Math.max(0, Number(xp) || 0) * GEAR_RULES.carbsPerXp),
});

/** What opening a chest of this tier pays, for a session of `xp` base XP (0 for a gift). */
export function chestBonus(tier, xp = 0) {
  const b = CHEST_RULES.bonus[tier] || CHEST_RULES.bonus.common;
  const base = sessionBase(xp);
  return { coins: b.coins + Math.floor((base.coins * b.pct) / 100), carbs: b.carbs + Math.floor((base.carbs * b.pct) / 100) };
}

/**
 * The sessions that leave a chest: [{ w, xp, difficulty }], in the order the
 * ledger takes them, at most perDay a day. (The server makes the chests as
 * sessions arrive; this is the same rule for the demo and the tests.)
 */
export function chestSessions(workouts) {
  const R = CHEST_RULES;
  const rows = xpLedger(workouts)
    .filter(({ w, xp }) => String(w.date) >= R.since && xp > 0 && sessionMinutes(w) >= R.minMinutes)
    .sort((a, b) => ledgerOrder(a.w, b.w));
  const perDay = new Map();
  const out = [];
  for (const { w, xp } of rows) {
    const n = perDay.get(w.date) || 0;
    if (n >= R.perDay) continue;
    perDay.set(w.date, n + 1);
    out.push({ w, xp, difficulty: workoutDifficulty(w) });
  }
  return out;
}

/** The art for a tier (icons/AnimatedRewards): its clip, its sound and its still. */
export const chestArt = (tier) => {
  const name = tier[0].toUpperCase() + tier.slice(1);
  return {
    webm: `icons/AnimatedRewards/WEBM/${name}.webm`,
    mp3: `icons/AnimatedRewards/mp3/${name}.mp3`,
    still: `icons/AnimatedRewards/still/${name}.webp`,
  };
};

/** The highest tier among chests (for the Home card's picture). */
export const topTier = (chests) => (chests || []).reduce((best, c) => (TIERS.indexOf(c.tier) > TIERS.indexOf(best) ? c.tier : best), 'common');
