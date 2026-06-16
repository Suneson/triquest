// ui.js — pure-ish HTML rendering. Functions return HTML strings that main.js
// injects; all interactivity is wired via delegated data-action attributes.

import { formatDuration } from '../core/scoring.js';
import { poseSvgFor, cuesFor } from '../core/poses.js';
import { BADGES } from '../core/badges.js';
import { PLAN_PRINCIPLES, PACE_REFERENCE, RACES } from '../core/plan.js';
import { shortLabel, weekdayName, addDays, diffDays, parseISO } from '../core/dates.js';
import { weekKm, weekHours, acwr, runVolumeJump } from '../core/load.js';
import { DISCIPLINES, INTENSITIES, paceHint } from '../core/disciplines.js';

export { DISCIPLINES, INTENSITIES };

const PHASE_HOURS_TARGET = { base: 12, specific: 12, bridge: 9 };
const BIKE_WEEK_FLOOR = 200;

const SEG_INTENSITY = {
  easy: 'Easy', moderate: 'Moderate', threshold: 'Threshold', vo2: 'VO₂', steady: 'Steady',
};

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function fmtKm(km, units = 'metric') {
  if (!km) return '';
  if (units === 'imperial') return `${(km * 0.621371).toFixed(km < 10 ? 1 : 0)} mi`;
  return `${km % 1 ? km.toFixed(1) : km} km`;
}

// ---- HUD --------------------------------------------------------------------

export function renderHud(stats, streaks, units) {
  const pct = Math.round(stats.progress * 100);
  const totalKm = Object.values(stats.kmByType).reduce((a, b) => a + b, 0);
  return `
    <div class="hud-level">
      <div class="level-badge" title="Level ${stats.level}">${stats.level}</div>
      <div class="xp">
        <div class="xp-top"><span>Level ${stats.level}</span><span>${stats.into} / ${stats.span} XP</span></div>
        <div class="xp-bar"><div class="xp-fill" style="width:${pct}%"></div></div>
      </div>
    </div>
    <div class="hud-stats">
      <div class="stat" title="Current streak (longest ${streaks.longest})"><span class="stat-ico">🔥</span><b>${streaks.current}</b><small>day streak</small></div>
      <div class="stat" title="Total training time"><span class="stat-ico">⏱️</span><b>${stats.totalHours.toFixed(1)}</b><small>hours</small></div>
      <div class="stat" title="Total distance"><span class="stat-ico">📏</span><b>${Math.round(totalKm)}</b><small>${units === 'imperial' ? 'mi*' : 'km'}</small></div>
      <div class="stat" title="Sessions completed"><span class="stat-ico">✅</span><b>${stats.completedCount}</b><small>done</small></div>
    </div>`;
}

// ---- segment visualizer -----------------------------------------------------

export function segmentBar(segments) {
  if (!segments || !segments.length) return '';
  const total = segments.reduce((a, s) => a + (Number(s.value) || 0), 0) || 1;
  const bars = segments.map((s) => {
    const w = ((Number(s.value) || 0) / total) * 100;
    return `<div class="seg seg-${esc(s.intensity)}" style="width:${w}%" title="${esc(s.label)} · ${esc(s.value)}′ · ${esc(SEG_INTENSITY[s.intensity] || s.intensity)}"></div>`;
  }).join('');
  const present = [...new Set(segments.map((s) => s.intensity))];
  const legend = present.map((i) =>
    `<span class="legend-item"><i class="dot seg-${esc(i)}"></i>${esc(SEG_INTENSITY[i] || i)}</span>`).join('');
  return `<div class="segments"><div class="seg-bar">${bars}</div><div class="legend">${legend}</div></div>`;
}

// ---- exercises --------------------------------------------------------------

