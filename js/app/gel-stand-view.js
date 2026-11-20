// gel-stand-view.js — the gel stand's screens (docs/KITCHEN.md, "The gel stand"): the menu of final gels,
// then the prep view, then the result. The rules are js/core/gel-stand.js.
//
// The prep view is one scene on the stand's background (icons/Gels/prep-bg.webp, 9:16), everything placed
// in % of it so it lines up on any phone: the recipe card on the wall, the eight ingredients standing on
// the two shelves (stock, and a + to buy one), the jug and the pouch on the worktop, the buttons on the
// navy strip at the bottom. The jug's and pouch's liquid is drawn over their pictures (multiply), so
// their lines and shine show through. Sealing turns the clear pouch into the finished gel.
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
const POUR_RATE = 0.22;   // jug per second while you hold
const FILL_RATE = 0.32;   // pouch per second while you hold
const POWDER = new Set(['malto', 'fructose']);

const load = () => {
  const s = store.getSettings()[KEY] || {};
  const carbs = Number(s.carbs);
  return { ...G.normalise(s), carbs: Number.isFinite(carbs) ? carbs : PREVIEW_CARBS, level: G.levelOf(s) };
};
const save = (s) => store.setSetting(KEY, { stock: s.stock, bag: s.bag, carbs: s.carbs, level: s.level });

/** The stand's level (1-6), as the base draws it. */
export const standLevel = () => G.levelOf(store.getSettings()[KEY]);

const img = (src, cls = '') => `<img class="${cls}" src="${src}" alt="" draggable="false">`;
const gimg = (file, cls = '') => img(`${ART}/${file}.webp`, cls);
const pct = (bp) => Math.round(bp / 100);
const gelName = (g) => t(`gels.name.${g.id}`);
const ingName = (id) => t(`gels.ing.${id}`);
const standArt = (level) => `icons/Items/gel-stand-t${Math.max(1, Math.min(G.MAX_LEVEL, level))}-a.webp`;

function stepText(s) {
  if (s.kind === 'pour') return t('gels.step.pour', { ing: ingName(s.ing).toLocaleLowerCase() });
  if (s.kind === 'drops') return t('gels.step.drops', { n: s.n });
  if (s.kind === 'stir') return t('gels.step.stir', { n: s.turns });
  return t(`gels.step.${s.kind}`);
}
const judge = (score) => (score >= 0.95 ? 'perfect' : score >= 0.8 ? 'great' : score >= 0.5 ? 'good' : 'off');
const starsHtml = (n) => `<span class="gs-stars" role="img" aria-label="${esc(t('gels.starsAria', { n }))}">${
  [1, 2, 3].map((i) => `<i style="--i:${i}">${gimg(i <= n ? 'ui-star' : 'ui-star-empty')}</i>`).join('')}</span>`;

/**
 * The gel stand's window.
 * @param {{ level?: number }} opts  show it at this level (the ?gels=1&lvl= preview); else the stand's own
 */
