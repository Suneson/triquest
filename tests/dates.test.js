import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, diffDays, weekdayMon0, startOfWeek, dateRange, parseISO, toISO } from '../js/core/dates.js';

test('addDays handles month + year rollover', () => {
  assert.equal(addDays('2026-07-31', 1), '2026-08-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('diffDays is signed whole days', () => {
  assert.equal(diffDays('2026-07-10', '2026-07-01'), 9);
  assert.equal(diffDays('2026-07-01', '2026-07-10'), -9);
  assert.equal(diffDays('2026-07-01', '2026-07-01'), 0);
});

test('weekdayMon0 — Monday is 0, Sunday is 6', () => {
  assert.equal(weekdayMon0('2026-07-06'), 0); // Monday
  assert.equal(weekdayMon0('2026-07-12'), 6); // Sunday
});

test('startOfWeek snaps back to Monday', () => {
  assert.equal(startOfWeek('2026-07-12', 1), '2026-07-06'); // Sun -> prev Mon
  assert.equal(startOfWeek('2026-07-06', 1), '2026-07-06'); // Mon -> itself
});

test('dateRange is inclusive', () => {
  const r = dateRange('2026-07-01', '2026-07-03');
  assert.deepEqual(r, ['2026-07-01', '2026-07-02', '2026-07-03']);
});

test('parse/format round-trips and dodges DST', () => {
  assert.equal(toISO(parseISO('2026-03-29')), '2026-03-29'); // EU DST switch day
  assert.equal(toISO(parseISO('2026-10-25')), '2026-10-25');
});
