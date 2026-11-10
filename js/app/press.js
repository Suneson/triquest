// press.js — everything you can press gives under the finger and springs back.
//
// One listener for the whole app: on the way down the control shrinks a touch, on the way up
// it overshoots and settles. Big things (a card, a row) give less than small ones (an icon
// button). It runs on the compositor (the `scale` property through the Web Animations API), on
// top of whatever CSS animation or transform the control already has, so nothing is cancelled.
// A press that turns into a scroll just lets go. Off under reduced motion.

import { prefersReducedMotion } from './effects.js';

const PRESSABLE = 'button, [role="button"], a.btn, [data-action], .sc-card, .wr-card';
// not these: things you drag, type in, or that are a whole screen
const SKIP = 'input, textarea, select, [contenteditable], [data-no-press], .dg-item, .dg-vp, .wr-canvas, .modal-backdrop, .layer, [disabled], [aria-disabled="true"]';
const SPRING = 'cubic-bezier(.3, 1.7, .5, 1)';

let held = null; // { el, anim }

const reduced = () => prefersReducedMotion() || document.body.classList.contains('rm');

function target(e) {
  const el = e.target?.closest?.(PRESSABLE);
  if (!el || el.matches(SKIP) || el.closest('[data-no-press]')) return null;
  return el;
}

/** How far it gives: a small control squeezes more than a wide card. */
export function pressScale(width, height) {
  const big = Math.max(width, height);
  if (big >= 260) return 0.985;
  if (big >= 140) return 0.965;
  return 0.92;
}

function down(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  release(false);
  if (reduced()) return;
  const el = target(e);
  if (!el || !el.animate) return;
  const r = el.getBoundingClientRect();
  const s = pressScale(r.width, r.height);
  const anim = el.animate([{ scale: String(s) }], { duration: 90, easing: 'ease-out', fill: 'forwards' });
  held = { el, anim, s };
}

function release(pop) {
  if (!held) return;
  const { el, anim, s } = held;
  held = null;
  anim.cancel();
  if (pop && el.isConnected) el.animate([{ scale: String(s) }, { scale: '1' }], { duration: 300, easing: SPRING });
}

/** Start listening (once, at boot). */
export function wirePress() {
  document.addEventListener('pointerdown', down, { passive: true, capture: true });
  document.addEventListener('pointerup', () => release(true), { passive: true, capture: true });
  document.addEventListener('pointercancel', () => release(false), { passive: true, capture: true });
  // a finger that slides off, or a list that starts to scroll
  document.addEventListener('scroll', () => release(false), { passive: true, capture: true });
}
