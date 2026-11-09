// placement.js — the unified compound and its item placement (docs/COMPOUND.md). Pure.
//
// The compound is the athlete's base: one painted isometric room per sport they
// train, plus the locker room, locked together on black. Every room has a
// floor grid of isometric tiles; items stand on tiles, take a footprint of
// whole tiles, and can't stand on walls, water or each other.
//
// Tiles are (u, v): u runs from the back corner of the floor towards the right
// corner, v from the back corner towards the left corner. A room's floor is
// measured as three corners in % of its (trimmed) art, so a tile maps to the
// art by an affine map (the floor is a parallelogram) and back again:
//
//   point(u, v) = back + (right - back) · u / cols + (left - back) · v / rows
//
// Nothing here touches the DOM; diorama-view.js draws it.

import { STALL_ITEMS } from './stall.js';

import { ROOM32 } from './room32-art.js';

const ART = 'icons/Pixelart/NEW';

/** The disciplines that can have a room, in the order the compound fills them. */
export const DISCIPLINES = ['gym', 'pool', 'bike', 'run'];
/** The app's sport id for a room ('pool' is the swimming room). */
export const SPORT_OF = { gym: 'gym', pool: 'swim', bike: 'bike', run: 'run' };
export const ROOM_OF = { gym: 'gym', swim: 'pool', bike: 'bike', run: 'run' };

const floor = (back, right, left, cols = 8, rows = 8, blocked = []) => ({ back, right, left, cols, rows, blocked });

/**
 * Each room's floor (measured on the level-1 art; the levels share it):
 *   back/right/left  floor corners in % of the art (x, y)
 *   cols × rows      tiles along u × v
 *   blocked          [u0, v0, u1, v1) boxes nothing may stand on (the pool's water)
 * Each square room's floor is an 8 × 8 grid (the wide locker, two rooms long, 8 × 16).
 */
export const ROOM_GEOMETRY = {
  gym: floor([51, 37], [97, 64], [3, 64]),
  pool: floor([50, 36], [96, 62], [3, 63], 8, 8, [[4, 1, 8, 7]]),
  bike: floor([49, 39], [97, 67], [3, 67]),
  run: floor([51, 45], [96, 70], [5, 70]),
  'locker-square': floor([50, 37], [97, 63], [3, 63]),
  'locker-landscape': floor([69, 30], [98, 54], [2, 71], 8, 16),
  // the expanded locker room: 32 × 32, made out of its 16 × 16 model by tools/room-32.py, with the
  // floor's corners from that tool. It fills the roof: `share` is its floor's width as a share of
  // the slab's, which puts the outside of its walls just under the railing's inner edge (86.1%)
  'locker-32': { ...floor([50.08, 17.33], [99.48, 57.32], [0.67, 57.32], 32, 32), share: 0.845 },
};
// the same room before it's fully expanded: only the back corner can be used, with the rest of the
// floor taped off, so you can see how much bigger it gets (`limit`: usable tiles). Tiles count from
// the back corner, so nothing moves when the tape does
ROOM_GEOMETRY['locker-16'] = { ...ROOM_GEOMETRY['locker-32'], limit: 16 };
ROOM_GEOMETRY['locker-16-tape'] = { ...ROOM_GEOMETRY['locker-32'], limit: 8 };

/** Art size of each room shape (px of the exported WebP), for laying the compound out. */
export const ROOM_SIZE = {
  gym: [1100, 1052], pool: [1100, 991], bike: [1100, 1051], run: [1100, 1115],
  'locker-square': [1100, 995], 'locker-landscape': [2200, 1677], 'locker-32': [3400, 2053], 'locker-16': [3400, 2053], 'locker-16-tape': [3400, 2053],
};

// the new 32 × 32 rooms, one level so far: shown only with ?rooms32=1 until the full set exists
for (const [room, r] of Object.entries(ROOM32)) {
  ROOM_GEOMETRY[`${room}-big`] = { ...floor(r.back, r.right, r.left, 32, 32, r.blocked), share: r.share };
  ROOM_SIZE[`${room}-big`] = r.size;
}

// levels with no art yet fall back to the nearest one below (the gym has no 7)
const MISSING = { gym: [7] };

/**
 * A room's art at a level (1–10). The landscape locker only exists from
 * level 4, so lower levels show level 4 until their art lands.
 */
