// ui.js — pure-ish HTML rendering. Functions return HTML strings that main.js
// injects; all interactivity is wired via delegated data-action attributes.

import { formatDuration, sportProgress } from '../core/scoring.js';
import { poseSvgFor, cuesFor } from '../core/poses.js';
import { BADGES } from '../core/badges.js';
import { PLAN_PRINCIPLES, PACE_REFERENCE, RACES } from '../core/plan.js';
import { shortLabel, weekdayName, addDays, diffDays, parseISO } from '../core/dates.js';
import { weekKm, weekHours, acwr, runVolumeJump } from '../core/load.js';
import { DISCIPLINES, INTENSITIES, paceHint } from '../core/disciplines.js';
import { svg } from '../core/icons.js';

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
      <div class="stat" title="Current streak (longest ${streaks.longest})"><span class="stat-ico">${svg('flame')}</span><b>${streaks.current}</b><small>day streak</small></div>
      <div class="stat" title="Total training time"><span class="stat-ico">${svg('clock')}</span><b>${stats.totalHours.toFixed(1)}</b><small>hours</small></div>
      <div class="stat" title="Total distance"><span class="stat-ico">${svg('route')}</span><b>${Math.round(totalKm)}</b><small>${units === 'imperial' ? 'mi*' : 'km'}</small></div>
      <div class="stat" title="Sessions completed"><span class="stat-ico">${svg('check')}</span><b>${stats.completedCount}</b><small>done</small></div>
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
  return `<div class="fuel-chip" title="Fuelling reminder">${svg('flame')} Practice 60–90 g carbs/h</div>`;
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

// Neon intensity-zone badge (hr_zone 1-5).
export function zoneBadge(z) {
  const n = Math.max(1, Math.min(5, parseInt(z) || 1));
  return `<span class="zone zone-${n}" title="Heart-rate zone ${n}">Z${n}</span>`;
}

// Parse "[Warmup] … [Main Set] … [Cooldown] …" notes into labelled blocks.
// Any comma / slash / semicolon-separated movement list is exploded into one
// pill per line so gym sets read as a clean vertical index, not a run-on row.
function structuredBlocks(w) {
  const n = w.notes || '';
  if (!/\[[^\]]+\]/.test(n)) return '';
  const segs = [...n.matchAll(/\[([^\]]+)\]\s*([^[]*)/g)].map((m) => ({ label: m[1].trim(), text: m[2].trim() })).filter((s) => s.text);
  if (!segs.length) return '';
  return `<div class="block"><h4>Session</h4><div class="struct">${segs.map((s) => {
    const moves = s.text.split(/\s*[,;]\s*|\s+\/\s+/).map((t) => t.trim()).filter(Boolean);
    const body = moves.length > 1
      ? `<ul class="move-list">${moves.map((m) => `<li class="move-pill mono">${esc(m)}</li>`).join('')}</ul>`
      : `<span class="struct-text mono">${esc(s.text)}</span>`;
    return `<div class="struct-row"><span class="struct-label">${esc(s.label)}</span>${body}</div>`;
  }).join('')}</div></div>`;
}

// ---- 3D isometric sport-level card -----------------------------------------

const ART_BASE = 'icons/Pixelart';
// Map each discipline to its REAL asset filenames (they are not uniform) and the
// highest level that has finished (non-placeholder) art, so we never 404 or show
// a temp graphic. Swim + everything else degrade gracefully (no card).
const SPORT_ART = {
  bike: { dir: 'BIKE', max: 10, file: (n) => `BIKELVL${n}.png` },
  gym: { dir: 'GYM', max: 9, file: (n) => `GYM_LVL${n}.png` },
  run: { dir: 'RUN', max: 5, file: (n) => (n <= 1 ? 'RUNGENERAL_LVL1.png' : `RUNLVL${n}.png`) },
};

