import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUEST_POOL, QUESTS_SINCE, isVerified, hashString, seededRandom, questsFor, questXpThrough,
  accountProgress, trainingXp, msUntilReset, formatCountdown, dayContext, indexByDate,
} from '../js/core/quests.js';
import { addDays } from '../js/core/dates.js';

const D = '2026-10-12'; // a Monday after QUESTS_SINCE
const settings = { packing: { run: ['shoes', 'watch'], bike: ['helmet'], swim: [], gym: [] } };
let n = 0;
const wo = (o) => ({ id: `t${n++}`, date: D, type: 'run', intensity: 'easy', durationMin: 40, metrics: { distanceKm: 8 },
  completed: false, source: 'plan', ...o });
const stravaDone = (o) => wo({ completed: true, strava_activity_id: 123, ...o });

test('verified means completed AND Strava-linked', () => {
  assert.equal(isVerified(wo({ completed: true })), false); // e.g. set by an imported JSON
  assert.equal(isVerified(wo({ completed: true, strava_activity_id: 9 })), true);
  assert.equal(isVerified(wo({ completed: true, source: 'strava' })), true);
  assert.equal(isVerified(wo({ strava_activity_id: 9 })), false);
});

test('hash + PRNG are deterministic', () => {
  assert.equal(hashString('abc'), hashString('abc'));
  assert.notEqual(hashString('2026-10-12'), hashString('2026-10-13'));
  const a = seededRandom(42); const b = seededRandom(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('the same date and plan give the same quests', () => {
  const ws = [wo({}), wo({ type: 'gym', metrics: {} }), wo({ date: addDays(D, 1) })];
  assert.deepEqual(questsFor(D, ws, settings), questsFor(D, ws, settings));
});

test('at most three quests a day, at most one app quest, all eligible', () => {
  const ws = [wo({}), wo({ type: 'bike' }), wo({ type: 'brick' }), wo({ date: addDays(D, 1) }),
    stravaDone({ date: addDays(D, -1) })];
  for (let i = 0; i < 40; i++) {
    const day = addDays(D, i);
    const shifted = ws.map((w) => ({ ...w, date: addDays(w.date, i) }));
    const qs = questsFor(day, shifted, settings);
    assert.ok(qs.length <= 3);
    assert.ok(qs.filter((q) => q.kind === 'app').length <= 1);
    assert.equal(new Set(qs.map((q) => q.id)).size, qs.length);
  }
});

test('ineligible quests are never offered', () => {
  // only a gym session: no distance, no brick, no second discipline, nothing tomorrow
  const qs = questsFor(D, [wo({ type: 'gym', metrics: {} })], settings);
  const ids = qs.map((q) => q.id);
  for (const bad of ['km-10', 'brick', 'two-disc', 'pack-bag', 'streak']) assert.ok(!ids.includes(bad), bad);
});

test('no quests before QUESTS_SINCE', () => {
  const day = addDays(QUESTS_SINCE, -1);
  assert.deepEqual(questsFor(day, [wo({ date: day })], settings), []);
});

// judge one quest directly, independent of the day's random pick
const byId = (date, ws, id) =>
  QUEST_POOL.find((q) => q.id === id).done(dayContext(date, indexByDate(ws), settings));

test('quest rules', () => {
  // plan-done: a planned session must be verified, an imported "completed" doesn't count
  assert.equal(byId(D, [wo({ completed: true })], 'plan-done'), false);
  assert.equal(byId(D, [stravaDone({})], 'plan-done'), true);
  // min-45 sums verified minutes, preferring actual duration
  assert.equal(byId(D, [stravaDone({ durationMin: 30 }), stravaDone({ durationMin: 20 })], 'min-45'), true);
  assert.equal(byId(D, [stravaDone({ durationMin: 60, actual: { durationMin: 30 } })], 'min-45'), false);
  // two-disc needs two verified types
  assert.equal(byId(D, [stravaDone({}), stravaDone({ type: 'swim' })], 'two-disc'), true);
  assert.equal(byId(D, [stravaDone({}), stravaDone({})], 'two-disc'), false);
  // km-10
  assert.equal(byId(D, [stravaDone({ metrics: { distanceKm: 6 } }), stravaDone({ type: 'bike', metrics: { distanceKm: 5 } })], 'km-10'), true);
  // pack-bag: every preset item ticked on tomorrow's sessions
  const tmr = addDays(D, 1);
  assert.equal(byId(D, [wo({ date: tmr, packed: ['shoes'] })], 'pack-bag'), false);
  assert.equal(byId(D, [wo({ date: tmr, packed: ['shoes', 'watch'] }), wo({ date: tmr, type: 'bike', packed: ['helmet'] })], 'pack-bag'), true);
});

test('quest XP and the account level are derived from workouts', () => {
  const ws = [stravaDone({ durationMin: 50 }), stravaDone({ date: addDays(D, 1), durationMin: 50 })];
  const xp = questXpThrough(addDays(D, 1), ws, settings);
  const expected = [D, addDays(D, 1)].reduce((a, day) =>
    a + questsFor(day, ws, settings).filter((q) => q.done).reduce((s, q) => s + q.xp, 0), 0);
  assert.equal(xp, expected);
  assert.ok(xp > 0);
  const acct = accountProgress(ws, settings, addDays(D, 1));
  assert.equal(acct.trainingXp, trainingXp(ws));
  assert.equal(acct.questXp, xp);
  assert.equal(acct.totalXp, acct.trainingXp + acct.questXp);
  assert.equal(questXpThrough(D, [], settings), 0);
});

test('reset countdown runs to local midnight', () => {
  assert.equal(msUntilReset(new Date(2026, 9, 7, 23, 0, 0)), 3600000);
  assert.equal(formatCountdown(3600000), '01:00');
  assert.equal(formatCountdown(61000), '00:02');
  assert.equal(formatCountdown(0), '00:00');
});
