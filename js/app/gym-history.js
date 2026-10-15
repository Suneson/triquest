// gym-history.js — tracking views built on js/core/gym-stats.js:
//   - the exercise history sheet (records, an estimated-1RM chart, every session)
//   - the records shelf under the trophy cabinet
//   - the gym card in the Fitness hub (weekly working sets per muscle, and the
//     muscle balance of the last four weeks, described, not prescribed)
// Charts use the shared pixel telemetry pieces (stepped lines, block bars).

import * as store from './store.js';
import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { exerciseArtSrc, exerciseById, MUSCLES } from '../core/exercises.js';
import { shortLabel } from '../core/dates.js';
import { fmtClock, formatSet } from '../core/gym-log.js';
import {
  exerciseHistory, exerciseRecords, recordsShelf, weeklyMuscleSets, muscleBalance, describeBalance, E1RM_MAX_REPS,
} from '../core/gym-stats.js';
import { layer, closeLayer } from './gym-picker.js';
import { PAD, wavePath, telemetryGrid, square, blockBars } from './pixel-chart.js';

const kg = (v) => `${Number.isInteger(v) ? v : v.toFixed(1)}<span class="data-unit"> kg</span>`;

function tile(label, value, sub = '') {
  return `<div class="gh-tile"><span class="gl-k">${esc(label)}</span><b class="data-num">${value}</b>${sub ? `<small class="muted">${esc(sub)}</small>` : ''}</div>`;
}

/** The metric charted per session: estimated 1RM, else best reps, else longest time. */
function series(hist) {
  if (hist.some((h) => h.e1rm)) return { label: 'Estimated 1RM', unit: 'kg', vals: hist.filter((h) => h.e1rm).map((h) => ({ v: h.e1rm, date: h.date })) };
  if (hist.some((h) => h.best?.seconds)) return { label: 'Longest set', unit: 's', vals: hist.map((h) => ({ v: h.best?.seconds || 0, date: h.date })) };
  return { label: 'Most reps', unit: 'reps', vals: hist.map((h) => ({ v: Math.max(0, ...h.sets.map((s) => s.reps || 0)), date: h.date })) };
}

function lineChart(points, W = 320, H = 120) {
  if (points.length < 2) return '';
  const vals = points.map((p) => p.v);
  const lo = Math.min(...vals); const hi = Math.max(...vals);
  // show the change, not the distance from zero: the floor sits a little under the lowest point
  const floor = Math.max(0, lo - (hi - lo || hi * 0.1) * 0.5);
  const shifted = vals.map((v) => v - floor);
  const { d, pts } = wavePath(shifted, W, H, Math.max(...shifted) * 1.1 || 1);
  const dots = pts.map(([x, y], i) => square(x, y, i === pts.length - 1 ? 8 : 4, `class="fh-dot ${i === pts.length - 1 ? 'end' : ''}"`)).join('');
  return `<svg class="fh-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
      aria-label="${esc(`From ${points[0].v} on ${points[0].date} to ${points.at(-1).v} on ${points.at(-1).date}`)}">
    ${telemetryGrid(W, H)}
    <path class="fh-area" d="${d} V ${H - PAD} H ${PAD} Z" fill="var(--acc-orange)"/>
    <path class="fh-line" d="${d}" stroke="var(--acc-orange)"/>${dots}
  </svg>`;
}

/** Open the history sheet for an exercise ({ libId, name }). */
export function openExerciseHistory(key) {
  const workouts = store.getWorkouts();
  const lib = exerciseById(key.libId);
  const custom = (store.getSettings().customExercises || []).find((c) => c.id === key.libId);
  const name = lib?.name || custom?.name || key.name || 'Exercise';
  const hist = exerciseHistory(workouts, key);
  const rec = exerciseRecords(hist);
  const art = exerciseArtSrc(key.libId);
  const kind = hist.at(-1)?.kind || lib?.defaultKind || 'weight_reps';

  const tiles = [
    rec.e1rm && tile('Est. 1RM', kg(rec.e1rm.value), `${rec.e1rm.weight} kg × ${rec.e1rm.reps} · ${shortLabel(rec.e1rm.date)}`),
    rec.heaviest && tile('Heaviest', kg(rec.heaviest.weight), `× ${rec.heaviest.reps} · ${shortLabel(rec.heaviest.date)}`),
    rec.reps && tile('Most reps', `${rec.reps.reps}`, shortLabel(rec.reps.date)),
    rec.time && tile('Longest', fmtClock(rec.time.seconds), shortLabel(rec.time.date)),
    rec.volume && tile('Best session', kg(rec.volume.value), `volume · ${shortLabel(rec.volume.date)}`),
  ].filter(Boolean).join('');
  const sr = series(hist);
  const chart = lineChart(sr.vals);
  const rows = [...hist].reverse().map((h) => `<li class="gh-row">
      <span class="gh-date">${esc(shortLabel(h.date))}</span>
      <span class="gh-sets">${h.sets.map((s) => esc(formatSet(s, h.kind) || '–')).join('<span class="muted"> · </span>')}</span>
    </li>`).join('');

  const root = layer('exercise-history');
  root.innerHTML = `
    <div class="modal-backdrop" data-pk-close></div>
    <div class="modal pk-modal" role="dialog" aria-modal="true" aria-label="${esc(name)} history">
      <header class="modal-head"><h2>${svg('trophy')} History</h2><button class="icon-btn" data-pk-close aria-label="Close">${svg('close')}</button></header>
      <div class="modal-body">
        <div class="gl-ex-head">
          <div class="ex-img ${art ? 'ex-art' : ''}">${art ? `<img src="${esc(art)}" alt="" width="64" height="64" loading="lazy">` : svg('gym')}</div>
          <div class="gl-ex-title"><h5>${esc(name)}</h5><span class="muted small">${esc([lib?.muscle || custom?.muscle, lib?.equipment || custom?.equipment].filter(Boolean).join(' · '))}</span></div>
        </div>
        ${hist.length ? `
          <div class="gh-tiles">${tiles}</div>
          ${rec.e1rm ? `<p class="muted small gh-note">Est. 1RM is an estimate from your best set (Epley formula, sets of ${E1RM_MAX_REPS} reps or fewer), not a lift you did.</p>` : ''}
          ${chart ? `<section class="gh-chart"><h4>${esc(sr.label)}</h4>${chart}
            <div class="fh-range">${esc(shortLabel(sr.vals[0].date))} – ${esc(shortLabel(sr.vals.at(-1).date))}</div></section>` : ''}
          <section><h4>Sessions <span class="muted data-num">${hist.length}</span></h4><ul class="gh-list">${rows}</ul></section>`
    : '<p class="muted">No ticked sets for this exercise yet. Its records and chart start with your first logged session.</p>'}
      </div>
    </div>`;
  root.onclick = (e) => { if (e.target.closest('[data-pk-close]')) closeLayer(); };
  return kind;
}

