// press.js — everything you can press squashes under the finger and springs back.
//
// One listener for the whole app. The answer starts on the same frame as the touch (pointerdown,
// not click), and it has weight:
//  - a button squashes: it gets shorter and a touch wider, pinned at its foot, as if pushed into
//    the plate it stands on. Let go and a spring throws it back past its size (a stretch) and it
//    settles: SPRING.press, done inside 300 ms;
//  - a wide card or row gives a little around the finger, the point that's holding it.
// It runs on the compositor (`scale` and an added `translate` through the Web Animations API), on
// top of whatever CSS animation or transform the control already has, so nothing is cancelled.
// A second press during the spring-back starts from where the spring is, not from rest.
// A press that turns into a scroll just lets go. Off under reduced motion.

import { prefersReducedMotion } from './effects.js';
import { DUR, EASE_OUT, SPRING, springSamples } from '../core/spring.js';

const PRESSABLE = 'button, [role="button"], a.btn, [data-action], .sc-card, .wr-card';
// not these: things you drag, type in, or that are a whole screen
const SKIP = 'input, textarea, select, [contenteditable], [data-no-press], .dg-item, .dg-vp, .wr-canvas, .modal-backdrop, .layer, [disabled], [aria-disabled="true"]';

let held = null; // { el, x, y, tx, ty, t0, anims }

const reduced = () => prefersReducedMotion() || document.body.classList.contains('rm');

function target(e) {
  const el = e.target?.closest?.(PRESSABLE);
  if (!el || el.matches(SKIP) || el.closest('[data-no-press]')) return null;
  return el;
}

/**
 * How a control gives. A small one squashes hard from its foot; a wide card barely moves, and
 * from the finger. `x` is the scale across, `y` the scale up and down.
 * @returns {{ x: number, y: number, anchor: 'foot' | 'finger' }}
 */
export function pressShape(width, height) {
  const big = Math.max(width, height);
  if (big >= 260) return { x: 0.985, y: 0.985, anchor: 'finger' };
  if (big >= 140) return { x: 1.02, y: 0.93, anchor: 'foot' };
  return { x: 1.05, y: 0.88, anchor: 'foot' };
}

/**
 * Scaling happens about the centre; this is the shift that keeps the anchor still instead.
 * `rect` is the control's box, (px, py) where the finger is.
 */
export function anchorShift(shape, rect, px, py) {
  if (shape.anchor === 'foot') return { tx: 0, ty: (1 - shape.y) * rect.height / 2 };
  return { tx: (1 - shape.x) * (px - (rect.left + rect.width / 2)), ty: (1 - shape.y) * (py - (rect.top + rect.height / 2)) };
}

const shift = (el, frames, opts) => { try { return el.animate(frames, { ...opts, composite: 'add' }); } catch { return null; } };

function down(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  release(false);
  if (reduced()) return;
  const el = target(e);
  if (!el || !el.animate) return;
  const r = el.getBoundingClientRect();
  const s = pressShape(r.width, r.height);
  const { tx, ty } = anchorShift(s, r, e.clientX, e.clientY);
  // no "from" frame: it starts from wherever the control is, a spring-back in flight included
  const opts = { duration: DUR.pressDown, easing: EASE_OUT, fill: 'forwards' };
  const anims = [el.animate([{ scale: `${s.x} ${s.y}` }], opts), shift(el, [{ translate: '0px 0px' }, { translate: `${tx.toFixed(2)}px ${ty.toFixed(2)}px` }], opts)];
  held = { el, s, tx, ty, t0: performance.now(), anims };
}

function release(pop) {
  if (!held) return;
  const h = held;
  held = null;
  const drop = () => { for (const a of h.anims) a?.cancel(); };
  if (!pop || !h.el.isConnected) { drop(); return; }
  // a quick tap still gets its whole squash: the spring waits for the press to land
  const wait = Math.max(0, DUR.pressDown - (performance.now() - h.t0));
  setTimeout(() => {
    drop();
    if (!h.el.isConnected) return;
    const { values, duration } = springSamples({ ...SPRING.press, from: 0, to: 1 }, { rest: 0.01 });
    const opts = { duration, easing: 'linear' };
    h.el.animate(values.map((p) => ({ scale: `${(h.s.x + (1 - h.s.x) * p).toFixed(4)} ${(h.s.y + (1 - h.s.y) * p).toFixed(4)}` })), opts);
    shift(h.el, values.map((p) => ({ translate: `${(h.tx * (1 - p)).toFixed(2)}px ${(h.ty * (1 - p)).toFixed(2)}px` })), opts);
  }, wait);
}

/** Start listening (once, at boot). */
export function wirePress() {
  document.addEventListener('pointerdown', down, { passive: true, capture: true });
  document.addEventListener('pointerup', () => release(true), { passive: true, capture: true });
  document.addEventListener('pointercancel', () => release(false), { passive: true, capture: true });
  // a finger that slides off, or a list that starts to scroll
  document.addEventListener('scroll', () => release(false), { passive: true, capture: true });
}
