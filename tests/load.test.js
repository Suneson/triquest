import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionLoad, loadBetween, acwr, weekKm, runVolumeJump, weekHours } from '../js/core/load.js';

const s = (date, over = {}) => ({ date, completed: true, type: 'run', intensity: 'easy', durationMin: 60, metrics: {}, ...over });

test('sessionLoad scales duration by intensity and ignores incomplete', () => {
  assert.equal(sessionLoad(s('2026-07-01', { intensity: 'easy', durationMin: 60 })), 60);
  assert.equal(sessionLoad(s('2026-07-01', { intensity: 'vo2', durationMin: 60 })), 150);
  assert.equal(sessionLoad(s('2026-07-01', { completed: false })), 0);
});

test('loadBetween sums an inclusive window', () => {
  const ws = [s('2026-07-01'), s('2026-07-04'), s('2026-07-10')];
  assert.equal(loadBetween(ws, '2026-07-01', '2026-07-07'), 120);
});

test('acwr: balanced 4 weeks gives ratio ~1', () => {
  // 60 min easy every day for 28 days -> acute(7)=420, chronicWeekly=420 -> ratio 1
  const ws = [];
  for (let i = 0; i < 28; i++) ws.push(s(`2026-07-${String(i + 1).padStart(2, '0')}`));
  // shift dates into a real consecutive range
  const days = [];
  let d = '2026-06-09';
  const ws2 = [];
  for (let i = 0; i < 28; i++) { ws2.push(s(d)); const dt = new Date(d); dt.setDate(dt.getDate() + 1); d = dt.toISOString().slice(0, 10); }
  const r = acwr(ws2, '2026-07-06');
  assert.equal(r.ratio, 1);
  assert.equal(r.zone, 'ok');
});

test('acwr: a spike week flags danger', () => {
  const ws = [];
  // three quiet weeks then a big week
  let d = '2026-06-08';
  for (let i = 0; i < 21; i++) { if (i % 7 === 0) ws.push(s(d, { durationMin: 60 })); const dt = new Date(d); dt.setDate(dt.getDate() + 1); d = dt.toISOString().slice(0, 10); }
  // last 7 days: heavy daily load
  d = '2026-06-29';
  for (let i = 0; i < 7; i++) { ws.push(s(d, { durationMin: 120, intensity: 'threshold' })); const dt = new Date(d); dt.setDate(dt.getDate() + 1); d = dt.toISOString().slice(0, 10); }
  const r = acwr(ws, '2026-07-05');
  assert.ok(r.ratio > 1.5, `ratio ${r.ratio}`);
  assert.equal(r.zone, 'danger');
});

test('acwr: no history -> unknown, no divide-by-zero', () => {
  const r = acwr([], '2026-07-06');
  assert.equal(r.zone, 'unknown');
  assert.equal(r.ratio, 0);
});

test('weekKm sums completed distance of a type in the week', () => {
  const ws = [
    s('2026-07-06', { type: 'run', metrics: { distanceKm: 10 } }),
    s('2026-07-08', { type: 'run', metrics: { distanceKm: 12 } }),
    s('2026-07-08', { type: 'bike', metrics: { distanceKm: 50 } }),
    s('2026-07-13', { type: 'run', metrics: { distanceKm: 99 } }), // next week
  ];
  assert.equal(weekKm(ws, '2026-07-06', 'run'), 22);
});

test('runVolumeJump warns when this week exceeds last week by >10%', () => {
  const ws = [
    s('2026-06-29', { type: 'run', metrics: { distanceKm: 40 } }), // last week (Mon 29 Jun)
    s('2026-07-06', { type: 'run', metrics: { distanceKm: 50 } }), // this week (Mon 6 Jul) = +25%
  ];
  const r = runVolumeJump(ws, '2026-07-08');
  assert.equal(r.lastKm, 40);
  assert.equal(r.thisKm, 50);
  assert.equal(r.pctChange, 25);
  assert.equal(r.warn, true);
});

test('runVolumeJump does not warn within 10%', () => {
  const ws = [
    s('2026-06-29', { type: 'run', metrics: { distanceKm: 40 } }),
    s('2026-07-06', { type: 'run', metrics: { distanceKm: 43 } }), // +7.5%
  ];
  assert.equal(runVolumeJump(ws, '2026-07-08').warn, false);
});

test('weekHours totals completed minutes as hours', () => {
  const ws = [s('2026-07-06', { durationMin: 90 }), s('2026-07-07', { durationMin: 30 }), s('2026-07-07', { durationMin: 60, completed: false })];
  assert.equal(weekHours(ws, '2026-07-06'), 2);
});
