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
