// delivery-view.js — the deliveries on their way (docs/CITY.md, "In the app").
//
// Everything bought in the shop is a workshop job with a finish time; until then it's a
// delivery. The street sign by the garage door counts down to the next one (city3d.js) and
// the MOSKE truck brings it as the countdown runs out. Tapping the sign opens this list: one
// beige card per delivery (the Journal's cards), soonest first, each counting down.

import { esc } from './ui.js';
import { t, fmtTime } from '../core/i18n.js';
import { deliveriesComing } from '../core/deliveries.js';
import { gearById } from '../core/gear.js';
import { propById, rareById } from '../core/scenes.js';
import { gearState, serverNow, refreshGear } from './gear-state.js';
import { clockLeft } from './gear-view.js';
import { openLayer, closeLayer } from './nav.js';
import { sheetHead } from './sheet.js';

const itemName = (id) => gearById(id)?.name || propById(id)?.name || rareById(id)?.name || id;

export function openDeliveries() {
  const root = openLayer('deliveries');
  const draw = () => {
    const now = serverNow();
    const list = deliveriesComing(gearState().jobs, now);
    const rows = list.map((j) => {
      const end = Date.parse(j.finishes_at);
      return `<li class="jh-card dl-row">
        <div class="jh-top"><span class="jh-tag">${esc(t('city.delivery.tag'))}</span>
          <span class="jh-state"><b class="data-num" data-dl-left="${end}">${clockLeft(end - now)}</b></span></div>
        <h3 class="jh-title">${esc(itemName(j.item_id))}</h3>
        <p class="jh-sub">${esc(t('city.delivery.arrives', { time: fmtTime(j.finishes_at) }))}</p>
      </li>`;
    }).join('');
    root.innerHTML = `<div class="modal-backdrop" data-dl-close></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="dl-h">
        ${sheetHead({ icon: 'clock', title: t('city.delivery.title'), id: 'dl-h', closeAttr: 'data-dl-close' })}
        <div class="modal-body">${list.length ? `<ul class="dl-list">${rows}</ul>` : `<p class="gw-note">${esc(t('city.delivery.none'))}</p>`}</div>
      </div>`;
    root.querySelectorAll('[data-dl-close]').forEach((b) => b.addEventListener('click', () => closeLayer(root)));
  };
  draw();
  const tick = setInterval(() => {
    if (!root.isConnected) { clearInterval(tick); return; }
    const now = serverNow();
    let arrived = false;
    root.querySelectorAll('[data-dl-left]').forEach((el) => {
      const left = Number(el.dataset.dlLeft) - now;
      if (left <= 0) arrived = true;
      el.textContent = clockLeft(left);
    });
    if (arrived) refreshGear().then(() => { if (root.isConnected) draw(); });
  }, 1000);
  return root;
}