function exerciseRow(w, ex, idx) {
  const img = ex.imageUrl
    ? `<img class="ex-img" src="${esc(ex.imageUrl)}" alt="${esc(ex.name)}" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="ex-img">${poseSvgFor(ex.name)}</div>`;
  const cues = cuesFor(ex.name).map((c) => `<li>${esc(c)}</li>`).join('');
  return `
    <div class="exercise ${ex.done ? 'done' : ''}">
      ${img}
      <div class="ex-body">
        <div class="ex-head">
          <label class="ex-check">
            <input type="checkbox" data-action="toggle-exercise" data-id="${esc(w.id)}" data-ex="${idx}" ${ex.done ? 'checked' : ''}>
            <b>${esc(ex.name)}</b>
          </label>
          <span class="ex-prescribed">${esc(ex.sets)}×${esc(ex.reps)}</span>
        </div>
        <ul class="cues">${cues}</ul>
        <div class="ex-log">
          <label>kg<input type="text" inputmode="decimal" value="${esc(ex.weight)}" placeholder="–" data-action="exercise-field" data-id="${esc(w.id)}" data-ex="${idx}" data-field="weight"></label>
          <label>reps<input type="text" inputmode="numeric" value="${esc(ex.actualReps)}" placeholder="${esc(ex.reps)}" data-action="exercise-field" data-id="${esc(w.id)}" data-ex="${idx}" data-field="actualReps"></label>
          <label>RPE<input type="text" inputmode="decimal" value="${esc(ex.rpe)}" placeholder="–" data-action="exercise-field" data-id="${esc(w.id)}" data-ex="${idx}" data-field="rpe"></label>
        </div>
      </div>
    </div>`;
}

// ---- packing ----------------------------------------------------------------

function packingList(w) {
  const items = (w.packing || []).map((p, i) => `
    <li class="${p.checked ? 'checked' : ''}">
      <label><input type="checkbox" data-action="toggle-pack" data-id="${esc(w.id)}" data-pi="${i}" ${p.checked ? 'checked' : ''}><span>${esc(p.item)}</span></label>
      <button class="icon-btn tiny" data-action="remove-pack" data-id="${esc(w.id)}" data-pi="${i}" aria-label="Remove ${esc(p.item)}">✕</button>
    </li>`).join('');
  return `
    <div class="packing">
      <ul class="pack-items">${items || '<li class="muted">No items yet</li>'}</ul>
      <form class="pack-add" data-action="pack-add" data-id="${esc(w.id)}">
        <input type="text" placeholder="Add item…" aria-label="Add packing item">
        <button type="submit" class="btn tiny">Add</button>
      </form>
    </div>`;
}

// ---- fuelling reminder ------------------------------------------------------

function fuellingChip(w) {
  const long = (w.durationMin >= 90) && ['run', 'bike', 'brick'].includes(w.type);
  if (!long) return '';
  return `<div class="fuel-chip" title="Fuelling reminder">⛽ Practice 60–90 g carbs/h</div>`;
}

// ---- actual vs planned (from Strava or manual logging) ----------------------

function avp(label, actual, planned) {
  return `<div class="avp">${esc(label)}: <b>${esc(actual)}</b>${planned ? ` <span class="muted">/ ${esc(planned)} plan</span>` : ''}</div>`;
}

function actualsBlock(w, units) {
  const a = w.actual;
  if (!a) return '';
  const planKm = w.metrics?.distanceKm;
  const cells = [];
  if (a.distanceKm != null) cells.push(avp('Distance', fmtKm(a.distanceKm, units), planKm ? fmtKm(planKm, units) : null));
  if (a.durationMin != null) cells.push(avp('Time', formatDuration(a.durationMin), w.durationMin ? formatDuration(w.durationMin) : null));
  if (a.avgHr) cells.push(avp('Avg HR', `${Math.round(a.avgHr)} bpm`));
  if (a.avgWatts) cells.push(avp('Avg power', `${Math.round(a.avgWatts)} W`));
  if (a.avgCadence) cells.push(avp('Cadence', `${Math.round(a.avgCadence)}`));
  if (a.elevationGainM) cells.push(avp('Elevation', `${Math.round(a.elevationGainM)} m`));
  if (a.calories) cells.push(avp('Calories', `${Math.round(a.calories)}`));
  if (a.rpe) cells.push(avp('RPE', `${a.rpe}`));
  const link = a.stravaLink
    ? `<a class="strava-link" href="${esc(a.stravaLink)}" target="_blank" rel="noopener noreferrer">View on Strava ↗</a>` : '';
  return `<div class="block">
    <h4>Actual ${a.stravaId ? '· <span class="powered-by-strava">Powered by Strava</span>' : ''}</h4>
    <div class="actual-vs-planned">${cells.join('')}</div>${link}</div>`;
}

