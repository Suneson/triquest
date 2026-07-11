// profile-game.js — the Profile tab as a full-screen, level-reactive "video game"
// environment for Cycling. Three stacked layers (background / platform / animated
// character) swap instantly with the athlete's bike level. The other sports are
// stubbed (work-in-progress). The avatar opens the full-screen Fitness & Cardio
// performance hub (activity calendar, trend, strain, cardio drill-down).

import { sportProgress } from '../core/scoring.js';
import { sessionLoad, acwr, weekHours } from '../core/load.js';
import { svg } from '../core/icons.js';
import { esc, mondayOf } from './ui.js';
import { addDays } from '../core/dates.js';
import { currentUser } from './auth.js';
import * as store from './store.js';

// Circular avatar slot: uploaded photo if set, otherwise the initial letter.
function avatarInner(ctx, initial) {
  const src = ctx?.settings?.avatar;
  return src ? `<img src="${esc(src)}" alt="">` : initial;
}

const BIKE = 'icons/Pixelart/BIKE';

// Platform filenames carry an inverted middle index: Level 1 → _0009_, Level 10 → _0000_.
function platformFile(level) {
  return `BIKE1BLUE_${String(10 - level).padStart(4, '0')}_Layer-${level}.png`;
}

function athleteName() {
  const u = currentUser?.();
  return (u?.user_metadata?.display_name || u?.email?.split('@')[0] || 'Athlete').trim();
}

// ---- main full-screen view --------------------------------------------------

