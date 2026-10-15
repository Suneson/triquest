// swipe.js — horizontal swipe on a surface: left/right flicks switch the
// sport on the Profile tab and on another athlete's profile. Vertical scrolls,
// pinches and drags on sliders/inputs are left alone.

import { inEdge } from '../core/gesture.js';

const IGNORE = 'input, textarea, select, [contenteditable], .no-swipe';

/** Call `onSwipe('left' | 'right')` for a quick horizontal flick on `el`. Returns an unbind function. */
export function onSwipe(el, onSwipe, { min = 48, ratio = 1.4, maxMs = 700, when = () => true } = {}) {
  let start = null;
  const down = (e) => {
    const t = e.touches[0];
    // the left edge of an open layer belongs to "back" (nav.js), never to a sport swipe
    if (e.touches.length !== 1 || !when() || e.target.closest(IGNORE) || (inEdge(t.clientX) && e.target.closest('.layer'))) { start = null; return; }
    start = { x: t.clientX, y: t.clientY, at: Date.now() };
  };
  const up = (e) => {
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const quick = Date.now() - start.at <= maxMs;
    start = null;
    if (quick && Math.abs(dx) >= min && Math.abs(dx) > Math.abs(dy) * ratio) onSwipe(dx < 0 ? 'left' : 'right');
  };
  const cancel = () => { start = null; };
  el.addEventListener('touchstart', down, { passive: true });
  el.addEventListener('touchend', up, { passive: true });
  el.addEventListener('touchcancel', cancel, { passive: true });
  return () => {
    el.removeEventListener('touchstart', down);
    el.removeEventListener('touchend', up);
    el.removeEventListener('touchcancel', cancel);
  };
}

/** The sport next to `cur` in `order` for a swipe: left goes forward, right goes back. Stops at the ends. */
export function nextSport(order, cur, dir) {
  const i = Math.max(0, order.indexOf(cur));
  const j = dir === 'left' ? i + 1 : i - 1;
  return j < 0 || j >= order.length ? null : order[j];
}