// Manual result logging (used when a session isn't Strava-linked).
function actualEntry(w) {
  const a = w.actual || {};
  const field = (label, key, mode) =>
    `<label>${label}<input inputmode="${mode}" value="${esc(a[key] ?? '')}" placeholder="–"
       data-action="actual-field" data-id="${esc(w.id)}" data-field="${key}"></label>`;
  return `<div class="block"><h4>Log actual result</h4>
    <div class="ex-log actual-entry">
      ${field('km', 'distanceKm', 'decimal')}
      ${field('min', 'durationMin', 'numeric')}
      ${field('avg HR', 'avgHr', 'numeric')}
      ${field('RPE', 'rpe', 'decimal')}
    </div></div>`;
}

// ---- session card -----------------------------------------------------------

export function sessionCard(w, units, { compact = false, isNext = false } = {}) {
  const d = DISCIPLINES[w.type] || DISCIPLINES.other;
  const tags = [];
  if (isNext) tags.push('<span class="tag next">NEXT</span>');
  if (w.isRace) tags.push('<span class="tag race">RACE</span>');
  if (w.deload) tags.push(`<span class="tag deload">${/taper/i.test(w.title) ? 'taper' : 'deload'}</span>`);
  if (w.optional) tags.push('<span class="tag optional">optional</span>');
  if (w.strava_activity_id) tags.push('<span class="tag strava">Strava</span>');

  const pace = paceHint(w.type, w.intensity);
  const meta = [
    `<span class="chip type-${w.type}">${d.icon} ${d.label}</span>`,
    `<span class="chip">${formatDuration(w.durationMin)}</span>`,
    w.metrics?.distanceKm ? `<span class="chip">${fmtKm(w.metrics.distanceKm, units)}</span>` : '',
    `<span class="chip intensity-${w.intensity}">${INTENSITIES[w.intensity] || w.intensity}</span>`,
    pace ? `<span class="chip pace" title="Planned pace / zone">🎯 ${esc(pace)}</span>` : '',
  ].filter(Boolean).join('');

  const head = `
    <div class="card-head">
      <button class="check ${w.completed ? 'on' : ''}" data-action="toggle-complete" data-id="${esc(w.id)}"
              aria-pressed="${w.completed}" aria-label="${w.completed ? 'Mark incomplete' : 'Mark complete'}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>
      </button>
      <div class="card-title">
        <h3>${esc(w.title)}</h3>
        <div class="meta">${meta}${tags.join('')}</div>
      </div>
    </div>`;

  if (compact) {
    return `<article class="card type-${w.type} ${w.completed ? 'completed' : ''} ${isNext ? 'is-next' : ''}" data-card="${esc(w.id)}" data-swipe="${esc(w.id)}">
      ${head}
      <div class="card-foot">
        <button class="btn tiny ghost" data-action="edit" data-id="${esc(w.id)}">Edit</button>
      </div>
    </article>`;
  }

  const segs = segmentBar(w.segments);
  const exercises = (w.exercises || []).length
    ? `<div class="block"><h4>Exercises</h4>${w.exercises.map((e, i) => exerciseRow(w, e, i)).join('')}</div>`
    : '';
  const notes = `
    <div class="block">
      <h4>Notes &amp; plan</h4>
      <textarea class="notes" data-action="notes" data-id="${esc(w.id)}" rows="2" placeholder="Targets, paces, how you felt, reminders…">${esc(w.notes)}</textarea>
    </div>`;
  const packing = `<div class="block"><h4>Packing</h4>${packingList(w)}</div>`;

  const actuals = w.strava_activity_id ? actualsBlock(w, units) : actualEntry(w);

  return `
    <article class="card type-${w.type} ${w.completed ? 'completed' : ''} ${isNext ? 'is-next' : ''}" data-card="${esc(w.id)}" data-swipe="${esc(w.id)}">
      ${head}
      ${fuellingChip(w)}
      ${segs ? `<div class="block">${segs}</div>` : ''}
      ${exercises}
      ${actuals}
      ${notes}
      ${packing}
      <div class="card-foot">
        <button class="btn tiny ghost" data-action="edit" data-id="${esc(w.id)}">✏️ Edit</button>
        <button class="btn tiny ghost" data-action="duplicate" data-id="${esc(w.id)}">⧉ Duplicate</button>
        <button class="btn tiny ghost danger" data-action="delete" data-id="${esc(w.id)}">🗑 Delete</button>
      </div>
    </article>`;
}

