// game.js — the game layer on Home: the week path (seven stops, flags for
// Strava-verified days, a marker on today, the next event as a finish gate)
// and the season path sheet it opens. The map itself is computed in
// core/path.js; this file only draws it.

import { svg } from '../core/icons.js';
import { weekPath, seasonPath } from '../core/path.js';
import { shortLabel, weekdayName } from '../core/dates.js';
import { esc, meter } from './ui.js';
import { openLayer, closeLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { t, tList, fmtNum } from '../core/i18n.js';
import { DISCIPLINES } from '../core/disciplines.js';

const DAY_LETTER = () => tList('date.dayLetters');

function stop(day, i, gateHere) {
  const icons = day.types.slice(0, 2).map((type) => svg(type, `tint-${type}`)).join('');
  const body = icons || (day.rest ? svg('moon') : '');
  const state = day.flag ? 'verified' : day.isPast && day.types.length ? 'missed' : day.rest ? 'rest' : day.types.length ? 'planned' : 'empty';
  const what = day.types.length ? day.types.map((type) => (DISCIPLINES[type] || DISCIPLINES.other).label.toLowerCase()).join(t('misc.and'))
    : day.rest ? t('misc.restLow') : t('misc.nothing');
  const label = `${t('misc.stopLabel', { day: weekdayName(day.date), what })}${day.flag ? t('misc.verified') : ''}${day.isToday ? t('misc.today') : ''}`;
  return `<li class="wk-stop is-${state}${day.isToday ? ' is-today' : ''}${day.isPast ? ' is-past' : ''}${gateHere ? ' has-gate' : ''}" aria-label="${esc(label)}">
      <span class="wk-day" aria-hidden="true">${DAY_LETTER()[i]}</span>
      <span class="wk-tile" aria-hidden="true">${body}${day.flag ? '<i class="wk-flag"></i>' : ''}${day.isToday ? '<i class="wk-me"></i>' : ''}</span>
    </li>`;
}

/** Home: this week as a path of seven stops, plus the next event's gate. */
export function weekPathCard(ctx) {
  const p = weekPath(ctx.workouts, ctx.today, ctx.settings?.events);
  const flags = p.days.filter((d) => d.flag).length;
  const planned = p.days.filter((d) => d.types.length).length;
  const ev = p.event;
  const gateDay = ev?.inWeek ? p.days.findIndex((d) => d.date === ev.date) : -1;
  const gate = ev && !ev.inWeek
    ? `<li class="wk-gate" aria-label="${esc(t('misc.gateAria', { title: ev.title, n: ev.daysLeft }))}"><span class="wk-day" aria-hidden="true">${t('misc.daysShort', { n: ev.daysLeft })}</span><span class="wk-tile" aria-hidden="true">${svg('flag')}</span></li>`
    : '';
  const evLine = ev
    ? `<span class="wk-ev">${svg('flag')} ${esc(ev.title)} · ${ev.daysLeft === 0 ? t('misc.todayLow') : t('misc.dShort', { n: ev.daysLeft })}</span>` : '';
  return `<section class="card wk-path" data-action="open-season" role="button" tabindex="0"
      aria-label="${esc(t('misc.weekAria', { flags, planned, ev: ev ? t('misc.weekAriaEv', { title: ev.title, n: ev.daysLeft }) : '' }))}">
    <div class="wk-head"><h4>${t('misc.week')}</h4>${evLine}</div>
    <ol class="wk-track${gate ? ' has-gate-col' : ''}">${p.days.map((d, i) => stop(d, i, i === gateDay)).join('')}${gate}</ol>
  </section>`;
}

/** The season path sheet: week by week from now to the next event. */
export function openSeasonPath(ctx) {
  const s = seasonPath(ctx.workouts, ctx.today, ctx.settings?.events);
  const root = openLayer('season-path');
  const rows = s.weeks.map((w, i) => {
    const frac = w.planned ? w.done / w.planned : 0;
    const cls = `${w.isCurrent ? 'is-current' : ''} ${w.isEventWeek ? 'is-event' : ''} ${w.planned && w.done >= w.planned ? 'is-cleared' : ''}`;
    return `<li class="sp-week ${cls}">
        <span class="sp-node" aria-hidden="true">${w.isEventWeek ? svg('flag') : w.isCurrent ? '<i class="wk-me"></i>' : w.planned && w.done >= w.planned ? svg('check') : ''}</span>
        <div class="sp-body">
          <div class="sp-top"><b>${t('misc.weekN', { n: i + 1 })}</b><span>${esc(shortLabel(w.start))}</span>${w.isCurrent ? `<span class="tag today">${t('misc.now')}</span>` : ''}</div>
          ${meter(frac, { segments: 10, cls: w.isEventWeek ? 'good' : '', label: t('misc.sessionsVerified', { done: w.done, planned: w.planned }) })}
          <small class="sp-meta"><span class="data-num">${w.done}</span> / <span class="data-num">${w.planned}</span>${t('misc.sessionsWord')}<span class="data-num">${fmtNum(Math.round(w.minutes / 6) / 10)}</span><span class="data-unit">${t('misc.hPlanned')}</span></small>
        </div>
      </li>`;
  }).join('');
  const title = s.event ? `${esc(s.event.title)} · ${t('misc.dShort', { n: s.event.daysLeft })}` : t('misc.next8');
  root.innerHTML = `
    <div class="modal-backdrop" data-sp-close></div>
    <div class="modal sp-modal" role="dialog" aria-modal="true" aria-label="${t('misc.seasonPath')}">
      ${sheetHead({ icon: 'route', title: t('misc.seasonPath'), closeAttr: 'data-sp-close' })}
      <div class="modal-body">
        <p class="sp-goal">${svg('flag')} ${title}</p>
        <ol class="sp-list">${rows}</ol>
        ${s.event ? '' : `<p class="muted small">${t('misc.addRace')}</p>`}
      </div>
    </div>`;
  const close = () => closeLayer(root);
  root.querySelectorAll('[data-sp-close]').forEach((b) => b.addEventListener('click', close));
}
