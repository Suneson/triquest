// ui.js — pure-ish HTML rendering. Functions return HTML strings that main.js
// injects; all interactivity is wired via delegated data-action attributes.

import { formatDuration, sportProgress, earnsXp } from '../core/scoring.js';
import { BADGES } from '../core/badges.js';
import { PLAN_PRINCIPLES, PACE_REFERENCE, RACES } from '../core/plan.js';
import { shortLabel, weekdayName, addDays, diffDays, parseISO } from '../core/dates.js';
import { weekKm, weekHours, acwr, runVolumeJump } from '../core/load.js';
import { DISCIPLINES, INTENSITIES, paceHint } from '../core/disciplines.js';
import { svg } from '../core/icons.js';
import { renderLogger, hasLogger } from './gym-logger.js';
import { mainSetIsExercises } from '../core/gym-split.js';
import { rollNum } from './motion.js';
import { weekPathCard } from './game.js';
import { sceneFor, SCENES, COACH, cornerPolygon } from '../core/scenes.js';
import { sessionLine, dayLine, raceOn } from '../core/coach-lines.js';
import { formatCountdown, msUntilReset } from '../core/quests.js';
import { t, fmtDate, fmtNum, capFirst } from '../core/i18n.js';
import { planTitle, planNotes, planWord, planItem } from '../core/plan-i18n.js';

export { DISCIPLINES, INTENSITIES };

const PHASE_HOURS_TARGET = { base: 12, specific: 12, bridge: 9 };
const BIKE_WEEK_FLOOR = 200;

const SEG_INTENSITY = INTENSITIES;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function fmtKm(km, units = 'metric') {
  if (!km) return '';
  if (units === 'imperial') return `${fmtNum(km * 0.621371, { maximumFractionDigits: km < 10 ? 1 : 0, minimumFractionDigits: km < 10 ? 1 : 0 })} mi`;
  return `${fmtNum(km, { maximumFractionDigits: 1 })} km`;
}

// ---- segment visualizer -----------------------------------------------------

export function segmentBar(segments) {
  if (!segments || !segments.length) return '';
  const total = segments.reduce((a, s) => a + (Number(s.value) || 0), 0) || 1;
  const bars = segments.map((s) => {
    const w = ((Number(s.value) || 0) / total) * 100;
    return `<div class="seg seg-${esc(s.intensity)}" style="width:${w}%" title="${esc(planWord(s.label))} · ${esc(s.value)}′ · ${esc(SEG_INTENSITY[s.intensity] || s.intensity)}"></div>`;
  }).join('');
  const present = [...new Set(segments.map((s) => s.intensity))];
  const legend = present.map((i) =>
    `<span class="legend-item"><i class="dot seg-${esc(i)}"></i>${esc(SEG_INTENSITY[i] || i)}</span>`).join('');
  return `<div class="segments"><div class="seg-bar">${bars}</div><div class="legend">${legend}</div></div>`;
}

// ---- exercises --------------------------------------------------------------

// ---- packing ----------------------------------------------------------------

function packingList(w) {
  const items = (w.packing || []).map((p, i) => `
    <li class="${p.checked ? 'checked' : ''}">
      <label><input type="checkbox" data-action="toggle-pack" data-id="${esc(w.id)}" data-pi="${i}" ${p.checked ? 'checked' : ''}><span>${esc(planWord(p.item))}</span></label>
      <button class="icon-btn tiny" data-action="remove-pack" data-id="${esc(w.id)}" data-pi="${i}" aria-label="${esc(t('ui.packRemove', { item: planWord(p.item) }))}">${svg('close')}</button>
    </li>`).join('');
  return `
    <div class="packing">
      <ul class="pack-items">${items || `<li class="muted">${t('ui.packEmpty')}</li>`}</ul>
      <form class="pack-add" data-action="pack-add" data-id="${esc(w.id)}">
        <input type="text" placeholder="${t('ui.packAddPh')}" aria-label="${t('ui.packAddAria')}">
        <button type="submit" class="btn tiny">${t('ui.add')}</button>
      </form>
    </div>`;
}

// ---- fuelling reminder ------------------------------------------------------

function fuellingChip(w) {
  const long = (w.durationMin >= 90) && ['run', 'bike', 'brick'].includes(w.type);
  if (!long) return '';
  return `<div class="fuel-chip" title="${t('ui.fuelTitle')}">${svg('flame')} ${t('ui.fuelText')}</div>`;
}

// ---- actual vs planned (from Strava or manual logging) ----------------------

function avp(label, actual, planned) {
  return `<div class="avp">${esc(label)}: <b>${esc(actual)}</b>${planned ? ` <span class="muted">${esc(t('ui.vsPlan', { planned }))}</span>` : ''}</div>`;
}