// ---- TODAY ------------------------------------------------------------------

export function renderToday(ctx) {
  const { today, workouts, units } = ctx;
  const sessions = workouts.filter((w) => w.date === today).sort(sortSessions);
  const phase = sessions[0]?.phase;
  const left = sessions.filter((w) => !w.completed).length;
  const firstIncomplete = sessions.find((w) => !w.completed);

  const leftCue = sessions.length
    ? (left ? `<span class="left-cue">${left} session${left === 1 ? '' : 's'} left</span>`
            : '<span class="left-cue done">all done 🎉</span>')
    : '';

  const header = `
    <div class="day-header">
      <div><h2>Today</h2><p class="sub">${weekdayName(today)} · ${shortLabel(today)}${phase ? ` · <span class="phase-pill">${esc(phase)}</span>` : ''}</p></div>
      ${leftCue}
    </div>`;

  let body;
  if (sessions.length) {
    body = sessions.map((w) => sessionCard(w, units, { isNext: w === firstIncomplete })).join('');
  } else {
    const next = nextSession(workouts, today);
    body = `<div class="empty card">
      <p class="big">🌙 No planned session today — rest &amp; recover.</p>
      ${next ? `<p class="muted">Next up: <b>${esc(next.title)}</b> on ${shortLabel(next.date)}.</p>` : ''}
      <button class="btn" data-action="open-editor-new" data-date="${esc(today)}">+ Add a session for today</button>
    </div>`;
  }

  return header + runWarningBanner(workouts, today) + raceChecklist(workouts, today) + body + packForTomorrow(ctx);
}

// Run-volume guardrail (>10% week-over-week) — the user has a run-injury history.
function runWarningBanner(workouts, today) {
  const r = runVolumeJump(workouts, today);
  if (!r.warn) return '';
  return `<div class="warn-banner">⚠️ Run volume is up <b>${r.pctChange}%</b> on last week (${r.lastKm}→${r.thisKm} km). Keep weekly run jumps under ~10% to protect against injury.</div>`;
}

// Race-day checklist surfaces when a race is within 10 days.
function raceChecklist(workouts, today) {
  const race = RACES.find((r) => { const d = diffDays(r.date, today); return d >= 0 && d <= 10; });
  if (!race) return '';
  const session = workouts.find((w) => w.date === race.date && w.isRace);
  if (!session) return '';
  const items = (session.packing || []).map((p, i) =>
    `<li class="${p.checked ? 'checked' : ''}"><label><input type="checkbox" data-action="toggle-pack" data-id="${esc(session.id)}" data-pi="${i}" ${p.checked ? 'checked' : ''}><span>${esc(p.item)}</span></label></li>`).join('');
  const days = diffDays(race.date, today);
  return `<section class="card accent race-checklist">
    <h3>${race.emoji} Race-day checklist — ${esc(race.title)} <span class="muted">in ${days} day${days === 1 ? '' : 's'}</span></h3>
    <ul class="pack-items big-pack">${items}</ul></section>`;
}

