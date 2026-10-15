// stamp.js — a personal record is stamped, once.
//
// The plaque drops onto the screen, squashes for two frames as it lands,
// throws a puff of pixel dust, holds, then shrinks into the set that earned
// it. Each record stamps once: the key is remembered, so a re-render, a
// re-open or ticking the set off and on again never stamps it twice.
// Reduced motion: no stamp (the caller's toast says it instead).

import { esc } from './ui.js';
import { svg } from '../core/icons.js';

const KEY = 'moske-stamped';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const write = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(-200))); } catch { /* private mode */ } };

/** Has this record been stamped already? Marks it as stamped either way. */
export function firstStamp(key) {
  const seen = read();
  if (seen.includes(key)) return false;
  write([...seen, key]);
  return true;
}

const reduced = () => document.body.classList.contains('rm') || matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Stamp a record plaque. `target` is the element it settles into (the set's
 * PR tick). Returns false when it didn't animate (reduced motion, no API).
 */
export function stampRecord({ name, prs, target }) {
  if (reduced() || !document.body.animate) return false;
  const wrap = document.createElement('div');
  wrap.className = 'stamp-wrap';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = `<div class="stamp-plaque">
      <span class="stamp-k">${svg('trophy')} New record</span>
      <b>${esc(name)}</b>
      <small>${prs.map((p) => esc(p.label)).join(' · ')}</small>
    </div>${'<i class="stamp-dust"></i>'.repeat(6)}`;
  document.body.appendChild(wrap);
  const plaque = wrap.querySelector('.stamp-plaque');

  // drop → squash (two frames) → stand
  const land = plaque.animate([
    { transform: 'translateY(-60px) scale(1.4)', opacity: 0 },
    { transform: 'translateY(0) scale(1.12, .8)', opacity: 1, offset: 0.55 },
    { transform: 'translateY(0) scale(.96, 1.05)', opacity: 1, offset: 0.8 },
    { transform: 'translateY(0) scale(1)', opacity: 1 },
  ], { duration: 360, easing: 'steps(4, end)', fill: 'forwards' });

  land.finished.then(() => {
    // the dust puffs out from where it hit
    wrap.querySelectorAll('.stamp-dust').forEach((d, i) => {
      const side = i % 2 ? 1 : -1;
      const dx = side * (24 + (i >> 1) * 22);
      const dy = -6 - (i >> 1) * 8;
      d.animate([
        { transform: 'translate(0, 0)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
      ], { duration: 420, easing: 'steps(5, end)', fill: 'forwards' });
    });
  });

  // hold, then settle into the set that earned it
  setTimeout(() => {
    const from = plaque.getBoundingClientRect();
    const to = target?.isConnected ? target.getBoundingClientRect() : null;
    const dx = to ? to.left + to.width / 2 - (from.left + from.width / 2) : 0;
    const dy = to ? to.top + to.height / 2 - (from.top + from.height / 2) : 60;
    plaque.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(.12)`, opacity: 0.2 },
    ], { duration: 360, easing: 'steps(6, end)', fill: 'forwards' }).finished.finally(() => wrap.remove());
  }, 1300);
  return true;
}
