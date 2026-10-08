import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plannedDaySet, isRestDay } from '../js/core/rest.js';
import { computeStreaks } from '../js/core/streaks.js';
import { questsFor, QUEST_POOL, REST_SINCE, QUESTS_SINCE } from '../js/core/quests.js';
import { pendingClaims, emptyLedger, CLAIMABLE } from '../js/core/quest-claims.js';
import { weekPath, seasonPath, nextEvent } from '../js/core/path.js';
import { podium, rankDelta, rivalOf } from '../js/core/ranks.js';
import { timeOfDay } from '../js/core/scenes.js';
import { addDays } from '../js/core/dates.js';

const plan = (date, o = {}) => ({ id: `${date}-${o.type || 'run'}`, date, type: 'run', source: 'plan', durationMin: 40, completed: false, ...o });
const done = (date, o = {}) => plan(date, { completed: true, strava_activity_id: 1, ...o });

// ---- rest days -------------------------------------------------------------------

test('a single day off between planned days is rest; a week off is not', () => {
  const ws = [plan('2026-10-05'), plan('2026-10-07'), plan('2026-10-20')];
  const p = plannedDaySet(ws);
  assert.equal(isRestDay('2026-10-06', p), true);
  assert.equal(isRestDay('2026-10-12', p), false, 'a 12-day gap is not planned rest');
  assert.equal(isRestDay('2026-10-05', p), false, 'a planned day is not rest');
});

test('two days off in a row are rest, three are not', () => {
  const two = plannedDaySet([plan('2026-10-02'), plan('2026-10-05')]);
  assert.equal(isRestDay('2026-10-03', two), true);
  assert.equal(isRestDay('2026-10-04', two), true);
  const three = plannedDaySet([plan('2026-10-02'), plan('2026-10-06')]);
  assert.equal(isRestDay('2026-10-04', three), false);
});

test('optional "easy swim or rest" days count as rest; Strava imports are not planned', () => {
  const ws = [plan('2026-10-05'), plan('2026-10-06', { optional: true }), plan('2026-10-07', { source: 'strava' }), plan('2026-10-08')];
  const p = plannedDaySet(ws);
  assert.equal(isRestDay('2026-10-06', p), true);
  assert.equal(isRestDay('2026-10-07', p), true);
});

// ---- streaks with rest -----------------------------------------------------------

test('a planned rest day never breaks the streak (and does not add to it)', () => {
  const ws = [done('2026-10-05'), plan('2026-10-06', { optional: true }), done('2026-10-07')];
  const s = computeStreaks(ws, '2026-10-07');
  assert.equal(s.current, 2);
  assert.equal(s.longest, 2);
});

test('a missed planned session still breaks the streak', () => {
  const ws = [done('2026-10-05'), plan('2026-10-06'), done('2026-10-07')];
  assert.equal(computeStreaks(ws, '2026-10-07').current, 1);
});

test('rest yesterday + nothing yet today keeps the streak (grace)', () => {
  const ws = [done('2026-10-05'), done('2026-10-07', { completed: false })];
  assert.equal(computeStreaks(ws, '2026-10-07').current, 1);
});

// ---- recovery quest --------------------------------------------------------------

test('adding the rest quest re-rolls no day before REST_SINCE', () => {
  const ws = [plan('2026-10-05'), done('2026-10-06', { type: 'bike' }), plan('2026-10-07', { type: 'swim' })];
  // the pool as it was before the rest quest, shuffled the old way
  const old = QUEST_POOL.filter((q) => q.id !== 'rest-day');
  for (let d = QUESTS_SINCE; d < REST_SINCE; d = addDays(d, 1)) {
    const ids = questsFor(d, ws, {}).map((q) => q.id);
    assert.ok(ids.every((id) => old.some((q) => q.id === id)), d);
    assert.ok(!ids.includes('rest-day'));
  }
});

test('rest quest: eligible on a planned rest day, done while nothing is logged', () => {
  const day = addDays(REST_SINCE, 1);
  const ws = [plan(addDays(day, -1)), plan(addDays(day, 1))];
  let found = null;
  // the daily roll may or may not pick it; scan a few rest days to find one that does
  for (let k = 0; k < 40 && !found; k++) {
    const d = addDays(day, k * 3);
    const set = [plan(addDays(d, -1)), plan(addDays(d, 1))];
    const q = questsFor(d, set, {}).find((x) => x.id === 'rest-day');
    if (q) found = { d, q, set };
  }
  assert.ok(found, 'rest quest is picked on some rest day');
  assert.equal(found.q.done, true);
  const trained = questsFor(found.d, [...found.set, done(found.d, { type: 'gym', source: 'custom' })], {});
  assert.ok(!trained.some((x) => x.id === 'rest-day'), 'training that day makes it not a rest day');
  assert.ok(ws.length);
});

