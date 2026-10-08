// profile-game.js — the Profile tab as a full-screen, level-reactive game scene
// for each sport. Cycling stacks three layers (background / platform / animated
// character); Run, Gym and Swim frame a single still on its own edge colours and
// add code-driven motion (clouds, leaves, light, water) from the scene manifest
// in core/scenes.js. The avatar opens the full-screen Fitness hub (activity
// calendar, trend, strain, cardio drill-down).

import { sportProgress, levelFromTotalXp } from '../core/scoring.js';
import { computeStreaks } from '../core/streaks.js';
import { BADGES, evaluateBadges } from '../core/badges.js';
import { sessionLoad, acwr, weekHours } from '../core/load.js';
import { svg } from '../core/icons.js';
import { rollNum } from './motion.js';
import { esc, mondayOf, meter, stillCorners } from './ui.js';
import { sceneFor, backdropCss, timeOfDay } from '../core/scenes.js';
import { addDays, parseISO, shortLabel, todayISO } from '../core/dates.js';
import { currentUser } from './auth.js';
import * as store from './store.js';

// Circular avatar slot: uploaded photo if set, otherwise the initial letter.
function avatarInner(ctx, initial) {
  const src = ctx?.settings?.avatar;
  return src ? `<img src="${esc(src)}" alt="">` : initial;
}

function athleteName() {
  const u = currentUser?.();
  return (u?.user_metadata?.display_name || u?.email?.split('@')[0] || 'Athlete').trim();
}

// ---- scene overlays (code-driven motion on top of the art) --------------------
// Everything is positioned in % of the stage, so it scales with the art. All
// motion is CSS with steps() timing; CSS removes it under reduced motion.

const pct = (v) => `${Math.round(v * 100) / 100}%`;
const boxStyle = (b) => `--x:${pct(b.x)};--y:${pct(b.y)};--w:${pct(b.w)};--h:${pct(b.h)}`;
// tiny deterministic jitter so overlays don't march in lockstep
const jitter = (i, n) => ((i * 7919 + n * 104729) % 1000) / 1000;

function cloudsFx(box) {
  return [0, 1, 2].map((i) => {
    const dur = 48 + i * 17;
    return `<span class="fx-cloud" style="--y:${pct(box.y + (box.h - 4) * jitter(i, 3))};--dur:${dur}s;--steps:${dur * 3};--delay:-${Math.round(dur * jitter(i, 5))}s"><i></i><i></i><i></i></span>`;
  }).join('');
}

function leavesFx(leaves) {
  let out = '';
  leaves.from.forEach((tree, ti) => {
    for (let i = 0; i < 4; i++) {
      const dur = 6 + Math.round(jitter(i, ti + 11) * 4);
      out += `<span class="fx-leaf" style="--leaf:${leaves.color};--x:${pct(tree.x + tree.w * jitter(i, ti))};--y:${pct(tree.y + tree.h * jitter(i, ti + 7))};--dur:${dur}s;--steps:${dur * 2};--delay:-${(dur * jitter(i, ti + 3)).toFixed(1)}s"></span>`;
    }
  });
  return out;
}

function glowFx(boxes, dust) {
  let out = boxes.map((b, i) => `<span class="fx-glow" style="${boxStyle(b)};--delay:-${(i * 0.8).toFixed(1)}s"></span>`).join('');
  (dust || []).forEach((b, bi) => {
    for (let i = 0; i < 2; i++) {
      const dur = 4 + Math.round(jitter(i, bi) * 3);
      out += `<span class="fx-dust" style="--x:${pct(b.x + b.w * (0.25 + 0.5 * jitter(i, bi + 5)))};--y:${pct(b.y + b.h * 0.2)};--dur:${dur}s;--steps:${dur * 3};--delay:-${(dur * jitter(i, bi + 9)).toFixed(1)}s"></span>`;
    }
  });
  return out;
}

// night sky: a dozen 1-art-pixel stars that twinkle in steps, only where the
// scene has open sky (the run track's cloud band, the top of the bike world)
function starsFx(box) {
  return Array.from({ length: 12 }, (_, i) => {
    const big = i % 4 === 0;
    return `<span class="fx-star${big ? ' big' : ''}" style="--x:${pct(box.x + box.w * jitter(i, 21))};--y:${pct(box.y + box.h * jitter(i, 33))};--delay:-${(4 * jitter(i, 41)).toFixed(1)}s"></span>`;
  }).join('');
}