export function sportArtSrc(type, level) {
  const cfg = SPORT_ART[type];
  if (!cfg) return null;
  const n = Math.max(1, Math.min(cfg.max, parseInt(level) || 1));
  return `${ART_BASE}/${cfg.dir}/${cfg.file(n)}`;
}

// Full 1→10 frame list per sport using the REAL (non-uniform) filenames; levels
// past the finished art fall back to the placeholder `templvl*.png` frames so the
// carousel always shows ten locked future scenes.
const SPORT_FRAMES = {
  bike: Array.from({ length: 10 }, (_, i) => `BIKELVL${i + 1}.png`),
  gym: [...Array.from({ length: 9 }, (_, i) => `GYM_LVL${i + 1}.png`), 'templvl10.png'],
  run: ['RUNGENERAL_LVL1.png', 'RUNLVL2.png', 'RUNLVL3.png', 'RUNLVL4.png', 'RUNLVL5.png',
    'templvl6.png', 'templvl7.png', 'templvl8.png', 'templvl9.png', 'templvl10.png'],
};
function sportFrames(type) {
  const cfg = SPORT_ART[type]; const list = SPORT_FRAMES[type];
  if (!cfg || !list) return [];
  return list.map((f, i) => ({ level: i + 1, src: `${ART_BASE}/${cfg.dir}/${f}` }));
}

// Horizontally-swipeable level carousel (modal body). Current level centred +
// themed border, past levels scaled down (left), future levels dimmed + locked.
export function sportLevelCarousel(type, level) {
  const frames = sportFrames(type);
  if (!frames.length) return '<p class="muted">No levels for this sport yet.</p>';
  const d = DISCIPLINES[type] || DISCIPLINES.other;
  const items = frames.map((f) => {
    const state = f.level === level ? 'current' : (f.level < level ? 'past' : 'future');
    const lock = state === 'future' ? `<span class="lvl-lock">${svg('lock')}</span>` : '';
    // The focused (current) level becomes a tap target that opens the fullscreen lightbox.
    const zoom = state === 'current'
      ? `data-action="open-lightbox" data-src="${esc(f.src)}" data-sport="${esc(type)}" role="button" tabindex="0" aria-label="Zoom level ${f.level}"`
      : '';
    return `<div class="lvl-frame --${esc(type)} is-${state}" data-level="${f.level}">
      <div class="lvl-frame-art" ${zoom}><img src="${esc(f.src)}" alt="${esc(type)} level ${f.level}" loading="lazy" onerror="this.style.visibility='hidden'">${lock}</div>
      <span class="lvl-frame-tag">LVL ${f.level}</span>
    </div>`;
  }).join('');
  return `<div class="lvl-carousel-head"><b>${svg(type, 'tint')} ${esc(d.label)}</b><span class="lvl-tag">Current: LVL ${level}</span></div>
    <div class="lvl-carousel" data-current="${level}">${items}</div>
    <p class="muted small">Complete more ${esc(d.label.toLowerCase())} sessions to unlock the next scene.</p>`;
}

// Profile dashboard: one tappable row per sport the athlete has earned XP in.
function sportLeveling(ctx) {
  const rows = ['run', 'bike', 'gym'].map((t) => {
    const p = sportProgress(ctx.workouts, t);
    if (!(p.totalXp > 0)) return '';               // only show sports with XP
    const pct = Math.round(p.progress * 100);
    const d = DISCIPLINES[t];
    return `<button class="lvl-row" data-action="open-sport-levels" data-sport="${t}">
      <span class="lvl-thumb --${t}"><img src="${esc(sportArtSrc(t, p.level))}" alt="" loading="lazy" onerror="this.style.opacity=0"></span>
      <span class="lvl-row-body">
        <span class="lvl-row-head"><b>${svg(t, 'tint')} ${esc(d.label)}</b><span class="lvl-tag">LVL ${p.level}</span></span>
        <span class="lvl-track"><span class="lvl-fill --${t}" style="width:${pct}%"></span></span>
        <small class="lvl-foot">${p.toNext} XP to LVL ${p.level + 1}</small>
      </span>
    </button>`;
  }).filter(Boolean).join('');
  if (!rows) return '';
  return `<section class="card lvl-section"><h3>Sport levels</h3><div class="lvl-rows">${rows}</div></section>`;
}

