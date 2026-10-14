import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSet } from '../js/core/sets.js';
import {
  setLabels, previousSets, previousFor, formatSet, fillFrom, addSet, removeSet, tickSet,
  exerciseVolume, sessionSummary, fmtClock, restLabel, markStarted, startRest, restRemaining,
  extendRest, startStopwatch, stopwatchElapsed, finishPatch, sameExercise,
} from '../js/core/gym-log.js';

const T0 = Date.parse('2026-10-14T10:00:00Z');
const ex = (sets, extra = {}) => ({ id: 'e1', libId: 'back-squat', name: 'Back Squat', kind: 'weight_reps', restSec: 120, note: '', sets, ...extra });
const done = (fields, kind = 'work', at = '2026-10-01T10:00:00Z') => newSet(kind, { ...fields, done: true, doneAt: at });

test('labels: W for warm-ups, work sets count on, D and F keep their place in the count', () => {
  const sets = ['warmup', 'warmup', 'work', 'work', 'drop', 'failure', 'work'].map((k) => newSet(k));
  assert.deepEqual(setLabels(sets), ['W', 'W', '1', '2', 'D', 'F', '5']);
  assert.deepEqual(setLabels([]), []);
});

test('same exercise: library id first, else the normalised name', () => {
  assert.ok(sameExercise({ libId: 'pull-up' }, { libId: 'pull-up', name: 'x' }));
  assert.ok(!sameExercise({ libId: 'pull-up' }, { libId: 'chest-dip' }));
  assert.ok(sameExercise({ name: 'Zercher carry!' }, { name: 'zercher carry' }));
  assert.ok(!sameExercise({ name: '' }, { name: '' }));
});

test('previous: the most recent earlier session with ticked sets for this exercise', () => {
  const workouts = [
    { id: 'a', date: '2026-10-01', exercises: [ex([done({ weight: 90, reps: 5 }), newSet('work', { weight: 999, reps: 1 })])] },
    { id: 'b', date: '2026-10-08', exercises: [ex([done({ weight: 40, reps: 10 }, 'warmup'), done({ weight: 100, reps: 5 }), done({ weight: 100, reps: 4 })])] },
    { id: 'c', date: '2026-10-10', exercises: [ex([newSet('work', { weight: 120, reps: 5 })])] }, // planned, nothing ticked
    { id: 'd', date: '2026-10-20', exercises: [ex([done({ weight: 140, reps: 5 })])] }, // later than today
    { id: 'today', date: '2026-10-14', exercises: [ex([done({ weight: 105, reps: 5 })])] },
  ];
  const prev = previousSets(workouts, workouts[4].exercises[0], { beforeDate: '2026-10-14', excludeId: 'today' });
  assert.equal(prev.date, '2026-10-08');
  assert.equal(prev.sets.length, 3);
  const mine = [newSet('warmup'), newSet('work'), newSet('work'), newSet('work')];
  assert.equal(previousFor(prev, mine, 0).weight, 40);
  assert.equal(previousFor(prev, mine, 1).weight, 100);
  assert.equal(previousFor(prev, mine, 2).reps, 4);
  assert.equal(previousFor(prev, mine, 3), null, 'no fourth working set last time');
  assert.equal(previousSets([], ex([])), null);
});

test('formatting a set for the PREVIOUS column', () => {
  assert.equal(formatSet({ weight: 100, reps: 8 }), '100 kg × 8');
  assert.equal(formatSet({ weight: 22.5, reps: 10 }), '22.5 kg × 10');
  assert.equal(formatSet({ weight: 10, reps: 6 }, 'bodyweight'), '+10 kg × 6');
  assert.equal(formatSet({ weight: null, reps: 12 }, 'bodyweight'), '× 12');
  assert.equal(formatSet({ seconds: 45 }, 'time'), '0:45');
  assert.equal(formatSet(null), '');
});

test('add, remove, fill, tick', () => {
  const e = ex([newSet('work', { weight: 100, reps: 5 })]);
  const s = addSet(e);
  assert.equal(e.sets.length, 2);
  assert.deepEqual([s.weight, s.reps, s.done, s.kind], [100, 5, false, 'work']);
  assert.ok(removeSet(e, 1));
  assert.ok(!removeSet(e, 0), 'an exercise keeps one set');
  fillFrom(e.sets[0], { weight: 110, reps: 3, seconds: null });
  assert.deepEqual([e.sets[0].weight, e.sets[0].reps], [110, 3]);
  const blank = ex([newSet('work')]);
  tickSet(blank, 0, true, T0, { weight: 80, reps: 8 });
  assert.deepEqual([blank.sets[0].weight, blank.sets[0].reps, blank.sets[0].done], [80, 8, true]);
  assert.equal(blank.sets[0].doneAt, '2026-10-14T10:00:00.000Z');
  tickSet(blank, 0, false, T0);
  assert.deepEqual([blank.sets[0].done, blank.sets[0].doneAt, blank.sets[0].weight], [false, null, 80], 'unticking keeps the numbers');
});

