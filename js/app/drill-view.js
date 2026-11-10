// drill-view.js — the treadmill's and the ice bath's windows (docs/DRILLS.md), and the drills'
// saved state. The rules are js/core/drills.js; this keeps them in settings (settings.drills,
// settings.stamina) and shows them.
//
// Tap the treadmill: its levels, what each costs, Start. While it runs: how far, how long left, Stop.
// Tap the ice bath: how long it takes, what it gives back, Start.
// Whatever ended while you were away is told once, the next time you open the base (`tellResult`).

import { openLayer, closeLayer } from './nav.js';
import { esc } from './ui.js';
import { t, fmtNum } from '../core/i18n.js';
import { haptic } from './haptics.js';
import { toast } from './effects.js';
import * as store from './store.js';
import { STAMINA, freshStamina } from '../core/stamina.js';
import {
  DRILLS, RECOVERY, efficiency, normaliseDrills, levelOpen, drillLevel, forecast, startDrill, drillNow, cancelDrill,
  startRecovery, cancelRecovery, recoveryNow, settle, clearResult, staminaShown,
} from '../core/drills.js';

const BOLT = 'icons/Pixelart/NEW/stamina-bolt.png';

/** The stamina anchor (made full the first time). */
export function staminaAnchor() {
  const a = store.getSettings().stamina;
  if (a && Number.isFinite(Number(a.at))) return a;
  const fresh = freshStamina(Date.now());
  store.setSetting('stamina', fresh);
  return fresh;
}

export const drillsSaved = () => normaliseDrills(store.getSettings().drills);

const save = (drills, stamina) => {
  store.setSetting('drills', drills);
  if (stamina) store.setSetting('stamina', stamina);
  document.dispatchEvent(new CustomEvent('drills-changed'));
};

/** Close whatever has ended; true when something did. */
export function settleDrills(now = Date.now()) {
  const r = settle(drillsSaved(), staminaAnchor(), now);
  if (r.changed) save(r.drills, r.stamina);
  return r.changed;
}

/** The stamina the HUD shows right now. */
export const staminaNow = (now = Date.now()) => staminaShown(drillsSaved(), staminaAnchor(), now);

/** The clip your athlete plays on the treadmill: the level's while a run drill is on, else idle. */
export function runnerClip() {
  const a = drillsSaved().active;
  return a?.kind === 'run' ? drillLevel('run', a.level).clip : 'idle';
}

/** Tell what ended (a drill done or failed, a recovery over) once, then forget it. */
export function tellResult() {
  const d = drillsSaved();
  const r = d.result;
  if (!r) return;
  let msg;
  if (r.tool) msg = t('drill.res.recovered', { tool: t(`drill.tool.${r.tool}`), n: r.gain });
  else if (r.ok) msg = r.opened ? t('drill.res.doneOpened', { n: r.level, next: r.opened }) : t('drill.res.done', { n: r.level });
  else msg = t('drill.res.failed', { n: r.level, km: fmtNum(r.km) });
  toast(esc(msg), { icon: `<img src="${BOLT}" alt="" width="24" height="24">`, duration: 6000 });
  store.setSetting('drills', clearResult(d));
}

const clock = (ms) => {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};
const kmTxt = (km) => `${fmtNum(+km.toFixed(km < 10 ? 2 : 1))} km`;
const levelTxt = (l) => (l.pace ? t('drill.paceLine', { km: fmtNum(l.km), min: l.min }) : t('drill.line', { km: fmtNum(l.km), min: l.min }));

