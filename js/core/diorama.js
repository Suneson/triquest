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
export const MAX_ZOOM = 2.5; // × the smallest zoom

/** The rooms you can visit, in the bottom bar's order (the locker last, on its own row). */
export const STAGE_ROOMS = ['bike', 'pool', 'run', 'gym', 'locker'];
/** A room's art geometry on the stage (the locker is the square one here). */
export const stageGeom = (room) => (room === 'locker' ? 'locker-square' : room);

/**
 * How a room's art sits in the world: a uniform scale and a shift (a CSS
 * matrix [s, 0, 0, s, tx, ty]) putting its floor's centre on the plot's.
 */
export function roomPlacement(geom) {
  const [w, h] = ROOM_SIZE[geom];
  const g = ROOM_GEOMETRY[geom];
  const s = (ENV.roomWidth * ENV.w) / w;
  const fx = ((g.right[0] + g.left[0]) / 2) * w / 100;
  const fy = ((g.right[1] + g.left[1]) / 2) * h / 100;
  const cx = (ENV.plot.top[0] + ENV.plot.bottom[0]) / 2;
  const cy = (ENV.plot.top[1] + ENV.plot.bottom[1]) / 2;
  return [s, 0, 0, s, cx - s * fx, cy - s * fy];
}

/** A point of a room's art (% of it) in the world. */
export function roomPctToWorld(geom, xPct, yPct) {
  const [w, h] = ROOM_SIZE[geom];
  const [s, , , , tx, ty] = roomPlacement(geom);
  return [tx + s * (xPct * w / 100), ty + s * (yPct * h / 100)];
}

/** A world point in a room's art, in % of it. */
export function worldToRoomPct(geom, x, y) {
  const [w, h] = ROOM_SIZE[geom];
  const [s, , , , tx, ty] = roomPlacement(geom);
  return { x: ((x - tx) / s) / w * 100, y: ((y - ty) / s) / h * 100 };
}

/** The smallest zoom: the world covers the viewport. */
export const minZoom = (vw, vh) => Math.max(vw / ENV.w, vh / ENV.h);

/**
 * A view { s, tx, ty } (screen = world × s + t) held inside the limits: zoom
 * between minZoom and MAX_ZOOM × it, and no world edge inside the viewport.
 */
export function clampView(v, vw, vh) {
  const lo = minZoom(vw, vh);
  const s = Math.min(lo * MAX_ZOOM, Math.max(lo, v.s));
  const w = ENV.w * s; const h = ENV.h * s;
  return {
    s,
    tx: Math.min(0, Math.max(vw - w, v.tx)),
    ty: Math.min(0, Math.max(vh - h, v.ty)),
  };
}

/** The opening view: the smallest zoom, centred on the plot. */
export function homeView(vw, vh) {
  const s = minZoom(vw, vh);
  const cx = (ENV.plot.left[0] + ENV.plot.right[0]) / 2;
  const cy = (ENV.plot.top[1] + ENV.plot.bottom[1]) / 2;
  return clampView({ s, tx: vw / 2 - cx * s, ty: vh / 2 - cy * s }, vw, vh);
}
