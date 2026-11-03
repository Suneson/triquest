// market-view.js — the four markets round the tower's lobby (docs/MARKETS.md).
//
// Each is a painted picture standing in the city where the painted kiosks were: shut until it's
// bought, then blue at level 1 and gold at level 2 (icons/City/market/kiosk-0|1|2.webp, made with
// Gemini from the original kiosk). A tree and lamp posts stand in front of them, as before. Here:
//   - the pictures, in the world (so they pan and zoom with the city), and a tap target on each:
//     tapped, a market grows and springs back
//   - a coin bubble over each bought one that has coins waiting; tapping it collects them
//   - the bar that slides up when a market is tapped: its name and level over square buttons
//     (Info, then Buy; or Upgrade while there's a level above, and Collect)
//   - the info window: its picture beside what it makes and holds

import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { MARKET_RULES, marketIn, marketStock, marketLevel, marketFullIn, marketNext } from '../core/markets.js';
import { myMarkets, marketsOpen, buyMarket, collectMarket, upgradeMarket, serverNow, walletNow, gearError, onGear } from './gear-state.js';
import { openLayer } from './nav.js';
import { haptic } from './haptics.js';
import { toast, prefersReducedMotion } from './effects.js';

const COIN = 'icons/Pixelart/GEAR/coin.png';
// the market at each level as a picture: 0 is one not bought yet
const picture = (m) => `icons/City/market/kiosk-${m ? Number(m.level) || 1 : 0}.webp`;
const levelIn = (slot) => { const m = marketIn(myMarkets(), slot); return m ? Number(m.level) || 1 : 0; };

// In px of the city picture (5376 × 4980), where the painted kiosks stood: each market's front
// corner on the ground (`foot`, the lowest point of its picture) and how wide it stands. All four
// face down-left, like the originals, so the light falls on them as on the rest of the city.
export const MARKETS = [
  { slot: 1, foot: [1828, 3232], w: 286 },
  { slot: 2, foot: [2078, 3354], w: 310 },
  { slot: 3, foot: [3356, 3384], w: 314 },
  { slot: 4, foot: [3590, 3238], w: 312 },
];
// each picture's size and where its foot is in it (fractions of its width and height)
const ART = {
  kiosk: { w: 640, h: 714, foot: [0.5727, 1] },
  tree: { w: 300, h: 535, foot: [0.5033, 1] },
  lamp: { w: 200, h: 677, foot: [0.78, 1] },
};
// the trees and lamp posts in front of the markets (where the painted ones stood), by their foot
// and width; they stand in front of the markets or behind them by how far down the picture they are
const DRESSING = [
  { src: 'tree', foot: [1895, 3297], w: 74 },
  { src: 'lamp', foot: [1840, 3307], w: 36 },
  { src: 'lamp', foot: [2095, 3457], w: 38 },
  { src: 'tree', foot: [3242, 3402], w: 118 },
  { src: 'lamp', foot: [3340, 3447], w: 40 },
  { src: 'tree', foot: [3535, 3268], w: 64 },
];
/** Where a picture stands: its box in px of the city picture, from its foot and width. */
function boxOf(kind, foot, w) {
  const a = ART[kind];
  const h = (w * a.h) / a.w;
  return { left: foot[0] - a.foot[0] * w, top: foot[1] - a.foot[1] * h, w, h };
}
/** How tall a market stands (its coin bubble floats over it). */
const marketBox = (m) => boxOf('kiosk', m.foot, m.w);

let ctx = { workouts: () => [], screen: null };

/** A tapped market grows and springs back. */
function pulse(slot) {
  const el = document.querySelector(`.dg-mk[data-mk="${slot}"]`);
  if (!el || prefersReducedMotion()) return;
  el.classList.remove('is-tap'); void el.offsetWidth; el.classList.add('is-tap');
}

/**
 * Put the markets in the world (their pictures, the trees and lamps in front of them, and a tap
 * target on each) and their coin bubbles on the front layer. `screen` is the base's screen (the
 * bar slides up in it).
 */
