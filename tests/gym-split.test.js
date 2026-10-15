import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPLIT_PRESETS, presetSplit, normalizeSplit, splitWarnings, moveGroup,
  itemsFromNotes, deriveGymExercises, mainSetIsExercises,
} from '../js/core/gym-split.js';
import { normalizeWorkout } from '../js/app/stores/local-store.js';
import { rowToWorkout } from '../js/app/stores/supabase-store.js';

test('six presets, each valid as-is', () => {
  assert.deepEqual(SPLIT_PRESETS.map((p) => p.id), ['full3', 'upper-lower', 'ppl', 'arnold', 'bro5', 'ppl6']);
  for (const p of SPLIT_PRESETS) {
    const s = presetSplit(p.id);
    assert.deepEqual(normalizeSplit(s), s, p.id);
  }
  const a = presetSplit('ppl'); a.days[0].groups.push('Abs');
  assert.ok(!presetSplit('ppl').days[0].groups.includes('Abs'), 'presets are copied, not shared');
});

test('normalize: clamps days, drops unknown groups, names blanks, keeps rest days', () => {
  const s = normalizeSplit({ preset: 'nope', days: [
    { label: '  ', groups: ['Chest', 'Wings', 'Chest'] }, { label: 'Off', rest: true, groups: ['Back'] },
    ...Array.from({ length: 9 }, () => ({ label: 'x', groups: [] })),
  ] });
  assert.equal(s.preset, 'custom');
  assert.equal(s.days.length, 7);
  assert.deepEqual(s.days[0], { label: 'Day 1', groups: ['Chest'] });
  assert.deepEqual(s.days[1], { label: 'Off', groups: [], rest: true });
  assert.deepEqual(normalizeSplit(null), { preset: 'custom', days: [] });
});

test('warnings advise, they never block', () => {
  assert.deepEqual(splitWarnings(presetSplit('full3'), { trainingDays: 5 }), []);
  const ppl6 = splitWarnings(presetSplit('ppl6'), { trainingDays: 4 });
  assert.ok(ppl6.some((w) => /6 gym days, but only 4/.test(w)));
  const bro = splitWarnings({ days: [{ label: 'Chest', groups: ['Chest'] }, { label: 'More chest', groups: ['Chest', 'Triceps'] }] });
  assert.ok(bro.some((w) => /back-to-back/.test(w)));
  assert.ok(bro.some((w) => /No day trains Back, Shoulders, Quads, Hamstrings, Glutes/.test(w)));
  assert.ok(splitWarnings({ days: [{ label: 'Empty', groups: [] }, { label: 'Legs', groups: ['Quads'] }] }).some((w) => /Empty has no muscle/.test(w)));
  assert.deepEqual(splitWarnings({ days: [] }), ['Add at least one training day.']);
});

test('moving a chip between days', () => {
  const s = presetSplit('ppl');
  assert.ok(moveGroup(s, 0, 2, 1)); // Triceps: Push -> Pull
  assert.deepEqual(s.days[0].groups, ['Chest', 'Shoulders']);
  assert.ok(s.days[1].groups.includes('Triceps'));
  assert.ok(!moveGroup(s, 0, 9, 1));
  s.days.push({ label: 'Rest', groups: [], rest: true });
  assert.ok(!moveGroup(s, 0, 0, 3), 'nothing moves onto a rest day');
});

// the AI session from the owner's screenshot, as the function wrote it
const NOTES = '[Warmup] 5min rowing at easy pace, leg swings, walking lunges 2x10 each leg, hip circles [Main Set] Back Squat 4x8 @ RPE 8, Romanian Deadlift 3x10 @ RPE 8, Leg Press 3x12 @ RPE 7, Bulgarian Split Squat 3x10 each leg @ RPE 8, Calf Raise 4x15 @ RPE 7, Hanging Leg Raise 3x12 @ RPE 7 [Cooldown] 5min light stationary bike, foam roll quads, hamstrings, glutes';

test('the main set of an AI session becomes exercises (the warm-up lunges do not)', () => {
  const items = itemsFromNotes(NOTES);
  assert.deepEqual(items.map((x) => [x.name, x.sets, x.reps, x.notes]), [
    ['Back Squat', 4, '8', 'RPE 8'], ['Romanian Deadlift', 3, '10', 'RPE 8'], ['Leg Press', 3, '12', 'RPE 7'],
    ['Bulgarian Split Squat', 3, '10 / leg', 'RPE 8'], ['Calf Raise', 4, '15', 'RPE 7'], ['Hanging Leg Raise', 3, '12', 'RPE 7'],
  ]);
  assert.deepEqual(itemsFromNotes('[Main Set] Plank 3x45s, Farmer carry 4x40m'), [{ name: 'Plank', sets: 3, reps: '45s', notes: '' }]);
  assert.deepEqual(itemsFromNotes('Easy spin, no structure'), []);
});

