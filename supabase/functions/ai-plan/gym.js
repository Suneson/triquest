// gym.js — what the ai-plan function asks for and accepts for gym sessions.
// Plain ES module so both the Edge Function (Deno) and the Node tests load it.
//
// The model returns, per gym session, "exercises": [{ id, name, sets, reps,
// rpe }]. Everything is checked and clamped here (like `power` for bikes);
// the rows are written in the classic { libId, name, sets, reps, notes }
// shape, which the current app upgrades into sets on read and the older app
// still shows as a list.

import { EXERCISE_LIBRARY } from './exercise-library.js';

const IDS = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e]));
const REPS = /^\d{1,3}(\s*[-–]\s*\d{1,3})?\s*(s|sec|secs|seconds|min)?(\s*\/\s*(leg|side|arm))?$/i;

/** One line per library exercise, for the system prompt. */
export function libraryPromptLines() {
  return EXERCISE_LIBRARY.map((e) => `${e.id} = ${e.name} (${e.muscle}, ${e.equipment})`).join('\n');
}

/** The split as plain sentences for the user prompt, or '' when there is none. */
export function splitPrompt(split) {
  const days = Array.isArray(split?.days) ? split.days.slice(0, 7) : [];
  if (!days.length) return '';
  const lines = days.map((d, i) => (d?.rest
    ? `Day ${i + 1}: rest from the gym`
    : `Day ${i + 1} "${String(d?.label || `Day ${i + 1}`).slice(0, 24)}": ${(Array.isArray(d?.groups) ? d.groups : []).slice(0, 12).join(', ') || 'any'}`));
  return `GYM SPLIT (the athlete built this; follow it): rotate through these days in order across the gym sessions of each week, and pick exercises that train the listed muscle groups.\n${lines.join('\n')}`;
}

/** Validate and clamp the model's exercises for one gym session. */
export function sanitizeExercises(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const x of list.slice(0, 10)) {
    if (!x || typeof x !== 'object') continue;
    const lib = IDS.get(String(x.id ?? x.libId ?? '').trim());
    const name = String(lib?.name || x.name || '').trim().slice(0, 60);
    if (!name) continue;
    const sets = Math.max(1, Math.min(10, parseInt(x.sets) || 3));
    let reps = String(x.reps ?? '').trim().slice(0, 16);
    if (!REPS.test(reps)) reps = String(parseInt(reps) || 8);
    const rpe = Number(x.rpe);
    const notes = Number.isFinite(rpe) && rpe > 0 ? `RPE ${Math.max(5, Math.min(10, Math.round(rpe * 2) / 2))}` : '';
    out.push({ libId: lib ? lib.id : null, name, sets, reps, notes });
  }
  return out;
}