function sceneFx(fx = {}, tod = 'day') {
  let out = '';
  if (tod === 'night' && fx.clouds) out += starsFx(fx.clouds);
  if (fx.clouds) out += cloudsFx(fx.clouds);
  if (fx.leaves) out += leavesFx(fx.leaves);
  if (fx.clock) out += `<span class="fx-clock" style="${boxStyle(fx.clock)}"></span>`;
  if (fx.glow) out += glowFx(fx.glow, fx.dust);
  if (fx.shimmer) out += `<span class="fx-shimmer" style="--poly:polygon(${fx.shimmer.map(([x, y]) => `${x}% ${y}%`).join(', ')})"></span>`;
  if (fx.ripples) out += [0, 1].map((i) => `<span class="fx-ripple" style="--x:${pct(fx.ripples.x)};--y:${pct(fx.ripples.y)};--delay:-${i * 1.2}s"></span>`).join('');
  return out;
}

function stillStage(scene, tod) {
  const e = scene.entry;
  const corners = stillCorners(e);
  return `<div class="pg-stage-wrap"><div class="pg-stage" style="--ar:${e.w} / ${e.h};--bands:${backdropCss(e.backdrop)}">
    <div class="pg-art">
      ${e.plate && e.char
        ? `<img class="pg-still-img" src="${esc(e.plate)}" width="${e.w}" height="${e.h}" fetchpriority="high" alt="${esc(scene.label)} level ${scene.artLevel} scene">
      <img class="pg-still-img pg-still-char" src="${esc(e.char)}" width="${e.w}" height="${e.h}" alt="" aria-hidden="true">`
        : `<img class="pg-still-img" src="${esc(e.src)}" width="${e.w}" height="${e.h}" fetchpriority="high" alt="${esc(scene.label)} level ${scene.artLevel} scene">`}
      <div class="pg-tod" aria-hidden="true"></div>
      <div class="pg-fx" aria-hidden="true">${sceneFx(e.fx, tod)}</div>
      ${corners}
    </div>
  </div></div>`;
}

function layeredWorld(scene, tod) {
  const e = scene.entry;
  return `<div class="pg-world">
      <img class="pg-layer pg-bg" src="${esc(e.bg)}" alt="" aria-hidden="true">
      <img class="pg-layer pg-platform" src="${esc(e.platform)}" alt="" aria-hidden="true">
      <img class="pg-char" src="${esc(e.char)}" alt="${esc(scene.label)} level ${scene.artLevel} character">
      <div class="pg-tod" aria-hidden="true"></div>
      ${tod === 'night' ? `<div class="pg-fx" aria-hidden="true">${starsFx({ x: 4, y: 3, w: 92, h: 22 })}</div>` : ''}
    </div>`;
}

// ---- main full-screen view --------------------------------------------------

// The screen above / below the stage takes the first / last edge band.
function edgeColor(bd, which) {
  const cols = (bd.bands || '').match(/.{6}/g);
  if (!cols) return which === 0 ? bd.top : bd.bottom;
  return `#${which === 0 ? cols[0] : cols[cols.length - 1]}`;
}

const SWITCH = [['bike', 'Cycling'], ['swim', 'Swim'], ['run', 'Run'], ['gym', 'Gym']];

export function renderProfileGame(ctx, sport = 'bike') {
  const p = sportProgress(ctx.workouts, sport);
  const scene = sceneFor(sport, p.level) || sceneFor('bike', p.level);
  const initial = esc((athleteName() || 'A').charAt(0).toUpperCase());
  const still = scene.kind === 'still';
  // lighting follows the athlete's local clock: dawn, day, dusk, night
  const tod = timeOfDay(new Date().getHours());
  const indoor = scene.sport === 'gym' || scene.sport === 'swim';
  const bd = still ? `--bd-top:${edgeColor(scene.entry.backdrop, 0)};--bd-bot:${edgeColor(scene.entry.backdrop, -1)}` : '';

  const sportBtn = ([s, label]) => {
    const on = s === scene.sport;
    return `<button class="pg-sport ${on ? 'active' : ''}" data-action="pg-sport" data-sport="${s}"${on ? ' aria-current="true"' : ''}>
       ${svg(s)}<span>${label}</span></button>`;
  };

  return `
  <section class="pg-screen ${still ? 'pg-still' : ''} tod-${tod}${indoor ? ' indoor' : ''}" style="${bd}">
    ${still ? stillStage(scene, tod) : layeredWorld(scene, tod)}

    <div class="pg-topbar">
      <div class="pg-sports" role="group" aria-label="Sport">${SWITCH.map(sportBtn).join('')}</div>
      <button class="pg-avatar" data-action="pg-profile" aria-label="Open profile">${avatarInner(ctx, initial)}</button>
    </div>

    <div class="pg-hud">
      <div class="pg-hud-top">
        <span class="pg-sport-name">${svg(scene.sport, `tint-${scene.sport}`)} ${esc(scene.label)}</span>
        <button class="lvl-chip" data-action="open-sport-levels" data-sport="${scene.sport}" aria-label="Level ${p.level}: see every level">LVL ${rollNum(p.level, `lvl-${scene.sport}`)}</button>
      </div>
      ${meter(p.progress, { segments: 20, label: `${Math.round(p.progress * 100)}% to level ${p.level + 1}`, key: `hud-${scene.sport}` })}
      <div class="pg-xptext">${rollNum(p.into, `into-${scene.sport}`)} / ${p.span.toLocaleString()} XP · ${rollNum(p.toNext, `next-${scene.sport}`)} to LVL ${p.level + 1}</div>
    </div>
  </section>`;
}

