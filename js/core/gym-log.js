// gym-log.js — the rules behind the gym logger. Pure; no DOM, no clock of its
// own (every function that needs "now" takes it as an argument).
//
// The logger works on the set model from sets.js. This module answers:
//   - what each set is labelled (W, 1, 2, D, F) and what tapping the label does
//   - what you did last time for an exercise (the PREVIOUS column)
//   - volume, best set and the finish summary (warm-ups never count)
//   - the rest timer and the per-set stopwatch, both stored as timestamps so
//     a reload, a locked phone or a backgrounded tab can't lose them
//   - what Finish writes: a log stamp only. A gym session earns XP when a
//     verified Strava activity links to it, never from pressing Finish.

import { newSet, workSets } from './sets.js';
import { normName } from './exercises.js';

export const SET_KIND_LABELS = { warmup: 'Warm-up', work: 'Work', drop: 'Drop', failure: 'Failure' };

/** Grid labels: warm-ups are W, drop sets D, failure sets F, work sets count 1, 2, 3. */
export function setLabels(sets) {
  let n = 0;
  return (sets || []).map((s) => {
    if (s.kind === 'warmup') return 'W';
    n++;
    if (s.kind === 'drop') return 'D';
    if (s.kind === 'failure') return 'F';
    return String(n);
  });
}

/** Same exercise? Library id when both have one, otherwise the normalised name. */
export function sameExercise(a, b) {
  if (!a || !b) return false;
  if (a.libId && b.libId) return a.libId === b.libId;
  return normName(a.name) !== '' && normName(a.name) === normName(b.name);
}

/**
 * The sets you logged for this exercise in your most recent earlier session
 * (by date, then by when it was logged). Only ticked sets count. Returns
 * { date, sets } or null.
 */
export function previousSets(workouts, ex, { beforeDate, excludeId } = {}) {
  let best = null;
  for (const w of workouts || []) {
    if (w.id === excludeId || !Array.isArray(w.exercises)) continue;
    if (beforeDate && w.date > beforeDate) continue;
    for (const e of w.exercises) {
      if (!sameExercise(e, ex) || !Array.isArray(e.sets)) continue;
      const done = e.sets.filter((s) => s.done);
      if (!done.length) continue;
      const stamp = done.map((s) => s.doneAt || '').sort().pop();
      if (!best || w.date > best.date || (w.date === best.date && stamp > best.stamp)) best = { date: w.date, stamp, sets: done };
    }
  }
  return best && { date: best.date, sets: best.sets };
}

/**
 * The previous set that sits in the same place as set `i`: the n-th warm-up
 * against the n-th warm-up, the n-th working set against the n-th working set.
 */
export function previousFor(prev, sets, i) {
  if (!prev?.sets?.length) return null;
  const s = sets[i];
  const warm = s.kind === 'warmup';
  const pos = sets.slice(0, i).filter((x) => (x.kind === 'warmup') === warm).length;
  const pool = prev.sets.filter((x) => (x.kind === 'warmup') === warm);
  return pool[pos] || null;
}

const trim = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

/** "100 kg × 8", "+10 kg × 6", "× 12", "45 s". Empty string when there's nothing. */
export function formatSet(s, kind = 'weight_reps') {
  if (!s) return '';
  if (kind === 'time' || kind === 'distance') return s.seconds != null ? fmtClock(s.seconds) : '';
  const reps = s.reps != null ? `× ${trim(s.reps)}` : '';
  if (s.weight != null && s.weight !== 0) return `${kind === 'bodyweight' ? '+' : ''}${trim(s.weight)} kg ${reps}`.trim();
  return reps;
}

/** Copy a previous set's numbers onto a set (kind and done state stay). */
export function fillFrom(set, prev) {
  if (!prev) return set;
  for (const k of ['weight', 'reps', 'seconds']) if (prev[k] != null) set[k] = prev[k];
  return set;
}

/** A new set appended after the last one, carrying its numbers but not its tick. */
export function addSet(ex) {
  const last = ex.sets[ex.sets.length - 1];
  const s = newSet('work', last ? { weight: last.weight, reps: last.reps, seconds: last.seconds } : {});
  ex.sets.push(s);
  return s;
}

/** Remove set i; an exercise keeps at least one set. Returns whether it removed one. */
export function removeSet(ex, i) {
  if (ex.sets.length <= 1 || i < 0 || i >= ex.sets.length) return false;
  ex.sets.splice(i, 1);
  return true;
}

/** Tick or untick set i. Ticking fills blank numbers from `fallback` (last time). */
export function tickSet(ex, i, done, now, fallback = null) {
  const s = ex.sets[i];
  if (!s) return null;
  if (done) {
    for (const k of ['weight', 'reps', 'seconds']) if (s[k] == null && fallback?.[k] != null) s[k] = fallback[k];
    s.done = true;
    s.doneAt = new Date(now).toISOString();
  } else {
    s.done = false;
    s.doneAt = null;
  }
  return s;
}

