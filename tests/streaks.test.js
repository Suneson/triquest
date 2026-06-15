import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStreaks } from '../js/core/streaks.js';

const w = (date, completed = true) => ({ date, completed, type: 'run' });

test('counts consecutive completed days up to today', () => {
  const workouts = [w('2026-07-01'), w('2026-07-02'), w('2026-07-03')];
  const s = computeStreaks(workouts, '2026-07-03');
  assert.equal(s.current, 3);
  assert.equal(s.longest, 3);
  assert.equal(s.isTodayDone, true);
});

test('one-day grace keeps the streak alive when today is unfinished', () => {
  const workouts = [w('2026-07-01'), w('2026-07-02')]; // nothing done on the 3rd yet
  const s = computeStreaks(workouts, '2026-07-03');
  assert.equal(s.isTodayDone, false);
  assert.equal(s.current, 2, 'yesterday anchors the streak');
});

test('a two-day gap breaks the current streak', () => {
  const workouts = [w('2026-07-01'), w('2026-07-02')];
  const s = computeStreaks(workouts, '2026-07-04');
  assert.equal(s.current, 0);
  assert.equal(s.longest, 2);
});

test('multiple sessions on one day count as a single streak day', () => {
  const workouts = [w('2026-07-01'), w('2026-07-01'), w('2026-07-02')];
  const s = computeStreaks(workouts, '2026-07-02');
  assert.equal(s.current, 2);
});

test('longest tracks the best historical run, not the current one', () => {
  const workouts = [
    w('2026-07-01'), w('2026-07-02'), w('2026-07-03'), w('2026-07-04'),
    w('2026-07-10'),
  ];
  const s = computeStreaks(workouts, '2026-07-10');
  assert.equal(s.longest, 4);
  assert.equal(s.current, 1);
});

test('incomplete workouts never contribute', () => {
  const s = computeStreaks([w('2026-07-01', false)], '2026-07-01');
  assert.equal(s.current, 0);
  assert.equal(s.longest, 0);
});