function packForTomorrow(ctx) {
  const { today, workouts } = ctx;
  const tomorrow = addDays(today, 1);
  const tmrSessions = workouts.filter((w) => w.date === tomorrow);
  // Aggregate unique packing items across tomorrow's sessions.
  const map = new Map(); // item -> {refs:[{id,idx}], allChecked}
  for (const w of tmrSessions) {
    (w.packing || []).forEach((p, idx) => {
      if (!map.has(p.item)) map.set(p.item, { refs: [], checked: true });
      const rec = map.get(p.item);
      rec.refs.push({ id: w.id, idx });
      if (!p.checked) rec.checked = false;
    });
  }
  const titles = tmrSessions.map((w) => w.title).join(' + ');
  const items = [...map.entries()].map(([item, rec]) => `
    <li class="${rec.checked ? 'checked' : ''}">
      <label><input type="checkbox" data-action="toggle-tomorrow-pack" data-item="${esc(item)}" ${rec.checked ? 'checked' : ''}><span>${esc(item)}</span></label>
    </li>`).join('');

  return `
    <section class="pack-tomorrow card accent">
      <h3>🎒 Pack for tomorrow</h3>
      ${tmrSessions.length
        ? `<p class="sub">${esc(titles)} · ${shortLabel(tomorrow)}</p>
           <ul class="pack-items big-pack">${items || '<li class="muted">Tomorrow’s sessions have no packing items.</li>'}</ul>
           <form class="pack-add" data-action="tomorrow-pack-add" data-date="${esc(tomorrow)}">
             <input type="text" placeholder="Add to tomorrow’s bag…" aria-label="Add packing item for tomorrow">
             <button type="submit" class="btn tiny">Add</button>
           </form>`
        : `<p class="muted">Nothing planned tomorrow — enjoy the rest day.</p>`}
    </section>`;
}

// ---- WEEK -------------------------------------------------------------------

export function renderWeek(ctx, weekStartIso) {
  const { workouts, units, today } = ctx;
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartIso, i));
  const weekEnd = days[6];
  const sample = workouts.find((w) => w.date >= weekStartIso && w.date <= weekEnd);
  const phase = sample?.phase;
  const deload = workouts.some((w) => w.date >= weekStartIso && w.date <= weekEnd && w.deload && !/taper/i.test(w.title));
  const taper = workouts.some((w) => w.date >= weekStartIso && w.date <= weekEnd && /taper/i.test(w.title));
  const raceThisWeek = RACES.find((r) => r.date >= weekStartIso && r.date <= weekEnd);

  const flags = [
    phase ? `<span class="phase-pill">${esc(phase)}</span>` : '',
    deload ? '<span class="tag deload">deload week</span>' : '',
    taper ? '<span class="tag deload">taper week</span>' : '',
    raceThisWeek ? `<span class="tag race">${raceThisWeek.emoji} race week</span>` : '',
  ].filter(Boolean).join(' ');

  const nav = `
    <div class="week-nav">
      <button class="btn icon" data-action="prev-week" aria-label="Previous week">‹</button>
      <div class="week-range"><b>${shortLabel(weekStartIso)} – ${shortLabel(weekEnd)}</b><div class="flags">${flags}</div></div>
      <button class="btn icon" data-action="next-week" aria-label="Next week">›</button>
    </div>`;

  const dayBlocks = days.map((iso) => {
    const sessions = workouts.filter((w) => w.date === iso).sort(sortSessions);
    const isToday = iso === today;
    const cards = sessions.length
      ? sessions.map((w) => sessionCard(w, units, { compact: true })).join('')
      : `<div class="rest-day">Rest day · <button class="link" data-action="open-editor-new" data-date="${esc(iso)}">+ add</button></div>`;
    return `
      <div class="week-day ${isToday ? 'is-today' : ''}">
        <div class="week-day-head"><b>${weekdayName(iso).slice(0, 3)}</b><span>${shortLabel(iso).replace(/^\w+ /, '')}</span>${isToday ? '<em>today</em>' : ''}</div>
        <div class="week-day-body">${cards}</div>
      </div>`;
  }).join('');

  return `<div class="day-header"><h2>Week</h2></div>${nav}${weekSummary(workouts, weekStartIso, weekEnd, sample?.phaseId)}<div class="week-grid">${dayBlocks}</div>`;
}

