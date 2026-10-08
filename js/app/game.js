// game.js — the game layer on Home: the week path (seven stops, flags for
// Strava-verified days, a marker on today, the next event as a finish gate)
// and the season path sheet it opens. The map itself is computed in
// core/path.js; this file only draws it.

import { svg } from '../core/icons.js';
import { weekPath, seasonPath } from '../core/path.js';
import { shortLabel, weekdayName } from '../core/dates.js';
import { esc, meter } from './ui.js';

const DAY_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function stop(day, i, gateHere) {
  const icons = day.types.slice(0, 2).map((t) => svg(t, `tint-${t}`)).join('');
  const body = icons || (day.rest ? svg('moon') : '');
  const state = day.flag ? 'verified' : day.isPast && day.types.length ? 'missed' : day.rest ? 'rest' : day.types.length ? 'planned' : 'empty';
  const label = `${weekdayName(day.date)}: ${day.types.length ? day.types.join(' and ') : day.rest ? 'rest' : 'nothing planned'}${day.flag ? ', verified' : ''}${day.isToday ? ', today' : ''}`;
  return `<li class="wk-stop is-${state}${day.isToday ? ' is-today' : ''}${day.isPast ? ' is-past' : ''}${gateHere ? ' has-gate' : ''}" aria-label="${esc(label)}">
      <span class="wk-day" aria-hidden="true">${DAY_LETTER[i]}</span>
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
    ? `<li class="wk-gate" aria-label="${esc(`${ev.title} in ${ev.daysLeft} days`)}"><span class="wk-day" aria-hidden="true">${ev.daysLeft}d</span><span class="wk-tile" aria-hidden="true">${svg('flag')}</span></li>`
    : '';
  const evLine = ev
    ? `<span class="wk-ev">${svg('flag')} ${esc(ev.title)} · ${ev.daysLeft === 0 ? 'today' : `${ev.daysLeft} d`}</span>` : '';
  return `<section class="card wk-path" data-action="open-season" role="button" tabindex="0"
      aria-label="${esc(`Week path: ${flags} of ${planned} days verified${ev ? `, ${ev.title} in ${ev.daysLeft} days` : ''}. Open the season path`)}">
    <div class="wk-head"><h4>Week path</h4>${evLine}</div>
    <ol class="wk-track${gate ? ' has-gate-col' : ''}">${p.days.map((d, i) => stop(d, i, i === gateDay)).join('')}${gate}</ol>
  </section>`;
}

/** The season path sheet: week by week from now to the next event. */
export function openSeasonPath(ctx) {
  const s = seasonPath(ctx.workouts, ctx.today, ctx.settings?.events);
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  const rows = s.weeks.map((w, i) => {
    const frac = w.planned ? w.done / w.planned : 0;
    const cls = `${w.isCurrent ? 'is-current' : ''} ${w.isEventWeek ? 'is-event' : ''} ${w.planned && w.done >= w.planned ? 'is-cleared' : ''}`;
    return `<li class="sp-week ${cls}">
        <span class="sp-node" aria-hidden="true">${w.isEventWeek ? svg('flag') : w.isCurrent ? '<i class="wk-me"></i>' : w.planned && w.done >= w.planned ? svg('check') : ''}</span>
        <div class="sp-body">
          <div class="sp-top"><b>Week ${i + 1}</b><span>${esc(shortLabel(w.start))}</span>${w.isCurrent ? '<span class="tag today">Now</span>' : ''}</div>
          ${meter(frac, { segments: 10, cls: w.isEventWeek ? 'good' : '', label: `${w.done} of ${w.planned} sessions verified` })}
          <small class="sp-meta"><span class="data-num">${w.done}</span> / <span class="data-num">${w.planned}</span> sessions · <span class="data-num">${Math.round(w.minutes / 6) / 10}</span><span class="data-unit"> h planned</span></small>
        </div>
      </li>`;
  }).join('');
  const title = s.event ? `${esc(s.event.title)} · ${s.event.daysLeft} d` : 'Next 8 weeks';
  root.innerHTML = `
    <div class="modal-backdrop" data-sp-close></div>
    <div class="modal sp-modal" role="dialog" aria-modal="true" aria-label="Season path">
      <header class="modal-head"><h2>${svg('route')} Season path</h2><button class="icon-btn" data-sp-close aria-label="Close">${svg('close')}</button></header>
      <div class="modal-body">
        <p class="sp-goal">${svg('flag')} ${title}</p>
        <ol class="sp-list">${rows}</ol>
        ${s.event ? '' : '<p class="muted small">Add a race in Settings and the path runs to its finish gate.</p>'}
      </div>
    </div>`;
  const close = () => { root.innerHTML = ''; root.classList.remove('open'); };
  root.querySelectorAll('[data-sp-close]').forEach((b) => b.addEventListener('click', close));
}
