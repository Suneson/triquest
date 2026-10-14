import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSet } from '../js/core/sets.js';
import {
  e1rm, bestSet, exerciseHistory, exerciseRecords, detectPRs, recordsShelf,
  weeklyMuscleSets, muscleBalance, describeBalance,
} from '../js/core/gym-stats.js';

const done = (f, kind = 'work') => newSet(kind, { ...f, done: true, doneAt: 'x' });
const sq = (sets, extra = {}) => ({ libId: 'back-squat', name: 'Back Squat', kind: 'weight_reps', muscle: 'Quads', sets, ...extra });
const W = (id, date, exercises) => ({ id, date, type: 'gym', exercises });

test('Epley estimate, only where it is reasonable', () => {
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(100, 5), 116.7);
  assert.equal(e1rm(100, 12), 140);
  assert.equal(e1rm(100, 13), null);
  assert.equal(e1rm(0, 5), null);
  assert.equal(e1rm(100, 0), null);
});

test('best set: top estimate, then weight; longest for timed', () => {
  assert.deepEqual(bestSet([done({ weight: 100, reps: 5 }), done({ weight: 110, reps: 2 }), done({ weight: 90, reps: 10 })]).weight, 90);
  assert.equal(bestSet([done({ seconds: 30 }), done({ seconds: 45 })], 'time').seconds, 45);
  assert.equal(bestSet([done({ reps: 8 }), done({ reps: 12 })], 'bodyweight').reps, 12);
  assert.equal(bestSet([]), null);
});

const history = [
  W('a', '2026-09-01', [sq([done({ weight: 60, reps: 8 }, 'warmup'), done({ weight: 100, reps: 5 }), done({ weight: 100, reps: 5 }), newSet('work', { weight: 200, reps: 5 })])]),
  W('b', '2026-09-08', [sq([done({ weight: 105, reps: 5 }), done({ weight: 105, reps: 4 })])]),
  W('c', '2026-09-15', [sq([newSet('work', { weight: 110, reps: 5 })])]), // planned only
  W('d', '2026-09-04', [{ libId: 'pull-up', name: 'Pull Up', kind: 'bodyweight', muscle: 'Back', sets: [done({ reps: 8 }), done({ reps: 10 })] }]),
];

test('history: ticked work sets only, oldest first, with best, e1RM and volume', () => {
  const h = exerciseHistory(history, { libId: 'back-squat' });
  assert.deepEqual(h.map((x) => x.date), ['2026-09-01', '2026-09-08']);
  assert.equal(h[0].sets.length, 2, 'no warm-up, no unticked');
  assert.equal(h[0].volume, 1000);
  assert.equal(h[0].e1rm, 116.7);
  assert.equal(h[1].e1rm, 122.5);
});

test('records', () => {
  const r = exerciseRecords(exerciseHistory(history, { libId: 'back-squat' }));
  assert.deepEqual(r.heaviest, { weight: 105, reps: 5, date: '2026-09-08' });
  assert.equal(r.e1rm.value, 122.5);
  const pull = exerciseRecords(exerciseHistory(history, { libId: 'pull-up' }));
  assert.deepEqual(pull.reps, { reps: 10, date: '2026-09-04' });
  assert.equal(pull.e1rm, null);
});

test('records volume picks the biggest session', () => {
  const r = exerciseRecords(exerciseHistory(history, { libId: 'back-squat' }));
  // session a: 2 × 100 × 5 = 1000; session b: 105 × 5 + 105 × 4 = 945
  assert.deepEqual(r.volume, { value: 1000, date: '2026-09-01' });
});

test('a ticked set that beats every earlier one is a record; the first ever is not', () => {
  const today = W('t', '2026-09-15', [sq([done({ weight: 110, reps: 5 }), done({ weight: 100, reps: 3 })])]);
  const all = [...history, today];
  const prs = detectPRs(all, today, 0, 0);
  assert.deepEqual(prs.map((p) => p.type), ['weight', 'e1rm']);
  assert.equal(prs[1].label, 'Est. 1RM: 128.3 kg');
  assert.deepEqual(detectPRs(all, today, 0, 1), [], 'a lighter set is not a record');
  const first = W('f', '2026-09-15', [{ libId: 'deadlift', name: 'Deadlift', kind: 'weight_reps', sets: [done({ weight: 140, reps: 5 })] }]);
  assert.deepEqual(detectPRs([first], first, 0, 0), [], 'nothing to beat yet');
  const pull = W('p', '2026-09-20', [{ libId: 'pull-up', name: 'Pull Up', kind: 'bodyweight', sets: [done({ reps: 12 })] }]);
  assert.deepEqual(detectPRs([...history, pull], pull, 0, 0).map((p) => p.type), ['reps']);
  const warm = W('w', '2026-09-20', [sq([done({ weight: 300, reps: 1 }, 'warmup')])]);
  assert.deepEqual(detectPRs([...history, warm], warm, 0, 0), [], 'warm-ups never set records');
});

test('records shelf: one headline per exercise, newest record first', () => {
  const shelf = recordsShelf(history);
  assert.deepEqual(shelf.map((r) => [r.name, r.headline.text, r.headline.sub]), [
    ['Back Squat', '122.5 kg', 'est. 1RM'],
    ['Pull Up', '10 reps', 'most reps'],
  ]);
});

test('weekly sets per muscle, this week last', () => {
  const ws = weeklyMuscleSets(history, '2026-09-10', 3);
  assert.deepEqual(ws.map((w) => w.weekStart), ['2026-08-24', '2026-08-31', '2026-09-07']);
  assert.deepEqual(ws.map((w) => w.total), [0, 4, 2]);
  assert.deepEqual(ws[1].byMuscle, { Quads: 2, Back: 2 });
  assert.equal(weeklyMuscleSets(history, '2026-09-10', 3)[2].byMuscle.Quads, 2, 'future sessions are ignored');
});

test('muscle balance describes, it does not advise', () => {
  const bal = muscleBalance(history, '2026-09-10');
  assert.equal(bal.total, 6);
  assert.deepEqual(bal.rows.map((r) => [r.muscle, r.sets]), [['Quads', 4], ['Back', 2]]);
  assert.ok(bal.untrained.includes('Chest') && !bal.untrained.includes('Cardio'));
  const text = describeBalance(bal);
  assert.match(text, /^6 working sets in four weeks\. Quads got the most \(67%\)\./);
  assert.doesNotMatch(text, /should|need|must|try/i);
  assert.equal(describeBalance(muscleBalance([], '2026-09-10')), 'No gym sets logged in the last four weeks.');
});
