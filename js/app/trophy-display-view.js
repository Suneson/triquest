// trophy-display-view.js — what stands in your trophy cabinet. A cabinet shows a few of the
// trophies you've won: 5 in tier 1, 10 in tier 2 (`slots`, js/core/placement.js). Visitors will
// see these when other people's bases can be opened; for now it's chosen and kept on your account
// (settings.trophyDisplay). Admins and the demo can pick any trophy, to try the shelf out.

import { openLayer } from './nav.js';
import { esc } from './ui.js';
import { t } from '../core/i18n.js';
import { FEATS, featById } from '../core/feats.js';
import { placeablesFor, displaySlots, toggleDisplay, isStashed } from '../core/placement.js';
import { STAGE_ROOMS } from '../core/diorama.js';
import { featAwards } from './feats-state.js';
import { gearState } from './gear-state.js';
import { savedPlacements, baseItemRows } from './placement-state.js';
import { isChestAdmin } from './chests-state.js';
import { isDemo } from './demo.js';
import { haptic } from './haptics.js';
import { toast } from './effects.js';
import * as store from './store.js';

const art = (id) => `icons/Pixelart/FEATS/${esc(id)}.png`;
const everything = () => isChestAdmin() || isDemo();

/** The trophies you can put on show. */
const choosable = () => {
  if (everything()) return FEATS;
  const won = new Set(featAwards().map((a) => a.featId));
  return FEATS.filter((f) => won.has(f.id));
};

/** The trophies on show, in the order you chose them (ones you can't show any more dropped). */
export const trophiesShown = () => {
  const can = new Set(choosable().map((f) => f.id));
  return (store.getSettings().trophyDisplay || []).filter((id) => can.has(id));
};

/** How many your cabinets hold: the best one standing in your base. */
const slotsNow = () => {
  const saved = savedPlacements();
  const items = placeablesFor([...gearState().inventory, ...baseItemRows()], STAGE_ROOMS);
  return displaySlots(items.filter((it) => !isStashed(it, saved)));
};

export function openTrophyDisplay() {
  const root = openLayer('trophy-display', { className: 'mk-layer', reuse: false });
  let top = 0;
  const draw = () => {
    const slots = slotsNow();
    const shown = trophiesShown().slice(0, slots);
    const list = choosable();
    const slot = (id) => (id
      ? `<button class="td-slot is-full" data-td="${esc(id)}" aria-label="${esc(t('cp.display.remove', { name: featById(id).name }))}"><img src="${art(id)}" alt="" draggable="false"></button>`
      : '<span class="td-slot" aria-hidden="true"></span>');
    root.innerHTML = `<div class="modal-backdrop" data-layer-close></div>
      <div class="mk-info td" role="dialog" aria-modal="true" aria-labelledby="td-h">
        <header class="mk-info-head">
          <h2 id="td-h">${esc(t('cp.display.title'))}</h2>
          <button class="mk-x" data-layer-close aria-label="${esc(t('city.market.close'))}">×</button>
        </header>
        <div class="mk-info-body">
          <p class="mk-note">${esc(t('cp.display.about', { n: slots }))}</p>
          <div class="td-shelf" aria-label="${esc(t('cp.display.shelfAria', { n: shown.length, slots }))}">
            ${Array.from({ length: slots }, (_, i) => slot(shown[i])).join('')}
          </div>
          <h3 class="td-h">${esc(t('cp.display.yours'))} <small class="data-num">${shown.length}/${slots}</small></h3>
          ${list.length ? `<div class="td-grid">${list.map((f) => {
            const on = shown.includes(f.id);
            return `<button class="td-pick${on ? ' is-on' : ''}" data-td="${esc(f.id)}" aria-pressed="${on}"><img src="${art(f.id)}" alt="" loading="lazy" draggable="false"><span>${esc(f.name)}</span></button>`;
          }).join('')}</div>` : `<p class="mk-note">${esc(t('cp.display.none'))}</p>`}
        </div>
      </div>`;
    root.querySelector('.mk-info-body').scrollTop = top;
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-td]');
    if (!b) return;
    const r = toggleDisplay(trophiesShown(), b.dataset.td, slotsNow());
    if (r.full) { haptic('refuse'); toast(esc(t('cp.display.full', { n: slotsNow() }))); return; }
    store.setSetting('trophyDisplay', r.list);
    haptic('tick');
    top = root.querySelector('.mk-info-body')?.scrollTop || 0;
    draw();
  });
  draw();
  return root;
}