function actualsBlock(w, units) {
  const a = w.actual;
  if (!a) return '';
  const planKm = w.metrics?.distanceKm;
  const cells = [];
  if (a.distanceKm != null) cells.push(avp(t('ui.actual.distance'), fmtKm(a.distanceKm, units), planKm ? fmtKm(planKm, units) : null));
  if (a.durationMin != null) cells.push(avp(t('ui.actual.time'), formatDuration(a.durationMin), w.durationMin ? formatDuration(w.durationMin) : null));
  if (a.avgHr) cells.push(avp(t('ui.actual.avgHr'), `${Math.round(a.avgHr)} bpm`));
  if (a.avgWatts) cells.push(avp(t('ui.actual.avgPower'), `${Math.round(a.avgWatts)} W`));
  if (a.avgCadence) cells.push(avp(t('ui.actual.cadence'), `${Math.round(a.avgCadence)}`));
  if (a.elevationGainM) cells.push(avp(t('ui.actual.elevation'), `${Math.round(a.elevationGainM)} m`));
  if (a.calories) cells.push(avp(t('ui.actual.calories'), `${Math.round(a.calories)}`));
  if (a.rpe) cells.push(avp(t('ui.actual.rpe'), `${a.rpe}`));
  const link = a.stravaLink
    ? `<a class="strava-link" href="${esc(a.stravaLink)}" target="_blank" rel="noopener noreferrer">${t('ui.viewOnStrava')}</a>` : '';
  return `<div class="block">
    <h4>${t('ui.actualTitle')} ${a.stravaId ? '· <span class="powered-by-strava">Powered by Strava</span>' : ''}</h4>
    <div class="actual-vs-planned">${cells.join('')}</div>${link}</div>`;
}

// Manual result logging (used when a session isn't Strava-linked).
function actualEntry(w) {
  const a = w.actual || {};
  const field = (label, key, mode) =>
    `<label>${label}<input inputmode="${mode}" value="${esc(a[key] ?? '')}" placeholder="–"
       data-action="actual-field" data-id="${esc(w.id)}" data-field="${key}"></label>`;
  return `<div class="block"><h4>${t('ui.logActual')}</h4>
    <div class="ex-log actual-entry">
      ${field('km', 'distanceKm', 'decimal')}
      ${field('min', 'durationMin', 'numeric')}
      ${field(t('ui.fieldAvgHr'), 'avgHr', 'numeric')}
      ${field('RPE', 'rpe', 'decimal')}
    </div></div>`;
}

// Neon intensity-zone badge (hr_zone 1-5).
export function zoneBadge(z) {
  const n = Math.max(1, Math.min(5, parseInt(z) || 1));
  return `<span class="zone zone-${n}" title="${t('ui.zoneTitle', { n })}">Z${n}</span>`;
}

// Parse "[Warmup] … [Main Set] … [Cooldown] …" notes into labelled blocks.
// Any comma / slash / semicolon-separated movement list is exploded into one
// pill per line so gym sets read as a clean vertical index, not a run-on row.
function structuredBlocks(w) {
  const n = planNotes(w.notes || '');
  if (!/\[[^\]]+\]/.test(n)) return '';
  // when the main set became real exercises (with art and a set grid), only
  // the warm-up and cool-down stay as text
  const hideMain = mainSetIsExercises(w);
  const segs = [...n.matchAll(/\[([^\]]+)\]\s*([^[]*)/g)].map((m) => ({ label: m[1].trim(), text: m[2].trim() }))
    .filter((s) => s.text && !(hideMain && /^main/i.test(s.label)));
  if (!segs.length) return '';
  return `<div class="block"><h4>${t('ui.sessionBlock')}</h4><div class="struct">${segs.map((s) => {
    const moves = s.text.split(/\s*[,;]\s*|\s+\/\s+/).map((x) => x.trim()).filter(Boolean);
    const body = moves.length > 1
      ? `<ul class="move-list">${moves.map((m) => `<li class="move-pill mono">${esc(m)}</li>`).join('')}</ul>`
      : `<span class="struct-text mono">${esc(s.text)}</span>`;
    return `<div class="struct-row"><span class="struct-label">${esc(s.label)}</span>${body}</div>`;
  }).join('')}</div></div>`;
}

// ---- level art (from the scene manifest) ------------------------------------

/** Thumbnail / still for a sport at a level (bike uses its character sprite). */
export function sportArtSrc(type, level) {
  const s = sceneFor(type, level);
  if (!s) return null;
  return s.kind === 'still' ? s.entry.src : s.entry.char;
}

function sportFrames(type) {
  const s = SCENES[type];
  if (!s) return [];
  return s.levels.map((e, i) => ({ level: i + 1, src: s.kind === 'still' ? e.src : e.char, entry: s.kind === 'still' ? e : null }));
}

/** Covers for a still's baked-in corner label and generator mark. */
export function stillCorners(entry) {
  return (entry?.corners || []).map((c) =>
    `<span class="pg-corner" style="background:${entry.backdrop.bottom};clip-path:${cornerPolygon(c)}"></span>`).join('');
}

// Horizontally-swipeable level carousel (modal body). Current level centred +
// themed border, past levels scaled down (left), future levels dimmed + locked.
export function sportLevelCarousel(type, level) {
  const frames = sportFrames(type);
  if (!frames.length) return `<p class="muted">${t('ui.noLevels')}</p>`;
  const d = DISCIPLINES[type] || DISCIPLINES.other;
  const items = frames.map((f) => {
    const state = f.level === level ? 'current' : (f.level < level ? 'past' : 'future');
    const lock = state === 'future' ? `<span class="lvl-lock">${svg('lock')}</span>` : '';
    // The focused (current) level becomes a tap target that opens the fullscreen lightbox.
    const zoom = state === 'current'
      ? `data-action="open-lightbox" data-src="${esc(f.src)}" data-sport="${esc(type)}" role="button" tabindex="0" aria-label="${t('ui.zoomLevel', { n: f.level })}"`
      : '';
    return `<div class="lvl-frame --${esc(type)} is-${state}" data-level="${f.level}">
      <div class="lvl-frame-art" ${zoom}><img src="${esc(f.src)}" alt="${esc(t('ui.levelAlt', { sport: d.label, n: f.level }))}" loading="lazy">${stillCorners(f.entry)}${lock}</div>
      <span class="lvl-frame-tag">LVL ${f.level}</span>
    </div>`;
  }).join('');
  return `<div class="lvl-carousel-head"><b>${svg(type, `tint-${type}`)} ${esc(d.label)}</b><span class="lvl-chip">LVL ${level}</span></div>
    <div class="lvl-carousel" data-current="${level}">${items}</div>
    <p class="muted small">${esc(t('ui.unlockMore', { sport: d.label.toLowerCase() }))}</p>`;
}

