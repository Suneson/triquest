// gel-stand-view.js — the gel stand's screens (docs/KITCHEN.md, "The gel stand"): the menu of final gels,
// then the prep view, then the result. The rules are js/core/gel-stand.js.
//
// The prep view is one scene on the stand's background (icons/Gels/prep-bg.webp, 9:16), made for one thumb:
// the recipe and what to do now on the wall screen, the jug and the pouch on the counter (the sink to pour
// the jug away and start again), this gel's ingredients on the tray below (a stock bar each, tap one that's
// short to restock it with carbs), the buttons on the panel at the very bottom. Everything is dragged: an
// ingredient over the jug (held to pour, shaken, or dropped), round the jug to stir, the jug over the pouch
// to fill it, across the sealer to seal it. Letting go ends a step: it's judged and the next one starts.
// The jug's liquid is drawn over its picture (multiply), so its lines and shine show through.
//
// For now it's a preview (?gels=1, &lvl=1-6): the stock, the bag and the carbs are kept on this device
// (settings.gelStand) until the server side exists.

import { openLayer, closeLayer } from './nav.js';
import { esc } from './ui.js';
import { t } from '../core/i18n.js';
import { haptic } from './haptics.js';
import * as store from './store.js';
import * as G from '../core/gel-stand.js';

const ART = 'icons/Gels';
const KEY = 'gelStand';
const PREVIEW_CARBS = 600;
const PREVIEW_COINS = 2000;   // the preview's own coins, for upgrades (the server's wallet later)
const COIN = 'icons/Pixelart/GEAR/coin.png';
const POUR_RATE = 0.22;   // jug per second while a bottle's held over it
const FILL_RATE = 0.32;   // pouch per second while the jug's held over it
const SHAKE_K = 0.0045;   // jug level per 1% of the scene's width shaken (maltodextrin, fructose)
const SALT_K = 0.007;     // the salt meter per 1% shaken
const DROP_MS = 420;      // a caffeine drop this often while the dropper's over the jug
const DROP_FIRST = 220;   // and the first this soon after it gets there
const STEP_BEAT = 450;    // a step's pop shows this long, then the next step
const STOCK_BAR = 4;      // a tray slot's stock bar: four to a refill
const SHAKEN = new Set(['malto', 'fructose', 'salt']);
/** What you hold, for those that look different in the hand (a shaker, a squeeze bottle, the dropper). */
const HELD = { salt: 'hand-salt', malto: 'hand-malto', fructose: 'hand-fructose', honey: 'hand-honey', caffeine: 'tool-dropper' };
/** What falls from it. */
const STREAM = { water: 'stream-water', honey: 'stream-honey', maple: 'stream-maple', beet: 'stream-beet', malto: 'stream-powder',
  fructose: 'stream-powder', salt: 'stream-salt', caffeine: 'stream-drops' };

const num = (v, d) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const load = () => {
  const s = settled();
  return { ...G.normalise(s), carbs: num(s.carbs, PREVIEW_CARBS), coins: num(s.coins, PREVIEW_COINS), level: G.levelOf(s), build: G.buildOf(s) };
};
const save = (s) => store.setSetting(KEY, { stock: s.stock, bag: s.bag, carbs: s.carbs, coins: s.coins, level: s.level, build: s.build || null });
/** "1 h 52 min", "4 min 10 s". */
const hm = (ms) => {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return h ? t('gels.hm', { h, m }) : t('gels.ms', { m, s: s % 60 });
};

/** What's saved, with a build that has finished turned into its level (saved, and the base told). */
function settled() {
  const s = store.getSettings()[KEY] || {};
  const n = G.settleBuild(s, Date.now());
  if (n !== s) {
    store.setSetting(KEY, n);
    haptic('levelUp');
    // after this call: it may be asked mid-draw, and the base redraws on this
    setTimeout(() => document.dispatchEvent(new CustomEvent('gels-changed')), 0);
  }
  return n;
}

