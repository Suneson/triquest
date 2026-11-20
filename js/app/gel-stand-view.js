// gel-stand-view.js — the gel stand's screens (docs/KITCHEN.md, "The gel stand"): the menu of final gels,
// then the prep view (top: the recipe card and the ingredient shelf; bottom: the step being done), then
// the result. The rules are js/core/gel-stand.js.
//
// For now it's a preview (?gels=1, &lvl=1-4): the stock, the bag and the carbs are kept on this device
// (settings.gelStand) until the server side exists. The pictures come from icons/Gels/ when they're
// there (cut from the gel-stand.csv sheets); until then each one is drawn in CSS.

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

const load = () => {
  const s = store.getSettings()[KEY] || {};
  const carbs = Number(s.carbs);
  return { ...G.normalise(s), carbs: Number.isFinite(carbs) ? carbs : PREVIEW_CARBS };
};
const save = (s) => store.setSetting(KEY, { stock: s.stock, bag: s.bag, carbs: s.carbs });

// a picture not there yet (404) isn't asked for again while the app runs: the CSS stand-in shows instead
const noArt = new Set();
const art = (file) => (noArt.has(file) ? '' : `<img data-art="${file}" src="${ART}/${file}.webp" alt="" draggable="false">`);
const pct = (bp) => Math.round(bp / 100);
const gelName = (g) => t(`gels.name.${g.id}`);
const ingName = (id) => t(`gels.ing.${id}`);

function stepText(s) {
  if (s.kind === 'pour') return t('gels.step.pour', { ing: ingName(s.ing).toLocaleLowerCase() });
  if (s.kind === 'drops') return t('gels.step.drops', { n: s.n });
  if (s.kind === 'stir') return t('gels.step.stir', { n: s.turns });
  return t(`gels.step.${s.kind}`);
}
function judge(score) {
  return score >= 0.95 ? 'perfect' : score >= 0.8 ? 'great' : score >= 0.5 ? 'good' : 'off';
}
const starsHtml = (n) => `<span class="gs-stars" role="img" aria-label="${esc(t('gels.starsAria', { n }))}">${
  [1, 2, 3].map((i) => `<i class="${i <= n ? 'is-on' : ''}" style="--i:${i}"></i>`).join('')}</span>`;

/** A pouch drawn in CSS, with the gel's own picture over it when there is one. */
const pouch = (g) => `<span class="gs-mini" style="--c:${g.colour}"><i></i>${art(`gel-${g.id}`)}</span>`;

/**
 * The gel stand's window.
 * @param {{ level?: number }} opts  the stand's level (1-4): it opens more gels
 */
