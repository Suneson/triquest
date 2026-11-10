// nav.js — the one layer stack. Everything that opens over the tabs (sheets,
// full-screen screens, the gym logger, pickers, the bell) is a layer here, and
// this module is the single source of truth for what is on top.
//
//   openLayer(name, opts)  → the layer's element; render into it
//   closeLayer(el?)        → close that layer (default: the top one)
//   closeAllLayers()       → back to the tabs
//
// History: while any layer is open there is exactly one extra history entry
// (a "guard"). Android back, browser back and the iOS Safari edge gesture land
// on popstate, which closes one layer and re-arms the guard if more remain.
// Closing from the UI drops the guard once the stack is empty. One guard, not
// one entry per layer, so the stack and history can't drift apart: the worst
// case is one stale guard, which popstate skips over.
//
// Sheets: a layer opened with `sheet: true` (the shop, the inventory, the wardrobe) rises from
// the bottom and stops short of the top, so the base stays in view above it under a light scrim.
// Drag it down (from its header, or from anywhere once its list is at the top), tap the strip
// above it, or go back: it slides away. Partial sheets (.modal) take the same downward drag.
//
// Edge swipe: a drag that starts in the left 24px of the top layer moves it
// with the finger and reveals the layer beneath (20% behind, under a scrim).
// Past 40% or a flick completes; otherwise it springs back. Reduced motion: no
// follow, the swipe still pops. Tabs are not layers: with nothing open the
// edge does nothing here.

import { prefersReducedMotion } from './effects.js';
import { EDGE, inEdge, classify, progress, velocity, shouldComplete, beneathOffset, scrimOpacity, classifyDown, sheetOffset, sheetShouldClose } from '../core/gesture.js';

const stack = []; // { id, name, el, onClose, swipeBack, trigger, beneath, beneathInert }
let seq = 0;
let ignorePops = 0;

const reduced = () => prefersReducedMotion() || document.body.classList.contains('rm');
const appEl = () => document.querySelector('.app');
const GUARD = { navGuard: true };

export const hasLayers = () => stack.length > 0;
export const topLayer = () => stack[stack.length - 1] || null;
export const topLayerName = () => topLayer()?.name || null;
export const layerByName = (name) => stack.find((l) => l.name === name) || null;
/** Is this node inside an open layer? */
export const inLayer = (node) => !!node?.closest?.('.layer');

/**
 * Open a layer and return its element. If the top layer already has this
 * name, it's reused (a redraw, not a new layer): the caller just re-renders.
 * `onClose` runs once however the layer goes (button, back, swipe, Escape).
 */
// `instant`: the layer appears and goes at once, like a chat thread (the shop, the inventory)
// `sheet`: it rises from the bottom and leaves the base in view above it (see the top of this file)
export function openLayer(name, { onClose = null, swipeBack = true, className = '', reuse = true, instant = false, sheet = false } = {}) {
  const top = topLayer();
  if (reuse && top?.el && top.name === name) {
    if (onClose) top.onClose = onClose;
    return top.el;
  }
  return openOver(name, { onClose, swipeBack, className, instant, sheet });
}

const SHEET_IN = 'cubic-bezier(.16, 1, .3, 1)';
const SHEET_MS = 380;