/** The stand's level (1-6), as the base draws it. */
export const standLevel = () => G.levelOf(settled());
/** The stand's build: { to, left } (ms left), or null. */
export function standBuild() {
  const s = settled();
  const b = G.buildOf(s);
  return b ? { to: b.to, left: G.buildLeft(s, Date.now()) } : null;
}

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
  const root = openLayer('gel-stand', { className: 'gs-layer' });
  let st = load();
  const pinned = !!level;   // ?gels=1&lvl=: shown at that level, no upgrading
  level = level ? Math.max(1, Math.min(G.MAX_LEVEL, Math.floor(level) || 1)) : st.level;
  let gel = null;          // the gel picked
  let run = null;          // making it: { i, below, scores, layers, mix, fill, salt, drops, stirAcc, stirT0 }
  let result = null;       // { stars, bp }
  let busy = false;        // a step's pop is showing
  let dumped = false;      // the jug was just poured away in the sink

  const set = (patch) => { st = { ...st, ...patch }; save(st); };

  function frame(body, cls) {
    root.innerHTML = `<div class="gs ${cls}">
      <header class="gs-bar">
        <button class="gs-x" data-gs-back aria-label="${esc(t(gel ? 'gels.toMenu' : 'gels.close'))}">${gel ? '‹' : '×'}</button>
        <h2>${esc(t('gels.title'))} <small>${esc(t('gels.level', { n: level }))}</small></h2>
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

  /** Taking the stand up a level: coins at once, then a builder's hours (preview: the preview's coins). */
  function upgradeHtml() {
    if (pinned) return '';
    if (st.build) {
      const left = Math.max(0, st.build.done - Date.now());
      return `<div class="gs-up is-building">
        ${img(standArt(st.build.to), 'gs-up-art')}
        <span><b>${esc(t('gels.building', { n: st.build.to }))}</b>
        <small><span data-gs-left class="data-num">${esc(hm(left))}</span> · ${esc(t('gels.buildKeeps'))}</small></span>
        <button class="gs-up-go is-alt" data-gs-finish>${esc(t('gels.finishNow'))}</button></div>`;
    }
    const up = G.nextUpgrade(level);
    if (!up) return `<p class="gs-up is-top">${esc(t('gels.topLevel'))}</p>`;
    const short = st.coins < up.coins;
    return `<div class="gs-up${short ? ' is-short' : ''}">
      ${img(standArt(level + 1), 'gs-up-art')}
      <span><b>${esc(t('gels.upgrade', { n: level + 1 }))}</b>
      <small class="gs-up-cost"><img src="${COIN}" alt=""><b class="data-num">${up.coins}</b> · ${esc(t('gels.buildHours', { h: up.hours }))}</small>
      <small>${esc(t('gels.coinsHave', { n: st.coins }))}</small></span>
      <button class="gs-up-go" data-gs-up ${short ? 'aria-disabled="true"' : ''}>${esc(t('gels.upgradeGo'))}</button></div>`;
  }
  // the build's clock, while the stand is open
  const clock = setInterval(() => {
    if (!root.isConnected) { clearInterval(clock); return; }
    if (!st.build) return;
    const before = st.level;
    st = load();
    if (st.level !== before) { if (!pinned) level = st.level; if (!gel) drawMenu(); return; }
    const el = root.querySelector('[data-gs-left]');
    if (el) el.textContent = hm(Math.max(0, st.build.done - Date.now()));
  }, 1000);

  // ---- the prep view ----
  // One 9:16 scene on prep-bg.webp. Its painted places, in % of the scene: the wall screen 13-87% across,
  // 16-37% down; the counter top 48-60% (the sink its left 23%); the tray's floor 72-81%; the button panel
  // 87-99%. Everything is placed in % of the scene and sized in cqw, and every gesture works in scene %.
  const step = () => (run ? gel.steps[run.i] : null);
  const jugLevel = () => (run ? run.layers.reduce((n, l) => n + l.h, 0) : 0);
  /** The ingredients this gel needs, in shelf order (water too when it's poured). */
  const trayIngs = () => G.SHELF.filter((id) => gel.uses[id] || (id === 'water' && gel.steps.some((s) => s.ing === 'water')));
  /** How an ingredient goes in: poured (held over the jug), shaken, or dropped. */
  const how = (ing) => (SHAKEN.has(ing) ? 'shake' : ing === 'caffeine' ? 'drops' : 'pour');
  const heldArt = (ing) => HELD[ing] || `ing-${ing}`;
  const ADDS = new Set(['pour', 'salt', 'drops']);   // the steps that take an ingredient from the tray

  function stepText(s) {
    if (s.kind === 'pour') return t(how(s.ing) === 'shake' ? 'gels.step.shake' : 'gels.step.pour', { ing: ingName(s.ing).toLocaleLowerCase() });
    if (s.kind === 'drops') return t('gels.step.drops', { n: s.n });
    if (s.kind === 'stir') return t('gels.step.stir', { n: s.turns });
    return t(`gels.step.${s.kind}`);
  }
  function hintText(s) {
    if (s.kind === 'pour' || s.kind === 'salt') return t(how(s.ing) === 'shake' ? 'gels.hint.shake' : 'gels.hint.pour');
    if (s.kind === 'drops') return t('gels.hint.drops', { n: s.n });
    return t(`gels.hint.${s.kind}`);
  }

  /** The wall screen: the gel, its boost, the steps as dots, and what to do now (or how it went). */
  function screenHtml() {
    const total = gel.steps.length;
    const now = step();
    const doneN = result ? total : run ? run.i : 0;
    const dots = `<span class="gs-dots">${gel.steps.map((_, i) => `<i class="${i < doneN ? 'is-done' : i === doneN && run ? 'is-now' : ''}"></i>`).join('')}</span>`;
    let body;
    if (result) {
      body = `${starsHtml(result.stars)}<p class="gs-step">${esc(t('gels.boost', { n: pct(result.bp) }))}</p><p class="gs-hint">${esc(t('gels.bagged'))}</p>`;
    } else if (now) {
      body = `${dots}<p class="gs-step">${esc(t('gels.stepOf', { i: run.i + 1, n: total, step: stepText(now) }))}</p><p class="gs-hint">${esc(hintText(now))}</p>`;
    } else {
      const short = G.missingCost(st.stock, gel) > 0;
      body = `${dots}<p class="gs-step">${esc(dumped ? t('gels.dumped') : t('gels.ready', { n: total }))}</p>
        <p class="gs-hint">${esc(t(short ? 'gels.restock' : 'gels.readyGo'))}</p>`;
    }
    return `<div class="gs-screen" aria-live="polite">
      <div class="gs-screen-top">${gimg(`gel-${gel.id}`, 'gs-screen-art')}
        <h3>${esc(result ? t('gels.made', { name: gelName(gel) }) : gelName(gel))}</h3>
        ${result ? '' : `<span class="gs-boost">${esc(t('gels.boost', { n: pct(gel.boostBp) }))}</span>`}</div>
      ${body}</div>`;
  }

  /** The tray: only this gel's ingredients, each with a stock bar (4 to a refill) and a + when it's short. */
  function trayHtml() {
    const ids = trayIngs();
    const now = step();
    return ids.map((id, k) => {
      const ing = G.INGREDIENTS[id];
      const have = Number(st.stock[id]) || 0;
      const need = gel.uses[id] || 0;
      const active = !!(now && ADDS.has(now.kind) && now.ing === id);
      const short = !ing.free && !run && !result && have < need;
      const bar = ing.free ? '' : `<span class="gs-stockbar${have === 0 ? ' is-empty' : have < Math.max(need, 2) ? ' is-low' : ''}">${
        [1, 2, 3, 4].map((i) => `<i class="${i <= have ? 'is-on' : ''}"></i>`).join('')}</span>`;
      const label = ing.free ? ingName(id) : short || have === 0 ? t('gels.buyAria', { ing: ingName(id), n: ing.cost }) : t('gels.slotAria', { ing: ingName(id), n: have });
      return `<button class="gs-slot${active ? ' is-now' : ''}${short ? ' is-short' : ''}" data-slot="${id}" style="--x:${(8 + (k + 0.5) * 84 / ids.length).toFixed(2)}%" aria-label="${esc(label)}">
        ${gimg(heldArt(id), 'gs-slot-art')}${bar}
        ${short ? `<span class="gs-plus">${gimg('ui-plus')}</span>` : ''}</button>`;
    }).join('');
  }

  /** The counter: the sink's glow, the jug (with its liquid), the meter beside it, the pouch and the step's tool. */
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
    return `<div class="gs-sink"></div>${gimg('fx-drain', 'gs-drain')}
      <div class="gs-jug" data-jug role="img" aria-label="${esc(t('gels.jugAria'))}">${gimg('tool-jug')}
        <span class="gs-liquid" style="--mix:${run?.mix || 0};--total:${jugLevel().toFixed(4)}">${layers}<em></em></span>
        ${kind === 'stir' ? '<svg class="gs-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" pathLength="1" style="--p:0"/></svg>' : ''}
        ${gimg('fx-splash', 'gs-splash')}</div>
      ${meter}
      <div class="gs-pouch${result ? ' is-sealed is-made' : ''}">${gimg('pouch-0', 'gs-pouch-art')}
        <span class="gs-pfill"><i style="--f:${run?.fill || 0}"></i></span>
        ${kind === 'fill' ? `<i class="gs-pline" style="--to:${s.to}"></i>` : ''}
        ${gimg(`gel-${gel.id}`, 'gs-final')}</div>
      ${kind === 'seal' ? `<div class="gs-sealer">${gimg('sealer-open', 'gs-sealer-open')}${gimg('sealer-closed', 'gs-sealer-shut')}<i class="gs-sealbar"><b></b></i></div>` : ''}
      ${kind === 'stir' ? gimg('tool-whisk', 'gs-whisk') : ''}
      ${result ? `${gimg('fx-ring', 'gs-ring-fx')}${gimg('fx-sparkle', 'gs-sparkle-fx')}` : ''}`;
  }

  function dockHtml() {
    if (result) {
      return `<button class="gs-btn is-alt" data-gs-menu>${esc(t('gels.toMenu'))}</button>
        <button class="gs-btn" data-gs-again>${esc(t('gels.again'))}</button>`;
    }
    if (run) return `<p class="gs-status">${esc(t('gels.making', { name: gelName(gel) }))}</p>`;
    return `<button class="gs-btn" data-gs-start ${G.missingCost(st.stock, gel) ? 'aria-disabled="true"' : ''}>${esc(t('gels.start'))}</button>`;
  }

  function drawPrep() {
    frame(`<div class="gs-body"><div class="gs-scene" style="--gel:${gel.liquid}">
        ${screenHtml()}
        <div class="gs-counter">${counterHtml()}</div>
        <div class="gs-tray">${trayHtml()}</div>
        <span class="gs-pop" aria-hidden="true"></span>
        <div class="gs-dock">${dockHtml()}</div>
      </div></div>`, 'is-prep');
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
        run = null;
      } else beginStep();
      drawPrep();
    }, STEP_BEAT);
  }
  /** Set up the step that's starting: a pour gets its own layer in the jug. */
  function beginStep() {
    const s = step();
    run.below = jugLevel();
    if (s.kind === 'pour') run.layers.push({ c: G.INGREDIENTS[s.ing].colour, h: 0 });
    if (s.kind === 'salt') run.salt = 0;
    if (s.kind === 'drops') run.drops = 0;
  }
  /** Pour the jug away in the sink: the ingredients are gone, back to the start. */
  function dump() {
    haptic('refuse');
    run = null; dumped = true;
    drawPrep();
    flash('.gs-drain');
  }

  /** Every gesture on the scene: drag an ingredient, drag the jug, stir, swipe the sealer, tap a tray slot. */
  function bindScene() {
    const scene = root.querySelector('.gs-scene');
    if (!scene) return;
    const counter = scene.querySelector('.gs-counter');
    const jugEl = scene.querySelector('.gs-jug');
    const box = () => scene.getBoundingClientRect();
    /** A pointer in scene % (x across, y down). */
    const at = (e) => { const r = box(); return { x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 }; };
    /** An element's box in scene %. */
    const rectOf = (el) => {
      const r = box(); const b = el.getBoundingClientRect();
      return { l: (b.left - r.left) / r.width * 100, r: (b.right - r.left) / r.width * 100, t: (b.top - r.top) / r.height * 100, b: (b.bottom - r.top) / r.height * 100 };
    };
    const ASPECT = 16 / 9;   // 1% of the scene's height is this many % of its width
    const liquidEl = () => jugEl.querySelector('.gs-liquid');
    const meterEl = () => scene.querySelector('.gs-meter');
    /** The jug's liquid surface, in scene % down, for its level. */
    const surfaceY = (jr, level) => jr.b - (jr.b - jr.t) * (0.05 + 0.86 * level);
    let g = null;

    function drawJug() {
      const liq = liquidEl();
      const top = run.layers[run.layers.length - 1];
      if (top) liq.querySelectorAll('i')[run.layers.length - 1]?.style.setProperty('--h', top.h.toFixed(4));
      liq.style.setProperty('--total', jugLevel().toFixed(4));
    }

    // ---- an ingredient from the tray, over the jug ----
    function dragIngredient(e, slot, s) {
      const ing = s.ing;
      const mode = how(ing);
      const jr = rectOf(jugEl);
      const held = document.createElement('img');
      held.className = `gs-held is-${mode}`; held.src = `${ART}/${heldArt(ing)}.webp`; held.alt = ''; held.draggable = false;
      const flow = document.createElement('img');
      flow.className = `gs-flow is-${mode}`; flow.src = `${ART}/${STREAM[ing]}.webp`; flow.alt = '';
      scene.append(flow, held);
      slot.classList.add('is-out');
      // the held thing's height in % of the scene's width: smaller over the jug, so the wall screen still reads
      const heightCqw = mode === 'pour' ? 17 : 14;
      held.style.height = `${heightCqw}cqw`;
      let over = false; let amount = 0; let lastX = null; let shookAt = 0; let raf = 0; let tickAt = 0;
      // time held over the jug, in seconds: what's poured and dropped comes from this, never from frames drawn
      let heldFor = 0; let since = 0;
      const overTime = (now) => heldFor + (over && since ? (now - since) / 1000 : 0);
      const cx = (jr.l + jr.r) / 2;
      const pourX = cx - 3;                // where a stream falls into the jug
      const spoutY = jr.t - 2;             // and where it starts

      const place = (x, y, rot) => { held.style.left = `${x}%`; held.style.top = `${y}%`; held.style.setProperty('--rot', `${rot}deg`); };
      const showFlow = (on, x, top, bottom, w) => {
        flow.classList.toggle('is-on', on);
        if (!on) return;
        flow.style.left = `${x}%`; flow.style.top = `${top}%`; flow.style.height = `${Math.max(0, bottom - top)}%`; flow.style.width = `${w}cqw`;
      };
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
      /** Bring what's gone in up to now (pouring and dropping go by the time held over the jug). */
      const catchUp = (now) => {
        const secs = overTime(now);
        if (mode === 'pour') { amount = POUR_RATE * secs; apply(); }
        if (mode === 'drops') {
          const n = secs * 1000 < DROP_FIRST ? 0 : 1 + Math.floor((secs * 1000 - DROP_FIRST) / DROP_MS);
          if (n > run.drops) {
            run.drops = n; haptic('select');
            meterEl()?.querySelectorAll('i').forEach((el, i) => el.classList.toggle('is-on', i < run.drops));
            flash(flow);
          }
        }
      };
      const loop = (now) => {
        raf = requestAnimationFrame(loop);
        if (!over) return;
        catchUp(now);
        if (mode === 'shake') showFlow(now - shookAt < 140, parseFloat(held.style.left), parseFloat(held.style.top) + heightCqw / 2 / ASPECT, surfaceY(jr, jugLevel()), 5);
      };
      const move = (ev) => {
        const p = at(ev);
        const was = over;
        over = p.x > jr.l - 10 && p.x < jr.r + 10 && p.y > jr.t - 26 && p.y < jr.b + 4;
        const now = performance.now();
        if (over && !was) { haptic('tick'); since = now; }
        if (!over && was) { heldFor += (now - since) / 1000; since = 0; }
        held.classList.toggle('is-over', over);
        if (!over) {
          place(p.x, p.y - 7, 0); showFlow(false); lastX = null;
          return;
        }
        if (mode === 'pour') {
          // tipped over the jug: its top (the spout) right over the stream
          const rot = -105; const half = heightCqw / 2;
          place(pourX + 0.966 * half, spoutY - 0.259 * half / ASPECT, rot);
          showFlow(true, pourX, spoutY, surfaceY(jr, jugLevel()), mode === 'pour' && ing === 'water' ? 3.4 : 4.2);
        } else if (mode === 'shake') {
          // upside down over the jug, following the finger side to side; shaking is what puts it in
          const x = Math.max(jr.l + 4, Math.min(jr.r - 4, p.x));
          const dx = lastX == null ? 0 : Math.max(-8, Math.min(8, x - lastX));
          lastX = x;
          place(x, jr.t - 4.5, 180 + Math.max(-22, Math.min(22, dx * 6)));
          if (Math.abs(dx) > 0.3) { amount += Math.abs(dx) * (s.kind === 'salt' ? SALT_K : SHAKE_K); shookAt = performance.now(); apply(); }
        } else {
          // the dropper, upright over the middle of the jug
          place(cx, jr.t - 4.5, 0);
          const tip = jr.t - 4.5 + heightCqw / 2 / ASPECT;
          flow.style.left = `${cx}%`; flow.style.top = `${tip}%`; flow.style.height = `${Math.max(2, surfaceY(jr, jugLevel()) - tip)}%`; flow.style.width = '2cqw';
        }
      };
      const up = () => {
        cancelAnimationFrame(raf);
        if (over) catchUp(performance.now());
        held.remove(); flow.remove();
        slot.classList.remove('is-out');
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

    // ---- the jug: to the sink to pour it away, or (filling) over the pouch ----
    function dragJug(e, s) {
      const filling = s.kind === 'fill';
      const home = rectOf(jugEl);
      const pr = rectOf(scene.querySelector('.gs-pouch'));
      const sink = { l: 0, r: 26, t: 42, b: 64 };
      const flow = document.createElement('img');
      flow.className = 'gs-flow is-pour'; flow.src = `${ART}/stream-gel.webp`; flow.alt = '';
      scene.append(flow);
      jugEl.classList.add('is-held');
      const hCqw = (home.b - home.t) * 16 / 9;   // the jug's height in % of the scene's width
      const fillEl = scene.querySelector('.gs-pfill i');
      const startLevel = jugLevel();
      let where = null; let raf = 0; let tickAt = 0;
      let pouredFor = 0; let since = 0;   // seconds held over the pouch: the fill comes from this
      // moved in scene %: a translate's % is of the jug's own box, so it's scaled by the jug's size
      const moveTo = (x, y, rot) => {
        const w = home.r - home.l; const h = home.b - home.t;
        jugEl.style.setProperty('--tx', `${((x - (home.l + home.r) / 2) / w * 100).toFixed(2)}%`);
        jugEl.style.setProperty('--ty', `${((y - (home.t + home.b) / 2) / h * 100).toFixed(2)}%`);
        jugEl.style.setProperty('--rot', `${rot}deg`);
      };
      const fillTo = (now) => {
        run.fill = Math.min(1, FILL_RATE * (pouredFor + (since ? (now - since) / 1000 : 0)));
        fillEl.style.setProperty('--f', run.fill.toFixed(4));
        const left = Math.max(0, startLevel * (1 - run.fill / 0.95));   // the jug empties into the pouch
        run.layers = [{ c: gel.liquid, h: left }];
        liquidEl().querySelector('i')?.style.setProperty('--h', left.toFixed(4));
        liquidEl().style.setProperty('--total', left.toFixed(4));
        if (run.fill >= tickAt + 0.04) { tickAt = run.fill; haptic('select'); }
        // the stream lands on the pouch's filling
        const surf = pr.b - (pr.b - pr.t) * (0.07 + 0.73 * run.fill);
        flow.style.height = `${Math.max(0, surf - parseFloat(flow.style.top))}%`;
      };
      const loop = (now) => {
        raf = requestAnimationFrame(loop);
        if (where === 'pouch' && filling) fillTo(now);
      };
      const move = (ev) => {
        const p = at(ev);
        const half = hCqw / 2;
        const was = where;
        where = p.x < sink.r && p.y > sink.t && p.y < sink.b && jugLevel() > 0 ? 'sink'
          : filling && p.x > pr.l - 14 && p.y < pr.b && p.y > pr.t - 30 ? 'pouch' : null;
        if (where !== was && where) haptic('tick');
        const now = performance.now();
        if (filling && where === 'pouch' && was !== 'pouch') since = now;
        if (filling && was === 'pouch' && where !== 'pouch') { pouredFor += (now - since) / 1000; since = 0; }
        scene.classList.toggle('is-over-sink', where === 'sink');
        if (where === 'sink') {
          // tipped to the left over the basin
          const sx = 11; const sy = 46;
          moveTo(sx + 0.966 * half, sy - 0.259 * half / ASPECT - 4, -105);
          flow.classList.add('is-on'); flow.style.left = `${sx}%`; flow.style.top = `${sy - 4}%`; flow.style.height = '9%'; flow.style.width = '4.5cqw';
        } else if (where === 'pouch') {
          // tipped to the right, its spout over the pouch's open top
          const px = (pr.l + pr.r) / 2; const py = pr.t - 5;
          moveTo(px - 0.966 * half, py - 0.259 * half / ASPECT, 105);
          flow.classList.add('is-on'); flow.style.left = `${px}%`; flow.style.top = `${py}%`; flow.style.width = '4.5cqw';
        } else {
          moveTo(p.x, p.y - 4, 0);
          flow.classList.remove('is-on');
        }
      };
      const up = () => {
        cancelAnimationFrame(raf);
        if (filling && where === 'pouch') fillTo(performance.now());
        flow.remove();
        scene.classList.remove('is-over-sink');
        jugEl.classList.remove('is-held');
        moveTo((home.l + home.r) / 2, (home.t + home.b) / 2, 0);
        if (where === 'sink') { dump(); return; }
        if (filling && run.fill > 0) finishStep(G.scorePour(run.fill, s.to, 0), run.fill, s.to);
      };
      raf = requestAnimationFrame(loop);
      move(e);
      return { move, up };
    }

    // ---- stirring round the jug ----
    function stir(e, s) {
      const ring = scene.querySelector('.gs-ring circle');
      const whisk = scene.querySelector('.gs-whisk');
      const jr = rectOf(jugEl);
      const cx = jr.l + (jr.r - jr.l) * 0.43; const cy = jr.t + (jr.b - jr.t) * 0.6;
      // the angle round the jug, measured in screen pixels so it's a true circle
      const ang = (p) => Math.atan2((p.y - cy) * 16 / 9, p.x - cx);
      let prev = ang(at(e));
      if (!run.stirT0) run.stirT0 = performance.now();
      counter.classList.add('is-stirring');
      const move = (ev) => {
        const p = at(ev);
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
          run.layers = [{ c: gel.liquid, h: jugLevel() }]; run.mix = 0;
          finishStep(G.scoreStir(turns, (performance.now() - run.stirT0) / 1000), 1, 1);
        }
      };
      move(e);
      return { move, up: () => counter.classList.remove('is-stirring') };
    }

    // ---- swiping across the sealer ----
    function seal(e) {
      const sealer = scene.querySelector('.gs-sealer');
      const bar = sealer.querySelector('.gs-sealbar b');
      const sr = rectOf(sealer);
      let lo = null; let hi = null;
      const move = (ev) => {
        const v = Math.max(0, Math.min(1, (at(ev).x - sr.l) / (sr.r - sr.l)));
        lo = lo == null ? v : Math.min(lo, v); hi = hi == null ? v : Math.max(hi, v);
        bar.style.left = `${lo * 100}%`; bar.style.width = `${(hi - lo) * 100}%`;
      };
      const up = () => {
        const cover = (hi ?? 0) - (lo ?? 0);
        if (cover < 0.15) { bar.style.width = '0'; return; }   // a tap, not a swipe: try again
        sealer.classList.add('is-shut');                        // the jaws snap shut
        scene.querySelector('.gs-pouch').classList.add('is-sealed');   // and the clear pouch is the gel
        finishStep(G.scoreSeal(cover), cover, 1);
      };
      move(e);
      return { move, up };
    }

    // ---- a tap on a tray slot: a refill with carbs ----
    function refill(slot) {
      const id = slot.dataset.slot;
      const have = Number(st.stock[id]) || 0;
      if (G.INGREDIENTS[id].free || have >= STOCK_BAR) { haptic('refuse'); return; }
      const r = G.buy(st.stock, id, 1, st.carbs);
      if (r.error) { haptic('refuse'); flash(root.querySelector('.gs-carbs')); return; }
      haptic('tick');
      set({ stock: r.stock, carbs: r.carbs });
      dumped = false;
      drawPrep();
      // the cost floats up from the slot, the bar springs
      const again = root.querySelector(`[data-slot="${id}"]`);
      again?.classList.add('is-bought');
      const tag = document.createElement('b');
      tag.className = 'gs-cost-pop'; tag.textContent = `-${r.cost} g`;
      again?.append(tag);
    }

    scene.onpointerdown = (e) => {
      if (busy || g || e.button > 0) return;
      const s = step();
      const slot = e.target.closest('[data-slot]');
      if (slot) {
        if (s && ADDS.has(s.kind) && s.ing === slot.dataset.slot) g = dragIngredient(e, slot, s);
        else if (!run && !result) { const p0 = at(e); g = { move: () => {}, up: (ev) => { const p = at(ev); if (Math.hypot(p.x - p0.x, p.y - p0.y) < 4) refill(slot); } }; }
      } else if (run && s && s.kind !== 'seal' && s.kind !== 'stir' && e.target.closest('[data-jug]')) g = dragJug(e, s);
      else if (run && s?.kind === 'stir' && !e.target.closest('.gs-dock')) g = stir(e, s);
      else if (run && s?.kind === 'seal' && !e.target.closest('.gs-dock')) g = seal(e);
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
    if (b('[data-gs-up]')) {
      const r = G.startUpgrade(st, st.coins, Date.now());
      if (r.error) { haptic('refuse'); return; }
      set({ build: r.build, coins: r.coins });
      haptic('place');
      document.dispatchEvent(new CustomEvent('gels-changed'));   // the base shows the build's clock
      drawMenu();
      return;
    }
    if (b('[data-gs-finish]')) {
      // preview only: finish the build now (coffee will cut it later)
      if (!st.build) return;
      set({ build: { ...st.build, done: Date.now() } });
      st = load(); level = st.level;
      drawMenu();
      return;
    }
    if (b('[data-gs-back]')) {
      if (!gel) { closeLayer(root); return; }
      gel = null; run = null; result = null; drawMenu(); return;
    }
    const pick = b('[data-gs-pick]');
    if (pick) {
      const g = G.gelById(pick.dataset.gsPick);
      if (g.level > level) { haptic('refuse'); return; }
      haptic('tick'); gel = g; run = null; result = null; dumped = false; drawPrep(); return;
    }
    const startBtn = b('[data-gs-start]');
    if (startBtn) {
      const r = G.start(st.stock, gel, level);
      if (r.error) {
        // something's short: the slots to tap say so
        haptic('refuse');
        root.querySelectorAll('.gs-slot.is-short').forEach((el) => flash(el));
        return;
      }
      set({ stock: r.stock });
      dumped = false;
      run = { i: 0, below: 0, scores: [], layers: [], mix: 0, fill: 0, salt: 0, drops: 0, stirAcc: 0, stirT0: 0 };
      beginStep();
      haptic('place'); drawPrep(); return;
    }
    if (b('[data-gs-again]')) { result = null; run = null; dumped = false; drawPrep(); return; }
    if (b('[data-gs-menu]')) { gel = null; result = null; drawMenu(); }
  });

  drawMenu();
  return root;
}