// Profile dashboard: one tappable row per sport the athlete has earned XP in.
function sportLeveling(ctx) {
  const rows = ['run', 'bike', 'gym'].map((sp) => {
    const p = sportProgress(ctx.workouts, sp);
    if (!(p.totalXp > 0)) return '';               // only show sports with XP
    const pct = Math.round(p.progress * 100);
    const d = DISCIPLINES[sp];
    return `<button class="lvl-row" data-action="open-sport-levels" data-sport="${sp}">
      <span class="lvl-thumb --${sp}"><img src="${esc(sportArtSrc(sp, p.level))}" alt="" loading="lazy" onerror="this.style.opacity=0"></span>
      <span class="lvl-row-body">
        <span class="lvl-row-head"><b>${svg(sp, `tint-${sp}`)} ${esc(d.label)}</b><span class="lvl-chip">LVL ${p.level}</span></span>
        <span class="lvl-track"><span class="lvl-fill --${sp}" style="width:${pct}%"></span></span>
        <small class="lvl-foot">${t('ui.xpToLevel', { xp: fmtNum(p.toNext), next: p.level + 1 })}</small>
      </span>
    </button>`;
  }).filter(Boolean).join('');
  if (!rows) return '';
  return `<section class="card lvl-section"><h3>${t('ui.sportLevels')}</h3><div class="lvl-rows">${rows}</div></section>`;
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
    return `<div class="pwr-bar zcol-${c}" style="height:${Math.round((s.watts / max) * 100)}%; flex:${(s.min / totalMin).toFixed(3)}" title="${t('ui.powerBar', { min: s.min, watts: s.watts, pct: Math.round(z * 100) })}"><span>${s.watts}</span></div>`;
  }).join('');
  return `<div class="block"><h4>${t('ui.power')}</h4><div class="pwr">${bars}</div><div class="pwr-ftp">${t('ui.ftpNote', { ftp })}</div></div>`;
}

// Read-only packing checklist driven by the per-sport preset configured in Settings.
function packingChecklist(w, settings) {
  const preset = settings?.packing?.[w.type] || [];
  if (!preset.length) return '';
  const packed = new Set(w.packed || []);
  return `<div class="block"><h4>${t('ui.packing')}</h4><ul class="pack-items">${preset.map((item) => `
    <li class="${packed.has(item) ? 'checked' : ''}"><label><input type="checkbox" data-action="toggle-preset-pack" data-id="${esc(w.id)}" data-item="${esc(item)}" ${packed.has(item) ? 'checked' : ''}><span>${esc(planItem(item, w.type))}</span></label></li>`).join('')}</ul></div>`;
}

function metaChips(w, units) {
  const d = DISCIPLINES[w.type] || DISCIPLINES.other;
  const pace = paceHint(w.type, w.intensity);
  const tags = [];
  if (w.isRace) tags.push(`<span class="tag race">${t('ui.tagRace')}</span>`);
  if (w.deload) tags.push(`<span class="tag deload">${/taper/i.test(w.title) ? t('ui.tagTaper') : t('ui.tagDeload')}</span>`);
  if (w.strava_activity_id) tags.push('<span class="tag strava">Strava</span>');
  return [
    `<span class="chip type-${w.type}">${svg(w.type)} ${d.label}</span>`,
    w.hr_zone ? zoneBadge(w.hr_zone) : '',
    `<span class="chip data">${formatDuration(w.durationMin)}</span>`,
    w.metrics?.distanceKm ? `<span class="chip data">${fmtKm(w.metrics.distanceKm, units)}</span>` : '',
    `<span class="chip intensity-${w.intensity}">${INTENSITIES[w.intensity] || w.intensity}</span>`,
    pace ? `<span class="chip pace">${esc(pace)}</span>` : '',
  ].filter(Boolean).join('') + tags.join('');
}

// ---- compact bento card (Home/Week list) ------------------------------------

export function sessionCard(w, units, { isNext = false } = {}) {
  const km = w.metrics?.distanceKm;
  return `<article class="card bento type-${w.type} ${w.completed ? 'completed' : ''} ${isNext ? 'is-next' : ''}" data-action="open-workout" data-id="${esc(w.id)}" role="button" tabindex="0">
    <div class="bento-top">
      <span class="status-dot ${w.completed ? 'on' : ''}" title="${w.completed ? t('ui.completed') : t('ui.planned')}"></span>
      <h3>${esc(planTitle(w.title))}</h3>
      ${isNext ? `<span class="tag next">${t('ui.next')}</span>` : ''}${w.hr_zone ? zoneBadge(w.hr_zone) : ''}
    </div>
    <div class="bento-metrics">
      <div class="bm"><span class="bm-ico">${svg('clock')}</span><b>${w.durationMin || 0}</b><small>min</small></div>
      ${km ? `<div class="bm"><span class="bm-ico">${svg('route')}</span><b>${fmtNum(km, { maximumFractionDigits: 1 })}</b><small>${units === 'imperial' ? 'mi' : 'km'}</small></div>` : ''}
      <div class="bm"><span class="bm-ico">${svg('flame')}</span><b>${kcalEst(w)}</b><small>kcal</small></div>
    </div>
  </article>`;
}

