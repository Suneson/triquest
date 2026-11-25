// coffee-view.js: the coffee shop's window (js/core/coffee-shop.js, MOSKE APP/Island/COFFEE-SHOP.md).
// Three portrait screens side by side, slid between: the counter (who's in, what they want, the open/closed
// sign), the bar (grind, tamp, lock in, brew; milk: fridge, pitcher, steam wand) and the finish (ice, syrup,
// toppings, then the cup swiped up into the hatch). Each screen is one scene on its painted background
// (icons/Coffee/bg-*.webp, 900 x 1600): everything in it is placed in % of the scene, sized in cqw of it.
// v1 for testing: coins and builder bonuses are kept on this device (settings.coffeeShop).

import { openUpgrade, buildingLevel, buildingJob, underUpgrade } from './upgrade-sheet.js';
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
const TAMPER_REST = { x: 8.5, y: 62.5 };              // the tamper waits on the mat's left end
const GROUP = { x: 66, y: 39.8 };                     // locked in the group head
const GROUP_ZONE = { l: 52, r: 82, t: 33, b: 50 };
const SCALE = { x: 66.3, y: 47.8 };                   // the cup on the drip tray's scale (its foot)
const SPOUT = { x: 49.4, y: 41, zone: { l: 44, r: 56, t: 35, b: 46 } };   // hot water
const WAND = { x: 85.5, y: 47.5, zone: { l: 76, r: 96, t: 42, b: 62 } };
const FRIDGE = { l: 1.3, t: 71.79, w: 49.61 };       // patch-fridge-milks.webp: shut, the milks seen through the glass (it hides the open door painted on the bar)
const FRIDGE_BOX = { l: 16.43, t: 72.67, w: 33.15, h: 21.15 };   // the fridge itself in it: where its hint outline goes
const FRIDGE_ZONE = { l: 2, r: 48, t: 72, b: 99 };
const CARTONS = { milk: { x: 27.77, y: 80.55 }, oat: { x: 37.99, y: 80.51 } };   // as painted on the fridge's upper shelf (carton-*.webp)
const PF_LOCKED = { l: 50, t: 39.08, w: 22.01 };    // pf-locked.webp, cut from the bar with the portafilter in
const SHELF = { x: 77, y: 82.6 };                     // the pitcher's place, pushed back on its shelf
const HOLD_BTN = { x: 20.5, y: 44 };                  // the grinder's Hold button
const LENS = { x: 25, y: 30 };                        // the close look at the basket filling
const BREW_BTN = { x: 66, y: 33.6 };                  // the machine's green button, on its gauge
const TEACH = 3;                                      // a drink's first makes show the hand
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
// where the coffee shows in each cup, in % of its picture: a cup's opening (o: middle x, y, half width, half height),
// or a glass's inside (g: top y, bottom y, then the left and right edges at the top and at the bottom)
const FILL = { 'cup-espresso': { o: [50, 17, 25, 10] }, 'cup-cappuccino': { o: [50, 21, 30, 11] }, mug: { o: [39, 21, 30, 11] },
  'glass-latte': { g: [8, 79, 7, 93, 20, 80] }, 'glass-iced': { g: [8, 86, 6, 95, 19, 81] }, 'glass-coupe': { g: [10, 46, 5, 95, 33, 67] } };
const AR = { 'cup-espresso': 386 / 320, 'cup-cappuccino': 418 / 320, mug: 335 / 320, 'glass-latte': 181 / 320, 'glass-iced': 197 / 320, 'glass-coupe': 277 / 320 };   // the cups' pictures, width / height
const CUP_H = { 'cup-espresso': 9, 'cup-cappuccino': 10, mug: 12, 'glass-latte': 17, 'glass-iced': 17, 'glass-coupe': 13 };
const STEP_ICON = { grind: 'step-grind', tamp: 'step-tamp', lock: 'step-lock', brew: 'step-brew', water: 'step-brew', carton: 'step-milk',
  steam: 'step-steam', pour: 'step-art', ice: 'step-ice', syrup: 'step-syrup', serve: 'step-serve' };
