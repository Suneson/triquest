// The compound as one building (js/core/compound-geometry.js, docs/COMPOUND.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compoundGeometry, apply, invert, affineFrom3, roomToWorld, worldToRoom, ISO_METRICS, wallClip } from '../js/core/compound-geometry.js';
import { compoundLayout, ROOM_GEOMETRY, DISCIPLINES, boxCorners } from '../js/core/placement.js';

const near = (a, b, eps = 0.01) => Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
const floorCorner = (room, which) => {
  const g = ROOM_GEOMETRY[room.geom];
  const p = which === 'front' ? [g.right[0] + g.left[0] - g.back[0], g.right[1] + g.left[1] - g.back[1]] : g[which];
  return roomToWorld(room, p[0], p[1]);
};
// a block's world corner (cu, cv) relative to the gym's back corner
const at = (geo, u, v) => {
  const o = floorCorner(geo.rooms.find((r) => r.cu === 0 && r.cv === 0), 'back');
  return [o[0] + u * ISO_METRICS.U[0] + v * ISO_METRICS.V[0], o[1] + u * ISO_METRICS.U[1] + v * ISO_METRICS.V[1]];
};

test('matrices: affine from three points, apply and invert', () => {
  const M = affineFrom3([[0, 0], [10, 0], [0, 10]], [[5, 5], [25, 15], [-5, 25]]);
  assert.ok(near(apply(M, [10, 10]), [15, 35]));
  assert.ok(near(apply(invert(M), apply(M, [3, 7])), [3, 7]));
});

test('four disciplines: one building, every floor on its block, edges shared', () => {
  const geo = compoundGeometry(compoundLayout(DISCIPLINES));
  const by = (room) => geo.rooms.find((r) => r.room === room);
  // the blocks, as in the diagram
  assert.deepEqual(['gym', 'pool', 'bike', 'run', 'locker'].map((r) => [by(r).cu, by(r).cv]), [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]]);
  assert.ok(near(floorCorner(by('pool'), 'back'), at(geo, 1, 0)), 'pool starts where the gym ends along U');
  assert.ok(near(floorCorner(by('bike'), 'back'), at(geo, 0, 1)), 'bike starts where the gym ends along V');
  assert.ok(near(floorCorner(by('run'), 'back'), at(geo, 1, 1)), 'run is in front of the gym');
  assert.ok(near(floorCorner(by('gym'), 'front'), at(geo, 1, 1)), 'the gym\'s front corner is the run\'s back corner');
  assert.ok(near(floorCorner(by('run'), 'front'), at(geo, 2, 2)));
  // the wide locker runs along U under bike and run (its art mirrored)
  const lk = by('locker');
  assert.ok(near(floorCorner(lk, 'back'), at(geo, 0, 2)));
  assert.ok(near(floorCorner(lk, 'left'), at(geo, 2, 2)), 'its long side ends under the run room');
  assert.ok(near(floorCorner(lk, 'right'), at(geo, 0, 3)));
  assert.ok(lk.M[0] * lk.M[3] - lk.M[1] * lk.M[2] < 0, 'mirrored');
  // drawn back to front, and everything starts at (0, 0)
  assert.deepEqual(geo.rooms.map((r) => r.room), ['gym', 'bike', 'pool', 'run', 'locker']);
  assert.ok(geo.W > 0 && geo.H > 0);
  // a world point maps back into the room
  const q = worldToRoom(by('run'), ...roomToWorld(by('run'), 40, 60));
  assert.ok(near([q.x, q.y], [40, 60]));
});

test('tiles are the same size in every room of the building', () => {
  const geo = compoundGeometry(compoundLayout(DISCIPLINES));
  const len = (room) => {
    const [b, r] = boxCorners(room.geom, 0, 0, 1, 1).map((c) => roomToWorld(room, c.x, c.y));
    return Math.hypot(r[0] - b[0], r[1] - b[1]);
  };
  const sizes = geo.rooms.map(len);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) < 1, sizes.join(', '));
});

test('interior walls are cut; outer walls stand', () => {
  const geo = compoundGeometry(compoundLayout(DISCIPLINES));
  const by = (room) => geo.rooms.find((r) => r.room === room);
  assert.equal(by('gym').clip, wallClip('gym', false, false), 'the gym has both outer walls');
  assert.equal(by('pool').clip, wallClip('pool', true, false), 'the pool\'s left wall is the gym\'s');
  assert.equal(by('bike').clip, wallClip('bike', false, true), 'the bike room\'s right wall is the gym\'s');
  assert.equal(by('run').clip, wallClip('run', true, true), 'the run room is inside');
  // other layouts build too
  for (const ds of [['run'], ['bike', 'run'], ['pool', 'bike', 'run']]) {
    const g = compoundGeometry(compoundLayout(ds));
    assert.equal(g.rooms.length, ds.length + 1);
    assert.ok(Number.isFinite(g.W) && Number.isFinite(g.H));
  }
});