export function renderProfileGame(ctx) {
  const p = sportProgress(ctx.workouts, 'bike');
  const real = p.level;
  const level = Math.max(1, Math.min(10, real));   // 10 art frames available
  const maxed = real >= 10;
  const pct = maxed ? 100 : Math.round(p.progress * 100);
  const initial = esc((athleteName() || 'A').charAt(0).toUpperCase());

  const sportBtn = (sport, ico, label, active) =>
    `<button class="pg-sport ${active ? 'active' : ''}" data-action="pg-sport" data-sport="${sport}"${active ? ' aria-current="true"' : ''}>
       ${svg(ico, 'tint')}<span>${label}</span></button>`;

  return `
  <section class="pg-screen">
    <div class="pg-world">
      <img class="pg-layer pg-bg" src="${BIKE}/BACKGROUND/background.png" alt="" aria-hidden="true">
      <img class="pg-layer pg-platform" src="${BIKE}/PLATFORMS/${platformFile(level)}" alt="" aria-hidden="true">
      <img class="pg-char" src="${BIKE}/CHARACTERS/bikelvl${level}_char.webp" alt="Cycling level ${level} character">
    </div>

    <div class="pg-topbar">
      <div class="pg-sports">
        ${sportBtn('bike', 'bike', 'Cycling', true)}
        ${sportBtn('swim', 'swim', 'Swim', false)}
        ${sportBtn('run', 'run', 'Run', false)}
        ${sportBtn('gym', 'gym', 'Gym', false)}
      </div>
      <button class="pg-avatar" data-action="pg-profile" aria-label="Open profile">${avatarInner(ctx, initial)}</button>
    </div>

    <div class="pg-hud">
      <div class="pg-hud-top">
        <span class="pg-sport-name">${svg('bike', 'tint')} Cycling</span>
        <span class="pg-level-badge">${maxed ? 'MAX · ' : ''}Level ${real}</span>
      </div>
      <div class="pg-xpbar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="pg-xpfill" style="width:${pct}%"></div>
      </div>
      <div class="pg-xptext">${maxed
        ? 'Max level reached — legend status'
        : `${p.into.toLocaleString()} / ${p.span.toLocaleString()} XP · ${p.toNext.toLocaleString()} to Level ${level + 1}`}</div>
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
  if (days < 1) return 'Today';
  if (days < 31) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 365) { const m = Math.round(days / 30); return `${m} month${m === 1 ? '' : 's'}`; }
  const y = (days / 365).toFixed(1);
  return `${y} years`;
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

// Smooth SVG wave path through values (quadratic midpoint smoothing).
// Returns the stroke path plus geometry for area fills / target lines.
const PAD = 4;
function wavePath(vals, W, H) {
  const max = Math.max(1, ...vals);
  const y = (v) => H - PAD - (v / max) * (H - PAD * 2);
  const x = (i) => PAD + (i / Math.max(1, vals.length - 1)) * (W - PAD * 2);
  let d = `M ${x(0)} ${y(vals[0]).toFixed(1)}`;
  for (let i = 1; i < vals.length; i++) {
    const mx = ((x(i - 1) + x(i)) / 2).toFixed(1);
    const my = ((y(vals[i - 1]) + y(vals[i])) / 2).toFixed(1);
    d += ` Q ${x(i - 1).toFixed(1)} ${y(vals[i - 1]).toFixed(1)} ${mx} ${my}`;
  }
  d += ` L ${x(vals.length - 1).toFixed(1)} ${y(vals[vals.length - 1]).toFixed(1)}`;
  return { d, max, y, W, H };
}

// 30-day chronological matrix: micro-chips coloured by that day's volume.
function calendarGrid(ctx) {
  const days = lastDays(ctx, 30);
  const active = days.filter((d) => d.min > 0).length;
  const chips = days.map((d) => {
    const cls = d.min <= 0 ? '' : d.min < 45 ? 'lo' : d.min < 90 ? 'mid' : 'hi';
    return `<i class="cal-chip ${cls}" title="${esc(d.iso)}${d.min ? ` · ${d.min} min` : ' · rest'}"></i>`;
  }).join('');
  return `<section class="card fh-block">
    <h4>Activity · last 30 days</h4>
    <div class="cal-grid">${chips}</div>
    <div class="cal-legend">
      <span><i class="cal-chip lo"></i> light</span>
      <span><i class="cal-chip mid"></i> solid</span>
      <span><i class="cal-chip hi"></i> big day</span>
      <span style="margin-left:auto">${active} active days</span>
    </div>
  </section>`;
}

// Cumulative training-time trend over the last 30 days.
function trendGraph(ctx) {
  const days = lastDays(ctx, 30);
  let acc = 0;
  const cum = days.map((d) => (acc += d.min));
  const { d } = wavePath(cum, 320, 90);
  return `<section class="card fh-block">
    <h4>Activity summary</h4>
    <svg class="fh-svg" viewBox="0 0 320 90" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="fh-trend" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="var(--ring-mint-a)"/><stop offset="1" stop-color="var(--ring-indigo-a)"/></linearGradient></defs>
      <path class="fh-line" d="${d}" stroke="url(#fh-trend)"/>
    </svg>
    <p class="fh-foot">${(acc / 60).toFixed(1)} h of cumulative training over 30 days</p>
  </section>`;
}

// 14-day strain wave vs the average-load target line.
function strainWave(ctx) {
  const days = lastDays(ctx, 14);
  const loads = days.map((d) => d.load);
  const { d, y, W, H } = wavePath(loads, 320, 90);
  const avg = loads.reduce((a, b) => a + b, 0) / loads.length;
  const area = `${d} L ${W - PAD} ${H - PAD} L ${PAD} ${H - PAD} Z`;
  return `<section class="card fh-block">
    <h4>Strain · 14-day load</h4>
    <svg class="fh-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="fh-strain" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="var(--ring-lime-a)"/><stop offset="1" stop-color="var(--ring-lime-b)"/></linearGradient></defs>
      <path class="fh-area" d="${area}" fill="url(#fh-strain)"/>
      <path class="fh-line" d="${d}" stroke="url(#fh-strain)"/>
      <line class="fh-target" x1="${PAD}" x2="${W - PAD}" y1="${y(avg).toFixed(1)}" y2="${y(avg).toFixed(1)}"/>
    </svg>
    <p class="fh-foot">Daily load vs your 2-week average (dashed target)</p>
  </section>`;
}

// Acute:chronic ratio → a named cardio status.
const CARDIO_STATUSES = [
  ['Calibrating', 'Not enough history yet — keep logging sessions.'],
  ['Detraining', 'Load well below your baseline — fitness is slipping.'],
  ['Maintaining', 'Holding steady just under baseline.'],
  ['Productive', 'The sweet spot — building fitness sustainably.'],
  ['Peaking', 'Load pushed above baseline — race-sharp but watch fatigue.'],
  ['Fatigued', 'Load spiking past safe range — back off and recover.'],
];
function cardioState(ctx) {
  const a = acwr(ctx.workouts, ctx.today);
  const r = a.ratio;
  const status = a.zone === 'unknown' ? 'Calibrating'
    : r < 0.8 ? 'Detraining' : r < 1.0 ? 'Maintaining'
    : r <= 1.3 ? 'Productive' : r <= 1.5 ? 'Peaking' : 'Fatigued';
  return { ...a, status };
}

function statRow(ctx) {
  const stat = (value, label) => `<div class="pc-stat"><b>${esc(String(value))}</b><small>${esc(label)}</small></div>`;
  return `<div class="pc-stats fh-stats">
    ${stat((ctx.stats?.completedCount ?? 0).toLocaleString(), 'Workouts')}
    ${stat(`${ctx.streaks?.current ?? 0} d`, 'Streak')}
    ${stat(accountAge(ctx), 'Account age')}
    ${stat(ctx.stats?.level ?? 1, 'Level')}
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
  const cs = cardioState(ctx);

  root.innerHTML = `
  <div class="fh-screen" role="dialog" aria-modal="true" aria-label="Fitness dashboard">
    <div class="fh-head">
      <button class="fh-back" data-fh-close aria-label="Back">←</button>
      <div class="fh-title"><small>Performance</small><h2>${esc(name)}</h2></div>
      <button class="fh-avatar" data-pc-photo aria-label="Change profile photo">${avatarInner(ctx, esc((name || 'A').charAt(0).toUpperCase()))}</button>
      <input type="file" accept="image/*" data-pc-file hidden>
    </div>
    ${statRow(ctx)}
    ${calendarGrid(ctx)}
    ${trendGraph(ctx)}
    ${strainWave(ctx)}
    <button class="card fh-block fh-cardio" data-fh-cardio>
      <div class="fh-cardio-body"><small>Cardio Load</small><b>${esc(cs.status)}</b></div>
      <span class="fh-chev">›</span>
    </button>
  </div>`;

  root.querySelector('[data-fh-close]').addEventListener('click', closeHub);
  root.querySelector('[data-fh-cardio]').addEventListener('click', () => openCardioDetail(ctx));
  wireAvatarUpload(root);
}

