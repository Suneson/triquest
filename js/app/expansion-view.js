// expansion-view.js — the Expand window (docs/ROOMS3D.md): every room, and taking it from its
// painted 8 × 8 room to 16 × 16 and then 32 × 32, which fills its floor's whole roof. Only the
// locker room has its big picture so far; the others say "coming soon".

import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { EXPANSION_RULES, expansionReady, expandedSize, nextExpansion, EXPANDED_ART } from '../core/expansions.js';
import { roomArt } from '../core/placement.js';
import { myExpansions, expansionsOpen, buyExpansion, walletNow, gearError } from './gear-state.js';
import { openLayer, closeLayer } from './nav.js';
import { haptic } from './haptics.js';
import { toast } from './effects.js';
import { setActiveRoom, tapePreview, setTapePreview } from './diorama-view.js';
import { isChestAdmin } from './chests-state.js';
import { isDemo } from './demo.js';

const COIN = 'icons/Pixelart/GEAR/coin.png';

export function openExpansions(workouts = []) {
  const root = openLayer('expansions', { className: 'mk-layer', reuse: false });
  const draw = () => {
    const coins = walletNow(workouts).coins;
    const rows = EXPANSION_RULES.rooms.map((room) => {
      const size = expandedSize(myExpansions(), room);
      const step = nextExpansion(myExpansions(), room);
      const done = size === 32;
      const ready = expansionReady(room);
      const pic = ready ? EXPANDED_ART[room] : roomArt(room, 1);
      const action = done
        ? `<span class="xp-owned">${svg('check')}${esc(t('cp.expand.owned'))}</span>`
        : step
          ? `<button class="mk-up xp-buy" data-xp-buy="${room}" data-xp-size="${step.size}" ${!expansionsOpen() ? 'disabled' : ''}><b>${esc(t('cp.expand.buy'))}</b>
               <span class="data-num${coins < step.cost ? ' is-short' : ''}">${fmtNum(step.cost)}<img src="${COIN}" alt=""></span></button>`
          : `<span class="xp-soon">${esc(t('cp.expand.soon'))}</span>`;
      return `<li class="xp-row${ready ? '' : ' is-soon'}${done ? ' is-done' : ''}">
        <figure class="xp-pic"><img src="${pic}" alt="" draggable="false"></figure>
        <div class="xp-txt"><b>${esc(t(`cp.room.${room}`))}</b><small>${esc(done ? t('cp.expand.sizeDone') : t('cp.expand.size', { from: size, to: step ? step.size : size * 2 }))}</small></div>
        ${action}
      </li>`;
    }).join('');
    root.innerHTML = `<div class="modal-backdrop" data-layer-close></div>
      <div class="mk-info xp" role="dialog" aria-modal="true" aria-labelledby="xp-h">
        <header class="mk-info-head">
          <h2 id="xp-h">${esc(t('cp.expand.title'))}</h2>
          <button class="mk-x" data-layer-close aria-label="${esc(t('city.market.close'))}">×</button>
        </header>
        <div class="mk-info-body">
          <p class="mk-note">${esc(t('cp.expand.about'))}</p>
          <ul class="xp-list">${rows}</ul>
          ${isChestAdmin() || isDemo() ? `<button class="btn tiny ghost xp-tape" data-xp-tape aria-pressed="${tapePreview()}">${esc(t(tapePreview() ? 'cp.expand.tapeOff' : 'cp.expand.tapeOn'))}</button>` : ''}
        </div>
      </div>`;
    root.querySelectorAll('[data-xp-buy]').forEach((b) => b.addEventListener('click', () => buy(b.dataset.xpBuy, Number(b.dataset.xpSize), b)));
    root.querySelector('[data-xp-tape]')?.addEventListener('click', () => {
      setTapePreview(!tapePreview());
      closeLayer(root);
      setActiveRoom('locker');
      document.dispatchEvent(new CustomEvent('dg-room', { bubbles: true }));
    });
  };
  const buy = async (room, size, btn) => {
    btn.disabled = true;
    try {
      await buyExpansion(room, size);
      haptic('record');
      toast(esc(t('cp.expand.done', { room: t(`cp.room.${room}`), size })), { icon: svg('check') });
      closeLayer(root);
      // straight to the room, bigger now
      setActiveRoom(room);
      document.dispatchEvent(new CustomEvent('dg-room', { bubbles: true }));
    } catch (e) {
      toast(esc(gearError(e)));
      draw();
    }
  };
  draw();
  return root;
}
