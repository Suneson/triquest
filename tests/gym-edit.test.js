import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../js/core/exercises.js';
import { newSet } from '../js/core/sets.js';
import {
  catalogue, entryById, makeCustomExercise, searchExercises, recentIds, groupByMuscle,
  exerciseFromEntry, replaceExercise, moveItem, linkWithNext, unlinkSuperset, cleanSupersets,
  supersetInfo, restAfterTick, routineFromWorkout, workoutFromRoutine, saveRoutine,
} from '../js/core/gym-edit.js';

const T0 = Date.parse('2026-10-14T10:00:00Z');
const ids = (list) => list.map((e) => e.id);

test('custom exercises: validated, unique, folded into the catalogue', () => {
  assert.deepEqual(makeCustomExercise({ name: '  ' }), { error: 'Give it a name.' });
  assert.deepEqual(makeCustomExercise({ name: 'back squat' }), { error: 'That exercise already exists.' });
  const { entry } = makeCustomExercise({ name: 'Zercher Squat', equipment: 'Barbell', muscle: 'Quads', kind: 'weight_reps' });
  assert.equal(entry.id, 'custom-zercher-squat');
  assert.equal(entry.custom, true);
  const odd = makeCustomExercise({ name: 'Sled push', equipment: 'Spaceship', muscle: 'Toes', kind: 'nope' }).entry;
  assert.deepEqual([odd.equipment, odd.muscle, odd.defaultKind], ['Other', 'Full body', 'weight_reps']);
  const custom = [entry];
  assert.equal(catalogue(custom).length, EXERCISES.length + 1);
  assert.equal(entryById('custom-zercher-squat', custom).name, 'Zercher Squat');
  assert.deepEqual(makeCustomExercise({ name: 'zercher squat!' }, custom), { error: 'That exercise already exists.' });
});

test('search: word prefixes over names and aliases, names first; filters narrow', () => {
  const all = catalogue();
  assert.equal(searchExercises(all, { q: 'db ben' })[0].id, 'dumbbell-bench-press');
  assert.equal(searchExercises(all, { q: 'bench' })[0].id, 'barbell-bench-press', 'a name that starts with the query ranks first');
  assert.ok(ids(searchExercises(all, { q: 'rdl' })).includes('romanian-deadlift'), 'aliases count');
  assert.ok(ids(searchExercises(all, { q: 'pec deck' })).includes('machine-chest-fly'));
  assert.deepEqual(searchExercises(all, { q: 'zzz' }), []);
  const machines = searchExercises(all, { equipment: 'Machine' });
  assert.ok(machines.length > 5 && machines.every((e) => e.equipment === 'Machine'));
  const chestMachines = searchExercises(all, { equipment: 'Machine', muscle: 'Chest' });
  assert.ok(chestMachines.every((e) => e.equipment === 'Machine' && (e.muscle === 'Chest' || e.secondary.includes('Chest'))));
  assert.ok(ids(searchExercises(all, { muscle: 'Triceps' })).includes('chest-dip'), 'secondary muscle counts');
});

test('recents: newest logged first, planned-only exercises ignored', () => {
  const ex = (libId, at) => ({ libId, sets: [newSet('work', at ? { done: true, doneAt: at } : {})] });
  const workouts = [
    { date: '2026-10-01', exercises: [ex('back-squat', '2026-10-01T10:00:00Z'), ex('pull-up', null)] },
    { date: '2026-10-08', exercises: [ex('deadlift', '2026-10-08T10:00:00Z'), ex('back-squat', '2026-10-08T09:00:00Z')] },
  ];
  assert.deepEqual(recentIds(workouts), ['deadlift', 'back-squat']);
  assert.deepEqual(recentIds(workouts, 1), ['deadlift']);
});

test('grouping follows the muscle order', () => {
  const groups = groupByMuscle(catalogue());
  assert.equal(groups[0].muscle, 'Chest');
  assert.equal(groups.reduce((n, g) => n + g.items.length, 0), EXERCISES.length);
});

