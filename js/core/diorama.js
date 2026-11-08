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
// in the middle (half the 10752 × 9960 master, drawn in tiles below), and the MOSKE tower
// stacked on it from two pieces cut by tools/cut-tower.py: floor N is the cap (the roof slab and
// the top storey) with N - 1 office storeys under it, standing on the street floor's lobby; the
// street floor (N = 0) is the picture as it is. A room stands on its floor's slab: the slab is
// made for a 16 × 16 floor, so today's 8 × 8 rooms take half its width, in the middle of it.
export const FLOOR_OF = { locker: 0, gym: 1, bike: 2, run: 3, pool: 4 };
export const CITY = {
  // the whole city: the base keeps its old px, so everything measured in them still holds, and
  // the streets round it are redrawn smaller (tools/compose-big-base.py): the base is 2 × 2 blocks.
  // The picture runs past the old one on every side, so its top-left corner is at negative px
  x0: -800, y0: -2300, w: 7000, h: 8600,
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

// the railing round the slab (tools/cut-rail.py): its back half stands behind the room, its front
// half in front of it; in px of the city picture for the street floor and for floor 1 (the roof
// slab every floor above stands on, a storey higher each floor). The street pair was touched up
// by hand after the cut: the start of each back side of the kerb, past the corner posts, was in the
// front half and showed as a flap over the room's walls; it is in the back half now (taller for it)
const RAIL = {
  street: { back: { x: 1858.0, y: 2432.0, w: 1652.0, h: 433.3 }, front: { x: 1779.3, y: 2733.3, w: 1829.3, h: 561.3 } },
  roof: { back: { x: 1880.3, y: 2039.3, w: 1678.7, h: 373.3 }, front: { x: 1817.7, y: 2407.3, w: 1814.7, h: 564.0 } },
};
/** Floor n's railing: { back, front }, each { src, x, y, w, h } in px of the city picture. */
export function railOf(n) {
  const kind = n < 1 ? 'street' : 'roof';
  const up = n < 1 ? 0 : (n - 1) * CITY.step * CITY.k;
  const at = (part) => ({ src: `icons/City/rail/${kind}-${part}.webp`, ...RAIL[kind][part], y: +(RAIL[kind][part].y - up).toFixed(1) });
  return { back: at('back'), front: at('front') };
}

/** Floor n's slab, in px of the city picture. */
export function slabOf(n) {
  const s = n < 1 ? CITY.slab0 : CITY.slab1;
  const up = n < 1 ? 0 : (n - 1) * CITY.step;
  return Object.fromEntries(Object.entries(s).map(([k, p]) => [k, toWorld(p, up)]));
}

// The city picture is drawn in tiles (icons/City/layers/tiles/city-<row>-<col>.webp, 6 × 7 of
// 1344 × 1245 px of the world, stored sharper near the base than far from it: tools/cut-big-city.py):
// one picture this size is more than an iPhone will keep decoded next to the 3D layers. Over them,
// the base's own block, sharper still (1.5 px per px of the world), so it stays crisp zoomed right in.
const TILE = { w: 1344, h: 1245 };
const BASE_ART = { src: 'icons/City/layers/base.webp', x: 1500, y: 2410, w: 2380, h: 1470 };
export const CITY_TILES = [...[0, 1, 2, 3, 4, 5, 6].flatMap((r) => [0, 1, 2, 3, 4, 5].map((c) => ({ r, c })))
  .map(({ r, c }) => ({ src: `icons/City/layers/tiles/city-${r}-${c}.webp`, x: CITY.x0 + c * TILE.w, y: CITY.y0 + r * TILE.h,
    w: Math.min(TILE.w, CITY.w - c * TILE.w), h: Math.min(TILE.h, CITY.h - r * TILE.h) }))
  // the ones round the base first, so what you open on loads before the far edges of the city
  .sort((p, q) => Math.hypot(p.x + p.w / 2 - 2690, p.y + p.h / 2 - 3145) - Math.hypot(q.x + q.w / 2 - 2690, q.y + q.h / 2 - 3145)), BASE_ART];

// the buildings in front of the van's road, only where they can cover the van
// (tools/cut-big-city.py): the 3D layer draws them over the van while it's about, so it passes
// behind them. Small pieces, loaded only then: a layer the size of the city over the 3D canvas
// was more than an iPhone could keep.
export const VAN_FRONT = [
  { src: 'icons/City/layers/front/van-front-4-2.webp', x: 2592.0, y: 3561.0, w: 640.0, h: 364.0 },
  { src: 'icons/City/layers/front/van-front-4-3.webp', x: 3232.0, y: 3293.0, w: 1344.0, h: 512.0 },
  { src: 'icons/City/layers/front/van-front-4-4.webp', x: 4576.0, y: 3537.0, w: 887.0, h: 388.0 },
  { src: 'icons/City/layers/front/van-front-5-0.webp', x: -72.0, y: 4763.0, w: 616.0, h: 407.0 },
  { src: 'icons/City/layers/front/van-front-5-1.webp', x: 544.0, y: 4104.0, w: 1344.0, h: 1015.0 },
  { src: 'icons/City/layers/front/van-front-5-2.webp', x: 1888.0, y: 3925.0, w: 999.0, h: 537.0 },
  { src: 'icons/City/layers/front/van-front-5-4.webp', x: 4901.0, y: 3925.0, w: 820.0, h: 293.0 },
  { src: 'icons/City/layers/front/van-front-6-0.webp', x: -64.0, y: 5170.0, w: 503.0, h: 136.0 },
];

// how far in you can zoom: until one tile of the room is this many px across on the screen
const TILE_ZOOM = 68;
const cityEnv = (n, geom) => ({ src: CITY_TILES[0].src, tiles: CITY_TILES, front: VAN_FRONT, x0: CITY.x0, y0: CITY.y0, w: CITY.w, h: CITY.h,
  maxS: TILE_ZOOM / (((ROOM_GEOMETRY[geom].share ?? 0.5) * (slabOf(n).right[0] - slabOf(n).left[0])) / ROOM_GEOMETRY[geom].cols), plot: slabOf(n), floorShare: 0.5, floor: n, slabView: 1.15, tower: towerPieces(n), rail: railOf(n) });

/** The world a room stands in: its floor of the city, or the terrain for a room with no floor yet. */
export const envFor = (room, geom = stageGeom(room)) => (room in FLOOR_OF ? cityEnv(FLOOR_OF[room], geom) : ENV);

export const MAX_ZOOM = 2.5; // × the smallest zoom, in a world with no zoom of its own (the terrain)

/** The rooms you can visit, in the bottom bar's order (the locker last, on its own row). */
export const STAGE_ROOMS = ['bike', 'pool', 'run', 'gym', 'locker'];
/**
 * A room's art geometry on the stage: the painted 8 × 8 room (the locker's is the square one), or
 * once the room is expanded (expansions.js; only the locker can be yet) its 32 × 32 picture, all of
 * it when `size` is 32 and taped off to its back 16 × 16 when it isn't; `taped` shows it taped off
 * to the back 8 × 8.
 */
export const stageGeom = (room, size = false, taped = false) => {
  if (room === 'locker') return taped ? 'locker-16-tape' : size === 32 ? 'locker-32' : size ? 'locker-16' : 'locker-square';
  return room;
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
