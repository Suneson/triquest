// scoring.js — pure XP, level and volume logic. No DOM, no storage.
// Single source of truth: everything is derived from the list of workouts.

// Who earns XP and how much lives in xp-rules.js (the two paths, the gym
// plausibility rules, the Strava bonus and the daily gym cap); re-exported
// here so the rest of the app keeps importing from scoring.js.
export {
  TYPE_FACTOR, INTENSITY_FACTOR, earnsXp, xpForWorkout, xpLedger, xpStatus, proofOf, gymVerdict, hasStravaProof,
} from './xp-rules.js';
import { xpLedger } from './xp-rules.js';

/**
 * Total cumulative XP required to *be* at a given level.
 * Level 1 = 0 XP. The per-level cost grows super-linearly (≈ level^1.6), so the
 * early levels come quickly but reaching Level 10 is a real grind — each new
 * level costs noticeably more than the last.
 *   cost(L→L+1) = round(100 * L^1.6);  threshold(L) = Σ cost(1..L-1)
 */
export function xpToReachLevel(level) {
  if (level <= 1) return 0;
  let total = 0;
  for (let L = 1; L < level; L++) total += Math.round(100 * Math.pow(L, 1.6));
  return total;
}

/** Derive level + progress within the level from a total XP value. */
export function levelFromTotalXp(totalXp) {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (xpToReachLevel(level + 1) <= xp) level++;
  const floor = xpToReachLevel(level);
  const ceil = xpToReachLevel(level + 1);
  const span = ceil - floor;
  const into = xp - floor;
  return {
    level,
    totalXp: xp,
    into,
    span,
    toNext: span - into,
    progress: span > 0 ? into / span : 0,
  };
}

/**
 * Per-discipline progress: run the same XP curve over only this discipline's
 * completed-workout XP. A cyclist who only rides levels up BIKE, not RUN.
 * Returns the full {level, totalXp, into, span, toNext, progress} shape.
 */
export function sportProgress(workouts, type) {
  let xp = 0;
  for (const r of xpLedger(workouts)) if (r.w.type === type) xp += r.xp;
  return levelFromTotalXp(xp);
}

/** Convenience: just the per-discipline level number. */
export function levelForType(workouts, type) {
  return sportProgress(workouts, type).level;
}

/**
 * Aggregate stats over the workout list.
 * Only sessions that earn XP (see earnsXp) count toward XP, volume and counts.
 */
export function computeStats(workouts) {
  const ledger = xpLedger(workouts);
  const completed = ledger.map((r) => r.w);
  let totalXp = 0;
  let totalMinutes = 0;
  let totalKm = 0;
  const minutesByType = {};
  const kmByType = {};

  for (const { w, xp } of ledger) {
    totalXp += xp;
    const dur = Math.max(0, Number(w.durationMin) || 0);
    const km = Math.max(0, Number(w.metrics?.distanceKm) || 0);
    totalMinutes += dur;
    totalKm += km;
    minutesByType[w.type] = (minutesByType[w.type] || 0) + dur;
    kmByType[w.type] = (kmByType[w.type] || 0) + km;
  }

  return {
    ...levelFromTotalXp(totalXp),
    totalXp,
    completedCount: completed.length,
    totalMinutes,
    totalHours: totalMinutes / 60,
    totalKm,
    minutesByType,
    kmByType,
  };
}

/** Format minutes as a compact "1 h 30 m" / "45 m" label. */
export function formatDuration(min) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h && rem) return `${h} h ${rem} m`;
  if (h) return `${h} h`;
  return `${rem} m`;
}
