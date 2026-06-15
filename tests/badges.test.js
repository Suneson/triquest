import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBadges, newlyUnlocked, BADGES } from '../js/core/badges.js';

const done = (date, type, distanceKm = 0, durationMin = 60, intensity = 'easy') =>
  ({ date, type, intensity, durationMin, completed: true, metrics: { distanceKm } });

test('there are at least 15 badges with unique ids', () => {
  assert.ok(BADGES.length >= 15, `only ${BADGES.length} badges`);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length);
});

test('first-workout unlocks on the first completed session', () => {
  assert.deepEqual(evaluateBadges([], '2026-07-01'), []);
  assert.ok(evaluateBadges([done('2026-07-01', 'run')], '2026-07-01').includes('first-workout'));
});

test('streak badges fire at thresholds', () => {
  const week = ['01', '02', '03', '04', '05', '06', '07'].map((d) => done(`2026-07-${d}`, 'run'));
  const ids = evaluateBadges(week, '2026-07-07');
  assert.ok(ids.includes('streak-3'));
  assert.ok(ids.includes('streak-7'));
  assert.ok(!ids.includes('streak-14'));
});

test('cumulative bike distance unlocks rider badges', () => {
  const rides = [done('2026-07-01', 'bike', 60), done('2026-07-02', 'bike', 60)];
  const ids = evaluateBadges(rides, '2026-07-02');
  assert.ok(ids.includes('bike-100'));
  assert.ok(!ids.includes('bike-500'));
});

test('triple threat needs run+bike+swim on the same day', () => {
  const sameDay = [done('2026-07-01', 'run'), done('2026-07-01', 'bike'), done('2026-07-01', 'swim')];
  assert.ok(evaluateBadges(sameDay, '2026-07-01').includes('triple'));

  const spread = [done('2026-07-01', 'run'), done('2026-07-02', 'bike'), done('2026-07-03', 'swim')];
  assert.ok(!evaluateBadges(spread, '2026-07-03').includes('triple'));
});

test('200 km bike week badge respects week boundaries', () => {
  // Mon-Sun of the same week totalling 220 km.
  const sameWeek = [
    done('2026-07-06', 'bike', 70), done('2026-07-08', 'bike', 80), done('2026-07-12', 'bike', 70),
  ];
  assert.ok(evaluateBadges(sameWeek, '2026-07-12').includes('bike-week-200'));

  // Same total split across two weeks.
  const twoWeeks = [done('2026-07-05', 'bike', 110), done('2026-07-06', 'bike', 110)];
  assert.ok(!evaluateBadges(twoWeeks, '2026-07-06').includes('bike-week-200'));
});

test('newlyUnlocked diffs the two id sets', () => {
  assert.deepEqual(newlyUnlocked(['a', 'b'], ['a', 'b', 'c']), ['c']);
  assert.deepEqual(newlyUnlocked(['a'], ['a']), []);
});