/** Layer B — the Cardio Load drill-down: 12-week history + status breakdown. */
export function openCardioDetail(ctx) {
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  const cs = cardioState(ctx);

  // Weekly training hours over the last 12 Monday-anchored weeks.
  const thisMonday = mondayOf(ctx.today);
  const hours = Array.from({ length: 12 }, (_, i) => weekHours(ctx.workouts, addDays(thisMonday, -7 * (11 - i))));
  const { d, y, W, H } = wavePath(hours, 320, 100);
  const area = `${d} L ${W - PAD} ${H - PAD} L ${PAD} ${H - PAD} Z`;

  const rows = CARDIO_STATUSES.map(([label, desc]) =>
    `<div class="cs-row ${label === cs.status ? 'on' : ''}"><b>${esc(label)}</b><span>${esc(desc)}</span></div>`).join('');

  root.innerHTML = `
  <div class="fh-screen" role="dialog" aria-modal="true" aria-label="Cardio load">
    <div class="fh-head">
      <button class="fh-back" data-fh-hub aria-label="Back to fitness">←</button>
      <div class="fh-title"><small>Drill-down</small><h2>Cardio Load</h2></div>
    </div>
    <section class="card fh-block">
      <h4>Weekly hours · last 12 weeks</h4>
      <svg class="fh-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="fh-cardio-g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="var(--ring-indigo-a)"/><stop offset="1" stop-color="var(--ring-mint-a)"/></linearGradient></defs>
        <path class="fh-area" d="${area}" fill="url(#fh-cardio-g)"/>
        <path class="fh-line" d="${d}" stroke="url(#fh-cardio-g)"/>
      </svg>
      <p class="fh-foot">Acute ${cs.acute} · chronic ${cs.chronicWeekly}/wk · ratio ${cs.ratio || '—'}</p>
    </section>
    <section class="card fh-block">
      <h4>Cardio Status Breakdown</h4>
      <div class="cs-list">${rows}</div>
    </section>
  </div>`;

  root.querySelector('[data-fh-hub]').addEventListener('click', () => openFitnessHub(ctx));
}
