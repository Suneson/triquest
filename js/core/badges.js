// badges.js — achievement definitions and pure evaluation.
// Each badge has a `test(ctx)` predicate and an `icon` name from icons.js. `ctx` is derived once from the
// workout list + stats + streaks so the predicates stay tiny and testable.

import { startOfWeek } from './dates.js';
import { t } from './i18n.js';
import { computeStats } from './scoring.js';
import { computeStreaks } from './streaks.js';

// name and desc are getters: they read the active language (ids never change)
const badge = (b) => Object.defineProperties(b, {
  name: { enumerable: true, get: () => t(`badge.${b.id}.name`) },
  desc: { enumerable: true, get: () => t(`badge.${b.id}.desc`) },
});

export const BADGES = [
  badge({ id: 'first-workout', icon: 'target', test: (c) => c.stats.completedCount >= 1 }),
  badge({ id: 'streak-3', icon: 'flame', test: (c) => c.maxStreak >= 3 }),
  badge({ id: 'streak-7', icon: 'flame', test: (c) => c.maxStreak >= 7 }),
  badge({ id: 'streak-14', icon: 'flame', test: (c) => c.maxStreak >= 14 }),
  badge({ id: 'level-5', icon: 'star', test: (c) => c.stats.level >= 5 }),
  badge({ id: 'level-10', icon: 'spark', test: (c) => c.stats.level >= 10 }),
  badge({ id: 'workouts-50', icon: 'check', test: (c) => c.stats.completedCount >= 50 }),
  badge({ id: 'hours-12', icon: 'clock', test: (c) => c.stats.totalHours >= 12 }),
  badge({ id: 'bike-100', icon: 'bike', test: (c) => (c.stats.kmByType.bike || 0) >= 100 }),
  badge({ id: 'bike-500', icon: 'route', test: (c) => (c.stats.kmByType.bike || 0) >= 500 }),
  badge({ id: 'run-100', icon: 'run', test: (c) => (c.stats.kmByType.run || 0) >= 100 }),
  badge({ id: 'swim-25', icon: 'swim', test: (c) => (c.stats.kmByType.swim || 0) >= 25 }),
  badge({ id: 'brick', icon: 'brick', test: (c) => c.completed.some((w) => w.type === 'brick') }),
  badge({ id: 'triple', icon: 'medal', test: (c) => c.tripleDay }),
  badge({ id: 'all-rounder', icon: 'trophy', test: (c) => ['run', 'bike', 'swim', 'gym'].every((k) => c.typesDone.has(k)) }),
  badge({ id: 'long-run-30', icon: 'flag', test: (c) => c.completed.some((w) => w.type === 'run' && (w.metrics?.distanceKm || 0) >= 30) }),
  badge({ id: 'bike-week-200', icon: 'calendar', test: (c) => c.maxBikeWeekKm >= 200 }),
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