// ---- numbers ----------------------------------------------------------------------------

/** kg × reps over ticked sets, warm-ups excluded. Bodyweight sets count only added weight. */
export function exerciseVolume(ex) {
  return workSets(ex).filter((s) => s.done && s.weight > 0 && s.reps > 0)
    .reduce((t, s) => t + s.weight * s.reps, 0);
}

/** Summary for the finish screen. */
export function sessionSummary(w, now) {
  const ex = w.exercises || [];
  const doneSets = ex.flatMap((e) => workSets(e).filter((s) => s.done));
  const started = w.gymStartedAt ? Date.parse(w.gymStartedAt) : null;
  return {
    sets: doneSets.length,
    exercises: ex.filter((e) => workSets(e).some((s) => s.done)).length,
    volumeKg: Math.round(ex.reduce((t, e) => t + exerciseVolume(e), 0)),
    // once logged, the clock stops at the logged duration
    durationSec: w.gymLoggedAt && w.gymDurationSec != null ? w.gymDurationSec
      : started != null && Number.isFinite(started) ? Math.max(0, Math.round((now - started) / 1000)) : null,
  };
}

/** "0:45", "12:05", "1:02:09". */
export function fmtClock(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** "Rest 2:30", "Rest off". */
export const restLabel = (sec) => (sec > 0 ? `Rest ${fmtClock(sec)}` : 'Rest off');

export const REST_PRESETS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

// ---- session clock, rest timer, stopwatch ------------------------------------------------

/** Start the session clock on the first ticked set (never restarts it). */
export function markStarted(w, now) {
  if (!w.gymStartedAt) w.gymStartedAt = new Date(now).toISOString();
  return w;
}

/** A rest timer: { workoutId, endsAt (ms), totalSec }. */
export function startRest(workoutId, sec, now) {
  if (!(sec > 0)) return null;
  return { workoutId, endsAt: now + sec * 1000, totalSec: sec };
}

/** Seconds left (0 when over). */
export function restRemaining(rest, now) {
  if (!rest) return 0;
  return Math.max(0, Math.ceil((rest.endsAt - now) / 1000));
}

/** Add (or with a negative number, take off) seconds; never below now. */
export function extendRest(rest, by, now) {
  if (!rest) return null;
  const endsAt = Math.max(now, rest.endsAt + by * 1000);
  return { ...rest, endsAt, totalSec: Math.max(1, rest.totalSec + by) };
}

/** A stopwatch on one timed set: { workoutId, ex, set, startedAt (ms) }. */
export function startStopwatch(workoutId, ex, set, now) {
  return { workoutId, ex, set, startedAt: now };
}

export function stopwatchElapsed(sw, now) {
  return sw ? Math.max(0, Math.round((now - sw.startedAt) / 1000)) : 0;
}

// ---- finish -------------------------------------------------------------------------------

/**
 * What Finish (and Save afterwards) writes onto the workout: it completes the
 * session — gym sessions are the one sport that earns XP without Strava —
 * stamps when it was logged and freezes how long it took. Saving again keeps
 * the first duration, so the clock never restarts. Returns null when no
 * working set has been ticked.
 */
export function finishPatch(w, now) {
  const sum = sessionSummary(w, now);
  if (!sum.sets) return null;
  const at = new Date(now).toISOString();
  return {
    completed: true,
    completedAt: w.completedAt || at,
    gymLoggedAt: at,
    gymDurationSec: w.gymLoggedAt && w.gymDurationSec != null ? w.gymDurationSec : sum.durationSec,
  };
}

// ---- guided workout -----------------------------------------------------------------------

/**
 * The order you do the sets in: exercise by exercise, except inside a
 * superset, where you alternate (A1, B1, A2, B2, …). Returns [[ex, set], …].
 */
export function setOrder(exercises) {
  const list = exercises || [];
  const out = [];
  for (let i = 0; i < list.length;) {
    const id = list[i].supersetId;
    let end = i + 1;
    if (id) while (end < list.length && list[end].supersetId === id) end++;
    const group = [];
    for (let k = i; k < end; k++) group.push(k);
    const rounds = Math.max(...group.map((k) => list[k].sets?.length || 0));
    for (let r = 0; r < rounds; r++) for (const k of group) if (r < (list[k].sets?.length || 0)) out.push([k, r]);
    i = end;
  }
  return out;
}

/** The next set to do (the first unticked one in that order), or null when all are done. */
export function nextSet(exercises) {
  const hit = setOrder(exercises).find(([i, j]) => !exercises[i].sets[j].done);
  return hit ? { ex: hit[0], set: hit[1] } : null;
}