test('an old AI gym session opens with exercises, art ids and sets, once', () => {
  const row = { id: 'ai1', date: '2026-10-20', type: 'gym', title: 'Gym Lower Hypertrophy', notes: NOTES, exercises: [], extra: { ai: true } };
  const w = rowToWorkout(row);
  assert.equal(w.notesParsed, true);
  assert.deepEqual(w.exercises.map((e) => e.libId), ['back-squat', 'romanian-deadlift', 'leg-press', 'bulgarian-split-squat', 'standing-calf-raise', null]);
  assert.equal(w.exercises[0].sets.length, 4);
  assert.equal(w.exercises[0].sets[0].reps, 8);
  assert.equal(w.exercises[3].note, 'per leg · RPE 8');
  assert.ok(mainSetIsExercises(w));
  // stable: reading again changes nothing; deleting them all doesn't bring them back
  assert.deepEqual(normalizeWorkout(w).exercises, w.exercises);
  assert.equal(deriveGymExercises({ ...w, exercises: [] }).exercises.length, 0);
  // non-gym and sessions that already have exercises are left alone
  const run = { id: 'r', type: 'run', notes: NOTES, exercises: [] };
  assert.equal(deriveGymExercises(run), run);
  const local = normalizeWorkout({ id: 'l', date: '2026-10-20', type: 'gym', notes: NOTES, exercises: [] });
  assert.equal(local.exercises.length, 6);
});

// ---- the ai-plan Edge Function's gym helpers (plain JS, shared with Deno) ----
import { EXERCISES } from '../js/core/exercises.js';
import { EXERCISE_LIBRARY } from '../supabase/functions/ai-plan/exercise-library.js';
import { sanitizeExercises, splitPrompt, libraryPromptLines } from '../supabase/functions/ai-plan/gym.js';
import { upgradeExercises } from '../js/core/sets.js';

test('the function’s library copy matches js/core/exercises.js (run tools/gen-ai-library.mjs)', () => {
  assert.deepEqual(EXERCISE_LIBRARY, EXERCISES.map(({ id, name, muscle, equipment }) => ({ id, name, muscle, equipment })));
  assert.equal(libraryPromptLines().split('\n').length, EXERCISES.length);
});

test('model exercises are validated and clamped, and open in the logger', () => {
  const out = sanitizeExercises([
    { id: 'back-squat', name: 'whatever', sets: 4, reps: '6-8', rpe: 8.2 },
    { id: 'made-up-id', name: 'Hanging Leg Raise', sets: 99, reps: 'max', rpe: 15 },
    { id: null, name: '', sets: 3 },
    'junk',
    { id: 'bulgarian-split-squat', sets: '3', reps: '10 / leg' },
    { id: 'copenhagen-plank', sets: 3, reps: '30s', rpe: null },
  ]);
  assert.deepEqual(out, [
    { libId: 'back-squat', name: 'Back Squat', sets: 4, reps: '6-8', notes: 'RPE 8' },
    { libId: null, name: 'Hanging Leg Raise', sets: 10, reps: '8', notes: 'RPE 10' },
    { libId: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', sets: 3, reps: '10 / leg', notes: '' },
    { libId: 'copenhagen-plank', name: 'Copenhagen Plank', sets: 3, reps: '30s', notes: '' },
  ]);
  assert.deepEqual(sanitizeExercises(null), []);
  const ex = upgradeExercises(out);
  assert.deepEqual(ex.map((e) => [e.libId, e.sets.length, e.kind]), [
    ['back-squat', 4, 'weight_reps'], [null, 10, 'weight_reps'], ['bulgarian-split-squat', 3, 'weight_reps'], ['copenhagen-plank', 3, 'time']]);
  assert.equal(ex[0].note, '6–8 reps · RPE 8');
});

test('the split reads as plain instructions; no split, no text', () => {
  const text = splitPrompt({ days: [{ label: 'Push', groups: ['Chest', 'Triceps'] }, { label: 'Off', rest: true, groups: [] }] });
  assert.match(text, /Day 1 "Push": Chest, Triceps/);
  assert.match(text, /Day 2: rest from the gym/);
  assert.equal(splitPrompt(null), '');
  assert.equal(splitPrompt({ days: [] }), '');
});

test('an AI plan only holds the disciplines the athlete picked', async () => {
  const { allowedTypes } = await import('../supabase/functions/ai-plan/rules.js');
  const ALL = ['run', 'bike', 'swim', 'gym', 'brick', 'mobility', 'other'];
  assert.deepEqual(allowedTypes(['Running'], ALL), ['run']);
  assert.deepEqual(allowedTypes(['Gym'], ALL), ['gym']);
  assert.deepEqual(allowedTypes(['Swimming', 'Cycling', 'Running', 'Gym'], ALL).sort(), ['bike', 'brick', 'gym', 'run', 'swim']);
  assert.deepEqual(allowedTypes([], ALL), ALL);
  assert.deepEqual(allowedTypes(undefined, ALL), ALL);
});