export function mountMarkets(worldEl, front, { workouts, screen }) {
  ctx = { workouts: workouts || (() => []), screen };
  let layer = worldEl.querySelector('.dg-mks');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'dg-mks';
    // drawn further down the picture = nearer: markets, trees and lamps in that order
    const parts = [
      ...MARKETS.map((m) => ({ y: m.foot[1], html: `<img class="dg-mk" data-mk="${m.slot}" alt="" draggable="false" decoding="async">`, m })),
      ...DRESSING.map((d) => ({ y: d.foot[1], html: (() => { const b = boxOf(d.src, d.foot, d.w); return `<img class="dg-mk-prop" src="icons/City/market/${d.src}.webp" alt="" draggable="false" decoding="async" style="left:${b.left.toFixed(1)}px;top:${b.top.toFixed(1)}px;width:${b.w}px">`; })() })),
    ].sort((a, b) => a.y - b.y);
    layer.innerHTML = parts.map((p) => p.html).join('');
    for (const m of MARKETS) {
      const b = marketBox(m);
      Object.assign(layer.querySelector(`.dg-mk[data-mk="${m.slot}"]`).style, { left: `${b.left.toFixed(1)}px`, top: `${b.top.toFixed(1)}px`, width: `${b.w}px` });
    }
    worldEl.querySelector('.dg-tower').after(layer);
  }
  showMarkets();
  for (const m of MARKETS) {
    const b = marketBox(m);
    let hit = worldEl.querySelector(`.dg-mk-hit[data-mk="${m.slot}"]`);
    if (!hit) {
      hit = document.createElement('button');
      hit.className = 'dg-mk-hit'; hit.dataset.mk = String(m.slot);
      hit.addEventListener('click', (e) => { e.stopPropagation(); tapMarket(m.slot); });
      worldEl.querySelector('.dg-items').before(hit);
    }
    hit.setAttribute('aria-label', t('city.market.aria', { n: m.slot }));
    Object.assign(hit.style, { left: `${b.left.toFixed(1)}px`, top: `${b.top.toFixed(1)}px`, width: `${b.w}px`, height: `${b.h.toFixed(1)}px` });
    let coin = front.querySelector(`.dg-mk-coin[data-mk="${m.slot}"]`);
    if (!coin) {
      coin = document.createElement('button');
      coin.className = 'dg-mk-coin'; coin.dataset.mk = String(m.slot);
      coin.innerHTML = `<img src="${COIN}" alt="" draggable="false">`;
      coin.addEventListener('click', (e) => { e.stopPropagation(); collect(m.slot, coin); });
      front.append(coin);
    }
    Object.assign(coin.style, { left: `${(b.left + b.w / 2).toFixed(1)}px`, top: `${(b.top + 10).toFixed(1)}px` });
  }
  showCoins();
  if (!mountMarkets.watching) { mountMarkets.watching = true; onGear(() => { showMarkets(); showCoins(); refreshBar(); }); }
}

/** Each market's picture for its level. */
function showMarkets() {
  document.querySelectorAll('.dg-mk').forEach((el) => {
    const src = picture(levelIn(el.dataset.mk) ? { level: levelIn(el.dataset.mk) } : null);
    if (el.getAttribute('src') !== src) el.src = src;
  });
}

/** Show a coin over each bought market with coins waiting (call every so often: they fill up). */
export function showCoins() {
  const now = serverNow();
  document.querySelectorAll('.dg-mk-coin').forEach((el) => {
    const m = marketIn(myMarkets(), el.dataset.mk);
    const n = m ? marketStock(m, now) : 0;
    el.hidden = n < 1;
    el.classList.toggle('is-full', !!m && n >= marketLevel(m).capacity);
    el.setAttribute('aria-label', t('city.market.collectAria', { n }));
  });
}

async function collect(slot, from) {
  if (from?.classList.contains('is-taking')) return;
  from?.classList.add('is-taking');
  try {
    const { coins } = await collectMarket(slot);
    haptic('record');
    flyCoins(from, coins);
  } catch (e) {
    toast(esc(gearError(e)));
  } finally {
    from?.classList.remove('is-taking');
    showCoins();
    refreshBar();
  }
}