// ---- decluttered avatar modal (core stats only) -----------------------------

function accountAge(ctx) {
  const u = currentUser?.();
  const dates = [u?.created_at, ...ctx.workouts.map((w) => w.date)].filter(Boolean).sort();
  if (!dates.length) return 'New';
  const start = new Date(dates[0]);
  const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
  if (days < 1) return 'New';
  if (days < 31) return `${days} d`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${(days / 365).toFixed(1)} y`;
}

// ---- full-screen Fitness & Cardio performance hub ---------------------------

// Per-day completed minutes + TRIMP-like load for the last n days (oldest first).
function lastDays(ctx, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const iso = addDays(ctx.today, -i);
    const done = ctx.workouts.filter((w) => w.completed && w.date === iso);
    out.push({
      iso,
      min: done.reduce((a, w) => a + (Number(w.durationMin) || 0), 0),
      load: done.reduce((a, w) => a + sessionLoad(w), 0),
    });
  }
  return out;
}

// Pixel telemetry charts: every line is a stepped path on a 2px grid (hold the
// value, then jump), dots are squares, and each plot carries dashed gridlines
// with + ticks at the corners. Returns the stroke path plus the point/scale
// geometry for fills, markers and bands.
const PAD = 4;
const snap = (v) => Math.round(v / 2) * 2;
function wavePath(vals, W, H, maxOverride) {
  const max = Math.max(1, maxOverride ?? Math.max(...vals));
  const y = (v) => snap(H - PAD - (v / max) * (H - PAD * 2));
  const x = (i) => snap(PAD + (i / Math.max(1, vals.length - 1)) * (W - PAD * 2));
  const pts = vals.map((v, i) => [x(i), y(v)]);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) d += ` H ${pts[i][0]} V ${pts[i][1]}`;
  return { d, max, x, y, pts, W, H };
}

/** A stepped band between two series (e.g. a safe-load zone). */
function stepBand(x, topY, botY, n) {
  let d = `M ${x(0)} ${topY(0)}`;
  for (let i = 1; i < n; i++) d += ` H ${x(i)} V ${topY(i)}`;
  d += ` V ${botY(n - 1)}`;
  for (let i = n - 2; i >= 0; i--) d += ` V ${botY(i + 1)} H ${x(i)} V ${botY(i)}`;
  return `${d} Z`;
}

/** Dashed gridlines at quarter heights and + ticks at the plot corners. */
function telemetryGrid(W, H) {
  const lines = [0.25, 0.5, 0.75].map((f) => {
    const gy = snap(PAD + f * (H - PAD * 2));
    return `<line class="fh-grid" x1="${PAD}" y1="${gy}" x2="${W - PAD}" y2="${gy}"/>`;
  }).join('');
  const ticks = [[PAD, PAD], [W - PAD, PAD], [PAD, H - PAD], [W - PAD, H - PAD]]
    .map(([cx, cy]) => `<path class="fh-cross" d="M ${cx - 4} ${cy} H ${cx + 4} M ${cx} ${cy - 4} V ${cy + 4}"/>`).join('');
  return lines + ticks;
}

/** A square marker (pixel dot). */
const square = (cx, cy, s, attrs = '') => `<rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" ${attrs}/>`;

/** Block bars on the 2px grid, one per value. `cls(i, v)` picks each bar's class. */
function blockBars(vals, W, H, max, cls) {
  const slot = (W - PAD * 2) / vals.length;
  const yOf = (v) => snap(H - PAD - (v / Math.max(1, max)) * (H - PAD * 2));
  return vals.map((v, i) => {
    const top = Math.min(H - PAD - 2, yOf(v));
    return `<rect class="fh-bar ${cls(i, v)}" x="${snap(PAD + i * slot)}" y="${top}" width="${Math.max(2, snap(slot) - 2)}" height="${H - PAD - top}"/>`;
  }).join('');
}

// Two-month chronological calendar matrix (previous + current month side by
// side, reference-exact). Chips colour by daily session count; today gets a
// distinct blue stroke ring + corner dot.
function monthMatrix(counts, today, year, month /* 0-based */) {
  const first = new Date(Date.UTC(year, month, 1));
  const label = first.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const startDow = (first.getUTCDay() + 6) % 7;                       // Mon = 0
  const daysIn = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const weeks = Math.ceil((startDow + daysIn) / 7);
  const head = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((L) => `<i class="cal-head">${L}</i>`).join('');
  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const dayNum = i - startDow + 1;
    if (dayNum < 1 || dayNum > daysIn) { cells += '<i class="cal-chip pad"></i>'; continue; }
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const n = counts.get(iso) || 0;
    const future = iso > today;
    const cls = future ? 'future' : n >= 3 ? 'hi' : n === 2 ? 'mid' : n === 1 ? 'lo' : '';
    cells += `<i class="cal-chip ${cls} ${iso === today ? 'is-today' : ''}"
      title="${esc(iso)} · ${n} session${n === 1 ? '' : 's'}"></i>`;
  }
  return `<div class="cal-month"><h5>${esc(label)}</h5><div class="cal-grid">${head}${cells}</div></div>`;
}

