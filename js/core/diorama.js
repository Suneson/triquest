// diorama.js — the base's stage: one room at a time, standing on its floor of the
// city tower (docs/CITY.md; the old terrain is docs/COMPOUND.md). Pure.
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
// The city (docs/CITY.md, "The layered city"): one picture of the whole city, the street floor
// in the middle (icons/City/layers/city.webp, half the 10752 × 9960 master), and the MOSKE tower
// stacked on it from two pieces cut by tools/cut-tower.py: floor N is the cap (the roof slab and
// the top storey) with N - 1 office storeys under it, standing on the street floor's lobby; the
// street floor (N = 0) is the picture as it is. A room stands on its floor's slab: the slab is
// made for a 16 × 16 floor, so today's 8 × 8 rooms take half its width, in the middle of it.
export const FLOOR_OF = { locker: 0, gym: 1, bike: 2, run: 3, pool: 4 };
export const CITY = {
  src: 'icons/City/layers/city.webp', w: 5376, h: 4980,
  k: 0.5,                         // the app picture is half the master (px of the master × k)
  plateAt: [3584, 4072],          // the street floor's top-left corner in the master
  step: 449.01,                   // one storey, in px of the street floor (icons/City/layers/tower.json)
  cap: { src: 'icons/City/layers/app/tower-cap.webp', w: 1996, h: 1324, at: [-152.6, -199.1] },
  storey: { src: 'icons/City/layers/app/tower-storey.webp', w: 2014, h: 720, at: [-188.6, 1455.9] },
  // the slabs, in px of the street floor: its own, and the cap's when the tower is one storey tall
  slab0: { top: [1690, 800], right: [3582, 1475], bottom: [1814, 2358], left: [0, 1468] },
  slab1: { top: [1804, 16], right: [3658, 833], bottom: [1829, 1725], left: [63, 821] },
};
const toWorld = ([x, y], up = 0) => [(x + CITY.plateAt[0]) * CITY.k, (y - up + CITY.plateAt[1]) * CITY.k];

/** The tower's pieces for floor n, bottom first, each { src, x, y, w, h } in px of the city picture. */
export function towerPieces(n) {
  if (n < 1) return [];
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    const [x, y] = toWorld(CITY.storey.at, (i + 1) * CITY.step);
    out.push({ src: CITY.storey.src, x, y, w: CITY.storey.w, h: CITY.storey.h });
  }
  const [x, y] = toWorld(CITY.cap.at, (n - 1) * CITY.step);
  out.push({ src: CITY.cap.src, x, y, w: CITY.cap.w, h: CITY.cap.h });
  return out;
}

/** Floor n's slab, in px of the city picture. */
export function slabOf(n) {
  const s = n < 1 ? CITY.slab0 : CITY.slab1;
  const up = n < 1 ? 0 : (n - 1) * CITY.step;
  return Object.fromEntries(Object.entries(s).map(([k, p]) => [k, toWorld(p, up)]));
}

const cityEnv = (n) => ({ src: CITY.src, w: CITY.w, h: CITY.h, plot: slabOf(n), floorShare: 0.5, floor: n, slabView: 1.15, tower: towerPieces(n) });

/** The world a room stands in: its floor of the city, or the terrain for a room with no floor yet. */
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