// ---- expanded detail (modal) ------------------------------------------------

export function renderWorkoutDetail(w, units, ctx) {
  const ftp = ctx?.settings?.ftp || 250;
  const detail = w.type === 'bike' ? (powerChart(w, ftp) || structuredBlocks(w)) : structuredBlocks(w);
  const segs = segmentBar(w.segments);
  const logger = hasLogger(w) ? renderLogger(w, ctx?.workouts || []) : '';
  const actuals = w.strava_activity_id ? actualsBlock(w, units) : actualEntry(w);
  // the logger's session bar goes first so it can stick to the top of the sheet
  const [bar, exercises] = logger ? logger.split('<!--gl-split-->') : ['', ''];
  return `${bar}
    ${dialogue({ text: sessionLine(w), cls: 'coach-say', type: true })}
    <div class="meta">${metaChips(w, units)}</div>
    ${fuellingChip(w)}
    ${detail}
    ${segs ? `<div class="block">${segs}</div>` : ''}
    ${exercises}
    ${actuals}
    ${packingChecklist(w, ctx?.settings)}
    ${w.completed && (w.strava_activity_id || w.source === 'strava')
      ? `<button class="btn primary block" data-action="share-card" data-id="${esc(w.id)}">${svg('upload')} ${t('ui.shareCard')}</button>` : ''}
    <div class="card-foot">
      <button class="btn tiny ghost" data-action="edit" data-id="${esc(w.id)}">${svg('edit')} ${t('ui.edit')}</button>
      <button class="btn tiny ghost" data-action="duplicate" data-id="${esc(w.id)}">${svg('copy')} ${t('ui.duplicate')}</button>
      <button class="btn tiny ghost danger" data-action="delete" data-id="${esc(w.id)}">${svg('trash')} ${t('ui.delete')}</button>
    </div>`;
}

// ---- shared pixel components -------------------------------------------------

/** Segmented meter: `segments` cells, filled in proportion to frac (0..1+).
 *  `key` names the meter across renders so motion.js can light only the
 *  segments that are new since it was last on screen. */
export function meter(frac, { segments = 10, cls = '', label = '', key = '' } = {}) {
  const f = Math.max(0, Number(frac) || 0);
  const on = Math.min(segments, Math.round(Math.min(1, f) * segments));
  const cells = Array.from({ length: segments }, (_, i) => `<i${i < on ? ' class="on"' : ''}></i>`).join('');
  const k = key ? ` data-meter-key="${esc(key)}"` : '';
  return `<div class="meter ${f > 1 ? 'over' : ''} ${cls}"${k} role="img" aria-label="${esc(label || `${Math.round(f * 100)}%`)}">${cells}</div>`;
}

/** The coach's face at 32px (his portrait, or the whistle icon until art exists). */
export function coachMini() {
  return COACH.portrait
    ? `<img class="coach-mini" src="${esc(COACH.portrait)}" alt="" width="32" height="32">`
    : `<span class="coach-mini">${svg('coach')}</span>`;
}

/** Dialogue box: the coach (or another speaker) saying one thing.
 *  `type: true` marks the line for a typewriter reveal (see effects.typeLines). */
export function dialogue({ who = COACH.name, icon = 'coach', text = '', body = '', cls = '', portrait = who === COACH.name ? COACH.portrait : null, type = false } = {}) {
  const frames = portrait === COACH.portrait
    ? `${COACH.blink ? ` data-blink="${esc(COACH.blink)}"` : ''}${COACH.talk ? ` data-talk="${esc(COACH.talk)}"` : ''}` : '';
  const pic = portrait ? `<img class="dlg-portrait" src="${esc(portrait)}" alt="" width="64" height="64"${frames}>` : '';
  return `<section class="dlg ${portrait ? 'has-portrait' : ''} ${cls}">${pic}
    <div><div class="dlg-who">${portrait ? '' : svg(icon)}${esc(who)}</div>
    ${text ? `<p class="coach-line"${type ? ' data-type' : ''}>${esc(text)}</p>` : ''}${body}</div></section>`;
}

// ---- HOME (today's snapshot: rings → insight → focus) ------------------------

export function eventBanner(ctx) {
  const evs = (ctx.settings?.events || []).filter((e) => e.date && e.date >= ctx.today)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!evs.length) return '';
  // one text span, so the flex row doesn't split the sentence into columns
  if (evs[0].date === ctx.today) return `<div class="race-banner is-today">${svg('flag')}<span>${t('ui.raceDayBanner', { title: `<b>${esc(evs[0].title)}</b>` })}</span></div>`;
  return `<div class="race-banner">${svg('flag')}<span>${t('ui.nextEvent', { title: `<b>${esc(evs[0].title)}</b>`, date: esc(shortLabel(evs[0].date)) })}</span></div>`;
}