/** Coins rising from where they were taken towards the coin gauge, and the count. */
function flyCoins(from, n) {
  const box = from?.getBoundingClientRect?.();
  const gauge = document.querySelector('.dg-gauge.is-coins')?.getBoundingClientRect();
  if (!box || prefersReducedMotion()) return;
  const x0 = box.left + box.width / 2; const y0 = box.top + box.height / 2;
  const pop = document.createElement('div');
  pop.className = 'mk-pop'; pop.textContent = `+${fmtNum(n)}`;
  Object.assign(pop.style, { left: `${x0}px`, top: `${y0}px` });
  document.body.append(pop);
  setTimeout(() => pop.remove(), 1100);
  if (!gauge) return;
  const x1 = gauge.right - 18; const y1 = gauge.top + gauge.height / 2;
  for (let i = 0; i < Math.min(8, Math.max(3, n)); i++) {
    const c = document.createElement('img');
    c.src = COIN; c.alt = ''; c.className = 'mk-fly';
    Object.assign(c.style, { left: `${x0}px`, top: `${y0}px` });
    document.body.append(c);
    const dx = (Math.random() - 0.5) * 70; const dy = -30 - Math.random() * 40;
    c.animate([
      { transform: 'translate(-50%, -50%) scale(.6)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`, opacity: 1, offset: 0.3 },
      { transform: `translate(calc(-50% + ${x1 - x0}px), calc(-50% + ${y1 - y0}px)) scale(.55)`, opacity: 0.9 },
    ], { duration: 650 + i * 70, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' }).onfinish = () => c.remove();
  }
}

// ---- the bar: the market's name over its buttons -----------------------------------------------

let bar = null;
let barSlot = null;

function tapMarket(slot) {
  pulse(slot);
  haptic('tick');
  if (barSlot === slot && bar?.isConnected) { closeBar(); return; }
  openBar(slot);
}

function openBar(slot) {
  closeBar();
  barSlot = slot;
  bar = document.createElement('div');
  bar.className = 'mk-bar';
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-labelledby', 'mk-bar-h');
  (ctx.screen || document.body).append(bar);
  refreshBar();
  requestAnimationFrame(() => bar?.classList.add('is-in'));
  // a tap anywhere else puts it away
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
}

function outside(e) {
  if (!bar || bar.contains(e.target) || e.target.closest?.('.dg-mk-hit, .mk-info')) return;
  closeBar();
}

export function closeBar() {
  document.removeEventListener('pointerdown', outside, true);
  bar?.remove();
  bar = null; barSlot = null;
}

function refreshBar() {
  if (!bar?.isConnected) return;
  const slot = barSlot;
  const m = marketIn(myMarkets(), slot);
  const lv = marketLevel(m);
  const n = m ? marketStock(m, serverNow()) : 0;
  const coins = walletNow(ctx.workouts()).coins;
  const next = marketNext(m);
  const price = (cost) => `<span class="mk-btn-price data-num${coins < cost ? ' is-short' : ''}">${fmtNum(cost)}<img src="${COIN}" alt=""></span>`;
  const upgrade = next ? `<button class="mk-btn is-buy" data-mk-upgrade ${!marketsOpen() ? 'disabled' : ''}>${price(next.cost)}
         <span class="mk-btn-ico"><img src="${picture({ level: next.level })}" alt=""></span><b>${esc(t('city.market.upgrade'))}</b></button>` : '';
  const action = m
    ? `${upgrade}<button class="mk-btn" data-mk-collect ${n < 1 ? 'disabled' : ''}>
         <span class="mk-btn-ico"><img src="${COIN}" alt=""></span><b>${esc(t('city.market.collect'))}</b>${n ? `<i class="data-num">${fmtNum(n)}</i>` : ''}</button>`
    : `<button class="mk-btn is-buy" data-mk-buy ${!marketsOpen() ? 'disabled' : ''}>${price(MARKET_RULES.cost)}
         <span class="mk-btn-ico"><img src="${picture({ level: 1 })}" alt=""></span><b>${esc(t('city.market.buy'))}</b></button>`;
  bar.innerHTML = `<h2 id="mk-bar-h" class="mk-bar-h">${esc(t('city.market.title', { n: lv.level }))}</h2>
    <div class="mk-bar-btns">
      <button class="mk-btn" data-mk-info><span class="mk-btn-ico is-info" aria-hidden="true">i</span><b>${esc(t('city.market.info'))}</b></button>
      ${action}
    </div>`;
  bar.querySelector('[data-mk-info]').addEventListener('click', () => openInfo(slot));
  bar.querySelector('[data-mk-collect]')?.addEventListener('click', (e) => collect(slot, e.currentTarget));
  bar.querySelector('[data-mk-buy]')?.addEventListener('click', () => buy(slot));
  bar.querySelector('[data-mk-upgrade]')?.addEventListener('click', () => upgrade_(slot));
}

async function upgrade_(slot) {
  document.querySelectorAll('[data-mk-upgrade]').forEach((b) => { b.disabled = true; });
  try {
    await upgradeMarket(slot);
    haptic('record');
    pulse(slot);
    const m = marketIn(myMarkets(), slot);
    toast(esc(t('city.market.upgraded', { n: marketLevel(m).level })), { icon: svg('check') });
    document.querySelector('.mk-layer [data-layer-close]')?.click();
  } catch (e) {
    toast(esc(gearError(e)));
  } finally {
    showCoins();
    refreshBar();
  }
}

async function buy(slot) {
  const btn = bar?.querySelector('[data-mk-buy]');
  if (btn) btn.disabled = true;
  try {
    await buyMarket(slot);
    haptic('record');
    pulse(slot);
    toast(esc(t('city.market.bought')), { icon: svg('check') });
  } catch (e) {
    toast(esc(gearError(e)));
  } finally {
    showCoins();
    refreshBar();
  }
}

// ---- the info window ----------------------------------------------------------------------------

export function openInfo(slot) {
  const m = marketIn(myMarkets(), slot);
  const lv = marketLevel(m);
  const now = serverNow();
  const n = m ? marketStock(m, now) : 0;
  const full = m ? marketFullIn(m, now) : 0;
  const next = marketNext(m);
  const coins = walletNow(ctx.workouts()).coins;
  const root = openLayer('market-info', { className: 'mk-layer', reuse: false });
  const stat = (ico, label, value, frac, cls = '') => `<li class="mk-stat ${cls}">
      <span class="mk-stat-ico" aria-hidden="true">${ico}</span>
      <span class="mk-stat-txt"><small>${esc(label)}</small><b class="data-num">${value}</b></span>
      ${frac == null ? '' : `<i class="mk-stat-bar" style="--f:${Math.max(0, Math.min(1, frac)).toFixed(3)}"></i>`}
    </li>`;
  const coinIco = `<img src="${COIN}" alt="">`;
  root.innerHTML = `<div class="modal-backdrop" data-layer-close></div>
    <div class="mk-info" role="dialog" aria-modal="true" aria-labelledby="mk-info-h">
      <header class="mk-info-head">
        <h2 id="mk-info-h"><span>${esc(t('city.market.name'))}</span> <em>${esc(t('city.market.level', { n: lv.level }))}</em></h2>
        <button class="mk-x" data-layer-close aria-label="${esc(t('city.market.close'))}">×</button>
        <i class="mk-info-lvl" aria-hidden="true"></i>
      </header>
      <div class="mk-info-body">
        <figure class="mk-pic${m ? '' : ' is-dark'}">
          ${m ? '' : `<span class="mk-ribbon">${esc(t('city.market.forSale'))}</span>`}
          <img src="${picture(m)}" alt="" draggable="false">
        </figure>
        <ul class="mk-stats">
          ${stat(coinIco, t('city.market.rate'), t('city.market.perHour', { n: fmtNum(lv.perHour) }), lv.perHour / 4)}
          ${stat('<span class="mk-jar"></span>', t('city.market.capacity'), `${fmtNum(n)}/${fmtNum(lv.capacity)}`, n / lv.capacity, 'is-cap')}
          ${m
            ? stat('<span class="mk-clock"></span>', t('city.market.fullIn'), full ? hoursLeft(full) : esc(t('city.market.full')), null)
            : stat(coinIco, t('city.market.price'), fmtNum(MARKET_RULES.cost), null)}
        </ul>
        <p class="mk-note">${esc(t(m ? 'city.market.about' : 'city.market.aboutBuy', { cost: fmtNum(MARKET_RULES.cost) }))}</p>
      </div>
      <footer class="mk-info-foot">${m && next
        ? `<p class="mk-next">${esc(t('city.market.nextLevel', { n: next.level, rate: fmtNum(next.perHour), cap: fmtNum(next.capacity) }))}</p>
           <button class="mk-up" data-mk-upgrade ${!marketsOpen() ? 'disabled' : ''}><b>${esc(t('city.market.upgrade'))}</b>
             <span class="data-num${coins < next.cost ? ' is-short' : ''}">${fmtNum(next.cost)}<img src="${COIN}" alt=""></span></button>`
        : m ? `<span class="mk-max">${esc(t('city.market.maxLevel'))}</span>` : ''}</footer>
    </div>`;
  root.querySelector('[data-mk-upgrade]')?.addEventListener('click', () => upgrade_(slot));
  return root;
}

const hoursLeft = (ms) => {
  const m = Math.ceil(ms / 60e3);
  return m >= 60 ? t('city.market.hm', { h: Math.floor(m / 60), m: m % 60 }) : t('city.market.m', { m });
};

