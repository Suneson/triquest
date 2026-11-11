// The athlete's walks round the floor (js/core/walk.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridOf, findPath, entryTile, besideItem, wanderTile, freeByDistance, floorGrid, facing } from '../js/core/walk.js';

test('walks straight and diagonally, the shortest way', () => {
  const g = gridOf(['.....', '.....', '.....']);
  assert.deepEqual(findPath(g, [0, 0], [2, 2]), [[0, 0], [1, 1], [2, 2]]);
  assert.equal(findPath(g, [0, 0], [4, 0]).length, 5);
});

test('goes round what stands in the way, and never cuts a corner', () => {
  const g = gridOf([
    '.#...',
    '.#.#.',
    '...#.',
  ]);
  const p = findPath(g, [0, 0], [4, 0]);
  assert.ok(p);
  for (let i = 1; i < p.length; i++) {
    const [u0, v0] = p[i - 1]; const [u1, v1] = p[i];
    assert.ok(g.free(u1, v1));
    if (u1 !== u0 && v1 !== v0) assert.ok(g.free(u1, v0) && g.free(u0, v1), `corner cut at ${p[i]}`);
  }
  assert.equal(findPath(gridOf(['.#.', '#..']), [0, 0], [2, 1]), null, 'walled in: no way');
  assert.equal(findPath(g, [1, 0], [0, 0]), null, 'never starts on a taken tile');
});

test('comes into a room on the free tile nearest the middle', () => {
  assert.deepEqual(entryTile(gridOf(['....', '.#..', '..#.', '....'])), [1, 2]);
  assert.equal(entryTile(gridOf(['##', '##'])), null);
  assert.deepEqual(freeByDistance(gridOf(['...']), 0, 0.5)[0], [0, 0]);
});

test('stands beside a machine, on the side nearest, where it can walk to', () => {
  const g = gridOf([
    '......',
    '.##...',
    '.##...',
    '......',
  ]);
  const t = besideItem(g, { w: 2, h: 2 }, { u: 1, v: 1 }, [5, 3]);
  assert.deepEqual(t, [3, 3]);
  assert.deepEqual(besideItem(g, { w: 2, h: 2 }, { u: 1, v: 1 }, [5, 3], [0, -1]), [2, 0], 'gets on from the side asked for');
  assert.equal(besideItem(gridOf(['###', '###']), { w: 1, h: 1 }, { u: 1, v: 0 }, [0, 0]), null);
});

test('wanders somewhere it can reach, at least two steps away', () => {
  const g = gridOf(['......', '......', '......', '......']);
  let n = 0; const rand = () => ((n = (n * 7 + 3) % 11) / 11);
  for (let i = 0; i < 20; i++) {
    const t = wanderTile(g, [2, 2], rand);
    assert.ok(t && g.free(...t));
    assert.ok(Math.max(Math.abs(t[0] - 2), Math.abs(t[1] - 2)) >= 2);
  }
  assert.equal(wanderTile(gridOf(['.#', '##']), [0, 0]), null);
});

test('a real room: items take their tiles, the floor ends at the walls', () => {
  const g = floorGrid('locker-square', 'locker', { 'ice-bath': { room: 'locker', u: 0, v: 0 } });
  assert.equal(g.cols, 8);
  assert.equal(g.free(0, 0), false);
  assert.equal(g.free(7, 7), true);
  assert.equal(g.free(8, 0), false);
});

test('faces the way it walks', () => {
  assert.equal(facing(0, 1), 0);
  assert.equal(facing(1, 0), Math.PI / 2);
});