// ---- records shelf (inside the trophy cabinet) -------------------------------------------------

export function recordsShelfHtml(workouts) {
  const rows = recordsShelf(workouts, 8);
  if (!rows.length) return `<div class="rc"><h5 class="rc-h">Records</h5><p class="muted small">Your best lifts land here once you've logged a gym session.</p></div>`;
  return `<div class="rc"><h5 class="rc-h">Records</h5>
    <ul class="rc-shelf">${rows.map((r) => {
    const art = exerciseArtSrc(r.key.libId);
    return `<li><button class="rc-plaque" data-rec-lib="${esc(r.key.libId || '')}" data-rec-name="${esc(r.name)}" aria-label="${esc(`${r.name}: ${r.headline.text} ${r.headline.sub}. Open history`)}">
        <span class="pk-thumb ${art ? 'ex-art' : ''}" aria-hidden="true">${art ? `<img src="${esc(art)}" alt="" width="48" height="48" loading="lazy">` : svg('gym')}</span>
        <span class="rc-txt"><b>${esc(r.name)}</b><small class="muted">${esc(r.headline.sub)} · ${esc(shortLabel(r.date))}</small></span>
        <b class="rc-val data-num">${esc(r.headline.text)}</b>
      </button></li>`;
  }).join('')}</ul></div>`;
}

export function wireRecords(root) {
  root?.querySelectorAll('[data-rec-name]').forEach((b) => b.addEventListener('click', () =>
    openExerciseHistory({ libId: b.dataset.recLib || null, name: b.dataset.recName })));
}

// ---- gym card (Fitness hub) ---------------------------------------------------------------------

function weeklyChart(weeks, muscle) {
  const W = 320; const H = 96;
  const vals = weeks.map((w) => (muscle ? w.byMuscle[muscle] || 0 : w.total));
  const max = Math.max(4, ...vals);
  const bars = blockBars(vals, W, H, max, (i, v) => (!v ? 'zero' : i === vals.length - 1 ? 'gnow' : 'wk'));
  return `<svg class="fh-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
      aria-label="${esc(`Working sets per week${muscle ? ` for ${muscle}` : ''}: ${vals.join(', ')}`)}">
    ${telemetryGrid(W, H)}${bars}</svg>`;
}

export function gymCardHtml(ctx) {
  const weeks = weeklyMuscleSets(ctx.workouts, ctx.today, 8);
  const any = weeks.some((w) => w.total);
  const bal = muscleBalance(ctx.workouts, ctx.today, 28);
  if (!any && !bal.total) {
    return `<section class="card fh-block gh-card"><h4>Gym</h4><p class="muted small">Log a gym session and your weekly volume and muscle balance show up here.</p></section>`;
  }
  const trained = MUSCLES.filter((m) => weeks.some((w) => w.byMuscle[m]));
  const thisWeek = weeks.at(-1).total;
  const maxShare = Math.max(...bal.rows.map((r) => r.share), 0.01);
  return `<section class="card fh-block gh-card" data-gh-card>
    <h4>Gym volume</h4>
    <div class="gh-head">
      <div class="fh-big data-num">${thisWeek}<small class="data-unit"> sets this week</small></div>
      <label class="chip gl-chip"><select data-gh-muscle aria-label="Muscle">
        <option value="">All muscles</option>${trained.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}
      </select></label>
    </div>
    <div data-gh-weekly>${weeklyChart(weeks, '')}</div>
    <div class="fh-range">Working sets per week · ${esc(shortLabel(weeks[0].weekStart))} – this week</div>
    <h4 class="gh-bal-h">Muscle balance <small class="muted">last 4 weeks</small></h4>
    <p class="small gh-desc">${esc(describeBalance(bal))}</p>
    <ul class="gh-bal">${bal.rows.map((r) => `<li>
      <span class="gh-m">${esc(r.muscle)}</span>
      <span class="gh-track" aria-hidden="true"><i style="width:${Math.max(4, Math.round((r.share / maxShare) * 100))}%"></i></span>
      <span class="data-num gh-n">${r.sets}</span>
    </li>`).join('')}</ul>
  </section>`;
}

export function wireGymCard(root, ctx) {
  const card = root?.querySelector('[data-gh-card]');
  if (!card) return;
  const weeks = weeklyMuscleSets(ctx.workouts, ctx.today, 8);
  card.querySelector('[data-gh-muscle]')?.addEventListener('change', (e) => {
    card.querySelector('[data-gh-weekly]').innerHTML = weeklyChart(weeks, e.target.value);
  });
}
