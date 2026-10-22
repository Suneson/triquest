// gel-chip.js — the fuel you have on, as a small chip: food (an energy bar,
// a pasta meal) as a countdown, a pixel gel that drains and the time left; a
// gel as "Next workout", full, until a session uses it. Shown in the Profile
// HUD, on Home, in the shop and in the inventory.
// The end time comes from the server (user_boosts.expires_at, cached by
// gear-state.js), so the countdown survives a reload.

import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { activeFuel, isWaiting, fuelBp } from '../core/boosts.js';
import { gearState } from './gear-state.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** A boost in basis points as "+4%". */
export const pctBp = (bp) => `+${fmtNum(bp / 100, { maximumFractionDigits: 2 })}%`;

const clock = (ms) => {
  const m = Math.max(0, Math.ceil(ms / 60000));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

/** The running fuel: a pixel gel that drains, and the time left. '' when none. */
export function gelChip(boosts = gearState().boosts, { cls = '' } = {}) {
  const g = activeFuel(boosts, Date.now());
  if (!g) return '';
  const bp = fuelBp(g);
  const name = t(`gear.fuel.${g.kind}.name`);
  if (isWaiting(g)) {
    return `<span class="gel-chip is-next ${cls}" role="status" aria-label="${esc(t('gear.fuelWaitingAria', { name, pct: bp / 100 }))}" style="--left:1">
      <span class="gel-tank" aria-hidden="true">${svg('gel')}<i class="gel-fill"></i></span>
      <b>${t('gear.nextWorkout')}</b><small>${pctBp(bp)}</small></span>`;
  }
  const start = Date.parse(g.started_at);
  const end = Date.parse(g.expires_at);
  const left = end - Date.now();
  const frac = Math.max(0, Math.min(1, left / (end - start)));
  return `<span class="gel-chip ${cls}" data-gel-end="${end}" data-gel-start="${start}" style="--left:${frac.toFixed(3)}"
      role="timer" aria-label="${esc(t('gear.fuelActiveAria', { name, time: clock(left), pct: bp / 100 }))}">
      <span class="gel-tank" aria-hidden="true">${svg('gel')}<i class="gel-fill"></i></span>
      <b class="data-num" data-gel-left>${clock(left)}</b><small>${pctBp(bp)}</small></span>`;
}

let ticker = null;
/** Keep every gel chip on screen counting down; `onEnd` runs once when one runs out. */
export function startGelTicker(onEnd) {
  if (ticker) return;
  ticker = setInterval(() => {
    const now = Date.now();
    let ended = false;
    document.querySelectorAll('[data-gel-end]').forEach((el) => {
      const end = Number(el.dataset.gelEnd);
      const start = Number(el.dataset.gelStart);
      if (now >= end) { ended = true; el.remove(); return; }
      el.style.setProperty('--left', ((end - now) / (end - start)).toFixed(3));
      const b = el.querySelector('[data-gel-left]');
      if (b) b.textContent = clock(end - now);
    });
    if (ended) onEnd?.();
  }, 15000);
}