function calendarGrid(ctx) {
  const counts = new Map();
  ctx.workouts.forEach((w) => { if (w.completed) counts.set(w.date, (counts.get(w.date) || 0) + 1); });
  const d = parseISO(ctx.today);
  const y = d.getFullYear();
  const m = d.getMonth();
  const [py, pm] = m === 0 ? [y - 1, 11] : [y, m - 1];
  return `<section class="card fh-block">
    <div class="cal-months">
      ${monthMatrix(counts, ctx.today, py, pm)}
      ${monthMatrix(counts, ctx.today, y, m)}
    </div>
    <div class="cal-legend">
      <span><i class="cal-chip lo"></i> 1 activity</span>
      <span><i class="cal-chip mid"></i> 2 activities</span>
      <span><i class="cal-chip hi"></i> 3+ activities</span>
    </div>
  </section>`;
}

const STRAVA_ICO = `<svg class="strava-ico" viewBox="0 0 24 24" aria-label="Imported from Strava">
  <path fill="#FC4C02" d="M10.463 0L3.463 13.828h4.169l2.836-5.598 2.83 5.598h4.164L10.463 0zm4.924 13.828l-2.089 4.116-2.095-4.116H8.138L13.298 24l5.15-10.172h-3.061z"/></svg>`;

// Activity Summary: big hours total + orange dotted cumulative trend line.
function trendGraph(ctx) {
  const days = lastDays(ctx, 30);
  let acc = 0;
  const cum = days.map((d) => (acc += d.min));
  const { d, pts, W, H } = wavePath(cum, 320, 96);
  const area = `${d} V ${H - PAD} H ${PAD} Z`;
  const dots = pts.filter((_, i) => i % 5 === 0 || i === pts.length - 1)
    .map(([px, py], k, arr) => square(px, py, k === arr.length - 1 ? 8 : 4, `class="fh-dot ${k === arr.length - 1 ? 'end' : ''}"`)).join('');
  const h = Math.floor(acc / 60);
  const m = Math.round(acc % 60);
  return `<section class="card fh-block fh-tap" data-fh-activity role="button" tabindex="0">
    <h4>Activity summary <span class="fh-arrow">${svg('chevron')}</span></h4>
    <div class="fh-big data-num">${h}<small class="data-unit">h</small> ${m}<small class="data-unit">m</small></div>
    <div class="fh-range">${esc(shortLabel(days[0].iso))} – ${esc(shortLabel(ctx.today))}</div>
    <svg class="fh-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      ${telemetryGrid(W, H)}
      <path class="fh-area" d="${area}" fill="var(--acc-orange)"/>
      <path class="fh-line" d="${d}" stroke="var(--acc-orange)"/>
      ${dots}
    </svg>
  </section>`;
}

