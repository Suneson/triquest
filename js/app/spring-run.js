// spring-run.js — the spring (js/core/spring.js) put on an element.
//
// The spring is worked out once, as keyframes, and handed to the browser: it runs on the
// compositor, so it keeps its frame rate while the page is busy. It can still be caught at any
// moment: `stop()` says where it was and how fast it was going, so a finger (or another spring)
// can take over without a jump.

import { springAt, springSamples } from '../core/spring.js';

/**
 * Spring an element's vertical offset (px) from `from` to `to`, starting at `v0` px/ms.
 * `linked` are other elements whose look follows the same motion: [{ el, frame: (y) => keyframe }].
 * One source of truth, so a scrim is always exactly as faded as its sheet is far down.
 * `hold`: stay at the end (something that is leaving and will be removed).
 * @returns {{ done: Promise<void>, duration: number, stop: () => { x: number, v: number } }}
 */
export function springY(el, { from, to, v0 = 0, spring, cap = 300, rest = 1, linked = [], hold = false }) {
  const cfg = { ...spring, from, to, v0 };
  const { values, duration } = springSamples(cfg, { rest, cap });
  const opts = { duration, easing: 'linear', fill: hold ? 'forwards' : 'none' };
  const t0 = performance.now();
  const anims = [el.animate(values.map((y) => ({ translate: `0 ${y.toFixed(1)}px` })), opts)];
  for (const l of linked) if (l.el) anims.push(l.el.animate(values.map((y) => l.frame(y)), opts));
  let live = true;
  const done = anims[0].finished.then(() => { live = false; }, () => { live = false; });
  return {
    duration, done,
    /** Catch it: cancel the run and report where it was. The caller places the element. */
    stop() {
      if (!live) return { x: to, v: 0 };
      live = false;
      const now = springAt(Math.min(duration, performance.now() - t0), cfg);
      for (const a of anims) a.cancel();
      return now;
    },
  };
}

/** The vertical offset (px) an element is drawn at right now, a running animation included. */
export function currentY(el) {
  const t = getComputedStyle(el).translate;
  if (!t || t === 'none') return 0;
  const y = t.split(' ')[1] || '0';
  return y.endsWith('%') ? (parseFloat(y) / 100) * el.getBoundingClientRect().height : parseFloat(y) || 0;
}
