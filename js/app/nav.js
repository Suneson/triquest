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
// Motion (js/core/spring.js): a sheet rises in 300 ms on a hard ease-out and drops in 180 ms on an
// ease-in. Under the finger it is the finger: no easing at all. Let go, and a spring takes it from
// the speed the finger had, back up (a small bounce) or away (none). A sheet that is still rising
// or springing back can be caught: the drag starts from where it is.
//
// Edge swipe: a drag that starts in the left 24px of the top layer moves it
// with the finger and reveals the layer beneath (20% behind, under a scrim).
// Past 40% or a flick completes; otherwise it springs back. Reduced motion: no
// follow, the swipe still pops. Tabs are not layers: with nothing open the
// edge does nothing here.

import { prefersReducedMotion } from './effects.js';
import { EDGE, inEdge, classify, progress, velocity, shouldComplete, beneathOffset, scrimOpacity, classifyDown, sheetOffset, sheetShouldClose, releaseSpeed, SHEET_DIM } from '../core/gesture.js';
import { DUR, EASE_IN, EASE_OUT, SPRING } from '../core/spring.js';
import { springY, currentY } from './spring-run.js';

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
      // one timing for the sheet and its scrim: they are one thing arriving
      const rise = { duration: DUR.sheetIn, easing: EASE_OUT };
      const anims = [el.animate([{ translate: '0 100%' }, { translate: '0 0' }], rise), scrim.animate([{ opacity: 0 }, { opacity: 1 }], rise)];
      layer.rising = anims;
      anims[0].finished.then(() => { layer.rising = null; }, () => { layer.rising = null; });
      el.classList.add('is-entering');
      setTimeout(() => el.classList.remove('is-entering'), DUR.sheetIn + DUR.staggerMax + DUR.enter);
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
        const h = innerHeight;
        let ms = DUR.sheetOut;
        if (layer.flung) {
          // let go mid-drag: it leaves at the finger's speed, no easing laid over it
          const { y, v } = layer.flung;
          el.style.translate = '';
          ms = springY(el, { from: y, to: h, v0: v, spring: SPRING.sheetAway, cap: DUR.sheetOut, hold: true,
            linked: [{ el: scrim, frame: (at) => ({ opacity: String(dimAt(at, h)) }) }] }).duration;
          if (scrim) scrim.style.opacity = '0';
        } else {
          // closed by a tap: nothing pushed it, so it just drops, and quicker than it rose
          const out = { duration: ms, easing: EASE_IN, fill: 'forwards' };
          el.animate([{ translate: '0 100%' }], out);
          scrim?.animate([{ opacity: 0 }], out);
        }
        setTimeout(() => { el.remove(); scrim?.remove(); }, ms + 10);
      } else { el.remove(); scrim?.remove(); }
    } else if (animate && !reduced() && !layer.instant) {
      el.classList.add('is-leaving');
      el.inert = true;
      setTimeout(() => el.remove(), DUR.exit);
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

function onEnd(e) {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.state !== 'back') return;
  rested(d.samples, e?.timeStamp || 0);
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

// A finger that stopped before it lifted isn't a flick: the moment it lifts counts as a last
// reading at the same place, so the speed is what it was at the end, not what it had been.
function rested(samples, at) {
  const last = samples[samples.length - 1];
  if (last && at > last.t) samples.push({ x: last.x, t: at });
}

// finish the move: off to the right (pop) or back home (spring)
function settle(d, done) {
  const T = `translate 180ms ${EASE_OUT}, opacity 180ms ${EASE_OUT}`;
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
// how dark the scrim is with the sheet `y` px down a travel of `h`: one rule for the drag and the spring
const dimAt = (y, h) => 1 - Math.min(1, Math.max(0, y / h)) * SHEET_DIM;
let sd = null;

// Take hold of a sheet that is still moving (rising, or springing back): stop it where it is and
// say where that is, so the drag carries on from there.
function catchSheet(layer, panel) {
  let y = 0;
  if (layer.settling) { y = layer.settling.stop().x; layer.settling = null; }
  else if (layer.rising) { y = currentY(panel); for (const a of layer.rising) a.cancel(); layer.rising = null; }
  return y;
}

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
    sd.base = sd.reduced ? 0 : catchSheet(sd.layer, sd.panel);   // caught mid-flight: carry on from there
    if (!sd.reduced) { sd.panel.style.transition = 'none'; sd.panel.style.willChange = 'translate'; sd.layer.el.classList.add('nav-dragging'); }
  }
  if (e.cancelable) e.preventDefault();   // ours now: the list doesn't scroll or bounce
  sd.dy = t.clientY - sd.y0;
  sd.samples.push({ x: t.clientY, t: e.timeStamp });
  if (sd.samples.length > 8) sd.samples.shift();
  if (sd.reduced) return;
  // the sheet is the finger: written straight to the element, no easing, no spring
  sd.off = sheetOffset(sd.base + sd.dy);
  sd.panel.style.translate = `0 ${sd.off}px`;
  if (sd.fade) sd.fade.style.opacity = String(dimAt(sd.off, sd.h));
}

