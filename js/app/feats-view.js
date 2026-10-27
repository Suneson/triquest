// feats-view.js — the trophy board in each sport's scene, and the trophy case
// it opens (docs/FEATS.md, Phase 2).
//
// The board is a physical object in the diorama: a hotspot from the scene
// manifest (scenes.js `board`), drawn as a framed pixel board until its art
// lands, with a press state and a slow glint so it reads as something to tap.
// The trophy case lists that sport's feats: won ones lit, with the date, the
// number and the session that won it; the rest as silhouettes with the exact
// target and how close you've come, because that's what sends you out again.

import { openLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { esc, meter } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum, fmtDate } from '../core/i18n.js';
import { FEATS, featsFor, featById, nearMiss, seasonHue, TRIO } from '../core/feats.js';
import { featItemById } from '../core/gear.js';
import { collectionsFor, starsIn } from '../core/collections.js';
import { featProgress } from '../core/base.js';
import { gearState, gearEnabled } from './gear-state.js';
import { featAwards, featsSynced, refreshFeats, onFeats, justWon } from './feats-state.js';
import { openCheckinSheet, checkinOn } from './checkin.js';
import { busy } from './motion.js';
import { toast } from './effects.js';
import * as store from './store.js';
import { todayISO } from '../core/dates.js';

const pct = (v) => `${Math.round(v * 100) / 100}%`;
const CASE_SPORTS = ['bike', 'swim', 'run', 'gym', 'cross'];

/** Awards grouped by feat: Map featId → [award…] (one per season for a repeatable feat). */
function wonByFeat(awards = featAwards()) {
  const m = new Map();
  for (const a of awards) m.set(a.featId, [...(m.get(a.featId) || []), a]);
  return m;
}

// ---- the board in the scene --------------------------------------------------------

/**
 * The board, placed by the scene's hotspot (% of the art). Shows how many of
 * the sport's feats you've won (cross-sport feats count on every board).
 */
export function trophyBoard(sport, box) {
  if (!box) return '';
  const feats = [...featsFor(sport), ...featsFor('cross')];
  const won = wonByFeat();
  const n = feats.filter((f) => won.has(f.id)).length;
  // a plaque for each completed gear set, and a star for each prestige (docs/LOOP.md §4)
  const s = gearEnabled() ? gearState() : null;
  const sets = s ? collectionsFor(sport, s.inventory).filter((c) => c.done) : [];
  const stars = s ? starsIn(s.prestige, sport).length : 0;
  const extra = [sets.length ? t('loop.col.boardAria', { n: sets.length }) : '', stars ? t('loop.prestige.starsAria', { n: stars }) : ''].filter(Boolean).join('. ');
  return `<button class="pg-board${justWon(sport) ? ' is-fresh' : ''}" data-action="open-trophies" data-sport="${esc(sport)}"
      style="--x:${pct(box.x)};--y:${pct(box.y)};--w:${pct(box.w)};--h:${pct(box.h)}"
      aria-label="${esc(t('feat.ui.boardAria', { n, total: feats.length }) + (extra ? `. ${extra}` : ''))}">
      <span class="pg-board-face" aria-hidden="true">${svg('trophy')}<b class="data-num">${n}</b></span>
      ${sets.length || stars ? `<span class="pg-board-plaques" aria-hidden="true">${sets.map((c) => `<i class="is-t${c.tier}"></i>`).join('')}${stars ? `<b>${'★'.repeat(stars)}</b>` : ''}</span>` : ''}
      <i class="pg-board-glint" aria-hidden="true"></i>
    </button>`;
}

// ---- values, as the case shows them -------------------------------------------------

