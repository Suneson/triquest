// motion.js — the "feel" layer: tab slides, numbers that roll in steps, meters
// that fill one segment at a time, busy buttons. Everything here is progressive:
// with reduced motion (OS or in-app setting) or without the browser feature,
// the end state appears at once and nothing else changes.

import { prefersReducedMotion } from './effects.js';
import { fmtNum } from '../core/i18n.js';

const reduced = () => prefersReducedMotion() || document.body.classList.contains('rm');

// ---- B1: tab changes slide like a carousel ---------------------------------------
// The old view (a still copy of it) slides out one side while the new one slides
// in from the other, the way the tab bar moved. A finger swipe (tab-swipe.js)
// hands over where it let go (`fromDx`), so the slide carries on from the finger.

// The tab bar, left to right. The calendar ('journal') isn't on the bar: it opens
// from the Journal tab ('home'), so it sits at that position as a level deeper.
export const TAB_ORDER = ['home', 'shop', 'progress', 'chat', 'leaderboards'];
const pos = (t) => (t === 'journal' ? TAB_ORDER.indexOf('home') + 0.5 : TAB_ORDER.indexOf(t));

/** 'fwd' (moving right along the bar) or 'back'. */
export function tabDirection(from, to) {
  return pos(to) < pos(from) ? 'back' : 'fwd';
}

const SLIDE_MS = 260;
const EASE = 'cubic-bezier(.2, .8, .2, 1)';

export function withTabTransition(from, to, update, { fromDx = 0 } = {}) {
  const view = document.getElementById('view');
  if (!view || reduced() || from === to) { update(); view?.style.removeProperty('transform'); return; }
  const dir = tabDirection(from, to) === 'fwd' ? 1 : -1;
  const w = view.clientWidth;
  // a still copy of the old view, laid exactly over it, keeping its look and scroll
  const r = view.getBoundingClientRect();
  const cs = getComputedStyle(view);
  const ghost = view.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.classList.add('view-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  Object.assign(ghost.style, {
    position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
    padding: cs.padding, backgroundColor: cs.backgroundColor, overflow: 'hidden', zIndex: '2', margin: '0',
    transform: `translateX(${fromDx}px)`,
  });
  const top = view.scrollTop;
  document.querySelector('.app')?.append(ghost);
  ghost.scrollTop = top;
  update();
  // the new view starts beside the old one and both move together
  view.classList.add('is-sliding');
  view.style.transition = 'none';
  view.style.transform = `translateX(${dir * w + fromDx}px)`;
  void view.offsetWidth;
  const ms = Math.max(140, SLIDE_MS * (1 - Math.min(0.6, Math.abs(fromDx) / w)));
  view.style.transition = ghost.style.transition = `transform ${ms}ms ${EASE}`;
  view.style.transform = 'translateX(0)';
  ghost.style.transform = `translateX(${-dir * w}px)`;
  let done = false;
  const end = () => {
    if (done) return; done = true;
    ghost.remove();
    view.classList.remove('is-sliding');
    view.style.removeProperty('transition'); view.style.removeProperty('transform');
  };
  view.addEventListener('transitionend', end, { once: true });
  setTimeout(end, ms + 120);
}

// ---- B2: numbers roll, meters fill ------------------------------------------------
// Values are remembered per key for the session, so a number only rolls when it
// actually changed since it was last on screen (not on every re-render).

const _last = new Map();
const STEPS = 6;
const STEP_MS = 60;

/** A number that rolls when it changes. `key` names it across renders. */
export function rollNum(value, key, { dp = 0 } = {}) {
  const v = Number(value) || 0;
  return `<span class="roll" data-roll="${v}" data-roll-key="${key}" data-roll-dp="${dp}">${fmt(v, dp)}</span>`;
}

const fmt = (v, dp) => fmtNum(dp ? v : Math.round(v), { minimumFractionDigits: dp, maximumFractionDigits: dp });

function rollOne(el) {
  const key = el.dataset.rollKey;
  const to = Number(el.dataset.roll);
  const dp = Number(el.dataset.rollDp) || 0;
  const from = _last.get(key);
  _last.set(key, to);
  if (from === undefined || from === to || reduced()) return;
  let i = 0;
  el.classList.add('rolling');
  const tick = () => {
    if (!el.isConnected) return;
    i++;
    el.textContent = fmt(from + ((to - from) * i) / STEPS, dp);
    if (i < STEPS) setTimeout(tick, STEP_MS);
    else el.classList.remove('rolling');
  };
  el.textContent = fmt(from, dp);
  setTimeout(tick, STEP_MS);
}

/** Segments that are newly lit since this meter was last seen light up one at a
 *  time; ones that were already lit stay put. First sight fills from empty. */
function fillMeter(m) {
  const key = m.dataset.meterKey;
  const cells = [...m.children];
  const on = cells.filter((c) => c.classList.contains('on')).length;
  const prev = _last.has(`m:${key}`) ? _last.get(`m:${key}`) : 0;
  _last.set(`m:${key}`, on);
  if (reduced() || on <= prev) return;
  for (let i = prev; i < on; i++) {
    cells[i].classList.add('seg-new');
    cells[i].style.animationDelay = `${(i - prev) * 50}ms`;
  }
}

/** Run after every render that may contain rolling numbers or meters. */
export function animateIn(root = document) {
  root.querySelectorAll('[data-roll-key]').forEach(rollOne);
  root.querySelectorAll('.meter[data-meter-key]').forEach(fillMeter);
}

// ---- B4: busy buttons --------------------------------------------------------------

/** Mark a button busy while `work` runs: disabled, aria-busy, stepped dots. */
export async function busy(btn, work) {
  if (!btn || btn.getAttribute('aria-busy') === 'true') return work();
  btn.setAttribute('aria-busy', 'true');
  const wasDisabled = btn.disabled;
  btn.disabled = true;
  try { return await work(); } finally {
    if (btn.isConnected) {
      btn.removeAttribute('aria-busy');
      btn.disabled = wasDisabled;
    }
  }
}
