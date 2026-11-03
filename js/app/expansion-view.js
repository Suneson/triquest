// expansion-view.js — the Expand window (docs/ROOMS3D.md): every room, and taking it from its
// painted 8 × 8 room to the 16 × 16 one that fills its floor's whole roof. Only the locker room
// has its 16 × 16 model so far; the others say "coming soon".

import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { EXPANSION_RULES, expansionReady, isExpanded, EXPANDED_ART } from '../core/expansions.js';
import { roomArt } from '../core/placement.js';
import { myExpansions, expansionsOpen, buyExpansion, walletNow, gearError } from './gear-state.js';
import { openLayer, closeLayer } from './nav.js';
import { haptic } from './haptics.js';
import { toast } from './effects.js';
import { setActiveRoom } from './diorama-view.js';

const COIN = 'icons/Pixelart/GEAR/coin.png';

export function openExpansions(workouts = []) {
  const root = openLayer('expansions', { className: 'mk-layer', reuse: false });
  const draw = () => {
    const coins = walletNow(workouts).coins;
    const rows = EXPANSION_RULES.rooms.map((room) => {
      const done = isExpanded(myExpansions(), room);
      const ready = expansionReady(room);
      const pic = ready ? EXPANDED_ART[room] : roomArt(room, 1);
      const action = done
        ? `<span class="xp-owned">${svg('check')}${esc(t('cp.expand.owned'))}</span>`
        : ready
          ? `<button class="mk-up xp-buy" data-xp-buy="${room}" ${!expansionsOpen() ? 'disabled' : ''}><b>${esc(t('cp.expand.buy'))}</b>
               <span class="data-num${coins < EXPANSION_RULES.cost ? ' is-short' : ''}">${fmtNum(EXPANSION_RULES.cost)}<img src="${COIN}" alt=""></span></button>`
          : `<span class="xp-soon">${esc(t('cp.expand.soon'))}</span>`;
      return `<li class="xp-row${ready ? '' : ' is-soon'}${done ? ' is-done' : ''}">
        <figure class="xp-pic"><img src="${pic}" alt="" draggable="false"></figure>
        <div class="xp-txt"><b>${esc(t(`cp.room.${room}`))}</b><small>${esc(t(done ? 'cp.expand.sizeDone' : 'cp.expand.size'))}</small></div>
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
        </div>
      </div>`;
    root.querySelectorAll('[data-xp-buy]').forEach((b) => b.addEventListener('click', () => buy(b.dataset.xpBuy, b)));
  };
  const buy = async (room, btn) => {
    btn.disabled = true;
    try {
      await buyExpansion(room);
      haptic('record');
      toast(esc(t('cp.expand.done', { room: t(`cp.room.${room}`) })), { icon: svg('check') });
      closeLayer(root);
      // straight to the room, now 16 × 16
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