export function roomArt(room, level, landscape = false) {
  let n = Math.max(1, Math.min(10, Math.floor(Number(level)) || 1));
  if (room === 'locker') {
    if (landscape) return `${ART}/LOCKER/landscape-${Math.max(4, n)}.webp`;
    return `${ART}/LOCKER/square-${n}.webp`;
  }
  while ((MISSING[room] || []).includes(n) && n > 1) n -= 1;
  return `${ART}/${room.toUpperCase()}/level-${n}.webp`;
}

/** Disciplines as a clean list in compound order (unknown ones dropped, none → all four). */
export function normalizeDisciplines(list) {
  const set = new Set((list || []).map((d) => ROOM_OF[d] || d).filter((d) => DISCIPLINES.includes(d)));
  return set.size ? DISCIPLINES.filter((d) => set.has(d)) : [...DISCIPLINES];
}

/**
 * The compound for some disciplines: rows of rooms, each { room, geom, col,
 * span, landscape }. Columns are 1 (one sport) or 2.
 *   1 sport   the sport over a square locker
 *   2 sports  side by side over the landscape locker
 *   3 sports  a 2×2 grid, the square locker bottom-right
 *   4 sports  gym and pool, bike and run, then the landscape locker
 */
export function compoundLayout(disciplines) {
  const ds = normalizeDisciplines(disciplines);
  const sq = (room, col) => ({ room, geom: room, col, span: 1, landscape: false });
  const lockerSq = (col) => ({ room: 'locker', geom: 'locker-square', col, span: 1, landscape: false });
  const lockerWide = { room: 'locker', geom: 'locker-landscape', col: 0, span: 2, landscape: true };
  if (ds.length === 1) return { cols: 1, rows: [[sq(ds[0], 0)], [lockerSq(0)]] };
  if (ds.length === 2) return { cols: 2, rows: [[sq(ds[0], 0), sq(ds[1], 1)], [lockerWide]] };
  if (ds.length === 3) return { cols: 2, rows: [[sq(ds[0], 0), sq(ds[1], 1)], [sq(ds[2], 0), lockerSq(1)]] };
  return { cols: 2, rows: [[sq(ds[0], 0), sq(ds[1], 1)], [sq(ds[2], 0), sq(ds[3], 1)], [lockerWide]] };
}

/** Every room in a layout, flat, with its row index. */
export const roomsOf = (layout) => layout.rows.flatMap((row, r) => row.map((cell) => ({ ...cell, row: r })));

// ---- the floor grid ------------------------------------------------------------------

/** A point on the floor (fractional tiles) as % of the room's art: { x, y }. */
export function tileToPct(geomKey, u, v) {
  const g = ROOM_GEOMETRY[geomKey];
  const [bx, by] = g.back; const [rx, ry] = g.right; const [lx, ly] = g.left;
  return {
    x: bx + (rx - bx) * (u / g.cols) + (lx - bx) * (v / g.rows),
    y: by + (ry - by) * (u / g.cols) + (ly - by) * (v / g.rows),
  };
}

/** % of the room's art back to fractional tiles: { u, v } (may fall outside the floor). */
export function pctToTile(geomKey, x, y) {
  const g = ROOM_GEOMETRY[geomKey];
  const [bx, by] = g.back;
  const ux = (g.right[0] - bx) / g.cols; const uy = (g.right[1] - by) / g.cols;
  const vx = (g.left[0] - bx) / g.rows; const vy = (g.left[1] - by) / g.rows;
  const det = ux * vy - uy * vx;
  const dx = x - bx; const dy = y - by;
  return { u: (dx * vy - dy * vx) / det, v: (ux * dy - uy * dx) / det };
}

/** The four corners of a box of tiles (back, right, front, left) in % of the art. */
export function boxCorners(geomKey, u, v, w = 1, h = 1) {
  return [tileToPct(geomKey, u, v), tileToPct(geomKey, u + w, v), tileToPct(geomKey, u + w, v + h), tileToPct(geomKey, u, v + h)];
}

// ---- items ----------------------------------------------------------------------------