const KCAL = { run: 11, bike: 9, swim: 9, gym: 6, brick: 10, mobility: 4, other: 8 };
const kcalEst = (w) => Math.round(w.actual?.calories || (w.durationMin || 0) * (KCAL[w.type] || 8));

// CSS power-interval chart (Zwift-style). Prefers the structured `power` array
// ([{min,watts}]); falls back to regex-parsing watts from notes for legacy plans.
// Bar height = watts / scale; bar width = block minutes / total.
function powerChart(w, ftp) {
  if (w.type !== 'bike') return '';
  const blocks = Array.isArray(w.power) && w.power.length
    ? w.power.map((b) => ({ min: Math.max(1, Number(b.min) || 1), watts: Number(b.watts) || 0 }))
    : [...(w.notes || '').matchAll(/(\d{2,4})\s*w\b/gi)].map((m) => ({ min: 1, watts: +m[1] }));
  const segs = blocks.filter((b) => b.watts >= 50 && b.watts <= 2000);
  if (!segs.length) return '';
  const max = Math.max(ftp * 1.4, ...segs.map((s) => s.watts));
  const totalMin = segs.reduce((a, s) => a + s.min, 0) || segs.length;
  const bars = segs.map((s) => {
    const z = s.watts / ftp; const c = z < 0.76 ? '1' : z < 0.9 ? '3' : z < 1.05 ? '4' : '5';
    return `<div class="pwr-bar zcol-${c}" style="height:${Math.round((s.watts / max) * 100)}%; flex:${(s.min / totalMin).toFixed(3)}" title="${s.min} min @ ${s.watts} W (${Math.round(z * 100)}% FTP)"><span>${s.watts}</span></div>`;
  }).join('');
  return `<div class="block"><h4>Power</h4><div class="pwr">${bars}</div><div class="pwr-ftp">FTP ${ftp} W · scaled to your profile</div></div>`;
}

// Read-only packing checklist driven by the per-sport preset configured in Settings.
function packingChecklist(w, settings) {
  const preset = settings?.packing?.[w.type] || [];
  if (!preset.length) return '';
  const packed = new Set(w.packed || []);
  return `<div class="block"><h4>Packing</h4><ul class="pack-items">${preset.map((item) => `
    <li class="${packed.has(item) ? 'checked' : ''}"><label><input type="checkbox" data-action="toggle-preset-pack" data-id="${esc(w.id)}" data-item="${esc(item)}" ${packed.has(item) ? 'checked' : ''}><span>${esc(item)}</span></label></li>`).join('')}</ul></div>`;
}

function metaChips(w, units) {
  const d = DISCIPLINES[w.type] || DISCIPLINES.other;
  const pace = paceHint(w.type, w.intensity);
  const tags = [];
  if (w.isRace) tags.push('<span class="tag race">RACE</span>');
  if (w.deload) tags.push(`<span class="tag deload">${/taper/i.test(w.title) ? 'taper' : 'deload'}</span>`);
  if (w.strava_activity_id) tags.push('<span class="tag strava">Strava</span>');
  return [
    `<span class="chip type-${w.type}">${svg(w.type, 'tint')} ${d.label}</span>`,
    w.hr_zone ? zoneBadge(w.hr_zone) : '',
    `<span class="chip mono">${formatDuration(w.durationMin)}</span>`,
    w.metrics?.distanceKm ? `<span class="chip mono">${fmtKm(w.metrics.distanceKm, units)}</span>` : '',
    `<span class="chip intensity-${w.intensity}">${INTENSITIES[w.intensity] || w.intensity}</span>`,
    pace ? `<span class="chip pace">${esc(pace)}</span>` : '',
  ].filter(Boolean).join('') + tags.join('');
}

// ---- compact bento card (Home/Week list) ------------------------------------