export function ring(pct, big, small, colorVar) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return `<div class="ring" style="--p:${p}; --rc:${colorVar}" role="img" aria-label="${esc(small)} ${p}%">
    <div class="ring-c"><b>${big}</b><small>${esc(small)}</small></div></div>`;
}

// Weekly target rings: completion, bike km vs the 200 km floor, hours vs phase target.
function weekSummary(workouts, weekStartIso, weekEnd, phaseId) {
  const inWeek = workouts.filter((w) => w.date >= weekStartIso && w.date <= weekEnd && !w.optional);
  const total = inWeek.length;
  if (!total) return '';
  const done = inWeek.filter((w) => w.completed).length;
  const bk = weekKm(workouts, weekStartIso, 'bike');
  const hrs = weekHours(workouts, weekStartIso);
  const tgt = PHASE_HOURS_TARGET[phaseId] || 11;
  return `<section class="card week-summary"><div class="rings">
    ${ring((done / total) * 100, `${done}/${total}`, 'sessions', 'var(--good)')}
    ${ring((bk / BIKE_WEEK_FLOOR) * 100, `${Math.round(bk)}`, `/ ${BIKE_WEEK_FLOOR} km bike`, 'var(--c-bike)')}
    ${ring((hrs / tgt) * 100, hrs.toFixed(1), `/ ${tgt} h`, 'var(--accent)')}
  </div></section>`;
}

// ---- PROGRESS ---------------------------------------------------------------

export function renderProgress(ctx) {
  const { workouts, stats, streaks, today, units, settings } = ctx;
  return [
    `<div class="day-header"><h2>Progress</h2></div>`,
    totalsStrip(stats, streaks, units),
    loadPanel(workouts, today),
    weeklyVolumeChart(workouts, today),
    disciplineBreakdown(stats),
    bodyMetricsPanel(settings, today),
    streakHeatmap(workouts, today, streaks),
    badgeWall(ctx.unlockedBadges),
    referenceCards(),
  ].join('');
}

// Training load + acute:chronic workload ratio (with the injury guardrail).
function loadPanel(workouts, today) {
  const a = acwr(workouts, today);
  const rv = runVolumeJump(workouts, today);
  const zoneLabel = { ok: 'in the sweet spot', high: 'elevated — watch fatigue',
    danger: 'spiking — back off', detraining: 'low — room to build', unknown: 'building baseline' }[a.zone];
  const rvLine = rv.pctChange == null ? 'No run last week to compare.'
    : `Run volume ${rv.pctChange >= 0 ? '+' : ''}${rv.pctChange}% vs last week (${rv.lastKm}→${rv.thisKm} km).`;
  return `<section class="card">
    <h3>Training load</h3>
    <div class="load-grid">
      <div class="load-cell"><small>Acute (7d)</small><b>${a.acute}</b></div>
      <div class="load-cell"><small>Chronic (weekly)</small><b>${a.chronicWeekly}</b></div>
      <div class="load-cell acwr-${a.zone}"><small>ACWR</small><b>${a.ratio || '—'}</b></div>
    </div>
    <p class="muted small">Acute:chronic ratio is <b>${zoneLabel}</b>. Aim for ~0.8–1.3. ${esc(rvLine)}</p>
  </section>`;
}

