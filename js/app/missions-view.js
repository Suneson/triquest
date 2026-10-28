// missions-view.js — the mission board (docs/LOOP.md §5.1–5.2), opened from the
// board that stands in every room: this week's three missions, next week's,
// and the season you're in, with its colours, what it has held so far and the
// kit colourway it can give. Also the recap card a season leaves behind.
// Plain facts: nothing here counts down at you or says you're behind.

import { esc, meter } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { todayISO, addDays } from '../core/dates.js';
import { weekOf, missionBoard, weeklyMissions, missionById, daysLeftInWeek, MISSION_RULES } from '../core/missions.js';
import { seasonInfo, seasonDaysLeft, seasonRecap, missionsIn, seasonKitId, previousSeason, recapDue, SEASON_RULES } from '../core/seasons.js';
import { kitArt } from '../core/gear.js';
import { gearState, gearEnabled, claimMissions, onGear } from './gear-state.js';
import { featAwards } from './feats-state.js';
import { openLayer, closeLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import * as store from './store.js';

const SEASON_ART = (theme) => `icons/Pixelart/NEW/SEASONS/season-${theme}.png`;
export const BOARD_ART = 'icons/Pixelart/NEW/ITEMS/mission-board.webp';
const missionName = (id) => t(`mission.${id}.name`);
const missionText = (id) => t(`mission.${id}.blurb`, { n: fmtNum(missionById(id)?.target || 0) });
const valueText = (m) => (m.unit === 'min' ? t('mission.ui.hours', { n: fmtNum(Math.floor(m.value / 60)), of: fmtNum(m.target / 60) })
  : m.unit === 'km' ? t('mission.ui.km', { n: fmtNum(m.value), of: fmtNum(m.target) })
    : t('mission.ui.count', { n: fmtNum(m.value), of: fmtNum(m.target) }));

/** The colours a season paints its board in, as CSS custom properties. */
export const seasonStyle = (theme) => `--sea-accent:${theme.colors.accent};--sea-deep:${theme.colors.deep};--sea-ink:${theme.colors.ink}`;

/** How many of this week's missions are done (for the board in the rooms). */
export function boardCount(workouts) {
  const today = todayISO();
  const b = missionBoard(weekOf(today), workouts, today, gearState().missions);
  return { done: b.filter((m) => m.done).length, total: b.length };
}

function rewardChips() {
  const r = MISSION_RULES.reward;
  return `<span class="mb-reward" aria-label="${esc(t('mission.ui.rewardAria', { coins: r.coins, carbs: r.carbs }))}">
    <span><img src="icons/Pixelart/GEAR/coin.png" width="20" height="20" alt="">${fmtNum(r.coins)}</span>
    <span><img src="icons/Pixelart/GEAR/carbs.png" width="20" height="20" alt="">${fmtNum(r.carbs)}</span></span>`;
}

function missionCard(m) {
  const state = m.claimed ? 'is-paid' : m.done ? 'is-done' : '';
  const badge = m.claimed ? `<span class="mb-stamp">${svg('check')} ${t('mission.ui.paid')}</span>`
    : m.done ? `<span class="mb-stamp is-pending">${t('mission.ui.paying')}</span>` : '';
  return `<li class="mb-card ${state}${m.kind === 'rest' ? ' is-rest' : ''}">
    <span class="mb-ico" aria-hidden="true">${svg(m.kind === 'rest' ? 'moon' : 'target')}</span>
    <div class="mb-txt">
      <small>${t(m.kind === 'rest' ? 'mission.ui.rest' : 'mission.ui.training')}</small>
      <b>${esc(missionName(m.id))}</b>
      <span class="mb-blurb">${esc(missionText(m.id))}</span>
      ${meter(m.value / m.target, { segments: Math.min(12, Math.max(4, m.target > 12 ? 10 : m.target * 2)), cls: 'mb-meter', label: valueText(m) })}
      <span class="mb-val data-num">${valueText(m)}</span>
    </div>
    <div class="mb-side">${rewardChips()}${badge}</div>
  </li>`;
}

function seasonBlock(today, claims) {
  const s = seasonInfo(today);
  const r = seasonRecap(s.id, { workouts: store.getWorkouts(), claims, featAwards: featAwards() });
  const n = missionsIn(s.id, claims).length;
  const kitId = seasonKitId(s.theme.id);
  const owned = gearState().inventory.some((x) => x.item_id === kitId);
  const stat = (k, v) => `<li><b class="data-num">${v}</b><small>${t(`season.stat.${k}`)}</small></li>`;
  return `<section class="mb-season" style="${seasonStyle(s.theme)}" aria-labelledby="mb-sea-h">
    <header class="mb-sea-head">
      <img class="mb-sea-art" src="${SEASON_ART(s.theme.id)}" width="96" height="96" alt="">
      <div><small>${t('season.label', { year: s.year })}</small><h3 id="mb-sea-h">${esc(t(`season.name.${s.theme.id}`))}</h3>
        <span class="mb-sea-left">${t('season.daysLeft', { n: seasonDaysLeft(today) })}</span></div>
    </header>
    <ul class="mb-stats">${stat('sessions', fmtNum(r.sessions))}${stat('hours', fmtNum(r.hours))}${stat('km', fmtNum(r.km))}${stat('missions', fmtNum(r.missions))}${stat('feats', fmtNum(r.feats))}</ul>
    <div class="mb-kit${owned ? ' is-owned' : ''}">
      <img src="${kitArt(kitId)}" width="72" height="72" alt="">
      <div><b>${esc(t('season.kit', { name: t(`season.name.${s.theme.id}`) }))}</b>
        ${owned ? `<span>${t('season.kitOwned')}</span>`
    : `<span>${t('season.kitHow', { n: SEASON_RULES.kitMissions })}</span>${meter(n / SEASON_RULES.kitMissions, { segments: SEASON_RULES.kitMissions, cls: 'mb-meter', label: t('season.kitProgress', { n: Math.min(n, SEASON_RULES.kitMissions), of: SEASON_RULES.kitMissions }) })}`}
      </div>
    </div>
    <p class="mb-note">${t('season.keep')}</p>
    ${previousSeason(s.id) >= SEASON_RULES.first ? `<button class="btn ghost small" data-mb-recap="${previousSeason(s.id)}">${svg('scroll')} ${t('season.lastRecap')}</button>` : ''}
  </section>`;
}

/** The mission board sheet. */
export function openMissionBoard(ctx) {
  const root = openLayer('mission-board');
  let off = null;
  const draw = () => {
    const today = todayISO();
    const week = weekOf(today);
    const claims = gearState().missions;
    const board = missionBoard(week, ctx?.workouts || store.getWorkouts(), today, claims);
    const next = weeklyMissions(addDays(week, 7));
    const theme = seasonInfo(today).theme;
    root.innerHTML = `<div class="modal-backdrop" data-mb-close></div>
      <div class="modal mb-modal" role="dialog" aria-modal="true" aria-labelledby="mb-h" style="${seasonStyle(theme)}">
        ${sheetHead({ title: t('mission.ui.title'), id: 'mb-h', closeAttr: 'data-mb-close', before: `<img class="mb-head-art" src="${BOARD_ART}" width="40" height="40" alt="">` })}
        <div class="modal-body">
          ${gearEnabled() ? '' : `<p class="gw-note">${t('gear.signIn')}</p>`}
          <section aria-labelledby="mb-week">
            <h3 id="mb-week" class="mb-h">${t('mission.ui.thisWeek')} <span class="mb-left">${t('mission.ui.daysLeft', { n: daysLeftInWeek(today) })}</span></h3>
            <ul class="mb-list">${board.map(missionCard).join('')}</ul>
            <p class="mb-note">${svg('moon')} ${t('mission.ui.restSame')}</p>
          </section>
          <section aria-labelledby="mb-next" class="mb-next">
            <h3 id="mb-next" class="mb-h">${t('mission.ui.nextWeek')}</h3>
            <ul>${next.map((id) => `<li>${svg(missionById(id).kind === 'rest' ? 'moon' : 'target')} ${esc(missionName(id))}</li>`).join('')}</ul>
          </section>
          ${seasonBlock(today, claims)}
        </div>
      </div>`;
    root.querySelectorAll('[data-mb-close]').forEach((b) => b.addEventListener('click', () => closeLayer(root)));
    root.querySelector('[data-mb-recap]')?.addEventListener('click', (e) => openSeasonRecap(e.currentTarget.dataset.mbRecap));
  };
  draw();
  off = onGear(() => { if (root.isConnected) draw(); else off?.(); });
  // anything done and not paid yet goes to the server now
  claimMissions(ctx?.workouts || store.getWorkouts()).then((n) => { if (n && root.isConnected) draw(); });
  return root;
}

/** The card a season leaves behind: what it held for you. Nothing on it is taken away. */
export function openSeasonRecap(id) {
  const root = openLayer('season-recap');
  const s = seasonInfo(id);
  const r = seasonRecap(id, { workouts: store.getWorkouts(), claims: gearState().missions, featAwards: featAwards() });
  const stat = (k, v) => `<li><b class="data-num">${v}</b><small>${t(`season.stat.${k}`)}</small></li>`;
  root.innerHTML = `<div class="modal-backdrop" data-sr-close></div>
    <div class="modal mb-modal sr-modal" role="dialog" aria-modal="true" aria-labelledby="sr-h" style="${seasonStyle(s.theme)}">
      ${sheetHead({ title: t('season.recapTitle'), id: 'sr-h', closeAttr: 'data-sr-close' })}
      <div class="modal-body">
        <div class="sr-card">
          <img class="sr-art" src="${SEASON_ART(s.theme.id)}" width="160" height="160" alt="">
          <small>${t('season.label', { year: s.year })}</small>
          <h3>${esc(t(`season.name.${s.theme.id}`))}</h3>
          <ul class="mb-stats">${stat('sessions', fmtNum(r.sessions))}${stat('hours', fmtNum(r.hours))}${stat('km', fmtNum(r.km))}${stat('missions', fmtNum(r.missions))}${stat('feats', fmtNum(r.feats))}${stat('coins', fmtNum(r.coins))}</ul>
          ${r.kit ? `<div class="mb-kit is-owned"><img src="${kitArt(r.kit)}" width="72" height="72" alt=""><div><b>${esc(t('season.kit', { name: t(`season.name.${s.theme.id}`) }))}</b><span>${t('season.kitOwned')}</span></div></div>` : ''}
          <p class="mb-note">${t('season.recapKeep')}</p>
        </div>
      </div>
    </div>`;
  root.querySelectorAll('[data-sr-close]').forEach((b) => b.addEventListener('click', () => closeLayer(root)));
  return root;
}

/** Show the last season's recap once, the first time the app opens after it closed. */
export function maybeShowRecap() {
  const seen = store.getSettings().recapsSeen || [];
  const due = recapDue(todayISO(), seen);
  if (!due) return;
  store.setSetting('recapsSeen', [...seen, due].slice(-12));
  openSeasonRecap(due);
}
