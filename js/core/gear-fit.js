// gear-fit.js: the hand-set fit of each accessory on each body, made in the fit editor
// (js/app/fit-editor.js) and pasted here. On top of the automatic fit (js/app/gear3d.js place()).
//
// Per body, per item: { x, y, z, s, rx, ry, rz }
//   x, y, z  a move (right, up, forward), in head heights (feet: foot lengths)
//   s        a size change (1 = as fitted)
//   rx       tilt forward, ry turn left, rz lean, in degrees, about the piece's middle
// The units follow the head, so a fit made on one outfit carries over to the others.

// Set in the fit editor, 12 November 2026. The aero helmet was turned round after: fit it again.
export const GEAR_FIT = {
  male: {
    'hair-crop': { y: 0.11, z: 0.02, s: 0.755, rx: 6 },
    'hair-curls': { y: 0.215, z: 0.02, s: 0.875, rx: 6 },
    'helmet-road': { y: -0.02, z: -0.195, s: 0.84, rx: -16.5 },
    'helmet-blue': { z: -0.11, s: 0.765, rx: -18.5 },
    'helmet-gold': { y: 0.03, z: -0.205, s: 0.68, rx: -8 },
    'shoe-starter': { x: -0.02, y: -0.09, z: 0.05, rx: 3, ry: 12, rz: -6 },
    'shoe-runner': { x: -0.035, z: 0.01, s: 1.16, rx: 5, ry: 1 },
    'shoe-racer': { x: -0.025, z: 0.05, s: 1.055, rx: -2 },
    'shoe-trail': { x: -0.025, z: 0.06, s: 1.105, ry: 10 },
    'shoe-lifter': { x: -0.005, y: -0.09, z: 0.03, s: 1.085, rx: -1, ry: 9, rz: -3 },
    'shoe-trainer': { x: -0.015, z: 0.09, s: 1.105, ry: 11 },
    'shoe-cycling': { z: 0.05, s: 1.055, ry: 2 },
    'shoe-gold': { x: -0.015, z: 0.05, s: 1.045, ry: 7 },
    'hat-cap-navy': { y: -0.02, z: -0.12, s: 0.79, rx: 1 },
    'hat-cap-white': { y: 0.07, z: -0.08, s: 0.81, rx: 8 },
    'hat-visor': { y: 0.03, s: 0.95, rx: -15 },
    'hat-beanie': { z: -0.03, s: 1.045, rx: -16.5, rz: -48 },
    'hat-bucket': { y: -0.06, z: -0.06, s: 0.99, rx: -11, rz: -36.5 },
    'hat-gold': { z: -0.13, s: 0.79, rx: -12 },
    'glasses-sport': { y: 0.02, z: 0.09, s: 0.765, rx: 5 },
    'glasses-blue': { y: -0.01, z: 0.1, s: 0.775 },
    'glasses-gold': { y: 0.155, z: 0.11, s: 0.68, rx: 22.5 },
    'glasses-casual': { z: 0.08, s: 0.755, rx: 9 },
  },
  female: {
    'hair-long': { x: -0.015, y: 0.1, z: -0.06, s: 0.97, rx: 20.5 },
    'hair-braids': { z: -0.07, s: 0.95, rx: -1 },
    'hair-bun-low': { y: 0.13, z: 0.155, s: 0.725, rx: 10 },
    'helmet-road': { y: 0.02, z: -0.235, s: 0.82, rx: -23.5 },
    'helmet-blue': { y: 0.05, z: -0.175, s: 0.69, rx: -16.5 },
    'helmet-gold': { y: 0.06, z: -0.235, s: 0.735, rx: -3 },
    'shoe-starter': { x: 0.005, y: -0.04, z: 0.05, s: 1.035, ry: 10 },
    'shoe-runner': { x: -0.025, s: 1.12, ry: 2 },
    'shoe-racer': { z: 0.08, s: 1.065, ry: 7, rz: 2 },
    'shoe-trail': { x: -0.015, z: 0.09, s: 1.105, ry: 11 },
    'shoe-lifter': { x: -0.005, y: -0.08, s: 1.075, rx: 3, ry: 5, rz: -5 },
    'shoe-trainer': { x: -0.015, z: 0.05, s: 1.105, rx: 2, ry: 10 },
    'shoe-cycling': { z: 0.07, s: 1.035, ry: 6 },
    'shoe-gold': { x: -0.015, z: 0.08, s: 1.13 },
    'hat-cap-navy': { y: -0.03, z: -0.12, s: 0.755, rx: 8 },
    'hat-cap-white': { y: 0.1, z: -0.12, s: 0.755, rx: 16.5 },
    'hat-visor': { s: 0.895, rx: -13 },
    'hat-beanie': { s: 1.02, rx: -13, ry: 7, rz: -51 },
    'hat-bucket': { x: 0.035, z: -0.09, s: 0.905, rx: -9, rz: -35.5 },
    'hat-gold': { z: -0.15, s: 0.745, rx: -4 },
    'glasses-sport': { y: -0.03, z: 0.175, s: 0.7, rx: 10 },
    'glasses-blue': { y: -0.06, z: 0.08, s: 0.81, rx: 4 },
    'glasses-gold': { y: 0.14, z: 0.12, s: 0.7, rx: 26.5 },
    'glasses-casual': { y: -0.06, z: 0.07, s: 0.725, rx: 10 },
  },
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
