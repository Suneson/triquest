// scoring.js — pure XP, level and volume logic. No DOM, no storage.
// Single source of truth: everything is derived from the list of workouts.

/** How much each discipline is "worth" per minute. */
export const TYPE_FACTOR = {
  run: 1.1,
  bike: 1.0,
  swim: 1.2,
  gym: 1.0,
  brick: 1.35,
  mobility: 0.6,
  other: 1.0,
};

/** Intensity multiplier — harder sessions earn more per minute. */
export const INTENSITY_FACTOR = {
  easy: 1.0,
  steady: 1.1,
  moderate: 1.15,
  threshold: 1.3,
  quality: 1.35,
  vo2: 1.45,
  race: 1.6,
};

/** XP earned for a single session (whether or not it is completed). */
export function xpForWorkout(w) {
  const dur = Math.max(0, Number(w.durationMin) || 0);
  const tf = TYPE_FACTOR[w.type] ?? 1.0;
  const inf = INTENSITY_FACTOR[w.intensity] ?? 1.0;
  // Small distance bonus so long endurance days feel rewarding.
  const km = Math.max(0, Number(w.metrics?.distanceKm) || 0);
  const base = dur * tf * inf + km * 1.5;
  return Math.round(base);
}

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
  for (const w of workouts) {
    if (w.completed && w.type === type) xp += xpForWorkout(w);
  }
  return levelFromTotalXp(xp);
}

/** Convenience: just the per-discipline level number. */
export function levelForType(workouts, type) {
  return sportProgress(workouts, type).level;
}

/**
 * Aggregate stats over the workout list.
 * Only *completed* sessions contribute to XP, volume and counts.
 */
export function computeStats(workouts) {
  const completed = workouts.filter((w) => w.completed);
  let totalXp = 0;
  let totalMinutes = 0;
  let totalKm = 0;
  const minutesByType = {};
  const kmByType = {};

  for (const w of completed) {
    totalXp += xpForWorkout(w);
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