function bodyMetricsPanel(settings, today) {
  const log = (settings?.bodyMetrics || []).slice().sort((x, y) => x.date.localeCompare(y.date));
  const latest = log[log.length - 1] || {};
  const spark = (key, color) => {
    const pts = log.filter((e) => e[key] != null);
    if (pts.length < 2) return '';
    const vals = pts.map((e) => Number(e[key]));
    const min = Math.min(...vals); const max = Math.max(...vals); const span = max - min || 1;
    const d = pts.map((e, i) => `${(i / (pts.length - 1)) * 100},${30 - ((Number(e[key]) - min) / span) * 28}`).join(' ');
    return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points="${d}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
  };
  const row = (label, key, unit, color) =>
    `<div class="metric-row"><span>${label}</span>${spark(key, color)}<b>${latest[key] != null ? latest[key] + unit : '–'}</b></div>`;
  return `<section class="card">
    <h3>Body metrics</h3>
    <div class="metrics">
      ${row('Weight', 'weight', ' kg', 'var(--c-bike)')}
      ${row('Resting HR', 'rhr', ' bpm', 'var(--c-run)')}
      ${row('Sleep', 'sleep', ' h', 'var(--c-swim)')}
    </div>
    <form class="metric-log" data-action="log-metric" data-date="${esc(today)}">
      <input type="number" step="0.1" name="weight" placeholder="kg" aria-label="Weight kg">
      <input type="number" step="1" name="rhr" placeholder="RHR" aria-label="Resting HR">
      <input type="number" step="0.1" name="sleep" placeholder="sleep h" aria-label="Sleep hours">
      <button type="submit" class="btn tiny">Log today</button>
    </form>
  </section>`;
}

function weeklyVolumeChart(workouts, today) {
  // Last 8 ISO weeks (Monday-anchored) of completed minutes.
  const weeks = [];
  let monday = mondayOf(today);
  for (let i = 7; i >= 0; i--) weeks.push(addDays(monday, -7 * i));
  const data = weeks.map((wkStart) => {
    const wkEnd = addDays(wkStart, 6);
    const mins = workouts.filter((w) => w.completed && w.date >= wkStart && w.date <= wkEnd)
      .reduce((a, w) => a + (w.durationMin || 0), 0);
    return { wkStart, hours: mins / 60 };
  });
  const max = Math.max(1, ...data.map((d) => d.hours));
  const bars = data.map((d) => {
    const h = Math.round((d.hours / max) * 100);
    return `<div class="vbar"><div class="vbar-fill" style="height:${h}%" title="${d.hours.toFixed(1)} h"></div><span>${d.wkStart.slice(5).replace('-', '/')}</span></div>`;
  }).join('');
  return `<section class="card"><h3>Weekly volume (last 8 weeks)</h3><div class="vchart">${bars}</div><p class="muted small">Hours of completed training per week.</p></section>`;
}

function disciplineBreakdown(stats) {
  const order = ['run', 'bike', 'swim', 'gym', 'brick', 'mobility', 'other'];
  const entries = order
    .map((t) => ({ t, min: stats.minutesByType[t] || 0 }))
    .filter((e) => e.min > 0);
  const total = entries.reduce((a, e) => a + e.min, 0) || 1;
  const rows = entries.map((e) => {
    const d = DISCIPLINES[e.t];
    const pct = Math.round((e.min / total) * 100);
    return `<div class="disc-row"><span class="disc-label">${d.icon} ${d.label}</span>
      <div class="disc-bar"><div class="disc-fill type-${e.t}" style="width:${pct}%"></div></div>
      <span class="disc-val">${(e.min / 60).toFixed(1)} h</span></div>`;
  }).join('');
  return `<section class="card"><h3>Discipline breakdown</h3>${rows || '<p class="muted">Complete sessions to see your split.</p>'}</section>`;
}

