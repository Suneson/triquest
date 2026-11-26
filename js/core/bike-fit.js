// bike-fit.js: how the athlete sits on the bike, set by hand in the bike fit editor
// (js/app/bike-fit.js) and pasted here. js/app/bike-rider.js poses the rider from it.
//
// The bikes come from tools/export-bike.py: models/bikes/bike-lv<N>.glb, facing +Z, wheels on
// y = 0, each sized so its saddle is as far from the pedal axle as lv9's, so one pose fits them all.
//
//   pose[body]   the riding pose (DEFAULT_POSE's keys; distances in metres, angles in degrees)
//   bikes[lv]    a nudge for one bike: { x, y, z } (metres: right, up, forward), s (size)

/** The bike levels that have a model. */
export const BIKE_LEVELS = [9];

export const DEFAULT_POSE = {
  seatF: 0, seatU: 0.06,           // the hips over the saddle point: forward, up
  lean: 50, headUp: 38,            // the back's lean forward from upright; the head turned up from it
  shDown: 0.02, shFwd: 0.03,       // the shoulders dropped and rolled forward
  handF: -0.05, handU: 0.02, handW: 0,   // the wrists from the brake hoods: forward, up, wider
  elbowOut: 0.4, elbowDown: 0.5,   // which way the elbows bend (0 to 1)
  wristB: 0, wristT: 0, wristS: 0, // the hands turned at the wrist: bend, twist, side
  grip: 0.75, thumb: 0.5,          // how far the fingers and thumbs close (0 open, 1 fist)
  footF: -0.1, footU: 0.09,        // the ankles from the pedals: forward, up
  toeU: 0, kneeOut: 0.04,          // the toes down (up if less than 0); the knees out
  rpm: 75,                         // pedalling speed, turns a minute
};

// Not set yet: the editor's first fits go here.
export const BIKE_FIT = {
  pose: {},
  bikes: {},
};

/** A fit tidied for keeping: numbers only, rounded, keys at their default dropped. */
export function cleanPose(p) {
  const out = {};
  for (const [k, d] of Object.entries(DEFAULT_POSE)) {
    const v = Number(p?.[k]);
    if (!Number.isFinite(v)) continue;
    const r = Math.round(v * 1000) / 1000;
    if (r !== d) out[k] = r;
  }
  return out;
}
export function cleanNudge(n) {
  const out = {};
  for (const [k, d] of Object.entries({ x: 0, y: 0, z: 0, s: 1 })) {
    const v = Number(n?.[k]);
    if (!Number.isFinite(v)) continue;
    const r = Math.round(v * 1000) / 1000;
    if (r !== d) out[k] = r;
  }
  return Object.keys(out).length ? out : null;
}