test('a picked entry becomes an exercise with blank sets; replace keeps the set count', () => {
  const e = exerciseFromEntry(entryById('back-squat'), T0);
  assert.deepEqual([e.libId, e.kind, e.restSec, e.sets.length, e.sets[0].reps, e.sets[0].done], ['back-squat', 'weight_reps', 180, 3, 8, false]);
  const plank = exerciseFromEntry(entryById('copenhagen-plank'), T0);
  assert.deepEqual([plank.kind, plank.sets[0].seconds, plank.sets[0].reps], ['time', 30, null]);
  assert.notEqual(exerciseFromEntry(entryById('back-squat'), T0).id, e.id, 'ids are unique');
  const old = { ...e, supersetId: 'ss1', note: 'belt', sets: [newSet(), newSet(), newSet(), newSet()] };
  const r = replaceExercise(old, entryById('box-squat'), T0);
  assert.deepEqual([r.id, r.libId, r.sets.length, r.supersetId, r.note], [e.id, 'box-squat', 4, 'ss1', 'belt']);
});

test('move', () => {
  const l = ['a', 'b', 'c', 'd'];
  assert.ok(moveItem(l, 0, 2));
  assert.deepEqual(l, ['b', 'c', 'a', 'd']);
  assert.ok(!moveItem(l, 1, 1));
  assert.ok(!moveItem(l, 0, 9));
});

test('supersets: link, letters, rest only after the last, unlink, clean after moves', () => {
  const l = ['a', 'b', 'c', 'd'].map((id) => ({ id, restSec: 90 }));
  linkWithNext(l, 0, T0);
  linkWithNext(l, 1, T0); // c joins a+b
  assert.ok(l[0].supersetId && l[0].supersetId === l[2].supersetId);
  assert.deepEqual(supersetInfo(l).map((x) => x && `${x.letter}${x.first ? 'F' : ''}${x.last ? 'L' : ''}`), ['AF', 'A', 'AL', null]);
  assert.deepEqual(l.map((_, i) => restAfterTick(l, i)), [0, 0, 90, 90]);
  unlinkSuperset(l, 2);
  assert.deepEqual(supersetInfo(l).map((x) => x && x.letter), ['A', 'A', null, null]);
  unlinkSuperset(l, 1);
  assert.ok(l.every((e) => !e.supersetId), 'a group of one dissolves');
  // two groups; moving an outsider into the middle of one splits it
  const m = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
  linkWithNext(m, 0, T0); linkWithNext(m, 1, T0); // a b c
  moveItem(m, 4, 1); // a e b c d
  cleanSupersets(m);
  assert.deepEqual(supersetInfo(m).map((x) => x && x.letter), [null, null, 'A', 'A', null]);
});

test('routines: saved without ticks, start a fresh gym session, replace by name', () => {
  const w = { title: 'Push day', exercises: [
    { id: 'x1', libId: 'barbell-bench-press', name: 'Bench', supersetId: 's1', sets: [newSet('work', { weight: 80, reps: 8, done: true, doneAt: 'x', rpe: 8 })] },
    { id: 'x2', libId: 'chest-dip', name: 'Dip', supersetId: 's1', sets: [newSet('work', { reps: 10, done: true, doneAt: 'x' })] },
  ] };
  const rt = routineFromWorkout(w, '  ', T0);
  assert.equal(rt.name, 'Push day');
  assert.deepEqual(rt.exercises[0].sets[0], { kind: 'work', weight: 80, reps: 8, seconds: null, done: false, doneAt: null, rpe: null });
  assert.equal(w.exercises[0].sets[0].done, true, 'the session itself is untouched');
  const s = workoutFromRoutine(rt, { id: 'new', date: '2026-10-15', now: T0 });
  assert.deepEqual([s.id, s.date, s.type, s.title, s.completed, s.routineId], ['new', '2026-10-15', 'gym', 'Push day', false, rt.id]);
  assert.notEqual(s.exercises[0].id, 'x1');
  assert.ok(s.exercises[0].supersetId && s.exercises[0].supersetId === s.exercises[1].supersetId && s.exercises[0].supersetId !== 's1');
  const list = saveRoutine(saveRoutine([], rt), { ...rt, id: 'rt-2', name: 'PUSH DAY' });
  assert.deepEqual(list.map((r) => r.id), ['rt-2']);
  assert.equal(saveRoutine(list, { ...rt, id: 'b', name: 'Arms' })[0].name, 'Arms');
});
