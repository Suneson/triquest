// wallet.js — coins: earned by training, spent in the GEAR workshop. Pure.
//
// Coins are never stored as a number anyone can edit: the balance is always
// earned − spent, worked out from the same XP ledger the levels use
// (xpLedger in xp-rules.js), so a session that doesn't earn XP earns no coins
// and nothing is counted twice. Coins come from base XP, never boosted XP, so
// gear can't buy more gear. The server's coins_earned() (0014_gear.sql) does
// the same sums.
//
//   coins for a day = min(dailyCoinCap, floor(that day's base XP × coinsPerXp))
//   earned          = starterPurse + Σ days dated from GEAR_SINCE

import { xpLedger } from './xp-rules.js';
import { GEAR_RULES, GEAR_SINCE } from './gear.js';

/** Base XP per session date, from GEAR_SINCE on: Map(date → xp). */
function xpByDay(workouts) {
  const days = new Map();
  for (const { w, xp } of xpLedger(workouts)) {
    const d = String(w.date || '');
    if (d < GEAR_SINCE) continue;
    days.set(d, (days.get(d) || 0) + xp);
  }
  return days;
}

/** Coins a day's base XP is worth, after the daily cap. */
export const coinsForDay = (xp) => Math.min(GEAR_RULES.dailyCoinCap, Math.floor(Math.max(0, xp) * GEAR_RULES.coinsPerXp));

/** Coins earned per day: [{ date, xp, coins, capped }], oldest first. */
export function coinDays(workouts) {
  return [...xpByDay(workouts)].sort(([a], [b]) => a.localeCompare(b)).map(([date, xp]) => {
    const coins = coinsForDay(xp);
    return { date, xp, coins, capped: coins < Math.floor(xp * GEAR_RULES.coinsPerXp) };
  });
}

/** Everything earned so far, starter purse included. */
export const coinsEarned = (workouts) => GEAR_RULES.starterPurse + coinDays(workouts).reduce((n, d) => n + d.coins, 0);

/** Coins a session added, for the session-complete summary: what its day earns with it minus without it. */
export function coinsForSession(w, workouts) {
  const all = workouts && workouts.includes(w) ? workouts : [...(workouts || []), w];
  const day = (list) => coinDays(list.filter((x) => x.date === w.date))[0]?.coins || 0;
  return day(all) - day(all.filter((x) => x !== w));
}

/** Balance from what was earned and the spends [{ coins }]. It can go negative (see docs/GEAR.md §7). */
export const balance = (earned, spends) => earned - (spends || []).reduce((n, s) => n + (Number(s?.coins) || 0), 0);

/** Gels bought and not yet used. */
export const gelsHeld = (spends, boosts) =>
  (spends || []).filter((s) => s?.item_id === 'gel').length - (boosts || []).filter((b) => b?.kind === 'gel').length;
