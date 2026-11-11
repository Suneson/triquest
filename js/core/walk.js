// walk.js — your athlete walking round the base's floor, tile to tile (docs/WALKING.md). Pure.
//
// The floor is the room's grid (js/core/placement.js): a tile is free when it's inside the room,
// not blocked and not under an item. The athlete steps to any of the 8 tiles round it, diagonals
// too, but never cuts a corner: a diagonal step needs both tiles beside it free.

import { ROOM_GEOMETRY, footprint, orient, placeableById } from './placement.js';

const inBox = ([u, v], [u0, v0, u1, v1]) => u >= u0 && u < u1 && v >= v0 && v < v1;

/**
 * The room's walkable grid.
 * @returns {{ cols, rows, free(u, v): boolean }}
 */
export function floorGrid(geomKey, room, placements = {}) {
  const g = ROOM_GEOMETRY[geomKey];
  if (!g) return { cols: 0, rows: 0, free: () => false };
  const cols = g.limit ?? g.cols; const rows = g.limit ?? g.rows;
  const taken = new Set();
  for (const [id, p] of Object.entries(placements || {})) {
    if (p?.room !== room) continue;
    const it = orient(placeableById(id), p.face);
    if (it && !it.flat) footprint(it, p.u, p.v).forEach(([a, b]) => taken.add(`${a},${b}`));
  }
  const free = (u, v) => Number.isInteger(u) && Number.isInteger(v) && u >= 0 && v >= 0 && u < cols && v < rows
    && !taken.has(`${u},${v}`) && !g.blocked.some((box) => inBox([u, v], box));
  return { cols, rows, free };
}

/** A grid from a picture, for tests: rows of '.' (free) and '#' (taken). */
export function gridOf(lines) {
  const rows = lines.length; const cols = lines[0].length;
  return { cols, rows, free: (u, v) => u >= 0 && v >= 0 && u < cols && v < rows && lines[v][u] === '.' };
}

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Can you step from (u, v) by (du, dv)? */
const canStep = (grid, u, v, du, dv) => grid.free(u + du, v + dv) && (!du || !dv || (grid.free(u + du, v) && grid.free(u, v + dv)));

/**
 * The shortest walk from one free tile to another, both ends included, or null when there's
 * no way through. A straight step costs 1, a diagonal √2.
 * @returns {Array<[number, number]> | null}
 */
export function findPath(grid, from, to) {
  const key = (u, v) => v * grid.cols + u;
  if (!grid.free(...from) || !grid.free(...to)) return null;
  const h = (u, v) => { const a = Math.abs(u - to[0]); const b = Math.abs(v - to[1]); return Math.max(a, b) + (Math.SQRT2 - 1) * Math.min(a, b); };
  const g = new Map([[key(...from), 0]]);
  const prev = new Map();
  const open = [[h(...from), ...from]];
  const done = new Set();
  while (open.length) {
    // the open list is small (a room is 32 x 32 at most): a sorted pick is plenty
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, u, v] = open.splice(bi, 1)[0];
    const k = key(u, v);
    if (done.has(k)) continue;
    done.add(k);
    if (u === to[0] && v === to[1]) {
      const path = [[u, v]];
      let c = k;
      while (prev.has(c)) { c = prev.get(c); path.unshift([c % grid.cols, Math.floor(c / grid.cols)]); }
      return path;
    }
    for (const [du, dv] of STEPS) {
      if (!canStep(grid, u, v, du, dv)) continue;
      const nk = key(u + du, v + dv);
      const ng = g.get(k) + (du && dv ? Math.SQRT2 : 1);
      if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); prev.set(nk, k); open.push([ng + h(u + du, v + dv), u + du, v + dv]); }
    }
  }
  return null;
}

/** Every free tile, nearest a point (u, v in tiles, fractions allowed) first. */
export function freeByDistance(grid, u, v) {
  const out = [];
  for (let a = 0; a < grid.cols; a++) for (let b = 0; b < grid.rows; b++) if (grid.free(a, b)) out.push([a, b]);
  const d = ([a, b]) => (a + 0.5 - u) ** 2 + (b + 0.5 - v) ** 2;
  return out.sort((x, y) => d(x) - d(y) || x[0] - y[0] || x[1] - y[1]);
}

/** The free tile nearest the middle of the floor: where the athlete comes into a room. */
export const entryTile = (grid) => freeByDistance(grid, grid.cols / 2, grid.rows / 2)[0] || null;

/**
 * Where to stand to use an item: a free tile touching its footprint (corners count), the one
 * nearest `near` (the athlete), that can be walked to. Null when it's walled in.
 * `side` [du, dv]: the side to get on from (a treadmill's back end), tried first.
 */
export function besideItem(grid, item, p, near, side = null) {
  const cells = new Set(footprint(item, p.u, p.v).map(([a, b]) => `${a},${b}`));
  const ring = [];
  for (let a = p.u - 1; a <= p.u + item.w; a++) {
    for (let b = p.v - 1; b <= p.v + item.h; b++) if (!cells.has(`${a},${b}`) && grid.free(a, b)) ring.push([a, b]);
  }
  const d = ([a, b]) => (near ? (a - near[0]) ** 2 + (b - near[1]) ** 2 : 0);
  const cu = p.u + item.w / 2; const cv = p.v + item.h / 2;
  // on the chosen side: a tile beyond the footprint's edge that way, middle first
  const off = ([a, b]) => {
    if (!side) return 0;
    const along = (a + 0.5 - cu) * side[0] + (b + 0.5 - cv) * side[1];
    const reach = Math.abs(side[0]) * item.w / 2 + Math.abs(side[1]) * item.h / 2;
    const across = Math.abs((a + 0.5 - cu) * side[1] - (b + 0.5 - cv) * side[0]);
    return along > reach ? across : 100 + d([a, b]);
  };
  ring.sort((x, y) => off(x) - off(y) || d(x) - d(y));
  return ring.find((t) => !near || findPath(grid, near, t)) || null;
}

/**
 * Somewhere to wander to: a free tile 2 to `far` steps away that can be walked to. `rand` is
 * Math.random (or a seeded one in tests).
 */
export function wanderTile(grid, from, rand = Math.random, far = 5) {
  const near = [];
  for (let a = from[0] - far; a <= from[0] + far; a++) {
    for (let b = from[1] - far; b <= from[1] + far; b++) {
      const d = Math.max(Math.abs(a - from[0]), Math.abs(b - from[1]));
      if (d >= 2 && grid.free(a, b)) near.push([a, b]);
    }
  }
  for (let tries = 0; tries < 6 && near.length; tries++) {
    const pick = near.splice(Math.floor(rand() * near.length), 1)[0];
    if (findPath(grid, from, pick)) return pick;
  }
  return null;
}

/** Which way the athlete faces walking by (du, dv): radians round Y, 0 facing +v. */
export const facing = (du, dv) => Math.atan2(du, dv);