export function openGelStand({ level = 1 } = {}) {
  const root = openLayer('gel-stand', { className: 'gs-layer' });
  let st = load();
  let gel = null;          // the gel picked
  let run = null;          // making it: { i, scores, layers, mix, fill, sealed, drops, dial, stirAcc, stirT0, from }
  let result = null;       // { stars, bp }
  let busy = false;        // a step is being judged (its result is showing)

  const set = (patch) => { st = { ...st, ...patch }; save(st); };

  function frame(body, cls) {
    root.innerHTML = `<div class="gs ${cls}">
      <header class="gs-bar">
        <button class="gs-x" data-gs-back aria-label="${esc(t(gel ? 'gels.toMenu' : 'gels.close'))}">${gel ? '‹' : '×'}</button>
        <h2>${esc(t('gels.title'))} <small>${esc(t('gels.level', { n: level }))}</small></h2>
        <span class="gs-carbs" title="${esc(t('gels.preview'))}">${art('ui-carbs')}<b class="data-num">${st.carbs}</b> g</span>
      </header>${body}</div>`;
    root.querySelectorAll('img[data-art]').forEach((im) => im.addEventListener('error', () => { im.hidden = true; noArt.add(im.dataset.art); }, { once: true }));
  }

  // ---- the menu ----
  function drawMenu() {
    const cards = G.menu(level).map((g) => {
      const sport = g.sport ? Object.entries(g.sport)[0] : null;
      return `<button class="gs-card${g.open ? '' : ' is-locked'}" data-gs-pick="${g.id}" ${g.open ? '' : 'aria-disabled="true"'}>
        ${pouch(g)}
        <b>${esc(gelName(g))}</b>
        <span class="gs-boost">${esc(t('gels.boost', { n: pct(g.boostBp) }))}</span>
        ${sport ? `<small>${esc(t('gels.sportBoost', { n: pct(sport[1]), sport: t(`gels.sport.${sport[0]}`) }))}</small>` : ''}
        <span class="gs-cost">${esc(t('gels.cost', { n: G.gelCost(g) }))}</span>
        ${g.open ? '' : `<span class="gs-lock">${esc(t('gels.locked', { n: g.level }))}</span>`}
      </button>`;
    }).join('');
    frame(`<p class="gs-about">${esc(t('gels.about'))}</p><div class="gs-menu">${cards}</div>
      <p class="gs-note">${esc(t('gels.preview'))}</p>`, 'is-menu');
  }

  // ---- the prep view ----
  const step = () => (run ? gel.steps[run.i] : null);
  const jugLevel = () => (run ? run.layers.reduce((n, l) => n + l.h, 0) : 0);

  function drawPrep() {
    const now = step();
    const steps = gel.steps.map((s, i) => {
      const state = !run ? '' : i < run.i ? 'is-done' : i === run.i ? 'is-now' : '';
      return `<li class="${state}">${esc(stepText(s))}</li>`;
    }).join('');
    const shelf = G.SHELF.map((id) => {
      const ing = G.INGREDIENTS[id];
      const used = gel.uses[id] || (id === 'water' && gel.steps.some((s) => s.ing === 'water'));
      const short = !run && !result && (Number(st.stock[id]) || 0) < (gel.uses[id] || 0);
      const glow = now?.ing === id;
      return `<div class="gs-bin${used ? ' is-used' : ''}${short ? ' is-short' : ''}${glow ? ' is-now' : ''}" style="--c:${ing.colour}">
        <span class="gs-ing"><i></i>${art(`ing-${id}`)}</span>
        <small>${esc(ingName(id))}</small>
        <b class="data-num">${ing.free ? esc(t('gels.free')) : `×${st.stock[id] || 0}`}</b>
        ${ing.free ? '' : `<button class="gs-plus" data-gs-buy="${id}" aria-label="${esc(t('gels.buyAria', { ing: ingName(id), n: ing.cost }))}">+</button>`}
      </div>`;
    }).join('');
    let lower;
    if (result) {
      lower = `<div class="gs-result">${starsHtml(result.stars)}
        <h3>${esc(t('gels.made', { name: gelName(gel) }))}</h3>
        <p class="gs-boost">${esc(t('gels.boost', { n: pct(result.bp) }))}</p>
        <p class="gs-note">${esc(t('gels.bagged'))}</p>
        <div class="gs-actions"><button class="gs-btn is-alt" data-gs-menu>${esc(t('gels.toMenu'))}</button>
        <button class="gs-btn" data-gs-again>${esc(t('gels.again'))}</button></div></div>`;
    } else if (!run) {
      const short = G.missingCost(st.stock, gel);
      lower = `<div class="gs-ready">${stage()}<div class="gs-actions">
        ${short ? `<button class="gs-btn is-alt" data-gs-fill ${short > st.carbs ? 'disabled' : ''}>${esc(t('gels.buyMissing', { n: short }))}</button>` : ''}
        <button class="gs-btn" data-gs-start ${short ? 'disabled' : ''}>${esc(t('gels.start'))}</button></div></div>`;
    } else {
      lower = `<p class="gs-hint" aria-live="polite">${esc(t(`gels.hint.${now.kind}`, { n: now.n || now.turns || 0 }))}</p>${stage()}
        <div class="gs-dots">${gel.steps.map((_, i) => `<i class="${i < run.i ? 'is-done' : i === run.i ? 'is-now' : ''}"></i>`).join('')}</div>`;
    }
    frame(`<section class="gs-upper">
        <div class="gs-recipe">${pouch(gel)}<div><h3>${esc(gelName(gel))}</h3>
          <span class="gs-boost">${esc(t('gels.boost', { n: pct(gel.boostBp) }))}</span><ol>${steps}</ol></div></div>
        <div class="gs-shelf">${shelf}</div>
      </section><section class="gs-lower" style="--gel:${gel.colour}">${lower}</section>`, 'is-prep');
    bindStage();
  }

  /** The worktop: the jug, the pouch and the tool the step needs. */
  function stage() {
    const s = step();
    const layers = (run?.layers || []).map((l) => `<i style="--h:${l.h.toFixed(4)};--c:${l.c}"></i>`).join('');
    const pourTo = s?.kind === 'pour' ? `<i class="gs-line" style="--to:${s.to}"></i>` : '';
    const ingC = s?.ing ? G.INGREDIENTS[s.ing].colour : 'transparent';
    let tool = '';
    if (s?.kind === 'pour') tool = `<span class="gs-bottle" style="--c:${ingC}"><span class="gs-ing"><i></i>${art(`ing-${s.ing}`)}</span><i class="gs-stream"></i></span>`;
    if (s?.kind === 'dial') {
      tool = `<div class="gs-dial" style="--v:${run.dial};--to:${s.to}"><i class="gs-mark"></i><span class="gs-knob">${art('tool-dial')}</span></div>
        <button class="gs-btn gs-done" data-gs-done>${esc(t('gels.done'))}</button>`;
    }
    if (s?.kind === 'drops') {
      tool = `<button class="gs-dropper" data-gs-drop aria-label="${esc(t('gels.dropAria'))}">${art('tool-dropper')}<i></i></button>
        <b class="gs-count data-num">${run.drops} / ${s.n}</b>
        <button class="gs-btn gs-done" data-gs-done>${esc(t('gels.done'))}</button>`;
    }
    const kind = s?.kind || 'idle';
    const target = s?.kind === 'fill' ? `<i class="gs-pline" style="--to:${s.to}"></i>` : '';
    return `<div class="gs-stage" data-kind="${kind}">
      <div class="gs-jug">${art('tool-jug')}<span class="gs-layers" style="--mix:${run?.mix || 0};--total:${jugLevel().toFixed(4)}">${layers}<em></em></span>${pourTo}
        ${kind === 'stir' ? `<svg class="gs-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" pathLength="1" style="--p:0"/></svg>` : ''}</div>
      <div class="gs-pouch${run?.sealed ? ' is-sealed' : ''}"><i class="gs-pfill" style="--f:${run?.fill || 0}"></i>${target}
        ${kind === 'seal' ? '<i class="gs-sealbar"><b></b></i>' : ''}<i class="gs-crimp"></i></div>
      <div class="gs-tool">${tool}</div>
      <span class="gs-pop" aria-hidden="true"></span>
    </div>`;
  }

  // ---- doing the steps ----
  function pop(score) {
    const p = root.querySelector('.gs-pop');
    if (!p) return;
    const j = judge(score);
    p.textContent = t(`gels.judge.${j}`);
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
        run.from = jugLevel();
        if (s.kind === 'pour') run.layers.push({ c: G.INGREDIENTS[s.ing].colour, h: 0 });
        if (s.kind === 'dial') run.dial = 0;
        if (s.kind === 'drops') run.drops = 0;
      }
      drawPrep();
    }, 650);
  }

  /**
   * Hold to pour (or fill): the level rises while the finger is down, and is judged when it lifts.
   * The amount comes from the time held, not from frames drawn, so a dropped frame never pours less.
   * onLevel(d): `d` is everything poured since the finger went down; it returns the level now.
   */
  function hold(el, rate, onLevel, onDone) {
    let raf = 0; let t0 = 0; let tickAt = 0;
    const tickStep = 0.04;
    const poured = () => rate * (performance.now() - t0) / 1000;
    const loop = () => {
      const v = onLevel(poured());
      if (v >= tickAt + tickStep) { tickAt = v; haptic('select'); }
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
    const jugLayers = stageEl.querySelector('.gs-layers');
    if (s.kind === 'pour') {
      const below = jugLevel();   // what was in the jug before this pour
      hold(stageEl, POUR_RATE, (d) => {
        const top = run.layers[run.layers.length - 1];
        top.h = Math.min(1 - below, d);
        jugLayers.lastElementChild.previousElementSibling.style.setProperty('--h', top.h.toFixed(4));
        return jugLevel();
      }, () => finishStep(G.scorePour(jugLevel(), s.to, run.from)));
    }
    if (s.kind === 'fill') {
      const fillEl = stageEl.querySelector('.gs-pfill');
      const start = jugLevel();
      hold(stageEl, FILL_RATE, (d) => {
        run.fill = Math.min(1, d);
        fillEl.style.setProperty('--f', run.fill.toFixed(4));
        // the jug empties into the pouch
        const left = Math.max(0, start * (1 - run.fill / 0.95));
        run.layers = [{ c: gel.colour, h: left }];
        jugLayers.querySelector('i')?.style.setProperty('--h', left.toFixed(4));
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
        if (Math.abs(run.dial - tickAt) >= 0.05) { tickAt = run.dial; haptic('select'); }
      };
      dial.addEventListener('pointerdown', (e) => { if (busy) return; e.preventDefault(); dial.setPointerCapture?.(e.pointerId); turn(e); dial.onpointermove = turn; });
      const stop = () => { dial.onpointermove = null; };
      dial.addEventListener('pointerup', stop); dial.addEventListener('pointercancel', stop);
    }
    if (s.kind === 'stir') {
      const jug = stageEl.querySelector('.gs-jug');
      const ring = stageEl.querySelector('.gs-ring circle');
      let prev = null;
      const at = (e) => { const r = jug.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
      const move = (e) => {
        if (busy) return;
        const a = at(e);
        if (prev != null) {
          let d = a - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
          const before = Math.floor(run.stirAcc / Math.PI);
          run.stirAcc += Math.abs(d);
          if (Math.floor(run.stirAcc / Math.PI) > before) haptic('select');
        }
        prev = a;
        const turns = run.stirAcc / (2 * Math.PI);
        run.mix = Math.min(1, turns / s.turns);
        jugLayers.style.setProperty('--mix', run.mix.toFixed(3));
        ring.style.setProperty('--p', run.mix.toFixed(3));
        if (turns >= s.turns) {
          stageEl.onpointermove = null;
          run.layers = [{ c: gel.colour, h: jugLevel() }]; run.mix = 0;
          finishStep(G.scoreStir(turns, (performance.now() - run.stirT0) / 1000));
        }
      };
      stageEl.addEventListener('pointerdown', (e) => {
        if (busy) return;
        e.preventDefault(); stageEl.setPointerCapture?.(e.pointerId);
        prev = at(e); if (!run.stirT0) run.stirT0 = performance.now();
        stageEl.onpointermove = move;
      });
      const stop = () => { stageEl.onpointermove = null; prev = null; };
      stageEl.addEventListener('pointerup', stop); stageEl.addEventListener('pointercancel', stop);
    }
    if (s.kind === 'seal') {
      const bar = stageEl.querySelector('.gs-sealbar');
      const fillBar = bar.querySelector('b');
      let lo = null; let hi = null;
      const x = (e) => { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
      const move = (e) => {
        const v = x(e); lo = lo == null ? v : Math.min(lo, v); hi = hi == null ? v : Math.max(hi, v);
        fillBar.style.left = `${lo * 100}%`; fillBar.style.width = `${(hi - lo) * 100}%`;
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
        stageEl.querySelector('.gs-pouch').classList.add('is-sealed');
        finishStep(G.scoreSeal(cover));
      };
      stageEl.addEventListener('pointerup', up); stageEl.addEventListener('pointercancel', up);
    }
  }

  // ---- taps ----
  root.addEventListener('click', (e) => {
    const b = (sel) => e.target.closest(sel);
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
      haptic('tick'); set({ stock: r.stock, carbs: r.carbs }); drawPrep(); return;
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
      run = { i: 0, scores: [], layers: first.kind === 'pour' ? [{ c: G.INGREDIENTS[first.ing].colour, h: 0 }] : [], mix: 0, fill: 0, sealed: false, drops: 0, dial: 0, stirAcc: 0, stirT0: 0, from: 0 };
      haptic('place'); drawPrep(); return;
    }
    if (b('[data-gs-drop]') && run && !busy) {
      run.drops += 1; haptic('select');
      const d = root.querySelector('.gs-dropper i'); d.classList.remove('is-on'); void d.offsetWidth; d.classList.add('is-on');
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