function openOver(name, { onClose, swipeBack, className, instant = false, sheet = false }) {
  const top = topLayer();
  const el = document.createElement('div');
  el.className = `modal-root layer open${instant || sheet ? ' is-instant' : ''}${sheet ? ' is-sheet' : ''} ${className}`.trim();
  el.dataset.layer = name;
  el.style.zIndex = String(10000 + stack.length * 2);
  const beneath = top?.el || appEl();
  const layer = {
    id: ++seq, name, el, onClose, instant, sheet,
    swipeBack: swipeBack && !sheet,   // a sheet goes down, not sideways
    swipeDown: swipeBack,
    trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    beneath, beneathInert: beneath ? beneath.inert : false,
  };
  if (beneath) { beneath.inert = true; beneath.setAttribute('aria-hidden', 'true'); }
  stack.push(layer);
  if (sheet) {
    // the scrim is its own element under the sheet, so the sheet can move as one piece over it
    const scrim = layer.scrim = document.createElement('div');
    scrim.className = 'sheet-scrim';
    scrim.style.zIndex = String(10000 + stack.length * 2 - 3);
    document.body.appendChild(scrim);
    if (!reduced()) {
      scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
      el.classList.add('is-entering');
      el.animate([{ translate: '0 100%' }, { translate: '0 0' }], { duration: SHEET_MS, easing: SHEET_IN });
      setTimeout(() => el.classList.remove('is-entering'), SHEET_MS + 120);
    }
    // the strip of base above the sheet (and its handle): a tap there closes it
    el.addEventListener('click', (e) => { if (e.target === el) closeLayer(el); });
  }
  document.body.appendChild(el);
  // every sheet header's way back (sheet.js) carries data-layer-close
  el.addEventListener('click', (e) => { if (e.target.closest('[data-layer-close]')) closeLayer(el); });
  if (!history.state?.navGuard) history.pushState(GUARD, '');
  // focus moves into the new layer once the caller has rendered into it; the
  // dialog itself takes focus (not a text field: no keyboard popping up)
  requestAnimationFrame(() => {
    if (!el.isConnected || el.contains(document.activeElement)) return;
    const target = el.querySelector('[role="dialog"]') || el.firstElementChild || el;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
  document.body.classList.add('has-layer');
  requestAnimationFrame(markCovered);   // once the caller has drawn into it
  return el;
}

// A full screen over the tabs hides them completely: what runs under it (the city's 3D, the
// base's loops) can rest. A sheet or a partial sheet leaves them in view.
const coversAll = (l) => !!l.el && !l.sheet && !!l.el.querySelector(':scope > .fh-screen, :scope > .ob-screen, :scope > .cx');
function markCovered() { document.body.classList.toggle('base-covered', stack.some(coversAll)); }
/** Is the tab under the layers completely hidden by one of them? */
export const baseCovered = () => document.body.classList.contains('base-covered');

/**
 * A route inside a tab that isn't drawn as a layer (a chat thread inside the
 * Chat tab). It takes part in back, Escape and the edge swipe like a layer —
 * `onClose` puts the tab back — but nothing is created, made inert or moved.
 */
export function openRoute(name, { onClose = null, area = null } = {}) {
  const top = topLayer();
  if (top && top.name === name && !top.el) { top.onClose = onClose; return; }
  stack.push({ id: ++seq, name, el: null, area, onClose, swipeBack: true, trigger: null, beneath: null });
  if (!history.state?.navGuard) history.pushState(GUARD, '');
}

/** Leave a route without running its onClose (the tab already put itself back). */
export function leaveRoute(name) {
  const idx = stack.findIndex((l) => l.name === name && !l.el);
  if (idx < 0) return;
  stack[idx].onClose = null;
  closeLayer(idx);
}

// take the top layer off the stack and out of the page (no history work).
// `animate`: the sheet leaves the way it came (four steps to the right) and
// is removed after; the stack is already updated, so nothing waits on it.
function removeTop(animate = false) {
  const layer = stack.pop();
  if (!layer) return;
  if (layer.el) {
    const el = layer.el;
    if (layer.sheet) {
      const scrim = layer.scrim;
      if (animate && !reduced()) {
        el.inert = true; el.style.pointerEvents = 'none';
        // from wherever it is (a drag may have left it part-way down)
        el.animate([{ translate: '0 100%' }], { duration: 240, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' });
        scrim?.animate([{ opacity: 0 }], { duration: 240, easing: 'ease-in', fill: 'forwards' });
        setTimeout(() => { el.remove(); scrim?.remove(); }, 250);
      } else { el.remove(); scrim?.remove(); }
    } else if (animate && !reduced() && !layer.instant) {
      el.classList.add('is-leaving');
      el.inert = true;
      setTimeout(() => el.remove(), 170);
    } else el.remove();
  }
  const b = layer.beneath;
  if (b) {
    b.inert = layer.beneathInert;
    if (!layer.beneathInert) b.removeAttribute('aria-hidden');
    b.style.translate = '';
    b.style.transition = '';
  }
  if (!stack.some((l) => l.el)) document.body.classList.remove('has-layer');
  markCovered();
  try { layer.onClose?.(); } catch (e) { console.warn('layer onClose', e); }
  const t = layer.trigger;
  if (t?.isConnected && !t.closest('[inert]')) t.focus({ preventScroll: true });
}

// once the stack is empty, step off the guard entry so back leaves the tabs.
// Deferred a tick: "close everything, then open X" (a common pair) keeps the
// guard it already has instead of racing a back against a push.
function dropGuard() {
  setTimeout(() => {
    if (stack.length || !history.state?.navGuard) return;
    ignorePops++;
    history.back();
  }, 0);
}

/** Close a layer (default: the top one) and everything above it. */
export function closeLayer(target, { animate = true } = {}) {
  const el = target?.el || target;
  const idx = typeof target === 'number' ? target
    : el ? stack.findIndex((l) => l.el === el || l.name === el) : stack.length - 1;
  if (idx < 0) return;
  // only the layer you see animates out; anything under it goes at once
  while (stack.length > idx) removeTop(animate && stack.length - 1 === idx);
  dropGuard();
}

/** Close every layer: back to the tabs. */
export function closeAllLayers() {
  if (!stack.length) return;
  while (stack.length) removeTop();
  dropGuard();
}

// ---- back button / Escape ------------------------------------------------------------

window.addEventListener('popstate', () => {
  if (ignorePops > 0) { ignorePops--; return; }
  if (stack.length) {
    removeTop(true);
    if (stack.length) history.pushState(GUARD, ''); // still layers: re-arm back
    return;
  }
  // a stale guard (layers were closed while a back was in flight): skip it
  if (history.state?.navGuard) { ignorePops++; history.back(); }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !stack.length || e.defaultPrevented) return;
  e.preventDefault();
  closeLayer();
});

// a reload while a layer was open lands on a guard with nothing to guard
if (history.state?.navGuard) history.replaceState(null, '');

// ---- edge swipe back ------------------------------------------------------------------

// the part of a layer that moves: the full screen, the sheet, or the layer itself
const panelOf = (el) => el.querySelector(':scope > .fh-screen, :scope > .modal, :scope > .level-lightbox') || el.firstElementChild || el;
const isScreen = (el) => !!el.querySelector(':scope > .fh-screen');

let drag = null;

function onStart(e) {
  if (drag || e.touches.length !== 1) return;
  const top = topLayer();
  if (!top || !top.swipeBack) return;
  const t = e.touches[0];
  const area = top.el || top.area;
  if (!inEdge(t.clientX) || !area?.contains(e.target)) return;
  drag = { layer: top, x0: t.clientX, y0: t.clientY, dx: 0, state: null, samples: [{ x: t.clientX, t: e.timeStamp }] };
}

function onMove(e) {
  if (!drag) return;
  const t = e.touches[0];
  const dx = t.clientX - drag.x0;
  const dy = t.clientY - drag.y0;
  if (!drag.state) {
    const c = classify(dx, dy);
    if (!c) return;
    if (c === 'other') { drag = null; return; }
    drag.state = 'back';
    begin();
  }
  if (e.cancelable) e.preventDefault(); // ours now: no scroll, no sport swipe
  drag.dx = Math.max(0, dx);
  drag.samples.push({ x: t.clientX, t: e.timeStamp });
  if (drag.samples.length > 8) drag.samples.shift();
  if (!drag.reduced) follow(drag.dx);
}

function begin() {
  const { layer } = drag;
  drag.reduced = reduced() || !layer.el; // a route has nothing to drag: it pops on release
  drag.width = window.innerWidth;
  if (!layer.el) return;
  drag.panel = panelOf(layer.el);
  drag.screen = isScreen(layer.el);
  drag.backdrop = layer.el.querySelector(':scope > .modal-backdrop');
  if (drag.reduced) return;
  // full screens get a scrim over the layer beneath; sheets fade their own backdrop
  if (drag.screen) {
    drag.scrim = document.createElement('div');
    drag.scrim.className = 'nav-scrim';
    layer.el.prepend(drag.scrim);
  }
  drag.panel.style.transition = 'none';
  drag.panel.style.willChange = 'translate';
  if (drag.screen && layer.beneath) { layer.beneath.style.transition = 'none'; layer.beneath.style.willChange = 'translate'; }
  layer.el.classList.add('nav-dragging');
}

function follow(dx) {
  const p = progress(dx, drag.width);
  drag.panel.style.translate = `${dx}px 0`;
  if (drag.scrim) drag.scrim.style.opacity = String(scrimOpacity(p));
  if (drag.backdrop) drag.backdrop.style.opacity = String(1 - p);
  if (drag.screen && drag.layer.beneath) drag.layer.beneath.style.translate = `${beneathOffset(p, drag.width)}px 0`;
}

function onEnd() {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.state !== 'back') return;
  const done = shouldComplete(d.dx, d.width, velocity(d.samples));
  if (d.reduced) { if (done) closeLayer(stack.indexOf(d.layer), { animate: false }); return; }
  settle(d, done);
}

function onCancel() {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.state === 'back' && !d.reduced) settle(d, false);
}

// finish the move: off to the right (pop) or back home (spring)
function settle(d, done) {
  const T = 'translate 180ms cubic-bezier(.2, .8, .2, 1), opacity 180ms ease-out';
  d.panel.style.transition = T;
  if (d.scrim) d.scrim.style.transition = T;
  if (d.backdrop) d.backdrop.style.transition = T;
  const b = d.screen ? d.layer.beneath : null;
  if (b) b.style.transition = T;
  requestAnimationFrame(() => {
    d.panel.style.translate = done ? `${d.width}px 0` : '0px 0';
    if (d.scrim) d.scrim.style.opacity = done ? '0' : String(scrimOpacity(0));
    if (d.backdrop) d.backdrop.style.opacity = done ? '0' : '1';
    if (b) b.style.translate = done ? '0px 0' : `${beneathOffset(0, d.width)}px 0`;
  });
  setTimeout(() => {
    if (done) { closeLayer(stack.indexOf(d.layer), { animate: false }); return; }
    d.panel.style.transition = ''; d.panel.style.translate = ''; d.panel.style.willChange = '';
    d.scrim?.remove();
    if (d.backdrop) { d.backdrop.style.transition = ''; d.backdrop.style.opacity = ''; }
    if (b) { b.style.transition = ''; b.style.translate = ''; b.style.willChange = ''; }
    d.layer.el.classList.remove('nav-dragging');
  }, 190);
}

// ---- swipe down: a sheet follows the finger and leaves ------------------------------------------

const NO_DRAG = 'input, textarea, select, [contenteditable], [data-no-sheet-drag], .no-swipe';
// what moves: a sheet moves whole; a partial sheet moves its panel and fades its own backdrop
const downPanel = (l) => (l.sheet ? l.el : l.el?.querySelector(':scope > .modal') || null);
let sd = null;

function sdStart(e) {
  if (sd || drag || e.touches.length !== 1) return;
  const top = topLayer();
  if (!top?.el || !top.swipeDown || !top.el.contains(e.target)) return;
  const panel = downPanel(top);
  if (!panel || e.target.closest?.(NO_DRAG)) return;
  // a list that isn't at its top keeps the finger: the sheet only follows from the top
  let scroller = null;
  for (let n = e.target; n && n !== top.el && n.nodeType === 1; n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(n).overflowY)) { scroller = n; break; }
  }
  const t = e.touches[0];
  sd = { layer: top, panel, scroller, x0: t.clientX, y0: t.clientY, dy: 0, state: null, samples: [{ x: t.clientY, t: e.timeStamp }] };
}

