import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpForWorkout, xpToReachLevel, levelFromTotalXp, computeStats, formatDuration } from '../js/core/scoring.js';

test('xpForWorkout scales with duration, type and intensity', () => {
  const easyRun = { type: 'run', intensity: 'easy', durationMin: 60, metrics: {} };
  const vo2Run = { type: 'run', intensity: 'vo2', durationMin: 60, metrics: {} };
  assert.ok(xpForWorkout(vo2Run) > xpForWorkout(easyRun), 'harder = more XP');

  const longRide = { type: 'bike', intensity: 'steady', durationMin: 135, metrics: { distanceKm: 70 } };
  assert.ok(xpForWorkout(longRide) > xpForWorkout(easyRun));
});

test('xpForWorkout is robust to missing fields', () => {
  assert.equal(xpForWorkout({}), 0);
  assert.equal(xpForWorkout({ durationMin: -5 }), 0);
});

test('xpToReachLevel is monotonic and starts at 0', () => {
  assert.equal(xpToReachLevel(1), 0);
  let prev = -1;
  for (let l = 1; l <= 20; l++) {
    const v = xpToReachLevel(l);
    assert.ok(v > prev, `level ${l} threshold should increase`);
    prev = v;
  }
});

test('levelFromTotalXp inverts the thresholds', () => {
  assert.equal(levelFromTotalXp(0).level, 1);
  assert.equal(levelFromTotalXp(xpToReachLevel(5)).level, 5);
  assert.equal(levelFromTotalXp(xpToReachLevel(5) - 1).level, 4);
  const r = levelFromTotalXp(xpToReachLevel(3) + 10);
  assert.equal(r.level, 3);
  assert.equal(r.into, 10);
  assert.ok(r.progress > 0 && r.progress < 1);
});

test('computeStats only counts completed sessions', () => {
  const workouts = [
    { type: 'run', intensity: 'easy', durationMin: 60, completed: true, metrics: { distanceKm: 10 } },
    { type: 'bike', intensity: 'steady', durationMin: 120, completed: true, metrics: { distanceKm: 60 } },
    { type: 'swim', intensity: 'easy', durationMin: 30, completed: false, metrics: { distanceKm: 1.5 } },
  ];
  const s = computeStats(workouts);
  assert.equal(s.completedCount, 2);
  assert.equal(s.totalMinutes, 180);
  assert.equal(s.totalKm, 70);
  assert.equal(s.kmByType.bike, 60);
  assert.equal(s.kmByType.swim, undefined);
  assert.ok(s.totalXp > 0);
});

test('formatDuration renders hours and minutes', () => {
  assert.equal(formatDuration(90), '1 h 30 m');
  assert.equal(formatDuration(60), '1 h');
  assert.equal(formatDuration(45), '45 m');
  assert.equal(formatDuration(0), '0 m');
});