export function sessionCard(w, units, { isNext = false } = {}) {
  const km = w.metrics?.distanceKm;
  return `<article class="card bento type-${w.type} ${w.completed ? 'completed' : ''} ${isNext ? 'is-next' : ''}" data-action="open-workout" data-id="${esc(w.id)}">
    <div class="bento-top">
      <span class="status-dot ${w.completed ? 'on' : ''}" title="${w.completed ? 'Completed' : 'Planned'}"></span>
      <h3>${esc(w.title)}</h3>
      ${isNext ? '<span class="tag next">NEXT</span>' : ''}${w.hr_zone ? zoneBadge(w.hr_zone) : ''}
    </div>
    <div class="bento-metrics">
      <div class="bm"><span class="bm-ico">${svg('clock')}</span><b>${w.durationMin || 0}</b><small>min</small></div>
      ${km ? `<div class="bm"><span class="bm-ico">${svg('route')}</span><b>${km % 1 ? km.toFixed(1) : km}</b><small>${units === 'imperial' ? 'mi' : 'km'}</small></div>` : ''}
      <div class="bm"><span class="bm-ico">${svg('flame')}</span><b>${kcalEst(w)}</b><small>kcal</small></div>
    </div>
  </article>`;
}

// ---- expanded detail (modal) ------------------------------------------------

