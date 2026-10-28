// Clubs: names, targets, the relay routes and the line that fills in (js/core/clubs.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLUB_RULES, RELAY_ROUTES, routeById, nextRoute, routePoints, routePath, routeLength, relayProgress, checkClubName, weeklyTargetMin, weekStanding, crestArt,
} from '../js/core/clubs.js';

test('club names: tidied, 3 to 24 characters, letters and a little punctuation', () => {
  assert.deepEqual(checkClubName('  Los   Alisios  '), { name: 'Los Alisios' });
  assert.deepEqual(checkClubName('Tri-Club Telde & Co.'), { name: 'Tri-Club Telde & Co.' });
  assert.deepEqual(checkClubName('Año Ñandú'), { name: 'Año Ñandú' });
  assert.deepEqual(checkClubName('ab'), { error: 'short' });
  assert.deepEqual(checkClubName('x'.repeat(25)), { error: 'long' });
  assert.deepEqual(checkClubName('<script>'), { error: 'chars' });
});

test('the weekly target: the club\'s own, or the default for its size', () => {
  assert.equal(weeklyTargetMin(4), 4 * CLUB_RULES.defaultMinPerMember);
  assert.equal(weeklyTargetMin(0), CLUB_RULES.defaultMinPerMember);
  assert.equal(weeklyTargetMin(4, 600), 600);
  assert.deepEqual(weekStanding(300, 600), { minutes: 300, target: 600, frac: 0.5, done: false });
  assert.equal(weekStanding(900, 600).frac, 1);
  assert.equal(weekStanding(900, 600).done, true);
});

test('relay routes: closed loops on the map, taken in order and round again', () => {
  for (const r of RELAY_ROUTES) {
    const pts = routePoints(r);
    assert.deepEqual(pts[0], pts.at(-1), `${r.id} ends where it starts`);
    assert.ok(pts.every(([x, y]) => x > 0 && x < 100 && y > 0 && y < 100), `${r.id} stays on the map`);
    assert.ok(routePath(r).startsWith('M'));
    assert.ok(routeLength(r) > 50);
  }
  assert.equal(nextRoute(RELAY_ROUTES[0].id).id, RELAY_ROUTES[1].id);
  assert.equal(nextRoute(RELAY_ROUTES.at(-1).id).id, RELAY_ROUTES[0].id);
  assert.equal(routeById('nope'), null);
  assert.ok(RELAY_ROUTES.every((r, i) => i === 0 || r.km > RELAY_ROUTES[i - 1].km), 'each route is longer than the last');
});

test('relay progress fills the line and puts the marker on it', () => {
  const r = RELAY_ROUTES[1];
  const start = relayProgress(r, 0);
  assert.deepEqual(start.at, routePoints(r)[0]);
  assert.equal(start.frac, 0);
  const half = relayProgress(r, r.km / 2);
  assert.equal(half.frac, 0.5);
  assert.equal(half.done, false);
  const end = relayProgress(r, r.km + 40);
  assert.equal(end.frac, 1);
  assert.equal(end.done, true);
  assert.deepEqual(end.at, routePoints(r).at(-1));
});

test('crests fall back to the first one', () => {
  assert.equal(crestArt('bolt'), 'icons/Pixelart/NEW/CLUBS/crest-bolt.png');
  assert.equal(crestArt('../evil'), 'icons/Pixelart/NEW/CLUBS/crest-wave.png');
});