function sdEnd(cancelled = false, at = 0) {
  if (!sd) return;
  const d = sd;
  sd = null;
  if (d.state !== 'down') return;
  rested(d.samples, at);
  const raw = cancelled ? 0 : velocity(d.samples);
  const y = d.off ?? 0;
  const done = !cancelled && sheetShouldClose(y, d.h, raw);
  const idx = stack.indexOf(d.layer);
  if (d.reduced) { if (done && idx >= 0) closeLayer(idx, { animate: false }); return; }
  const v = releaseSpeed(raw);   // the finger's speed, handed to the spring
  d.layer.el.classList.remove('nav-dragging');
  d.panel.style.willChange = '';
  const fade = [{ el: d.fade, frame: (at) => ({ opacity: String(dimAt(at, d.h)) }) }];
  if (done && idx >= 0) {
    if (d.layer.sheet) { d.layer.flung = { y, v }; closeLayer(idx); return; }   // removeTop carries it on down from here
    // a partial sheet: its panel carries on down at the finger's speed, then the layer goes
    d.panel.style.translate = '';
    const away = springY(d.panel, { from: y, to: d.h + 40, v0: v, spring: SPRING.sheetAway, cap: DUR.sheetOut, hold: true, linked: fade });
    if (d.fade) d.fade.style.opacity = '0';
    setTimeout(() => { const i = stack.indexOf(d.layer); if (i >= 0) closeLayer(i, { animate: false }); }, away.duration);
    return;
  }
  // not far enough: a spring takes it back up from the speed it was let go at. It was thrown, so
  // it may bounce a little; and it can be caught again on the way (catchSheet).
  d.panel.style.translate = ''; d.panel.style.transition = '';
  if (d.fade) d.fade.style.opacity = '';
  const back = d.layer.settling = springY(d.panel, { from: y, to: 0, v0: v, spring: SPRING.sheetBack, linked: fade });
  back.done.then(() => { if (d.layer.settling === back) d.layer.settling = null; });
}

document.addEventListener('touchstart', sdStart, { passive: true, capture: true });
document.addEventListener('touchmove', sdMove, { passive: false, capture: true });
document.addEventListener('touchend', (e) => sdEnd(false, e.timeStamp), { passive: true, capture: true });
document.addEventListener('touchcancel', () => sdEnd(true), { passive: true, capture: true });

document.addEventListener('touchstart', onStart, { passive: true, capture: true });
document.addEventListener('touchmove', onMove, { passive: false, capture: true });
document.addEventListener('touchend', onEnd, { passive: true, capture: true });
document.addEventListener('touchcancel', onCancel, { passive: true, capture: true });

