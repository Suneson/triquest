// Weekly missions, seasons and the daily stall (js/core/missions.js, seasons.js, stall.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSION_RULES, TRAINING_MISSIONS, REST_MISSIONS, weekOf, weekIndex, weeklyMissions, missionBoard, missionsToClaim, missionRewards, daysLeftInWeek,
} from '../js/core/missions.js';
import { seasonInfo, seasonDaysLeft, previousSeason, seasonKitsWon, seasonRecap, recapDue, SEASON_RULES, seasonKitId } from '../js/core/seasons.js';
import { STALL_ITEMS, stallFor, stallAhead, stallDay, msToNextStall } from '../js/core/stall.js';
import { walletFold } from '../js/core/wallet.js';
import { placeablesFor } from '../js/core/placement.js';

const ride = (id, date, min, km = 0, extra = {}) => ({ id, date, type: 'bike', intensity: 'moderate', durationMin: min, metrics: { distanceKm: km }, completed: true, strava_activity_id: 1, source: 'plan', ...extra });

test('weeks start on Monday and missions start on MISSION_RULES.since', () => {
  assert.equal(weekOf('2026-11-01'), '2026-10-26'); // a Sunday
  assert.equal(weekOf('2026-10-26'), '2026-10-26');
  assert.equal(weekIndex('2026-10-26'), 0);
  assert.equal(weekIndex('2026-11-04'), 1);
  assert.deepEqual(weeklyMissions('2026-10-19'), []);
  assert.equal(daysLeftInWeek('2026-11-01'), 1);
  assert.equal(daysLeftInWeek('2026-10-26'), 7);
});

test('every week: two training missions and one rest mission, rotating with no repeats inside a week', () => {
  const seen = new Set();
  for (let k = 0; k < 24; k++) {
    const week = new Date(Date.parse('2026-10-26T12:00:00Z') + k * 7 * 864e5).toISOString().slice(0, 10);
    const ids = weeklyMissions(week);
    assert.equal(ids.length, MISSION_RULES.training + 1);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(REST_MISSIONS.some((m) => m.id === ids.at(-1)), 'the last one is a rest mission');
    ids.forEach((id) => seen.add(id));
  }
  assert.equal(seen.size, TRAINING_MISSIONS.length + REST_MISSIONS.length, 'the whole pool comes round');
  // the same week is the same board for everyone, from any day in it
  assert.deepEqual(weeklyMissions('2026-11-01'), weeklyMissions('2026-10-27'));
});

test('training missions count only verified sessions in the week', () => {
  const week = '2026-10-26'; // board: w-sessions-3, w-hours-4, w-rest-2
  assert.deepEqual(weeklyMissions(week), ['w-sessions-3', 'w-hours-4', 'w-rest-2']);
  const ws = [
    ride('a', '2026-10-26', 90, 30), ride('b', '2026-10-27', 60, 20),
    ride('c', '2026-10-28', 120, 50, { strava_activity_id: null }), // no proof: doesn't count
    ride('d', '2026-10-25', 300, 100), // last week
  ];
  const b = missionBoard(week, ws, '2026-10-29');
  assert.deepEqual(b.map((m) => [m.id, m.value, m.done]), [['w-sessions-3', 2, false], ['w-hours-4', 150, false], ['w-rest-2', 0, false]]);
  ws.push(ride('e', '2026-10-29', 100, 40));
  const b2 = missionBoard(week, ws, '2026-10-30');
  assert.equal(b2[0].done, true);
  assert.equal(b2[1].value, 240);
  assert.equal(b2[1].done, true);
});

test('rest days count once they are over, and only days with nothing completed', () => {
  const week = '2026-10-26';
  const ws = [ride('a', '2026-10-26', 60), { id: 'p', date: '2026-10-27', type: 'run', durationMin: 40, completed: false }];
  assert.equal(missionBoard(week, ws, '2026-10-27')[2].value, 0, 'Monday trained, Tuesday not over');
  assert.equal(missionBoard(week, ws, '2026-10-28')[2].value, 1, 'a planned but skipped Tuesday is a rest day');
  const done = missionBoard(week, ws, '2026-10-29');
  assert.equal(done[2].done, true);
  assert.deepEqual(missionsToClaim(week, ws, '2026-10-29', []), [{ week, mission_id: 'w-rest-2' }]);
  assert.deepEqual(missionsToClaim(week, ws, '2026-10-29', [{ week, mission_id: 'w-rest-2' }]), []);
});

