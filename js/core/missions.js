// missions.js — weekly missions (docs/LOOP.md §5.1). Pure.
//
// Every week (Monday to Sunday, the athlete's local days) the mission board
// shows three missions: two that ask for training and one that asks for rest
// or recovery. They rotate from a fixed pool in a fixed order, so everyone
// sees the same board that week and next week's board is known now. Every
// mission pays the same, so a rest mission is worth exactly as much as a
// training one. Nothing is random and nothing is lost: a mission you didn't
// finish just isn't there next week.
//
// Missions only count verified work (the same rule as XP: earnsXp), and a
// rest day only counts once it's over. The server's claim_mission()
// (0025_missions.sql) checks the same rules before it pays; the wallet adds
// the reward like any other earning (wallet.js, rank 5).

import { addDays, diffDays, startOfWeek } from './dates.js';
import { earnsXp } from './xp-rules.js';

export const MISSION_RULES = {
  /** The first mission week (a Monday). */
  since: '2026-10-26',
  /** Training missions on each week's board; one rest mission joins them. */
  training: 2,
  /** Every mission pays this, rest missions included. */
  reward: { coins: 60, carbs: 40 },
  /** Weeks after its own a mission can still be claimed (a Sunday rest day is only over on Monday). */
  claimWindow: 1,
};

const minutesOf = (w) => Math.max(0, Number(w.actual?.durationMin ?? w.durationMin) || 0);
const kmOf = (w) => Math.max(0, Number(w.actual?.distanceKm ?? w.metrics?.distanceKm) || 0);
const DISTANCE_TYPES = new Set(['run', 'bike', 'swim', 'brick']);

/**
 * The pool, in rotation order. Append only, and only between weeks: a week's
 * board is picked by its index in these lists. A paid mission is stored with
 * its id, so changing the pool never takes back a reward; a mission can only
 * be claimed in its own week or the one after (claimWindow). `measure(d)` →
 * the number so far, `target` the number that finishes it.
 */
export const TRAINING_MISSIONS = [
  { id: 'w-sessions-3', target: 3, measure: (d) => d.verified.length },
  { id: 'w-hours-4', target: 240, unit: 'min', measure: (d) => Math.floor(d.verified.reduce((a, w) => a + minutesOf(w), 0)) },
  { id: 'w-km-40', target: 40, unit: 'km', measure: (d) => Math.floor(d.verified.filter((w) => DISTANCE_TYPES.has(w.type)).reduce((a, w) => a + kmOf(w), 0)) },
  { id: 'w-two-sports', target: 2, measure: (d) => new Set(d.verified.map((w) => w.type)).size },
  { id: 'w-long-90', target: 1, measure: (d) => d.verified.filter((w) => minutesOf(w) >= 90).length },
  { id: 'w-days-3', target: 3, measure: (d) => new Set(d.verified.map((w) => w.date)).size },
];
export const REST_MISSIONS = [
  // a full day off: nothing completed that day, counted once the day is over
  { id: 'w-rest-2', kind: 'rest', target: 2, measure: (d) => d.restDays },
  // an easy session: one verified session of 20 to 40 minutes
  { id: 'w-recovery', kind: 'rest', target: 1, measure: (d) => d.verified.filter((w) => minutesOf(w) >= 20 && minutesOf(w) <= 40).length },
  { id: 'w-rest-1', kind: 'rest', target: 1, measure: (d) => d.restDays },
];
export const MISSIONS = [...TRAINING_MISSIONS.map((m) => ({ ...m, kind: 'training' })), ...REST_MISSIONS];
export const missionById = (id) => MISSIONS.find((m) => m.id === id) || null;

/** The Monday of a date's week. */
export const weekOf = (date) => startOfWeek(date, 1);

/** Weeks from the first mission week (negative before it). */
export const weekIndex = (week) => Math.floor(diffDays(weekOf(week), MISSION_RULES.since) / 7);

/** A week's board: the mission ids, training first. Empty before missions start. */
export function weeklyMissions(week) {
  const k = weekIndex(week);
  if (k < 0) return [];
  const n = TRAINING_MISSIONS.length;
  const out = [];
  for (let i = 0; i < MISSION_RULES.training; i++) out.push(TRAINING_MISSIONS[(k * MISSION_RULES.training + i) % n].id);
  out.push(REST_MISSIONS[k % REST_MISSIONS.length].id);
  return out;
}

/** Everything a mission needs to judge a week, as of `today` (rest days count once over). */
export function weekContext(week, workouts, today) {
  const start = weekOf(week);
  const end = addDays(start, 6);
  const inWeek = (workouts || []).filter((w) => w?.date >= start && w.date <= end);
  const busy = new Set(inWeek.filter((w) => w.completed).map((w) => w.date));
  let restDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    if (d < today && !busy.has(d)) restDays++;
  }
  return { start, end, verified: inWeek.filter(earnsXp), restDays };
}

/**
 * The week's board with progress: [{ id, kind, target, unit, value, done, claimed }].
 * `claims`: [{ week, mission_id }] already paid.
 */
export function missionBoard(week, workouts, today, claims = []) {
  const d = weekContext(week, workouts, today);
  const paid = new Set((claims || []).filter((c) => String(c.week) === d.start).map((c) => c.mission_id));
  return weeklyMissions(d.start).map((id) => {
    const m = missionById(id);
    const value = m.measure(d);
    return { id, kind: m.kind, target: m.target, unit: m.unit || null, value: Math.min(value, m.target), done: value >= m.target, claimed: paid.has(id) };
  });
}

/** Missions done this week and not paid yet: [{ week, mission_id }]. */
export const missionsToClaim = (week, workouts, today, claims) => missionBoard(week, workouts, today, claims)
  .filter((m) => m.done && !m.claimed).map((m) => ({ week: weekOf(week), mission_id: m.id }));

/** Rewards from paid missions, for the wallet: [{ at, key, coins, carbs }]. */
export const missionRewards = (claims) => (claims || []).filter((c) => missionById(c.mission_id)).map((c) => ({
  at: c.claimed_at || `${c.week}T00:00:00.000Z`, key: `${c.week}:${c.mission_id}`, ...MISSION_RULES.reward,
}));

/** Days left in the week (today counts): 1 on Sunday. */
export const daysLeftInWeek = (today) => 7 - diffDays(today, weekOf(today));
