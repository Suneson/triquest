// island-view.js: the island's nine plots (docs/CITY.md).
//
// Every building is a picture standing on its plot. The club base, the pool and the market start
// in ruins: tap one to pay for its rebuild, and a timer floats over it while the mechanic works.
// Then the club base opens the club screen, the market takes one stall, and the mall opens the shop.

import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { ISLAND_ART } from '../core/island-art.js';
import { ISLAND_RULES, pieceState, standOf } from '../core/island.js';
import { myIsland, islandOpen, startIslandBuild, buyIslandStand, moveIslandStand, serverNow, walletNow, gearError, onGear } from './gear-state.js';
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

// the stall's picture and its nine spots on the market's plaza: a is across, b down it
const STAND = { src: 'icons/Island/stand.webp', w: 380, ratio: 1 };
const SPOT_R = 0.21;
const SPOTS = ISLAND_RULES.spots.map((spot, i) => ({ spot, a: [-0.2, 0.25, 0.7][i % 3], b: [-0.6, -0.1, 0.4][Math.floor(i / 3)] }));
const onPlaza = (a, b) => [PLOT.market[0] + (a - b) * U, PLOT.market[1] + (a + b) * S * U];

/** The picture a plot shows now: what's rebuilt shows its ruin, its works, or itself. */
function pictureOf(plot) {
  if (!REBUILT.includes(plot)) return ART[plot];
  const { state } = pieceState(myIsland(), plot, serverNow());
  if (state === 'built') return ART[plot];
  return (state === 'building' && ART[`${plot}-build`]) || ART[`${plot}-ruin`];
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
      + '<img class="dg-stand" data-stand alt="" draggable="false" decoding="async" hidden>';
    worldEl.querySelector('.dg-tower').before(layer);
    for (const p of [...REBUILT, 'mall'].sort((x, y) => ORDER.indexOf(x) - ORDER.indexOf(y))) {
      const [x, y] = PLOT[p];
      const hit = document.createElement('button');
      hit.className = 'dg-isl-hit'; hit.dataset.isl = p;
      hit.setAttribute('aria-label', name(p));
      Object.assign(hit.style, { left: `${x - HALF_W}px`, top: `${y - HALF_H - RISE}px`, width: `${HALF_W * 2}px`, height: `${HALF_H * 2 + RISE}px` });
      if (p === 'mall') hit.dataset.action = 'open-gear';
      else hit.addEventListener('click', (e) => { e.stopPropagation(); tap(p); });
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
  const st = standOf(myIsland());
  const img = w.querySelector('[data-stand]');
  img.hidden = !st;
  if (st) placeStand(img, st.spot);
  tickIsland();
}

function placeStand(img, spot) {
  const s = SPOTS.find((x) => x.spot === Number(spot)) || SPOTS[0];
  const [x, y] = onPlaza(s.a + SPOT_R, s.b + SPOT_R);
  if (img.getAttribute('src') !== STAND.src) img.src = STAND.src;
  img.style.left = `${x - STAND.w / 2}px`; img.style.width = `${STAND.w}px`;
  img.style.bottom = 'auto';
  const place = () => { img.style.top = `${y - (STAND.w * img.naturalHeight) / img.naturalWidth}px`; };
  if (img.complete && img.naturalWidth) place(); else img.addEventListener('load', place, { once: true });
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
  if (placing) return;
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
  if (state === 'building') { closeBar(); return; }
  const coins = walletNow(ctx.workouts()).coins;
  const open = islandOpen();
  const st = standOf(myIsland());
  let title; let btn;
  if (state === 'ruin') {
    const cost = ISLAND_RULES.pieces[plot];
    title = t('island.ruined', { name: name(plot) });
    btn = `<button class="mk-btn is-buy" data-isl-go="rebuild" ${open ? '' : 'disabled'}>${priceTag(cost, coins)}
      <span class="mk-btn-ico">${svg('wrench')}</span><b>${esc(t('island.rebuild'))}</b></button>`;
  } else if (st) {
    title = name('market');
    btn = `<button class="mk-btn" data-isl-go="move" ${open ? '' : 'disabled'}><span class="mk-btn-ico"><img src="${STAND.src}" alt=""></span><b>${esc(t('island.move'))}</b></button>`;
  } else {
    title = name('market');
    btn = `<button class="mk-btn is-buy" data-isl-go="stand" ${open ? '' : 'disabled'}>${priceTag(ISLAND_RULES.standCost, coins)}
      <span class="mk-btn-ico"><img src="${STAND.src}" alt=""></span><b>${esc(t('island.stall'))}</b></button>`;
  }
  const note = state === 'ruin' ? t('island.takes', { h: ISLAND_RULES.buildHours }) : open ? '' : t('island.soon');
  bar.innerHTML = `<h2 class="mk-bar-h">${esc(title)}</h2>${note ? `<p class="mk-bar-note">${esc(state === 'ruin' && !open ? t('island.soon') : note)}</p>` : ''}
    <div class="mk-bar-btns">${btn}</div>`;
  bar.querySelector('[data-isl-go]').addEventListener('click', (e) => go(plot, e.currentTarget.dataset.islGo));
}

async function go(plot, what) {
  if (what === 'rebuild') {
    try {
      await startIslandBuild(plot);
      haptic('record');
      closeBar();
      toast(esc(t('island.started', { h: ISLAND_RULES.buildHours })), { icon: svg('wrench') });
    } catch (e) { toast(esc(gearError(e))); }
    return;
  }
  closeBar();
  choosePlace(what === 'move');
}

// ---- placing the stall ---------------------------------------------------------------------------

let placing = false;

/** Show the free spots on the plaza and wait for a tap on one. */
function choosePlace(moving) {
  placing = true;
  const taken = moving ? Number(standOf(myIsland())?.spot) : 0;
  const size = 2 * SPOT_R * U;
  const layer = document.createElement('div');
  layer.className = 'dg-isl-spots';
  layer.innerHTML = SPOTS.filter((s) => s.spot !== taken).map((s) => {
    const [x, y] = onPlaza(s.a, s.b);
    return `<button class="dg-isl-spot" data-spot="${s.spot}" aria-label="${esc(t('island.spotAria', { n: s.spot }))}"
      style="left:${x - size}px;top:${y - size * S}px;width:${size * 2}px;height:${size * 2 * S}px"></button>`;
  }).join('');
  ctx.world.querySelector('.dg-items').before(layer);
  const hint = document.createElement('div');
  hint.className = 'mk-bar is-in';
  hint.innerHTML = `<h2 class="mk-bar-h">${esc(t('island.placeHint'))}</h2><div class="mk-bar-btns"><button class="mk-btn" data-isl-cancel><b>${esc(t('island.cancel'))}</b></button></div>`;
  (ctx.screen || document.body).append(hint);
  const end = () => { placing = false; layer.remove(); hint.remove(); };
  hint.querySelector('[data-isl-cancel]').addEventListener('click', end);
  layer.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-spot]');
    if (!b) return;
    e.stopPropagation();
    try {
      if (moving) await moveIslandStand(Number(b.dataset.spot)); else await buyIslandStand(Number(b.dataset.spot));
      haptic('record');
      toast(esc(t(moving ? 'island.moved' : 'island.bought')), { icon: svg('check') });
      end();
    } catch (err) { toast(esc(gearError(err))); end(); }
  });
}
