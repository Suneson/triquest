// spring.js — the app's motion tokens and its spring. Pure: no DOM, no timers.
//
// The rules (docs/UI-POLISH.md, "Motion rules"):
//  1. A tap, a toggle or a released sheet is done inside 150–300 ms. Nothing here settles later.
//  2. What arrives eases out hard (EASE_OUT) or rides an under-damped spring. What leaves eases in
//     (EASE_IN) and is shorter: 100–180 ms.
//  3. A squash starts from where the thing is held: a button from its foot, a card from the finger.
//  4. A drag that's let go keeps its speed: the spring starts at the finger's velocity, and a
//     running spring can be caught and read (position and velocity) at any moment.
//
// A spring is { stiffness, damping, mass }. `zeta` under 1 overshoots (under-damped); 1 lands
// without a bounce. `springSettle` says how long it takes, and never says more than 300 ms.

export const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const EASE_IN = 'cubic-bezier(0.7, 0, 0.84, 0)';

/** Durations in ms. Enter is always the longer of a pair. */
export const DUR = Object.freeze({
  pressDown: 100,   // finger lands: the control gives
  toggle: 160,      // a tab, a chip, a switch changing state
  enter: 240,       // a partial sheet, a panel, a card arriving
  sheetIn: 300,     // a sheet rising from the foot of the screen (the ceiling)
  exit: 160,        // anything leaving by a tap
  sheetOut: 180,    // a sheet dropping away (the longest exit)
  stagger: 30,      // between one card of a cascade and the next
  staggerMax: 150,  // the cascade's last delay
});

/** Springs. zeta = damping / (2·√(stiffness·mass)). */
export const SPRING = Object.freeze({
  // a released button: quick, one clear overshoot (zeta 0.46, 20% over, settles in ~260 ms)
  press: Object.freeze({ stiffness: 1150, damping: 31, mass: 1 }),
  // something popping in (a handle, a badge, the Close button): zeta 0.57, 11% over, ~250 ms
  pop: Object.freeze({ stiffness: 1000, damping: 36, mass: 1 }),
  // a sheet let go short of closing: back up with a small bounce (zeta 0.70, 5% over, ~250 ms)
  sheetBack: Object.freeze({ stiffness: 520, damping: 32, mass: 1 }),
  // a sheet flung away: no bounce, just the finger's speed carried on (zeta 1, ~180 ms)
  sheetAway: Object.freeze({ stiffness: 1024, damping: 64, mass: 1 }),
});

export const zeta = ({ stiffness, damping, mass = 1 }) => damping / (2 * Math.sqrt(stiffness * mass));

/**
 * Where a spring is `t` ms after it was let go.
 * It runs from `from` to `to`, starting at `v0` (units per ms, positive towards larger values).
 * Closed form, so any moment can be asked for directly: that's what lets a running spring be caught.
 * @returns {{ x: number, v: number }} position and velocity (units per ms)
 */
export function springAt(t, { from = 0, to = 1, v0 = 0, stiffness, damping, mass = 1 }) {
  const s = Math.max(0, t) / 1000;
  const w0 = Math.sqrt(stiffness / mass);
  const z = damping / (2 * Math.sqrt(stiffness * mass));
  const x0 = from - to;          // displacement from rest
  const vs = v0 * 1000;          // per second
  let x; let v;
  const kind = Math.abs(z - 1) > 1e-6 ? Math.sign(1 - z) : 0;   // 1 bounces, 0 just lands, -1 creeps
  if (kind === 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    const A = x0; const B = (vs + z * w0 * x0) / wd;
    const e = Math.exp(-z * w0 * s); const c = Math.cos(wd * s); const sn = Math.sin(wd * s);
    x = e * (A * c + B * sn);
    v = e * ((B * wd - z * w0 * A) * c - (A * wd + z * w0 * B) * sn);
  } else if (kind === 0) {
    const B = vs + w0 * x0; const e = Math.exp(-w0 * s);
    x = e * (x0 + B * s);
    v = e * (B - w0 * (x0 + B * s));
  } else {
    const r = Math.sqrt(z * z - 1); const r1 = -w0 * (z - r); const r2 = -w0 * (z + r);
    const C2 = (vs - r1 * x0) / (r2 - r1); const C1 = x0 - C2;
    x = C1 * Math.exp(r1 * s) + C2 * Math.exp(r2 * s);
    v = C1 * r1 * Math.exp(r1 * s) + C2 * r2 * Math.exp(r2 * s);
  }
  return { x: to + x, v: v / 1000 };
}

/**
 * How long (ms) until the spring is within `rest` of its target and stays there, never more than
 * `cap`. `rest` is in the spring's own units: a pixel for a sheet, 0.01 (1%) for a scale.
 * The cap is rule 1: at 300 ms whatever is left (under two pixels with the tokens above) is dropped.
 */
export function springSettle(cfg, rest = 1, cap = 300) {
  const to = cfg.to ?? 1;
  let last = 0;
  for (let t = 0; t <= cap; t += 4) if (Math.abs(springAt(t, cfg).x - to) > rest) last = t + 4;
  return Math.min(cap, Math.max(16, last));
}

/**
 * The spring as evenly spaced samples, ready to be keyframes: the browser runs them off the main
 * thread, so the motion holds its frame rate while the page is busy.
 * @returns {{ values: number[], duration: number }}
 */
export function springSamples(cfg, { rest = 1, step = 1000 / 60, cap = 300 } = {}) {
  const duration = springSettle(cfg, rest, cap);
  const n = Math.max(2, Math.ceil(duration / step));
  const values = [];
  for (let i = 0; i < n; i++) values.push(springAt((i / n) * duration, cfg).x);
  values.push(cfg.to ?? 1);
  return { values, duration };
}

/** A spring from 0 to 1 as a CSS `linear()` easing and the duration to give it. */
export function springEasing(spring, { v0 = 0 } = {}) {
  const { values, duration } = springSamples({ ...spring, from: 0, to: 1, v0 }, { rest: 0.01 });
  return { easing: `linear(${values.map((x) => +x.toFixed(3)).join(', ')})`, duration: Math.round(duration / 10) * 10 };
}