/**
 * Things that stand in the compound. `w × h` tiles along u × v (not rotatable
 * yet). `gift`: everyone has one. `owned(inventory)`: has one when this says so.
 * `needsRoom`: only there while that room is in the compound. `art(o)`: the
 * picture, given { inventory, rider } (rider: the animated cyclist for your
 * level). `fit`: how much of the footprint the object's base covers (0.8
 * when not given), so it stands inside the blue lines. `spot`: where it's first set down,
 * when that's free (else the first free tile from the middle). `opens`: what
 * tapping it opens once it's picked up ('missions'). `runner3d`: the 3D runner
 * stands on it (the treadmill).
 */
// the items rendered from 3D models in Blender and repainted (docs/ITEMS-3D.md): each has two
// facings, `a` (its front down-left) and `b` (its front down-right, the item turned 90 degrees)
const ITEM3D = 'icons/Items';
/** Which tier of an item a room's level shows: 1 below the first band, 2 below the second, then 3. */
export const tierFor = (level, bands) => 1 + bands.filter((b) => (Number(level) || 1) >= b).length;

/** `runner`: where the 3D runner stands (tiles from the footprint's back corner) and which way it faces. */
const RUNNER = { a: { u: 1, v: 1.35, yaw: 0, y: 0.3, scale: 1.26 }, b: { u: 1.35, v: 1, yaw: Math.PI / 2, y: 0.3, scale: 1.26 } };
export const TREADMILL_BANDS = [4, 7, 10];

/**
 * An item you own outright (a row in user_base_items, 0031_base_items.sql). It waits in your
 * stash until you set it down. `w x h` is its footprint facing a: long along u when its long side
 * runs from upper left to lower right in the a picture, along v when it runs the other way.
 */
const stashed = (id, home, w, h, fit, extra = {}) => ({
  id, w, h, home, fit, faces: true, face: 'a', stashFirst: true,
  owned: (inv) => (inv || []).some((r) => r.item_id === id),
  art: (o) => `${ITEM3D}/${id}-${o?.face || 'a'}.webp`,
  ...extra,
});

