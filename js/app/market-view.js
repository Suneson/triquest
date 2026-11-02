// market-view.js — the four markets round the tower's lobby (docs/MARKETS.md).
//
// city3d.js draws them (lit once bought, dark until then). Here is what you touch:
//   - a tap target over each market (in the world, so it pans and zooms with the city)
//   - a coin bubble over each bought one that has coins waiting; tapping it collects them
//   - the bar that slides up when a market is tapped: its name and level over square buttons
//     (Info, and Collect or Buy)
//   - the info window: its picture beside what it makes and holds

import { esc } from './ui.js';
import { t, fmtNum } from '../core/i18n.js';
import { MARKET_RULES, marketIn, marketStock, marketLevel, marketFullIn } from '../core/markets.js';
import { myMarkets, marketsOpen, buyMarket, collectMarket, serverNow, walletNow, gearError, onGear } from './gear-state.js';
import { MARKETS, MARKET_HEIGHT } from './city3d.js';
import { openLayer } from './nav.js';
import { haptic } from './haptics.js';
import { toast, prefersReducedMotion } from './effects.js';

const COIN = 'icons/Pixelart/GEAR/coin.png';
const PICTURE = 'icons/City/market/market.webp';
const owned = (slot) => !!marketIn(myMarkets(), slot);
/** Is the market in this slot bought? (city3d.js lights it.) */
export const marketOwned = owned;

let ctx = { pulse: () => {}, workouts: () => [], screen: null };

/**
 * Put the markets' tap targets in the world and their coin bubbles on the front layer.
 * `pulse(slot)` bounces the 3D market; `screen` is the base's screen (the bar slides up in it).
 */
export function mountMarkets(worldEl, front, { pulse, workouts, screen }) {
  ctx = { pulse: pulse || (() => {}), workouts: workouts || (() => []), screen };
  for (const m of MARKETS) {
    let hit = worldEl.querySelector(`.dg-mk-hit[data-mk="${m.slot}"]`);
    if (!hit) {
      hit = document.createElement('button');
      hit.className = 'dg-mk-hit'; hit.dataset.mk = String(m.slot);
      hit.addEventListener('click', (e) => { e.stopPropagation(); tapMarket(m.slot); });
      worldEl.querySelector('.dg-items').before(hit);
    }
    hit.setAttribute('aria-label', t('city.market.aria', { n: m.slot }));
    Object.assign(hit.style, { left: `${m.at[0] - 140}px`, top: `${m.at[1] - MARKET_HEIGHT - 40}px`, width: '280px', height: `${MARKET_HEIGHT + 110}px` });
    let coin = front.querySelector(`.dg-mk-coin[data-mk="${m.slot}"]`);
    if (!coin) {
      coin = document.createElement('button');
      coin.className = 'dg-mk-coin'; coin.dataset.mk = String(m.slot);
      coin.innerHTML = `<img src="${COIN}" alt="" draggable="false">`;
      coin.addEventListener('click', (e) => { e.stopPropagation(); collect(m.slot, coin); });
      front.append(coin);
    }
    Object.assign(coin.style, { left: `${m.at[0]}px`, top: `${m.at[1] - MARKET_HEIGHT - 30}px` });
  }
  showCoins();
  if (!mountMarkets.watching) { mountMarkets.watching = true; onGear(() => { showCoins(); refreshBar(); }); }
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
  ctx.pulse(slot);
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
  const action = m
    ? `<button class="mk-btn" data-mk-collect ${n < 1 ? 'disabled' : ''}>
         <span class="mk-btn-ico"><img src="${COIN}" alt=""></span><b>${esc(t('city.market.collect'))}</b>${n ? `<i class="data-num">${fmtNum(n)}</i>` : ''}</button>`
    : `<button class="mk-btn is-buy" data-mk-buy ${!marketsOpen() ? 'disabled' : ''}>
         <span class="mk-btn-price data-num${coins < MARKET_RULES.cost ? ' is-short' : ''}">${fmtNum(MARKET_RULES.cost)}<img src="${COIN}" alt=""></span>
         <span class="mk-btn-ico"><img src="${PICTURE}" alt=""></span><b>${esc(t('city.market.buy'))}</b></button>`;
  bar.innerHTML = `<h2 id="mk-bar-h" class="mk-bar-h">${esc(t('city.market.title', { n: lv.level }))}</h2>
    <div class="mk-bar-btns">
      <button class="mk-btn" data-mk-info><span class="mk-btn-ico is-info" aria-hidden="true">i</span><b>${esc(t('city.market.info'))}</b></button>
      ${action}
    </div>`;
  bar.querySelector('[data-mk-info]').addEventListener('click', () => openInfo(slot));
  bar.querySelector('[data-mk-collect]')?.addEventListener('click', (e) => collect(slot, e.currentTarget));
  bar.querySelector('[data-mk-buy]')?.addEventListener('click', () => buy(slot));
}

async function buy(slot) {
  const btn = bar?.querySelector('[data-mk-buy]');
  if (btn) btn.disabled = true;
  try {
    await buyMarket(slot);
    haptic('record');
    ctx.pulse(slot);
    toast(esc(t('city.market.bought')), { icon: 'check' });
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
          <img src="${PICTURE}" alt="" draggable="false">
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
      <footer class="mk-info-foot"><span class="mk-max">${esc(t('city.market.maxLevel'))}</span></footer>
    </div>`;
  return root;
}

const hoursLeft = (ms) => {
  const m = Math.ceil(ms / 60e3);
  return m >= 60 ? t('city.market.hm', { h: Math.floor(m / 60), m: m % 60 }) : t('city.market.m', { m });
};

