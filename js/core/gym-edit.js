// gym-edit.js — choosing and arranging exercises. Pure; no DOM.
//
//   - the picker: the library plus the athlete's own exercises, searched by
//     name or alias, filtered by equipment and muscle, recents first, grouped
//     by muscle
//   - custom exercises ("Create exercise"), kept in settings.customExercises
//   - turning a picked entry into a logged exercise with blank sets
//   - reordering, supersets (exercises sharing a `supersetId`) and the rest
//     rule inside a superset
//   - routines: a saved list of exercises (settings.routines) that starts a
//     new gym session

import { EXERCISES, MUSCLES, EQUIPMENT, EXERCISE_KINDS, normName } from './exercises.js';
import { newSet } from './sets.js';

// ---- the catalogue ------------------------------------------------------------------------

/** Library entries plus the athlete's custom ones (custom first wins nothing: ids never clash). */
export function catalogue(custom = []) {
  return [...EXERCISES, ...(Array.isArray(custom) ? custom : [])];
}

export function entryById(id, custom = []) {
  return catalogue(custom).find((e) => e.id === id) || null;
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'exercise';

/**
 * A custom exercise from the "Create exercise" form. Returns { entry } or
 * { error } (name missing, or a name that already exists).
 */
export function makeCustomExercise({ name, equipment, muscle, kind } = {}, custom = []) {
  const clean = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!clean) return { error: 'Give it a name.' };
  const all = catalogue(custom);
  const key = normName(clean);
  if (all.some((e) => normName(e.name) === key)) return { error: 'That exercise already exists.' };
  let id = `custom-${slug(clean)}`;
  for (let n = 2; all.some((e) => e.id === id); n++) id = `custom-${slug(clean)}-${n}`;
  return {
    entry: {
      id,
      name: clean,
      equipment: EQUIPMENT.includes(equipment) ? equipment : 'Other',
      muscle: MUSCLES.includes(muscle) ? muscle : 'Full body',
      secondary: [],
      defaultKind: EXERCISE_KINDS.includes(kind) ? kind : 'weight_reps',
      defaultRestSec: kind === 'time' ? 60 : 90,
      cues: [],
      aliases: [],
      custom: true,
    },
  };
}

/**
 * Search the catalogue. Every word of the query must start a word of the
 * name or of an alias ("db ben" finds Dumbbell Bench Press). Name matches
 * rank above alias matches, and earlier matches above later ones.
 */
export function searchExercises(list, { q = '', equipment = '', muscle = '' } = {}) {
  const words = normName(q).split(' ').filter(Boolean);
  const hits = [];
  for (const e of list) {
    if (equipment && e.equipment !== equipment) continue;
    if (muscle && e.muscle !== muscle && !(e.secondary || []).includes(muscle)) continue;
    if (!words.length) { hits.push({ e, score: 0 }); continue; }
    const score = Math.min(rank(words, e.name, 0), ...(e.aliases || []).map((a) => rank(words, a, 100)));
    if (score < Infinity) hits.push({ e, score });
  }
  return hits.sort((a, b) => a.score - b.score || a.e.name.localeCompare(b.e.name)).map((h) => h.e);
}

function rank(words, text, base) {
  const tw = normName(text).split(' ');
  let first = Infinity;
  for (const w of words) {
    const at = tw.findIndex((t) => t.startsWith(w));
    if (at < 0) return Infinity;
    first = Math.min(first, at);
  }
  return base + first * 10 + (normName(text).startsWith(words.join(' ')) ? 0 : 5);
}

/** Library ids of the exercises you logged most recently, newest first. */
export function recentIds(workouts, limit = 8) {
  const seen = new Map();
  for (const w of workouts || []) {
    for (const e of w.exercises || []) {
      if (!e.libId || !Array.isArray(e.sets)) continue;
      const stamp = e.sets.filter((s) => s.done).map((s) => s.doneAt || w.date).sort().pop();
      if (!stamp) continue;
      if (!seen.has(e.libId) || seen.get(e.libId) < stamp) seen.set(e.libId, stamp);
    }
  }
  return [...seen.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1)).slice(0, limit).map(([id]) => id);
}

/** [{ muscle, items }] in the app's muscle order, empty groups left out. */
export function groupByMuscle(list) {
  const order = [...MUSCLES];
  const groups = new Map();
  for (const e of list) {
    const m = order.includes(e.muscle) ? e.muscle : 'Full body';
    if (!groups.has(m)) groups.set(m, []);
    groups.get(m).push(e);
  }
  return order.filter((m) => groups.has(m)).map((m) => ({ muscle: m, items: groups.get(m) }));
}

// ---- building exercises ---------------------------------------------------------------------

let seq = 0;
const uid = (now) => `ex-${now.toString(36)}-${(seq++).toString(36)}`;

/** A logged exercise from a catalogue entry: three blank work sets. */
export function exerciseFromEntry(entry, now = Date.now(), { sets = 3 } = {}) {
  const timed = entry.defaultKind === 'time' || entry.defaultKind === 'distance';
  return {
    id: uid(now),
    libId: entry.id,
    name: entry.name,
    equipment: entry.equipment || null,
    muscle: entry.muscle || null,
    kind: entry.defaultKind || 'weight_reps',
    restSec: entry.defaultRestSec ?? 90,
    note: '',
    sets: Array.from({ length: sets }, () => newSet('work', timed ? { seconds: 30 } : { reps: 8 })),
  };
}

