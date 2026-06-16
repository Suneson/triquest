// load.js — training load, acute:chronic workload ratio (ACWR) and a run-volume
// guardrail. Pure functions over completed workouts. Injectable `today` for tests.
//
// Load model: a simple session load = duration(min) × intensity weight (a TRIMP-
// like proxy). It needs no HR data so it works for every logged session.

import { addDays, diffDays, startOfWeek } from './dates.js';

export const INTENSITY_LOAD = {
  easy: 1.0, steady: 1.3, moderate: 1.5, threshold: 2.0, quality: 2.0, vo2: 2.5, race: 2.5,
};

export function sessionLoad(w) {
  if (!w.completed) return 0;
  const dur = Math.max(0, Number(w.durationMin) || 0);
  return Math.round(dur * (INTENSITY_LOAD[w.intensity] ?? 1.0));
}

/** Total load over [startIso, endIso] inclusive. */
export function loadBetween(workouts, startIso, endIso) {
  return workouts.reduce((sum, w) =>
    (w.completed && w.date >= startIso && w.date <= endIso ? sum + sessionLoad(w) : sum), 0);
}

/**
 * Acute:chronic workload ratio.
 * acute = load over the last 7 days; chronic = average weekly load over the
 * last 28 days. ratio = acute / chronicWeekly. The "sweet spot" is ~0.8–1.3;
 * >1.5 flags a spike. Returns nulls-safe numbers.
 */
export function acwr(workouts, today) {
  const acuteStart = addDays(today, -6);
  const chronicStart = addDays(today, -27);
  const acute = loadBetween(workouts, acuteStart, today);
  const chronic28 = loadBetween(workouts, chronicStart, today);
  const chronicWeekly = chronic28 / 4;
  const ratio = chronicWeekly > 0 ? acute / chronicWeekly : 0;
  let zone = 'ok';
  if (chronicWeekly === 0) zone = 'unknown';
  else if (ratio > 1.5) zone = 'danger';
  else if (ratio > 1.3) zone = 'high';
  else if (ratio < 0.8) zone = 'detraining';
  return { acute, chronicWeekly: Math.round(chronicWeekly), ratio: Math.round(ratio * 100) / 100, zone };
}

/** Completed km of a given type within a Monday-anchored week. */
export function weekKm(workouts, weekStartIso, type) {
  const end = addDays(weekStartIso, 6);
  return workouts.reduce((sum, w) => {
    if (!w.completed || w.type !== type || w.date < weekStartIso || w.date > end) return sum;
    return sum + (Number(w.metrics?.distanceKm) || 0);
  }, 0);
}

/**
 * Run-volume guardrail: compares this week's completed run km with last week's.
 * The "never spike weekly run volume >10%" rule (run-injury history).
 */
export function runVolumeJump(workouts, today, weekStart = 1) {
  const thisWeekStart = startOfWeek(today, weekStart);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const thisKm = weekKm(workouts, thisWeekStart, 'run');
  const lastKm = weekKm(workouts, lastWeekStart, 'run');
  const pctChange = lastKm > 0 ? Math.round(((thisKm - lastKm) / lastKm) * 100) : null;
  return {
    thisKm: Math.round(thisKm * 10) / 10,
    lastKm: Math.round(lastKm * 10) / 10,
    pctChange,
    warn: pctChange != null && pctChange > 10,
  };
}

/** Weekly training hours, for the "hours vs phase target" rings. */
export function weekHours(workouts, weekStartIso) {
  const end = addDays(weekStartIso, 6);
  const min = workouts.reduce((s, w) =>
    (w.completed && w.date >= weekStartIso && w.date <= end ? s + (w.durationMin || 0) : s), 0);
  return Math.round((min / 60) * 10) / 10;
}
