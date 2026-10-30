// tab-swipe.js — swipe between the dock's tabs with a finger, like a carousel.
//
// A horizontal drag in the middle of the screen takes the current tab with the
// finger; the next tab's card (its dock icon and name, on the house green) comes
// in beside it. Let go past a third of the screen, or with a flick, and the move
// finishes as the tab change itself (motion.js withTabTransition, from where the
// finger left it); otherwise it springs back.
//
// Left alone: vertical scrolls; anything open over the tabs; the screen's edges
// (the back swipe belongs to nav.js); inputs; anything that scrolls sideways;
// HOME's stage, where a drag moves the camera and a pinch zooms (swipe on HOME
// from its HUD or its room buttons instead).

import { TAB_ORDER } from './motion.js';
import { inEdge } from '../core/gesture.js';

const IGNORE = 'input, textarea, select, [contenteditable], .no-swipe, .dg-viewport, .dg-stage, .layer, .modal-root';
const LOCK = 10;          // px before the gesture picks a direction
const RATIO = 1.2;        // how much more sideways than down it must be
const COMMIT = 1 / 3;     // of the screen's width
const FLICK = 0.5;        // px/ms

const ICON = { home: 'journal', shop: 'shop', progress: 'home', chat: 'chat', leaderboards: 'ranks' };
const LABEL = { home: 'nav.journal', shop: 'nav.shop', progress: 'nav.home', chat: 'nav.chat', leaderboards: 'nav.ranks' };

/** Does something between the target and the view scroll sideways? */
function scrollsSideways(el, stop) {
  for (let n = el; n && n !== stop; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 2) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}

/**
 * Wire the swipe on `view`.
 *   current()  the tab showing now ('journal' counts as 'home')
 *   go(tab, { fromDx })  change tab, carrying on from the finger
 *   blocked()  true while the swipe must stay out of the way (a layer is open, a scene…)
 *   label(key) the translated name of a tab
 */
export function wireTabSwipe(view, { current, go, blocked, label }) {
  let g = null; // the gesture: { x, y, t, dx, lock, to, peek }

  const neighbour = (dir) => {
    const at = TAB_ORDER.indexOf(current() === 'journal' ? 'home' : current());
    return TAB_ORDER[at + dir] || null;
  };

  const makePeek = (tab, dir) => {
    const p = document.createElement('div');
    p.className = 'tab-peek';
    p.setAttribute('aria-hidden', 'true');
    p.innerHTML = `<span class="tab-peek-in"><img src="icons/UI/nav/nav-${ICON[tab]}.webp" alt="" width="128" height="128"><b>${label(LABEL[tab])}</b></span>`;
    const r = view.getBoundingClientRect();
    Object.assign(p.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    p.dataset.dir = String(dir);
    document.querySelector('.app')?.append(p);
    return p;
  };

  const place = (dx) => {
    const w = view.clientWidth;
    view.style.transform = `translateX(${dx}px)`;
    if (!g.peek) return;
    const dir = Number(g.peek.dataset.dir);
    g.peek.style.transform = `translateX(${dx + dir * w}px)`;
    // the next tab's icon stays in the middle of the slice that's showing
    const shown = Math.min(w, Math.abs(dx));
    const mid = dir > 0 ? shown / 2 : w - shown / 2;
    g.peek.firstElementChild.style.left = `${Math.max(dir > 0 ? 56 : -Infinity, Math.min(dir > 0 ? Infinity : w - 56, mid))}px`;
  };

  const reset = (animate) => {
    const peek = g?.peek;
    view.classList.remove('is-dragging');
    if (animate) {
      view.style.transition = 'transform 200ms cubic-bezier(.2, .8, .2, 1)';
      if (peek) peek.style.transition = view.style.transition;
      view.style.transform = 'translateX(0)';
      if (peek) peek.style.transform = `translateX(${Number(peek.dataset.dir) * view.clientWidth}px)`;
      setTimeout(() => { view.style.removeProperty('transition'); view.style.removeProperty('transform'); peek?.remove(); }, 220);
    } else {
      view.style.removeProperty('transform');
      peek?.remove();
    }
    g = null;
  };

  view.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || blocked()) { g = null; return; }
    const t = e.touches[0];
    if (inEdge(t.clientX) || e.target.closest(IGNORE) || scrollsSideways(e.target, view)) { g = null; return; }
    g = { x: t.clientX, y: t.clientY, t: performance.now(), dx: 0, lock: null, to: null, peek: null, vx: 0, lastX: t.clientX, lastT: performance.now() };
  }, { passive: true });

  view.addEventListener('touchmove', (e) => {
    if (!g) return;
    if (e.touches.length !== 1) { reset(true); return; }
    const t = e.touches[0];
    const dx = t.clientX - g.x; const dy = t.clientY - g.y;
    if (!g.lock) {
      if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
      g.lock = Math.abs(dx) > Math.abs(dy) * RATIO ? 'x' : 'y';
      if (g.lock === 'y') { g = null; return; }
      view.classList.add('is-dragging');
    }
    const now = performance.now();
    g.vx = (t.clientX - g.lastX) / Math.max(1, now - g.lastT); g.lastX = t.clientX; g.lastT = now;
    const dir = dx < 0 ? 1 : -1; // finger left = the next tab, to the right
    const to = neighbour(dir);
    if (to !== g.to) { g.peek?.remove(); g.to = to; g.peek = to ? makePeek(to, dir) : null; }
    // past the first or last tab, the view only gives a little
    g.dx = to ? dx : dx / 4;
    e.preventDefault();
    place(g.dx);
  }, { passive: false });

  const up = () => {
    if (!g || g.lock !== 'x') { g = null; return; }
    const w = view.clientWidth;
    const flick = Math.abs(g.vx) > FLICK && Math.sign(g.vx) === Math.sign(g.dx);
    if (g.to && (Math.abs(g.dx) > w * COMMIT || flick)) {
      const { to, dx, peek } = g;
      g = null;
      view.classList.remove('is-dragging');
      view.style.removeProperty('transform');
      go(to, { fromDx: dx });
      peek?.remove();
    } else reset(true);
  };
  view.addEventListener('touchend', up, { passive: true });
  view.addEventListener('touchcancel', () => g && reset(true), { passive: true });
}