function sdMove(e) {
  if (!sd) return;
  const t = e.touches[0];
  if (!sd.state) {
    const c = classifyDown(t.clientX - sd.x0, t.clientY - sd.y0);
    if (!c) return;
    if (c === 'other' || (sd.scroller && sd.scroller.scrollTop > 0)) { sd = null; return; }
    sd.state = 'down';
    sd.y0 = t.clientY;   // start following from here: no jump by the slop
    sd.reduced = reduced();
    const r = sd.panel.getBoundingClientRect();
    sd.h = sd.layer.sheet ? Math.max(1, innerHeight - (sd.panel.querySelector(':scope > .fh-screen')?.getBoundingClientRect().top ?? 0)) : Math.max(1, r.height);
    sd.fade = sd.layer.sheet ? sd.layer.scrim : sd.layer.el.querySelector(':scope > .modal-backdrop');
    if (!sd.reduced) { sd.panel.style.transition = 'none'; sd.panel.style.willChange = 'translate'; sd.layer.el.classList.add('nav-dragging'); }
  }
  if (e.cancelable) e.preventDefault();   // ours now: the list doesn't scroll or bounce
  sd.dy = t.clientY - sd.y0;
  sd.samples.push({ x: t.clientY, t: e.timeStamp });
  if (sd.samples.length > 8) sd.samples.shift();
  if (sd.reduced) return;
  const off = sheetOffset(sd.dy);
  sd.panel.style.translate = `0 ${off}px`;
  if (sd.fade) sd.fade.style.opacity = String(1 - Math.min(1, Math.max(0, off / sd.h)) * 0.85);
}