test('volume and summary skip warm-ups and unticked sets', () => {
  const w = {
    gymStartedAt: new Date(T0).toISOString(),
    exercises: [
      ex([done({ weight: 60, reps: 10 }, 'warmup'), done({ weight: 100, reps: 5 }), done({ weight: 100, reps: 5 }), newSet('work', { weight: 100, reps: 5 })]),
      ex([done({ weight: null, reps: 8 }), done({ weight: 10, reps: 6 })], { libId: 'pull-up', kind: 'bodyweight' }),
      ex([newSet('work')], { libId: 'face-pull' }),
    ],
  };
  assert.equal(exerciseVolume(w.exercises[0]), 1000);
  assert.equal(exerciseVolume(w.exercises[1]), 60, 'bodyweight counts only added weight');
  assert.deepEqual(sessionSummary(w, T0 + 45 * 60 * 1000), { sets: 4, exercises: 2, volumeKg: 1060, durationSec: 2700 });
  assert.equal(sessionSummary({ exercises: [] }, T0).durationSec, null);
});

test('clock formatting', () => {
  assert.equal(fmtClock(0), '0:00');
  assert.equal(fmtClock(45), '0:45');
  assert.equal(fmtClock(150), '2:30');
  assert.equal(fmtClock(3729), '1:02:09');
  assert.equal(fmtClock(-5), '0:00');
  assert.equal(restLabel(150), 'Rest 2:30');
  assert.equal(restLabel(0), 'Rest off');
});

test('the session clock starts once, on the first tick', () => {
  const w = {};
  markStarted(w, T0);
  markStarted(w, T0 + 60000);
  assert.equal(w.gymStartedAt, '2026-10-14T10:00:00.000Z');
});

test('rest timer is an end timestamp: survives reloads, extends, never goes below now', () => {
  const r = startRest('w1', 90, T0);
  assert.deepEqual(r, { workoutId: 'w1', endsAt: T0 + 90000, totalSec: 90 });
  assert.equal(restRemaining(r, T0 + 30500), 60);
  assert.equal(restRemaining(r, T0 + 999999), 0);
  const longer = extendRest(r, 15, T0 + 30000);
  assert.equal(restRemaining(longer, T0 + 30000), 75);
  const cut = extendRest(r, -120, T0 + 30000);
  assert.equal(restRemaining(cut, T0 + 30000), 0);
  assert.equal(startRest('w1', 0, T0), null, 'rest off');
  assert.equal(restRemaining(null, T0), 0);
});

test('stopwatch counts up from its start stamp', () => {
  const sw = startStopwatch('w1', 2, 0, T0);
  assert.equal(stopwatchElapsed(sw, T0 + 41400), 41);
  assert.equal(stopwatchElapsed(null, T0), 0);
});

test('finish logs the session and never marks it completed (XP comes from Strava)', () => {
  const w = { completed: false, gymStartedAt: new Date(T0).toISOString(), exercises: [ex([done({ weight: 100, reps: 5 })])] };
  const patch = finishPatch(w, T0 + 600000);
  assert.deepEqual(patch, { gymLoggedAt: '2026-10-14T10:10:00.000Z', gymDurationSec: 600 });
  assert.ok(!('completed' in patch) && !('completedAt' in patch));
  assert.equal(finishPatch({ exercises: [ex([newSet('work')])] }, T0), null, 'nothing ticked, nothing to log');
  const onlyWarmups = { exercises: [ex([done({ weight: 40, reps: 10 }, 'warmup')])] };
  assert.equal(finishPatch(onlyWarmups, T0), null, 'warm-ups alone are not a session');
});

import { setOrder, nextSet } from '../js/core/gym-log.js';

test('guided order: exercise by exercise, alternating inside a superset', () => {
  const ex = (n, ss) => ({ sets: Array.from({ length: n }, () => newSet('work')), ...(ss ? { supersetId: ss } : {}) });
  const list = [ex(2), ex(3, 's'), ex(2, 's'), ex(1)];
  assert.deepEqual(setOrder(list), [[0, 0], [0, 1], [1, 0], [2, 0], [1, 1], [2, 1], [1, 2], [3, 0]]);
  assert.deepEqual(nextSet(list), { ex: 0, set: 0 });
  list[0].sets[0].done = true; list[0].sets[1].done = true; list[1].sets[0].done = true;
  assert.deepEqual(nextSet(list), { ex: 2, set: 0 }, 'superset partner comes next');
  list.forEach((e) => e.sets.forEach((s) => { s.done = true; }));
  assert.equal(nextSet(list), null);
  assert.equal(nextSet([]), null);
  // warm-ups are part of the exercise and come first
  const w = [{ sets: [newSet('warmup'), newSet('work')] }];
  assert.deepEqual(nextSet(w), { ex: 0, set: 0 });
});
