// coffee-view.js: the coffee shop's window (js/core/coffee-shop.js, MOSKE APP/Island/COFFEE-SHOP.md).
// Three portrait screens side by side, slid between: the counter (who's in, what they want, the open/closed
// sign), the bar (grind, tamp, lock in, brew; milk: fridge, pitcher, steam wand) and the finish (ice, syrup,
// toppings, then the cup swiped up into the hatch). Each screen is one scene on its painted background
// (icons/Coffee/bg-*.webp, 900 x 1600): everything in it is placed in % of the scene, sized in cqw of it.
// v1 for testing: coins and builder bonuses are kept on this device (settings.coffeeShop).

import { openUpgrade, buildingLevel } from './upgrade-sheet.js';
import { openLayer, closeLayer } from './nav.js';
import { esc } from './ui.js';
import { t } from '../core/i18n.js';
import { haptic } from './haptics.js';
import * as store from './store.js';
import * as C from '../core/coffee-shop.js';
import * as sfx from './gel-sounds.js';
import { mountCustomer } from './coffee3d.js';

const ART = 'icons/Coffee';
const KEY = 'coffeeShop';
const ASPECT = 1600 / 900;          // a scene's height over its width
const BOSSES = ['blomvelt'];        // the bosses with a model so far (more as their GLBs come)

// ---- the bar's painted places, in % of the scene (bg-bar.webp) ----
const GRINDER = { l: 11, r: 30, t: 20, b: 50 };       // hold it to grind
const UNDER_GRINDER = { x: 20.5, y: 47.5 };           // the portafilter's basket, in the grinder's fork
const MAT = { x: 21, y: 59.5 };                       // on the tamping mat
const MAT_ZONE = { l: 3, r: 40, t: 52, b: 66 };
const GROUP = { x: 66, y: 39.8 };                     // locked in the group head
const GROUP_ZONE = { l: 52, r: 82, t: 33, b: 50 };
const BREW_ZONE = { l: 52, r: 82, t: 24, b: 50 };     // hold the machine to brew
const SCALE = { x: 66.3, y: 47.8 };                   // the cup on the drip tray's scale (its foot)
const SPOUT = { x: 49.4, y: 41, zone: { l: 44, r: 56, t: 35, b: 46 } };   // hot water
const WAND = { x: 85.5, y: 47.5, zone: { l: 76, r: 96, t: 42, b: 62 } };
const FRIDGE = { l: 1.3, t: 72.38, w: 47.85, h: 27.55 };   // patch-fridge-closed.webp
const FRIDGE_ZONE = { l: 2, r: 48, t: 72, b: 99 };
const CARTONS = { milk: { x: 25, y: 93.5 }, oat: { x: 38, y: 93.5 } };
const SHELF = { x: 76, y: 83.6 };                     // the pitcher's place
// ---- the finish (bg-finish.webp) ----
const COASTER = { x: 21, y: 70.2 };
const ICE = { l: 6.5, r: 38, t: 54.5, b: 64.5 };
const TOP_ZONES = { cream: { l: 50, r: 72.5, t: 54.5, b: 61 }, cocoa: { l: 72.5, r: 95.5, t: 54.5, b: 61 },
  cinnamon: { l: 50, r: 72.5, t: 61, b: 67.5 }, icecream: { l: 72.5, r: 95.5, t: 61, b: 67.5 } };
const SYRUP_X = [15, 29, 43, 57, 71, 85];             // the bottles along the shelf (its top at 43.4%)
const HATCH_Y = 30;                                   // the cup let go above this is served
// ---- the counter (bg-counter.webp) ----
// the customer's box: down to the counter's top edge, so they stand behind it

/** How tall each cup stands, in cqw of the scene. */
const CUP_H = { 'cup-espresso': 9, 'cup-cappuccino': 10, mug: 12, 'glass-latte': 17, 'glass-iced': 17, 'glass-coupe': 13 };
const STEP_ICON = { grind: 'step-grind', tamp: 'step-tamp', lock: 'step-lock', brew: 'step-brew', water: 'step-brew', carton: 'step-milk',
  steam: 'step-steam', pour: 'step-art', ice: 'step-ice', syrup: 'step-syrup', serve: 'step-serve' };
const TOP_ICON = { cream: 'step-cream', cocoa: 'step-dust', cinnamon: 'step-dust', icecream: 'ice-cream' };
const TOP_FX = { cream: 'fx-billow', cocoa: 'fx-cocoa', cinnamon: 'fx-cocoa', icecream: 'fx-splash' };

// how fast a held thing fills, per second (0-1)
const RATE = { grind: 0.42, tamp: 0.55, brew: 0.32, water: 0.4, carton: 0.38, steam: 0.33, pour: 0.5 };
const POUR_TO = 0.85;   // the milk poured into the cup, to the line