function streakHeatmap(workouts, today, streaks) {
  // 16-week calendar grid ending this week.
  const start = addDays(mondayOf(today), -7 * 15);
  const done = streaks.activeDates;
  let cells = '';
  for (let i = 0; i < 7; i++) {
    for (let wk = 0; wk < 16; wk++) {
      const iso = addDays(addDays(start, wk * 7), i);
      const isFuture = diffDays(iso, today) > 0;
      const lvl = done.has(iso) ? 'on' : (isFuture ? 'future' : 'off');
      cells += `<i class="heat ${lvl}" title="${shortLabel(iso)}${done.has(iso) ? ' · done' : ''}"></i>`;
    }
  }
  return `<section class="card"><h3>Consistency</h3>
    <p class="muted small">Current ${streaks.current} · longest ${streaks.longest} days</p>
    <div class="heatmap" style="grid-template-columns:repeat(16,1fr)">${cells}</div></section>`;
}

export function badgeWall(unlocked) {
  const set = new Set(unlocked);
  const tiles = BADGES.map((b) => {
    const on = set.has(b.id);
    return `<div class="badge ${on ? 'unlocked' : 'locked'}" title="${esc(b.desc)}">
      <div class="badge-ico">${on ? b.icon : '🔒'}</div>
      <div class="badge-name">${esc(b.name)}</div>
      <div class="badge-desc">${esc(b.desc)}</div></div>`;
  }).join('');
  return `<section class="card"><h3>Badges <span class="muted">(${unlocked.length}/${BADGES.length})</span></h3>
    <div class="badge-wall">${tiles}</div></section>`;
}

function referenceCards() {
  const paces = PACE_REFERENCE.map((p) =>
    `<li><span class="dot seg-${p.kind}"></span><b>${esc(p.label)}</b><span>${esc(p.value)}</span></li>`).join('');
  const principles = PLAN_PRINCIPLES.map((p) => `<li>${esc(p)}</li>`).join('');
  return `
    <section class="card"><h3>Pace &amp; zone reference</h3><ul class="ref-list">${paces}</ul></section>
    <section class="card"><h3>Plan principles</h3><ul class="principles">${principles}</ul></section>`;
}

// ---- lifetime totals (proper) ----------------------------------------------

export function totalsStrip(stats, streaks, units) {
  const totalKm = Object.values(stats.kmByType).reduce((a, b) => a + b, 0);
  const cells = [
    ['⭐ Level', stats.level],
    ['✨ Total XP', stats.totalXp.toLocaleString()],
    ['✅ Sessions', stats.completedCount],
    ['⏱️ Hours', stats.totalHours.toFixed(1)],
    ['📏 Distance', fmtKm(totalKm, units) || '0 km'],
    ['🔥 Best streak', `${streaks.longest} d`],
  ].map(([k, v]) => `<div class="total"><small>${k}</small><b>${v}</b></div>`).join('');
  return `<section class="card totals"><div class="total-grid">${cells}</div></section>`;
}

// ---- helpers ----------------------------------------------------------------

export function sortSessions(a, b) {
  const order = { gym: 0, swim: 1, run: 2, bike: 3, brick: 1, mobility: 4, other: 5 };
  return (order[a.type] ?? 9) - (order[b.type] ?? 9);
}

export function mondayOf(iso) {
  const dow = (parseISO(iso).getDay() + 6) % 7;
  return addDays(iso, -dow);
}

function nextSession(workouts, today) {
  return workouts.filter((w) => w.date > today).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

export function raceBanner(today) {
  const upcoming = RACES.filter((r) => diffDays(r.date, today) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!upcoming) return '';
  const days = diffDays(upcoming.date, today);
  return `<div class="race-banner">${upcoming.emoji} <b>${esc(upcoming.title)}</b> in <b>${days}</b> day${days === 1 ? '' : 's'} <span class="muted">· ${shortLabel(upcoming.date)}</span></div>`;
}
