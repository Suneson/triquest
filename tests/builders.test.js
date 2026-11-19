import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDERS, builderId, hasBuilder, builderCount } from '../js/core/builders.js';
import { placeablesFor, canPlace, orient, placeableById } from '../js/core/placement.js';

const huts = (inv, plot) => placeablesFor(inv, null, { plot }).filter((p) => p.id.startsWith('builder-')).map((p) => p.id);

test('you start with one builder and hire the others', () => {
  assert.equal(builderCount([]), 1);
  assert.ok(hasBuilder(BUILDERS[0], []));
  assert.ok(!hasBuilder(BUILDERS[1], []));
  assert.ok(hasBuilder(BUILDERS[1], [{ item_id: builderId(BUILDERS[1].who) }]));
  assert.ok(BUILDERS.slice(1).every((b) => b.cost > 0));
});

test('the huts are items only on the single-plot base', () => {
  assert.deepEqual(huts([], false), []);
  assert.deepEqual(huts([], true), ['builder-blue']);
  assert.deepEqual(huts([{ item_id: 'builder-gold' }], true), ['builder-blue', 'builder-gold']);
});

test('every hut fits its first spot on the lawn, in its first facing', () => {
  const placed = {};
  for (const b of BUILDERS) {
    const it = orient(placeableById(builderId(b.who)), b.face);
    assert.ok(canPlace('plot-48', 'locker', it, ...b.spot, placed).ok, b.who);
    placed[it.id] = { room: 'locker', u: b.spot[0], v: b.spot[1], face: b.face };
  }
});
