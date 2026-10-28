// wallet.js — coins and carbs: earned by training and missions, spent in the
// shop. Pure.
//
// Neither is ever a stored number anyone can edit: both are worked out from
// the same XP ledger the levels use (xpLedger in xp-rules.js), the missions
// you completed and what you spent, so a session that doesn't earn XP earns
// nothing and nothing is counted twice. They come from base XP, never boosted
// XP, so gear can't buy more gear. The server's wallet_fold() (0015) does the
// same sums in the same order.
//
//   coins for a day = min(dailyCoinCap, floor(that day's base XP × coinsPerXp))
//   carbs for a day = min(dailyCarbCap, floor(that day's base XP × carbsPerXp))  (grams)
//   missions        = QUEST_REWARDS, coins or carbs
//   weekly missions = MISSION_RULES.reward, coins and carbs (missions.js)
//
// Storage: each currency holds at most storageCap. Events are taken in time
// order (a day's earnings at the start of that day, a spend when it was made);
// anything earned while the store is full is lost, like a full storage in a
// base-building game. A spend can take the balance below zero (docs/GEAR.md §7).

import { xpLedger } from './xp-rules.js';
import { GEAR_RULES, GEAR_SINCE, QUEST_REWARDS, fuelById } from './gear.js';
import { missionRewards } from './missions.js';

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
/** Grams of carbs a day's base XP is worth, after the daily cap. */
export const carbsForDay = (xp) => Math.min(GEAR_RULES.dailyCarbCap, Math.floor(Math.max(0, xp) * GEAR_RULES.carbsPerXp));

/** What each day earned: [{ date, xp, coins, carbs, capped }], oldest first. */
export function coinDays(workouts) {
  return [...xpByDay(workouts)].sort(([a], [b]) => a.localeCompare(b)).map(([date, xp]) => {
    const coins = coinsForDay(xp);
    return { date, xp, coins, carbs: carbsForDay(xp), capped: coins < Math.floor(xp * GEAR_RULES.coinsPerXp) };
  });
}

/** Coins earned by training so far (starter purse included, storage ignored). */
export const coinsEarned = (workouts) => GEAR_RULES.starterPurse + coinDays(workouts).reduce((n, d) => n + d.coins, 0);

/** What a session added to its day: { coins, carbs } (with it minus without it). */
export function earnedBySession(w, workouts) {
  const all = workouts && workouts.includes(w) ? workouts : [...(workouts || []), w];
  const day = (list) => coinDays(list.filter((x) => x.date === w.date))[0] || { coins: 0, carbs: 0 };
  const a = day(all);
  const b = day(all.filter((x) => x !== w));
  return { coins: a.coins - b.coins, carbs: a.carbs - b.carbs };
}
export const coinsForSession = (w, workouts) => earnedBySession(w, workouts).coins;

/** Mission rewards from completed quests [{ day, quest_id }], from GEAR_SINCE on. */
export function questRewards(completions) {
  return (completions || []).filter((q) => String(q?.day || '') >= GEAR_SINCE && QUEST_REWARDS[q.quest_id])
    .map((q) => ({ day: String(q.day), quest_id: q.quest_id, ...{ coins: 0, carbs: 0 }, ...QUEST_REWARDS[q.quest_id] }));
}

/** A spend's currency: the row says so, or the item does. */
const spendCurrency = (s) => s?.currency || (fuelById(s?.item_id) ? 'carbs' : 'coins');
const spendAmount = (s) => Number(s?.amount ?? s?.coins) || 0;

/**
 * Both balances, with the storage cap applied in time order (a challenge
 * payout or a collection bonus is an earning, so it can overflow a full store
 * like any other):
 * { coins, carbs, earned: { coins, carbs }, spent: { coins, carbs }, lost: { coins, carbs } }.
 */
export function walletFold({ workouts = [], quests = [], spends = [], moves = [], awards = [], missions = [] } = {}) {
  const ev = [];
  for (const d of coinDays(workouts)) ev.push({ at: `${d.date}T00:00:00.000Z`, rank: 0, key: d.date, coins: d.coins, carbs: d.carbs });
  for (const q of questRewards(quests)) ev.push({ at: `${q.day}T00:00:00.000Z`, rank: 1, key: q.quest_id, coins: q.coins, carbs: q.carbs });
  (spends || []).forEach((s, i) => {
    const t = Date.parse(s?.created_at);
    const at = Number.isFinite(t) ? new Date(t).toISOString() : '9999-12-31T00:00:00.000Z';
    const c = spendCurrency(s);
    ev.push({ at, rank: 2, key: String(s?.id ?? i).padStart(12, '0'), coins: c === 'coins' ? -spendAmount(s) : 0, carbs: c === 'carbs' ? -spendAmount(s) : 0 });
  });
  // challenge stakes (coins < 0), refunds and payouts (coins > 0): docs/CHALLENGES.md §5
  (moves || []).forEach((m, i) => {
    const t = Date.parse(m?.created_at);
    const at = Number.isFinite(t) ? new Date(t).toISOString() : '9999-12-31T00:00:00.000Z';
    ev.push({ at, rank: 3, key: String(m?.id ?? i).padStart(12, '0'), coins: Number(m?.coins) || 0, carbs: 0 });
  });
  // collection set bonuses (collections.js), from the moment the set completed
  (awards || []).forEach((a) => {
    ev.push({ at: new Date(Date.parse(a.at)).toISOString(), rank: 4, key: `${a.sport}:${a.tier}`, coins: Number(a.coins) || 0, carbs: 0 });
  });
  // weekly missions (missions.js), from the moment the server paid them
  for (const m of missionRewards(missions)) {
    ev.push({ at: new Date(Date.parse(m.at)).toISOString(), rank: 5, key: m.key, coins: m.coins, carbs: m.carbs });
  }
  ev.sort((a, b) => a.at.localeCompare(b.at) || a.rank - b.rank || a.key.localeCompare(b.key));
  const cap = GEAR_RULES.storageCap;
  const out = {
    coins: Math.min(cap, GEAR_RULES.starterPurse), carbs: Math.min(cap, GEAR_RULES.starterCarbs),
    earned: { coins: GEAR_RULES.starterPurse, carbs: GEAR_RULES.starterCarbs },
    spent: { coins: 0, carbs: 0 }, lost: { coins: 0, carbs: 0 },
  };
  for (const e of ev) {
    for (const cur of ['coins', 'carbs']) {
      const v = e[cur];
      if (!v) continue;
      if (v > 0) {
        const room = Math.max(0, cap - out[cur]);
        out[cur] += Math.min(v, room);
        out.earned[cur] += v;
        out.lost[cur] += Math.max(0, v - room);
      } else {
        out[cur] += v;
        out.spent[cur] -= v;
      }
    }
  }
  return out;
}

/** Balance from what was earned and the spends [{ coins }] (one currency, no cap). */
export const balance = (earned, spends) => earned - (spends || []).reduce((n, s) => n + spendAmount(s), 0);

/** Fuel of one kind bought and not yet used (taken, or spent finishing a workshop job). */
export const fuelHeld = (spends, boosts, kind, jobs = []) =>
  (spends || []).filter((s) => s?.item_id === kind).length - (boosts || []).filter((b) => b?.kind === kind).length
  - (jobs || []).filter((j) => j?.skipped_with === kind).length;
export const gelsHeld = (spends, boosts, jobs) => fuelHeld(spends, boosts, 'gel', jobs);
