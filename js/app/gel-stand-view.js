// gel-stand-view.js — the gel stand's screens (docs/KITCHEN.md, "The gel stand"): the menu of final gels,
// then the prep view, then the result. The rules are js/core/gel-stand.js.
//
// The prep view is one scene on the stand's background (icons/Gels/prep-bg-v9.webp), made for one thumb, with
// every tool on show: the recipe and what to do now on the wall screen at the very top; the tap jars of
// liquids on the shelf under it; the measuring glass, the jug and the pouch on the counter, with the bin built
// into it; the tools on the hooks of the counter's front (the sealer, the whisk, the dropper, the scissors);
// the tray of powders, caffeine vials and the box of empty pouches painted into the picture below. A tray
// that runs out shows its empty picture (patch9-*.webp, cut from the same picture painted empty), and the bin's
// lid opens (patch9-bin-open) when something's brought to it. The buttons float over the tray only when
// there's one to press. Everything is dragged: the glass under a jar's tap to its line, then over the jug to
// pour it in (or over the bin to tip it out); a scoop from a tray over the jug, shaken; the dropper over the
// jug; the whisk round it; a pouch from the box onto the counter; the jug over the pouch; the sealer across
// the pouch's top. Letting go ends a step: it's judged and the next one starts. Before starting, a tap on a
// jar restocks it, a tap on a powder brings its bag up big to snip open with the scissors; cut, it flies to
// its tray and pours itself in, filling the bar as far as the carbs pay (fill()). The liquids are drawn
// over their pictures (multiply), so lines and shine show through.
//
// The stock and the bag of gels are kept on this device (settings.gelStand) until the server side exists. The
// carbs are the player's own (the wallet), less what the stand has spent here (settings.gelStand.spent, taken
// off the wallet by gear-state.js); with no wallet (signed out, ?gels=1 on its own) the stand has its own 600.

import { openLayer, closeLayer } from './nav.js';
import { esc } from './ui.js';
import { t } from '../core/i18n.js';
import { haptic } from './haptics.js';
import * as sfx from './gel-sounds.js';
import * as store from './store.js';
import * as G from '../core/gel-stand.js';
import { gearEnabled, walletNow, myBuilds, serverNow } from './gear-state.js';
import { openUpgrade, buildingLevel, buildingJob, timeLeft, underUpgrade } from './upgrade-sheet.js';
import { nextLevel } from '../core/jobs.js';

const ART = 'icons/Gels';
const KEY = 'gelStand';
const PREVIEW_CARBS = 600;
const COIN = 'icons/Pixelart/GEAR/coin.png';
const FILL_RATE = 0.32;   // pouch per second while the jug's held over it
const TAP_RATE = 2.5;     // glass per second under a tap: full in 0.4 s
const GLASS_CAP = 0.75;   // a full glass is this much of the jug
const GLASS_POUR_MS = 650;   // the glass tips out in the bin in this long
const GLASS_FLOW = 0.2;   // glass per second while it's tipped over the jug (slow: stop at the line)
const HOLD_RATE = 0.07;   // jug level per second while a scoop is just held over the jug (shaking adds more)
const SALT_HOLD = 0.1;    // the salt meter per second, held
const SHAKE_K = 0.0045;   // jug level per 1% of the scene's width shaken (maltodextrin, fructose)
const SALT_K = 0.007;     // the salt meter per 1% shaken
const DROP_MS = 630;      // a caffeine drop this often while the dropper's over the jug
const DROP_FIRST = 330;   // and the first this soon after it gets there
const STEP_BEAT = 450;    // a step's pop shows this long, then the next step
const STOCK_BAR = 4;      // a stock bar: four to a refill
const SNIP_CUT = 0.72;    // how much of a bag's top the scissors must cross to cut it
const BAG_LINE = 0.143;   // the bag's dashed cut line, down its picture (bag-*.webp: the foil strip above it)
const BAR_MS = 300;       // a bar fills this often while the bag pours
const ASPECT = 2752 / 1536;   // the scene's height over its width: 1% of its height is this many % of its width
const LIQUID = new Set(['water', 'honey', 'maple', 'beet']);
/** The shelf, left to right (its jars stand on it, % across). */
const JARS = ['water', 'honey', 'maple', 'beet'];
const SHELF_X = { water: 17, honey: 39, maple: 61, beet: 83 };
const JAR_W = 12;                          // a jar's width, % of the scene's
const JAR_H = JAR_W * 420 / 280 / ASPECT;  // and its height, % of the scene's (jar-*.webp is 280 x 420)
const JAR_TOP = 34.4 - JAR_H;              // they stand on the shelf's top
/** The tray's places painted into the picture, % of the scene (each its empty patch's box, cut-gels.py --v9). */
const TRAYS = {
  malto: { l: 11.65, t: 70.49, w: 27.02, h: 9.19 },
  fructose: { l: 38.67, t: 70.49, w: 22.66, h: 8.9 },
  salt: { l: 61.85, t: 70.49, w: 22.79, h: 9.19 },
  caffeine: { l: 9.77, t: 79.69, w: 25.91, h: 10.97 },
};
const POWDERS = ['malto', 'fructose', 'salt'];   // restocked from a bag in their colour, snipped open
const BOX = { l: 62, t: 78, w: 26.5, h: 12 };     // the box of empty pouches
const BIN = { l: 71.5, r: 99, t: 44, b: 52 };            // the bin's lid, flush in the counter
const BIN_HIT = { l: 92, r: 99, t: 48, b: 52.5 };        // a small square in the lid's far corner opens it (rarely wanted)
/** The tools hanging from the hooks of the counter's front: % across, their picture's height in cqw, turned
 *  (the long ones hang down, handle up). The scoop's only for show. */
const HOOKS = {
  sealer: { x: 21.8, w: 6.1, rot: -90, art: 'sealer-open' },
  whisk: { x: 35.8, w: 12, rot: 0, art: 'tool-whisk' },
  dropper: { x: 50, w: 12, rot: 0, art: 'tool-dropper' },
  scissors: { x: 64, w: 5.2, rot: -90, art: 'scissors-closed' },
  scoop: { x: 78, w: 4.4, rot: -90, art: 'tool-scoop' },
};
const POUCH_AT = { x: 30, y: 48.8 };       // the pouch's place on the counter (its middle), left of the jug
/** What you hold: a scoop of each powder, the dropper. */
const HELD = { salt: 'scoop-salt', malto: 'scoop-malto', fructose: 'scoop-fructose', caffeine: 'tool-dropper' };
/** What falls from it. */
const STREAM = { water: 'stream-water', honey: 'stream-honey', maple: 'stream-maple', beet: 'stream-beet', malto: 'stream-powder',
  fructose: 'stream-powder', salt: 'stream-salt', caffeine: 'stream-drops' };

const num = (v, d) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const load = () => {
  const s = settled();
  return { ...G.normalise(s), carbs: carbsOf(s), spent: num(s.spent, 0), previewCarbs: num(s.carbs, PREVIEW_CARBS), level: buildingLevel('gel-stand'), build: buildingJob('gel-stand') };
};
/** The carbs to spend: the wallet's (already less what the stand spent), or the stand's own without one. */
const carbsOf = (s) => (gearEnabled() ? walletNow(store.getWorkouts()).carbs : num(s.carbs, PREVIEW_CARBS));
const save = (s) => store.setSetting(KEY, { stock: s.stock, bag: s.bag, carbs: s.previewCarbs, spent: s.spent });
/** "1 h 52 min", "4 min 10 s". */
const hm = (ms) => {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return h ? t('gels.hm', { h, m }) : t('gels.ms', { m, s: s % 60 });
};

/** What's saved. (Its level comes from the builders' jobs, jobs.js.) */
const settled = () => store.getSettings()[KEY] || {};

/** The stand's level (1-6), as the base draws it. */
export const standLevel = () => buildingLevel('gel-stand');
/** The builder's job on the stand: { to, left, who } (ms left), or null. */
export const standBuild = () => buildingJob('gel-stand');

const img = (src, cls = '') => `<img class="${cls}" src="${src}" alt="" draggable="false">`;
const gimg = (file, cls = '') => img(`${ART}/${file}.webp`, cls);
const pct = (bp) => Math.round(bp / 100);
const gelName = (g) => t(`gels.name.${g.id}`);
const ingName = (id) => t(`gels.ing.${id}`);
const standArt = (level) => `icons/Items/gel-stand-t${Math.max(1, Math.min(G.MAX_LEVEL, level))}-a.webp`;

const starsHtml = (n) => `<span class="gs-stars" role="img" aria-label="${esc(t('gels.starsAria', { n }))}">${
  [1, 2, 3].map((i) => `<i style="--i:${i}">${gimg(i <= n ? 'ui-star' : 'ui-star-empty')}</i>`).join('')}</span>`;

