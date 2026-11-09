// diorama.js — the base's stage: one room at a time, standing on its floor of the
// city tower (docs/CITY.md; the old terrain is docs/COMPOUND.md). Pure.
//
// The world is the terrain image (sky, grass round a foundation plot, the dirt
// cutaway). The room's art is scaled, never skewed, and centred on the plot.
// The viewport may never show anything outside the world: the smallest zoom
// covers the viewport, the largest is MAX_ZOOM times that, and panning keeps
// the world's edges outside the viewport's.

import { ROOM_GEOMETRY, ROOM_SIZE } from './placement.js';
import { ISLAND_ART } from './island-art.js';

export const ENV = {
  src: 'icons/Pixelart/NEW/env-ground-sky.webp',
  w: 848, h: 1264,
  // the foundation plot's rim, in px of the terrain (measured)
  plot: { top: [426, 510], right: [810, 730], bottom: [430, 950], left: [36, 740] },
  roomWidth: 0.86, // the room's art width, as a share of the terrain's
};
// The island (docs/CITY.md): one picture of the ground in tiles, nine plots on it (island-view.js),
// and the main base on the middle plot. A room stands on its floor of the base: the locker on the
// ground floor's roof, every other room on as many upper floors as it needs. js/core/island-art.js
// says where each picture goes (written by tools/cut-island.py).
export const FLOOR_OF = { locker: 0, gym: 1, bike: 2, run: 3, pool: 4 };
const { world: WORLD, plots: PLOTS, unit: UNIT, slope: SLOPE, foot: [A0, A1], groundFloor: GROUND_FLOOR, storey: STOREY } = ISLAND_ART;
export const CITY = { x0: 0, y0: 0, w: WORLD.w, h: WORLD.h, step: STOREY.wall };
const onBase = (a, b, up) => [PLOTS.base[0] + (a - b) * UNIT, PLOTS.base[1] + (a + b) * SLOPE * UNIT - up];

/** The base's upper floors under floor n, bottom first, each { src, x, y, w, h } in world px. */
export function towerPieces(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = onBase(A1, A1, GROUND_FLOOR + i * CITY.step);
    out.push({ src: STOREY.src, x: x - STOREY.w / 2, y: y - STOREY.h + STOREY.pad + 2, w: STOREY.w, h: STOREY.h });
  }
  return out;
}

/** Floor n's roof, the slab its room stands on, in world px. */
export function slabOf(n) {
  const up = GROUND_FLOOR + Math.max(0, n) * CITY.step;
  return { top: onBase(A0, A0, up), right: onBase(A1, A0, up), bottom: onBase(A1, A1, up), left: onBase(A0, A1, up) };
}

// the ground's tiles, the ones round the base first, so what you open on loads before the far sea
export const CITY_TILES = [...ISLAND_ART.tiles]
  .sort((p, q) => Math.hypot(p.x + p.w / 2 - PLOTS.base[0], p.y + p.h / 2 - PLOTS.base[1]) - Math.hypot(q.x + q.w / 2 - PLOTS.base[0], q.y + q.h / 2 - PLOTS.base[1]));

// how far in you can zoom: until one tile of the room is this many px across on the screen
const TILE_ZOOM = 68;
const cityEnv = (n, geom) => ({ src: CITY_TILES[0].src, tiles: CITY_TILES, x0: CITY.x0, y0: CITY.y0, w: CITY.w, h: CITY.h,
  maxS: TILE_ZOOM / (((ROOM_GEOMETRY[geom].share ?? 0.5) * (slabOf(n).right[0] - slabOf(n).left[0])) / ROOM_GEOMETRY[geom].cols), plot: slabOf(n), floorShare: 0.5, floor: n, slabView: 1.15, tower: towerPieces(n) });

/** The world a room stands in: its floor of the city, or the terrain for a room with no floor yet. */
export const envFor = (room, geom = stageGeom(room)) => (room in FLOOR_OF ? cityEnv(FLOOR_OF[room], geom) : ENV);

export const MAX_ZOOM = 2.5; // × the smallest zoom, in a world with no zoom of its own (the terrain)

/** The rooms you can visit, in the bottom bar's order (the locker last, on its own row). */
export const STAGE_ROOMS = ['bike', 'pool', 'run', 'gym', 'locker'];
/**
 * A room's art geometry on the stage: the painted 8 × 8 room (the locker's is the square one), or
 * once the room is expanded (expansions.js) its 32 × 32 picture, all of
 * it when `size` is 32 and taped off to its back 16 × 16 when it isn't; `taped` shows it taped off
 * to the back 8 × 8.
 */