function sdEnd(cancelled = false) {
  if (!sd) return;
  const d = sd;
  sd = null;
  if (d.state !== 'down') return;
  const done = !cancelled && sheetShouldClose(d.dy, d.h, velocity(d.samples));
  const idx = stack.indexOf(d.layer);
  if (d.reduced) { if (done && idx >= 0) closeLayer(idx, { animate: false }); return; }
  d.layer.el.classList.remove('nav-dragging');
  d.panel.style.willChange = '';
  if (done && idx >= 0) {
    if (d.layer.sheet) { closeLayer(idx); return; }   // removeTop carries it on down from here
    // a partial sheet: its panel drops away, then the layer goes
    d.panel.animate([{ translate: `0 ${d.h + 40}px` }], { duration: 200, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' });
    d.fade?.animate([{ opacity: 0 }], { duration: 200, fill: 'forwards' });
    setTimeout(() => { const i = stack.indexOf(d.layer); if (i >= 0) closeLayer(i, { animate: false }); }, 200);
    return;
  }
  // not far enough: it springs back up
  const from = d.panel.style.translate || '0 0';
  d.panel.style.translate = ''; d.panel.style.transition = '';
  d.panel.animate([{ translate: from }, { translate: '0 0' }], { duration: 320, easing: 'cubic-bezier(.3, 1.35, .5, 1)' });
  if (d.fade) { const o = d.fade.style.opacity || '1'; d.fade.style.opacity = ''; d.fade.animate([{ opacity: o }, { opacity: 1 }], { duration: 240 }); }
}

document.addEventListener('touchstart', sdStart, { passive: true, capture: true });
document.addEventListener('touchmove', sdMove, { passive: false, capture: true });
document.addEventListener('touchend', () => sdEnd(false), { passive: true, capture: true });
document.addEventListener('touchcancel', () => sdEnd(true), { passive: true, capture: true });

document.addEventListener('touchstart', onStart, { passive: true, capture: true });
document.addEventListener('touchmove', onMove, { passive: false, capture: true });
document.addEventListener('touchend', onEnd, { passive: true, capture: true });
document.addEventListener('touchcancel', onCancel, { passive: true, capture: true });

