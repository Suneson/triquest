// shop-ui.js — the redesigned shop's pieces (docs/SHOP.md): the square item
// card that sits two to a row, its chunky price button, the (i) sheet that
// holds everything a card leaves out, and the currency bar pinned to the
// bottom. The card says only four things: the name, the picture on its lit
// well, how many you hold of how many, and the price. States come from
// js/core/shop-cards.js.

import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { cardPlate, storageText } from '../core/shop-cards.js';
import { openLayer, closeLayer } from './nav.js';
import { sheetHead } from './sheet.js';

export const CUR_ART = { coins: 'icons/Pixelart/GEAR/coin.png', carbs: 'icons/Pixelart/GEAR/carbs.png' };
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/** "120 g" / "850": a price as the button prints it. */
export const priceText = (n, cur) => `${fmtNum(n)}${cur === 'carbs' ? ' g' : ''}`;

/**
 * The card's button, by its state: a gold price to tap; a red price you can't
 * reach yet (and what's missing); MAX CAPACITY when storage is full; or a
 * quiet line when it's owned or building.
 */
export function cardButton(item, cur, st, { buyAttr = 'data-gear-buy', label = '', owned = '' } = {}) {
  const coin = `<img class="sc-cur" src="${CUR_ART[cur]}" width="64" height="64" alt="">`;
  if (st.state === 'max') return `<button class="sc-buy is-max" disabled>${t('shop.max')}</button>`;
  if (st.state === 'owned') return `<span class="sc-buy is-done">${svg('check')} ${owned || t('shop.owned')}</span>`;
  if (st.state === 'building') {
    // in the workshop: a live countdown while it's fitted, else when it starts
    return st.end
      ? `<span class="sc-buy is-done is-ws">${svg('wrench')} <span data-ws-left="${st.end}" class="data-num">${st.left || ''}</span></span>`
      : `<span class="sc-buy is-done is-ws">${svg('clock')} ${st.queued || t('shop.building')}</span>`;
  }
  if (st.state === 'short') {
    const need = t(cur === 'carbs' ? 'shop.needCarbs' : 'shop.needCoins', { n: fmtNum(st.short) });
    return `<button class="sc-buy is-short" disabled aria-label="${esc(`${label} · ${need}`)}"><span class="sc-price">${priceText(item.cost, cur)}</span>${coin}</button>
      <small class="sc-need" aria-hidden="true">${need}</small>`;
  }
  return `<button class="sc-buy" ${buyAttr}="${item.id}"${online() ? '' : ' disabled'} aria-label="${esc(label)}"><span class="sc-price">${priceText(item.cost, cur)}</span>${coin}</button>`;
}

/**
 * A card button that isn't a price: Wear, Build, Aim (mint), or locked (grey).
 * `attrs` carries the data attribute the shop's click handler reads.
 */
export function actionButton(label, attrs = '', { variant = 'mint', icon = '', pressed = null, disabled = false } = {}) {
  return `<button class="sc-buy is-${variant}" ${attrs}${pressed == null ? '' : ` aria-pressed="${pressed}"`}${disabled || !online() ? ' disabled' : ''}>${icon ? svg(icon) : ''}<span>${label}</span></button>`;
}

/**
 * A square item card.
 *   id, title, art      what it is and its picture
 *   st                  cardState() for it
 *   button              cardButton() html
 *   badge               a short tag on the well (e.g. "T2"), optional
 *   fresh               just bought: the well pops
 *   mode                'use' on the inventory: the (i) sheet uses, not sells
 */
export function shopCard({ id, kind, mode = '', title, art, st, button, badge = '', fresh = false, counter = null, plate: plateIn = null, wide = false, pixel = false }) {
  const plate = plateIn || cardPlate(st.state);
  // the counter on the well: storage for fuel, or what the caller gives (a tier, fragments)
  const ctr = counter || (st.storage ? { label: t('shop.storage'), text: storageText(st.storage), full: st.state === 'max' } : null);
  return `<article class="sc-card is-${plate}${fresh ? ' is-fresh' : ''}${wide ? ' is-wide' : ''}${pixel ? ' is-pixel' : ''}" data-card="${esc(id)}">
    <header class="sc-head"><h3>${esc(title)}</h3>
      <button class="sc-info" data-shop-info="${esc(id)}" data-kind="${kind}"${mode ? ` data-mode="${mode}"` : ''} aria-label="${esc(t('shop.infoAria', { name: title }))}">${svg('info')}</button></header>
    <div class="sc-well">
      <img class="sc-art" src="${esc(art)}" width="256" height="256" loading="lazy" alt="">
      ${badge ? `<i class="sc-badge">${esc(badge)}</i>` : ''}
      ${ctr ? `<span class="sc-store"><small>${esc(ctr.label)}</small><b class="data-num${ctr.full ? ' is-full' : ''}">${esc(ctr.text)}</b></span>` : ''}
    </div>
    <div class="sc-foot">${button}</div>
  </article>`;
}

/** The currency the open tab spends, pinned to the bottom of the shop. */
export function walletBar(cur, amount, cap) {
  return `<div class="sc-wallet" role="status" aria-label="${esc(t(cur === 'carbs' ? 'shop.walletCarbs' : 'shop.walletCoins', { n: fmtNum(amount), cap: fmtNum(cap) }))}">
    <img src="${CUR_ART[cur]}" width="64" height="64" alt="">
    <span class="sc-wallet-name">${t(cur === 'carbs' ? 'shop.carbs' : 'shop.coins')}</span>
    <span class="sc-wallet-track" style="--f:${Math.max(0, Math.min(1, amount / cap)).toFixed(4)}"><i></i>
      <b class="data-num">${fmtNum(amount)}${cur === 'carbs' ? ' g' : ''}</b><small>/ ${fmtNum(cap)}</small></span>
  </div>`;
}

/**
 * The (i) sheet: the picture, the name, the facts as rows (label → value),
 * the story, and the card's button again so you can buy from here.
 */
export function openShopInfo({ title, art, rows = [], lore = '', note = '', button = '', onClick = null, stack = false }) {
  const root = openLayer('shop-info');
  root.innerHTML = `<div class="modal-backdrop" data-si-close></div>
    <div class="modal sc-info-sheet" role="dialog" aria-modal="true" aria-labelledby="si-h">
      ${sheetHead({ title: esc(title), id: 'si-h', closeAttr: 'data-si-close' })}
      <div class="modal-body">
        <div class="sc-info-well"><img src="${esc(art)}" width="256" height="256" alt=""></div>
        ${rows.length ? `<dl class="sc-facts${stack ? ' is-stack' : ''}">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
        ${lore ? `<p class="sc-lore">${esc(lore)}</p>` : ''}
        ${note ? `<p class="sc-note">${note}</p>` : ''}
        ${button ? `<div class="sc-info-foot">${button}</div>` : ''}
      </div>
    </div>`;
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-si-close]')) { closeLayer(root); return; }
    onClick?.(e, root);
  });
  return root;
}
