// motion.js — the "feel" layer: tab wipes, numbers that roll in steps, meters
// that fill one segment at a time, busy buttons. Everything here is progressive:
// with reduced motion (OS or in-app setting) or without the browser feature,
// the end state appears at once and nothing else changes.

import { prefersReducedMotion } from './effects.js';

const reduced = () => prefersReducedMotion() || document.body.classList.contains('rm');

// ---- B1: tab changes as a 4-step pixel wipe ------------------------------------
// The View Transitions API snapshots the old view, runs `update`, and animates
// the swap. CSS (::view-transition-*(view)) draws the wipe; this only picks the
// direction so the wipe travels the way the tab bar moved.

const TAB_ORDER = ['home', 'journal', 'leaderboards', 'shop', 'progress'];

export function withTabTransition(from, to, update) {
  if (!document.startViewTransition || reduced() || from === to) { update(); return; }
  const dir = TAB_ORDER.indexOf(to) < TAB_ORDER.indexOf(from) ? 'back' : 'fwd';
  document.documentElement.dataset.vtDir = dir;
  const t = document.startViewTransition(update);
  t.finished.finally(() => { delete document.documentElement.dataset.vtDir; });
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

const fmt = (v, dp) => (dp ? v.toFixed(dp) : Math.round(v).toLocaleString());

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
