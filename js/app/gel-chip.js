// gel-chip.js — the running fuel (a gel, an energy bar or a pasta meal) as a
// small countdown: a pixel gel that drains and the time left. Shown in the
// Profile HUD, on Home, in the shop and in the inventory.
// The end time comes from the server (user_boosts.expires_at, cached by
// gear-state.js), so the countdown survives a reload.

import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { GEAR_RULES } from '../core/gear.js';
import { activeFuel } from '../core/boosts.js';
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
  const bp = Math.round((Number(g.multiplier) - 1) * 10000) || GEAR_RULES.fuel.items[g.kind]?.boostBp || 0;
  const start = Date.parse(g.started_at);
  const end = Date.parse(g.expires_at);
  const left = end - Date.now();
  const frac = Math.max(0, Math.min(1, left / (end - start)));
  return `<span class="gel-chip ${cls}" data-gel-end="${end}" data-gel-start="${start}" style="--left:${frac.toFixed(3)}"
      role="timer" aria-label="${esc(t('gear.fuelActiveAria', { name: t(`gear.fuel.${g.kind}.name`), time: clock(left), pct: bp / 100 }))}">
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