const TOP_ICON = { cream: 'step-cream', cocoa: 'step-dust', cinnamon: 'step-dust', icecream: 'ice-cream' };
const TOP_FX = { cream: 'fx-billow', cocoa: 'fx-cocoa', cinnamon: 'fx-cocoa', icecream: 'fx-splash' };

// how fast a held thing fills, per second (0-1)
const RATE = { grind: 0.36, tamp: 0.55, brew: 0.22, water: 0.3, carton: 0.3, steam: 0.27, pour: 0.38 };
const TAMP_HOLD = 1000;   // ms the tamper is held pressed down: no skill check, just a firm press
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
  if (!level && underUpgrade('coffee-shop', t('coffee.title'))) return null;   // closed while a builder's on it
  let customer = null;   // coffee3d.js, once mounted
  const root = openLayer('coffee-shop', { className: 'cf-layer', onClose: () => { if (brewing) { cancelAnimationFrame(brewing.raf); brewing.sound.stop(); brewing = null; } sfx.stopMusic(); customer?.dispose(); customer = null; } });
  let st = load();
  const pinned = !!level;   // ?coffee=1&lvl=: shown at that level, no upgrading
  if (level) st.level = Math.max(1, Math.min(C.MAX_LEVEL, Math.floor(level) || 1));
  const set = (patch) => { st = { ...st, ...patch }; save(st); };
  sfx.warmUp(); sfx.startMusic('coffee-theme');

  let screen = 0;        // 0 counter, 1 bar, 2 finish
  let order = null;      // { who: { kind, id }, drink, steps, i, scores, extras, done, made:{...} }
  let result = null;     // { stars, coins, cut }
  let busy = false;
  let g = null;          // the gesture going on: { move, up }
  let brewing = null;    // the shot running from the green button: { raf, sound, since, to }

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
    sfx.play('cafe-bell');
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
  const setMeter = (scene, v) => {
    scene.querySelector('.cf-meter')?.style.setProperty('--v', Math.min(1, v).toFixed(4));
    scene.querySelector('[data-cf-fill]')?.style.setProperty('--lv', fillLevel().toFixed(3));
  };
  /** How full the cup on the bar looks (0-1 of its height): the shot, then the water or milk on top. */
  function fillLevel() {
    if (!order) return 0;
    const m = order.made; const d = order.drink;
    const shot = d.milk || d.water ? 0.32 : 0.8;
    return Math.min(0.85, m.brew * shot + (m.water || 0) * 0.5);
  }
  const fillColour = () => '#4A2412';
  /** The cup's fill shape as CSS variables (data-shape o: a cup's opening seen from above; g: a glass's inside). */
  function fillVars(cup) {
    const f = FILL[cup]; if (!f) return 'display:none';
    const ar = `--ar:${AR[cup]};`;
    if (f.o) { const [cx, cy, rx, ry] = f.o; return `${ar}--cx:${cx}%;--cy:${cy}%;--rx:${rx}%;--ry:${ry}%`; }
    const [t, b, tl, tr, bl, br] = f.g;
    return `${ar}--t:${t};--b:${b};clip-path:polygon(${tl}% ${t}%,${tr}% ${t}%,${br}% ${b}%,${bl}% ${b}%)`;
  }

  // ---- the hand that shows what to do: the first TEACH times you make each drink ----
  const teaching = () => order && (Number(st.taught?.[order.drink.id]) || 0) < TEACH;
  /** Where the hand goes for the step now: { at } a tap or hold there, or { from, to } a drag. */
  function guideFor(s) {
    switch (s?.kind) {
      case 'grind': return { at: HOLD_BTN, hold: true };
      case 'tamp': return order.pf === 'mat' ? { from: { x: TAMPER_REST.x, y: TAMPER_REST.y - 6 }, to: { x: MAT.x, y: MAT.y - 2 } } : { from: UNDER_GRINDER, to: MAT };
      case 'lock': return { from: MAT, to: GROUP };
      case 'brew': return { at: BREW_BTN };
      case 'water': return { at: { x: SPOUT.x, y: SPOUT.y + 2 }, hold: true };
      case 'carton': {
        const c = CARTONS[s.milk || 'milk'];
        return order.fridge ? { from: { x: c.x, y: c.y - 4 }, to: { x: SHELF.x, y: SHELF.y - 12 } } : { at: { x: 25, y: 84 } };
      }
      case 'steam': return { from: { x: SHELF.x, y: SHELF.y - 6 }, to: { x: WAND.x, y: WAND.y + 6 } };
      case 'pour': return { from: { x: SHELF.x, y: SHELF.y - 6 }, to: { x: SCALE.x + 6, y: SCALE.y - 8 } };
      case 'ice': return { at: { x: (ICE.l + ICE.r) / 2, y: (ICE.t + ICE.b) / 2 } };
      case 'syrup': return { at: { x: SYRUP_X[C.SYRUPS.indexOf(s.syrup)], y: 38 } };
      case 'top': { const z = TOP_ZONES[s.top]; return { at: { x: (z.l + z.r) / 2, y: (z.t + z.b) / 2 } }; }
      case 'serve': return { from: { x: COASTER.x, y: COASTER.y - 6 }, to: { x: COASTER.x, y: HATCH_Y } };
      default: return null;
    }
  }
  const HAND = `<svg class="cf-hand" viewBox="0 0 64 64" aria-hidden="true"><path d="M24 6c3.3 0 6 2.7 6 6v15.5l2.6-.9c2.7-.9 5.6.5 6.6 3.1l.3.8 1.6-.5c2.7-.8 5.6.6 6.5 3.3l.3.9 1.2-.3c2.8-.6 5.5 1.2 6.1 4l2.3 11c1.7 8.2-3.6 16.2-11.8 17.8l-6.6 1.3c-6 1.2-12.2-1.3-15.7-6.4L10.8 41c-1.6-2.4-1-5.6 1.4-7.2 2.2-1.5 5.2-1 6.8 1.1l.9 1.2V12c0-3.3 2.7-6 6-6z" fill="#FFF8EE" stroke="#5A3A22" stroke-width="3" stroke-linejoin="round"/></svg>`;
  function guide() {
    if (!teaching()) return '';
    const gd = guideFor(step());
    if (!gd) return '';
    if (gd.at) return `<div class="cf-guide is-tap${gd.hold ? ' is-hold' : ''}" style="--x1:${gd.at.x}%;--y1:${gd.at.y}%" aria-hidden="true"><i class="cf-guide-ring"></i>${HAND}</div>`;
    const { from: a, to: b } = gd;
    return `<div class="cf-guide is-drag" style="--x0:${a.x}%;--y0:${a.y}%;--x1:${b.x}%;--y1:${b.y}%" aria-hidden="true">
      <svg class="cf-guide-line" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" vector-effect="non-scaling-stroke"/></svg>${HAND}</div>`;
  }

  // ---- the bar ----
  function drawBar() {
    if (!order) { barEl.innerHTML = ''; return; }
    const s = step();
    const d = order.drink;
    const m = order.made;
    const kind = s?.kind;
    const meterHtml = kind === 'grind' ? meter(m.grind, s.to) : kind === 'tamp' ? ''
      : kind === 'brew' ? meter(m.brew, s.to) : kind === 'water' ? meter(m.water, s.to)
        : kind === 'carton' ? meter(m.milk, s.to) : kind === 'steam' ? meter(m.steam, s.to) : kind === 'pour' ? meter(m.pour, POUR_TO) : '';
    const pfFile = m.tamp ? 'pf-tamped' : m.grind > 0.25 ? 'pf-heaped' : 'pf-empty';
    const pfAt = order.pf === 'group' ? GROUP : order.pf === 'mat' ? MAT : UNDER_GRINDER;
    const cupFile = m.pour ? `drink-${d.id}` : d.cup;
    const cupH = m.pour ? CUP_H[d.cup] * 1.25 : CUP_H[d.cup];
    const cup = order.cupAt ? `<img class="cf-cup" data-cf-cup src="${ART}/${cupFile}.webp" alt="" draggable="false"
      style="left:${order.cupAt.x}%;top:${order.cupAt.y}%;height:${cupH}cqw">${m.pour ? '' : `<i class="cf-fill" data-cf-fill data-shape="${FILL[d.cup]?.o ? 'o' : 'g'}" style="left:${order.cupAt.x}%;top:${order.cupAt.y}%;height:${cupH}cqw;
      ${fillVars(d.cup)};--lv:${fillLevel().toFixed(3)};--c:${fillColour()}"></i>`}` : '';
    const pitcherFile = m.steam ? 'pitcher-steamed' : 'pitcher';
    // the grind: a close look at the basket, the grounds rising to the dashed line, and the Hold button
    const grindUi = kind === 'grind' ? `<div class="cf-lens" style="left:${LENS.x}%;top:${LENS.y}%;--f:${(m.grind / s.to).toFixed(3)}" aria-hidden="true">
        <span class="cf-lens-in">${img('lens-basket', 'cf-lens-pf')}${img('lens-mound', 'cf-lens-mound')}<i class="cf-lens-line"></i></span>${img('lens-ring', 'cf-lens-ring')}</div>
      <button class="cf-holdbtn is-hint" data-cf-hold style="left:${HOLD_BTN.x}%;top:${HOLD_BTN.y}%">${esc(t('coffee.hold'))}</button>` : '';
    const brewUi = kind === 'brew' ? `<button class="cf-brewbtn${brewing ? ' is-on' : ' is-hint'}" data-cf-brew style="left:${BREW_BTN.x}%;top:${BREW_BTN.y}%"
        aria-label="${esc(t(brewing ? 'coffee.brewStop' : 'coffee.brewStart'))}" aria-pressed="${!!brewing}"><i></i></button>` : '';
    const hintPf = (kind === 'tamp' && order.pf !== 'mat') || kind === 'lock';
    barEl.innerHTML = `${ticket()}${meterHtml}
      ${order.fridge ? '' : img('patch-fridge-milks', 'cf-fridge', `left:${FRIDGE.l}%;top:${FRIDGE.t}%;width:${FRIDGE.w}%`)}
      ${!order.fridge && kind === 'carton' ? `<i class="cf-fridge-hint" style="left:${FRIDGE_BOX.l}%;top:${FRIDGE_BOX.t}%;width:${FRIDGE_BOX.w}%;height:${FRIDGE_BOX.h}%"></i>` : ''}
      ${order.fridge ? Object.entries(CARTONS).map(([k, p]) => img(`carton-${k}`, `cf-carton${s?.milk === k ? ' is-now is-hint' : ''}`, `left:${p.x}%;top:${p.y}%`).replace('<img', `<img data-cf-carton="${k}"`)).join('') : ''}
      ${grindUi}${brewUi}
      ${order.pf === 'group' ? img('pf-locked', 'cf-pf-locked', `left:${PF_LOCKED.l}%;top:${PF_LOCKED.t}%;width:${PF_LOCKED.w}%`) : ''}
      <img class="cf-pf${order.pf === 'group' ? ' is-locked' : ''}${hintPf ? ' is-hint' : ''}" data-cf-pf src="${ART}/${pfFile}.webp" alt="" draggable="false" style="left:${pfAt.x}%;top:${pfAt.y}%">
      ${kind === 'tamp' && order.pf === 'mat' ? `<img class="cf-tamper is-hint" data-cf-tamper src="${ART}/tamper.webp" alt="" draggable="false" style="left:${TAMPER_REST.x}%;top:${TAMPER_REST.y}%;--p:0">` : ''}
      ${cup}
      ${d.milk ? `<img class="cf-pitcher${kind === 'steam' || kind === 'pour' ? ' is-hint' : ''}" data-cf-pitcher src="${ART}/${pitcherFile}.webp" alt="" draggable="false" style="left:${SHELF.x}%;top:${SHELF.y}%">` : ''}
      <i class="cf-flow" data-cf-flow></i>
      <img class="cf-steam" data-cf-steam src="${ART}/fx-billow.webp" alt="">
      <img class="cf-grounds" data-cf-grounds src="${ART}/fx-grounds.webp" alt="">
      ${guide()}
      <div class="cf-pop" aria-live="polite"></div>`;
  }

  // ---- the finish ----
  function drawFinish() {
    if (!order) { finishEl.innerHTML = ''; return; }
    const d = order.drink;
    const m = order.made;
    finishEl.innerHTML = `${ticket()}
      ${C.SYRUPS.map((sy, i) => `<img class="cf-syrup${step()?.syrup === sy ? ' is-now is-hint' : ''}" data-cf-syrup="${sy}" src="${ART}/syrup-${sy}.webp" alt="${esc(t(`coffee.syrup.${sy}`))}" draggable="false" style="left:${SYRUP_X[i]}%">`).join('')}
      <img class="cf-cup is-final${step()?.kind === 'serve' ? ' is-hint' : ''}" data-cf-cup src="${ART}/drink-${d.id}.webp" alt="${esc(drinkName(d))}" draggable="false" style="left:${COASTER.x}%;top:${COASTER.y}%;height:${CUP_H[d.cup] * 1.25}cqw">
      <div class="cf-made">${m.ice ? `<i>${img('ice')}${m.ice}</i>` : ''}${Object.entries(m.syrup).map(([k, n]) => `<i>${img(`syrup-${k}`)}${n}</i>`).join('')}${m.tops.map((k) => `<i>${img(TOP_ICON[k])}</i>`).join('')}</div>
      <img class="cf-fx" data-cf-fx src="${ART}/fx-sparkle.webp" alt="">
      <p class="cf-serve-hint">${img('step-serve')}${esc(t('coffee.swipeUp'))}</p>
      ${guide()}
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
    if (step().kind !== 'lock' && step().kind !== 'tamp') pop(scene, C.verdict(score, value, to));
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

  // the brew: one tap on the green button starts the shot, it runs by itself, and a second tap stops it
  function startBrew(s) {
    const m = order.made;
    const btn = barEl.querySelector('[data-cf-brew]');
    btn?.classList.add('is-on'); btn?.classList.remove('is-hint'); btn?.setAttribute('aria-pressed', 'true');
    btn?.setAttribute('aria-label', t('coffee.brewStop'));
    barEl.querySelector('.cf-guide')?.remove();
    haptic('select'); sfx.play('brew-button');
    const sound = sfx.loop('espresso-pour', { level: 1 });
    stream(true, order.drink.shots === 2 ? 'str-double' : 'str-espresso', GROUP.x, GROUP.y + 2.6, cupTop() + 2, 3);
    brewing = { sound, since: performance.now(), raf: 0, to: s.to };
    const f = (now) => {
      if (!brewing) return;
      m.brew = Math.min(1, m.brew + Math.max(0, now - brewing.since) / 1000 * RATE.brew);
      brewing.since = now;
      setMeter(barEl, m.brew);
      if (m.brew >= 1) { stopBrew(); return; }   // the cup's full: it stops itself
      brewing.raf = requestAnimationFrame(f);
    };
    brewing.raf = requestAnimationFrame(f);
  }
  function stopBrew() {
    if (!brewing) return;
    const b = brewing; brewing = null;
    cancelAnimationFrame(b.raf); b.sound.stop(); stream(false); sfx.play('brew-stop');
    // the time since the last frame counts too (time-based, so a slow or paused frame can't cheat it)
    order.made.brew = Math.min(1, order.made.brew + Math.max(0, performance.now() - b.since) / 1000 * RATE.brew);
    haptic('select');
    const v = order.made.brew;
    if (v > 0.01) finishStep(C.scoreLevel(v, b.to), v, b.to); else drawBar();
  }

  barEl.addEventListener('pointerdown', (e) => {
    if (busy || g || !order || e.button > 0) return;
    const s = step(); if (!s) return;
    const p = at(barEl, e);
    const m = order.made;
    const pfEl = barEl.querySelector('[data-cf-pf]');
    if (s.kind === 'grind' && (e.target.closest('[data-cf-hold]') || inside(p, GRINDER))) {
      const grounds = barEl.querySelector('[data-cf-grounds]');
      const lens = barEl.querySelector('.cf-lens'); const btn = barEl.querySelector('[data-cf-hold]');
      btn?.classList.add('is-down'); sfx.play('grinder-start');
      // held anywhere once started: a finger sliding off the button doesn't stop it
      g = hold(barEl, e, 'grind', 'grind', s.to, {
        loop: 'grinder-whirr',
        fx: (on, v) => {
          grounds.classList.toggle('is-on', on);
          lens?.style.setProperty('--f', (v / s.to).toFixed(3));
          if (v > 0.25 && pfEl.src.includes('pf-empty')) pfEl.src = `${ART}/pf-heaped.webp`;
        },
      });
      const up = g.up; g.up = () => { btn?.classList.remove('is-down'); up(); };
    } else if (s.kind === 'tamp' && e.target.closest('[data-cf-pf]') && order.pf !== 'mat') {
      g = drag(barEl, pfEl, e, { drop: (q) => {
        if (!inside(q, MAT_ZONE)) return false;
        order.pf = 'mat'; sfx.play('pf-knock'); drawBar(); return true;
      } });
    } else if (s.kind === 'tamp' && order.pf === 'mat' && e.target.closest('[data-cf-tamper]')) {
      // pick the tamper up, bring it over the basket, and push it down: how far you push is how hard you tamp
      const el = e.target.closest('[data-cf-tamper]');
      const basket = { l: MAT.x - 9, r: MAT.x + 9, t: MAT.y - 16, b: MAT.y + 8 };
      let over = false; let since = 0; let raf = 0; let done = false;
      el.classList.add('is-held'); sfx.play('pick-up');
      const press = (now) => {
        const k = Math.min(1, (now - since) / TAMP_HOLD);
        el.style.setProperty('--p', (k * k * (3 - 2 * k)).toFixed(3));
        if (k >= 1 && !done) {
          done = true; m.tamp = 1; haptic('place');
          g = null; barEl.classList.remove('is-acting');   // the hold is done: the finger lifting later does nothing
          el.classList.remove('is-held');
          finishStep(1);
          return;
        }
        raf = requestAnimationFrame(press);
      };
      const move = (ev) => {
        if (done) return;
        const q = at(barEl, ev);
        const nowOver = inside(q, basket);
        if (nowOver && !over) { since = performance.now(); sfx.play('tamp-press'); haptic('select'); raf = requestAnimationFrame(press); }
        if (!nowOver && over) { cancelAnimationFrame(raf); }
        over = nowOver;
        if (over) { el.style.left = `${MAT.x}%`; el.style.top = `${MAT.y}%`; } else {
          el.style.left = `${q.x}%`; el.style.top = `${q.y + 4}%`; el.style.setProperty('--p', '0');
        }
      };
      move(e);
      g = { move, up() {
        cancelAnimationFrame(raf);
        if (done) return;
        // let go too soon (or off the coffee): it goes back, and you press again
        if (over && performance.now() - since >= TAMP_HOLD) { done = true; m.tamp = 1; el.classList.remove('is-held'); finishStep(1); return; }
        el.classList.remove('is-held');
        el.style.left = `${TAMPER_REST.x}%`; el.style.top = `${TAMPER_REST.y}%`; el.style.setProperty('--p', '0');
        sfx.play('put-down', { gain: 0.5 });
      } };
    } else if (s.kind === 'lock' && e.target.closest('[data-cf-pf]')) {
      g = drag(barEl, pfEl, e, { drop: (q) => {
        if (!inside(q, GROUP_ZONE)) return false;
        order.pf = 'group'; order.cupAt = { ...SCALE }; sfx.play('pf-lock'); finishStep(1); drawBar(); return true;
      } });
    } else if (s.kind === 'brew' && e.target.closest('[data-cf-brew]')) {
      e.preventDefault();
      if (brewing) stopBrew(); else startBrew(s);
      return;
    } else if (s.kind === 'water' && inside(p, SPOUT.zone)) {
      g = hold(barEl, e, 'water', 'water', s.to, {
        ok: (q) => inside(q, SPOUT.zone), loop: 'hot-water',
        fx: (on) => stream(on, 'str-water', SPOUT.x, SPOUT.y + 1, cupTop() + 2, 2.4),
      });
    } else if (s.kind === 'carton' && !order.fridge && inside(p, FRIDGE_ZONE)) {
      order.fridge = true; sfx.play('fridge-open'); haptic('tick'); drawBar();
    } else if (s.kind === 'carton' && e.target.closest('[data-cf-carton]')) {
      const el = e.target.closest('[data-cf-carton]');
      if (el.dataset.cfCarton !== s.milk) { haptic('refuse'); sfx.play('refuse'); pop(barEl, 'wrongMilk'); return; }
      const pitcher = barEl.querySelector('[data-cf-pitcher]');
      const pr = { l: SHELF.x - 9, r: SHELF.x + 9, t: SHELF.y - 22, b: SHELF.y + 2 };
      const base = m.milk; let held = 0; let since = performance.now(); let over = false;
      const sound = sfx.loop('milk-pour', { level: 0 });
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
      const sound = sfx.loop(s.kind === 'steam' ? 'steam-wand' : 'latte-pour', { level: 0 });
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
    barEl.classList.add('is-acting');
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
    const taught = { ...(st.taught || {}) }; taught[d.id] = (Number(taught[d.id]) || 0) + 1;
    set({ taught });
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
          if (q.y < HATCH_Y + 10) { cupEl.classList.add('is-served'); sfx.play('serve-hatch'); busy = true; setTimeout(() => { busy = false; serve(); }, 450); return; }
          cupEl.style.left = `${COASTER.x}%`; cupEl.style.top = `${COASTER.y}%`; sfx.play('cup-down');
        },
      };
    } else if (syrupEl) {
      const k = syrupEl.dataset.cfSyrup;
      m.syrup[k] = (m.syrup[k] || 0) + 1;
      syrupEl.classList.remove('is-pump'); void syrupEl.offsetWidth; syrupEl.classList.add('is-pump');
      haptic('select'); sfx.play('syrup-pump');
      fxAt('fx-splash', COASTER.x, COASTER.y - 14);
      setTimeout(advanceFinish, 250);
      return;
    } else if (inside(p, ICE)) {
      m.ice += 1; haptic('select'); sfx.play('ice-drop');
      fxAt('fx-ice', COASTER.x, COASTER.y - 14);
      setTimeout(advanceFinish, 250);
      return;
    } else {
      const top = Object.entries(TOP_ZONES).find(([, z]) => inside(p, z))?.[0];
      if (!top) return;
      if (!m.tops.includes(top)) m.tops.push(top);
      haptic('select'); sfx.play(top === 'cream' ? 'cream-whip' : top === 'icecream' ? 'cup-down' : 'cocoa-dust');
      fxAt(TOP_FX[top], COASTER.x, COASTER.y - 16);
      setTimeout(advanceFinish, 250);
      return;
    }
    e.preventDefault();
    finishEl.classList.add('is-acting');
    try { finishEl.setPointerCapture(e.pointerId); } catch { /* not tracked */ }
  });

  for (const el of [barEl, finishEl]) {
    el.addEventListener('pointermove', (e) => { if (g) g.move(e); });
    const end = (e) => { const d = g; g = null; el.classList.remove('is-acting'); d?.up(e); };
    // a long press on a picture mustn't open the phone's image menu (it cancelled the hold)
    el.addEventListener('contextmenu', (e) => e.preventDefault());
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
    if (buildingJob('coffee-shop')) { closeLayer(root); return; }   // an upgrade started: the shop closes
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

