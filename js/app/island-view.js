// island-view.js: the club grounds round the base (docs/CITY.md, "The club grounds").
//
// The base stands in the middle of one estate. On the forecourt in front of it stand three small
// buildings, each a picture and a button: the club house, the stadium and the market kiosk. The
// club house and the kiosk start in ruins (the same picture, grey, until there is ruin art): tap
// one to pay for its rebuild, and a MOSKE box covers it, with a timer floating over it, until the
// mechanic is done.
// Then the club house opens the club screen and the kiosk opens the markets' screen. Your six
// markets (shop-view.js) stand like kennels on the lawn round the base, three down each front
// side. Each spot is its own button, opening the markets' screen on that market (or on building
// one there). Over each market:
//   - a coin bubble while it has coins waiting: tapping any one collects every market, one after
//     another, and each one's coins fly up to the coin gauge;
//   - a crate when its shelves run low (under RESTOCK_BELOW of their room), or a red one when every
//     shelf is empty (icons/Market/stock/, tools/cut-stock-icons.py): tapping it opens that market.
// The stadium opens its PVE race (stadium-view.js). A name tag floats over each of the three.

import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { ISLAND_ART } from '../core/island-art.js';
import { ISLAND_RULES, pieceState } from '../core/island.js';
import { myIsland, islandOpen, startIslandBuild, serverNow, walletNow, gearError, onGear, myShop, shopCall, refreshGear } from './gear-state.js';
import {
  marketPicture, SHOP_RULES, marketSales, shelfFill, RESTOCK_BELOW, demandAt, weekMinutes, trafficFor,
} from '../core/shop.js';
import { closeBar as closeMarketBar, flyCoins } from './market-view.js';
import { haptic } from './haptics.js';
import { toast, prefersReducedMotion } from './effects.js';

const COIN = 'icons/Pixelart/GEAR/coin.png';
const { pieces: ART, plots: PLOT, unit: U, slope: S } = ISLAND_ART;
const REBUILT = ['club', 'market'];
// the buttons on the forecourt, and every picture, furthest back first, so nearer ones stand in front
const BUILDINGS = ['stadium', 'club', 'market'].sort((x, y) => PLOT[x][1] - PLOT[y][1]);
const ORDER = ['base', ...BUILDINGS];

// the six market spots on the lawn (tools/cut-grounds.py): a runs down-right from the base's
// middle, b down-left. Each market's picture stands with its pad's front corner (0.617 across the
// picture) on the spot's front corner. They're drawn smaller than they were painted for the old
// plaza (0.86 was full size there), and their pads shrink with them.
const SHOP_FOOT = 0.617; const SHOP_SCALE = ISLAND_ART.shopScale;
const SHOP_SPOTS = ISLAND_ART.shops.slice(0, SHOP_RULES.spots);
const onPlaza = (a, b) => [PLOT.base[0] + (a - b) * U, PLOT.base[1] + (a + b) * S * U];
const DA = (0.88 * SHOP_SCALE) / 0.86; const DB = (0.53 * SHOP_SCALE) / 0.86;
function shopBox(spot, ratio) {
  const s = SHOP_SPOTS[spot - 1];
  const w = (DA + DB) * U * SHOP_SCALE;
  const [fx, fy] = onPlaza(s.a + DA / 2, s.b + DB / 2);
  const h = w * ratio;
  return { left: fx - SHOP_FOOT * w, top: fy - h + w * 0.02, w, h };
}
const RATIO = 578 / 720;
// The markets on the island are copies with their shadow drawn in (tools/bake-market-shadows.py),
// on a canvas padded by this much (px of the picture): it's taken back off when they're placed.
// A CSS drop-shadow on six big pictures was redrawn off screen at full size on every zoom.
const SHADOW_PAD = { l: 16, t: 16, r: 16, b: 32 };
const islandMarket = (level) => marketPicture(level).replace('icons/Market/', 'icons/Market/island/');

/**
 * The construction box on a building: one picture for all of them, as wide as the building, its
 * front corner (the middle of its bottom edge) on the building's.
 */
function boxOn(plot) {
  const w = ART[plot].w * 1.05; const h = w * (ART.box.h / ART.box.w);
  return { src: ART.box.src, x: PLOT[plot][0] - w / 2, y: PLOT[plot][1] - h * 0.985, w, h };
}

