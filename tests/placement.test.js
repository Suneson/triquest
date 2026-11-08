// The unified compound and its item placement (js/core/placement.js, docs/COMPOUND.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  compoundLayout, roomsOf, roomArt, normalizeDisciplines, ROOM_GEOMETRY, ROOM_SIZE, tileToPct, pctToTile, boxCorners,
  canPlace, firstFree, footprint, placeableById, placeablesFor, resolvePlacements, PLACEABLES, DISCIPLINES, orient, turned, tierFor,
  stashedItems, displaySlots, toggleDisplay,
} from '../js/core/placement.js';
import { stageGeom } from '../js/core/diorama.js';

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
  assert.equal(canPlace('bike', 'bike', trainer, 3, 1, placed).ok, true);
  assert.equal(canPlace('gym', 'gym', trainer, 0, 1, placed).ok, true, 'another room is another floor');
  assert.equal(canPlace('bike', 'bike', coffee, 1, 1, placed).ok, true, 'an item never blocks itself');
  // the wide locker has its own shape
  assert.equal(canPlace('locker-landscape', 'locker', coffee, 6, 14).ok, true);
  assert.equal(canPlace('locker-landscape', 'locker', coffee, 8, 0).reason, 'bounds');
});

test('the gifts and the trainer; a spot for each, kept when it still fits', () => {
  // the mission boards are checked on their own below
  const ids = (list) => list.map((p) => p.id).filter((id) => !id.startsWith('mission-board-'));
  assert.deepEqual(ids(placeablesFor([])), ['coffee-machine', 'smart-bike', 'treadmill', 'road-bike-stand', 'trophy-gold-mountain'], 'everyone has the coffee machine, their bike and their treadmill');
  assert.deepEqual(ids(placeablesFor([], ['run', 'locker'])), ['coffee-machine', 'treadmill', 'trophy-gold-mountain'], 'no bike room, no bike');
  assert.deepEqual(ids(placeablesFor([], ['bike', 'locker'])), ['coffee-machine', 'smart-bike', 'road-bike-stand', 'trophy-gold-mountain'], 'no run room, no treadmill');
  assert.deepEqual(ids(placeablesFor([{ item_id: 'bike-power-t2' }])), ['coffee-machine', 'smart-bike', 'treadmill', 'road-bike-stand', 'trophy-gold-mountain'], 'pedals are not a trainer');
  assert.deepEqual(ids(placeablesFor([{ item_id: 'bike-power-t3' }])), ['coffee-machine', 'smart-bike', 'treadmill', 'road-bike-stand', 'trophy-gold-mountain', 'smart-trainer']);
  const items = placeablesFor([{ item_id: 'bike-power-t3' }]);
  const full = compoundLayout(DISCIPLINES);
  const at = resolvePlacements(full, items, {});
  assert.equal(at['coffee-machine'].room, 'locker');
  assert.equal(at['smart-bike'].room, 'bike');
  assert.equal(at['smart-trainer'].room, 'bike');
  assert.equal(at.treadmill.room, 'run');
  assert.ok(canPlace('run', 'run', orient(placeableById('treadmill'), at.treadmill.face), at.treadmill.u, at.treadmill.v, at).ok);
  assert.ok(canPlace('bike', 'bike', placeableById('smart-trainer'), at['smart-trainer'].u, at['smart-trainer'].v, at).ok);
  assert.ok(canPlace('bike', 'bike', orient(placeableById('smart-bike'), at['smart-bike'].face), at['smart-bike'].u, at['smart-bike'].v, at).ok, 'they do not overlap');
  // a saved spot stays; one that no longer fits (or whose room is gone) moves
  const kept = resolvePlacements(full, items, { 'coffee-machine': { room: 'pool', u: 0, v: 6 } });
  assert.deepEqual(kept['coffee-machine'], { room: 'pool', u: 0, v: 6, face: 'a' });
  const runOnly = resolvePlacements(compoundLayout(['run']), placeablesFor([{ item_id: 'bike-power-t3' }], ['run', 'locker']), { 'coffee-machine': { room: 'pool', u: 0, v: 7 } });
  assert.equal(runOnly['coffee-machine'].room, 'locker');
  assert.equal(runOnly['smart-trainer'].room, 'locker', 'no bike room: the trainer waits in the locker');
  const wet = resolvePlacements(full, items, { 'coffee-machine': { room: 'pool', u: 5, v: 3 } });
  assert.notDeepEqual(wet['coffee-machine'], { room: 'pool', u: 5, v: 3 });
  assert.equal(firstFree('locker-square', 'locker', placeableById('coffee-machine'), {}).room, 'locker');
});

test('a mission board stands in every room, at the back, and only in rooms you have', () => {
  const full = compoundLayout(DISCIPLINES);
  const items = placeablesFor([]);
  const at = resolvePlacements(full, items, {});
  for (const room of ['bike', 'pool', 'run', 'gym', 'locker']) {
    assert.deepEqual(at[`mission-board-${room}`], { room, u: 1, v: 0 }, room);
    assert.equal(placeableById(`mission-board-${room}`).opens, 'missions');
  }
  const runOnly = placeablesFor([], ['run', 'locker']).map((p) => p.id).filter((id) => id.startsWith('mission-board-'));
  assert.deepEqual(runOnly, ['mission-board-run', 'mission-board-locker']);
});

