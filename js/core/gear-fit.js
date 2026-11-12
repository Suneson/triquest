// gear-fit.js: the hand-set fit of each accessory on each body, made in the fit editor
// (js/app/fit-editor.js) and pasted here. On top of the automatic fit (js/app/gear3d.js place()).
//
// Per body, per item: { x, y, z, s, rx, ry, rz }
//   x, y, z  a move (right, up, forward), in head heights (feet: foot lengths)
//   s        a size change (1 = as fitted)
//   rx       tilt forward, ry turn left, rz lean, in degrees, about the piece's middle
// The units follow the head, so a fit made on one outfit carries over to the others.

export const GEAR_FIT = {
  male: {},
  female: {},
};

export const FIT_KEYS = ['x', 'y', 'z', 's', 'rx', 'ry', 'rz'];

/** A fit with only known keys and finite numbers, rounded; null when it changes nothing. */
export function cleanFit(f) {
  if (!f || typeof f !== 'object') return null;
  const out = {};
  for (const k of FIT_KEYS) {
    const v = Number(f[k]);
    if (!Number.isFinite(v)) continue;
    const r = Math.round(v * 1000) / 1000;
    if (k === 's' ? r !== 1 : r !== 0) out[k] = r;
  }
  return Object.keys(out).length ? out : null;
}
