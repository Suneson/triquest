import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raceAt, bossKmAt, clock, trackPoint, EPOCH, RACE_MS, robotLevel, raceXp, BOSS_KM } from '../js/core/stadium.js';

test('a race every 72 hours, back to back from the epoch', () => {
  const r = raceAt(EPOCH + 10);
  assert.equal(r.n, 0); assert.equal(r.start, EPOCH); assert.equal(r.end, EPOCH + RACE_MS);
  const next = raceAt(EPOCH + RACE_MS);
  assert.equal(next.n, 1); assert.equal(next.p, 0, 'a new race starts at nothing');
  assert.equal(raceAt(EPOCH + RACE_MS * 1.5).p, 0.5);
  assert.equal(raceAt(EPOCH - 1).n, -1, 'before the epoch still works');
  assert.equal(raceAt(EPOCH + 1).boss.id, 'blomvelt');
});

test('the boss runs his km evenly and the clock counts down', () => {
  assert.equal(bossKmAt(EPOCH + RACE_MS / 2, 12), BOSS_KM[12] / 2);
  assert.equal(bossKmAt(EPOCH + RACE_MS / 4, 3), BOSS_KM[3] / 4);
  assert.equal(clock(RACE_MS), '72:00:00');
  assert.equal(clock(3661e3 + 999), '01:01:01');
  assert.equal(clock(-5), '00:00:00');
});

test('once round the track: the finish, the far bend, back to the finish', () => {
  const a = trackPoint(0); const b = trackPoint(1);
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.z - b.z) < 1e-9);
  assert.ok(a.x > 0 && a.z > 0, 'the finish is at the near end of the right-hand straight');
  const far = trackPoint(0.5);
  assert.ok(far.x < 0, 'halfway is on the left-hand straight');
  const top = trackPoint(0.3);
  assert.ok(top.z < -40, 'the far bend is up the screen');
  // even steps: each 1% of the lap is the same distance
  const d = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
  const steps = Array.from({ length: 100 }, (_, i) => d(trackPoint(i / 100), trackPoint((i + 1) / 100)));
  assert.ok(Math.max(...steps) - Math.min(...steps) < 0.05);
});

test('the clan robot: ten levels from clan XP', () => {
  assert.equal(robotLevel(0), 1);
  assert.equal(robotLevel(499), 1);
  assert.equal(robotLevel(500), 2);
  assert.equal(robotLevel(1e9), 10);
  assert.equal(raceXp(12.34, false), 123);
  assert.equal(raceXp(10, true), 1100);
});