export function openGelStand({ level = null } = {}) {
  const root = openLayer('gel-stand', { className: 'gs-layer' });
  let st = load();
  level = level ? Math.max(1, Math.min(G.MAX_LEVEL, Math.floor(level) || 1)) : st.level;
  let gel = null;          // the gel picked
  let run = null;          // making it: { i, scores, layers, mix, fill, sealed, drops, dial, stirAcc, stirT0 }
  let result = null;       // { stars, bp }
  let busy = false;        // a step's result is showing

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

  /** Taking the stand up a level. Preview: free and at once; later it's coins and a builder's job. */
  function upgradeHtml() {
    const up = G.nextUpgrade(level);
    if (!up) return `<p class="gs-up is-top">${esc(t('gels.topLevel'))}</p>`;
    return `<button class="gs-up" data-gs-up>
      ${img(standArt(level + 1), 'gs-up-art')}
      <span><b>${esc(t('gels.upgrade', { n: level + 1 }))}</b>
      <small>${esc(t('gels.upgradeCost', { coins: up.coins, h: up.hours }))}</small></span>
      <i>${esc(t('gels.upgradeGo'))}</i></button>`;
  }

  // ---- the prep view ----
  const step = () => (run ? gel.steps[run.i] : null);
  const jugLevel = () => (run ? run.layers.reduce((n, l) => n + l.h, 0) : 0);

  function shelf() {
    const now = step();
    return G.SHELF.map((id, k) => {
      const ing = G.INGREDIENTS[id];
      const need = gel.uses[id] || 0;
      const used = need || (id === 'water' && gel.steps.some((s) => s.ing === 'water'));
      const short = !run && !result && (Number(st.stock[id]) || 0) < need;
      return `<div class="gs-bin${used ? ' is-used' : ''}${short ? ' is-short' : ''}${now?.ing === id ? ' is-now' : ''}" style="--c:${k % 4};--r:${Math.floor(k / 4)}">
        ${gimg(`ing-${id}`, 'gs-ing')}
        <b class="gs-stock data-num">${ing.free ? '∞' : st.stock[id] || 0}</b>
        <small>${esc(ingName(id))}</small>
        ${ing.free ? '' : `<button class="gs-plus" data-gs-buy="${id}" aria-label="${esc(t('gels.buyAria', { ing: ingName(id), n: ing.cost }))}">${gimg('ui-plus')}</button>`}
      </div>`;
    }).join('');
  }

  function drawPrep() {
    const now = step();
    const total = gel.steps.length;
    const doneN = result ? total : run ? run.i : 0;
    const line = result ? t('gels.made', { name: gelName(gel) })
      : now ? t('gels.stepOf', { i: run.i + 1, n: total, step: stepText(now) })
        : t('gels.ready', { n: total });
    let strip;
    if (result) {
      strip = `<button class="gs-btn is-alt" data-gs-menu>${esc(t('gels.toMenu'))}</button>
        <button class="gs-btn" data-gs-again>${esc(t('gels.again'))}</button>`;
    } else if (!run) {
      const short = G.missingCost(st.stock, gel);
      strip = `${short ? `<button class="gs-btn is-alt" data-gs-fill ${short > st.carbs ? 'disabled' : ''}>${esc(t('gels.buyMissing', { n: short }))}</button>` : ''}
        <button class="gs-btn" data-gs-start ${short ? 'disabled' : ''}>${esc(t('gels.start'))}</button>`;
    } else if (now.kind === 'dial' || now.kind === 'drops') {
      strip = `<button class="gs-btn" data-gs-done>${esc(t('gels.done'))}</button>`;
    } else {
      strip = `<p class="gs-tip">${esc(t(`gels.hint.${now.kind}`, { n: now.n || now.turns || 0 }))}</p>`;
    }
    frame(`<div class="gs-body"><div class="gs-scene" style="--gel:${gel.liquid}">
        <div class="gs-recipe">${gimg(`gel-${gel.id}`, 'gs-recipe-art')}
          <div><h3>${esc(gelName(gel))} <span class="gs-boost">${esc(t('gels.boost', { n: pct(gel.boostBp) }))}</span></h3>
          <p aria-live="polite">${esc(line)}</p>
          <span class="gs-dots">${gel.steps.map((_, i) => `<i class="${i < doneN ? 'is-done' : i === doneN && run ? 'is-now' : ''}"></i>`).join('')}</span></div></div>
        ${shelf()}
        ${result ? resultHtml() : stage()}
        <span class="gs-pop" aria-hidden="true"></span>
        <div class="gs-strip">${strip}</div>
      </div></div>`, 'is-prep');
    bindStage();
  }

  const resultHtml = () => `<div class="gs-result">
      ${gimg('fx-ring', 'gs-ring-fx')}${gimg('fx-sparkle', 'gs-sparkle-fx')}${gimg(`gel-${gel.id}`, 'gs-made')}
      ${starsHtml(result.stars)}
      <p class="gs-boost">${esc(t('gels.boost', { n: pct(result.bp) }))}</p>
      <p class="gs-note">${esc(t('gels.bagged'))}</p></div>`;

  /** The worktop: the jug, the pouch and the tool the step needs. */
  function stage() {
    const s = step();
    const kind = s?.kind || 'idle';
    const layers = (run?.layers || []).map((l) => `<i style="--h:${l.h.toFixed(4)};--c:${l.c}"></i>`).join('');
    let tool = '';
    if (kind === 'pour') {
      tool = `<i class="gs-stream" style="--c:${G.INGREDIENTS[s.ing].colour}"></i><span class="gs-bottle">${gimg(`ing-${s.ing}`)}</span>`;
    } else if (kind === 'dial') {
      tool = `<div class="gs-dial" style="--v:${run.dial};--to:${s.to}"><i class="gs-mark"></i>${gimg('tool-dial', 'gs-knob')}</div>
        ${gimg('ing-salt', 'gs-side')}${gimg('fx-salt', 'gs-salt-fx')}`;
    } else if (kind === 'drops') {
      tool = `<button class="gs-dropper" data-gs-drop aria-label="${esc(t('gels.dropAria'))}">${gimg('tool-dropper')}</button>
        <b class="gs-count data-num">${run.drops} / ${s.n}</b>${gimg('fx-drops', 'gs-drop-fx')}`;
    } else if (kind === 'stir') {
      tool = `${gimg('tool-whisk', 'gs-whisk')}${gimg('fx-bubble', 'gs-bubble-fx')}`;
    } else if (kind === 'seal') {
      tool = `${gimg('tool-sealer', 'gs-sealer')}`;
    }
    const pourLine = kind === 'pour' ? `<i class="gs-line" style="--to:${s.to}"></i>` : '';
    return `<div class="gs-stage" data-kind="${kind}">
      <div class="gs-jug">${gimg('tool-jug')}
        <span class="gs-liquid" style="--mix:${run?.mix || 0};--total:${jugLevel().toFixed(4)}">${layers}<em></em></span>${pourLine}
        ${kind === 'stir' ? '<svg class="gs-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" pathLength="1" style="--p:0"/></svg>' : ''}
        ${gimg(POWDER.has(s?.ing) ? 'fx-puff' : 'fx-splash', 'gs-splash')}</div>
      <div class="gs-pouch">${gimg('pouch-0', 'gs-pouch-art')}
        <span class="gs-pfill"><i style="--f:${run?.fill || 0}"></i></span>
        ${kind === 'fill' ? `<i class="gs-pline" style="--to:${s.to}"></i>` : ''}
        ${kind === 'seal' ? '<i class="gs-sealbar"><b></b></i>' : ''}
        ${gimg(`gel-${gel.id}`, 'gs-final')}</div>
      <div class="gs-tool" data-kind="${kind}">${tool}</div>
    </div>`;
  }

  // ---- doing the steps ----
  function flash(cls) {
    const el = root.querySelector(cls);
    if (!el) return;
    el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on');
  }
  function pop(score) {
    const p = root.querySelector('.gs-pop');
    if (!p) return;
    const j = judge(score);
    p.innerHTML = `${j === 'perfect' ? gimg('fx-sparkle') : ''}<b>${esc(t(`gels.judge.${j}`))}</b>`;
    p.className = `gs-pop is-${j}`;
    void p.offsetWidth; p.classList.add('is-on');
  }

  function finishStep(score) {
    busy = true;
    run.scores.push(score);
    haptic(score >= 0.8 ? 'place' : 'tick');
    pop(score);
    setTimeout(() => {
      busy = false;
      run.i += 1;
      if (run.i >= gel.steps.length) {
        const n = G.stars(run.scores);
        result = { stars: n, bp: G.boostOf(gel, n) };
        set({ bag: G.bagged(st.bag, gel.id, n, Date.now()) });
        haptic(n === 3 ? 'record' : 'levelUp');
        run = null;
      } else {
        const s = step();
        if (s.kind === 'pour') run.layers.push({ c: G.INGREDIENTS[s.ing].colour, h: 0 });
        if (s.kind === 'dial') run.dial = 0;
        if (s.kind === 'drops') run.drops = 0;
      }
      drawPrep();
    }, 700);
  }

  /**
   * Hold to pour (or fill): the level rises while the finger is down, and is judged when it lifts.
   * The amount comes from the time held, not from frames drawn, so a dropped frame never pours less.
   * onLevel(d): `d` is everything poured since the finger went down; it returns the level now.
   */
  function hold(el, rate, onLevel, onDone) {
    let raf = 0; let t0 = 0; let tickAt = 0;
    const poured = () => rate * (performance.now() - t0) / 1000;
    const loop = () => {
      const v = onLevel(poured());
      if (v >= tickAt + 0.04) { tickAt = v; haptic('select'); }
      raf = requestAnimationFrame(loop);
    };
    el.addEventListener('pointerdown', (e) => {
      if (busy || raf) return;
      e.preventDefault(); el.setPointerCapture?.(e.pointerId);
      el.classList.add('is-pouring'); t0 = performance.now(); tickAt = 0;
      raf = requestAnimationFrame(loop);
    });
    const up = () => {
      if (!raf) return;
      cancelAnimationFrame(raf); raf = 0;
      onLevel(poured());
      el.classList.remove('is-pouring');
      onDone();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  function bindStage() {
    const s = step();
    const stageEl = root.querySelector('.gs-stage');
    if (!s || !stageEl) return;
    const liquid = stageEl.querySelector('.gs-liquid');
    if (s.kind === 'pour') {
      const below = jugLevel();   // what was in the jug before this pour
      hold(stageEl, POUR_RATE, (d) => {
        const top = run.layers[run.layers.length - 1];
        top.h = Math.min(1 - below, d);
        liquid.lastElementChild.previousElementSibling.style.setProperty('--h', top.h.toFixed(4));
        liquid.style.setProperty('--total', jugLevel().toFixed(4));
        return jugLevel();
      }, () => { flash('.gs-splash'); finishStep(G.scorePour(jugLevel(), s.to, below)); });
    }
    if (s.kind === 'fill') {
      const fillEl = stageEl.querySelector('.gs-pfill i');
      const start = jugLevel();
      hold(stageEl, FILL_RATE, (d) => {
        run.fill = Math.min(1, d);
        fillEl.style.setProperty('--f', run.fill.toFixed(4));
        const left = Math.max(0, start * (1 - run.fill / 0.95));   // the jug empties into the pouch
        run.layers = [{ c: gel.liquid, h: left }];
        liquid.querySelector('i')?.style.setProperty('--h', left.toFixed(4));
        liquid.style.setProperty('--total', left.toFixed(4));
        return run.fill;
      }, () => finishStep(G.scorePour(run.fill, s.to, 0)));
    }
    if (s.kind === 'dial') {
      const dial = stageEl.querySelector('.gs-dial');
      let tickAt = run.dial;
      const turn = (e) => {
        const r = dial.getBoundingClientRect();
        const a = Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI; // 0 = up
        run.dial = Math.max(0, Math.min(1, (a + 135) / 270));
        dial.style.setProperty('--v', run.dial.toFixed(4));
        if (Math.abs(run.dial - tickAt) >= 0.05) { tickAt = run.dial; haptic('select'); flash('.gs-salt-fx'); }
      };
      dial.addEventListener('pointerdown', (e) => { if (busy) return; e.preventDefault(); dial.setPointerCapture?.(e.pointerId); turn(e); dial.onpointermove = turn; });
      const stop = () => { dial.onpointermove = null; };
      dial.addEventListener('pointerup', stop); dial.addEventListener('pointercancel', stop);
    }
    if (s.kind === 'stir') {
      const jug = stageEl.querySelector('.gs-jug');
      const ring = stageEl.querySelector('.gs-ring circle');
      const whisk = stageEl.querySelector('.gs-whisk');
      let prev = null;
      const centre = () => { const r = jug.getBoundingClientRect(); return [r.left + r.width * 0.43, r.top + r.height * 0.6]; };
      const move = (e) => {
        if (busy) return;
        const [cx, cy] = centre();
        const a = Math.atan2(e.clientY - cy, e.clientX - cx);
        const sr = stageEl.getBoundingClientRect();
        whisk.style.left = `${e.clientX - sr.left}px`; whisk.style.top = `${e.clientY - sr.top}px`;
        whisk.style.setProperty('--r', `${Math.cos(a) * 14}deg`);
        if (prev != null) {
          let d = a - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
          const before = Math.floor(run.stirAcc / Math.PI);
          run.stirAcc += Math.abs(d);
          if (Math.floor(run.stirAcc / Math.PI) > before) { haptic('select'); flash('.gs-bubble-fx'); }
        }
        prev = a;
        const turns = run.stirAcc / (2 * Math.PI);
        run.mix = Math.min(1, turns / s.turns);
        liquid.style.setProperty('--mix', run.mix.toFixed(3));
        ring.style.setProperty('--p', run.mix.toFixed(3));
        if (turns >= s.turns) {
          stageEl.onpointermove = null;
          stageEl.classList.remove('is-stirring');
          run.layers = [{ c: gel.liquid, h: jugLevel() }]; run.mix = 0;
          finishStep(G.scoreStir(turns, (performance.now() - run.stirT0) / 1000));
        }
      };
      stageEl.addEventListener('pointerdown', (e) => {
        if (busy) return;
        e.preventDefault(); stageEl.setPointerCapture?.(e.pointerId);
        stageEl.classList.add('is-stirring');
        const [cx, cy] = centre(); prev = Math.atan2(e.clientY - cy, e.clientX - cx);
        if (!run.stirT0) run.stirT0 = performance.now();
        stageEl.onpointermove = move; move(e);
      });
      const stop = () => { stageEl.onpointermove = null; prev = null; stageEl.classList.remove('is-stirring'); };
      stageEl.addEventListener('pointerup', stop); stageEl.addEventListener('pointercancel', stop);
    }
    if (s.kind === 'seal') {
      const bar = stageEl.querySelector('.gs-sealbar');
      const fillBar = bar.querySelector('b');
      const sealer = stageEl.querySelector('.gs-sealer');
      let lo = null; let hi = null;
      const x = (e) => { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
      const move = (e) => {
        const v = x(e); lo = lo == null ? v : Math.min(lo, v); hi = hi == null ? v : Math.max(hi, v);
        fillBar.style.left = `${lo * 100}%`; fillBar.style.width = `${(hi - lo) * 100}%`;
        sealer.style.setProperty('--x', v.toFixed(3));
      };
      stageEl.addEventListener('pointerdown', (e) => {
        if (busy) return;
        e.preventDefault(); stageEl.setPointerCapture?.(e.pointerId); lo = hi = null; move(e); stageEl.onpointermove = move;
      });
      const up = () => {
        if (!stageEl.onpointermove) return;
        stageEl.onpointermove = null;
        const cover = (hi ?? 0) - (lo ?? 0);
        if (cover < 0.15) return;   // a tap, not a swipe: try again
        run.sealed = true;
        stageEl.querySelector('.gs-pouch').classList.add('is-sealed');   // the clear pouch becomes the gel
        finishStep(G.scoreSeal(cover));
      };
      stageEl.addEventListener('pointerup', up); stageEl.addEventListener('pointercancel', up);
    }
  }

  // ---- taps ----
  root.addEventListener('click', (e) => {
    const b = (sel) => e.target.closest(sel);
    if (b('[data-gs-up]')) {
      if (!G.nextUpgrade(level)) return;
      level += 1;
      set({ level });
      haptic('levelUp');
      document.dispatchEvent(new CustomEvent('gels-changed'));   // the base draws the stand's new picture
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
      haptic('tick'); gel = g; run = null; result = null; drawPrep(); return;
    }
    const buyBtn = b('[data-gs-buy]');
    if (buyBtn) {
      const r = G.buy(st.stock, buyBtn.dataset.gsBuy, 1, st.carbs);
      if (r.error) { haptic('refuse'); return; }
      haptic('tick'); set({ stock: r.stock, carbs: r.carbs });
      if (run || result) {   // mid-making: just the count, so the step in hand isn't redrawn
        const bin = buyBtn.closest('.gs-bin');
        bin.querySelector('.gs-stock').textContent = st.stock[buyBtn.dataset.gsBuy];
        root.querySelector('.gs-carbs b').textContent = st.carbs;
        bin.classList.remove('is-bought'); void bin.offsetWidth; bin.classList.add('is-bought');
      } else drawPrep();
      return;
    }
    if (b('[data-gs-fill]')) {
      let { stock, carbs } = st;
      for (const [ing, k] of Object.entries(G.missing(stock, gel))) {
        const r = G.buy(stock, ing, k, carbs);
        if (r.error) { haptic('refuse'); return; }
        ({ stock, carbs } = r);
      }
      haptic('place'); set({ stock, carbs }); drawPrep(); return;
    }
    if (b('[data-gs-start]')) {
      const r = G.start(st.stock, gel, level);
      if (r.error) { haptic('refuse'); return; }
      set({ stock: r.stock });
      const first = gel.steps[0];
      run = { i: 0, scores: [], layers: first.kind === 'pour' ? [{ c: G.INGREDIENTS[first.ing].colour, h: 0 }] : [], mix: 0, fill: 0, sealed: false, drops: 0, dial: 0, stirAcc: 0, stirT0: 0 };
      haptic('place'); drawPrep(); return;
    }
    if (b('[data-gs-drop]') && run && !busy) {
      run.drops += 1; haptic('select');
      flash('.gs-drop-fx');
      root.querySelector('.gs-count').textContent = `${run.drops} / ${step().n}`;
      return;
    }
    if (b('[data-gs-done]') && run && !busy) {
      const s = step();
      finishStep(s.kind === 'dial' ? G.scoreDial(run.dial, s.to) : G.scoreDrops(run.drops, s.n));
      return;
    }
    if (b('[data-gs-again]')) { result = null; run = null; drawPrep(); return; }
    if (b('[data-gs-menu]')) { gel = null; result = null; drawMenu(); }
  });

  drawMenu();
  return root;
}
