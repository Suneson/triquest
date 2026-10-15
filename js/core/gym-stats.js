// gym-stats.js — what your logged sets add up to. Pure; no DOM.
//
//   - per-exercise history: every session you ticked sets in, with its best
//     set, estimated 1RM and volume
//   - records (heaviest weight, best estimated 1RM, most reps, longest hold,
//     best session volume) and whether a set you just ticked beat one
//   - weekly working sets per muscle, and the muscle balance of the last
//     four weeks — described, never prescribed
//
// Only ticked, non-warm-up sets count. The 1RM is an estimate (Epley:
// weight × (1 + reps / 30)) and only for 1–12 reps, where it's reasonable.

import { workSets } from './sets.js';
import { sameExercise } from './gym-log.js';
import { MUSCLES, muscleLabel } from './exercises.js';
import { addDays, diffDays, weekdayMon0 } from './dates.js';
import { t, fmtNum } from './i18n.js';

export const E1RM_MAX_REPS = 12;

/** Epley estimated one-rep max, or null outside 1–12 reps / no weight. */
export function e1rm(weight, reps) {
  if (!(weight > 0) || !(reps >= 1) || reps > E1RM_MAX_REPS) return null;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

const doneWork = (ex) => workSets(ex).filter((s) => s.done);
const setVolume = (s) => (s.weight > 0 && s.reps > 0 ? s.weight * s.reps : 0);

/** The set that best represents a session: top e1RM, else most reps, else longest. */
export function bestSet(sets, kind = 'weight_reps') {
  let best = null; let score = -1;
  for (const s of sets || []) {
    const v = kind === 'time' || kind === 'distance' ? (s.seconds || 0)
      : (e1rm(s.weight, s.reps) ?? 0) * 1000 + (s.weight || 0) + (s.reps || 0) / 1000;
    if (v > score) { score = v; best = s; }
  }
  return best;
}

/**
 * Every session in which you ticked work sets of this exercise, oldest first:
 * [{ date, workoutId, sets, best, e1rm, volume }].
 */
export function exerciseHistory(workouts, key) {
  const out = [];
  for (const w of workouts || []) {
    for (const ex of w.exercises || []) {
      if (!sameExercise(ex, key) || !Array.isArray(ex.sets)) continue;
      const sets = doneWork(ex);
      if (!sets.length) continue;
      const best = bestSet(sets, ex.kind);
      const top = Math.max(0, ...sets.map((s) => e1rm(s.weight, s.reps) ?? 0));
      out.push({
        date: w.date, workoutId: w.id, kind: ex.kind, sets, best,
        e1rm: top || null,
        volume: Math.round(sets.reduce((sum, s) => sum + setVolume(s), 0)),
      });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** All-time records from a history (each with the date it was set). */
export function exerciseRecords(history) {
  const r = { heaviest: null, e1rm: null, reps: null, time: null, volume: null };
  for (const h of history) {
    for (const s of h.sets) {
      if (s.weight > 0 && (!r.heaviest || s.weight > r.heaviest.weight)) r.heaviest = { weight: s.weight, reps: s.reps, date: h.date };
      const est = e1rm(s.weight, s.reps);
      if (est && (!r.e1rm || est > r.e1rm.value)) r.e1rm = { value: est, weight: s.weight, reps: s.reps, date: h.date };
      if (s.reps > 0 && !(s.weight > 0) && (!r.reps || s.reps > r.reps.reps)) r.reps = { reps: s.reps, date: h.date };
      if (s.seconds > 0 && (!r.time || s.seconds > r.time.seconds)) r.time = { seconds: s.seconds, date: h.date };
    }
    if (h.volume > 0 && (!r.volume || h.volume > r.volume.value)) r.volume = { value: h.volume, date: h.date };
  }
  return r;
}

/**
 * Which records does set `j` of exercise `i` in workout `w` beat? Compared
 * with every other ticked work set of that exercise, here and in other
 * sessions. Your very first sets of an exercise set no records (nothing to
 * beat yet). Returns [] or a list of { type, value, label }.
 */
export function detectPRs(workouts, w, i, j) {
  const ex = w?.exercises?.[i];
  const s = ex?.sets?.[j];
  if (!s || !s.done || s.kind === 'warmup') return [];
  const others = [];
  for (const x of workouts || []) {
    const list = x.id === w.id ? w.exercises : x.exercises;
    (list || []).forEach((e, k) => {
      if (!sameExercise(e, ex) || !Array.isArray(e.sets)) return;
      doneWork(e).forEach((o) => { if (!(x.id === w.id && k === i && o === s)) others.push(o); });
    });
  }
  if (!others.length) return [];
  const out = [];
  const max = (f) => Math.max(0, ...others.map(f).filter((v) => v != null));
  if (s.weight > 0 && s.weight > max((o) => o.weight)) out.push({ type: 'weight', value: s.weight, label: t('stats.heaviest', { v: fmtNum(s.weight) }) });
  const est = e1rm(s.weight, s.reps);
  if (est && est > max((o) => e1rm(o.weight, o.reps))) out.push({ type: 'e1rm', value: est, label: t('stats.e1rm', { v: fmtNum(est) }) });
  if (!(s.weight > 0) && s.reps > 0 && s.reps > max((o) => (o.weight > 0 ? null : o.reps))) out.push({ type: 'reps', value: s.reps, label: t('stats.mostReps', { v: s.reps }) });
  if (s.seconds > 0 && s.seconds > max((o) => o.seconds)) out.push({ type: 'time', value: s.seconds, label: t('stats.longest', { v: s.seconds }) });
  return out;
}

/**
 * One line per exercise you've logged, with its headline record, most recent
 * record first: [{ key: { libId, name }, name, kind, headline, date }].
 */
export function recordsShelf(workouts, limit = 8) {
  const seen = new Map();
  for (const w of workouts || []) {
    for (const ex of w.exercises || []) {
      if (!Array.isArray(ex.sets) || !doneWork(ex).length) continue;
      const k = ex.libId || `name:${String(ex.name).toLowerCase()}`;
      if (!seen.has(k)) seen.set(k, { libId: ex.libId || null, name: ex.name, kind: ex.kind });
    }
  }
  const rows = [];
  for (const key of seen.values()) {
    const rec = exerciseRecords(exerciseHistory(workouts, key));
    const pick = rec.e1rm ? { text: `${fmtNum(rec.e1rm.value)} kg`, sub: t('stats.subE1rm'), date: rec.e1rm.date }
      : rec.heaviest ? { text: `${fmtNum(rec.heaviest.weight)} kg`, sub: t('stats.subHeaviest'), date: rec.heaviest.date }
        : rec.time ? { text: `${rec.time.seconds} s`, sub: t('stats.subLongest'), date: rec.time.date }
          : rec.reps ? { text: t('stats.repsN', { n: rec.reps.reps }), sub: t('stats.subReps'), date: rec.reps.date } : null;
    if (pick) rows.push({ key, name: key.name, kind: key.kind, headline: pick, date: pick.date });
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.name.localeCompare(b.name))).slice(0, limit);
}

// ---- muscles --------------------------------------------------------------------------------

const mondayOf = (iso) => addDays(iso, -weekdayMon0(iso));

/**
 * Working sets per week per muscle for the `weeks` weeks ending this week:
 * [{ weekStart, total, byMuscle: { Chest: 9, ... } }], oldest first.
 * A set counts for the exercise's main muscle.
 */
export function weeklyMuscleSets(workouts, today, weeks = 8) {
  const thisWeek = mondayOf(today);
  const out = Array.from({ length: weeks }, (_, i) => ({ weekStart: addDays(thisWeek, -7 * (weeks - 1 - i)), total: 0, byMuscle: {} }));
  for (const w of workouts || []) {
    if (!w.date || w.date > today) continue;
    const idx = weeks - 1 - Math.floor(diffDays(thisWeek, mondayOf(w.date)) / 7);
    if (idx < 0 || idx >= weeks) continue;
    for (const ex of w.exercises || []) {
      if (!Array.isArray(ex.sets)) continue;
      const n = doneWork(ex).length;
      if (!n) continue;
      const m = MUSCLES.includes(ex.muscle) ? ex.muscle : 'Full body';
      out[idx].byMuscle[m] = (out[idx].byMuscle[m] || 0) + n;
      out[idx].total += n;
    }
  }
  return out;
}

/**
 * Working sets per muscle over the last `days` days, biggest first:
 * { total, rows: [{ muscle, sets, share }], untrained: [muscles with none] }.
 * Cardio and full-body work is left out of the balance.
 */
export function muscleBalance(workouts, today, days = 28) {
  const from = addDays(today, -(days - 1));
  const counts = {};
  for (const w of workouts || []) {
    if (!w.date || w.date < from || w.date > today) continue;
    for (const ex of w.exercises || []) {
      if (!Array.isArray(ex.sets)) continue;
      const n = doneWork(ex).length;
      if (!n || ex.muscle === 'Cardio' || ex.muscle === 'Full body' || !MUSCLES.includes(ex.muscle)) continue;
      counts[ex.muscle] = (counts[ex.muscle] || 0) + n;
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const rows = Object.entries(counts).map(([muscle, sets]) => ({ muscle, sets, share: total ? sets / total : 0 }))
    .sort((a, b) => b.sets - a.sets || MUSCLES.indexOf(a.muscle) - MUSCLES.indexOf(b.muscle));
  const untrained = MUSCLES.filter((m) => m !== 'Cardio' && m !== 'Full body' && !counts[m]);
  return { total, rows, untrained };
}

/** A plain description of the balance: what happened, no advice. */
export function describeBalance(bal) {
  if (!bal.total) return t('stats.noSets');
  const top = bal.rows[0];
  const parts = [t('stats.balance', { total: bal.total, muscle: muscleLabel(top.muscle), pct: Math.round(top.share * 100) })];
  if (bal.untrained.length && bal.untrained.length <= 4) parts.push(t('stats.noneFor', { list: listJoin(bal.untrained.map(muscleLabel)) }));
  else if (bal.untrained.length) parts.push(t('stats.groupsNoSets', { n: bal.untrained.length }));
  return parts.join(' ');
}

const listJoin = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} ${t('stats.or')} ${a.at(-1)}`);
