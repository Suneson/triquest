// sets.js — the gym exercise model and the migration to it. Pure; no DOM.
//
// An exercise in a workout holds its own sets:
//   { id, libId, name, equipment, muscle, kind, restSec, note,
//     sets: [ { kind, weight, reps, seconds, done, doneAt, rpe } ] }
// exercise.kind: weight_reps | bodyweight | time | distance
// set.kind:      warmup | work | drop | failure
//
// Older data stored one prescription per exercise:
//   { name, sets: 4, reps: '8', weight, actualReps, rpe, done, notes, imageUrl }
// upgradeExercises() turns that into the new shape and leaves new-shape
// exercises untouched, so it's safe to run on every read (local storage,
// Supabase rows from another device, the seed plan, an import).

import { matchExercise, exerciseById } from './exercises.js';

export const SET_KINDS = ['warmup', 'work', 'drop', 'failure'];

/** A blank set. */
export function newSet(kind = 'work', fields = {}) {
  return { kind, weight: null, reps: null, seconds: null, done: false, doneAt: null, rpe: null, ...fields };
}

/** New shape = `sets` is an array. */
export const isUpgraded = (e) => !!e && Array.isArray(e.sets);

const num = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const slug = (s) => String(s || 'exercise').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'exercise';

/**
 * Read an old free-text prescription: "8", "6–8", "8 / leg", "20 s / side",
 * "45s", "1 min". Returns the number to log against plus whatever the text
 * said beyond it, which is kept as the exercise's note.
 */
export function parsePrescription(text) {
  const t = String(text ?? '').trim();
  if (!t) return { reps: null, seconds: null, note: '' };
  const per = /\/\s*(leg|side|arm)\b/i.exec(t);
  const perNote = per ? `per ${per[1].toLowerCase()}` : '';
  const time = /(\d+(?:[.,]\d+)?)\s*(s|sec|secs|seconds|min|mins|minutes)\b/i.exec(t);
  if (time) {
    const v = Number(time[1].replace(',', '.'));
    const seconds = /^m/i.test(time[2]) ? Math.round(v * 60) : Math.round(v);
    return { reps: null, seconds, note: perNote };
  }
  const range = /(\d+)\s*[–-]\s*(\d+)/.exec(t);
  if (range) return { reps: Number(range[1]), seconds: null, note: [`${range[1]}–${range[2]} reps`, perNote].filter(Boolean).join(', ') };
  const n = /(\d+)/.exec(t);
  return { reps: n ? Number(n[1]) : null, seconds: null, note: perNote };
}

/** Upgrade one old-shape exercise (index `i` in its workout). New-shape input is returned as is. */
export function upgradeExercise(e, i = 0) {
  if (!e || typeof e !== 'object') return e;
  if (isUpgraded(e)) return e;
  const name = String(e.name ?? '').trim();
  const libId = e.libId || matchExercise(name);
  const lib = exerciseById(libId);
  const p = parsePrescription(e.reps);
  const count = Math.max(1, Math.min(20, Math.round(Number(e.sets)) || 1));
  const kind = p.seconds != null ? 'time' : (lib?.defaultKind || 'weight_reps');
  const sets = Array.from({ length: count }, () => newSet('work', { reps: p.reps, seconds: p.seconds }));
  // what was logged against the old single row belongs to the first set
  const first = sets[0];
  const w = num(e.weight);
  const ar = num(e.actualReps);
  const rpe = num(e.rpe);
  if (w != null) first.weight = w;
  if (ar != null) { if (kind === 'time') first.seconds = ar; else first.reps = ar; }
  if (rpe != null) first.rpe = rpe;
  if (e.done) sets.forEach((s) => { s.done = true; });
  const note = [p.note, String(e.notes ?? '').trim()].filter(Boolean).join(' · ');
  const out = {
    id: e.id || `ex${i + 1}-${slug(name)}`,
    libId: libId || null,
    name,
    equipment: e.equipment || lib?.equipment || null,
    muscle: e.muscle || lib?.muscle || null,
    kind,
    restSec: Number.isFinite(+e.restSec) && e.restSec !== '' && e.restSec != null ? +e.restSec : (lib?.defaultRestSec ?? 90),
    note,
    sets,
  };
  if (e.imageUrl) out.imageUrl = e.imageUrl; // a custom picture the athlete added
  return out;
}

/** Upgrade a workout's exercise list. Idempotent; non-arrays become []. */
export function upgradeExercises(list) {
  if (!Array.isArray(list)) return [];
  let changed = false;
  const out = list.map((e, i) => {
    const u = upgradeExercise(e, i);
    if (u !== e) changed = true;
    return u;
  });
  return changed ? out : list;
}

/** Work sets only (warm-ups don't count toward volume or the prescription). */
export const workSets = (ex) => (ex?.sets || []).filter((s) => s.kind !== 'warmup');

// the value most work sets share (ties go to the earliest), so one logged set
// that came up short doesn't rewrite the plan's "4×8"
function commonValue(sets, field) {
  const counts = new Map();
  for (const s of sets) if (s[field] != null) counts.set(s[field], (counts.get(s[field]) || 0) + 1);
  let best = null; let n = 0;
  for (const [v, c] of counts) if (c > n) { best = v; n = c; }
  return best;
}

/** A short prescription for display: "4×8", "3×20s", "3 sets". */
export function prescription(ex) {
  const ws = workSets(ex);
  if (!ws.length) return '';
  const seconds = commonValue(ws, 'seconds');
  if (ex.kind === 'time' && seconds != null) return `${ws.length}×${seconds}s`;
  const reps = commonValue(ws, 'reps');
  if (reps != null) return `${ws.length}×${reps}`;
  return `${ws.length} sets`;
}
