// delivery-view.js — the deliveries on their way (docs/CITY.md, "In the app").
//
// Everything bought in the shop is a workshop job with a finish time; until then it's a
// delivery. The street sign by the garage door counts down to the next one (city2d.js) and
// the MOSKE truck brings it as the countdown runs out. Tapping the sign opens this list: one
// beige card per delivery (the Journal's cards), soonest first, each counting down.

import { esc } from './ui.js';
import { t, fmtTime } from '../core/i18n.js';
import { deliveriesComing, parcelsWaiting } from '../core/deliveries.js';
import { gearById } from '../core/gear.js';
import { propById, rareById } from '../core/scenes.js';
import { gearState, serverNow, refreshGear, openedParcels, markParcelOpened, jobKey } from './gear-state.js';
import { prefersReducedMotion } from './effects.js';
import { haptic } from './haptics.js';
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

// ---- the parcel at the garage door ------------------------------------------------------------
//
// When the truck has brought a delivery, its parcel waits at the garage door with a bubble over
// it (diorama-view.js). Tapping it opens this: the parcel bobs on a burst of light; two taps
// shake it, the third bursts it open and what was in it rises out with its name.

const PARCEL = { shut: 'icons/City/parcel/parcel-shut.webp', open: 'icons/City/parcel/parcel-open.webp' };
const PARCEL_TAPS = 3;
/** The product's own picture, if it has one (gear has; props and rare items fall back to none). */
const itemArt = (id) => gearById(id)?.art || propById(id)?.art || rareById(id)?.art || '';

/** The parcels waiting at the door, soonest first. */
export const parcels = () => parcelsWaiting(gearState().jobs, serverNow(), openedParcels(), jobKey);

let opening = false;
/** Is a parcel's opening on screen? (The truck waits until it's closed.) */
export const parcelOpen = () => opening;

export function openParcel(list = parcels(), onDone = null) {
  const job = list[0];
  if (!job) return null;
  const calm = prefersReducedMotion();
  let taps = 0;
  opening = true;
  const root = openLayer('parcel', { className: 'cx-layer', instant: true, reuse: false, onClose: () => { opening = false; onDone?.(); } });
  const art = itemArt(job.item_id);
  root.innerHTML = `<div class="cx pc${calm ? ' is-calm' : ''}" role="dialog" aria-modal="true" aria-labelledby="pc-title" style="--tc:#7FB8F5">
    <div class="cx-bg" aria-hidden="true"><i class="cx-rays"></i><i class="cx-flash"></i></div>
    <header class="cx-head"><p class="cx-from">${esc(t('city.parcel.from'))}</p>
      <h2 id="pc-title" class="cx-tier"><span>${esc(t('city.parcel.title'))}</span></h2></header>
    <div class="cx-box pc-box">
      <div class="cx-squash"><div class="cx-wiggle">
        <img class="pc-shut" src="${PARCEL.shut}" width="512" height="512" alt="${esc(t('city.parcel.title'))}" draggable="false">
        <img class="pc-open" src="${PARCEL.open}" width="512" height="512" alt="" draggable="false">
      </div></div>
      <div class="pc-item">${art ? `<img src="${art}" alt="" draggable="false">` : ''}</div>
    </div>
    <div class="pc-name" aria-live="polite"></div>
    <p class="cx-hint"><span>${t('city.parcel.hint')}</span><i class="cx-pips" aria-hidden="true">${'<b></b>'.repeat(PARCEL_TAPS)}</i></p>
    <footer class="cx-foot"><button class="sc-buy cx-collect" data-pc-collect hidden>${list.length > 1 ? t('city.parcel.next', { n: list.length - 1 }) : t('city.parcel.collect')}</button></footer>
  </div>`;
  const stage = root.querySelector('.cx');
  const squash = root.querySelector('.cx-squash');
  const wiggle = root.querySelector('.cx-wiggle');
  const pips = root.querySelector('.cx-pips');
  const hint = root.querySelector('.cx-hint span');
  const name = root.querySelector('.pc-name');
  const collect = root.querySelector('[data-pc-collect]');
  const burst = () => {
    stage.classList.add('is-ready', 'pc-burst');
    pips.hidden = true; hint.textContent = '';
    squash.style.removeProperty('--sq');
    name.innerHTML = `<small>${esc(t('city.parcel.inside'))}</small><b>${esc(itemName(job.item_id))}</b>`;
    markParcelOpened(job);
    haptic('record');
    setTimeout(() => { collect.hidden = false; collect.focus({ preventScroll: true }); }, calm ? 0 : 700);
  };
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-pc-collect]')) {
      closeLayer(root);
      const rest = parcels();
      if (rest.length) setTimeout(() => openParcel(rest, onDone), 140);
      return;
    }
    if (taps >= PARCEL_TAPS) return;
    taps += 1;
    pips.children[taps - 1]?.classList.add('on');
    if (taps >= PARCEL_TAPS) { burst(); return; }
    squash.style.setProperty('--sq', String(1 - taps * 0.07));
    wiggle.classList.remove('is-hit'); void wiggle.offsetWidth; wiggle.classList.add('is-hit');
    haptic('tick');
  });
  return root;
}