// Strain Performance: big ±% vs baseline on the left, colourful waveform right.
function strainWave(ctx) {
  const days = lastDays(ctx, 14);
  const loads = days.map((d) => d.load);
  const cs = cardioState(ctx);
  const pct = cs.zone === 'unknown' ? null : Math.round((cs.ratio - 1) * 100);
  const [label, color] = pct == null ? ['Calibrating', 'var(--muted)']
    : pct < -10 ? ['Below target', 'var(--acc-peri)']
    : pct > 10 ? ['Above target', 'var(--acc-orange)']
    : ['On target', 'var(--acc-green)'];
  const W = 210;
  const H = 96;
  const avg = loads.reduce((a, b) => a + b, 0) / Math.max(1, loads.length);
  const max = Math.max(1, ...loads, avg * 1.3);
  const y = (v) => snap(H - PAD - (v / max) * (H - PAD * 2));
  const bandTop = y(avg * 1.25);
  const bandBot = y(avg * 0.75);
  // one block per day: inside the ±25% band green, above orange, below violet
  const bars = blockBars(loads, W, H, max, (i, v) => (!v ? 'zero' : v > avg * 1.25 ? 'over' : v < avg * 0.75 ? 'under' : 'in'));
  return `<section class="card fh-block">
    <h4>Strain Performance</h4>
    <div class="fh-strain">
      <div class="fh-strain-stat">
        <div class="fh-big" style="color:${color}">${pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct}%`}</div>
        <div class="fh-strain-lbl" style="color:${color}">${label}</div>
      </div>
      <svg class="fh-svg fh-strain-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        ${telemetryGrid(W, H)}
        <rect class="fh-band" x="${PAD}" y="${bandTop}" width="${W - PAD * 2}" height="${Math.max(2, bandBot - bandTop)}"/>
        ${bars}
      </svg>
    </div>
  </section>`;
}

// Trophy cabinet: every badge on pixel shelves, four to a shelf. Earned ones are
// lit gold on a plinth; locked ones are dark silhouettes. Tapping one shows how
// to earn it in the line under the shelves.
function trophyCabinet(ctx) {
  const earned = new Set(evaluateBadges(ctx.workouts, ctx.today));
  const shelves = [];
  for (let i = 0; i < BADGES.length; i += 4) shelves.push(BADGES.slice(i, i + 4));
  const cup = (b) => {
    const on = earned.has(b.id);
    return `<button class="tc-cup ${on ? 'is-on' : 'is-off'}" data-tc="${esc(b.id)}" aria-pressed="false"
        aria-label="${esc(`${b.name}: ${on ? 'earned' : 'locked'}`)}">
        <span class="tc-ico">${svg(b.icon)}</span><span class="tc-plinth" aria-hidden="true"></span></button>`;
  };
  return `<section class="card fh-block tc">
    <h4>Trophy cabinet <span class="tc-count"><span class="data-num">${earned.size}</span> / ${BADGES.length}</span></h4>
    ${shelves.map((row) => `<div class="tc-shelf">${row.map(cup).join('')}</div>`).join('')}
    <p class="tc-info" aria-live="polite">Tap a trophy to see how to earn it.</p>
  </section>`;
}

function wireTrophies(root, ctx) {
  const info = root.querySelector('.tc-info');
  if (!info) return;
  const earned = new Set(evaluateBadges(ctx.workouts, ctx.today));
  root.querySelectorAll('[data-tc]').forEach((btn) => btn.addEventListener('click', () => {
    const b = BADGES.find((x) => x.id === btn.dataset.tc);
    if (!b) return;
    root.querySelectorAll('[data-tc]').forEach((o) => o.setAttribute('aria-pressed', String(o === btn)));
    info.innerHTML = `<b>${esc(b.name)}</b> ${earned.has(b.id) ? `<span class="tag good">Earned</span>` : `<span class="tag">Locked</span>`}<br>${esc(b.desc)}.`;
  }));
}

// Acute:chronic ratio → a named cardio status (WHOOP-style vocabulary).
const CARDIO_STATUSES = ['Calibrating', 'Detraining', 'Maintaining', 'Productive', 'Peaking', 'Fatigued'];
const STATUS_COLOR = {
  Calibrating: '#9AA0A8', Detraining: '#E8A54B', Maintaining: '#B4A6EF',
  Productive: '#63C97B', Peaking: '#4FB8E8', Fatigued: '#E06A6A',
};
function cardioStateAt(workouts, iso) {
  const a = acwr(workouts, iso);
  const r = a.ratio;
  const status = a.zone === 'unknown' ? 'Calibrating'
    : r < 0.8 ? 'Detraining' : r < 1.0 ? 'Maintaining'
    : r <= 1.3 ? 'Productive' : r <= 1.5 ? 'Peaking' : 'Fatigued';
  return { ...a, status };
}
const cardioState = (ctx) => cardioStateAt(ctx.workouts, ctx.today);

// Hub entry card: big load number + coloured status + purple mini wave.
function cardioCard(ctx) {
  const cs = cardioState(ctx);
  const thisMonday = mondayOf(ctx.today);
  const hrs = Array.from({ length: 12 }, (_, i) => weekHours(ctx.workouts, addDays(thisMonday, -7 * (11 - i))));
  const W = 190;
  const H = 72;
  // twelve weeks of hours as blocks; this week takes the status colour
  const bars = blockBars(hrs, W, H, Math.max(1, ...hrs), (i, v) => (i === hrs.length - 1 ? 'now' : v ? 'wk' : 'zero'));
  return `<button class="card fh-block fh-cardio" data-fh-cardio>
    <div class="fh-cardio-body">
      <small>Cardio Load</small>
      <b class="fh-big">${cs.acute}</b>
      <span class="fh-status" style="color:${STATUS_COLOR[cs.status]}">${esc(cs.status)}</span>
    </div>
    <svg class="fh-cardio-mini" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <g style="--now:${STATUS_COLOR[cs.status]}">${bars}</g>
    </svg>
    <span class="fh-chev">${svg('chevron')}</span>
  </button>`;
}

// Account & sync controls (mirrors the top of Settings) + the settings entry.
function accountBlock() {
  const u = currentUser?.();
  return `<section class="card fh-block">
    <h4>Account &amp; Sync</h4>
    ${u
      ? `<div class="fh-acct">
           <div class="fh-acct-id"><b>${esc(u.email || 'Signed in')}</b><small>${svg('cloud')} Syncing across devices</small></div>
           <button class="btn tiny ghost danger" data-action="hub-signout">Sign out</button>
         </div>
         <div class="fh-strava-row">
           <button class="btn tiny ghost" data-action="hub-strava-connect">${svg('link')} Connect Strava</button>
           <button class="btn tiny ghost" data-action="hub-strava-sync">${svg('sync')} Sync now</button>
           <button class="btn tiny ghost danger" data-action="hub-strava-disconnect">Disconnect</button>
         </div>
         <div class="powered-by-strava">Powered by Strava</div>`
      : `<button class="btn primary block" data-action="open-auth">${svg('cloud')} Sign in to sync</button>`}
    <button class="btn ghost block fh-settings" data-action="open-settings">${svg('gear')} All settings</button>
  </section>`;
}

/** Activity history drill-down: trend graph + recent sessions (Strava-badged). */
export function openActivityDetail(ctx) {
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  const recent = ctx.workouts.filter((w) => w.completed)
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
  const rows = recent.map((w) => {
    const km = Number(w.metrics?.distanceKm) || Number(w.actual?.distanceKm) || 0;
    const meta = [shortLabel(w.date), `${w.durationMin || 0} min`, km ? `${km % 1 ? km.toFixed(1) : km} km` : '']
      .filter(Boolean).join(' · ');
    return `<div class="ah-row" data-action="open-workout" data-id="${esc(w.id)}" role="button" tabindex="0">
      <span class="sport-dot type-${esc(w.type)}"></span>
      <div class="ah-body"><b>${esc(w.title || w.type)}</b><small>${esc(meta)}</small></div>
      ${w.strava_activity_id || w.source === 'strava' ? STRAVA_ICO : ''}
    </div>`;
  }).join('') || '<p class="fh-foot">No completed sessions yet.</p>';

  root.innerHTML = `
  <div class="fh-screen" role="dialog" aria-modal="true" aria-label="Activity history">
    <div class="fh-head">
      <button class="fh-back" data-fh-hub aria-label="Back to fitness">${svg('back')}</button>
      <div class="fh-title"><small>Last 30 days</small><h2>Activity</h2></div>
    </div>
    ${trendGraph(ctx)}
    <section class="card fh-block">
      <h4>History</h4>
      <div class="ah-list">${rows}</div>
    </section>
  </div>`;
  root.querySelector('[data-fh-hub]').addEventListener('click', () => openFitnessHub(ctx));
  // the inner trend card is not a drill-down here
  root.querySelector('[data-fh-activity]')?.removeAttribute('data-fh-activity');
}

function statRow(ctx) {
  const stat = (value, label, cls = '') => `<div class="pc-stat ${cls}"><b>${esc(String(value))}</b><small>${esc(label)}</small></div>`;
  const acct = ctx.acct;
  return `<div class="pc-stats fh-stats">
    ${stat(acct ? `LVL ${acct.level}` : `LVL ${ctx.stats?.level ?? 1}`, acct ? `${acct.questXp.toLocaleString()} quest XP` : 'Level', 'acct')}
    ${stat((ctx.stats?.completedCount ?? 0).toLocaleString(), 'Workouts')}
    ${stat(`${ctx.streaks?.current ?? 0} d`, 'Streak')}
    ${stat(accountAge(ctx), 'Account age')}
  </div>`;
}

function closeHub() {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  root.classList.remove('open');
}

// Photo upload: pick → centre-crop to 192px JPEG → persist in settings
// (synced to Supabase profiles.settings when signed in).
function wireAvatarUpload(root) {
  const fileInput = root.querySelector('[data-pc-file]');
  const btn = root.querySelector('[data-pc-photo]');
  if (!fileInput || !btn) return;
  btn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const S = 192;
      const c = document.createElement('canvas');
      c.width = S; c.height = S;
      const g = c.getContext('2d');
      const side = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
      URL.revokeObjectURL(img.src);
      const url = c.toDataURL('image/jpeg', 0.85);
      store.setSetting('avatar', url);            // persists + syncs + re-renders header
      btn.innerHTML = `<img src="${url}" alt="">`;
    };
    img.src = URL.createObjectURL(f);
  });
}

/** Layer A — the full-bleed Fitness Hub (replaces the old profile modal). */
export function openFitnessHub(ctx) {
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  const name = athleteName();

  root.innerHTML = `
  <div class="fh-screen" role="dialog" aria-modal="true" aria-label="Fitness dashboard">
    <div class="fh-head">
      <button class="fh-back" data-fh-close aria-label="Back">${svg('back')}</button>
      <div class="fh-title"><small>Last 30 days</small><h2>Fitness</h2></div>
      <button class="fh-avatar" data-pc-photo aria-label="Change profile photo">${avatarInner(ctx, esc((name || 'A').charAt(0).toUpperCase()))}</button>
      <input type="file" accept="image/*" data-pc-file hidden>
    </div>
    ${accountBlock()}
    ${statRow(ctx)}
    ${calendarGrid(ctx)}
    ${trendGraph(ctx)}
    ${strainWave(ctx)}
    ${cardioCard(ctx)}
    ${trophyCabinet(ctx)}
  </div>`;

  root.querySelector('[data-fh-close]').addEventListener('click', closeHub);
  wireTrophies(root, ctx);
  root.querySelector('[data-fh-cardio]').addEventListener('click', () => openCardioDetail(ctx));
  root.querySelector('[data-fh-activity]')?.addEventListener('click', () => openActivityDetail(ctx));
  wireAvatarUpload(root);
}

/** Public athlete dashboard: the same full-bleed fitness view, rendered from a
 *  leaderboard athlete's aggregated public data (per-day counts + minutes).
 *  The back arrow returns to the leaderboard underneath. */
export async function openPublicFitness({ uid, name, avatar, xp }) {
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  const avatarHtml = avatar
    ? `<img src="${esc(avatar)}" alt="">`
    : esc((name || 'A').trim().charAt(0).toUpperCase());
  const shell = (body) => `
  <div class="fh-screen" role="dialog" aria-modal="true" aria-label="Athlete profile">
    <div class="fh-head">
      <button class="fh-back" data-fh-close aria-label="Back to leaderboard">${svg('back')}</button>
      <div class="fh-title"><small>Athlete</small><h2>${esc(name || 'Athlete')}</h2></div>
      <span class="fh-avatar" aria-hidden="true">${avatarHtml}</span>
    </div>
    ${body}
  </div>`;
  const wireBack = () => root.querySelector('[data-fh-close]').addEventListener('click', closeHub);
  // loading tiles in the shape of the stats, calendar and charts below
  const skStat = (i) => `<div class="pc-stat is-sk" style="--sk-i:${i}"><b><i class="sk-line" style="width:3ch"></i></b><small><i class="sk-line" style="width:60%"></i></small></div>`;
  root.innerHTML = shell(`<span class="sr">Loading athlete data…</span>
    <div class="pc-stats fh-stats" aria-hidden="true">${[0, 1, 2, 3].map(skStat).join('')}</div>
    <div class="fh-sk-block sk-tile" aria-hidden="true" style="--sk-i:4"></div>
    <div class="fh-sk-block short sk-tile" aria-hidden="true" style="--sk-i:5"></div>`);
  wireBack();

  try {
    const { fetchPublicUserProfile } = await import('./profile.js');
    const p = await fetchPublicUserProfile(uid);
    const today = todayISO();
    // Expand per-day aggregates into pseudo-workouts the chart helpers understand.
    const workouts = (p.days || []).flatMap((d) => {
      const n = Math.max(1, Number(d.n) || 1);
      const per = Math.round((Number(d.min) || 0) / n);
      return Array.from({ length: n }, () => ({
        date: d.date, completed: true, durationMin: per, intensity: 'steady', type: 'other', metrics: {},
      }));
    });
    const ctx = { today, workouts };
    const streaks = computeStreaks(workouts, today);
    const level = levelFromTotalXp(Number(xp) || 0).level;
    const stat = (v, l) => `<div class="pc-stat"><b>${esc(String(v))}</b><small>${esc(l)}</small></div>`;
    root.innerHTML = shell(`
      <div class="pc-stats fh-stats">
        ${stat(Number(p.completed || 0).toLocaleString(), 'Workouts')}
        ${stat(`${streaks.current} d`, 'Streak')}
        ${stat(((Number(p.total_min) || 0) / 60).toFixed(1), 'Hours')}
        ${stat(level, 'Level')}
      </div>
      ${calendarGrid(ctx)}
      ${trendGraph(ctx)}
      ${strainWave(ctx)}`);
    wireBack();
    // this view is read-only: the trend card is not a drill-down here
    root.querySelector('[data-fh-activity]')?.removeAttribute('data-fh-activity');
  } catch (e) {
    root.innerHTML = shell('<p class="fh-foot">Couldn’t load this athlete — check your connection.</p>');
    wireBack();
  }
}

/** Layer B — Cardio Load drill-down: acute-load line inside the safe-zone band,
 *  per-day status dots, and a Status Breakdown table (days · bar · %). */
export function openCardioDetail(ctx) {
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  const cs = cardioState(ctx);
  const N = 30;
  const W = 320;
  const H = 130;

  // Per-day acute load + status over the last 30 days.
  const series = [];
  for (let i = N - 1; i >= 0; i--) {
    const iso = addDays(ctx.today, -i);
    series.push({ iso, ...cardioStateAt(ctx.workouts, iso) });
  }
  const maxVal = Math.max(1, ...series.map((s) => Math.max(s.acute, s.chronicWeekly * 1.3)));
  const { d, x, y, pts } = wavePath(series.map((s) => s.acute), W, H, maxVal);

  // Purple "sweet spot" band: 0.8–1.3 × that day's chronic weekly load.
  const band = stepBand(x, (i) => y(series[i].chronicWeekly * 1.3), (i) => y(series[i].chronicWeekly * 0.8), series.length);

  const dots = pts.map(([px, py], i) => (i % 2 === 0 || i === pts.length - 1)
    ? square(px, py, i === pts.length - 1 ? 8 : 4, `fill="${STATUS_COLOR[series[i].status]}"`) : '').join('');

  // Breakdown table: days spent in each status across the window.
  const counts = {};
  series.forEach((s) => { counts[s.status] = (counts[s.status] || 0) + 1; });
  const rows = CARDIO_STATUSES.map((label) => {
    const n = counts[label] || 0;
    const pct = Math.round((n / N) * 100);
    return `<div class="cs-row ${label === cs.status ? 'on' : ''}">
      <b style="color:${label === cs.status ? '#fff' : 'inherit'}">${esc(label)}</b>
      <span class="cs-days">${n}d</span>
      <span class="cs-bar"><i class="cs-fill" style="width:${pct}%;background:${STATUS_COLOR[label]}"></i></span>
      <span class="cs-pct">${pct}%</span>
    </div>`;
  }).join('');

  root.innerHTML = `
  <div class="fh-screen" role="dialog" aria-modal="true" aria-label="Cardio load">
    <div class="fh-head">
      <button class="fh-back" data-fh-hub aria-label="Back to fitness">${svg('back')}</button>
      <div class="fh-title"><small>Last 30 days</small><h2>Cardio Load</h2></div>
    </div>
    <section class="card fh-block">
      <div class="fh-cardio-body" style="margin-bottom:10px">
        <b class="fh-big">${cs.acute}</b>
        <span class="fh-status" style="color:${STATUS_COLOR[cs.status]}">${esc(cs.status)}</span>
      </div>
      <svg class="fh-svg" viewBox="0 0 ${W} ${H}" aria-hidden="true">
        ${telemetryGrid(W, H)}
        <path d="${band}" fill="var(--acc-purple)" opacity=".3"/>
        <path class="fh-line" d="${d}" stroke="var(--acc-peri)"/>
        ${dots}
      </svg>
      <p class="fh-foot">${esc(shortLabel(series[0].iso))} – ${esc(shortLabel(ctx.today))} · band = your safe-load zone</p>
    </section>
    <section class="card fh-block">
      <h4>Cardio Status Breakdown</h4>
      <div class="cs-list">${rows}</div>
    </section>
  </div>`;

  root.querySelector('[data-fh-hub]').addEventListener('click', () => openFitnessHub(ctx));
}