test('rest missions pay exactly what training missions pay, into the wallet', () => {
  const claims = [
    { week: '2026-10-26', mission_id: 'w-rest-2', claimed_at: '2026-10-29T08:00:00.000Z' },
    { week: '2026-10-26', mission_id: 'w-sessions-3', claimed_at: '2026-10-30T08:00:00.000Z' },
    { week: '2026-10-26', mission_id: 'not-a-mission', claimed_at: '2026-10-30T08:00:00.000Z' },
  ];
  const r = missionRewards(claims);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0].coins, r[1].coins);
  assert.deepEqual(r[0].carbs, r[1].carbs);
  const a = walletFold({});
  const b = walletFold({ missions: claims });
  assert.equal(b.coins - a.coins, 2 * MISSION_RULES.reward.coins);
  assert.equal(b.carbs - a.carbs, 2 * MISSION_RULES.reward.carbs);
});

test('seasons are calendar quarters with a theme', () => {
  const s = seasonInfo('2026-11-15');
  assert.deepEqual([s.id, s.start, s.end, s.theme.id], ['2026-Q4', '2026-10-01', '2026-12-31', 'mar-de-nubes']);
  assert.equal(seasonInfo('2027-Q1').end, '2027-03-31');
  assert.equal(seasonInfo('2028-02-10').end, '2028-03-31');
  assert.equal(previousSeason('2027-Q1'), '2026-Q4');
  assert.equal(previousSeason('2027-Q3'), '2027-Q2');
  assert.equal(seasonDaysLeft('2026-12-31'), 1);
  assert.equal(recapDue('2026-11-01'), null, 'no season before the first');
  assert.equal(recapDue('2027-01-02'), '2026-Q4');
  assert.equal(recapDue('2027-01-02', ['2026-Q4']), null);
});

test('a season kit is won with the kitMissions-th mission in the season, once per theme, and kept', () => {
  const weeks = ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'];
  const claims = weeks.map((week, i) => ({ week, mission_id: 'w-rest-2', claimed_at: `2026-11-${String(i + 1).padStart(2, '0')}T08:00:00.000Z` }));
  assert.deepEqual(seasonKitsWon(claims), []);
  claims.push({ week: '2026-11-30', mission_id: 'w-sessions-3', claimed_at: '2026-12-02T08:00:00.000Z' });
  assert.deepEqual(seasonKitsWon(claims), [{ item_id: seasonKitId('mar-de-nubes'), acquired_at: '2026-12-02T08:00:00.000Z', season: '2026-Q4' }]);
  // the same theme a year on gives nothing new; the first one stays
  const later = Array.from({ length: SEASON_RULES.kitMissions }, (_, i) => ({ week: `2027-10-${String(4 + i * 7).padStart(2, '0')}`, mission_id: 'w-rest-1', claimed_at: `2027-10-${String(5 + i * 7).padStart(2, '0')}T08:00:00.000Z` }));
  const won = seasonKitsWon([...claims, ...later]);
  assert.equal(won.length, 1);
  assert.equal(won[0].season, '2026-Q4');
});

test('the season recap adds up what the season held', () => {
  const ws = [ride('a', '2026-10-27', 60, 30), ride('b', '2026-12-30', 90, 45), ride('c', '2027-01-02', 600, 300)];
  const r = seasonRecap('2026-Q4', { workouts: ws, claims: [{ week: '2026-10-26', mission_id: 'w-rest-2' }], featAwards: [{ featId: 'x', season: '2026-Q4' }, { featId: 'y', season: '2027-Q1' }] });
  assert.equal(r.sessions, 2);
  assert.equal(r.hours, 2.5);
  assert.equal(r.km, 75);
  assert.equal(r.missions, 1);
  assert.equal(r.feats, 1);
  assert.equal(r.kit, null);
  assert.ok(r.coins >= MISSION_RULES.reward.coins);
});

test('the stall: one item a day, the same for everyone, walking the list in order', () => {
  assert.equal(stallFor('2026-10-27'), null);
  assert.equal(stallFor('2026-10-28').id, STALL_ITEMS[0].id);
  assert.equal(stallFor('2026-10-29').id, STALL_ITEMS[1].id);
  assert.equal(STALL_ITEMS.length, 8);
  assert.equal(stallFor('2026-11-05').id, STALL_ITEMS[0].id, 'after the last item the list starts again');
  assert.deepEqual(stallAhead('2026-10-28', 2).map((x) => x.item.id), [STALL_ITEMS[1].id, STALL_ITEMS[2].id]);
  assert.equal(stallDay(Date.parse('2026-10-28T23:59:00Z')), '2026-10-28');
  assert.equal(msToNextStall(Date.parse('2026-10-28T23:59:00Z')), 60e3);
  assert.ok(STALL_ITEMS.every((i) => i.currency === 'coins' && i.cost > 0));
});

test('stall items stand in the rooms once they are yours', () => {
  const ids = (inv) => placeablesFor(inv).map((p) => p.id);
  assert.ok(!ids([]).includes('decor-plant'));
  assert.ok(ids([{ item_id: 'decor-plant' }]).includes('decor-plant'));
});