test("'train 45+' is not offered on a rest day from REST_SINCE", () => {
  for (let k = 0; k < 30; k++) {
    const d = addDays(REST_SINCE, k * 3);
    const qs = questsFor(d, [plan(addDays(d, -1)), plan(addDays(d, 1))], {});
    assert.ok(!qs.some((q) => q.id === 'min-45'), d);
  }
});

test('rest quest claims wait for the server and for the day to end', () => {
  assert.equal(CLAIMABLE.has('rest-day'), false);
  let d = null;
  for (let k = 0; k < 40 && !d; k++) {
    const c = addDays(REST_SINCE, k * 3);
    if (questsFor(c, [plan(addDays(c, -1)), plan(addDays(c, 1))], {}).some((q) => q.id === 'rest-day')) d = c;
  }
  const ws = [plan(addDays(d, -1)), plan(addDays(d, 1))];
  const ledger = { ...emptyLedger(), backfilled: true };
  const withServer = new Set([...CLAIMABLE, 'rest-day']);
  assert.ok(!pendingClaims(d, ws, {}, ledger).some((c) => c.quest_id === 'rest-day'), 'not claimable yet');
  assert.ok(!pendingClaims(d, ws, {}, ledger, { claimable: withServer }).some((c) => c.quest_id === 'rest-day'), 'not on the day itself');
  assert.ok(pendingClaims(addDays(d, 1), ws, {}, ledger, { claimable: withServer }).some((c) => c.quest_id === 'rest-day' && c.day === d));
});

// ---- week + season path ----------------------------------------------------------

test('week path: Monday to Sunday, flags only from verified sessions, today marked', () => {
  const today = '2026-10-07'; // Wednesday
  const ws = [done('2026-10-05'), plan('2026-10-06', { completed: true }), plan('2026-10-07', { type: 'swim' }), plan('2026-10-09')];
  const p = weekPath(ws, today, [{ title: 'Half', date: '2026-11-01' }]);
  assert.equal(p.days.length, 7);
  assert.equal(p.days[0].date, '2026-10-05');
  assert.equal(p.days[0].flag, true);
  assert.equal(p.days[1].flag, false, 'completed without Strava plants no flag');
  assert.equal(p.days[2].isToday, true);
  assert.deepEqual(p.days[2].types, ['swim']);
  assert.equal(p.days[3].rest, true, 'Thu between planned Wed and Fri is rest');
  assert.equal(p.event.daysLeft, 25);
});

test('next event ignores past events; season path runs to the event week', () => {
  assert.equal(nextEvent([{ date: '2026-09-01' }], '2026-10-07'), null);
  const s = seasonPath([], '2026-10-07', [{ title: 'Race', date: '2026-11-01' }]);
  assert.equal(s.weeks[0].start, '2026-10-05');
  assert.equal(s.weeks.at(-1).start, '2026-10-26');
  assert.equal(s.weeks.at(-1).isEventWeek, true);
  assert.equal(seasonPath([], '2026-10-07', []).weeks.length, 8);
});

// ---- ranks -----------------------------------------------------------------------

const rows = [
  { user_id: 'a', xp: 900 }, { user_id: 'b', xp: 700 }, { user_id: 'c', xp: 650 }, { user_id: 'me', xp: 500 },
];

test('podium is second, first, third', () => {
  assert.deepEqual(podium(rows).map((r) => r.user_id), ['b', 'a', 'c']);
  assert.deepEqual(podium(rows.slice(0, 1)).map((r) => r.user_id), ['a']);
});

test('rank change since the last visit', () => {
  assert.deepEqual(rankDelta(null, 4), { dir: 'new', by: 0 });
  assert.deepEqual(rankDelta(6, 4), { dir: 'up', by: 2 });
  assert.deepEqual(rankDelta(3, 4), { dir: 'down', by: 1 });
  assert.deepEqual(rankDelta(4, 4), { dir: 'same', by: 0 });
});

test('rival is the athlete directly above; at #1 it is the chaser', () => {
  const r = rivalOf(rows, 'me');
  assert.equal(r.rival.user_id, 'c');
  assert.equal(r.gap, 150);
  assert.ok(Math.abs(r.frac - 500 / 650) < 1e-9);
  const top = rivalOf(rows, 'a');
  assert.equal(top.kind, 'chaser');
  assert.equal(top.gap, 200);
  assert.equal(rivalOf(rows, 'nobody'), null);
});

// ---- time of day -----------------------------------------------------------------

test('time of day buckets', () => {
  assert.equal(timeOfDay(6), 'dawn');
  assert.equal(timeOfDay(12), 'day');
  assert.equal(timeOfDay(18), 'dusk');
  assert.equal(timeOfDay(23), 'night');
  assert.equal(timeOfDay(3), 'night');
  assert.equal(timeOfDay(24), 'night');
});
