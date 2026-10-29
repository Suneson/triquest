// shop-ui.js — the shop's pieces (docs/SHOP.md): the painted item card that
// sits two to a row and is itself the button, the (i) sheet that holds
// everything a card leaves out, and the currency bar pinned to the bottom.
//
// A card says four things: the name, the picture, how many you hold of how
// many, and the price in its tray. What a tap does is a "tap": built once by
// cardButton() or actionButton() and drawn twice, as the whole card and as the
// button at the foot of the (i) sheet. States come from js/core/shop-cards.js.

import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { storageText } from '../core/shop-cards.js';
import { openLayer, closeLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { haptic } from './haptics.js';

export const CUR_ART = { coins: 'icons/Pixelart/GEAR/coin.png', carbs: 'icons/Pixelart/GEAR/carbs.png' };
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;
const coinImg = (cur) => `<img class="sc-cur" src="${CUR_ART[cur]}" width="64" height="64" alt="">`;

/** "120 g" / "850": a price as the tray prints it. */
export const priceText = (n, cur) => `${fmtNum(n)}${cur === 'carbs' ? ' g' : ''}`;

/*
 * A tap: what touching a card (or its sheet's button) does.
 *   kind   'go'    it acts: buy, wear, use, aim, build
 *          'deny'  a price you can't reach yet: red, and the card shakes
 *          'off'   nothing to do (full, yours, locked): the card turns grey
 *          'wait'  not now (in the workshop, the target you're on): as it is, but still
 *   attrs  the data attribute the screen's click handler reads (on 'go')
 *   label  what a screen reader hears
 *   tray   what the tray shows (sheetTray, when the sheet's wider button says more)
 *   tone   'price', 'short', 'action', 'gold' or 'muted'
 */

/**
 * The tap for something with a price: buy it; a red price you can't reach yet;
 * MAX when storage is full; a quiet line when it's yours or in the workshop.
 */
export function cardButton(item, cur, st, { buyAttr = 'data-gear-buy', label = '', owned = '' } = {}) {
  if (st.state === 'max') return { kind: 'off', tone: 'muted', tray: `<b>${t('shop.maxShort')}</b>`, sheetTray: `<b>${t('shop.max')}</b>`, label: `${label} · ${t('shop.max')}` };
  if (st.state === 'owned') return { kind: 'off', tone: 'muted', tray: `${svg('check')}<b>${owned || t('shop.owned')}</b>`, label: owned || t('shop.owned') };
  if (st.state === 'building') {
    // in the workshop: a live countdown while it's fitted, else when it starts
    return st.end
      ? { kind: 'wait', tone: 'action', tray: `${svg('wrench')}<b data-ws-left="${st.end}" class="data-num">${st.left || ''}</b>`, label: t('shop.building') }
      : { kind: 'wait', tone: 'action', tray: `${svg('clock')}<b>${st.queued || t('shop.building')}</b>`, label: st.queued || t('shop.building') };
  }
  const price = `<b class="sc-price data-num">${priceText(item.cost, cur)}</b>${coinImg(cur)}`;
  if (st.state === 'short') {
    return { kind: 'deny', tone: 'short', tray: price, label: `${label} · ${t(cur === 'carbs' ? 'shop.shortCarbs' : 'shop.shortCoins')}` };
  }
  return { kind: online() ? 'go' : 'wait', tone: 'price', attrs: `${buyAttr}="${esc(item.id)}"`, tray: price, label };
}

/** The tap for an action that isn't a price: Wear, Use, Aim, Build (or locked). */
export function actionButton(label, attrs = '', { variant = 'mint', icon = '', pressed = null, disabled = false, aria = '' } = {}) {
  const tray = `${icon ? svg(icon) : ''}<b>${label}</b>`;
  if (variant === 'locked') return { kind: 'off', tone: 'muted', tray, label };
  let kind = 'go';
  if (disabled) kind = pressed ? 'wait' : 'off';
  else if (!online()) kind = 'wait';
  return { kind, tone: variant === 'gold' ? 'gold' : 'action', attrs, tray, label: aria || label, pressed };
}

/** A tap drawn as a button on its own: the (i) sheet's foot, an empty tab's way to the shop. */
export function tapButton(tap) {
  if (!tap) return '';
  const pressed = tap.pressed == null ? '' : ` aria-pressed="${tap.pressed}"`;
  const aria = tap.label ? ` aria-label="${esc(tap.label)}"` : '';
  if (tap.kind === 'go') return `<button class="sc-buy is-${tap.tone}" ${tap.attrs || ''}${aria}${pressed}>${tap.tray}</button>`;
  if (tap.kind === 'deny') return `<button class="sc-buy is-short" data-sc-deny aria-disabled="true"${aria}>${tap.tray}</button>`;
  if (tap.kind === 'off') return `<button class="sc-buy is-max" disabled${aria}>${tap.sheetTray || tap.tray}</button>`;
  return `<span class="sc-buy is-done" role="status"${pressed}>${tap.tray}</span>`;
}

/**
 * An item card. The card is the button: a transparent hit area covers it, and
 * the (i) sits above that, so touching anywhere but the (i) does the card's tap.
 *   id, title, art   what it is and its picture
 *   st               cardState() for it (storage drives the counter)
 *   button           the tap, from cardButton() or actionButton()
 *   plate            'blue' (gear, clothes, base) or 'green' (fuel)
 *   counter          { label, text, full } on the picture; storage by default
 *   badge            a short tag on the picture ("T2"), optional
 *   fresh            just bought: the picture pops
 *   mode             'use' in the inventory: the (i) sheet uses, not sells
 */
export function shopCard({ id, kind, mode = '', title, art, st, button: tap, plate = 'blue', counter = null, badge = '', fresh = false, pixel = false }) {
  const ctr = counter || (st.storage ? { label: t('shop.storage'), text: storageText(st.storage), full: st.state === 'max' } : null);
  const name = esc(title);
  // what the card is and what touching it does; most tap labels already name the item
  const hitLabel = esc(tap.label?.includes(title) ? tap.label : [title, tap.label].filter(Boolean).join(' · '));
  let hit;
  if (tap.kind === 'go') hit = `<button class="sc-hit" ${tap.attrs || ''} aria-label="${hitLabel}"${tap.pressed == null ? '' : ` aria-pressed="${tap.pressed}"`}></button>`;
  else if (tap.kind === 'deny') hit = `<button class="sc-hit" data-sc-deny aria-disabled="true" aria-label="${hitLabel}"></button>`;
  else hit = `<button class="sc-hit" disabled aria-label="${hitLabel}"></button>`;
  const cls = ['sc-card', `is-${plate}`, `is-${tap.kind}`, tap.kind === 'off' ? 'is-disabled' : '', fresh ? 'is-fresh' : '', pixel ? 'is-pixel' : ''].filter(Boolean).join(' ');
  return `<article class="${cls}" data-card="${esc(id)}">
    <header class="sc-head"><h3>${name}</h3></header>
    <div class="sc-well">
      <img class="sc-art" src="${esc(art)}" width="256" height="256" loading="lazy" alt="">
      ${badge ? `<i class="sc-badge">${esc(badge)}</i>` : ''}
      ${ctr ? `<span class="sc-store"><small>${esc(ctr.label)}</small><b class="data-num${ctr.full ? ' is-full' : ''}">${esc(ctr.text)}</b></span>` : ''}
    </div>
    <div class="sc-tray is-${tap.tone}" aria-hidden="true">${tap.tray}</div>
    ${hit}
    <button class="sc-info" data-shop-info="${esc(id)}" data-kind="${kind}"${mode ? ` data-mode="${mode}"` : ''} aria-label="${esc(t('shop.infoAria', { name: title }))}">
      <img src="icons/UI/cards/info-${plate}.webp" width="96" height="96" alt="" draggable="false"></button>
  </article>`;
}

/**
 * A tap on a price you can't reach yet: the card (or the sheet's button)
 * shakes, and nothing is bought. Returns true when it handled the click.
 */
export function denyTap(e) {
  const el = e.target.closest('[data-sc-deny]');
  if (!el) return false;
  const card = el.closest('.sc-card') || el;
  card.classList.remove('is-shake');
  void card.offsetWidth; // restart the animation
  card.classList.add('is-shake');
  haptic('refuse');
  return true;
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
 * the story, and the card's tap again as a button.
 */
export function openShopInfo({ title, art, rows = [], lore = '', note = '', button = null, onClick = null, stack = false, plate = 'blue' }) {
  const root = openLayer('shop-info');
  root.innerHTML = `<div class="modal-backdrop" data-si-close></div>
    <div class="modal sc-info-sheet is-${plate}" role="dialog" aria-modal="true" aria-labelledby="si-h">
      ${sheetHead({ title: esc(title), id: 'si-h', closeAttr: 'data-si-close' })}
      <div class="modal-body">
        <div class="sc-info-well is-${plate}"><img src="${esc(art)}" width="256" height="256" alt=""></div>
        ${rows.length ? `<dl class="sc-facts${stack ? ' is-stack' : ''}">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
        ${lore ? `<p class="sc-lore">${esc(lore)}</p>` : ''}
        ${note ? `<p class="sc-note">${note}</p>` : ''}
        ${button ? `<div class="sc-info-foot">${tapButton(button)}</div>` : ''}
      </div>
    </div>`;
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-si-close]')) { closeLayer(root); return; }
    if (denyTap(e)) return;
    onClick?.(e, root);
  });
  return root;
}
