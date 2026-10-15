// gesture.js — the maths behind edge-swipe back. Pure: no DOM, no timers.
//
// A drag that starts within EDGE px of the left edge of the top layer belongs
// to "back". The layer follows the finger; the screen beneath sits PARALLAX of
// the width behind and slides in as the layer leaves. Letting go past
// COMPLETE_AT of the width, or flicking faster than FLICK px/ms, finishes the
// pop; anything less springs back.

export const EDGE = 24;          // px from the left edge that claims the gesture
export const SLOP = 10;          // px of travel before we decide horizontal vs vertical
export const COMPLETE_AT = 0.4;  // fraction of the width
export const FLICK = 0.5;        // px per ms
export const PARALLAX = 0.2;     // the layer beneath starts this far behind

/** Does a touch at x (viewport px) start an edge swipe? */
export const inEdge = (x, edge = EDGE) => x >= 0 && x <= edge;

/**
 * Once the finger has moved (dx, dy) from its start: 'back' (horizontal, to the
 * right), 'other' (vertical or leftward: let the page have it) or null (too
 * early to tell).
 */
export function classify(dx, dy, slop = SLOP) {
  if (Math.abs(dx) < slop && Math.abs(dy) < slop) return null;
  if (dx > 0 && Math.abs(dx) > Math.abs(dy)) return 'back';
  return 'other';
}

/** How far the layer has travelled, 0..1. */
export const progress = (dx, width) => (width > 0 ? Math.min(1, Math.max(0, dx / width)) : 0);

/** Velocity in px/ms from the last few samples [{x, t}], newest last. */
export function velocity(samples, windowMs = 80) {
  if (!samples || samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  let first = samples[0];
  for (let i = samples.length - 2; i >= 0; i--) {
    first = samples[i];
    if (last.t - samples[i].t >= windowMs) break;
  }
  const dt = last.t - first.t;
  return dt > 0 ? (last.x - first.x) / dt : 0;
}

/** On release: does the pop complete? */
export function shouldComplete(dx, width, v) {
  if (dx <= 0) return false;
  return progress(dx, width) >= COMPLETE_AT || v >= FLICK;
}

/** Where the layer beneath sits (px) for a given progress: -PARALLAX·w → 0. */
export const beneathOffset = (p, width) => -PARALLAX * width * (1 - p);

/** Scrim opacity over the layer beneath: dark at rest, clear when the top layer has gone. */
export const scrimOpacity = (p, max = 0.5) => max * (1 - p);

// ---- pull to refresh -------------------------------------------------------------------

export const PULL_READY = 64;   // px of (damped) pull that arms a refresh
export const PULL_MAX = 96;     // the sprite never travels further than this

/** Finger travel → where the sprite sits, how wound up it is (0..1), and whether letting go refreshes. */
export function pullState(dy) {
  const d = Math.max(0, dy) * 0.5; // a heavy rope: half the finger's travel
  const offset = Math.min(PULL_MAX, d);
  return { offset, frac: Math.min(1, d / PULL_READY), ready: d >= PULL_READY };
}