test('facings: turning an item turns its footprint, and a saved facing is kept', () => {
  const tm = placeableById('treadmill');
  assert.deepEqual([orient(tm).face, orient(tm).w, orient(tm).h], ['a', 2, 3], 'the treadmill stands long along v at first');
  assert.deepEqual([orient(tm, 'b').w, orient(tm, 'b').h], [3, 2]);
  assert.equal(turned('a'), 'b'); assert.equal(turned('b'), 'a');
  assert.equal(orient(placeableById('smart-trainer'), 'b').w, 2, 'one facing: as it is');
  assert.equal(tierFor(1, [4, 7]), 1); assert.equal(tierFor(4, [4, 7]), 2); assert.equal(tierFor(9, [4, 7]), 3);
  assert.match(tm.art({ face: 'a', levels: { run: 6 } }), /treadmill-t2-a\.webp$/);
  const full = compoundLayout(DISCIPLINES);
  const items = placeablesFor([]);
  const at = resolvePlacements(full, items, { treadmill: { room: 'run', u: 2, v: 2, face: 'b' } });
  assert.deepEqual(at.treadmill, { room: 'run', u: 2, v: 2, face: 'b' });
  // two turned items can't overlap: the coffee machine beside a turned treadmill
  const cells = footprint(orient(tm, 'b'), 2, 2).map((c) => c.join(','));
  assert.deepEqual(cells, ['2,2', '2,3', '3,2', '3,3', '4,2', '4,3']);
});

test('the treadmill steps up to tier 4 with the run room', () => {
  const tm = placeableById('treadmill');
  for (const [level, tier] of [[1, 1], [3, 1], [4, 2], [6, 2], [7, 3], [9, 3], [10, 4]]) {
    assert.match(tm.art({ face: 'b', levels: { run: level } }), new RegExp(`treadmill-t${tier}-b\\.webp$`), `level ${level}`);
  }
});

test('the stash: bought items wait there, a stashed item stands nowhere, and comes back', () => {
  const owned = [{ item_id: 'lockers-t1' }, { item_id: 'ice-bath' }];
  const items = placeablesFor(owned);
  assert.ok(items.some((p) => p.id === 'lockers-t1'), 'yours once it\'s in your items');
  assert.ok(!placeablesFor([]).some((p) => p.id === 'lockers-t1'), 'nobody else has it');
  const layout = compoundLayout(['gym', 'pool', 'bike', 'run']);
  let at = resolvePlacements(layout, items, {});
  assert.equal(at['lockers-t1'], undefined, 'a new item starts in the stash');
  assert.ok(at['coffee-machine'], 'the gifts still stand in the base');
  assert.deepEqual(stashedItems(items, {}).map((p) => p.id), ['lockers-t1', 'ice-bath']);
  // set down, then put away
  const saved = { 'lockers-t1': { room: 'locker', u: 0, v: 0, face: 'a' } };
  at = resolvePlacements(layout, items, saved);
  assert.deepEqual(at['lockers-t1'], { room: 'locker', u: 0, v: 0, face: 'a' });
  at = resolvePlacements(layout, items, { 'coffee-machine': { room: 'locker', u: 0, v: 0, stashed: true } });
  assert.equal(at['coffee-machine'], undefined, 'a gift can be stashed too');
  assert.ok(stashedItems(items, { 'coffee-machine': { room: 'locker', u: 0, v: 0, stashed: true } }).some((p) => p.id === 'coffee-machine'));
});

test('every new item has both pictures, measured, and a name in both languages', async () => {
  const { ITEM_FIT } = await import('../js/core/item-fit.js');
  const en = (await import('../js/core/locales/en.js')).default;
  const es = (await import('../js/core/locales/es.js')).default;
  for (const p of PLACEABLES.filter((x) => x.stashFirst)) {
    assert.ok(en.cp.item[p.id] && es.cp.item[p.id], `${p.id} is named`);
    for (const face of ['a', 'b']) {
      const f = p.art({ face });
      assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
      assert.ok(ITEM_FIT[f], `${f} is measured`);
    }
  }
});

test('the trophy cabinet: 5 on show in tier 1, 10 in tier 2, the best one standing', () => {
  const t1 = placeableById('trophy-cabinet-t1'); const t2 = placeableById('trophy-cabinet-t2');
  assert.equal(displaySlots([]), 0);
  assert.equal(displaySlots([t1, placeableById('coffee-machine')]), 5);
  assert.equal(displaySlots([t1, t2]), 10);
  const five = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(toggleDisplay(five.slice(0, 4), 'e', 5), { list: five, full: false });
  assert.deepEqual(toggleDisplay(five, 'f', 5), { list: five, full: true }, 'no slot left');
  assert.deepEqual(toggleDisplay(five, 'c', 5).list, ['a', 'b', 'd', 'e'], 'tapping one takes it off');
  assert.deepEqual(toggleDisplay([...five, 'f'], 'g', 5).list, five, 'a smaller cabinet keeps the first ones');
});

test('the taped room: its picture is 16 x 16, only the back 8 x 8 can be used', () => {
  const c = placeableById('coffee-machine');
  assert.equal(stageGeom('locker', true, true), 'locker-16-tape');
  assert.equal(ROOM_GEOMETRY['locker-16-tape'].cols, 32);
  assert.ok(canPlace('locker-16-tape', 'locker', c, 6, 6).ok, 'inside the tape');
  assert.equal(canPlace('locker-16-tape', 'locker', c, 7, 6).reason, 'bounds', 'across the tape');
  assert.ok(canPlace('locker-16', 'locker', c, 7, 6).ok, 'expanded, the whole floor');
  const spot = firstFree('locker-16-tape', 'locker', c, {});
  assert.ok(spot.u + c.w <= 8 && spot.v + c.h <= 8);
});