/** The picture a plot shows now: what's rebuilt shows its ruin, the box, or itself. */
function pictureOf(plot) {
  if (!REBUILT.includes(plot)) return ART[plot];
  const { state } = pieceState(myIsland(), plot, serverNow());
  if (state === 'built') return ART[plot];
  return state === 'building' ? boxOn(plot) : ART[`${plot}-ruin`];
}

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
    for (const p of BUILDINGS) {
      const a = ART[p];
      const hit = document.createElement('button');
      hit.className = 'dg-isl-hit'; hit.dataset.isl = p;
      hit.setAttribute('aria-label', name(p));
      Object.assign(hit.style, { left: `${a.x}px`, top: `${a.y}px`, width: `${a.w}px`, height: `${a.h}px` });
      if (p === 'stadium') hit.addEventListener('click', (e) => { e.stopPropagation(); pulse(p); haptic('tick'); import('./stadium-view.js').then((m) => m.openStadium()); });
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
  for (const x of SHOP_SPOTS) {
    if (front.querySelector(`.dg-shop-coin[data-shop="${x.spot}"]`)) continue;
    const coin = document.createElement('button');
    coin.className = 'dg-mk-coin dg-shop-coin'; coin.dataset.shop = String(x.spot); coin.hidden = true;
    coin.innerHTML = `<img src="${COIN}" alt="" draggable="false">`;
    coin.addEventListener('click', (e) => { e.stopPropagation(); collectAll(); });
    const warn = document.createElement('button');
    warn.className = 'dg-shop-warn'; warn.dataset.shop = String(x.spot); warn.hidden = true;
    warn.innerHTML = '<img alt="" draggable="false">';
    warn.addEventListener('click', (e) => { e.stopPropagation(); openShops(x.spot); });
    front.append(coin, warn);
  }
  for (const p of BUILDINGS) {
    if (front.querySelector(`.dg-isl-tag[data-isl="${p}"]`)) continue;
    const el = document.createElement('div');
    el.className = 'dg-isl-tag'; el.dataset.isl = p; el.setAttribute('aria-hidden', 'true');
    el.textContent = name(p);
    Object.assign(el.style, { left: `${ART[p].x + ART[p].w * 0.46}px`, top: `${ART[p].y + ART[p].h * 0.04}px` });
    front.append(el);
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

/**
 * The single-plot base's club buildings (plot-art.js): the stadium and the club house stand behind the lawn as
 * pictures of the map (diorama.js plotEnv). Each gets a button over its picture and a name tag, and they work
 * as on the old forecourt: the stadium opens its race, the club house the club room (once it's rebuilt; till
 * then a tap offers the rebuild). `club` is PLOT_ART.club.
 */
export function mountPlotClub(worldEl, front, club, { workouts, screen }) {
  ctx = { workouts: workouts || (() => []), screen, world: worldEl, front };
  const PLOT_OF = { stadium: 'stadium', clubhouse: 'club' };
  for (const c of club) {
    const p = PLOT_OF[c.who]; const a = c.pic;
    if (!p) continue;
    if (!front.querySelector(`.dg-isl-tag[data-isl="${p}"]`)) {
      const tag = document.createElement('div');
      // its name shows only when it's tapped, as plain outlined words over it (styles.css .is-plot)
      tag.className = 'dg-isl-tag is-plot'; tag.dataset.isl = p; tag.setAttribute('aria-hidden', 'true');
      tag.innerHTML = `<b>${esc(name(p))}</b>`;
      Object.assign(tag.style, { left: `${a.x + a.w / 2}px`, top: `${a.y + a.h * 0.08}px` });
      front.append(tag);
    }
    if (worldEl.querySelector(`.dg-isl-hit[data-isl="${p}"]`)) continue;
    const hit = document.createElement('button');
    hit.className = 'dg-isl-hit is-plot'; hit.dataset.isl = p;
    hit.setAttribute('aria-label', name(p));
    Object.assign(hit.style, { left: `${a.x}px`, top: `${a.y}px`, width: `${a.w}px`, height: `${a.h}px` });
    hit.addEventListener('click', (e) => {
      e.stopPropagation();
      showTag(p);
      if (p === 'stadium') { haptic('tick'); import('./stadium-view.js').then((m) => m.openStadium()); } else tap(p);
    });
    worldEl.querySelector('.dg-items').before(hit);
  }
  import('./stadium-view.js').then((m) => m.warmupNotice()).catch(() => {});
  if (!mountPlotClub.watching) { mountPlotClub.watching = true; onGear(() => refreshBar()); }
}

// a club building's name over it for a few seconds after a tap (the other's goes)
let tagTimer = 0;
function showTag(p) {
  ctx.front?.querySelectorAll('.dg-isl-tag.is-plot').forEach((el) => el.classList.toggle('is-shown', el.dataset.isl === p));
  clearTimeout(tagTimer);
  tagTimer = setTimeout(() => ctx.front?.querySelectorAll('.dg-isl-tag.is-plot.is-shown').forEach((el) => el.classList.remove('is-shown')), 3200);
}

function paint() {
  const w = ctx.world;
  if (!w?.querySelector('.dg-plots')) return;
  for (const p of ORDER) {
    const el = w.querySelector(`.dg-plots [data-plot="${p}"]`);
    const a = pictureOf(p);
    el.hidden = !a.src;                       // the coliseum is painted on the ground: only its button
    if (!a.src) continue;
    if (el.getAttribute('src') !== a.src) el.src = a.src;
    Object.assign(el.style, { left: `${a.x}px`, top: `${a.y}px`, width: `${a.w}px`, height: `${a.h}px` });
  }
  paintShops();
  tickIsland();
}

/**
 * Each built market's picture on its spot (its level's picture), and a tap target on every spot
 * (an empty one opens on building a market there), and where its coin and crate float.
 */
function paintShops() {
  const w = ctx.world;
  const built = pieceState(myIsland(), 'market', serverNow()).state === 'built';
  const shops = myShop().shops;
  for (const x of SHOP_SPOTS) {
    const img = w.querySelector(`.dg-shop[data-shop="${x.spot}"]`);
    const hit = w.querySelector(`.dg-shop-hit[data-shop="${x.spot}"]`);
    const m = shops.find((r) => Number(r.spot) === x.spot);
    img.hidden = !built || !m; if (hit) hit.hidden = !built;
    if (!built) continue;
    if (m) {
      const src = islandMarket(m.level);
      if (img.getAttribute('src') !== src) img.src = src;
      if (!img.complete) img.addEventListener('load', () => paintShops(), { once: true });
    }
    // the market's own shape, without the shadow's padding
    const P = SHADOW_PAD;
    const pw = img.naturalWidth - P.l - P.r; const ph = img.naturalHeight - P.t - P.b;
    const box = shopBox(x.spot, m && img.naturalWidth ? ph / pw : RATIO);
    if (m && img.naturalWidth) {   // placed once it's loaded (paintShops runs again then)
      const k = box.w / pw;   // world px per px of the picture
      Object.assign(img.style, {
        left: `${(box.left - P.l * k).toFixed(1)}px`, top: `${(box.top - P.t * k).toFixed(1)}px`,
        width: `${(box.w + (P.l + P.r) * k).toFixed(1)}px`, height: 'auto',
      });
    }
    if (hit) {
      Object.assign(hit.style, { left: `${(box.left + box.w * 0.12).toFixed(1)}px`, top: `${(box.top + box.h * 0.1).toFixed(1)}px`, width: `${(box.w * 0.76).toFixed(1)}px`, height: `${(box.h * 0.85).toFixed(1)}px` });
      hit.setAttribute('aria-label', m ? t('mkt.market', { n: x.spot }) : t('mkt.buildMarket', { n: x.spot }));
    }
    const coin = ctx.front?.querySelector(`.dg-shop-coin[data-shop="${x.spot}"]`);
    const warn = ctx.front?.querySelector(`.dg-shop-warn[data-shop="${x.spot}"]`);
    if (coin) Object.assign(coin.style, { left: `${(box.left + box.w * 0.42).toFixed(1)}px`, top: `${(box.top + box.h * 0.14).toFixed(1)}px` });
    if (warn) Object.assign(warn.style, { left: `${(box.left + box.w * 0.66).toFixed(1)}px`, top: `${(box.top + box.h * 0.2).toFixed(1)}px` });
  }
  shopBadges();
}

/** What each market shows over it now: its coins waiting, and whether its shelves need stock. */
function shopBadges() {
  if (!ctx.front) return;
  const built = pieceState(myIsland(), 'market', serverNow()).state === 'built';
  const { shops, slots } = myShop();
  const now = serverNow(); const ws = ctx.workouts() || [];
  const f = trafficFor(weekMinutes(ws, now)).f; const demand = demandAt(ws, now);
  for (const x of SHOP_SPOTS) {
    const coin = ctx.front.querySelector(`.dg-shop-coin[data-shop="${x.spot}"]`);
    const warn = ctx.front.querySelector(`.dg-shop-warn[data-shop="${x.spot}"]`);
    if (!coin || !warn) continue;
    const m = built ? shops.find((r) => Number(r.spot) === x.spot) : null;
    if (!m) { coin.hidden = true; warn.hidden = true; continue; }
    const mine = slots.filter((r) => Number(r.spot) === x.spot).map((r) => ({ ...r, slot: Number(r.slot), units: Number(r.units) }));
    const n = marketSales(m.level, mine, now, { f, demand }).coins;
    if (!coin.classList.contains('is-taking')) coin.hidden = n < 1;
    coin.setAttribute('aria-label', t('mkt.collectAll'));
    const fill = shelfFill(m.level, mine, now, f);
    const out = fill.empty === fill.open;
    const low = !out && fill.frac < RESTOCK_BELOW;
    warn.hidden = !out && !low;
    warn.classList.toggle('is-out', out);
    const src = `icons/Market/stock/${out ? 'out-of-stock' : 'restock'}.webp`;
    const pic = warn.querySelector('img');
    if (!warn.hidden && pic.getAttribute('src') !== src) pic.src = src;
    warn.setAttribute('aria-label', t(out ? 'mkt.outOfStock' : 'mkt.needsRestock', { n: x.spot }));
  }
}

/** Collect every market with coins waiting, one after another; each one's coins fly to the gauge. */
let collecting = false;
async function collectAll() {
  if (collecting || !ctx.front) return;
  const spots = [...ctx.front.querySelectorAll('.dg-shop-coin')].filter((el) => !el.hidden).map((el) => Number(el.dataset.shop)).sort((a, b) => a - b);
  if (!spots.length) return;
  collecting = true;
  haptic('tick');
  let total = 0;
  try {
    for (const spot of spots) {
      const el = ctx.front.querySelector(`.dg-shop-coin[data-shop="${spot}"]`);
      el?.classList.add('is-taking');
      try {
        const r = await shopCall('collect_shop', { p_spot: spot }, { refresh: false });
        const n = Number(r?.coins) || 0;
        total += n;
        haptic('record');
        if (n && el) flyCoins(el, n);
      } catch (e) { toast(esc(gearError(e))); break; } finally { if (el) { el.classList.remove('is-taking'); el.hidden = true; } }
      // the next one a moment later, so each is seen
      if (!prefersReducedMotion()) await new Promise((r) => setTimeout(r, 280));
    }
  } finally {
    collecting = false;
    await refreshGear();
    shopBadges();
  }
  return total;
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
  shopBadges();
  let done = false;
  ctx.front.querySelectorAll('.dg-isl-timer').forEach((el) => {
    const p = el.dataset.isl;
    const s = pieceState(myIsland(), p, now);
    const was = !el.hidden;
    el.hidden = s.state !== 'building';
    if (was && el.hidden) done = true;
    // the name tag gives way to the timer
    const tag = ctx.front.querySelector(`.dg-isl-tag[data-isl="${p}"]`);
    if (tag) tag.hidden = !el.hidden;
    if (el.hidden) return;
    const pic = pictureOf(p);
    el.style.left = `${pic.x + pic.w / 2}px`; el.style.top = `${pic.y + 20}px`;
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
    // the club room opens on its own screen (diorama-view.js); the club's chat is on the Chat tab
    closeBar();
    document.dispatchEvent(new CustomEvent('dg-enter-room', { detail: { room: 'club' } }));
    return;
  }
  if (state === 'built' && plot === 'market') { openShops(0); return; }   // the kiosk: all your markets
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
