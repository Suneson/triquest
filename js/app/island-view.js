// island-view.js: the island's nine plots (docs/CITY.md).
//
// Every building is a picture standing on its plot. The club base, the pool and the market start
// in ruins: tap one to pay for its rebuild, and a giant MOSKE box covers it, with a timer floating
// over it, until the mechanic is done.
// Then the club base opens the club screen and the mall opens the shop. The rebuilt market plot is a
// bare plaza with six spots, two rows of three, each holding one of your markets (shop-view.js).
// The stadium opens its PVE race (stadium-view.js).

import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { ISLAND_ART } from '../core/island-art.js';
import { ISLAND_RULES, pieceState } from '../core/island.js';
import { myIsland, islandOpen, startIslandBuild, serverNow, walletNow, gearError, onGear, myShop } from './gear-state.js';
import { marketPicture, SHOP_RULES } from '../core/shop.js';
import { setChatMode } from './chat.js';
import { closeBar as closeMarketBar } from './market-view.js';
import { haptic } from './haptics.js';
import { toast, prefersReducedMotion } from './effects.js';

const COIN = 'icons/Pixelart/GEAR/coin.png';
const { pieces: ART, plots: PLOT, unit: U, slope: S } = ISLAND_ART;
const REBUILT = ['club', 'pool', 'market'];
// furthest back first, so nearer buildings stand in front
const ORDER = ['park', 'club', 'stadium', 'hall', 'base', 'arena', 'pool', 'mall', 'market'];
const HALF_H = 2 * S * U; const HALF_W = 2 * U; const RISE = 360;

// the six market spots on the plaza, two rows of three: a is across it, b down it. Each market's
// picture stands with its pad's front corner (0.617 across the picture) on the spot's front corner.
const SHOP_FOOT = 0.617; const SHOP_SCALE = 0.86;
const SHOP_SPOTS = Array.from({ length: SHOP_RULES.spots }, (_, i) => ({ spot: i + 1, a: [-0.5, 0.42][Math.floor(i / 3)], b: [-0.64, -0.04, 0.56][i % 3] }));
const onPlaza = (a, b) => [PLOT.market[0] + (a - b) * U, PLOT.market[1] + (a + b) * S * U];
const DA = 0.88; const DB = 0.53;
function shopBox(spot, ratio) {
  const s = SHOP_SPOTS[spot - 1];
  const w = (DA + DB) * U * SHOP_SCALE;
  const [fx, fy] = onPlaza(s.a + DA / 2, s.b + DB / 2);
  const h = w * ratio;
  return { left: fx - SHOP_FOOT * w, top: fy - h + w * 0.02, w, h };
}
const RATIO = 578 / 720;

/** The construction box on a plot: one picture for all of them. */
const boxOn = (plot) => ({ ...ART.box, x: PLOT[plot][0] + ART.box.dx, y: PLOT[plot][1] + ART.box.dy });

/** The picture a plot shows now: what's rebuilt shows its ruin, the box, or itself. */
function pictureOf(plot) {
  if (!REBUILT.includes(plot)) return ART[plot];
  const { state } = pieceState(myIsland(), plot, serverNow());
  if (state === 'built') return plot === 'market' ? { ...ART.market, src: 'icons/Island/market-empty.webp' } : ART[plot];
  return state === 'building' ? boxOn(plot) : ART[`${plot}-ruin`];
}

/** What can stand in front of the delivery van on its road: the mall and the market. */
export const islandFront = () => [ART.mall, pictureOf('market')];

let ctx = { workouts: () => [], screen: null, world: null, front: null };

const clock = (ms) => {
  const m = Math.max(1, Math.ceil(ms / 60e3));
  return m >= 60 ? t('city.market.hm', { h: Math.floor(m / 60), m: m % 60 }) : t('city.market.m', { m });
};
const name = (plot) => t(`island.name.${plot}`);

