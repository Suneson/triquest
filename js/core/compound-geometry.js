// compound-geometry.js — the compound as one building (docs/COMPOUND.md). Pure.
//
// The rooms aren't laid out on a screen grid; they're blocks of one isometric
// building. Block (cu, cv) sits cu steps along the building's right-hand axis U
// and cv steps along its left-hand axis V from the back corner:
//
//              back corner
//                 GYM          (0,0)
//            BIKE      POOL    (0,1)  (1,0)
//                 RUN          (1,1)
//            LOCKER (2 wide)   (0,2)–(1,2)
//                 front corner
//
// Each room's art has its floor measured as three corners (placement.js
// ROOM_GEOMETRY). An affine map takes those three corners exactly onto the
// block's corners in the building, so neighbouring floors share their edges
// to the pixel. Rooms are drawn back to front. Where a room's back wall stands
// on an edge it shares with a room behind it, the wall is an interior wall:
// it's cut down to a low curb (the dollhouse cut), so the room behind stays
// in view and the two read as one floor. Outer walls keep their full height.

import { ROOM_GEOMETRY, ROOM_SIZE, roomsOf } from './placement.js';

export const ISO_METRICS = {
  // one block along each axis, in world px (the gym's floor at 1100 px wide)
  U: [511, 284],
  V: [-511, 284],
  // an interior wall's height after the cut, in % of the room art's height
  STUB: 3,
  // the wide locker's art has its long wall along its own V: it's mirrored
  // so the long side runs along the building's U, under the two rooms behind it
  MIRROR: { 'locker-landscape': true },
};

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];

/** Apply a 2×3 matrix [[a, c, e], [b, d, f]] (CSS matrix order: a b c d e f) to a point. */
export const apply = (M, [x, y]) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];

/** Invert a 2×3 matrix (a, b, c, d, e, f). */
export function invert(M) {
  const [a, b, c, d, e, f] = M;
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

/** The affine map taking three source points onto three targets: [a, b, c, d, e, f]. */
export function affineFrom3(src, dst) {
  const [[x1, y1], [x2, y2], [x3, y3]] = src;
  const det = x1 * (y2 - y3) - x2 * (y1 - y3) + x3 * (y1 - y2);
  const solve = (t1, t2, t3) => [
    (t1 * (y2 - y3) - t2 * (y1 - y3) + t3 * (y1 - y2)) / det,
    (x1 * (t2 - t3) - x2 * (t1 - t3) + x3 * (t1 - t2)) / det,
    (x1 * (y2 * t3 - y3 * t2) - x2 * (y1 * t3 - y3 * t1) + x3 * (y1 * t2 - y2 * t1)) / det,
  ];
  const [a, c, e] = solve(dst[0][0], dst[1][0], dst[2][0]);
  const [b, d, f] = solve(dst[0][1], dst[1][1], dst[2][1]);
  return [a, b, c, d, e, f];
}

/** A floor corner of a room's art, in its own px: corner 'back' | 'right' | 'left'. */
const cornerPx = (geom, corner) => {
  const [w, h] = ROOM_SIZE[geom];
  const p = ROOM_GEOMETRY[geom][corner];
  return [p[0] * w / 100, p[1] * h / 100];
};

/**
 * The compound for a layout (placement.js compoundLayout()) as positioned
 * rooms: { rooms: [{ ...room, cu, cv, wu, wv, M, Minv, clip, depth }], W, H }.
 * M maps the room's art px into the world; the world starts at (0, 0) with
 * everything in view.
 */
export function compoundGeometry(layout) {
  const { U, V } = ISO_METRICS;
  const blocks = roomsOf(layout).map((r) => ({ ...r, cu: r.col, cv: r.row, wu: r.span, wv: 1 }));
  const occupied = new Set();
  blocks.forEach((b) => { for (let i = 0; i < b.wu; i++) for (let j = 0; j < b.wv; j++) occupied.add(`${b.cu + i},${b.cv + j}`); });
  const has = (u, v) => occupied.has(`${u},${v}`);

  const rooms = blocks.map((b) => {
    const back = add(mul(U, b.cu), mul(V, b.cv));
    const alongU = add(back, mul(U, b.wu));
    const alongV = add(back, mul(V, b.wv));
    const mirror = !!ISO_METRICS.MIRROR[b.geom];
    // the art's right corner goes along U, its left along V (swapped when mirrored)
    const M = affineFrom3(
      [cornerPx(b.geom, 'back'), cornerPx(b.geom, 'right'), cornerPx(b.geom, 'left')],
      mirror ? [back, alongV, alongU] : [back, alongU, alongV],
    );
    // the walls on edges shared with a block behind are interior: cut down
    let behindU = false; let behindV = false; // a block behind the edge along U (v - 1) / along V (u - 1)
    for (let i = 0; i < b.wu; i++) if (has(b.cu + i, b.cv - 1)) behindU = true;
    for (let j = 0; j < b.wv; j++) if (has(b.cu - 1, b.cv + j)) behindV = true;
    // in the art, the back→right wall runs along U (V when mirrored)
    const rightCut = mirror ? behindV : behindU;
    const leftCut = mirror ? behindU : behindV;
    return { ...b, M, Minv: invert(M), clip: wallClip(b.geom, leftCut, rightCut), depth: b.cu + b.cv + (b.wu + b.wv) / 2 };
  });

  // shift so the whole compound starts at (0, 0)
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const r of rooms) {
    const [w, h] = ROOM_SIZE[r.geom];
    for (const p of [[0, 0], [w, 0], [0, h], [w, h]]) {
      const [x, y] = apply(r.M, p);
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  for (const r of rooms) {
    r.M = [r.M[0], r.M[1], r.M[2], r.M[3], r.M[4] - minX, r.M[5] - minY];
    r.Minv = invert(r.M);
  }
  rooms.sort((a, b) => a.depth - b.depth || a.cu - b.cu);
  return { layout, rooms, W: maxX - minX, H: maxY - minY };
}

/**
 * The visible part of a room's art as a CSS polygon in % of the art: all of it,
 * except the interior back walls above a low curb (STUB) at the floor line.
 */
export function wallClip(geom, leftCut, rightCut) {
  const g = ROOM_GEOMETRY[geom];
  const s = ISO_METRICS.STUB;
  const top = -10; const bottom = 110;
  const B = g.back; const R = g.right; const L = g.left;
  const pts = [];
  pts.push(leftCut ? [-2, L[1] - s] : [-2, top]);
  if (leftCut && rightCut) pts.push([B[0], B[1] - s]);
  else if (leftCut) pts.push([B[0], B[1] - s], [B[0], top]);
  else if (rightCut) pts.push([B[0], top], [B[0], B[1] - s]);
  else pts.push([B[0], top]);
  pts.push(rightCut ? [102, R[1] - s] : [102, top], [102, bottom], [-2, bottom]);
  return `polygon(${pts.map(([x, y]) => `${+x.toFixed(2)}% ${+y.toFixed(2)}%`).join(', ')})`;
}

/** A point in a room's art (% of it) in the world. */
export function roomToWorld(room, xPct, yPct) {
  const [w, h] = ROOM_SIZE[room.geom];
  return apply(room.M, [xPct * w / 100, yPct * h / 100]);
}

/** A world point in a room's art, in % of it. */
export function worldToRoom(room, x, y) {
  const [w, h] = ROOM_SIZE[room.geom];
  const [px, py] = apply(room.Minv, [x, y]);
  return { x: px / w * 100, y: py / h * 100 };
}
