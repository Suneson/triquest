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
// Edge swipe: a drag that starts in the left 24px of the top layer moves it
// with the finger and reveals the layer beneath (20% behind, under a scrim).
// Past 40% or a flick completes; otherwise it springs back. Reduced motion: no
// follow, the swipe still pops. Tabs are not layers: with nothing open the
// edge does nothing here.

import { prefersReducedMotion } from './effects.js';
import { EDGE, inEdge, classify, progress, velocity, shouldComplete, beneathOffset, scrimOpacity } from '../core/gesture.js';

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
export function openLayer(name, { onClose = null, swipeBack = true, className = '', reuse = true } = {}) {
  const top = topLayer();
  if (reuse && top?.el && top.name === name) {
    if (onClose) top.onClose = onClose;
    return top.el;
  }
  return openOver(name, { onClose, swipeBack, className });
}

function openOver(name, { onClose, swipeBack, className }) {
  const top = topLayer();
  const el = document.createElement('div');
  el.className = `modal-root layer open ${className}`.trim();
  el.dataset.layer = name;
  el.style.zIndex = String(10000 + stack.length * 2);
  const beneath = top?.el || appEl();
  const layer = {
    id: ++seq, name, el, onClose, swipeBack,
    trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    beneath, beneathInert: beneath ? beneath.inert : false,
  };
  if (beneath) { beneath.inert = true; beneath.setAttribute('aria-hidden', 'true'); }
  stack.push(layer);
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
  return el;
}

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
    if (animate && !reduced()) {
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

// finish the move in four steps: off to the right (pop) or back home (spring)
function settle(d, done) {
  const T = 'translate 160ms steps(4, end), opacity 160ms steps(4, end)';
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

document.addEventListener('touchstart', onStart, { passive: true, capture: true });
document.addEventListener('touchmove', onMove, { passive: false, capture: true });
document.addEventListener('touchend', onEnd, { passive: true, capture: true });
document.addEventListener('touchcancel', onCancel, { passive: true, capture: true });