/** The window round a drill or a recovery tool: head, body, foot, redrawn every second. */
function windowFor(name, title, draw) {
  const root = openLayer(name, { className: 'mk-layer', reuse: false });
  root.innerHTML = `<div class="modal-backdrop" data-layer-close></div>
    <div class="mk-info dr" role="dialog" aria-modal="true" aria-labelledby="dr-h">
      <header class="mk-info-head"><h2 id="dr-h">${esc(title)}</h2>
        <button class="mk-x" data-layer-close aria-label="${esc(t('city.market.close'))}">×</button></header>
      <div class="mk-info-body" data-dr-body></div>
      <div class="mk-info-foot" data-dr-foot></div>
    </div>`;
  const body = root.querySelector('[data-dr-body]'); const foot = root.querySelector('[data-dr-foot]');
  const redraw = () => {
    if (!root.isConnected) { clearInterval(tick); return; }
    settleDrills();
    const top = body.scrollTop;
    const [b, f] = draw();
    if (body.innerHTML !== b) body.innerHTML = b;
    if (foot.innerHTML !== f) foot.innerHTML = f;
    body.scrollTop = top;
  };
  const tick = setInterval(redraw, 1000);
  redraw();
  return { root, redraw };
}

const staminaRow = (st, eff) => `<div class="dr-st">
    <img src="${BOLT}" alt="" width="28" height="28">
    <span class="dr-st-bar" style="--f:${(st / STAMINA.max).toFixed(3)}"><i></i></span>
    <b class="data-num">${st}/${STAMINA.max}</b>
    ${eff ? `<small>${esc(t('drill.eff', { n: Math.round(eff * 100) }))}</small>` : ''}
  </div>`;

/**
 * The treadmill's window.
 * @param {string} kind  'run'
 * @param {number} tier  the treadmill's tier (1 to 4): better machines cost less stamina
 */
export function openDrill(kind, tier = 1) {
  const eff = efficiency({ machineTier: tier });
  const top = DRILLS[kind].levels.length;
  let pick = null;
  const w = windowFor('drill', t(`drill.title.${kind}`), () => {
    const d = drillsSaved(); const now = Date.now();
    const st = staminaShown(d, staminaAnchor(), now);
    const open = levelOpen(d, kind);
    // running: how it's going
    if (d.active?.kind === kind) {
      const a = d.active; const s = drillNow(a, now); const l = drillLevel(kind, a.level);
      return [`${staminaRow(st, eff)}
        <div class="dr-run${s.ok ? '' : ' is-short'}">
          <h3>${esc(t('drill.level', { n: a.level }))} <small>${esc(levelTxt(l))}</small></h3>
          <span class="dr-prog" style="--f:${s.share.toFixed(4)}"><i></i></span>
          <p class="dr-km"><b class="data-num">${kmTxt(s.km)}</b> / ${kmTxt(l.km)}</p>
          <p class="mk-note">${esc(s.ok ? t('drill.left', { t: clock(s.left) }) : t('drill.willFail', { km: kmTxt(l.km * (a.from / a.cost)), t: clock(s.left) }))}</p>
        </div>`,
      `<button class="dr-stop" data-dr-stop>${esc(t('drill.stop'))}</button>`];
    }
    const busy = d.active || d.recovering;
    if (pick == null || pick > open) pick = open;
    const rows = DRILLS[kind].levels.map((_, i) => {
      const n = i + 1; const l = drillLevel(kind, n, eff);
      const state = n < open ? 'done' : n === open ? 'open' : 'locked';
      const on = n === pick;
      return `<button class="dr-lvl is-${state}${on ? ' is-on' : ''}" data-dr-lvl="${n}" ${state === 'locked' ? 'disabled' : ''} aria-pressed="${on}">
        <b class="dr-n">${n}</b>
        <span class="dr-what"><b>${esc(levelTxt(l))}</b>${l.pace ? `<small>${esc(t('drill.pace'))}</small>` : ''}</span>
        <span class="dr-cost"><img src="${BOLT}" alt="" width="18" height="18">${l.cost}</span>
        <i class="dr-mark" aria-hidden="true">${state === 'done' ? '✓' : state === 'locked' ? '🔒' : ''}</i>
      </button>`;
    }).join('');
    const l = drillLevel(kind, pick, eff); const f = forecast(kind, pick, st, eff);
    const warn = busy ? t(d.recovering ? 'drill.busyRec' : 'drill.busy')
      : st <= 0 ? t('drill.empty')
        : f.ok ? t('drill.enough', { n: st - l.cost })
          : t('drill.short', { km: kmTxt(f.km) });
    return [`${staminaRow(st, eff)}
      <p class="mk-note">${esc(t('drill.about'))}</p>
      <div class="dr-list">${rows}</div>`,
    `<p class="dr-warn${f.ok && !busy ? '' : ' is-bad'}">${esc(warn)}</p>
      <button class="mk-up" data-dr-start ${busy || st <= 0 ? 'disabled' : ''}><b>${esc(t('drill.start', { n: pick }))}</b><span>${esc(levelTxt(l))}</span></button>`];
  });
  w.root.addEventListener('click', (e) => {
    const lvl = e.target.closest('[data-dr-lvl]');
    if (lvl) { pick = Number(lvl.dataset.drLvl); haptic('tick'); w.redraw(); return; }
    if (e.target.closest('[data-dr-start]')) {
      const now = Date.now();
      const r = startDrill(drillsSaved(), kind, pick, { stamina: staminaShown(drillsSaved(), staminaAnchor(), now), now, eff });
      if (r.error) { haptic('refuse'); toast(esc(t(`drill.err.${r.error}`))); return; }
      haptic('success');
      save(r.drills, null);
      closeLayer(w.root);
      return;
    }
    if (e.target.closest('[data-dr-stop]')) {
      const r = cancelDrill(drillsSaved(), Date.now());
      haptic('tick');
      save(r.drills, r.stamina);
      w.redraw();
    }
  });
  return w.root;
}