// Home, loudest first: today's session is the one primary thing. The week's
// goals sit in one compact strip (tap to open), quests fold to one line once
// they're cleared, and the AI coach offer is a quiet row at the end.
export function renderHome(ctx) {
  const ws = mondayOf(ctx.today);
  return homeDateHeader(ctx)
    + focusCard(ctx)
    + weekStrip(ctx, ws, !!ctx.ui?.weekOpen)
    + questsPanel(ctx)
    + weekPathCard(ctx)
    + tomorrowGlance(ctx)
    + `<section class="ai-row">${coachMini()}<p>${t('ui.aiOffer')}</p>
        <button class="btn tiny secondary" data-action="ai-onboard">${svg('spark')} ${t('ui.buildPlan')}</button></section>`;
}

/** Daily quests: three per day, reset at local midnight. */
export function questsPanel(ctx) {
  const qs = ctx.quests || [];
  const done = qs.filter((q) => q.done).length;
  const verifiedToday = ctx.workouts.filter((w) => w.date === ctx.today && earnsXp(w)).length;
  const planned = ctx.workouts.filter((w) => w.date === ctx.today && w.source !== 'strava').length;
  const events = ctx.settings?.events || [];
  const line = dayLine({
    planned, verified: verifiedToday, questsDone: done, questsTotal: qs.length, streak: ctx.streaks?.current || 0,
    today: ctx.today,
    race: raceOn(ctx.workouts, events, ctx.today),
    raceTomorrow: raceOn(ctx.workouts, events, addDays(ctx.today, 1)),
  });
  // all cleared: the panel folds to one line (tap to see them again)
  if (qs.length && done === qs.length && !ctx.ui?.questsOpen) {
    const xp = qs.reduce((n, q) => n + (Number(q.xp) || 0), 0);
    return `<button class="dlg quests-panel q-folded" data-action="toggle-quests" aria-expanded="false">
      <span class="q-box" aria-hidden="true">${svg('check')}</span>
      <span class="q-fold-text"><b>${t('ui.questsCleared')}</b><small>${t('ui.questsClearedSub', { xp: fmtNum(xp), time: formatCountdown(msUntilReset()) })}</small></span>
      <span class="wk-sum-chev" aria-hidden="true">${svg('chevron')}</span></button>`;
  }
  const rows = qs.length
    ? `<ul class="q-list">${qs.map((q) => `<li class="q-row ${q.done ? 'done' : ''} ${ctx.freshQuests?.has(q.id) ? 'just-done' : ''}" data-quest="${esc(q.id)}">
        <span class="q-box" aria-hidden="true">${q.done ? svg('check') : ''}</span>
        <span class="q-text">${esc(q.text)}<span class="sr">${q.done ? t('ui.questDone') : ''}</span></span>
        <span class="q-xp">+${q.xp}</span></li>`).join('')}</ul>`
    : `<p class="q-empty">${t('ui.noQuests')}</p>`;
  return `<section class="dlg quests-panel" aria-label="${t('ui.dailyQuests')}">
    <div class="q-head"><h3>${svg('scroll')} ${t('ui.dailyQuests')}</h3>
      <span class="q-reset" data-quest-reset title="${t('ui.resetsAtMidnight')}">${t('ui.resetsIn', { time: formatCountdown(msUntilReset()) })}</span></div>
    ${rows}
    <div class="q-coach">${coachMini()}<p class="coach-line"><span class="dlg-who">${esc(COACH.name)}</span>${esc(line)}</p></div>
  </section>`;
}

// Bold date context header: "SATURDAY / Today, 11 July".
function homeDateHeader(ctx) {
  const d = parseISO(ctx.today);
  const weekday = capFirst(fmtDate(d, { weekday: 'long' }));
  const label = fmtDate(d, { day: 'numeric', month: 'long' });
  return `<div class="home-date"><small>${esc(t('ui.todayEyebrow', { weekday }))}</small><h2>${esc(label)}</h2>
    <button class="btn jr-btn" data-action="tab" data-tab="journal" aria-label="${t('ui.openCalendar')}">${svg('calendar')}<span class="jr-label">${t('ui.calendar')}</span></button></div>`;
}

// A scaled-down one-line preview of tomorrow — never more than today + tomorrow.
function tomorrowGlance(ctx) {
  const tmr = addDays(ctx.today, 1);
  const sessions = ctx.workouts.filter((w) => w.date === tmr).sort(sortSessions);
  let inner;
  let attrs;
  if (sessions.length) {
    const w = sessions[0];
    const d = DISCIPLINES[w.type] || DISCIPLINES.other;
    const extra = sessions.length > 1 ? ` <span class="tg-extra">+${sessions.length - 1}</span>` : '';
    inner = `<span class="sport-dot type-${esc(w.type)}"></span>
      <span class="tg-title">${esc(t('ui.tomorrowLine', { sport: d.label, title: planTitle(w.title) }))}${extra}</span>
      <span class="tg-min">${w.durationMin || 0}<small class="data-unit"> min</small></span>`;
    attrs = `data-action="open-workout" data-id="${esc(w.id)}"`;
  } else {
    inner = `<span class="sport-dot"></span>
      <span class="tg-title tg-rest">${esc(t('ui.restRecovery'))}</span>
      <span class="tg-min tg-rest">—</span>`;
    attrs = `data-action="open-editor-new" data-date="${esc(tmr)}"`;
  }
  return `<h3 class="sec-title">${svg('calendar')} ${t('ui.tomorrow')}</h3>
    <section class="card tg-card" ${attrs} role="button" tabindex="0">${inner}</section>`;
}