/** Put the plots in the world, once, and bring them up to date. */
export function mountIsland(worldEl, front, { workouts, screen }) {
  ctx = { workouts: workouts || (() => []), screen, world: worldEl, front };
  if (!worldEl.querySelector('.dg-plots')) {
    const layer = document.createElement('div');
    layer.className = 'dg-plots';
    layer.innerHTML = ORDER.map((p) => `<img data-plot="${p}" alt="" draggable="false" decoding="async">`).join('')
      + [...SHOP_SPOTS].sort((x, y) => x.a + x.b - (y.a + y.b)).map((x) => `<img class="dg-shop" data-shop="${x.spot}" alt="" draggable="false" decoding="async" hidden>`).join('');
    worldEl.querySelector('.dg-tower').before(layer);
    for (const p of [...REBUILT, 'mall', 'stadium'].sort((x, y) => ORDER.indexOf(x) - ORDER.indexOf(y))) {
      const [x, y] = PLOT[p];
      const hit = document.createElement('button');
      hit.className = 'dg-isl-hit'; hit.dataset.isl = p;
      hit.setAttribute('aria-label', name(p));
      Object.assign(hit.style, { left: `${x - HALF_W}px`, top: `${y - HALF_H - RISE}px`, width: `${HALF_W * 2}px`, height: `${HALF_H * 2 + RISE}px` });
      if (p === 'mall') hit.dataset.action = 'open-gear';
      else if (p === 'stadium') hit.addEventListener('click', (e) => { e.stopPropagation(); haptic('tick'); import('./stadium-view.js').then((m) => m.openStadium()); });
      else hit.addEventListener('click', (e) => { e.stopPropagation(); tap(p); });
      worldEl.querySelector('.dg-items').before(hit);
    }
    for (const x of SHOP_SPOTS) {
      const hit = document.createElement('button');
      hit.className = 'dg-shop-hit'; hit.dataset.shop = String(x.spot); hit.hidden = true;
      hit.addEventListener('click', (e) => { e.stopPropagation(); openShops(x.spot); });
      worldEl.querySelector('.dg-items').before(hit);
    }
  }
  for (const p of REBUILT) {
    if (front.querySelector(`.dg-isl-timer[data-isl="${p}"]`)) continue;
    const el = document.createElement('div');
    el.className = 'dg-isl-timer'; el.dataset.isl = p; el.hidden = true;
    el.innerHTML = `<span class="dg-isl-ico" aria-hidden="true">${svg('wrench')}</span><b class="data-num"></b><i></i>`;
    front.append(el);
  }
  paint();
  import('./stadium-view.js').then((m) => m.warmupNotice()).catch(() => {});
  if (!mountIsland.watching) { mountIsland.watching = true; onGear(() => { paint(); refreshBar(); }); }
}

function paint() {
  const w = ctx.world;
  if (!w?.querySelector('.dg-plots')) return;
  for (const p of ORDER) {
    const el = w.querySelector(`.dg-plots [data-plot="${p}"]`);
    const a = pictureOf(p);
    if (el.getAttribute('src') !== a.src) el.src = a.src;
    Object.assign(el.style, { left: `${a.x}px`, top: `${a.y}px`, width: `${a.w}px`, height: `${a.h}px` });
  }
  paintShops();
  tickIsland();
}

/** Each built market's picture on its spot (its level's picture), and a tap target over it. */
function paintShops() {
  const w = ctx.world;
  const built = pieceState(myIsland(), 'market', serverNow()).state === 'built';
  const shops = myShop().shops;
  for (const x of SHOP_SPOTS) {
    const img = w.querySelector(`.dg-shop[data-shop="${x.spot}"]`);
    const hit = w.querySelector(`.dg-shop-hit[data-shop="${x.spot}"]`);
    const m = shops.find((r) => Number(r.spot) === x.spot);
    img.hidden = !built || !m; if (hit) hit.hidden = !built || !m;
    if (img.hidden) continue;
    const src = marketPicture(m.level);
    if (img.getAttribute('src') !== src) img.src = src;
    const box = shopBox(x.spot, img.naturalWidth ? img.naturalHeight / img.naturalWidth : RATIO);
    Object.assign(img.style, { left: `${box.left.toFixed(1)}px`, top: `${box.top.toFixed(1)}px`, width: `${box.w.toFixed(1)}px`, height: 'auto' });
    if (!img.complete) img.addEventListener('load', () => paintShops(), { once: true });
    if (hit) Object.assign(hit.style, { left: `${(box.left + box.w * 0.12).toFixed(1)}px`, top: `${(box.top + box.h * 0.1).toFixed(1)}px`, width: `${(box.w * 0.76).toFixed(1)}px`, height: `${(box.h * 0.85).toFixed(1)}px` });
    hit?.setAttribute('aria-label', t('mkt.market', { n: x.spot }));
  }
}

/** The markets' screen, on one market's tab. */
function openShops(spot = 0) {
  closeBar();
  haptic('tick');
  const el = ctx.world?.querySelector(`.dg-shop[data-shop="${spot}"]`);
  if (el && !el.hidden && !prefersReducedMotion()) { el.classList.remove('is-tap'); void el.offsetWidth; el.classList.add('is-tap'); }
  import('./shop-view.js').then((m) => m.openMarket({ spot, workouts: ctx.workouts }));
}