const img = (file, cls = '', style = '') => `<img class="${cls}" src="${ART}/${file}.webp" alt="" draggable="false"${style ? ` style="${style}"` : ''}>`;
const inside = (p, r) => p.x > r.l && p.x < r.r && p.y > r.t && p.y < r.b;
const drinkName = (d) => t(`coffee.drink.${d.id}`);

function load() {
  const s = store.getSettings()[KEY] || {};
  return { ...s, level: buildingLevel('coffee-shop'), open: !!s.open };
}
const save = (s) => store.setSetting(KEY, s);

/** The coffee shop's level, as the base draws it. */
export const shopLevel = () => buildingLevel('coffee-shop');
const shopArt = (n) => `icons/Items/coffee-shop-t${Math.max(1, Math.min(C.MAX_LEVEL, n))}-a.webp`;

/**
 * The coffee shop's window.
 * @param {{ level?: number }} opts  show it at this level (the ?coffee=1&lvl= preview); else the shop's own
 */
export function openCoffeeShop({ level = null } = {}) {
  let customer = null;   // coffee3d.js, once mounted
  const root = openLayer('coffee-shop', { className: 'cf-layer', onClose: () => { sfx.stopMusic(); customer?.dispose(); customer = null; } });
  let st = load();
  const pinned = !!level;   // ?coffee=1&lvl=: shown at that level, no upgrading
  if (level) st.level = Math.max(1, Math.min(C.MAX_LEVEL, Math.floor(level) || 1));
  const set = (patch) => { st = { ...st, ...patch }; save(st); };
  sfx.warmUp(); sfx.startMusic();

  let screen = 0;        // 0 counter, 1 bar, 2 finish
  let order = null;      // { who: { kind, id }, drink, steps, i, scores, extras, done, made:{...} }
  let result = null;     // { stars, coins, cut }
  let busy = false;
  let g = null;          // the gesture going on: { move, up }

  root.innerHTML = `<div class="cf">
    <header class="cf-bar">
      <button class="cf-x" data-cf-back aria-label="${esc(t('coffee.close'))}">×</button>
      <h2>${esc(t('coffee.title'))} <small data-cf-lvl>${esc(t('coffee.level', { n: st.level }))}</small></h2>
      ${pinned ? '' : `<button class="cf-up" data-cf-up>${esc(t('jobs.upgrade'))}</button>`}
      <span class="cf-coins" title="${esc(t('coffee.preview'))}">${img('tip-jar')}<b class="data-num">${Number(st.coins) || 0}</b></span>
    </header>
    <div class="cf-body"><div class="cf-track">
      <div class="cf-page"><section class="cf-scene is-counter" data-screen="0"></section></div>
      <div class="cf-page"><section class="cf-scene is-bar" data-screen="1"></section></div>
      <div class="cf-page"><section class="cf-scene is-finish" data-screen="2"></section></div>
    </div></div>
  </div>`;
  const track = root.querySelector('.cf-track');
  const scenes = [...root.querySelectorAll('.cf-scene')];
  const [counterEl, barEl, finishEl] = scenes;

  const go = (n) => {
    screen = n;
    track.style.setProperty('--i', n);
    scenes.forEach((s, i) => s.toggleAttribute('inert', i !== n));
  };
  const step = () => order?.steps[order.i] || null;
  const coins = () => { const b = root.querySelector('.cf-coins b'); if (b) b.textContent = Number(st.coins) || 0; };

  // ---- the counter ----
  function drawCounter() {
    const menu = C.menu(st.level);
    const now = Date.now();
    const day = C.today(st, now);
    let foot = '';
    if (result) {
      foot = `<div class="cf-card cf-result">
        <div class="cf-stars" role="img" aria-label="${esc(t('coffee.starsAria', { n: result.stars }))}">${'★'.repeat(result.stars)}<i>${'★'.repeat(3 - result.stars)}</i></div>
        <b>${esc(result.coins ? t('coffee.paid', { n: result.coins }) : t('coffee.cut', { n: result.cut }))}</b>
        <button class="cf-go" data-cf-next>${esc(t('coffee.next'))}</button></div>`;
    } else if (order) {
      foot = `<button class="cf-go cf-make" data-cf-make>${img('step-brew')}${esc(t('coffee.make'))}</button>`;
    } else if (st.open) {
      const left = day.cap - day.n;
      foot = left > 0
        ? `<button class="cf-go cf-make" data-cf-call>${esc(t('coffee.nextIn'))}</button><p class="cf-note">${esc(t('coffee.today', { n: day.n, cap: day.cap }))}</p>`
        : `<p class="cf-card cf-note">${esc(t('coffee.allServed', { cap: day.cap }))}</p>`;
    } else {
      foot = `<div class="cf-rings">${C.BUILDERS.map((b) => {
        const wait = C.builderReady(st, b, now);
        const h = Math.ceil(wait / 3600e3);
        return `<button class="cf-ring${wait ? ' is-waiting' : ''}" data-cf-builder="${b}" aria-label="${esc(t('coffee.builderAria', { who: t(`coffee.builder.${b}`) }))}${wait ? esc(` (${t('coffee.back', { h })})`) : ''}">
          ${img(`ring-${b}`)}<b>${esc(t(`coffee.builder.${b}`))}</b>${wait ? `<i>${img('badge-48h')}${h} h</i>` : ''}</button>`;
      }).join('')}</div><p class="cf-note">${esc(t('coffee.closedNote'))}</p>`;
    }
    const bubble = order && !result ? `<div class="cf-bubble">${img('bubble', 'cf-bubble-bg')}<span>${img(`drink-${order.drink.id}`, 'cf-bubble-drink')}<b>${esc(t('coffee.wants', { drink: drinkName(order.drink) }))}</b></span></div>` : '';
    counterEl.innerHTML = `
      <div class="cf-menuboard"><b>${esc(t('coffee.menu'))}</b>${menu.map((d) => `<span>${esc(drinkName(d))}</span>`).join('')}</div>
      <button class="cf-sign" data-cf-sign aria-pressed="${st.open}" aria-label="${esc(t(st.open ? 'coffee.signOpen' : 'coffee.signClosed'))}">${img(st.open ? 'sign-open' : 'sign-closed')}<b>${esc(t(st.open ? 'coffee.open' : 'coffee.closed'))}</b></button>
      <div class="cf-cust" data-cf-cust></div>
      ${bubble}
      <div class="cf-foot">${foot}</div>`;
    mountCust();
  }
  // the customer's box stays the same element between draws (its canvas is drawn by the shared renderer)
  let custBox = null;
  function mountCust() {
    if (!custBox) {
      custBox = document.createElement('div'); custBox.className = 'cf-cust';
      mountCustomer(custBox).then((c) => {
        if (!root.isConnected) { c?.dispose(); return; }
        customer = c;
        if (order) customer?.show(order.who.id);
      }).catch(() => {});
    }
    counterEl.querySelector('[data-cf-cust]')?.replaceWith(custBox);
  }

  function call(who) {
    const drink = C.pickDrink(st.level, Math.random());
    order = { who, drink, steps: C.steps(drink), i: 0, scores: [], extras: 0, made: { grind: 0, tamp: 0, brew: 0, water: 0, milk: 0, steam: 0, pour: 0, ice: 0, syrup: {}, tops: [] },
      pf: 'grinder', fridge: false, cupAt: null };
    result = null;
    sfx.play('ui-tap');
    drawCounter();
    customer?.show(who.id);
  }

  // ---- the ticket: the order's steps, the one now lit; its meter under it ----
  const ticket = () => {
    if (!order) return '';
    const items = order.steps.map((s, i) => {
      const icon = s.kind === 'top' ? TOP_ICON[s.top] : s.kind === 'syrup' ? `syrup-${s.syrup}` : STEP_ICON[s.kind];
      const n = s.kind === 'ice' || s.kind === 'syrup' ? `<b>${s.n}</b>` : '';
      return `<i class="${i < order.i ? 'is-done' : i === order.i ? 'is-now' : ''}">${img(icon)}${n}</i>`;
    }).join('');
    const s = step();
    return `<div class="cf-ticket">${img('ticket', 'cf-ticket-bg')}<div class="cf-ticket-in">
      <p class="cf-ticket-top">${img(`drink-${order.drink.id}`)}<b>${esc(drinkName(order.drink))}</b></p>
      <div class="cf-steps">${items}</div>
      <p class="cf-hint">${esc(s ? t(`coffee.hint.${s.kind}`, { milk: t(`coffee.${s.milk || 'milk'}`), n: s.n || 0, syrup: s.syrup ? t(`coffee.syrup.${s.syrup}`) : '', top: s.top ? t(`coffee.top.${s.top}`) : '' }) : '')}</p></div></div>`;
  };
  const meter = (v, to) => {
    const [lo, hi] = C.sweetSpot(to);
    return `<div class="cf-meter" style="--lo:${lo};--hi:${hi};--v:${v}">${img('quality-bar', 'cf-meter-bg')}<i class="cf-meter-band"></i><i class="cf-meter-fill"></i><i class="cf-meter-mark"></i></div>`;
  };
  const setMeter = (scene, v) => scene.querySelector('.cf-meter')?.style.setProperty('--v', Math.min(1, v).toFixed(4));

  // ---- the bar ----
  function drawBar() {
    if (!order) { barEl.innerHTML = ''; return; }
    const s = step();
    const d = order.drink;
    const m = order.made;
    const kind = s?.kind;
    const meterHtml = kind === 'grind' ? meter(m.grind, s.to) : kind === 'tamp' ? meter(m.tamp, 0.75)
      : kind === 'brew' ? meter(m.brew, s.to) : kind === 'water' ? meter(m.water, s.to)
        : kind === 'carton' ? meter(m.milk, s.to) : kind === 'steam' ? meter(m.steam, s.to) : kind === 'pour' ? meter(m.pour, POUR_TO) : '';
    const pfFile = m.tamp ? 'pf-tamped' : m.grind > 0.25 ? 'pf-heaped' : 'pf-empty';
    const pfAt = order.pf === 'group' ? GROUP : order.pf === 'mat' ? MAT : UNDER_GRINDER;
    const cup = order.cupAt ? `<img class="cf-cup" data-cf-cup src="${ART}/${m.pour ? `drink-${d.id}` : d.cup}.webp" alt="" draggable="false"
      style="left:${order.cupAt.x}%;top:${order.cupAt.y}%;height:${m.pour ? CUP_H[d.cup] * 1.25 : CUP_H[d.cup]}cqw">` : '';
    const pitcherFile = m.steam ? 'pitcher-steamed' : 'pitcher';
    barEl.innerHTML = `${ticket()}${meterHtml}
      ${order.fridge ? '' : img('patch-fridge-closed', 'cf-fridge', `left:${FRIDGE.l}%;top:${FRIDGE.t}%;width:${FRIDGE.w}%`)}
      ${order.fridge ? Object.entries(CARTONS).map(([k, p]) => img(k === 'milk' ? 'milk' : 'oat-milk', `cf-carton${s?.milk === k ? ' is-now' : ''}`, `left:${p.x}%;top:${p.y}%`).replace('<img', `<img data-cf-carton="${k}"`)).join('') : ''}
      <img class="cf-pf${order.pf === 'group' ? ' is-locked' : ''}" data-cf-pf src="${ART}/${pfFile}.webp" alt="" draggable="false" style="left:${pfAt.x}%;top:${pfAt.y}%">
      ${kind === 'tamp' && order.pf === 'mat' ? img('tamper', 'cf-tamper', `left:${MAT.x}%;top:${MAT.y}%;--p:${m.tamp}`) : ''}
      ${cup}
      ${d.milk ? `<img class="cf-pitcher" data-cf-pitcher src="${ART}/${pitcherFile}.webp" alt="" draggable="false" style="left:${SHELF.x}%;top:${SHELF.y}%">` : ''}
      <i class="cf-flow" data-cf-flow></i>
      <img class="cf-steam" data-cf-steam src="${ART}/fx-billow.webp" alt="">
      <img class="cf-grounds" data-cf-grounds src="${ART}/fx-grounds.webp" alt="">
      <div class="cf-pop" aria-live="polite"></div>`;
  }

  // ---- the finish ----
  function drawFinish() {
    if (!order) { finishEl.innerHTML = ''; return; }
    const d = order.drink;
    const m = order.made;
    finishEl.innerHTML = `${ticket()}
      ${C.SYRUPS.map((sy, i) => `<img class="cf-syrup${step()?.syrup === sy ? ' is-now' : ''}" data-cf-syrup="${sy}" src="${ART}/syrup-${sy}.webp" alt="${esc(t(`coffee.syrup.${sy}`))}" draggable="false" style="left:${SYRUP_X[i]}%">`).join('')}
      <img class="cf-cup is-final" data-cf-cup src="${ART}/drink-${d.id}.webp" alt="${esc(drinkName(d))}" draggable="false" style="left:${COASTER.x}%;top:${COASTER.y}%;height:${CUP_H[d.cup] * 1.25}cqw">
      <div class="cf-made">${m.ice ? `<i>${img('ice')}${m.ice}</i>` : ''}${Object.entries(m.syrup).map(([k, n]) => `<i>${img(`syrup-${k}`)}${n}</i>`).join('')}${m.tops.map((k) => `<i>${img(TOP_ICON[k])}</i>`).join('')}</div>
      <img class="cf-fx" data-cf-fx src="${ART}/fx-sparkle.webp" alt="">
      <p class="cf-serve-hint">${img('step-serve')}${esc(t('coffee.swipeUp'))}</p>
      <div class="cf-pop" aria-live="polite"></div>`;
  }

  const drawAll = () => { drawCounter(); drawBar(); drawFinish(); };

  function pop(scene, word) {
    const p = scene.querySelector('.cf-pop');
    if (!p) return;
    p.innerHTML = `<b>${esc(t(`coffee.judge.${word}`))}</b>`;
    p.className = `cf-pop is-${word}`;
    void p.offsetWidth; p.classList.add('is-on');
  }
  /** A bar step done: its pop, the next step, and on to the finish once the bar's done. */
  function finishStep(score, value = 1, to = 1, scene = barEl) {
    order.scores.push(score);
    haptic(score >= 0.8 ? 'place' : 'tick');
    sfx.play(score >= 0.8 ? 'step-good' : 'step-ok');
    if (step().kind !== 'lock') pop(scene, C.verdict(score, value, to));
    order.i += 1;
    const s = step();
    if (s?.kind === 'lock' || s?.kind === 'brew') order.cupAt = order.cupAt || { ...SCALE };
    if (s?.kind === 'water') order.cupAt = { x: SPOUT.x, y: SCALE.y };
    if (s && !C.BAR.has(s.kind) && screen === 1) {
      busy = true;
      setTimeout(() => { busy = false; drawFinish(); go(2); }, 900);
    }
    if (s && s.kind !== 'carton') order.fridge = false;   // the milk's out: the fridge shuts
    setTimeout(() => { if (screen === 1) drawBar(); }, score < 1 ? 650 : 400);
  }

  // ---- gestures on the bar ----
  const at = (scene, e) => { const r = scene.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 }; };
  /**
   * Hold to fill: while the pointer stays down (and `ok(p)` for where it is), `key` of the made drink rises by
   * RATE[kind] a second; on release it's scored against `to`. Time-based, so a frozen frame can't cheat it.
   */
  function hold(scene, e, kind, key, to, { ok = () => true, score = (v) => C.scoreLevel(v, to), fx = null, loop = null } = {}) {
    let since = performance.now(); let raf = 0; let over = ok(at(scene, e));
    const base = order.made[key];
    let held = 0;
    const sound = loop ? sfx.loop(loop, { level: over ? 1 : 0 }) : null;
    const tick = (now) => {
      if (over) held += (now - since) / 1000;
      since = now;
      const v = Math.min(1, base + held * RATE[kind]);
      order.made[key] = v;
      setMeter(scene, v);
      fx?.(over, v);
    };
    const loopF = (now) => { raf = requestAnimationFrame(loopF); tick(now); };
    raf = requestAnimationFrame(loopF);
    fx?.(over, base);
    return {
      move(ev) { const now = performance.now(); tick(now); over = ok(at(scene, ev)); sound?.level(over ? 1 : 0); },
      up() {
        cancelAnimationFrame(raf); tick(performance.now()); sound?.stop(); fx?.(false, order.made[key]);
        const v = order.made[key];
        if (v <= base + 0.01) return;   // nothing went in: try again
        finishStep(score(v), v, to);
      },
    };
  }
  const flowEl = () => barEl.querySelector('[data-cf-flow]');
  /** A pour drawn as a stream: from (x, top) down to `bottom`, of this picture. */
  const stream = (on, file, x, top, bottom, w = 2.6) => {
    const f = flowEl(); if (!f) return;
    f.classList.toggle('is-on', on);
    if (!on) return;
    f.style.cssText = `left:${x}%;top:${top}%;height:${Math.max(2.5, bottom - top)}%;width:${w}cqw;background-image:url(${ART}/${file}.webp)`;
  };
  const cupTop = () => (order.cupAt?.y ?? SCALE.y) - CUP_H[order.drink.cup] / ASPECT * 0.85;

  /** Drag a picture on the bar (the portafilter, a carton, the pitcher); `drop(p)` decides where it lands. */
  function drag(scene, el, e, { onMove = null, drop }) {
    el.classList.add('is-held');
    sfx.play('pick-up');
    const startLeft = el.style.left; const startTop = el.style.top;
    const move = (ev) => { const p = at(scene, ev); el.style.left = `${p.x}%`; el.style.top = `${p.y}%`; onMove?.(p); };
    move(e);
    return {
      move,
      up(ev) {
        el.classList.remove('is-held');
        const p = at(scene, ev);
        if (!drop(p)) { el.style.left = startLeft; el.style.top = startTop; sfx.play('put-down', { gain: 0.5 }); }
      },
    };
  }

  barEl.addEventListener('pointerdown', (e) => {
    if (busy || g || !order || e.button > 0) return;
    const s = step(); if (!s) return;
    const p = at(barEl, e);
    const m = order.made;
    const pfEl = barEl.querySelector('[data-cf-pf]');
    if (s.kind === 'grind' && inside(p, GRINDER)) {
      const grounds = barEl.querySelector('[data-cf-grounds]');
      g = hold(barEl, e, 'grind', 'grind', s.to, {
        ok: (q) => inside(q, GRINDER), loop: 'powder-shake',
        fx: (on, v) => { grounds.classList.toggle('is-on', on); if (v > 0.25 && pfEl.src.includes('pf-empty')) pfEl.src = `${ART}/pf-heaped.webp`; },
      });
    } else if (s.kind === 'tamp' && e.target.closest('[data-cf-pf]') && order.pf !== 'mat') {
      g = drag(barEl, pfEl, e, { drop: (q) => {
        if (!inside(q, MAT_ZONE)) return false;
        order.pf = 'mat'; sfx.play('put-down'); drawBar(); return true;
      } });
    } else if (s.kind === 'tamp' && order.pf === 'mat' && inside(p, MAT_ZONE)) {
      const tamper = barEl.querySelector('.cf-tamper');
      g = hold(barEl, e, 'tamp', 'tamp', 0.75, { score: C.scoreTamp, fx: (on, v) => tamper?.style.setProperty('--p', v.toFixed(3)) });
      const up = g.up; g.up = () => { up(); if (order.made.tamp) { sfx.play('seal-press', { gain: 0.6 }); } };
    } else if (s.kind === 'lock' && e.target.closest('[data-cf-pf]')) {
      g = drag(barEl, pfEl, e, { drop: (q) => {
        if (!inside(q, GROUP_ZONE)) return false;
        order.pf = 'group'; order.cupAt = { ...SCALE }; sfx.play('seal-press', { gain: 0.4 }); finishStep(1); drawBar(); return true;
      } });
    } else if (s.kind === 'brew' && inside(p, BREW_ZONE)) {
      g = hold(barEl, e, 'brew', 'brew', s.to, {
        ok: (q) => inside(q, BREW_ZONE), loop: 'glass-pour',
        fx: (on) => stream(on, order.drink.shots === 2 ? 'str-double' : 'str-espresso', GROUP.x, GROUP.y + 2.6, cupTop() + 2, 3),
      });
    } else if (s.kind === 'water' && inside(p, SPOUT.zone)) {
      g = hold(barEl, e, 'water', 'water', s.to, {
        ok: (q) => inside(q, SPOUT.zone), loop: 'glass-pour',
        fx: (on) => stream(on, 'str-water', SPOUT.x, SPOUT.y + 1, cupTop() + 2, 2.4),
      });
    } else if (s.kind === 'carton' && !order.fridge && inside(p, FRIDGE_ZONE)) {
      order.fridge = true; sfx.play('bin-lid', { gain: 0.7 }); haptic('tick'); drawBar();
    } else if (s.kind === 'carton' && e.target.closest('[data-cf-carton]')) {
      const el = e.target.closest('[data-cf-carton]');
      if (el.dataset.cfCarton !== s.milk) { haptic('refuse'); sfx.play('refuse'); pop(barEl, 'wrongMilk'); return; }
      const pitcher = barEl.querySelector('[data-cf-pitcher]');
      const pr = { l: SHELF.x - 9, r: SHELF.x + 9, t: SHELF.y - 22, b: SHELF.y + 2 };
      const base = m.milk; let held = 0; let since = performance.now(); let over = false;
      const sound = sfx.loop('jug-pour', { level: 0 });
      el.classList.add('is-held'); sfx.play('pick-up');
      const tick = () => { const now = performance.now(); if (over) held += (now - since) / 1000; since = now; m.milk = Math.min(1, base + held * RATE.carton); setMeter(barEl, m.milk); };
      let raf = requestAnimationFrame(function f() { raf = requestAnimationFrame(f); tick(); });
      const move = (ev) => {
        tick();
        const q = at(barEl, ev);
        over = inside(q, pr);
        sound.level(over ? 1 : 0);
        // tipped over the pitcher's top, else in the hand
        el.style.left = `${over ? SHELF.x - 6 : q.x}%`; el.style.top = `${over ? SHELF.y - 16 : q.y}%`;
        el.style.setProperty('--rot', over ? '-70deg' : '0deg');
        stream(over, 'str-milk', SHELF.x - 3, SHELF.y - 15, SHELF.y - 8, 2);
        void pitcher;
      };
      move(e);
      g = { move, up() {
        cancelAnimationFrame(raf); tick(); sound.stop(); stream(false);
        el.classList.remove('is-held'); el.style.removeProperty('--rot');
        if (m.milk > base + 0.01) finishStep(C.scoreLevel(m.milk, s.to), m.milk, s.to); else drawBar();
      } };
    } else if ((s.kind === 'steam' || s.kind === 'pour') && e.target.closest('[data-cf-pitcher]')) {
      const el = e.target.closest('[data-cf-pitcher]');
      const steam = barEl.querySelector('[data-cf-steam]');
      const key = s.kind === 'steam' ? 'steam' : 'pour';
      const to = s.kind === 'steam' ? s.to : POUR_TO;
      const zone = s.kind === 'steam' ? WAND.zone : { l: SCALE.x - 14, r: SCALE.x + 14, t: SCALE.y - 26, b: SCALE.y + 4 };
      const base = m[key]; let held = 0; let since = performance.now(); let over = false;
      const sound = sfx.loop(s.kind === 'steam' ? 'powder-trickle' : 'jug-pour', { level: 0 });
      el.classList.add('is-held'); sfx.play('pick-up');
      const tick = () => { const now = performance.now(); if (over) held += (now - since) / 1000; since = now; m[key] = Math.min(1, base + held * RATE[key]); setMeter(barEl, m[key]); };
      let raf = requestAnimationFrame(function f() { raf = requestAnimationFrame(f); tick(); });
      const move = (ev) => {
        tick();
        const q = at(barEl, ev);
        over = inside(q, zone);
        sound.level(over ? 1 : 0);
        if (s.kind === 'steam') {
          // the wand dips into the pitcher: held under it
          el.style.left = `${over ? WAND.x - 1 : q.x}%`; el.style.top = `${over ? WAND.y + 12 : q.y}%`;
          steam.classList.toggle('is-on', over);
        } else {
          el.style.left = `${over ? SCALE.x + 9 : q.x}%`; el.style.top = `${over ? cupTop() + 2 : q.y}%`;
          el.style.setProperty('--rot', over ? '-60deg' : '0deg');
          stream(over, 'str-steamed', SCALE.x + 1, cupTop() - 2, cupTop() + 3, 2.6);
        }
      };
      move(e);
      g = { move, up() {
        cancelAnimationFrame(raf); tick(); sound.stop(); stream(false); steam.classList.remove('is-on');
        el.classList.remove('is-held'); el.style.removeProperty('--rot');
        if (m[key] > base + 0.01) finishStep(C.scoreLevel(m[key], to), m[key], to); else drawBar();
      } };
    }
    if (!g) return;
    e.preventDefault();
    try { barEl.setPointerCapture(e.pointerId); } catch { /* not tracked */ }
  });

  // ---- gestures on the finish: taps for ice, syrup and toppings; the cup swiped up to serve ----
  function fxAt(file, x, y) {
    const f = finishEl.querySelector('[data-cf-fx]');
    if (!f) return;
    f.src = `${ART}/${file}.webp`; f.style.left = `${x}%`; f.style.top = `${y}%`;
    f.classList.remove('is-on'); void f.offsetWidth; f.classList.add('is-on');
  }
  /** The finish's counts so far, against what's asked: the step on the ticket moves on when one's met. */
  function advanceFinish() {
    const m = order.made;
    for (;;) {
      const s = step();
      if (!s || s.kind === 'serve') break;
      const done = s.kind === 'ice' ? m.ice >= s.n : s.kind === 'syrup' ? (m.syrup[s.syrup] || 0) >= s.n : s.kind === 'top' ? m.tops.includes(s.top) : true;
      if (!done) break;
      order.i += 1;
    }
    drawFinish();
  }
  function serve() {
    const m = order.made; const d = order.drink;
    // the finish's steps scored now: what was put in against what was asked
    let extras = 0;
    if (d.ice) order.scores.push(C.scoreCount(m.ice, d.ice)); else if (m.ice) extras += 1;
    for (const [k, n] of Object.entries(d.syrup)) order.scores.push(C.scoreCount(m.syrup[k] || 0, n));
    extras += Object.keys(m.syrup).filter((k) => !d.syrup[k]).length;
    for (const top of d.tops) order.scores.push(m.tops.includes(top) ? 1 : 0);
    extras += m.tops.filter((k) => !d.tops.includes(k)).length;
    const n = C.stars(order.scores, extras);
    const r = C.served(st, order.who.kind === 'boss' ? { kind: 'boss', id: order.who.id } : { kind: 'builder', id: order.who.id }, n, Date.now());
    set(r.saved); coins();
    result = { stars: n, coins: r.coins, cut: r.cut };
    haptic(n === 3 ? 'record' : 'levelUp');
    sfx.play(n === 3 ? 'gel-record' : 'gel-done');
    for (let k = 0; k < n; k++) sfx.play('star', { delay: 0.9 + k * 0.28, rate: 1 + k * 0.12 });
    drawCounter();
    go(0);
    setTimeout(() => customer?.act(n >= 2 ? 'happy' : 'sad'), 500);
  }
  finishEl.addEventListener('pointerdown', (e) => {
    if (busy || g || !order || e.button > 0) return;
    const p = at(finishEl, e);
    const m = order.made;
    const cupEl = e.target.closest('[data-cf-cup]');
    const syrupEl = e.target.closest('[data-cf-syrup]');
    if (cupEl) {
      const startY = p.y;
      cupEl.classList.add('is-held');
      sfx.play('pick-up');
      g = {
        move(ev) { const q = at(finishEl, ev); cupEl.style.left = `${q.x}%`; cupEl.style.top = `${Math.min(COASTER.y, q.y + (COASTER.y - startY))}%`; },
        up(ev) {
          const q = at(finishEl, ev);
          cupEl.classList.remove('is-held');
          if (q.y < HATCH_Y + 10) { cupEl.classList.add('is-served'); busy = true; setTimeout(() => { busy = false; serve(); }, 450); return; }
          cupEl.style.left = `${COASTER.x}%`; cupEl.style.top = `${COASTER.y}%`; sfx.play('put-down');
        },
      };
    } else if (syrupEl) {
      const k = syrupEl.dataset.cfSyrup;
      m.syrup[k] = (m.syrup[k] || 0) + 1;
      syrupEl.classList.remove('is-pump'); void syrupEl.offsetWidth; syrupEl.classList.add('is-pump');
      haptic('select'); sfx.play('caffeine-drop', { rate: 0.8 });
      fxAt('fx-splash', COASTER.x, COASTER.y - 14);
      setTimeout(advanceFinish, 250);
      return;
    } else if (inside(p, ICE)) {
      m.ice += 1; haptic('select'); sfx.play('put-down', { gain: 0.5, rate: 1.3 });
      fxAt('fx-ice', COASTER.x, COASTER.y - 14);
      setTimeout(advanceFinish, 250);
      return;
    } else {
      const top = Object.entries(TOP_ZONES).find(([, z]) => inside(p, z))?.[0];
      if (!top) return;
      if (!m.tops.includes(top)) m.tops.push(top);
      haptic('select'); sfx.play('pouch-pick', { gain: 0.6 });
      fxAt(TOP_FX[top], COASTER.x, COASTER.y - 16);
      setTimeout(advanceFinish, 250);
      return;
    }
    e.preventDefault();
    try { finishEl.setPointerCapture(e.pointerId); } catch { /* not tracked */ }
  });

  for (const el of [barEl, finishEl]) {
    el.addEventListener('pointermove', (e) => { if (g) g.move(e); });
    const end = (e) => { const d = g; g = null; d?.up(e); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  // ---- taps ----
  root.addEventListener('click', (e) => {
    const b = (sel) => e.target.closest(sel);
    if (b('[data-cf-back]')) {
      sfx.play('ui-tap');
      if (screen > 0) { go(screen - 1); return; }
      closeLayer(root); return;
    }
    if (b('[data-cf-sign]')) {
      if (order) { haptic('refuse'); sfx.play('refuse'); return; }   // not with someone at the counter
      set({ open: !st.open }); sfx.play('bin-lid', { gain: 0.6 }); haptic('tick'); result = null; drawCounter(); return;
    }
    const builder = b('[data-cf-builder]');
    if (builder) {
      if (C.builderReady(st, builder.dataset.cfBuilder, Date.now())) { haptic('refuse'); sfx.play('refuse'); return; }
      call({ kind: 'builder', id: builder.dataset.cfBuilder }); return;
    }
    if (b('[data-cf-call]')) { call({ kind: 'boss', id: BOSSES[Math.floor(Math.random() * BOSSES.length)] }); return; }
    if (b('[data-cf-up]')) { sfx.play('ui-tap'); openUpgrade({ target: 'coffee-shop', name: t('coffee.title'), art: shopArt }); return; }
    if (b('[data-cf-make]')) { sfx.play('ui-tap'); drawBar(); drawFinish(); go(1); return; }
    if (b('[data-cf-next]')) {
      sfx.play('ui-tap');
      const leaving = customer?.leave();
      order = null; result = null; drawAll();
      void leaving;
    }
  });
  // a builder finished (or started) on the shop: its level in the bar, and its menu
  const onBuilds = () => {
    if (!root.isConnected) { document.removeEventListener('builds-changed', onBuilds); return; }
    if (pinned) return;
    const n = shopLevel();
    if (n === st.level) return;
    st.level = n;
    root.querySelector('[data-cf-lvl]').textContent = t('coffee.level', { n });
    if (!order) drawAll();
  };
  document.addEventListener('builds-changed', onBuilds);

  go(0);
  drawAll();
  return root;
}

