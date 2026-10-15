// pull.js — pull to refresh on a scroller (Home, Ranks, Chat). Pull down from
// the top: a pixel sprite drops in under the header and winds up a notch at a
// time; past the line, letting go refreshes and the sprite spins until it's
// done. Reduced motion: the sprite appears and disappears, it doesn't wind.
//
// Only a pull that starts at scrollTop 0 and moves down counts; anything else
// is left to the browser (normal scrolling, the overscroll bounce).

import { svg } from '../core/icons.js';
import { pullState } from '../core/gesture.js';
import { t } from '../core/i18n.js';

/**
 * @param {HTMLElement} scroller  the element that scrolls (#view)
 * @param {{ when: () => boolean, onRefresh: () => Promise<any> }} opts
 */
export function enablePull(scroller, { when, onRefresh }) {
  const sprite = document.createElement('div');
  sprite.className = 'pull-sprite';
  sprite.setAttribute('aria-hidden', 'true');
  sprite.innerHTML = `<span class="pull-ico">${svg('sync')}</span><span class="pull-meter">${'<i></i>'.repeat(4)}</span>`;
  const status = document.createElement('span');
  status.className = 'sr'; status.setAttribute('role', 'status');
  document.body.append(sprite, status);

  let start = null;
  let st = null;
  let busy = false;

  const paint = (s) => {
    sprite.style.setProperty('--pull', `${Math.round(s.offset)}px`);
    sprite.style.setProperty('--wind', String(Math.round(s.frac * 8))); // eight 45° notches
    sprite.querySelectorAll('.pull-meter i').forEach((c, i) => c.classList.toggle('on', s.frac * 4 > i + 0.01));
    sprite.classList.toggle('is-ready', s.ready);
  };
  const reset = () => { sprite.classList.remove('is-pulling', 'is-ready', 'is-busy'); sprite.style.removeProperty('--pull'); };

  scroller.addEventListener('touchstart', (e) => {
    if (busy || e.touches.length !== 1 || scroller.scrollTop > 0 || !when()) { start = null; return; }
    start = { y: e.touches[0].clientY, x: e.touches[0].clientX, on: false };
  }, { passive: true });

  scroller.addEventListener('touchmove', (e) => {
    if (!start) return;
    const dy = e.touches[0].clientY - start.y;
    const dx = e.touches[0].clientX - start.x;
    if (!start.on) {
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
      if (dy <= 0 || Math.abs(dx) > dy || scroller.scrollTop > 0) { start = null; return; }
      start.on = true;
      sprite.style.top = `${scroller.getBoundingClientRect().top}px`; // just under the header / banners
      sprite.classList.add('is-pulling');
    }
    if (e.cancelable) e.preventDefault(); // ours: no rubber-band under the sprite
    st = pullState(dy);
    paint(st);
  }, { passive: false });

  const end = async () => {
    if (!start?.on) { start = null; return; }
    start = null;
    if (!st?.ready) { reset(); return; }
    busy = true;
    sprite.classList.add('is-busy');
    status.textContent = t('misc.refreshing');
    try { await onRefresh(); status.textContent = t('misc.upToDate'); } catch { status.textContent = t('misc.refreshFailed'); }
    busy = false;
    reset();
  };
  scroller.addEventListener('touchend', end, { passive: true });
  scroller.addEventListener('touchcancel', () => { start = null; reset(); }, { passive: true });
}
