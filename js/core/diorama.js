// diorama.js — the Profile tab's stage: one room at a time, standing in its
// plot on a generated terrain (docs/COMPOUND.md). Pure.
//
// The world is the terrain image (sky, grass round a foundation plot, the dirt
// cutaway). The room's art is scaled, never skewed, and centred on the plot.
// The viewport may never show anything outside the world: the smallest zoom
// covers the viewport, the largest is MAX_ZOOM times that, and panning keeps
// the world's edges outside the viewport's.

import { ROOM_GEOMETRY, ROOM_SIZE } from './placement.js';

export const ENV = {
  src: 'icons/Pixelart/NEW/env-ground-sky.webp',
  w: 848, h: 1264,
  // the foundation plot's rim, in px of the terrain (measured)
  plot: { top: [426, 510], right: [810, 730], bottom: [430, 950], left: [36, 740] },
  roomWidth: 0.86, // the room's art width, as a share of the terrain's
};
// The city tower (docs/CITY.md): a room stands on its floor's flat roof slab. Each floor's slab
// is measured in px of its 1792 × 2400 app picture (tools/cut-city.py). The slab is made for a
// 16 × 16 floor, so today's 8 × 8 rooms take half its width, in the middle of it.
export const FLOOR_OF = { locker: 0, gym: 1, bike: 2, run: 3 };
const SLABS = [
  { top: [845, 424], right: [1791, 782], bottom: [907, 1250], left: [0, 778] },
  { top: [917, 419], right: [1791, 835], bottom: [944, 1248], left: [55, 825] },
  { top: [859, 398], right: [1738, 810], bottom: [882, 1233], left: [0, 794] },
  { top: [906, 253], right: [1582, 570], bottom: [941, 885], left: [255, 556] },
];
const cityEnv = (n) => ({ src: `icons/City/app/floor-${n}.webp`, w: 1792, h: 2400, plot: SLABS[n], floorShare: 0.5, floor: n, slabView: 1.15 });

/** The world a room stands in: its city floor, or the terrain while it has none (the pool). */
export const envFor = (room) => (room in FLOOR_OF ? cityEnv(FLOOR_OF[room]) : ENV);

export const MAX_ZOOM = 2.5; // × the smallest zoom

/** The rooms you can visit, in the bottom bar's order (the locker last, on its own row). */
export const STAGE_ROOMS = ['bike', 'pool', 'run', 'gym', 'locker'];
/** A room's art geometry on the stage (the locker is the square one here). */
export const stageGeom = (room) => (room === 'locker' ? 'locker-square' : room);

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
  // scaled by the art's width, or (on a slab) so the floor takes its share of the slab's
  const s = env.floorShare
    ? (env.floorShare * (env.plot.right[0] - env.plot.left[0])) / ((g.right[0] - g.left[0]) * w / 100)
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

/**
 * A view { s, tx, ty } (screen = world × s + t) held inside the limits: zoom
 * between minZoom and MAX_ZOOM × it, and no world edge inside the viewport.
 */
export function clampView(v, vw, vh, env = ENV) {
  const lo = minZoom(vw, vh, env);
  const s = Math.min(lo * MAX_ZOOM, Math.max(lo, v.s));
  const w = env.w * s; const h = env.h * s;
  return {
    s,
    tx: Math.min(0, Math.max(vw - w, v.tx)),
    ty: Math.min(0, Math.max(vh - h, v.ty)),
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
