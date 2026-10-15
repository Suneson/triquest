import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mainSet, sessionLine, dayLine, MOMENT_LINES } from '../js/core/coach-lines.js';

test('mainSet pulls the [Main Set] block', () => {
  assert.equal(mainSet('[Warmup] 10 min easy [Main Set] 4x8min @ 250W [Cooldown] spin'), '4x8min @ 250W');
  assert.equal(mainSet('no structure'), '');
});

test('sessionLine prefers the main set, then the zone, then intensity', () => {
  assert.match(sessionLine({ type: 'bike', notes: '[Main Set] 3x10min @ 240W.', hr_zone: 4 }), /Main set: 3x10min @ 240W\.$/);
  assert.match(sessionLine({ type: 'run', hr_zone: 2 }), /Zone 2/);
  assert.match(sessionLine({ type: 'swim', intensity: 'vo2' }), /full recoveries/i);
  assert.match(sessionLine({ type: 'run', completed: true, strava_activity_id: 1 }), /Verified/);
  assert.match(sessionLine({ type: 'run', completed: true }), /Link it on Strava/);
  assert.equal(sessionLine(null), '');
});

test('sessionLine keeps long main sets short', () => {
  const long = '[Main Set] ' + 'a'.repeat(300);
  assert.ok(sessionLine({ type: 'run', notes: long }).length < 130);
});

test('dayLine covers the day states', () => {
  assert.match(dayLine({ planned: 1, verified: 1, questsDone: 3, questsTotal: 3, streak: 4 }), /All quests cleared/);
  assert.match(dayLine({ planned: 1, verified: 1, questsDone: 1, questsTotal: 3, streak: 4 }), /4 days in a row/);
  assert.match(dayLine({ planned: 0, verified: 0, questsDone: 0, questsTotal: 1, streak: 0 }), /Rest day/);
  assert.match(dayLine({ planned: 1, verified: 0, questsDone: 0, questsTotal: 3, streak: 2 }), /Streak on 2/);
  assert.match(dayLine({ planned: 1, verified: 0, questsDone: 0, questsTotal: 3, streak: 0 }), /Strava verifies/);
});

test('moment lines fill in their values', () => {
  assert.match(MOMENT_LINES.questDone('Train 45+ minutes today'), /Train 45\+ minutes today/);
  assert.match(MOMENT_LINES.sportLevel('Gym', 4), /Gym level 4/);
});

test('race day: the coach talks about the race, by sport', async () => {
  const { raceOn, raceLine } = await import('../js/core/coach-lines.js');
  const ws = [{ date: '2026-10-19', isRace: true, type: 'brick', title: 'IRONMAN 70.3 — RACE DAY', completed: false }];
  const race = raceOn(ws, [], '2026-10-19');
  assert.deepEqual(race, { title: 'IRONMAN 70.3', type: 'brick', done: false });
  const line = dayLine({ planned: 1, verified: 0, questsDone: 0, questsTotal: 3, streak: 2, race, today: '2026-10-19' });
  assert.match(line, /IRONMAN 70\.3/);
  assert.match(line, /run proud/);
  assert.equal(line, dayLine({ planned: 1, verified: 0, questsDone: 0, questsTotal: 3, streak: 2, race, today: '2026-10-19' }));
  assert.match(dayLine({ planned: 1, verified: 1, questsDone: 3, questsTotal: 3, streak: 2, race, today: '2026-10-19' }), /done\. .*Proud of you/);
  assert.match(sessionLine(ws[0]), /IRONMAN 70\.3/);
  assert.match(raceLine(race, { eve: true }), /tomorrow/);
});

test('race from saved events, and none on an ordinary day', async () => {
  const { raceOn } = await import('../js/core/coach-lines.js');
  const ev = [{ title: 'Berlin Marathon', date: '2026-09-27' }];
  assert.equal(raceOn([], ev, '2026-09-27').title, 'Berlin Marathon');
  assert.equal(raceOn([], ev, '2026-09-26'), null);
  assert.match(dayLine({ planned: 1, verified: 0, questsDone: 0, questsTotal: 3, streak: 0, raceTomorrow: raceOn([], ev, '2026-09-27') }), /Berlin Marathon is tomorrow/);
});