// Weekly goal progress vs the three configured targets.
function weekGoalState(ctx, weekStartIso) {
  const g = ctx.settings?.goals || { sessions: 5, km: 50, hours: 8 };
  const end = addDays(weekStartIso, 6);
  const inWeek = ctx.workouts.filter((w) => w.completed && w.date >= weekStartIso && w.date <= end);
  const km = inWeek.reduce((a, w) => a + (Number(w.metrics?.distanceKm) || 0), 0);
  const hours = weekHours(ctx.workouts, weekStartIso);
  const frac = (v, goal) => (goal > 0 ? v / goal : 1);
  return {
    g, sessions: inWeek.length, km, hours,
    fracs: { sessions: frac(inWeek.length, g.sessions), km: frac(km, g.km), hours: frac(hours, g.hours) },
  };
}

// One goal as a labelled segmented meter: "PLAN 3/5" over ten cells.
function goalMeter(frac, label, targetHtml, cls = '', id = label.toLowerCase()) {
  const p = Math.max(0, Math.round(frac * 100));
  return `<div class="goal-row">
    <div class="goal-top"><b>${esc(label)}</b><span>${targetHtml}</span></div>
    ${meter(frac, { cls, label: `${label} ${p}%`, key: `goal-${id}` })}
  </div>`;
}

// "This week": one compact strip (Plan / Volume / Intensity as small meters).
// Tap it to open the full meters, the coaching line and Edit goals.
function weekStrip(ctx, weekStartIso, open) {
  const s = weekGoalState(ctx, weekStartIso);
  const a = acwr(ctx.workouts, ctx.today);
  const intensityFrac = Math.max(0, Math.min(1.5, a.ratio || 0));
  const doneToday = ctx.workouts.some((w) => w.completed && w.date === ctx.today);
  const opener = doneToday ? t('ui.niceWork') : t('ui.freshDay');
  const mini = (label, frac, cls) => `<span class="wk-mini"><small>${label}</small>${meter(frac, { segments: 5, cls, label: `${label} ${Math.round(Math.min(1, frac) * 100)}%` })}</span>`;
  return `<section class="card wk-sum${open ? ' is-open' : ''}">
    <button class="wk-sum-row" data-action="toggle-week" aria-expanded="${open}" aria-controls="wk-detail">
      <span class="wk-sum-title">${t('ui.thisWeek')}</span>
      ${mini(t('ui.plan'), s.fracs.sessions)}${mini(t('ui.vol'), s.fracs.hours, 'info')}${mini(t('ui.int'), intensityFrac / 1.3, 'good')}
      <span class="wk-sum-chev" aria-hidden="true">${svg('chevron')}</span>
    </button>
    ${open ? `<div class="wk-detail" id="wk-detail">
      ${goalMeter(s.fracs.sessions, t('ui.plan'), `${rollNum(s.sessions, 'goal-sessions')} / ${esc(s.g.sessions)}`, '', 'plan')}
      ${goalMeter(s.fracs.hours, t('ui.volume'), `${rollNum(s.hours, 'goal-hours', { dp: 1 })} / ${esc(s.g.hours)} ${t('ui.hoursUnit').toUpperCase()}`, 'info', 'volume')}
      ${goalMeter(intensityFrac / 1.3, t('ui.intensity'), a.ratio ? t('ui.xBase', { ratio: rollNum(a.ratio, 'goal-ratio', { dp: 2 }) }) : t('ui.calibrating'), 'good', 'intensity')}
      <p class="wk-coach">${esc(opener)} ${esc(insightText(ctx, weekStartIso))}</p>
      <button class="btn tiny ghost rings-edit" data-action="edit-goals">${svg('edit')} ${t('ui.editGoals')}</button>
    </div>` : ''}
  </section>`;
}

// One understated sentence pointing at the goal that needs the most work.
function insightText(ctx, weekStartIso) {
  const s = weekGoalState(ctx, weekStartIso);
  const entries = Object.entries(s.fracs).sort((a, b) => a[1] - b[1]);
  const [worst, frac] = entries[0];
  if (frac >= 1) return t('ui.insightPerfect');
  if (worst === 'km') return t('ui.insightKm', { n: Math.max(1, Math.ceil(s.g.km - s.km)) });
  if (worst === 'hours') return t('ui.insightHours', { n: fmtNum(Math.max(0.5, (s.g.hours - s.hours)), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) });
  const n = Math.max(1, s.g.sessions - s.sessions);
  return t('ui.insightSessions', { n });
}


// A single ultra-clean card for today's targeted assignment.
// A letterbox crop of the sport's scene at the athlete's current level, as the
// header of Today's target. Same art as Profile, so levelling up shows here too.
function sceneStrip(type, workouts) {
  const sport = type === 'brick' ? 'bike' : type;
  const s = sceneFor(sport, sportProgress(workouts, sport).level);
  if (!s) return '';
  const e = s.entry;
  const art = s.kind === 'still'
    ? `<img class="fs-still" src="${esc(e.src)}" alt="" width="${e.w}" height="${e.h}" style="--ar:${e.w} / ${e.h}" loading="lazy">`
    : `<span class="fs-world"><img src="${esc(e.bg)}" alt="" loading="lazy"><img src="${esc(e.platform)}" alt="" class="fs-plat" loading="lazy"><img src="${esc(e.char)}" alt="" class="fs-char" loading="lazy"></span>`;
  return `<div class="focus-strip is-${s.kind} sp-${s.sport}" aria-hidden="true">${art}<span class="fs-lvl">LVL ${s.level}</span></div>`;
}