const clock = (sec) => {
  const s = Math.round(Number(sec) || 0);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

/** A feat's number in its own unit: "19:52", "104.6 km", "2,310 m", "41.2 km/h", "1:41 /100 m". */
export function featValue(f, v) {
  if (v == null || !Number.isFinite(Number(v))) return '';
  switch (f.kind) {
    case 'distance': case 'month': case 'race': return t('feat.ui.km', { n: fmtNum(v, { maximumFractionDigits: 1 }) });
    case 'time': return clock(v);
    case 'climb': case 'segment': return t('feat.ui.m', { n: fmtNum(v) });
    case 'speed': return t('feat.ui.kmh', { n: fmtNum(v, { maximumFractionDigits: 1 }) });
    case 'steady': return t('feat.ui.rest', { n: fmtNum(Math.max(0, (v - 1) * 100), { maximumFractionDigits: 0 }) });
    case 'pace': return t('feat.ui.per100', { t: clock(v) });
    case 'lift': return t('feat.ui.kg', { n: fmtNum(v, { maximumFractionDigits: 1 }) });
    case 'count': return t('feat.ui.sessions', { n: fmtNum(v) });
    case 'weeks': return t('feat.ui.weeks', { n: fmtNum(v) });
    default: return '';
  }
}

/** How far toward the target, 0–1 (times and paces are lower-is-better). */
const progressOf = featProgress;

// ---- the trophy case ------------------------------------------------------------------

function featCard(f, wins, workouts) {
  const item = f.reward ? featItemById(f.reward) : null;
  const trioItem = TRIO.feats.includes(f.id) ? featItemById(TRIO.reward) : null;
  const reward = item || trioItem;
  const rewardLine = reward
    ? `<p class="tc-reward">${svg('star')} ${esc(t(trioItem && !item ? 'feat.ui.rewardTrio' : 'feat.ui.reward', { item: reward.name }))}</p>` : '';
  // where the proof comes from: Strava, or (lifts) the app's log; a session count takes any session that earned
  const labels = f.kind === 'count' ? []
    : [f.logged ? `<span class="tc-tag is-logged">${t('feat.ui.logged')}</span>` : `<span class="tc-tag">${svg('check')} ${t('feat.ui.strava')}</span>`];
  // each feat has its own painted trophy (docs/gear/ART-STYLE.md); not yet won, it shows as a silhouette
  const icon = `<img src="icons/Pixelart/FEATS/${esc(f.id)}.png" width="256" height="256" loading="lazy" alt="">`;
  if (wins?.length) {
    const first = wins.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
    const times = wins.length > 1 ? `<span class="tc-times data-num">×${wins.length}</span>` : '';
    const v = featValue(f, first.value);
    return `<article class="tc-card is-won tier-${f.tier}" style="--hue:${seasonHue(first.season)}deg">
      <span class="tc-trophy" aria-hidden="true">${icon}${times}</span>
      <div class="tc-body">
        <h3 class="tc-name">${esc(f.name)}</h3>
        <p class="tc-won"><b class="data-num">${esc(v)}</b>${first.whole ? ` <span class="tc-tag">${t('feat.ui.whole')}</span>` : ''}
          <span class="tc-date">${esc(fmtDate(first.date, { day: 'numeric', month: 'short', year: 'numeric' }))}</span></p>
        <p class="tc-blurb">${esc(f.blurb)}</p>
        ${rewardLine}
        <div class="tc-foot">${labels.join('')}
          ${first.workoutId ? `<button class="btn tiny ghost" data-action="open-workout" data-id="${esc(first.workoutId)}">${t('feat.ui.session')}</button>` : ''}</div>
      </div>
    </article>`;
  }
  const nm = nearMiss(f, workouts);
  const near = nm && nm.target != null
    ? `<div class="tc-near">${meter(progressOf(f, nm), { segments: 12, cls: 'tc-meter', label: t('feat.ui.nearAria', { best: featValue(f, nm.best), target: featValue(f, nm.target) }) })}
        <p class="tc-best">${t('feat.ui.best', { best: `<b class="data-num">${esc(featValue(f, nm.best))}</b>`, target: esc(featValue(f, nm.target)) })}${nm.whole ? ` <span class="tc-tag">${t('feat.ui.whole')}</span>` : ''}</p></div>`
    : `<p class="tc-best is-none">${t('feat.ui.notYet')}</p>`;
  return `<article class="tc-card is-locked tier-${f.tier}">
    <span class="tc-trophy" aria-hidden="true">${icon}</span>
    <div class="tc-body">
      <h3 class="tc-name">${esc(f.name)}</h3>
      <p class="tc-blurb">${esc(f.blurb)}</p>
      ${near}
      ${rewardLine}
      <div class="tc-foot">${labels.join('')}</div>
    </div>
  </article>`;
}

// gym: the strength feats need a bodyweight and the gym check-in
function gymNeeds() {
  const settings = store.getSettings() || {};
  const log = (settings.bodyMetrics || []).filter((m) => Number(m.weight) > 0).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const last = log[0];
  return `<section class="tc-needs" aria-labelledby="tc-needs-h">
    <h3 id="tc-needs-h" class="gw-row-h">${svg('gym')} ${t('feat.ui.needsTitle')}</h3>
    <form class="tc-bw" data-tc-bw>
      <label class="field"><span>${t('feat.ui.bodyweight')}</span>
        <input type="number" name="weight" min="30" max="250" step="0.1" inputmode="decimal" autocomplete="off" value="${last ? esc(last.weight) : ''}" required></label>
      <button class="btn tiny primary" type="submit">${t('feat.ui.saveWeight')}</button>
    </form>
    <p class="gw-note">${last ? t('feat.ui.weightLogged', { date: esc(fmtDate(last.date, { day: 'numeric', month: 'short' })) }) : t('feat.ui.weightWhy')}</p>
    <p class="gw-note">${checkinOn() ? `${svg('pin')} ${t('feat.ui.checkinOn')}`
      : `${svg('pin')} ${t('feat.ui.checkinOff')} <button class="link" data-tc-checkin>${t('feat.ui.checkinTurnOn')}</button>`}</p>
  </section>`;
}

/** Open the trophy case on a sport (or 'cross'). */
export function openTrophyCase(sport = 'run') {
  let off = null;
  const root = openLayer('trophy-case', { className: 'gear-layer', instant: true, onClose: () => off?.() });
  let current = CASE_SPORTS.includes(sport) ? sport : 'run';

  const draw = () => {
    const workouts = store.getWorkouts();
    const won = wonByFeat();
    const feats = featsFor(current);
    const n = feats.filter((f) => won.has(f.id)).length;
    const tabs = `<div class="pg-sports gw-sports tc-tabs" role="tablist" aria-label="${t('feat.ui.sports')}">${CASE_SPORTS.map((s) => {
      const on = s === current;
      return `<button class="pg-sport ${on ? 'active' : ''}" role="tab" id="tc-tab-${s}" aria-selected="${on}" aria-controls="tc-panel" tabindex="${on ? 0 : -1}" data-tc-sport="${s}">${svg(s === 'cross' ? 'brick' : s)}<span>${t(`feat.ui.sport.${s}`)}</span></button>`;
    }).join('')}</div>`;
    const top = root.querySelector('.fh-screen')?.scrollTop || 0;
    root.innerHTML = `<div class="fh-screen gw-screen tc-screen" role="dialog" aria-modal="true" aria-labelledby="tc-title">
      ${sheetHead({ lead: 'back', icon: 'trophy', title: t('feat.ui.title'), id: 'tc-title', action: '' })}
      ${tabs}
      <p class="tc-count"><b class="data-num">${n}</b> ${t('feat.ui.ofWon', { total: feats.length })}
        ${featsSynced() ? `<button class="btn tiny ghost" data-tc-refresh>${svg('sync')} ${t('feat.ui.check')}</button>` : ''}</p>
      ${featsSynced() ? '' : `<p class="gw-note">${t('feat.ui.signedOut')}</p>`}
      ${current === 'gym' ? gymNeeds() : ''}
      <div class="tc-grid" role="tabpanel" id="tc-panel" aria-labelledby="tc-tab-${current}">${feats.map((f) => featCard(f, won.get(f.id), workouts)).join('')}</div>
      <p class="gw-note gw-honest">${svg('check')} ${t('feat.ui.honest')}</p>
    </div>`;
    if (top) root.querySelector('.fh-screen').scrollTop = top;
  };

  off = onFeats(() => { if (root.isConnected) draw(); });
  root.onclick = async (e) => {
    const tab = e.target.closest('[data-tc-sport]');
    if (tab) { current = tab.dataset.tcSport; draw(); root.querySelector(`#tc-tab-${current}`)?.focus({ preventScroll: true }); return; }
    const r = e.target.closest('[data-tc-refresh]');
    if (r) {
      await busy(r, refreshFeats);
      draw();
      return;
    }
    if (e.target.closest('[data-tc-checkin]')) { openCheckinSheet({ onChange: () => { if (root.isConnected) draw(); } }); }
  };
  // arrow keys move between the sport tabs (one tab stop, as a tablist should be)
  root.onkeydown = (e) => {
    if (!e.target.matches('[data-tc-sport]') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = CASE_SPORTS.indexOf(current);
    const n = CASE_SPORTS.length;
    current = CASE_SPORTS[e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n];
    draw();
    root.querySelector(`#tc-tab-${current}`)?.focus();
  };
  root.onsubmit = (e) => {
    const form = e.target.closest('[data-tc-bw]');
    if (!form) return;
    e.preventDefault();
    const kg = Math.round(Number(form.weight.value) * 10) / 10;
    if (!(kg >= 30 && kg <= 250)) return;
    const today = todayISO();
    const log = (store.getSettings().bodyMetrics || []).filter((m) => m.date !== today);
    log.push({ ...((store.getSettings().bodyMetrics || []).find((m) => m.date === today) || {}), date: today, weight: kg });
    store.setSetting('bodyMetrics', log);
    toast(t('feat.ui.weightSaved', { kg: fmtNum(kg, { maximumFractionDigits: 1 }) }), { icon: svg('check') });
    draw();
  };
  draw();
  if (featsSynced()) refreshFeats();
  return root;
}

/** One line for a feat just won, for a toast. */
export const featWonText = (a) => {
  const f = featById(a.featId);
  return f ? `<b>${esc(t('feat.ui.won'))}</b><br>${esc(f.name)}${a.value != null ? ` · ${esc(featValue(f, a.value))}` : ''}` : '';
};
export { FEATS };
