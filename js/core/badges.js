// badges.js — achievement definitions and pure evaluation.
// Each badge has a `test(ctx)` predicate and an `icon` name from icons.js. `ctx` is derived once from the
// workout list + stats + streaks so the predicates stay tiny and testable.

import { startOfWeek } from './dates.js';
import { computeStats } from './scoring.js';
import { computeStreaks } from './streaks.js';

export const BADGES = [
  { id: 'first-workout', name: 'First Steps', icon: 'target', desc: 'Complete your very first session', test: (c) => c.stats.completedCount >= 1 },
  { id: 'streak-3', name: 'On a Roll', icon: 'flame', desc: 'Reach a 3-day streak', test: (c) => c.maxStreak >= 3 },
  { id: 'streak-7', name: 'Week Warrior', icon: 'flame', desc: 'Reach a 7-day streak', test: (c) => c.maxStreak >= 7 },
  { id: 'streak-14', name: 'Fortnight Beast', icon: 'flame', desc: 'Reach a 14-day streak', test: (c) => c.maxStreak >= 14 },
  { id: 'level-5', name: 'Rising Star', icon: 'star', desc: 'Reach level 5', test: (c) => c.stats.level >= 5 },
  { id: 'level-10', name: 'Double Digits', icon: 'spark', desc: 'Reach level 10', test: (c) => c.stats.level >= 10 },
  { id: 'workouts-50', name: 'Half Century', icon: 'check', desc: 'Complete 50 sessions', test: (c) => c.stats.completedCount >= 50 },
  { id: 'hours-12', name: 'Time Served', icon: 'clock', desc: 'Train 12+ hours in total', test: (c) => c.stats.totalHours >= 12 },
  { id: 'bike-100', name: 'Century Rider', icon: 'bike', desc: 'Ride 100 km in total', test: (c) => (c.stats.kmByType.bike || 0) >= 100 },
  { id: 'bike-500', name: 'Long Hauler', icon: 'route', desc: 'Ride 500 km in total', test: (c) => (c.stats.kmByType.bike || 0) >= 500 },
  { id: 'run-100', name: 'Road Runner', icon: 'run', desc: 'Run 100 km in total', test: (c) => (c.stats.kmByType.run || 0) >= 100 },
  { id: 'swim-25', name: 'Fish', icon: 'swim', desc: 'Swim 25 km in total', test: (c) => (c.stats.kmByType.swim || 0) >= 25 },
  { id: 'brick', name: 'Bricklayer', icon: 'brick', desc: 'Complete a brick session', test: (c) => c.completed.some((w) => w.type === 'brick') },
  { id: 'triple', name: 'Triple Threat', icon: 'medal', desc: 'Run, bike and swim on the same day', test: (c) => c.tripleDay },
  { id: 'all-rounder', name: 'All-Rounder', icon: 'trophy', desc: 'Complete a run, bike, swim and gym session', test: (c) => ['run', 'bike', 'swim', 'gym'].every((t) => c.typesDone.has(t)) },
  { id: 'long-run-30', name: 'Marathon Ready', icon: 'flag', desc: 'Complete a single run of 30 km or more', test: (c) => c.completed.some((w) => w.type === 'run' && (w.metrics?.distanceKm || 0) >= 30) },
  { id: 'bike-week-200', name: 'Big Bike Week', icon: 'calendar', desc: 'Ride 200 km of bike in a single week', test: (c) => c.maxBikeWeekKm >= 200 },
];

/** Build the derived context the badge predicates read from. */
export function buildBadgeContext(workouts, today) {
  const stats = computeStats(workouts);
  const streaks = computeStreaks(workouts, today);
  const completed = workouts.filter((w) => w.completed);

  const typesDone = new Set(completed.map((w) => w.type));

  // Disciplines completed per calendar day -> "triple" if run+bike+swim overlap.
  const dayTypes = new Map();
  for (const w of completed) {
    if (!dayTypes.has(w.date)) dayTypes.set(w.date, new Set());
    dayTypes.get(w.date).add(w.type);
  }
  let tripleDay = false;
  for (const set of dayTypes.values()) {
    if (set.has('run') && set.has('bike') && set.has('swim')) { tripleDay = true; break; }
  }

  // Max bike km within any Monday-anchored week.
  const bikeWeek = new Map();
  for (const w of completed) {
    if (w.type !== 'bike') continue;
    const wk = startOfWeek(w.date, 1);
    bikeWeek.set(wk, (bikeWeek.get(wk) || 0) + (w.metrics?.distanceKm || 0));
  }
  const maxBikeWeekKm = bikeWeek.size ? Math.max(...bikeWeek.values()) : 0;

  return {
    stats,
    streaks,
    completed,
    typesDone,
    tripleDay,
    maxBikeWeekKm,
    maxStreak: Math.max(streaks.current, streaks.longest),
  };
}

/** Return the array of badge ids currently earned. */
export function evaluateBadges(workouts, today) {
  const ctx = buildBadgeContext(workouts, today);
  return BADGES.filter((b) => {
    try { return b.test(ctx); } catch { return false; }
  }).map((b) => b.id);
}

/** Ids present in `current` but not in `previous`. */
export function newlyUnlocked(previous, current) {
  const prev = new Set(previous);
  return current.filter((id) => !prev.has(id));
}