function focusCard(ctx) {
  const { today, workouts, units } = ctx;
  const sessions = workouts.filter((w) => w.date === today).sort(sortSessions);

  if (!sessions.length) {
    const next = nextSession(workouts, today);
    return `<section class="card focus-card" data-action="open-editor-new" data-date="${esc(today)}" role="button" tabindex="0">
      <div class="focus-top"><span class="focus-sport">${svg('moon')} ${t('ui.today')}</span></div>
      <div class="focus-big">${t('ui.rest')}</div>
      <div class="focus-sub">${next ? esc(t('ui.nextUpLine', { title: planTitle(next.title), date: shortLabel(next.date) })) : t('ui.nothingScheduled')}</div>
    </section>`;
  }

  const focus = sessions.find((w) => !w.completed) || sessions[sessions.length - 1];
  const d = DISCIPLINES[focus.type] || DISCIPLINES.other;
  const strip = sceneStrip(focus.type, workouts);
  const km = focus.metrics?.distanceKm;
  const others = sessions.length - 1;
  return `<section class="card focus-card${strip ? ' has-strip' : ''}" data-action="open-workout" data-id="${esc(focus.id)}" role="button" tabindex="0">
      ${strip}
      <div class="focus-top">
        <span class="focus-sport">${svg(focus.type, `tint-${focus.type}`)} ${esc(d.label)}</span>
        ${focus.hr_zone ? zoneBadge(focus.hr_zone) : ''}
        <span class="focus-state">${focus.completed ? t('ui.done') : t('ui.nextUp')}</span></div>
      <h3 class="focus-title">${esc(planTitle(focus.title))}</h3>
      <div class="bento-metrics">
        <div class="bm"><span class="bm-ico">${svg('clock')}</span><b>${focus.durationMin || 0}</b><small>min</small></div>
        ${km ? `<div class="bm"><span class="bm-ico">${svg('route')}</span><b>${fmtNum(km, { maximumFractionDigits: 1 })}</b><small>${units === 'imperial' ? 'mi' : 'km'}</small></div>` : ''}
        <div class="bm"><span class="bm-ico">${svg('flame')}</span><b>${kcalEst(focus)}</b><small>kcal</small></div>
      </div>
      <div class="focus-sub">${esc(INTENSITIES[focus.intensity] || '')}${focus.notes && /\[Main Set\]/i.test(focus.notes) ? t('ui.structuredHint') : t('ui.detailsHint')}</div>
    </section>`
    + (others ? `<p class="focus-more">${t('ui.moreToday', { n: others })}</p>` : '');
}

// ---- JOURNAL (Mon–Fri chronological list, today spot-lit) ---------------------

export function renderJournal(ctx, selectedIso) {
  const { workouts, units, today } = ctx;
  const anchor = selectedIso || today;
  const ws = mondayOf(anchor);
  const monthLabel = capFirst(fmtDate(parseISO(ws), { month: 'long', year: 'numeric' }));

  // Full Monday→Sunday rows; the row matching today's calendar date gets an
  // explicit high-contrast focus block.
  const rows = Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(ws, i);
    const isToday = iso === today;
    const sessions = workouts.filter((w) => w.date === iso).sort(sortSessions);
    const cards = sessions.length
      ? sessions.map((w) => sessionCard(w, units, { isNext: false })).join('')
      : `<div class="rest-day">${svg('moon')} ${t('ui.restDay')} · <button class="link" data-action="open-editor-new" data-date="${esc(iso)}">${t('ui.addSession')}</button></div>`;
    return `<div class="jr-row ${isToday ? 'is-today' : ''}">
      <div class="jr-row-head"><b>${esc(weekdayName(iso))}</b><span>${esc(shortLabel(iso))}</span>${isToday ? `<span class="tag today">${t('ui.today')}</span>` : ''}</div>
      ${cards}
    </div>`;
  }).join('');

  return `
    <div class="jr-head"><h2>${t('ui.calendar')}</h2><span class="jr-month">${esc(monthLabel)}</span></div>
    <div class="jr-strip">
      <button class="jr-week-nav prev" data-action="jr-week" data-dir="-1" aria-label="${t('ui.prevWeek')}">${svg('chevron')}</button>
      <span class="jr-range">${esc(shortLabel(ws))} – ${esc(shortLabel(addDays(ws, 6)))}</span>
      <button class="jr-week-nav" data-action="jr-week" data-dir="1" aria-label="${t('ui.nextWeek')}">${svg('chevron')}</button>
    </div>
    ${rows}`;
}

// ---- PROGRESS ---------------------------------------------------------------