/** Swap an exercise for another entry, keeping how many sets it had (blank). */
export function replaceExercise(ex, entry, now = Date.now()) {
  const fresh = exerciseFromEntry(entry, now, { sets: Math.max(1, ex.sets?.length || 3) });
  return { ...fresh, id: ex.id, supersetId: ex.supersetId, note: ex.note || '' };
}

// ---- order and supersets ------------------------------------------------------------------

/** Move item `from` to index `to` (in place). Returns whether anything moved. */
export function moveItem(list, from, to) {
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return false;
  const [x] = list.splice(from, 1);
  list.splice(to, 0, x);
  return true;
}

/** Superset exercise i with the one after it (joins an existing group if either has one). */
export function linkWithNext(list, i, now = Date.now()) {
  const a = list[i]; const b = list[i + 1];
  if (!a || !b) return false;
  const id = a.supersetId || b.supersetId || `ss-${now.toString(36)}`;
  const old = b.supersetId && b.supersetId !== id ? b.supersetId : null;
  a.supersetId = id; b.supersetId = id;
  if (old) list.forEach((e) => { if (e.supersetId === old) e.supersetId = id; });
  return true;
}

/** Take exercise i out of its superset; a group left with one exercise dissolves. */
export function unlinkSuperset(list, i) {
  const ex = list[i];
  if (!ex?.supersetId) return false;
  const id = ex.supersetId;
  delete ex.supersetId;
  cleanSupersets(list, id);
  return true;
}

/**
 * Supersets only hold exercises that sit next to each other. After a move or
 * a removal, split a group wherever something else got in between, and drop
 * groups of one.
 */
export function cleanSupersets(list) {
  for (let i = 0; i < list.length; i++) {
    const id = list[i].supersetId;
    if (!id) continue;
    const prevSame = i > 0 && list[i - 1].supersetId === id;
    const nextSame = i < list.length - 1 && list[i + 1].supersetId === id;
    if (!prevSame && !nextSame) delete list[i].supersetId;
  }
  // a group interrupted by another exercise keeps only its first run
  const seenRun = new Map();
  for (let i = 0; i < list.length; i++) {
    const id = list[i].supersetId;
    if (!id) continue;
    const startsRun = i === 0 || list[i - 1].supersetId !== id;
    if (startsRun && seenRun.has(id)) {
      const fresh = `${id}-${i}`;
      for (let k = i; k < list.length && list[k].supersetId === id; k++) list[k].supersetId = fresh;
    } else if (startsRun) seenRun.set(id, true);
  }
  return list;
}

/** Per exercise: null, or { letter: 'A', first, last } for its superset. */
export function supersetInfo(list) {
  const letters = new Map();
  return list.map((e, i) => {
    if (!e.supersetId) return null;
    if (!letters.has(e.supersetId)) letters.set(e.supersetId, String.fromCharCode(65 + letters.size));
    return {
      letter: letters.get(e.supersetId),
      first: i === 0 || list[i - 1].supersetId !== e.supersetId,
      last: i === list.length - 1 || list[i + 1].supersetId !== e.supersetId,
    };
  });
}

/**
 * Rest after ticking a set of exercise i: none between exercises of a
 * superset (you go straight to the next one); after the last one, its rest.
 */
export function restAfterTick(list, i) {
  const ex = list[i];
  if (!ex) return 0;
  const info = supersetInfo(list)[i];
  if (info && !info.last) return 0;
  return ex.restSec || 0;
}

// ---- routines ------------------------------------------------------------------------------

/** A routine from a session: its exercises with the numbers kept and every tick cleared. */
export function routineFromWorkout(w, name, now = Date.now()) {
  const clean = String(name ?? '').trim().slice(0, 60) || w.title || 'Routine';
  return {
    id: `rt-${now.toString(36)}`,
    name: clean,
    exercises: (w.exercises || []).map((e) => ({
      ...e,
      sets: (e.sets || []).map((s) => ({ ...s, done: false, doneAt: null, rpe: null })),
    })),
    updatedAt: new Date(now).toISOString(),
  };
}

/** A new gym session on `date` from a routine (fresh exercise ids, nothing ticked). */
export function workoutFromRoutine(rt, { id, date, now = Date.now() }) {
  const remap = new Map();
  const exercises = (rt.exercises || []).map((e) => {
    const out = { ...e, id: uid(now), sets: (e.sets || []).map((s) => ({ ...s, done: false, doneAt: null })) };
    if (e.supersetId) {
      if (!remap.has(e.supersetId)) remap.set(e.supersetId, `ss-${now.toString(36)}-${remap.size}`);
      out.supersetId = remap.get(e.supersetId);
    }
    return out;
  });
  return {
    id, date, type: 'gym', title: rt.name, intensity: 'moderate',
    durationMin: Math.max(20, Math.min(120, exercises.reduce((t, e) => t + e.sets.length * 3, 0))),
    completed: false, completedAt: null, metrics: {}, segments: [], exercises, packing: [], notes: '',
    seeded: false, deload: false, isRace: false, source: 'custom', strava_activity_id: null, routineId: rt.id,
  };
}

/** Add or replace (same name, case-insensitive) a routine in the list. */
export function saveRoutine(routines, rt) {
  const list = Array.isArray(routines) ? routines.filter((r) => normName(r.name) !== normName(rt.name)) : [];
  return [...list, rt].sort((a, b) => a.name.localeCompare(b.name));
}