export const PLACEABLES = [
  // the coffee machine: tier 1 to 3 with the locker room's level (4 and 7 step it up)
  { id: 'coffee-machine', w: 2, h: 2, gift: true, home: 'locker', fit: 0.82, faces: true, face: 'a',
    art: (o) => `${ITEM3D}/coffee-machine-t${tierFor(o?.levels?.locker, [4, 7])}-${o?.face || 'a'}.webp` },
  // the road bike on balance rollers: long along v when facing a
  { id: 'smart-bike', w: 2, h: 3, gift: true, home: 'bike', needsRoom: 'bike', fit: 0.78, faces: true, face: 'a',
    art: (o) => `${ITEM3D}/road-bike-rollers-t1-${o?.face || 'a'}.webp` },
  // the treadmill: everyone's, in the run room, with the 3D runner on its belt (js/app/runner3d.js).
  // Its console is towards the camera, so the runner faces us: 2 x 3 facing a (long along v, the
  // console at the far v end), 3 x 2 facing b (long along u, the console at the far u end).
  // Tiers 1 to 4 with the run room's level (4, 7 and 10 step it up).
  { id: 'treadmill', w: 2, h: 3, gift: true, home: 'run', needsRoom: 'run', fit: 0.92, runner3d: true, runner: RUNNER, faces: true, face: 'a',
    art: (o) => `${ITEM3D}/treadmill-t${tierFor(o?.levels?.run, TREADMILL_BANDS)}-${o?.face || 'a'}.webp` },
  // two showpieces, gifts while the base items are being tried out
  { id: 'road-bike-stand', w: 2, h: 2, gift: true, home: 'bike', needsRoom: 'bike', fit: 0.86, faces: true, face: 'a',
    art: (o) => `${ITEM3D}/road-bike-stand-${o?.face || 'a'}.webp` },
  { id: 'trophy-gold-mountain', w: 1, h: 1, gift: true, home: 'locker', fit: 0.8, faces: true, face: 'a',
    art: (o) => `${ITEM3D}/trophy-gold-mountain-${o?.face || 'a'}.webp` },
  {
    id: 'smart-trainer', w: 2, h: 1, home: 'bike', fit: 0.7, art: () => 'icons/Pixelart/GEAR/bike-power-t3.png',
    owned: (inv) => (inv || []).some((r) => r.item_id === 'bike-power-t3'),
  },
  // the weekly mission board (missions.js): one stands in every room, and tapping
  // it while it's picked up opens the board
  ...['bike', 'pool', 'run', 'gym', 'locker'].map((room) => ({
    id: `mission-board-${room}`, w: 1, h: 1, gift: true, home: room, needsRoom: room === 'locker' ? undefined : room, spot: [1, 0],
    fit: 0.7, opens: 'missions', art: () => `${ART}/ITEMS/mission-board.webp`,
  })),
  // the locker room's furniture
  stashed('lockers-t1', 'locker', 3, 2, 0.9),
  stashed('lockers-t2', 'locker', 3, 2, 0.9),
  stashed('drinks-fridge', 'locker', 2, 2, 0.62),
  stashed('massage-table', 'locker', 2, 3, 0.86),
  stashed('ice-bath', 'locker', 2, 3, 0.9),
  // the trophy cabinets: tap one to choose which trophies stand in it (`slots`: how many)
  stashed('trophy-cabinet-t1', 'locker', 2, 2, 0.62, { opens: 'trophies', slots: 5 }),
  stashed('trophy-cabinet-t2', 'locker', 2, 2, 0.7, { opens: 'trophies', slots: 10 }),
  // the gym
  stashed('dumbbell-rack', 'gym', 3, 2, 0.84),
  stashed('kettlebell-set', 'gym', 2, 2, 0.84),
  stashed('punching-bag', 'gym', 2, 2, 0.72),
  stashed('rowing-machine', 'gym', 2, 3, 0.9),
  // the other rooms
  stashed('race-podium', 'run', 3, 2, 0.9),
  stashed('shoe-rack', 'run', 2, 2, 0.62),
  stashed('bike-workstand', 'bike', 2, 2, 0.7),
  stashed('start-block', 'pool', 2, 2, 0.76),
  // each tier of the items that step up with a room's level, to own and place on its own
  ...[1, 2, 3, 4].map((n) => stashed(`treadmill-t${n}`, 'run', 2, 3, 0.92, { runner3d: true, runner: RUNNER })),
  ...[1, 2, 3].map((n) => stashed(`coffee-machine-t${n}`, 'locker', 2, 2, 0.82)),
  // what the daily stall sells (stall.js): yours once bought
  ...STALL_ITEMS.map((s) => ({
    id: s.id, w: s.w, h: s.h, home: s.home, fit: s.fit, flat: !!s.flat, art: () => s.art,
    owned: (inv) => (inv || []).some((r) => r.item_id === s.id),
  })),
];
export const placeableById = (id) => PLACEABLES.find((p) => p.id === id) || null;

/**
 * An item as it stands in one of its facings: facing b is the item turned 90 degrees, so its
 * footprint is turned too (w and h swap). Items with one facing are as they are.
 */
export function orient(item, face) {
  if (!item?.faces) return item;
  const f = face === 'a' || face === 'b' ? face : (item.face || 'a');
  return f === 'b' ? { ...item, face: f, w: item.h, h: item.w } : { ...item, face: f };
}
/** The other facing. */
export const turned = (face) => (face === 'b' ? 'a' : 'b');

/** The items this athlete has to place: gifts, and anything their inventory gives (in rooms they have). */
export const placeablesFor = (inventory, rooms = null) => PLACEABLES.filter((p) => (p.gift || p.owned?.(inventory))
  && (!p.needsRoom || !rooms || rooms.includes(p.needsRoom)));

/** Is this item in the stash? Saved there, or never set down and made to start there. */
export const isStashed = (item, saved) => {
  const s = saved?.[item.id];
  return s ? !!s.stashed : !!item.stashFirst;
};
/** The items waiting in the stash, of the ones you have. */
export const stashedItems = (items, saved) => items.filter((it) => isStashed(it, saved));

/** How many trophies you can show: the best cabinet standing in your base (0 with none). */
export const displaySlots = (placedItems) => Math.max(0, ...placedItems.map((it) => it?.slots || 0));
/** Add a trophy to the ones on show, or take it off. `full`: there's no slot left for it. */
export function toggleDisplay(list, id, slots) {
  const shown = (list || []).slice(0, slots);
  if (shown.includes(id)) return { list: shown.filter((x) => x !== id), full: false };
  if (shown.length >= slots) return { list: shown, full: true };
  return { list: [...shown, id], full: false };
}