export function renderProgress(ctx) {
  const { workouts, stats, streaks, today, units, settings } = ctx;
  return [
    `<div class="day-header"><h2>${t('ui.profile')}</h2></div>`,
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
  const zoneLabel = t(`ui.zone.${a.zone}`);
  const rvLine = rv.pctChange == null ? t('ui.noRunLastWeek')
    : t('ui.runVolume', { pct: `${rv.pctChange >= 0 ? '+' : ''}${rv.pctChange}`, last: rv.lastKm, now: rv.thisKm });
  return `<section class="card">
    <h3>${t('ui.trainingLoad')}</h3>
    <div class="load-grid">
      <div class="load-cell"><small>${t('ui.acute')}</small><b>${a.acute}</b></div>
      <div class="load-cell"><small>${t('ui.chronic')}</small><b>${a.chronicWeekly}</b></div>
      <div class="load-cell acwr-${a.zone}"><small>${t('ui.acwr')}</small><b>${a.ratio || '—'}</b></div>
    </div>
    <p class="muted small">${t('ui.acwrLine', { zone: `<b>${esc(zoneLabel)}</b>`, runLine: esc(rvLine) })}</p>
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
    <h3>${t('ui.bodyMetrics')}</h3>
    <div class="metrics">
      ${row(t('ui.weight'), 'weight', ' kg', 'var(--c-bike)')}
      ${row(t('ui.restingHr'), 'rhr', ' bpm', 'var(--c-run)')}
      ${row(t('ui.sleep'), 'sleep', ' h', 'var(--c-swim)')}
    </div>
    <form class="metric-log" data-action="log-metric" data-date="${esc(today)}">
      <input type="number" step="0.1" name="weight" placeholder="${t('ui.phKg')}" aria-label="${t('ui.ariaWeight')}">
      <input type="number" step="1" name="rhr" placeholder="${t('ui.phRhr')}" aria-label="${t('ui.ariaRhr')}">
      <input type="number" step="0.1" name="sleep" placeholder="${t('ui.phSleep')}" aria-label="${t('ui.ariaSleep')}">
      <button type="submit" class="btn tiny">${t('ui.logToday')}</button>
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
  return `<section class="card"><h3>${t('ui.weeklyVolume')}</h3><div class="vchart">${bars}</div><p class="muted small">${t('ui.weeklyVolumeNote')}</p></section>`;
}

function disciplineBreakdown(stats) {
  const order = ['run', 'bike', 'swim', 'gym', 'brick', 'mobility', 'other'];
  const entries = order
    .map((type) => ({ type, min: stats.minutesByType[type] || 0 }))
    .filter((e) => e.min > 0);
  const total = entries.reduce((a, e) => a + e.min, 0) || 1;
  const rows = entries.map((e) => {
    const d = DISCIPLINES[e.type];
    const pct = Math.round((e.min / total) * 100);
    return `<div class="disc-row"><span class="disc-label">${svg(e.type)} ${d.label}</span>
      <div class="disc-bar"><div class="disc-fill type-${e.type}" style="width:${pct}%"></div></div>
      <span class="disc-val">${fmtNum(e.min / 60, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h</span></div>`;
  }).join('');
  return `<section class="card"><h3>${t('ui.disciplineBreakdown')}</h3>${rows || `<p class="muted">${t('ui.noSplit')}</p>`}</section>`;
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
      cells += `<i class="heat ${lvl}" title="${shortLabel(iso)}${done.has(iso) ? t('ui.heatDone') : ''}"></i>`;
    }
  }
  return `<section class="card"><h3>${t('ui.consistency')}</h3>
    <p class="muted small">${t('ui.consistencyLine', { current: streaks.current, longest: streaks.longest })}</p>
    <div class="heatmap" style="grid-template-columns:repeat(16,1fr)">${cells}</div></section>`;
}

export function badgeWall(unlocked) {
  const set = new Set(unlocked);
  const tiles = BADGES.map((b) => {
    const on = set.has(b.id);
    return `<div class="badge ${on ? 'unlocked' : 'locked'}" title="${esc(b.desc)}">
      <div class="badge-ico">${svg(on ? b.icon : 'lock')}</div>
      <div class="badge-name">${esc(b.name)}</div>
      <div class="badge-desc">${esc(b.desc)}</div></div>`;
  }).join('');
  return `<section class="card"><h3>${t('ui.badges')} <span class="muted">(${unlocked.length}/${BADGES.length})</span></h3>
    <div class="badge-wall">${tiles}</div></section>`;
}

function referenceCards() {
  const paces = PACE_REFERENCE.map((p) =>
    `<li><span class="dot seg-${p.kind}"></span><b>${esc(planWord(p.label))}</b><span>${esc(planWord(p.value))}</span></li>`).join('');
  const principles = PLAN_PRINCIPLES.map((p) => `<li>${esc(planWord(p))}</li>`).join('');
  return `
    <section class="card"><h3>${esc(t('ui.paceRef'))}</h3><ul class="ref-list">${paces}</ul></section>
    <section class="card"><h3>${t('ui.planPrinciples')}</h3><ul class="principles">${principles}</ul></section>`;
}

// ---- lifetime totals (proper) ----------------------------------------------

export function totalsStrip(stats, streaks, units) {
  const totalKm = Object.values(stats.kmByType).reduce((a, b) => a + b, 0);
  const cells = [
    [t('ui.totals.level'), stats.level],
    [t('ui.totals.totalXp'), fmtNum(stats.totalXp)],
    [t('ui.totals.sessions'), stats.completedCount],
    [t('ui.totals.hours'), fmtNum(stats.totalHours, { minimumFractionDigits: 1, maximumFractionDigits: 1 })],
    [t('ui.totals.distance'), fmtKm(totalKm, units) || '0 km'],
    [t('ui.totals.bestStreak'), t('ui.daysShort', { n: streaks.longest })],
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
  return `<div class="race-banner">${svg('flag')} ${t('ui.raceIn', { title: `<b>${esc(planTitle(upcoming.title))}</b>`, n: days })} <span class="muted">· ${shortLabel(upcoming.date)}</span></div>`;
}
