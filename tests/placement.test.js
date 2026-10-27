// The unified compound and its item placement (js/core/placement.js, docs/COMPOUND.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  compoundLayout, roomsOf, roomArt, normalizeDisciplines, ROOM_GEOMETRY, ROOM_SIZE, tileToPct, pctToTile, boxCorners,
  canPlace, firstFree, footprint, placeableById, placeablesFor, resolvePlacements, PLACEABLES, DISCIPLINES,
} from '../js/core/placement.js';

const shape = (l) => l.rows.map((r) => r.map((c) => `${c.room}${c.landscape ? ':wide' : ''}`).join(' ')).join(' / ');

test('layouts for one to four disciplines', () => {
  assert.equal(shape(compoundLayout(['run'])), 'run / locker');
  assert.equal(compoundLayout(['run']).cols, 1);
  assert.equal(shape(compoundLayout(['bike', 'run'])), 'bike run / locker:wide');
  assert.equal(shape(compoundLayout(['run', 'swim', 'bike'])), 'pool bike / run locker');
  assert.equal(shape(compoundLayout(['bike', 'run', 'gym', 'swim'])), 'gym pool / bike run / locker:wide');
  assert.equal(shape(compoundLayout([])), 'gym pool / bike run / locker:wide', 'nothing chosen: all four');
  assert.deepEqual(normalizeDisciplines(['swim', 'kayak', 'swim']), ['pool']);
  // every room has a column and the wide locker spans both
  const rooms = roomsOf(compoundLayout(DISCIPLINES));
  assert.equal(rooms.length, 5);
  assert.deepEqual(rooms.find((r) => r.landscape), { room: 'locker', geom: 'locker-landscape', col: 0, span: 2, landscape: true, row: 2 });
});

test('room art: the landscape locker clamps to level 4; the missing gym level falls back; every file exists', () => {
  assert.equal(roomArt('locker', 1, true), 'icons/Pixelart/NEW/LOCKER/landscape-4.webp');
  assert.equal(roomArt('locker', 3, true), 'icons/Pixelart/NEW/LOCKER/landscape-4.webp');
  assert.equal(roomArt('locker', 7, true), 'icons/Pixelart/NEW/LOCKER/landscape-7.webp');
  assert.equal(roomArt('locker', 2), 'icons/Pixelart/NEW/LOCKER/square-2.webp');
  assert.equal(roomArt('gym', 7), 'icons/Pixelart/NEW/GYM/level-6.webp');
  assert.equal(roomArt('bike', 14), 'icons/Pixelart/NEW/BIKE/level-10.webp');
  assert.equal(roomArt('pool', 0), 'icons/Pixelart/NEW/POOL/level-1.webp');
  for (let n = 1; n <= 10; n++) {
    for (const r of ['gym', 'pool', 'bike', 'run']) assert.ok(existsSync(roomArt(r, n)), roomArt(r, n));
    assert.ok(existsSync(roomArt('locker', n)), `locker ${n}`);
    assert.ok(existsSync(roomArt('locker', n, true)), `wide locker ${n}`);
  }
  for (const p of PLACEABLES) assert.ok(existsSync(p.art({ inventory: [], rider: 'icons/Pixelart/BIKE/CHARACTERS/bikelvl1_char.webp' })), p.id);
});

test('the floor maps both ways', () => {
  for (const key of Object.keys(ROOM_GEOMETRY)) {
    assert.ok(ROOM_SIZE[key], key);
    for (const [u, v] of [[0, 0], [1.5, 2.25], [3, 7]]) {
      const p = tileToPct(key, u, v);
      const back = pctToTile(key, p.x, p.y);
      assert.ok(Math.abs(back.u - u) < 1e-9 && Math.abs(back.v - v) < 1e-9, `${key} ${u},${v}`);
    }
    const g = ROOM_GEOMETRY[key];
    assert.deepEqual(tileToPct(key, 0, 0), { x: g.back[0], y: g.back[1] });
    assert.equal(boxCorners(key, 0, 0, g.cols, g.rows)[1].x, g.right[0]);
  }
});