/** The timers over what's being rebuilt, each second. A rebuild that's just finished shows itself. */
export function tickIsland() {
  if (!ctx.front) return;
  const now = serverNow();
  let done = false;
  ctx.front.querySelectorAll('.dg-isl-timer').forEach((el) => {
    const p = el.dataset.isl;
    const s = pieceState(myIsland(), p, now);
    const was = !el.hidden;
    el.hidden = s.state !== 'building';
    if (was && el.hidden) done = true;
    if (el.hidden) return;
    const pic = pictureOf(p);
    el.style.left = `${PLOT[p][0]}px`; el.style.top = `${pic.y + 40}px`;
    el.querySelector('b').textContent = clock(s.left);
    el.querySelector('i').style.setProperty('--f', s.frac.toFixed(4));
    el.setAttribute('aria-label', t('island.buildingAria', { name: name(p), left: clock(s.left) }));
  });
  if (done) paint();
}

// ---- tapping a plot ------------------------------------------------------------------------------

function pulse(plot) {
  const el = ctx.world?.querySelector(`.dg-plots [data-plot="${plot}"]`);
  if (!el || prefersReducedMotion()) return;
  el.classList.remove('is-tap'); void el.offsetWidth; el.classList.add('is-tap');
}

function tap(plot) {
  pulse(plot);
  haptic('tick');
  closeMarketBar();
  const { state, left } = pieceState(myIsland(), plot, serverNow());
  if (state === 'building') { closeBar(); toast(esc(t('island.building', { name: name(plot), left: clock(left) })), { icon: svg('wrench') }); return; }
  if (state === 'built' && plot === 'club') {
    closeBar();
    setChatMode('club');
    document.dispatchEvent(new CustomEvent('moske:open-chat', { detail: null }));
    return;
  }
  if (state === 'built' && plot === 'pool') { closeBar(); return; }
  if (state === 'built' && plot === 'market') { const first = myShop().shops.map((r) => Number(r.spot)).sort((a, b) => a - b)[0]; openShops(first || 0); return; }
  if (barPlot === plot && bar?.isConnected) { closeBar(); return; }
  openBar(plot);
}

let bar = null; let barPlot = null;

function openBar(plot) {
  closeBar();
  barPlot = plot;
  bar = document.createElement('div');
  bar.className = 'mk-bar';
  bar.setAttribute('role', 'dialog');
  (ctx.screen || document.body).append(bar);
  refreshBar();
  requestAnimationFrame(() => bar?.classList.add('is-in'));
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
}
function outside(e) {
  if (!bar || bar.contains(e.target) || e.target.closest?.('.dg-isl-hit')) return;
  closeBar();
}
export function closeBar() {
  document.removeEventListener('pointerdown', outside, true);
  bar?.remove();
  bar = null; barPlot = null;
}

const priceTag = (cost, coins) => `<span class="mk-btn-price data-num${coins < cost ? ' is-short' : ''}">${fmtNum(cost)}<img src="${COIN}" alt=""></span>`;

function refreshBar() {
  if (!bar?.isConnected) return;
  const plot = barPlot;
  const { state } = pieceState(myIsland(), plot, serverNow());
  if (state !== 'ruin') { closeBar(); return; }
  const coins = walletNow(ctx.workouts()).coins;
  const open = islandOpen();
  const cost = ISLAND_RULES.pieces[plot];
  const title = t('island.ruined', { name: name(plot) });
  const btn = `<button class="mk-btn is-buy" data-isl-go="rebuild" ${open ? '' : 'disabled'}>${priceTag(cost, coins)}
      <span class="mk-btn-ico">${svg('wrench')}</span><b>${esc(t('island.rebuild'))}</b></button>`;
  const note = open ? t('island.takes', { h: ISLAND_RULES.buildHours }) : t('island.soon');
  bar.innerHTML = `<h2 class="mk-bar-h">${esc(title)}</h2><p class="mk-bar-note">${esc(note)}</p>
    <div class="mk-bar-btns">${btn}</div>`;
  bar.querySelector('[data-isl-go]').addEventListener('click', (e) => go(plot));
}

async function go(plot) {
  try {
    await startIslandBuild(plot);
    haptic('record');
    closeBar();
    toast(esc(t('island.started', { h: ISLAND_RULES.buildHours })), { icon: svg('wrench') });
  } catch (e) { toast(esc(gearError(e))); }
}