export function renderWorkoutDetail(w, units, ctx) {
  const ftp = ctx?.settings?.ftp || 250;
  const detail = w.type === 'bike' ? (powerChart(w, ftp) || structuredBlocks(w)) : structuredBlocks(w);
  const segs = segmentBar(w.segments);
  const exercises = (w.exercises || []).length
    ? `<div class="block"><h4>Exercises</h4>${w.exercises.map((e, i) => exerciseRow(w, e, i)).join('')}</div>` : '';
  const actuals = w.strava_activity_id ? actualsBlock(w, units) : actualEntry(w);
  return `
    <div class="meta">${metaChips(w, units)}</div>
    ${fuellingChip(w)}
    ${detail}
    ${segs ? `<div class="block">${segs}</div>` : ''}
    ${exercises}
    ${actuals}
    ${packingChecklist(w, ctx?.settings)}
    <div class="card-foot">
      <button class="btn tiny ghost" data-action="edit" data-id="${esc(w.id)}">${svg('edit')} Edit</button>
      <button class="btn tiny ghost" data-action="duplicate" data-id="${esc(w.id)}">Duplicate</button>
      <button class="btn tiny ghost danger" data-action="delete" data-id="${esc(w.id)}">${svg('trash')} Delete</button>
    </div>`;
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
            : `<span class="left-cue done">${svg('check')} all done</span>`)
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
      <p class="big">${svg('moon')} No planned session today — rest &amp; recover.</p>
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
  return `<div class="warn-banner">${svg('warn')} Run volume is up <b>${r.pctChange}%</b> on last week (${r.lastKm}→${r.thisKm} km). Keep weekly run jumps under ~10% to protect against injury.</div>`;
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
    <h3>${svg('flag')} Race-day checklist — ${esc(race.title)} <span class="muted">in ${days} day${days === 1 ? '' : 's'}</span></h3>
    <ul class="pack-items big-pack">${items}</ul></section>`;
}

function packForTomorrow(ctx) {
  const { today, workouts, settings } = ctx;
  const tomorrow = addDays(today, 1);
  const tmrSessions = workouts.filter((w) => w.date === tomorrow);
  const types = [...new Set(tmrSessions.map((w) => w.type))];
  const items = [...new Set(types.flatMap((t) => settings?.packing?.[t] || []))];
  const packed = new Set(tmrSessions.flatMap((w) => w.packed || []));
  const titles = tmrSessions.map((w) => w.title).join(' + ');
  return `
    <section class="pack-tomorrow card accent">
      <h3>${svg('bag')} Pack for tomorrow</h3>
      ${tmrSessions.length && items.length
        ? `<p class="sub">${esc(titles)} · ${shortLabel(tomorrow)}</p>
           <ul class="pack-items big-pack">${items.map((item) => `
             <li class="${packed.has(item) ? 'checked' : ''}"><label><input type="checkbox" data-action="toggle-tomorrow-pack" data-date="${esc(tomorrow)}" data-item="${esc(item)}" ${packed.has(item) ? 'checked' : ''}><span>${esc(item)}</span></label></li>`).join('')}</ul>`
        : `<p class="muted">${tmrSessions.length ? 'No packing presets for tomorrow’s sports — set them in Settings.' : 'Nothing planned tomorrow — enjoy the rest day.'}</p>`}
    </section>`;
}

// ---- HOME (today details + remaining week) ----------------------------------

export function eventBanner(ctx) {
  const evs = (ctx.settings?.events || []).filter((e) => e.date && e.date >= ctx.today)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!evs.length) return '';
  return `<div class="race-banner">${svg('flag')} NEXT EVENT: <b>${esc(evs[0].title)}</b> — ${shortLabel(evs[0].date)}</div>`;
}

function planCta(ctx) {
  const hasPlan = ctx.workouts.some((w) => w.source === 'custom' && w.date >= ctx.today);
  return hasPlan
    ? `<div class="plan-actions">
         <button class="btn ai-cta" data-action="ai-wizard">${svg('regen')} Regenerate plan</button>
         <button class="btn ghost danger" data-action="clear-future">${svg('trash')} Clear future workouts</button>
       </div>`
    : `<button class="btn primary block ai-cta" data-action="ai-wizard">${svg('spark')} Create custom workout plan</button>`;
}

export function renderHome(ctx, weekStart) {
  const ws = weekStart || mondayOf(ctx.today);
  // Order: goal rings → today's details → Mon-onward week grid.
  return planCta(ctx)
    + goalRings(ctx, ws)
    + renderToday(ctx)
    + `<div class="day-header"><h2>This week</h2></div>`
    + renderWeek(ctx, ws);
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

  return `${nav}<div class="week-grid">${dayBlocks}</div>`;
}

export function ring(pct, big, small, colorVar) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return `<div class="ring" style="--p:${p}; --rc:${colorVar}" role="img" aria-label="${esc(small)} ${p}%">
    <div class="ring-c"><b>${big}</b><small>${esc(small)}</small></div></div>`;
}

// Editable weekly goal rings: planned sessions, distance (km), training hours.
function goalRings(ctx, weekStartIso) {
  const { workouts } = ctx;
  const g = ctx.settings?.goals || { sessions: 5, km: 50, hours: 8 };
  const end = addDays(weekStartIso, 6);
  const inWeek = workouts.filter((w) => w.completed && w.date >= weekStartIso && w.date <= end);
  const sessions = inWeek.length;
  const km = inWeek.reduce((a, w) => a + (Number(w.metrics?.distanceKm) || 0), 0);
  const hrs = weekHours(workouts, weekStartIso);
  return `<section class="card week-summary">
    <div class="rings-head"><h3>This week’s goals</h3><button class="btn tiny ghost" data-action="edit-goals">${svg('edit')} Edit</button></div>
    <div class="rings">
      ${ring((sessions / g.sessions) * 100, `${sessions}/${g.sessions}`, 'sessions', 'var(--good)')}
      ${ring((km / g.km) * 100, `${Math.round(km)}`, `/ ${g.km} km`, 'var(--c-bike)')}
      ${ring((hrs / g.hours) * 100, hrs.toFixed(1), `/ ${g.hours} h`, 'var(--accent)')}
    </div></section>`;
}

// ---- PROGRESS ---------------------------------------------------------------

export function renderProgress(ctx) {
  const { workouts, stats, streaks, today, units, settings } = ctx;
  return [
    `<div class="day-header"><h2>Profile</h2></div>`,
    totalsStrip(stats, streaks, units),
    sportLeveling(ctx),
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