test('placing: walls and edges, the pool, other items', () => {
  const coffee = placeableById('coffee-machine');
  const trainer = placeableById('smart-trainer');
  assert.deepEqual(footprint(trainer, 2, 3), [[2, 3], [3, 3]]);
  assert.equal(canPlace('gym', 'gym', coffee, 0, 0).ok, true);
  assert.equal(canPlace('gym', 'gym', coffee, -1, 0).reason, 'bounds', 'off the floor: into the wall');
  assert.equal(canPlace('gym', 'gym', trainer, 7, 0).reason, 'bounds', 'half through the right wall');
  assert.equal(canPlace('gym', 'gym', coffee, 1.5, 0).reason, 'bounds', 'only whole tiles');
  assert.equal(canPlace('pool', 'pool', coffee, 5, 3).reason, 'blocked', 'not in the water');
  assert.equal(canPlace('pool', 'pool', coffee, 1, 1).ok, true, 'the deck is fine');
  assert.equal(canPlace('pool', 'pool', trainer, 3, 2).reason, 'blocked', 'one tile on the deck, one in the water');
  const placed = { 'coffee-machine': { room: 'bike', u: 1, v: 1 } };
  assert.equal(canPlace('bike', 'bike', trainer, 0, 1, placed).reason, 'occupied');
  assert.equal(canPlace('bike', 'bike', trainer, 2, 1, placed).ok, true);
  assert.equal(canPlace('gym', 'gym', trainer, 0, 1, placed).ok, true, 'another room is another floor');
  assert.equal(canPlace('bike', 'bike', coffee, 1, 1, placed).ok, true, 'an item never blocks itself');
  // the wide locker has its own shape
  assert.equal(canPlace('locker-landscape', 'locker', coffee, 7, 15).ok, true);
  assert.equal(canPlace('locker-landscape', 'locker', coffee, 8, 0).reason, 'bounds');
});

test('the gifts and the trainer; a spot for each, kept when it still fits', () => {
  assert.deepEqual(placeablesFor([]).map((p) => p.id), ['coffee-machine', 'smart-bike'], 'everyone has the coffee machine and their bike');
  assert.deepEqual(placeablesFor([], ['run', 'locker']).map((p) => p.id), ['coffee-machine'], 'no bike room, no bike');
  assert.deepEqual(placeablesFor([{ item_id: 'bike-power-t2' }]).map((p) => p.id), ['coffee-machine', 'smart-bike'], 'pedals are not a trainer');
  assert.deepEqual(placeablesFor([{ item_id: 'bike-power-t3' }]).map((p) => p.id), ['coffee-machine', 'smart-bike', 'smart-trainer']);
  const items = placeablesFor([{ item_id: 'bike-power-t3' }]);
  const full = compoundLayout(DISCIPLINES);
  const at = resolvePlacements(full, items, {});
  assert.equal(at['coffee-machine'].room, 'locker');
  assert.equal(at['smart-bike'].room, 'bike');
  assert.equal(at['smart-trainer'].room, 'bike');
  assert.ok(canPlace('bike', 'bike', placeableById('smart-trainer'), at['smart-trainer'].u, at['smart-trainer'].v, at).ok);
  assert.ok(canPlace('bike', 'bike', placeableById('smart-bike'), at['smart-bike'].u, at['smart-bike'].v, at).ok, 'they do not overlap');
  // a saved spot stays; one that no longer fits (or whose room is gone) moves
  const kept = resolvePlacements(full, items, { 'coffee-machine': { room: 'pool', u: 0, v: 7 } });
  assert.deepEqual(kept['coffee-machine'], { room: 'pool', u: 0, v: 7 });
  const runOnly = resolvePlacements(compoundLayout(['run']), placeablesFor([{ item_id: 'bike-power-t3' }], ['run', 'locker']), { 'coffee-machine': { room: 'pool', u: 0, v: 7 } });
  assert.equal(runOnly['coffee-machine'].room, 'locker');
  assert.equal(runOnly['smart-trainer'].room, 'locker', 'no bike room: the trainer waits in the locker');
  const wet = resolvePlacements(full, items, { 'coffee-machine': { room: 'pool', u: 5, v: 3 } });
  assert.notDeepEqual(wet['coffee-machine'], { room: 'pool', u: 5, v: 3 });
  assert.equal(firstFree('locker-square', 'locker', placeableById('coffee-machine'), {}).room, 'locker');
});
