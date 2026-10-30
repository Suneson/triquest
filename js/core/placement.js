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
};

/** Art size of each room shape (px of the exported WebP), for laying the compound out. */
export const ROOM_SIZE = {
  gym: [1100, 1052], pool: [1100, 991], bike: [1100, 1051], run: [1100, 1115],
  'locker-square': [1100, 995], 'locker-landscape': [2200, 1677],
};

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
export const PLACEABLES = [
  { id: 'coffee-machine', w: 1, h: 1, gift: true, home: 'locker', fit: 0.75, art: () => `${ART}/ITEMS/coffee-machine.webp` },
  // the rider on their bike: the cycling animation, standing along the floor's v axis
  { id: 'smart-bike', w: 1, h: 2, gift: true, home: 'bike', needsRoom: 'bike', fit: 0.62, art: (o) => o?.rider || '' },
  // the treadmill: everyone's, in the run room, with the 3D runner on its belt
  // (js/app/runner3d.js), its console at the front of the floor's v axis
  { id: 'treadmill', w: 1, h: 2, gift: true, home: 'run', needsRoom: 'run', fit: 0.9, runner3d: true, art: () => `${ART}/ITEMS/treadmill.webp` },
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
  // what the daily stall sells (stall.js): yours once bought
  ...STALL_ITEMS.map((s) => ({
    id: s.id, w: s.w, h: s.h, home: s.home, fit: s.fit, flat: !!s.flat, art: () => s.art,
    owned: (inv) => (inv || []).some((r) => r.item_id === s.id),
  })),
];
export const placeableById = (id) => PLACEABLES.find((p) => p.id === id) || null;

/** The items this athlete has to place: gifts, and anything their inventory gives (in rooms they have). */
export const placeablesFor = (inventory, rooms = null) => PLACEABLES.filter((p) => (p.gift || p.owned?.(inventory))
  && (!p.needsRoom || !rooms || rooms.includes(p.needsRoom)));

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
  if (!g || cells.some(([a, b]) => a < 0 || b < 0 || a >= g.cols || b >= g.rows || !Number.isInteger(a) || !Number.isInteger(b))) {
    return { ok: false, cells, reason: 'bounds' };
  }
  if (cells.some((c) => g.blocked.some((box) => inBox(c, box)))) return { ok: false, cells, reason: 'blocked' };
  const taken = new Set();
  for (const [id, p] of Object.entries(placements || {})) {
    if (id === item.id || p?.room !== room) continue;
    const other = placeableById(id);
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
  const cu = (g.cols - item.w) / 2; const cv = (g.rows - item.h) / 2;
  spots.sort((a, b) => (Math.abs(a[0] - cu) + Math.abs(a[1] - cv)) - (Math.abs(b[0] - cu) + Math.abs(b[1] - cv)) || a[0] - b[0] || a[1] - b[1]);
  const hit = spots.find(([u, v]) => canPlace(geomKey, room, item, u, v, placements).ok);
  return hit ? { room, u: hit[0], v: hit[1] } : null;
}

/**
 * Where every item stands in this layout: saved spots that still fit, and a
 * free spot for the rest (in its home room, or the locker when that room isn't
 * in the compound). Doesn't change what's saved: an item only moves for good
 * when you move it.
 */
export function resolvePlacements(layout, items, saved = {}) {
  const rooms = roomsOf(layout);
  const geomOf = (room) => rooms.find((r) => r.room === room)?.geom || null;
  const out = {};
  const pending = [];
  for (const it of items) {
    const s = saved?.[it.id];
    const geom = s && geomOf(s.room);
    if (geom && canPlace(geom, s.room, it, s.u, s.v, out).ok) out[it.id] = { room: s.room, u: s.u, v: s.v };
    else pending.push(it);
  }
  for (const it of pending) {
    const room = geomOf(it.home) ? it.home : 'locker';
    const pref = it.spot && canPlace(geomOf(room), room, it, it.spot[0], it.spot[1], out).ok ? { room, u: it.spot[0], v: it.spot[1] } : null;
    const spot = pref || firstFree(geomOf(room), room, it, out) || firstFree(geomOf('locker'), 'locker', it, out);
    if (spot) out[it.id] = spot;
  }
  return out;
}

/** Draw order: further back first (u + v), then left to right. */
export const depthOf = (item, p) => (p.u + p.v + (item.w + item.h) / 2) * 10;