/**
 * The gel stand's window.
 * @param {{ level?: number }} opts  show it at this level (the ?gels=1&lvl= preview); else the stand's own
 */
export function openGelStand({ level = null } = {}) {
  if (!level && underUpgrade('gel-stand', t('gels.title'))) return null;   // closed while a builder's on it
  const root = openLayer('gel-stand', { className: 'gs-layer', onClose: sfx.stopMusic });
  sfx.warmUp(); sfx.startMusic();
  let st = load();
  const pinned = !!level;   // ?gels=1&lvl=: shown at that level, no upgrading
  level = level ? Math.max(1, Math.min(G.MAX_LEVEL, Math.floor(level) || 1)) : st.level;
  let gel = null;          // the gel picked
  let run = null;          // making it: { i, below, scores, layers, mix, fill, salt, drops, stirAcc, stirT0, glass, glassC, pouch }
  let result = null;       // { stars, bp }
  let busy = false;        // a step's pop is showing
  let dumped = false;      // the jug was just tipped in the bin
  let snipping = null;     // a well's sachet waiting to be snipped open: its ingredient

  const set = (patch) => { st = { ...st, ...patch }; save(st); };
  /** Carbs spent with the stock that bought them: off the wallet (noted on this device), or the stand's own. */
  const spend = (cost, stock) => {
    if (gearEnabled()) set({ stock, spent: st.spent + cost });
    else set({ stock, previewCarbs: st.previewCarbs - cost });
    st.carbs = carbsOf({ carbs: st.previewCarbs });
    const c = root.querySelector('.gs-carbs b');
    if (c) c.textContent = st.carbs;
    document.dispatchEvent(new CustomEvent('gels-changed'));   // the top bar's carbs
  };

  function frame(body, cls) {
    root.innerHTML = `<div class="gs ${cls}">
      <header class="gs-bar">
        <button class="gs-x" data-gs-back aria-label="${esc(t(gel ? 'gels.toMenu' : 'gels.close'))}">${gel ? '‹' : '×'}</button>
        <h2>${esc(t('gels.title'))} <small>${esc(t('gels.level', { n: level }))}</small></h2>
        <button class="gs-x gs-music${sfx.musicOn() ? '' : ' is-off'}" data-gs-music aria-pressed="${sfx.musicOn()}" aria-label="${esc(t('gels.music'))}">♪</button>
        <span class="gs-carbs" title="${esc(t('gels.preview'))}">${gimg('ui-carbs')}<b class="data-num">${st.carbs}</b> g</span>
      </header>${body}</div>`;
  }

  // ---- the menu ----
  function drawMenu() {
    const cards = G.menu(level).map((g) => {
      const sport = g.sport ? Object.entries(g.sport)[0] : null;
      return `<button class="gs-card${g.open ? '' : ' is-locked'}" data-gs-pick="${g.id}" ${g.open ? '' : 'aria-disabled="true"'}>
        <span class="gs-card-art">${gimg(g.open ? `gel-${g.id}` : 'gel-blank')}</span>
        <b>${esc(g.open ? gelName(g) : t('gels.unknown'))}</b>
        <span class="gs-boost">${esc(t('gels.boost', { n: pct(g.boostBp) }))}</span>
        ${sport ? `<small>${esc(t('gels.sportBoost', { n: pct(sport[1]), sport: t(`gels.sport.${sport[0]}`) }))}</small>` : ''}
        <span class="gs-cost">${gimg('ui-carbs')}${G.gelCost(g)} g</span>
        ${g.open ? '' : `<span class="gs-lock">${gimg('ui-lock')}<b>${esc(t('gels.locked', { n: g.level }))}</b></span>`}
      </button>`;
    }).join('');
    const next = G.GELS.filter((g) => g.level > level).map((g) => g.level);
    frame(`<div class="gs-menu-wrap">
      <div class="gs-hero">${img(standArt(level), 'gs-stand')}
        <div><span class="gs-lvl">${gimg('ui-badge')}<b>${level}</b></span>
        <p>${esc(t('gels.about'))}</p>
        ${next.length ? `<small>${esc(t('gels.nextLevel', { n: Math.min(...next) }))}</small>` : ''}</div></div>
      ${upgradeHtml()}
      <div class="gs-menu">${cards}</div>
      <p class="gs-note">${esc(t('gels.preview'))}</p></div>`, 'is-menu');
  }

  /** Taking the stand up a level: a builder's job (the upgrade sheet). */
  function upgradeHtml() {
    if (pinned) return '';
    if (st.build) {
      return `<div class="gs-up is-building">
        ${img(standArt(st.build.to), 'gs-up-art')}
        <span><b>${esc(t('gels.building', { n: st.build.to }))}</b>
        <small><span data-gs-left class="data-num">${esc(timeLeft(st.build.left))}</span> · ${esc(t('gels.buildKeeps'))}</small></span>
        <button class="gs-up-go is-alt" data-gs-up>${esc(t('jobs.upgrade'))}</button></div>`;
    }
    const up = nextLevel(myBuilds(), 'gel-stand', serverNow());
    if (!up) return `<p class="gs-up is-top">${esc(t('gels.topLevel'))}</p>`;
    const coins = walletNow(store.getWorkouts()).coins;
    const short = coins < up.coins;
    return `<div class="gs-up${short ? ' is-short' : ''}">
      ${img(standArt(level + 1), 'gs-up-art')}
      <span><b>${esc(t('gels.upgrade', { n: level + 1 }))}</b>
      <small class="gs-up-cost"><img src="${COIN}" alt=""><b class="data-num">${up.coins}</b> · ${esc(t('gels.buildHours', { h: up.hours }))}</small>
      <small>${esc(t('gels.coinsHave', { n: coins }))}</small></span>
      <button class="gs-up-go" data-gs-up>${esc(t('gels.upgradeGo'))}</button></div>`;
  }
  // the build's clock while the stand is open, and its new level when the builder's done
  const refresh = () => {
    const before = st.level;
    st = load();
    if (st.level !== before && !pinned) level = st.level;
    if (!gel) drawMenu();
  };
  const onBuilds = () => {
    if (!root.isConnected) { document.removeEventListener('builds-changed', onBuilds); return; }
    if (!pinned && buildingJob('gel-stand')) { closeLayer(root); return; }   // an upgrade started: the stand closes
    refresh();
  };
  document.addEventListener('builds-changed', onBuilds);
  const clock = setInterval(() => {
    if (!root.isConnected) { clearInterval(clock); document.removeEventListener('builds-changed', onBuilds); return; }
    if (!st.build) return;
    const before = st.level;
    st = load();
    if (st.level !== before) { refresh(); return; }
    const el = root.querySelector('[data-gs-left]');
    if (el && st.build) el.textContent = timeLeft(st.build.left);
  }, 1000);

  // ---- the prep view ----
  // One scene on prep-bg-v9.webp (1536 x 2752, at the top; the marble carries on below it, prep-floor-v5.webp).
  // Its painted places, in % of the scene: the wall screen's face 13-87% across, 5.5-21.8% down; the shelf's
  // top 33-35.3%; the counter top 43-54.5% with the bin's lid 71.5-99% across, 44-52% down; the counter's
  // front 55.5-67% with its hook strip 56.5-59% (hooks at 21.8, 35.8, 50, 64 and 78% across); the tray unit
  // 70.5-91%: maltodextrin, fructose and salt on top, the caffeine vials, an orange electrolyte (for later)
  // and the box of pouches below, the tray centred (no stone pad since v9). Everything is placed in
  // % of the scene and sized in cqw, and every gesture works in scene %.
  const step = () => (run ? gel.steps[run.i] : null);
  const jugLevel = () => (run ? run.layers.reduce((n, l) => n + l.h, 0) : 0);
  /** How an ingredient goes in: measured in the glass, scooped and shaken, or dropped. */
  const how = (ing) => (LIQUID.has(ing) ? 'glass' : ing === 'caffeine' ? 'drops' : 'shake');
  /** Where a jar's tap pours, in scene %. */
  const tapOf = (id) => ({ x: SHELF_X[id] + JAR_W * 0.34, y: JAR_TOP + JAR_H * 0.88 });
  const ADDS = new Set(['pour', 'salt', 'drops']);   // the steps that take an ingredient

  function stepText(s) {
    if (s.kind === 'pour') return t(how(s.ing) === 'shake' ? 'gels.step.shake' : 'gels.step.pour', { ing: ingName(s.ing).toLocaleLowerCase() });
    if (s.kind === 'drops') return t('gels.step.drops', { n: s.n });
    if (s.kind === 'stir') return t('gels.step.stir', { n: s.turns });
    return t(`gels.step.${s.kind}`);
  }
  function hintText(s) {
    if (s.kind === 'pour') return t(how(s.ing) === 'shake' ? 'gels.hint.shake' : 'gels.hint.pour');
    if (s.kind === 'salt') return t('gels.hint.shake');
    if (s.kind === 'drops') return t('gels.hint.drops', { n: s.n });
    if (s.kind === 'fill' && !run.pouch) return t('gels.hint.pouch');
    return t(`gels.hint.${s.kind}`);
  }

  /** A step's little picture for the wall screen: a liquid's drop, a powder's pile, or the action's tool. */
  const stepIcon = (s) => {
    if (s.kind === 'pour') return how(s.ing) === 'glass' ? `scr-drop-${s.ing}` : `scr-pile-${s.ing}`;
    if (s.kind === 'salt') return 'scr-pile-salt';
    if (s.kind === 'drops') return 'scr-drop-caffeine';
    return `scr-step-${s.kind}`;
  };

  /** The wall screen: the gel and its boost, the recipe as a row of pictures (done, now, to come), and what to do
   *  now with its picture big beside it (or how it went). */
  function screenHtml() {
    const total = gel.steps.length;
    const now = step();
    const doneN = result ? total : run ? run.i : 0;
    const recipe = `<span class="gs-recipe">${gel.steps.map((s, i) => `<i class="${i < doneN ? 'is-done' : i === doneN && run ? 'is-now' : ''}">${gimg(stepIcon(s))}${
      s.kind === 'drops' ? `<b>${s.n}</b>` : ''}</i>`).join('')}</span>`;
    const top = `<div class="gs-screen-top">${gimg(`gel-${gel.id}`, 'gs-screen-art')}
        <h3>${esc(result ? t('gels.made', { name: gelName(gel) }) : gelName(gel))}</h3>
        ${result ? '' : `<span class="gs-boost">${esc(t('gels.boost', { n: pct(gel.boostBp) }))}</span>`}</div>`;
    let body;
    if (result) {
      body = `${top}${starsHtml(result.stars)}<p class="gs-step">${esc(t('gels.boost', { n: pct(result.bp) }))}</p><p class="gs-hint">${esc(t('gels.bagged'))}</p>`;
    } else if (now) {
      // making: what to add now, big, then the recipe so far
      body = `<div class="gs-now">${gimg(stepIcon(now), 'gs-now-art')}<p class="gs-step">${esc(t('gels.stepOf', { i: run.i + 1, n: total, step: stepText(now) }))}</p></div>
        ${recipe}<p class="gs-hint">${esc(hintText(now))}</p>`;
    } else if (snipping) {
      body = `<div class="gs-now">${gimg(`scr-pile-${snipping}`, 'gs-now-art')}<p class="gs-step">${esc(ingName(snipping))}</p></div>
        <p class="gs-hint">${esc(t('gels.hint.snip'))}</p>`;
    } else {
      const short = G.missingCost(st.stock, gel) > 0;
      body = `${top}${recipe}<p class="gs-step">${dumped ? `${gimg('scr-step-bin', 'gs-inline-art')} ` : ''}${esc(dumped ? t('gels.dumped') : t('gels.ready', { n: total }))}</p>
        <p class="gs-hint">${esc(t(short ? 'gels.restock' : 'gels.readyGo'))}</p>`;
    }
    return `<div class="gs-screen" aria-live="polite">${body}</div>`;
  }

  /** What a tray or jar shows: its stock, and while making, what's still to go in (taken at Start, but it's
   *  only gone once its step is done). */
  const shownStock = (id) => {
    const have = Number(st.stock[id]) || 0;
    if (!run) return have;
    const left = gel.steps.some((s, i) => i >= run.i && s.ing === id);
    return have + (left ? gel.uses[id] || 0 : 0);
  };
  /** A stock bar: four to a refill, amber when low, red when empty. */
  const stockBar = (id) => {
    const have = shownStock(id);
    const need = gel.uses[id] || 0;
    return `<span class="gs-stockbar${have === 0 ? ' is-empty' : have < Math.max(need, 2) ? ' is-low' : ''}">${
      [1, 2, 3, 4].map((i) => `<i class="${i <= have ? 'is-on' : ''}"></i>`).join('')}</span>`;
  };
  /** A jar, a well or the vial: what state it's in, for its classes and its label. */
  function slotState(id) {
    const ing = G.INGREDIENTS[id];
    const have = shownStock(id);
    const need = gel.uses[id] || 0;
    const now = step();
    const active = !!(now && ADDS.has(now.kind) && now.ing === id && how(id) !== 'glass');
    const short = !ing.free && !run && !result && have < need;
    const label = ing.free ? ingName(id) : short || have === 0 ? t('gels.buyAria', { ing: ingName(id), n: ing.cost }) : t('gels.slotAria', { ing: ingName(id), n: have });
    const cls = `${active ? ' is-now' : ''}${short ? ' is-short' : ''}${need || (now?.ing === id) ? ' is-used' : ''}`;
    return { ing, have, cls, label, short };
  }

  /** The hooks on the counter's front: the tools hanging there (each leaves while it's in your hand). */
  function hooksHtml() {
    const s = step();
    const want = s?.kind === 'seal' ? 'sealer' : s?.kind === 'stir' ? 'whisk' : s?.kind === 'drops' ? 'dropper' : snipping ? 'scissors' : null;
    return Object.entries(HOOKS).map(([id, r]) => `<span class="gs-tool${want === id ? ' is-now' : ''}" data-tool="${id}" style="--x:${r.x}%;--w:${r.w};--rot:${r.rot}deg">${gimg(r.art)}</span>`).join('');
  }

  /** The shelf: the four liquids in their tap jars. */
  function shelfHtml() {
    const s = step();
    const jars = JARS.map((id) => {
      const { cls, label, ing } = slotState(id);
      const now = s?.kind === 'pour' && s.ing === id;
      return `<button class="gs-jar${cls}${now ? ' is-now' : ''}" data-slot="${id}" style="--x:${SHELF_X[id]}%" aria-label="${esc(label)}">
        ${gimg(`jar-${id}`, 'gs-jar-art')}${ing.free ? '' : stockBar(id)}</button>`;
    }).join('');
    return jars;
  }

  /** The tray, painted in: a place over each powder and the caffeine vials (its empty picture when it's run
   *  out, a plus when it's short), the box of empty pouches, and a powder's bag while restocking. */
  function trayHtml() {
    const s = step();
    const places = Object.entries(TRAYS).map(([id, r]) => {
      const { cls, label, have, short } = slotState(id);
      return `<button class="gs-well${cls}${have ? '' : ' is-out-of'}" data-slot="${id}" style="--l:${r.l}%;--t:${r.t}%;--w:${r.w}%;--h:${r.h}%" aria-label="${esc(label)}">
        ${gimg(`patch9-${id}`, 'gs-well-empty')}${short ? gimg('ui-plus', 'gs-well-plus') : ''}${stockBar(id)}</button>`;
    }).join('');
    const box = `<button class="gs-box${s?.kind === 'fill' && !run.pouch ? ' is-now' : ''}" data-box style="--l:${BOX.l}%;--t:${BOX.t}%;--w:${BOX.w}%;--h:${BOX.h}%" aria-label="${esc(t('gels.boxAria'))}"></button>`;
    // restocking a powder: its bag, big in the middle over a veil, its dashed line to cut
    const bag = snipping ? `<i class="gs-veil"></i><div class="gs-bag" role="img" aria-label="${esc(t('gels.sachetAria', { ing: ingName(snipping) }))}">
      ${gimg(`bag-${snipping}`, 'gs-bag-whole')}${gimg(`bag-${snipping}-cut`, 'gs-bag-cut')}${gimg('bag-strip', 'gs-bag-strip')}<i class="gs-cutline"><b></b></i></div>` : '';
    return places + box + bag;
  }

  /** The counter: the measuring glass, the jug (with its liquid) and its meter, the pouch, the bin. */
  function counterHtml() {
    const s = step();
    const kind = s?.kind || 'idle';
    const layers = (run?.layers || []).map((l) => `<i style="--h:${l.h.toFixed(4)};--c:${l.c}"></i>`).join('');
    let meter = '';
    if (s && (s.kind === 'pour' || s.kind === 'salt')) {
      const [lo, hi] = G.sweetSpot(s, s.kind === 'pour' ? run.below : 0);
      meter = `<div class="gs-meter" style="--lo:${lo.toFixed(3)};--hi:${hi.toFixed(3)};--to:${s.to};--v:${(s.kind === 'salt' ? run.salt : jugLevel()).toFixed(4)}"><b></b><i></i><em></em></div>`;
    } else if (s?.kind === 'drops') {
      meter = `<div class="gs-meter is-drops" style="--n:${s.n}">${Array.from({ length: s.n + 1 }, (_, i) => `<i class="${i < run.drops ? 'is-on' : ''}${i === s.n ? ' is-extra' : ''}"></i>`).join('')}</div>`;
    }
    // the glass: what's in it (it fills to the top; the measuring's on the jug's meter)
    const measuring = s?.kind === 'pour' && how(s.ing) === 'glass';
    const gl = run?.glass || 0;
    const gc = run?.glassC || '#BFE2F4';
    const pouch = run?.pouch || result;
    return `<div class="gs-glass${measuring ? ' is-now' : ''}" data-glass role="img" aria-label="${esc(t('gels.glassAria', { n: Math.round(gl * 100) }))}">
        ${gimg('tool-glass', 'gs-glass-art')}<span class="gs-gliq" style="--g:${gl.toFixed(4)};--c:${gc}"></span></div>
      <div class="gs-jug" data-jug role="img" aria-label="${esc(t('gels.jugAria'))}">${gimg('tool-jug')}
        <span class="gs-liquid" style="--mix:${run?.mix || 0};--total:${jugLevel().toFixed(4)}">${layers}<em></em></span>
        ${kind === 'stir' ? '<svg class="gs-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" pathLength="1" style="--p:0"/></svg>' : ''}
        ${gimg('fx-splash', 'gs-splash')}</div>
      ${meter}
      ${kind === 'fill' && !run.pouch ? '<i class="gs-spot"></i>' : ''}
      ${pouch ? `<div class="gs-pouch${result ? ' is-sealed is-made' : ''}">${gimg('pouch-0', 'gs-pouch-art')}
        <span class="gs-pfill"><i style="--f:${run?.fill || 0}"></i></span>
        ${kind === 'fill' ? `<i class="gs-pline" style="--to:${s.to}"></i>` : ''}
        ${gimg(`gel-${gel.id}`, 'gs-final')}</div>` : ''}
      <div class="gs-bin" style="--l:${BIN.l}%;--t:${BIN.t}%;--w:${BIN.r - BIN.l}%;--h:${BIN.b - BIN.t}%"></div>
      ${gimg('fx-glass-splash', 'gs-gsplash')}
      ${kind === 'stir' ? gimg('tool-whisk', 'gs-whisk') : ''}
      ${result ? `${gimg('fx-ring', 'gs-ring-fx')}${gimg('fx-sparkle', 'gs-sparkle-fx')}` : ''}`;
  }

  /** The buttons, floating over the tray only when there's one to press (none while making). */
  function dockHtml() {
    if (result) {
      return `<div class="gs-dock"><button class="gs-btn is-alt" data-gs-menu>${esc(t('gels.toMenu'))}</button>
        <button class="gs-btn" data-gs-again>${esc(t('gels.again'))}</button></div>`;
    }
    if (run || snipping) return '';
    return `<div class="gs-dock"><button class="gs-btn" data-gs-start ${G.missingCost(st.stock, gel) ? 'aria-disabled="true"' : ''}>${esc(t('gels.start'))}</button></div>`;
  }

  function drawPrep() {
    frame(`<div class="gs-body"><div class="gs-scene" style="--gel:${gel.liquid}">
        ${gimg('patch9-bin-open', 'gs-binlid')}
        ${screenHtml()}
        <div class="gs-shelf">${shelfHtml()}</div>
        <div class="gs-tray">${trayHtml()}</div>
        <div class="gs-rail">${hooksHtml()}</div>
        <div class="gs-counter">${counterHtml()}</div>
        <span class="gs-pop" aria-hidden="true"></span>
      </div>${dockHtml()}</div>`, 'is-prep');
    bindScene();
  }

  // ---- doing the steps ----
  function flash(el) {
    if (typeof el === 'string') el = root.querySelector(el);
    if (!el) return;
    el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on');
  }
  function pop(word) {
    const p = root.querySelector('.gs-pop');
    if (!p) return;
    p.innerHTML = `${word === 'exact' ? gimg('fx-sparkle') : ''}<b>${esc(t(`gels.judge.${word}`))}</b>`;
    p.className = `gs-pop is-${word}`;
    void p.offsetWidth; p.classList.add('is-on');
  }
  /** A step's done: its pop, then (after a short beat) the next step, or the result. */
  function finishStep(score, value, to) {
    busy = true;
    run.scores.push(score);
    haptic(score >= 0.8 ? 'place' : 'tick');
    sfx.play(score >= 0.8 ? 'step-good' : 'step-ok');
    pop(G.verdict(score, value, to));
    setTimeout(() => {
      busy = false;
      if (!run) return;
      run.i += 1;
      if (run.i >= gel.steps.length) {
        const n = G.stars(run.scores);
        result = { stars: n, bp: G.boostOf(gel, n) };
        set({ bag: G.bagged(st.bag, gel.id, n, Date.now()) });
        haptic(n === 3 ? 'record' : 'levelUp');
        sfx.play(n === 3 ? 'gel-record' : 'gel-done');
        for (let k = 0; k < n; k++) sfx.play('star', { delay: 0.45 + k * 0.28, rate: 1 + k * 0.12 });   // as each star lands
        run = null;
      } else beginStep();
      drawPrep();
    }, STEP_BEAT);
  }
  /** Set up the step that's starting: a pour gets its own layer in the jug; a measure starts with an empty glass. */
  function beginStep() {
    const s = step();
    run.below = jugLevel();
    run.glass = 0;   // what was left in the glass is poured away
    if (s.kind === 'pour') run.layers.push({ c: G.INGREDIENTS[s.ing].colour, h: 0 });
    if (s.kind === 'pour' && how(s.ing) === 'glass') { run.glass = 0; run.glassC = G.INGREDIENTS[s.ing].colour; }
    if (s.kind === 'salt') run.salt = 0;
    if (s.kind === 'drops') run.drops = 0;
  }
  /** Tip the jug in the bin: the ingredients are gone, back to the start. */
  function dump() {
    haptic('refuse');
    sfx.play('bin-dump');
    run = null; dumped = true;
    drawPrep();
    flash('.gs-binlid');
  }

  /** Every gesture on the scene: the glass, a scoop, the dropper, the jug, the whisk, a pouch, the sealer, the scissors. */
  function bindScene() {
    const scene = root.querySelector('.gs-scene');
    if (!scene) return;
    const counter = scene.querySelector('.gs-counter');
    const jugEl = scene.querySelector('.gs-jug');
    const binLid = scene.querySelector('.gs-binlid');
    const box = () => scene.getBoundingClientRect();
    /** A pointer in scene % (x across, y down). */
    const at = (e) => { const r = box(); return { x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 }; };
    /** An element's box in scene %. */
    const rectOf = (el) => {
      const r = box(); const b = el.getBoundingClientRect();
      return { l: (b.left - r.left) / r.width * 100, r: (b.right - r.left) / r.width * 100, t: (b.top - r.top) / r.height * 100, b: (b.bottom - r.top) / r.height * 100 };
    };
    /** An element's own place in scene %, its transform left out (it may still be on its way back). */
    const homeOf = (el) => {
      const r = box();
      const l = el.offsetLeft / r.width * 100; const tp = el.offsetTop / r.height * 100;
      return { l, r: l + el.offsetWidth / r.width * 100, t: tp, b: tp + el.offsetHeight / r.height * 100 };
    };
    /** Back to its place: the move's undone (its transition carries it home). */
    const goHome = (el) => { ['--tx', '--ty', '--rot', '--flip'].forEach((k) => el.style.removeProperty(k)); };
    const inside = (p, r, pad = 0, padY = pad) => p.x > r.l - pad && p.x < r.r + pad && p.y > r.t - padY && p.y < r.b + padY;
    const liquidEl = () => jugEl.querySelector('.gs-liquid');
    const meterEl = () => scene.querySelector('.gs-meter');
    /** The jug's liquid surface, in scene % down, for its level. */
    const surfaceY = (jr, level) => jr.b - (jr.b - jr.t) * (0.05 + 0.86 * level);
    const toolEl = (id) => scene.querySelector(`[data-tool="${id}"]`);
    let g = null;

    /** Something taken in the hand: a picture that follows the finger (and the rail's or tray's one fades). */
    function holding(file, heightCqw, cls = '') {
      const held = document.createElement('img');
      held.className = `gs-held ${cls}`; held.src = `${ART}/${file}.webp`; held.alt = ''; held.draggable = false;
      held.style.height = `${heightCqw}cqw`;
      scene.append(held);
      const place = (x, y, rot = 0) => { held.style.left = `${x}%`; held.style.top = `${y}%`; held.style.setProperty('--rot', `${rot}deg`); };
      return { held, place };
    }
    function streamEl(file, cls = 'is-pour') {
      const flow = document.createElement('img');
      flow.className = `gs-flow ${cls}`; flow.src = `${ART}/${file}.webp`; flow.alt = '';
      scene.append(flow);
      const show = (on, x, top, bottom, w) => {
        flow.classList.toggle('is-on', on);
        if (!on) return;
        flow.style.left = `${x}%`; flow.style.top = `${top}%`; flow.style.height = `${Math.max(0, bottom - top)}%`; flow.style.width = `${w}cqw`;
      };
      return { flow, show };
    }
    /** Something moved from its place on the counter: by --tx/--ty (a translate's % is of its own box) and --rot. */
    const mover = (el, home) => (x, y, rot) => {
      const w = home.r - home.l; const h = home.b - home.t;
      el.style.setProperty('--tx', `${((x - (home.l + home.r) / 2) / w * 100).toFixed(2)}%`);
      el.style.setProperty('--ty', `${((y - (home.t + home.b) / 2) / h * 100).toFixed(2)}%`);
      el.style.setProperty('--rot', `${rot}deg`);
    };
    const binOpen = (on) => binLid.classList.toggle('is-open', on);
    const br = { ...BIN };   // the bin's lid, in scene %

    function drawJug() {
      const liq = liquidEl();
      const top = run.layers[run.layers.length - 1];
      if (top) liq.querySelectorAll('i')[run.layers.length - 1]?.style.setProperty('--h', top.h.toFixed(4));
      liq.style.setProperty('--total', jugLevel().toFixed(4));
    }

    // ---- the measuring glass: under a tap to fill it, over the jug to pour it in, over the bin to tip it out ----
    function dragGlass(e, s) {
      const glassEl = scene.querySelector('.gs-glass');
      const liqEl = glassEl.querySelector('.gs-gliq');
      const home = homeOf(glassEl);
      const moveTo = mover(glassEl, home);
      const gH = home.b - home.t; const gW = home.r - home.l;
      const tap = tapOf(s.ing);
      const jarEl = scene.querySelector(`.gs-jar[data-slot="${s.ing}"]`);
      const jr = rectOf(jugEl);
      const tapStream = streamEl(STREAM[s.ing]);
      const pourStream = streamEl(STREAM[s.ing]);
      glassEl.classList.add('is-held');
      sfx.play('pick-up');
      const pourSound = sfx.loop('glass-pour', { level: 0 });
      let where = null; let since = 0; let from = run.glass; let tickAt = run.glass; let full = run.glass >= 1;
      const topLayer = () => run.layers[run.layers.length - 1];
      let jugBase = topLayer().h;   // the jug's layer when the glass got over it
      const show = () => {
        liqEl.style.setProperty('--g', run.glass.toFixed(4));
        glassEl.setAttribute('aria-label', t('gels.glassAria', { n: Math.round(run.glass * 100) }));
      };
      /** Bring the glass up to now: filling under the tap, emptying into the jug or the bin (all by time held). */
      const catchUp = (now) => {
        const secs = since ? (now - since) / 1000 : 0;
        if (where === 'tap') {
          run.glass = Math.min(1, from + TAP_RATE * secs);
          if (run.glass >= tickAt + 0.05) { tickAt = run.glass; haptic('select'); }
          if (run.glass >= 1 && !full) { full = true; haptic('place'); jarEl?.classList.remove('is-pouring'); }
          // the stream lands on the glass's filling
          tapStream.show(run.glass < 1, tap.x, tap.y, glassAt.y + gH * 0.44 - gH * 0.82 * run.glass, 2.6);
        } else if (where === 'bin') {
          const f = Math.min(1, secs * 1000 / GLASS_POUR_MS);
          run.glass = from * (1 - f);
          if (f >= 1) pourStream.show(false);
        } else if (where === 'jug') {
          // it pours in slowly: stop at the meter's line
          run.glass = Math.max(0, from - GLASS_FLOW * secs);
          const room = 1 - run.below - jugBase;
          const poured = Math.min(room, (from - run.glass) * GLASS_CAP);
          if (poured >= room) run.glass = from - poured / GLASS_CAP;
          topLayer().h = jugBase + poured;
          drawJug();
          const v = jugLevel();
          meterEl()?.style.setProperty('--v', v.toFixed(4));
          if (v >= tickAt + 0.04) { tickAt = v; haptic('select'); }
          if (run.glass <= 0.001) pourStream.show(false);
        }
        pourSound.level((where === 'jug' || where === 'bin') && run.glass > 0.001 ? 1 : 0);
        show();
      };
      let glassAt = { x: (home.l + home.r) / 2, y: (home.t + home.b) / 2 };
      const loop = (now) => { raf = requestAnimationFrame(loop); if (where) catchUp(now); };
      let raf = requestAnimationFrame(loop);
      const move = (ev) => {
        const p = at(ev);
        const now = performance.now();
        if (where) catchUp(now);
        const was = where;
        // (still over the jug or the bin once it's empty: that's where it'll be let go)
        // under the tap: close below it (the jug's under the taps too: lower down, the glass is over the jug)
        where = Math.abs(p.x - tap.x) < 6 && p.y > tap.y - 4 && p.y < tap.y + 6 ? 'tap'
          : (run.glass > 0 || was === 'jug') && inside(p, jr, 6, 3) ? 'jug'
            : (run.glass > 0 || was === 'bin') && inside(p, BIN_HIT) ? 'bin' : null;
        if (where !== was) {
          since = now; from = run.glass; jugBase = topLayer().h; tickAt = where === 'jug' ? jugLevel() : run.glass;
          if (where) haptic('tick');
          if (where === 'tap' && run.glass < 1) sfx.play('tap-fill');
          if (where === 'bin') sfx.play('bin-lid');
          jarEl?.classList.toggle('is-pouring', where === 'tap' && run.glass < 1);
          binOpen(where === 'bin');
          if (where !== 'tap') tapStream.show(false);
          if (where !== 'jug' && where !== 'bin') pourStream.show(false);
        }
        if (where === 'tap') {
          // snapped under the tap, its rim just below the spout
          glassAt = { x: tap.x, y: tap.y + 3.2 + gH / 2 };
          moveTo(glassAt.x, glassAt.y, 0);
          catchUp(now);
        } else if (where === 'jug' || where === 'bin') {
          // tipped over the jug's (or the bin's) top, its spout (on its left) over the middle
          const r = where === 'jug' ? jr : br;
          const cx = (r.l + r.r) / 2;
          const half = gH / 2 * ASPECT;   // half its height, in % of the width
          glassAt = { x: cx + 0.6 * half + gW * 0.3, y: r.t - 6 };
          moveTo(glassAt.x, glassAt.y, -100);
          if (run.glass > 0.001) pourStream.show(true, cx - 1, r.t - 4, where === 'jug' ? surfaceY(jr, jugLevel()) : r.t + 4, 3.4);
          catchUp(now);
        } else {
          glassAt = { x: p.x, y: p.y - 3 };
          moveTo(glassAt.x, glassAt.y, 0);
        }
      };
      const up = () => {
        cancelAnimationFrame(raf);
        if (where) catchUp(performance.now());
        tapStream.flow.remove(); pourStream.flow.remove();
        pourSound.stop();
        if (where !== 'bin') sfx.play('put-down');
        jarEl?.classList.remove('is-pouring');
        binOpen(false);
        glassEl.classList.remove('is-held');
        goHome(glassEl);   // always back to its place, whatever happened
        if (where === 'bin') {
          // tipped out: try again
          run.glass = 0; show();
          flash(scene.querySelector('.gs-gsplash')); pop('binned'); haptic('refuse'); sfx.play('bin-dump', { gain: 0.6 });
          return;
        }
        if (topLayer().h > 0) {
          // let go once some is poured in, wherever: what's in the jug is judged (the rest of the glass goes back)
          flash('.gs-splash');
          finishStep(G.scorePour(jugLevel(), s.to, run.below), jugLevel(), s.to);
        }
      };
      move(e);
      return { move, up };
    }

    // ---- a scoop from a well, or the dropper from the rail, over the jug ----
    function dragIngredient(e, from, s) {
      const ing = s.ing;
      const mode = how(ing);
      const jr = rectOf(jugEl);
      const heightCqw = mode === 'drops' ? 15 : 13;
      const { held, place } = holding(HELD[ing], heightCqw, `is-${mode}`);
      // a scoop: a thin trickle while it's held (trickle-*), the heavy pour over it while it's shaken (shake-*)
      const { flow, show: showFlow } = streamEl(mode === 'shake' ? `trickle-${ing}` : STREAM[ing], `is-${mode}`);
      const heavy = mode === 'shake' ? streamEl(`shake-${ing}`, 'is-shake is-heavy') : null;
      from.classList.add('is-out');
      sfx.play('pick-up');
      // a scoop: its trickle while it's held over the jug, the shake on top while it's shaken
      const trickle = mode === 'shake' ? sfx.loop('powder-trickle', { level: 0 }) : null;
      const shake = mode === 'shake' ? sfx.loop(s.kind === 'salt' ? 'salt-shake' : 'powder-shake', { level: 0 }) : null;
      let over = false; let amount = 0; let lastX = null; let shookAt = 0; let raf = 0; let tickAt = 0; let shaken = 0;
      // time held over the jug, in seconds: the drops and a scoop's trickle come from this, never from frames drawn
      let heldFor = 0; let since = 0;
      const overTime = (now) => heldFor + (over && since ? (now - since) / 1000 : 0);
      const cx = (jr.l + jr.r) / 2;

      /** What's gone in so far shows: the jug's layer, the meter, a light tick every 4%. */
      const apply = () => {
        if (s.kind === 'pour') {
          const top = run.layers[run.layers.length - 1];
          top.h = Math.min(1 - run.below, amount);
          drawJug();
        } else if (s.kind === 'salt') run.salt = Math.min(1, amount);
        const v = s.kind === 'salt' ? run.salt : jugLevel();
        meterEl()?.style.setProperty('--v', v.toFixed(4));
        if (v >= tickAt + 0.04) { tickAt = v; haptic('select'); }
      };
      const catchUp = (now) => {
        if (mode === 'shake') {
          // held over the jug it always trickles in; shaking adds to it (move())
          amount = shaken + overTime(now) * (s.kind === 'salt' ? SALT_HOLD : HOLD_RATE);
          apply();
          return;
        }
        const secs = overTime(now);
        const n = secs * 1000 < DROP_FIRST ? 0 : 1 + Math.floor((secs * 1000 - DROP_FIRST) / DROP_MS);
        if (n > run.drops) {
          run.drops = n; haptic('select'); sfx.play('caffeine-drop', { rate: 0.94 + Math.random() * 0.12 });
          meterEl()?.querySelectorAll('i').forEach((el, i) => el.classList.toggle('is-on', i < run.drops));
          flash(flow);
        }
      };
      const loop = (now) => {
        raf = requestAnimationFrame(loop);
        const shakingNow = over && now - shookAt < 160;
        trickle?.level(over && !shakingNow ? (s.kind === 'salt' ? 0.4 : 1) : 0);
        shake?.level(shakingNow ? 1 : 0);
        if (!over) return;
        catchUp(now);
        if (mode === 'shake') {
          // a thin trickle while it's held, the heavy pour over it while it's shaken
          const x = parseFloat(held.style.left) - 3; const top = parseFloat(held.style.top) + 1; const bottom = surfaceY(jr, jugLevel());
          const shaking = now - shookAt < 160;
          showFlow(!shaking, x, top, bottom, 2.6);
          heavy.show(shaking, x, top, bottom, 5);
        }
      };
      const move = (ev) => {
        const p = at(ev);
        const was = over;
        over = p.x > jr.l - 10 && p.x < jr.r + 10 && p.y > jr.t - 22 && p.y < jr.b + 4;
        const now = performance.now();
        if (over && !was) { haptic('tick'); since = now; }
        if (!over && was) { heldFor += (now - since) / 1000; since = 0; }
        held.classList.toggle('is-over', over);
        if (!over) { place(p.x, p.y - 6, 0); showFlow(false); heavy?.show(false); lastX = null; return; }
        if (mode === 'shake') {
          // the scoop tipped over the jug, following the finger side to side; shaking pours faster
          const x = Math.max(jr.l + 6, Math.min(jr.r, p.x));
          const dx = lastX == null ? 0 : Math.max(-8, Math.min(8, x - lastX));
          lastX = x;
          place(x + 4, jr.t - 3, -35 + Math.max(-18, Math.min(18, dx * 5)));
          if (Math.abs(dx) > 0.3) { shaken += Math.abs(dx) * (s.kind === 'salt' ? SALT_K : SHAKE_K); shookAt = now; }
          catchUp(now);
        } else {
          // the dropper, upright over the middle of the jug
          place(cx, jr.t - 5, 0);
          const tip = jr.t - 5 + heightCqw / 2 / ASPECT;
          flow.style.left = `${cx}%`; flow.style.top = `${tip}%`; flow.style.height = `${Math.max(2, surfaceY(jr, jugLevel()) - tip)}%`; flow.style.width = '2cqw';
          catchUp(now);
        }
      };
      const up = () => {
        cancelAnimationFrame(raf);
        if (over) catchUp(performance.now());
        held.remove(); flow.remove(); heavy?.flow.remove();
        trickle?.stop(); shake?.stop();
        sfx.play('put-down', { gain: 0.6 });
        from.classList.remove('is-out');
        const put = s.kind === 'drops' ? run.drops : amount;
        if (!put) return;   // let go away from the jug: nothing went in, try again
        flash('.gs-splash');
        if (s.kind === 'pour') finishStep(G.scorePour(jugLevel(), s.to, run.below), jugLevel(), s.to);
        else if (s.kind === 'salt') finishStep(G.scoreSalt(run.salt, s.to), run.salt, s.to);
        else finishStep(G.scoreDrops(run.drops, s.n), run.drops, s.n);
      };
      raf = requestAnimationFrame(loop);
      move(e);
      return { move, up };
    }

    // ---- the jug: to the bin to tip it away, or (filling) over the pouch ----
    function dragJug(e, s) {
      const filling = s.kind === 'fill' && run.pouch;
      const home = homeOf(jugEl);
      const moveTo = mover(jugEl, home);
      const pouchEl = scene.querySelector('.gs-pouch');
      const pr = pouchEl ? rectOf(pouchEl) : null;
      const { flow } = streamEl('stream-gel');
      jugEl.classList.add('is-held');
      sfx.play('pick-up');
      const pourSound = sfx.loop('jug-pour', { level: 0 });
      const hCqw = (home.b - home.t) * ASPECT;   // the jug's height in % of the scene's width
      const fillEl = scene.querySelector('.gs-pfill i');
      // the fill carries on from the last time (let go short of the line, the jug's picked up again to top it off)
      if (run.fillStart == null) run.fillStart = jugLevel();
      const startLevel = run.fillStart;
      let where = null; let raf = 0; let tickAt = run.fill;
      let pouredFor = run.fillSecs || 0; let since = 0;   // seconds held over the pouch: the fill comes from this
      const fillTo = (now) => {
        run.fill = Math.min(1, FILL_RATE * (pouredFor + (since ? (now - since) / 1000 : 0)));
        fillEl.style.setProperty('--f', run.fill.toFixed(4));
        const left = Math.max(0, startLevel * (1 - run.fill / 0.95));   // the jug empties into the pouch
        run.layers = [{ c: gel.liquid, h: left }];
        liquidEl().querySelector('i')?.style.setProperty('--h', left.toFixed(4));
        liquidEl().style.setProperty('--total', left.toFixed(4));
        if (run.fill >= tickAt + 0.04) { tickAt = run.fill; haptic('select'); }
        const surf = pr.b - (pr.b - pr.t) * (0.07 + 0.73 * run.fill);
        flow.style.height = `${Math.max(0, surf - parseFloat(flow.style.top))}%`;
      };
      const loop = (now) => { raf = requestAnimationFrame(loop); if (where === 'pouch') fillTo(now); };
      const move = (ev) => {
        const p = at(ev);
        const half = hCqw / 2;
        const was = where;
        where = filling && p.x > pr.l - 4 && p.x < pr.r + 16 && p.y < pr.b && p.y > pr.t - 26 ? 'pouch'
          : jugLevel() > 0 && inside(p, BIN_HIT) ? 'bin' : null;
        // over the bin (on its right) it's turned round so its spout leads; the pouch is on its left, as drawn
        jugEl.style.setProperty('--flip', where === 'bin' ? '-1' : '1');
        if (where !== was && where) haptic('tick');
        if (where === 'bin' && was !== 'bin') sfx.play('bin-lid');
        pourSound.level(where === 'pouch' && run.fill < 1 ? 1 : 0);
        const now = performance.now();
        if (where === 'pouch' && was !== 'pouch') since = now;
        if (was === 'pouch' && where !== 'pouch') { pouredFor += (now - since) / 1000; since = 0; }
        binOpen(where === 'bin');
        if (where === 'bin') {
          // tipped to the right over the bin
          const bx = (br.l + br.r) / 2; const by = br.t - 3;
          moveTo(bx - 0.966 * half, by - 0.259 * half / ASPECT - 3, 105);
          flow.classList.add('is-on'); flow.style.left = `${bx}%`; flow.style.top = `${by}%`; flow.style.height = '6%'; flow.style.width = '4.5cqw';
        } else if (where === 'pouch') {
          // tipped to the left, its spout over the pouch's open top
          const px = (pr.l + pr.r) / 2; const py = pr.t - 5;
          moveTo(px + 0.966 * half, py - 0.259 * half / ASPECT, -105);
          flow.classList.add('is-on'); flow.style.left = `${px}%`; flow.style.top = `${py}%`; flow.style.width = '4.5cqw';
        } else {
          moveTo(p.x, p.y - 4, 0);
          flow.classList.remove('is-on');
        }
      };
      const up = () => {
        cancelAnimationFrame(raf);
        if (where === 'pouch') { const now = performance.now(); fillTo(now); pouredFor += (now - since) / 1000; since = 0; }
        run.fillSecs = pouredFor;
        flow.remove();
        pourSound.stop();
        if (where !== 'bin') sfx.play('put-down');
        binOpen(false);
        jugEl.classList.remove('is-held');
        goHome(jugEl);
        if (where === 'bin') { dump(); return; }
        // short of the line: it waits, the jug can be picked up again to top it off
        if (filling && run.fill >= G.sweetSpot(s, 0)[0]) finishStep(G.scorePour(run.fill, s.to, 0), run.fill, s.to);
        else if (filling && run.fill > 0) haptic('tick');
      };
      raf = requestAnimationFrame(loop);
      move(e);
      return { move, up };
    }

    // ---- an empty pouch from the box, onto the counter ----
    function dragPouch(e) {
      const boxEl = scene.querySelector('.gs-box');
      const { held, place } = holding('pouch-0', 22, 'is-pouch');
      boxEl.classList.add('is-out');
      sfx.play('pouch-pick');
      let ok = false;
      const move = (ev) => {
        const p = at(ev);
        const was = ok;
        ok = p.x > 16 && p.x < 44 && p.y > 37 && p.y < 62;
        if (ok && !was) haptic('tick');
        scene.classList.toggle('is-over-spot', ok);
        place(ok ? POUCH_AT.x : p.x, ok ? POUCH_AT.y : p.y - 5, 0);
      };
      const up = () => {
        held.remove(); boxEl.classList.remove('is-out');
        scene.classList.remove('is-over-spot');
        if (!ok) return;
        haptic('place'); sfx.play('put-down', { gain: 0.5 });
        run.pouch = true;
        drawPrep();
        root.querySelector('.gs-pouch')?.classList.add('is-in');
      };
      move(e);
      return { move, up };
    }

    // ---- stirring: the whisk off the rail, round the jug ----
    function stir(e, s) {
      const ring = scene.querySelector('.gs-ring circle');
      const whisk = scene.querySelector('.gs-whisk');
      const jr = rectOf(jugEl);
      const cx = jr.l + (jr.r - jr.l) * 0.43; const cy = jr.t + (jr.b - jr.t) * 0.6;
      // the angle round the jug, measured in screen pixels so it's a true circle
      const ang = (p) => Math.atan2((p.y - cy) * ASPECT, p.x - cx);
      let prev = ang(at(e));
      if (!run.stirT0) run.stirT0 = performance.now();
      counter.classList.add('is-stirring');
      toolEl('whisk')?.classList.add('is-out');
      sfx.play('pick-up', { gain: 0.6 });
      const swish = sfx.loop('whisk-stir', { level: 0 });
      let still = 0;   // it goes quiet a moment after the whisk stops moving
      const stopSwish = () => { clearTimeout(still); swish.stop(); };
      const move = (ev) => {
        const p = at(ev);
        swish.level(1); clearTimeout(still); still = setTimeout(() => swish.level(0), 140);
        whisk.style.left = `${p.x}%`; whisk.style.top = `${p.y}%`;
        const a = ang(p);
        whisk.style.setProperty('--r', `${Math.cos(a) * 14}deg`);
        let d = a - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
        prev = a;
        const before = Math.floor(run.stirAcc / Math.PI);
        run.stirAcc += Math.abs(d);
        if (Math.floor(run.stirAcc / Math.PI) > before) haptic('select');
        const turns = run.stirAcc / (2 * Math.PI);
        run.mix = Math.min(1, turns / s.turns);
        liquidEl().style.setProperty('--mix', run.mix.toFixed(3));
        ring.style.setProperty('--p', run.mix.toFixed(3));
        if (turns >= s.turns && !busy) {
          g = null;
          counter.classList.remove('is-stirring');
          stopSwish();
          run.layers = [{ c: gel.liquid, h: jugLevel() }]; run.mix = 0;
          finishStep(G.scoreStir(turns, (performance.now() - run.stirT0) / 1000), 1, 1);
        }
      };
      move(e);
      return { move, up: () => { stopSwish(); counter.classList.remove('is-stirring'); toolEl('whisk')?.classList.remove('is-out'); } };
    }

    // ---- sealing: the sealer off the rail, swiped across the pouch's top ----
    function seal(e) {
      const pouchEl = scene.querySelector('.gs-pouch');
      const pr = rectOf(pouchEl);
      const { held, place } = holding('sealer-open', 11, 'is-sealer');
      toolEl('sealer')?.classList.add('is-out');
      sfx.play('pick-up', { gain: 0.6 });
      const bar = document.createElement('i');
      bar.className = 'gs-sealbar'; bar.innerHTML = '<b></b>';
      pouchEl.append(bar);
      const fill = bar.querySelector('b');
      const topY = pr.t + (pr.b - pr.t) * 0.08;
      let lo = null; let hi = null;
      const move = (ev) => {
        const p = at(ev);
        const near = Math.abs(p.y - topY) < 7 && p.x > pr.l - 14 && p.x < pr.r + 14;
        // over the pouch, the jaws ride along its top; else the sealer just follows the finger
        place(p.x, near ? topY : p.y - 4, 0);
        held.classList.toggle('is-over', near);
        if (!near) return;
        const v = Math.max(0, Math.min(1, (p.x - pr.l) / (pr.r - pr.l)));
        lo = lo == null ? v : Math.min(lo, v); hi = hi == null ? v : Math.max(hi, v);
        fill.style.left = `${lo * 100}%`; fill.style.width = `${(hi - lo) * 100}%`;
      };
      const up = () => {
        const cover = (hi ?? 0) - (lo ?? 0);
        if (cover < 0.15) {
          // a tap, not a swipe: back on the rail, try again
          held.remove(); bar.remove(); toolEl('sealer')?.classList.remove('is-out');
          return;
        }
        // the jaws snap shut on the pouch's top, and the clear pouch is the gel
        held.src = `${ART}/sealer-closed.webp`;
        place((pr.l + pr.r) / 2, topY, 0);
        held.classList.add('is-shut');
        sfx.play('seal-press');
        pouchEl.classList.add('is-sealed');
        finishStep(G.scoreSeal(cover), cover, 1);
      };
      move(e);
      return { move, up };
    }

    // ---- restocking a powder: its bag, big in the middle, snipped open with the scissors ----
    function snip(e) {
      const id = snipping;
      const sachetEl = scene.querySelector('.gs-bag');
      const sr = rectOf(sachetEl);
      const lineY = sr.t + (sr.b - sr.t) * BAG_LINE;
      const fill = sachetEl.querySelector('.gs-cutline b');
      const { held, place } = holding('scissors-open', 13, 'is-scissors');
      toolEl('scissors')?.classList.add('is-out');
      let lo = null; let hi = null; let lastSnip = null; let open = true; let cut = false;
      const move = (ev) => {
        if (cut) return;
        const p = at(ev);
        const near = Math.abs(p.y - lineY) < 6 && p.x > sr.l - 8 && p.x < sr.r + 8;
        place(p.x, near ? lineY : p.y - 4, 0);
        if (!near) return;
        // snip, snip: the blades close and open as they go
        if (lastSnip == null || Math.abs(p.x - lastSnip) > 2.5) {
          lastSnip = p.x; open = !open;
          held.src = `${ART}/${open ? 'scissors-open' : 'scissors-closed'}.webp`;
          haptic('select');
          if (!open) sfx.play('scissors-snip', { gain: 0.8, rate: 0.95 + Math.random() * 0.1 });
        }
        const v = Math.max(0, Math.min(1, (p.x - sr.l) / (sr.r - sr.l)));
        lo = lo == null ? v : Math.min(lo, v); hi = hi == null ? v : Math.max(hi, v);
        fill.style.left = `${lo * 100}%`; fill.style.width = `${(hi - lo) * 100}%`;
        if (hi - lo >= SNIP_CUT) {
          cut = true;
          g = null;
          held.remove(); toolEl('scissors')?.classList.remove('is-out');
          snipped(id, sachetEl);
        }
      };
      const up = () => {
        if (cut) return;
        held.remove(); toolEl('scissors')?.classList.remove('is-out');
      };
      move(e);
      return { move, up };
    }
    /**
     * The bag's cut: the foil strip flies off, then on its own the bag shrinks, flies to its tray and tips over it,
     * its powder pouring in while the bar fills one by one (as far as the carbs pay, all paid now), then it's gone.
     */
    function snipped(id, bagEl) {
      haptic('place');
      bagEl.classList.add('is-cut');
      busy = true;   // hands off while it pours
      const r = G.fill(st.stock, id, st.carbs);
      if (r.error) { setTimeout(() => { busy = false; snipping = null; drawPrep(); }, 500); return; }
      const from = Number(st.stock[id]) || 0;
      spend(r.cost, r.stock);
      // where it tips: its mouth (the top, turned down to the left) just over the tray's middle
      const tr = TRAYS[id];
      const tx = tr.l + tr.w / 2; const ty = tr.t + tr.h / 2;
      const W = 17;                                   // its width when small, % of the scene's
      const half = W * 360 / 302 / 2;                 // half its height, in % of the scene's width
      const mouth = { x: tx, y: tr.t - 6 };
      const cx = mouth.x + 0.866 * half; const cy = mouth.y - 0.5 * half / ASPECT;
      const wellEl = scene.querySelector(`[data-slot="${id}"]`);
      const bars = wellEl?.querySelectorAll('.gs-stockbar i') || [];
      const pour = document.createElement('img');
      pour.className = 'gs-bagpour'; pour.src = `${ART}/pour-${id}.webp`; pour.alt = '';
      pour.style.cssText = `left:${mouth.x}%;top:${mouth.y}%;height:${ty - mouth.y}%`;
      const puff = document.createElement('img');
      puff.className = 'gs-bagpuff'; puff.src = `${ART}/puff-${id}.webp`; puff.alt = '';
      puff.style.cssText = `left:${tx}%;top:${ty}%`;
      setTimeout(() => {
        // fly: from the middle of the screen, small, to over the tray, tipped
        scene.querySelector('.gs-veil')?.classList.add('is-off');
        bagEl.classList.add('is-flying');
        bagEl.style.left = `${cx - W / 2}%`;
        bagEl.style.top = `${cy - half / ASPECT}%`;
        bagEl.style.width = `${W}%`;
        bagEl.style.setProperty('--rot', '-120deg');
      }, 380);
      setTimeout(() => {
        // pour: the powder falls, a puff where it lands, the tray's full again and its bar fills
        scene.append(pour, puff);
        sfx.play('restock');
        wellEl?.classList.remove('is-out-of');
        wellEl?.querySelector('.gs-well-plus')?.remove();
        for (let k = 0; k < r.n; k++) {
          setTimeout(() => { bars[from + k]?.classList.add('is-on'); haptic('select'); }, k * BAR_MS);
        }
      }, 1050);
      const end = 1050 + r.n * BAR_MS + 250;
      setTimeout(() => { pour.classList.add('is-off'); bagEl.classList.add('is-gone'); }, end);
      setTimeout(() => {
        busy = false;
        snipping = null;
        dumped = false;
        drawPrep();
        // what it cost floats up from the tray
        const again = root.querySelector(`[data-slot="${id}"]`);
        const tag = document.createElement('b');
        tag.className = 'gs-cost-pop'; tag.textContent = `-${r.cost} g`;
        again?.append(tag);
      }, end + 300);
    }

    // ---- a tap on a jar or a tray: a refill with carbs (a powder's comes in a bag to snip, filling its bar) ----
    function refill(id) {
      const have = Number(st.stock[id]) || 0;
      if (G.INGREDIENTS[id].free || have >= STOCK_BAR) { haptic('refuse'); sfx.play('refuse'); return; }
      if (POWDERS.includes(id)) {
        // a powder comes in a bag: snip it open and it pours itself in (as far as the carbs pay for)
        if (G.fill(st.stock, id, st.carbs).error) { haptic('refuse'); sfx.play('refuse'); flash(root.querySelector('.gs-carbs')); return; }
        haptic('tick'); sfx.play('ui-tap');
        snipping = id;
        drawPrep();
        return;
      }
      const r = G.buy(st.stock, id, 1, st.carbs);
      if (r.error) { haptic('refuse'); sfx.play('refuse'); flash(root.querySelector('.gs-carbs')); return; }
      haptic('tick'); sfx.play('restock');
      spend(r.cost, r.stock);
      dumped = false;
      drawPrep();
      // the cost floats up from it, its bar springs
      const again = root.querySelector(`[data-slot="${id}"]`);
      again?.classList.add('is-bought');
      const tag = document.createElement('b');
      tag.className = 'gs-cost-pop'; tag.textContent = `-${r.cost} g`;
      again?.append(tag);
    }

    scene.onpointerdown = (e) => {
      if (busy || g || e.button > 0) return;
      if (e.target.closest('.gs-dock')) return;
      const s = step();
      const slot = e.target.closest('[data-slot]');
      const tool = e.target.closest('[data-tool]');
      if (snipping) {
        g = snip(e);
      } else if (!run && !result) {
        // before starting: a tap on a jar, the vial or a well restocks it
        if (slot) { const p0 = at(e); g = { move: () => {}, up: (ev) => { const p = at(ev); if (Math.hypot(p.x - p0.x, p.y - p0.y) < 4) refill(slot.dataset.slot); } }; }
      } else if (run && s) {
        const glassStep = s.kind === 'pour' && how(s.ing) === 'glass';
        if (e.target.closest('[data-glass]') && (glassStep || run.glass > 0)) {
          if (glassStep) g = dragGlass(e, s);
        } else if (s.kind === 'stir') g = stir(e, s);
        else if (s.kind === 'seal') g = seal(e);
        else if (ADDS.has(s.kind) && how(s.ing) === 'shake' && slot?.dataset.slot === s.ing) g = dragIngredient(e, slot, s);
        else if (s.kind === 'drops' && (tool?.dataset.tool === 'dropper' || slot?.dataset.slot === 'caffeine')) g = dragIngredient(e, toolEl('dropper'), s);
        else if (s.kind === 'fill' && !run.pouch && e.target.closest('[data-box]')) g = dragPouch(e);
        else if (e.target.closest('[data-jug]')) g = dragJug(e, s);
      }
      if (!g) return;
      e.preventDefault();
      try { scene.setPointerCapture(e.pointerId); } catch { /* a pointer the browser doesn't track */ }
    };
    scene.onpointermove = (e) => { if (g) g.move(e); };
    const end = (e) => { const d = g; g = null; d?.up(e); };
    scene.onpointerup = end;
    scene.onpointercancel = end;
  }

  // ---- taps ----
  root.addEventListener('click', (e) => {
    const b = (sel) => e.target.closest(sel);
    const musicBtn = b('[data-gs-music]');
    if (musicBtn) {
      const on = sfx.toggleMusic();
      musicBtn.classList.toggle('is-off', !on); musicBtn.setAttribute('aria-pressed', String(on));
      sfx.play('ui-tap');
      return;
    }
    if (b('[data-gs-up]')) {
      sfx.play('ui-tap');
      openUpgrade({ target: 'gel-stand', name: t('gels.title'), art: standArt });
      return;
    }
    if (b('[data-gs-back]')) {
      sfx.play('ui-tap');
      if (!gel) { closeLayer(root); return; }
      gel = null; run = null; result = null; snipping = null; drawMenu(); return;
    }
    const pick = b('[data-gs-pick]');
    if (pick) {
      const g = G.gelById(pick.dataset.gsPick);
      if (g.level > level) { haptic('refuse'); sfx.play('refuse'); return; }
      haptic('tick'); sfx.play('ui-tap'); gel = g; run = null; result = null; dumped = false; snipping = null; drawPrep(); return;
    }
    const startBtn = b('[data-gs-start]');
    if (startBtn) {
      if (snipping) return;
      const r = G.start(st.stock, gel, level);
      if (r.error) {
        // something's short: the slots to tap say so
        haptic('refuse'); sfx.play('refuse');
        root.querySelectorAll('[data-slot].is-short').forEach((el) => flash(el));
        return;
      }
      set({ stock: r.stock });
      dumped = false;
      run = { i: 0, below: 0, scores: [], layers: [], mix: 0, fill: 0, salt: 0, drops: 0, stirAcc: 0, stirT0: 0, glass: 0, glassC: '', pouch: false };
      beginStep();
      haptic('place'); sfx.play('ui-tap'); drawPrep(); return;
    }
    if (b('[data-gs-again]') || b('[data-gs-menu]')) sfx.play('ui-tap');
    if (b('[data-gs-again]')) { result = null; run = null; dumped = false; drawPrep(); return; }
    if (b('[data-gs-menu]')) { gel = null; result = null; drawMenu(); }
  });

  drawMenu();
  return root;
}