export const stageGeom = (room, size = false, taped = false) => {
  if (taped) return `${room}-16-tape`;
  if (size) return size === 32 ? `${room}-32` : `${room}-16`;
  return room === 'locker' ? 'locker-square' : room;
};

/** The middle of a world's plot (or slab). */
const plotCentre = (env) => (env.floorShare
  ? [(env.plot.left[0] + env.plot.right[0]) / 2, (env.plot.top[1] + env.plot.bottom[1]) / 2]
  : [(env.plot.top[0] + env.plot.bottom[0]) / 2, (env.plot.top[1] + env.plot.bottom[1]) / 2]);

/**
 * How a room's art sits in the world: a uniform scale and a shift (a CSS
 * matrix [s, 0, 0, s, tx, ty]) putting its floor's centre on the plot's.
 */
export function roomPlacement(geom, env = ENV) {
  const [w, h] = ROOM_SIZE[geom];
  const g = ROOM_GEOMETRY[geom];
  // scaled by the art's width, or (on a slab) so the floor takes its share of the slab's: an
  // 8 × 8 room half of it, a 16 × 16 room (its own `share`) all of it inside the railing
  const share = g.share ?? env.floorShare;
  const s = env.floorShare
    ? (share * (env.plot.right[0] - env.plot.left[0])) / ((g.right[0] - g.left[0]) * w / 100)
    : (env.roomWidth * env.w) / w;
  const fx = ((g.right[0] + g.left[0]) / 2) * w / 100;
  const fy = ((g.right[1] + g.left[1]) / 2) * h / 100;
  const [cx, cy] = plotCentre(env);
  return [s, 0, 0, s, cx - s * fx, cy - s * fy];
}

/** A point of a room's art (% of it) in the world. */
export function roomPctToWorld(geom, xPct, yPct, env = ENV) {
  const [w, h] = ROOM_SIZE[geom];
  const [s, , , , tx, ty] = roomPlacement(geom, env);
  return [tx + s * (xPct * w / 100), ty + s * (yPct * h / 100)];
}

/** A world point in a room's art, in % of it. */
export function worldToRoomPct(geom, x, y, env = ENV) {
  const [w, h] = ROOM_SIZE[geom];
  const [s, , , , tx, ty] = roomPlacement(geom, env);
  return { x: ((x - tx) / s) / w * 100, y: ((y - ty) / s) / h * 100 };
}

/** The smallest zoom: the world covers the viewport. */
export const minZoom = (vw, vh, env = ENV) => Math.max(vw / env.w, vh / env.h);
/** The largest zoom: the room's own (a tile a good size on the screen), or MAX_ZOOM × the smallest. */
export const maxZoom = (vw, vh, env = ENV) => { const lo = minZoom(vw, vh, env); return env.maxS ? Math.max(lo, env.maxS) : lo * MAX_ZOOM; };

/**
 * A view { s, tx, ty } (screen = world × s + t) held inside the limits: zoom
 * between minZoom and maxZoom, and no world edge inside the viewport.
 */
export function clampView(v, vw, vh, env = ENV) {
  const lo = minZoom(vw, vh, env);
  const s = Math.min(maxZoom(vw, vh, env), Math.max(lo, v.s));
  const x0 = (env.x0 || 0) * s; const y0 = (env.y0 || 0) * s;   // the world's top-left corner
  const w = env.w * s; const h = env.h * s;
  return {
    s,
    tx: Math.min(-x0, Math.max(vw - w - x0, v.tx)),
    ty: Math.min(-y0, Math.max(vh - h - y0, v.ty)),
  };
}

/** The opening view: the smallest zoom (on a slab, enough to fill the screen with it), centred on the plot. */
export function homeView(vw, vh, env = ENV) {
  // on a slab: zoomed so the slab is a little wider than the screen (swipe to see its corners)
  const fit = env.slabView ? (env.slabView * vw) / (env.plot.right[0] - env.plot.left[0]) : 0;
  const s = Math.max(minZoom(vw, vh, env), fit);
  const cx = (env.plot.left[0] + env.plot.right[0]) / 2;
  const cy = (env.plot.top[1] + env.plot.bottom[1]) / 2;
  return clampView({ s, tx: vw / 2 - cx * s, ty: vh / 2 - cy * s }, vw, vh, env);
}