/** A recovery tool's window (the ice bath). */
export function openRecovery(tool) {
  const r0 = RECOVERY[tool];
  const w = windowFor('recovery', t(`drill.tool.${tool}`), () => {
    const d = drillsSaved(); const now = Date.now();
    const st = staminaShown(d, staminaAnchor(), now);
    if (d.recovering?.tool === tool) {
      const s = recoveryNow(d.recovering, now);
      return [`${staminaRow(st, 0)}
        <div class="dr-run is-rec"><h3>${esc(t('drill.recIn', { tool: t(`drill.tool.${tool}`) }))}</h3>
          <span class="dr-prog" style="--f:${s.share.toFixed(4)}"><i></i></span>
          <p class="mk-note">${esc(t('drill.recLeft', { t: clock(s.left), n: d.recovering.gain }))}</p></div>`,
      `<button class="dr-stop" data-dr-out>${esc(t('drill.getOut'))}</button>`];
    }
    const busy = d.active || d.recovering;
    const full = st >= STAMINA.max;
    const warn = busy ? t(d.active ? 'drill.busy' : 'drill.busyRec') : full ? t('drill.full') : t('drill.recAbout', { min: r0.min, n: r0.gain });
    const tools = Object.entries(RECOVERY).map(([id, r]) => `<li class="dr-tool${id === tool ? ' is-on' : r.item ? '' : ' is-soon'}">
        <b>${esc(t(`drill.tool.${id}`))}</b><span>${r.min} min</span><span class="dr-cost">+${r.gain}<img src="${BOLT}" alt="" width="18" height="18"></span>
        ${r.item ? '' : `<small>${esc(t('drill.soon'))}</small>`}</li>`).join('');
    return [`${staminaRow(st, 0)}
      <p class="mk-note">${esc(t('drill.recIntro'))}</p>
      <ul class="dr-tools">${tools}</ul>`,
    `<p class="dr-warn${busy || full ? ' is-bad' : ''}">${esc(warn)}</p>
      <button class="mk-up" data-dr-rec ${busy || full ? 'disabled' : ''}><b>${esc(t('drill.recStart'))}</b><span>${r0.min} min · +${r0.gain}</span></button>`];
  });
  w.root.addEventListener('click', (e) => {
    if (e.target.closest('[data-dr-rec]')) {
      const now = Date.now();
      const r = startRecovery(drillsSaved(), tool, { stamina: staminaNow(now), now });
      if (r.error) { haptic('refuse'); toast(esc(t(`drill.err.${r.error}`))); return; }
      haptic('success');
      save(r.drills, null);
      w.redraw();
      return;
    }
    if (e.target.closest('[data-dr-out]')) { haptic('tick'); save(cancelRecovery(drillsSaved()), null); w.redraw(); }
  });
  return w.root;
}