/** The tiles an item covers with its back corner at (u, v). */
export function footprint(item, u, v) {
  const cells = [];
  for (let i = 0; i < item.w; i++) for (let j = 0; j < item.h; j++) cells.push([u + i, v + j]);
  return cells;
}

const inBox = ([u, v], [u0, v0, u1, v1]) => u >= u0 && u < u1 && v >= v0 && v < v1;

/**
 * Can `item` stand at (u, v) in `room` (geometry `geomKey`), given where the
 * others are (`placements`: { itemId: { room, u, v } }, the item itself
 * ignored)? { ok, cells, reason: 'bounds' | 'blocked' | 'occupied' }.
 */
export function canPlace(geomKey, room, item, u, v, placements = {}) {
  const g = ROOM_GEOMETRY[geomKey];
  const cells = footprint(item, u, v);
  if (!g || cells.some(([a, b]) => a < 0 || b < 0 || a >= (g.limit ?? g.cols) || b >= (g.limit ?? g.rows) || !Number.isInteger(a) || !Number.isInteger(b))) {
    return { ok: false, cells, reason: 'bounds' };
  }
  if (cells.some((c) => g.blocked.some((box) => inBox(c, box)))) return { ok: false, cells, reason: 'blocked' };
  const taken = new Set();
  for (const [id, p] of Object.entries(placements || {})) {
    if (id === item.id || p?.room !== room) continue;
    const other = orient(placeableById(id), p.face);
    if (other) footprint(other, p.u, p.v).forEach(([a, b]) => taken.add(`${a},${b}`));
  }
  if (cells.some(([a, b]) => taken.has(`${a},${b}`))) return { ok: false, cells, reason: 'occupied' };
  return { ok: true, cells };
}

/** The first spot an item fits in a room, scanning from the middle of the floor out. */
export function firstFree(geomKey, room, item, placements = {}) {
  const g = ROOM_GEOMETRY[geomKey];
  const spots = [];
  for (let u = 0; u < g.cols; u++) for (let v = 0; v < g.rows; v++) spots.push([u, v]);
  const cu = ((g.limit ?? g.cols) - item.w) / 2; const cv = ((g.limit ?? g.rows) - item.h) / 2;
  spots.sort((a, b) => (Math.abs(a[0] - cu) + Math.abs(a[1] - cv)) - (Math.abs(b[0] - cu) + Math.abs(b[1] - cv)) || a[0] - b[0] || a[1] - b[1]);
  const hit = spots.find(([u, v]) => canPlace(geomKey, room, item, u, v, placements).ok);
  return hit ? { room, u: hit[0], v: hit[1] } : null;
}

/**
 * Where every item stands in this layout: saved spots that still fit, and a
 * free spot for the rest (in its home room, or the locker when that room isn't
 * in the compound). Doesn't change what's saved: an item only moves for good
 * when you move it. What's in the stash doesn't stand anywhere.
 */
export function resolvePlacements(layout, items, saved = {}) {
  const rooms = roomsOf(layout);
  const geomOf = (room) => rooms.find((r) => r.room === room)?.geom || null;
  const out = {};
  const pending = [];
  for (const it of items) {
    if (isStashed(it, saved)) continue;
    const s = saved?.[it.id];
    const geom = s && geomOf(s.room);
    const o = orient(it, s?.face);
    if (geom && canPlace(geom, s.room, o, s.u, s.v, out).ok) out[it.id] = { room: s.room, u: s.u, v: s.v, ...(o.faces ? { face: o.face } : {}) };
    else pending.push(it);
  }
  for (const it0 of pending) {
    const it = orient(it0, saved?.[it0.id]?.face);
    const room = geomOf(it.home) ? it.home : 'locker';
    const pref = it.spot && canPlace(geomOf(room), room, it, it.spot[0], it.spot[1], out).ok ? { room, u: it.spot[0], v: it.spot[1] } : null;
    const spot = pref || firstFree(geomOf(room), room, it, out) || firstFree(geomOf('locker'), 'locker', it, out);
    if (spot) out[it.id] = it.faces ? { ...spot, face: it.face } : spot;
  }
  return out;
}

/** Draw order: further back first (u + v), then left to right. */
export const depthOf = (item, p) => (p.u + p.v + (item.w + item.h) / 2) * 10;
