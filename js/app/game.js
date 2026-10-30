// game.js — the season path sheet (the Journal's This week panel opens it): week
// by week from now to the next event. The map itself is computed in
// core/path.js; this file only draws it.

import { svg } from '../core/icons.js';
import { seasonPath } from '../core/path.js';
import { shortLabel } from '../core/dates.js';
import { esc, meter } from './ui.js';
import { openLayer, closeLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { t, fmtNum } from '../core/i18n.js';

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
