// profile-game.js — the Profile tab as a full-screen, level-reactive "video game"
// environment for Cycling. Three stacked layers (background / platform / animated
// character) swap instantly with the athlete's bike level. The other sports are
// stubbed (work-in-progress). The avatar opens the full-screen Fitness & Cardio
// performance hub (activity calendar, trend, strain, cardio drill-down).

import { sportProgress } from '../core/scoring.js';
import { sessionLoad, acwr, weekHours } from '../core/load.js';
import { svg } from '../core/icons.js';
import { esc, mondayOf } from './ui.js';
import { addDays, parseISO, shortLabel } from '../core/dates.js';
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
// Returns the stroke path plus point/scale geometry for fills, dots and bands.
const PAD = 4;
function wavePath(vals, W, H, maxOverride) {
  const max = Math.max(1, maxOverride ?? Math.max(...vals));
  const y = (v) => H - PAD - (v / max) * (H - PAD * 2);
  const x = (i) => PAD + (i / Math.max(1, vals.length - 1)) * (W - PAD * 2);
  const pts = vals.map((v, i) => [x(i), y(v)]);
  let d = `M ${x(0)} ${y(vals[0]).toFixed(1)}`;
  for (let i = 1; i < vals.length; i++) {
    const mx = ((x(i - 1) + x(i)) / 2).toFixed(1);
    const my = ((y(vals[i - 1]) + y(vals[i])) / 2).toFixed(1);
    d += ` Q ${x(i - 1).toFixed(1)} ${y(vals[i - 1]).toFixed(1)} ${mx} ${my}`;
  }
  d += ` L ${x(vals.length - 1).toFixed(1)} ${y(vals[vals.length - 1]).toFixed(1)}`;
  return { d, max, x, y, pts, W, H };
}

// Calendar-aligned activity matrix: 5 Monday-anchored weeks, chips coloured by
// how many sessions were completed that day (1 / 2 / 3+, like the reference).
function calendarGrid(ctx) {
  const start = addDays(mondayOf(ctx.today), -28);
  const head = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((L) => `<i class="cal-head">${L}</i>`).join('');
  const chips = Array.from({ length: 35 }, (_, i) => {
    const iso = addDays(start, i);
    const n = ctx.workouts.filter((w) => w.completed && w.date === iso).length;
    const future = iso > ctx.today;
    const cls = future ? 'future' : n >= 3 ? 'hi' : n === 2 ? 'mid' : n === 1 ? 'lo' : '';
    return `<i class="cal-chip ${cls} ${iso === ctx.today ? 'is-today' : ''}"
      title="${esc(iso)} · ${n} session${n === 1 ? '' : 's'}"></i>`;
  }).join('');
  const mA = parseISO(start).toLocaleDateString('en-GB', { month: 'short' });
  const mB = parseISO(ctx.today).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  return `<section class="card fh-block">
    <h4>Activity · ${esc(mA)} – ${esc(mB)}</h4>
    <div class="cal-grid">${head}${chips}</div>
    <div class="cal-legend">
      <span><i class="cal-chip lo"></i> 1 activity</span>
      <span><i class="cal-chip mid"></i> 2 activities</span>
      <span><i class="cal-chip hi"></i> 3+ activities</span>
    </div>
  </section>`;
}

// Activity Summary: big hours total + orange dotted cumulative trend line.
function trendGraph(ctx) {
  const days = lastDays(ctx, 30);
  let acc = 0;
  const cum = days.map((d) => (acc += d.min));
  const { d, pts, W, H } = wavePath(cum, 320, 96);
  const area = `${d} L ${W - PAD} ${H - PAD} L ${PAD} ${H - PAD} Z`;
  const dots = pts.filter((_, i) => i % 5 === 0 || i === pts.length - 1)
    .map(([px, py], k, arr) => `<circle class="fh-dot ${k === arr.length - 1 ? 'end' : ''}"
      cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${k === arr.length - 1 ? 4.5 : 3}"/>`).join('');
  const h = Math.floor(acc / 60);
  const m = Math.round(acc % 60);
  return `<section class="card fh-block">
    <h4>Activity Summary</h4>
    <div class="fh-big">${h}h ${m}m</div>
    <div class="fh-range">${esc(shortLabel(days[0].iso))} – ${esc(shortLabel(ctx.today))}</div>
    <svg class="fh-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
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
  const { d, y, W, H } = wavePath(loads, 210, 96);
  const avg = loads.reduce((a, b) => a + b, 0) / Math.max(1, loads.length);
  const bandTop = y(avg * 1.25).toFixed(1);
  const bandBot = y(avg * 0.75).toFixed(1);
  return `<section class="card fh-block">
    <h4>Strain Performance</h4>
    <div class="fh-strain">
      <div class="fh-strain-stat">
        <div class="fh-big" style="color:${color}">${pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct}%`}</div>
        <div class="fh-strain-lbl" style="color:${color}">${label}</div>
      </div>
      <svg class="fh-svg fh-strain-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <rect x="${PAD}" y="${bandTop}" width="${W - PAD * 2}" height="${Math.max(2, bandBot - bandTop).toFixed(1)}"
          rx="3" fill="var(--acc-green)" opacity=".16"/>
        <path class="fh-line" d="${d}" stroke="var(--acc-orange)"/>
      </svg>
    </div>
  </section>`;
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
  const { d, pts, W, H } = wavePath(hrs, 190, 72);
  const area = `${d} L ${W - PAD} ${H - PAD} L ${PAD} ${H - PAD} Z`;
  const [ex, ey] = pts[pts.length - 1];
  return `<button class="card fh-block fh-cardio" data-fh-cardio>
    <div class="fh-cardio-body">
      <small>Cardio Load</small>
      <b class="fh-big">${cs.acute}</b>
      <span class="fh-status" style="color:${STATUS_COLOR[cs.status]}">${esc(cs.status)}</span>
    </div>
    <svg class="fh-cardio-mini" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${area}" fill="var(--acc-purple)" opacity=".28"/>
      <path class="fh-line" d="${d}" stroke="var(--acc-peri)"/>
      <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="4" fill="${STATUS_COLOR[cs.status]}" stroke="var(--bg-2)" stroke-width="1.5"/>
    </svg>
    <span class="fh-chev">→</span>
  </button>`;
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

  root.innerHTML = `
  <div class="fh-screen" role="dialog" aria-modal="true" aria-label="Fitness dashboard">
    <div class="fh-head">
      <button class="fh-back" data-fh-close aria-label="Back">←</button>
      <div class="fh-title"><small>Last 30 days</small><h2>Fitness</h2></div>
      <button class="fh-avatar" data-pc-photo aria-label="Change profile photo">${avatarInner(ctx, esc((name || 'A').charAt(0).toUpperCase()))}</button>
      <input type="file" accept="image/*" data-pc-file hidden>
    </div>
    ${statRow(ctx)}
    ${calendarGrid(ctx)}
    ${trendGraph(ctx)}
    ${strainWave(ctx)}
    ${cardioCard(ctx)}
  </div>`;

  root.querySelector('[data-fh-close]').addEventListener('click', closeHub);
  root.querySelector('[data-fh-cardio]').addEventListener('click', () => openCardioDetail(ctx));
  wireAvatarUpload(root);
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
  const top = series.map((s, i) => `${x(i).toFixed(1)} ${y(s.chronicWeekly * 1.3).toFixed(1)}`);
  const bot = series.map((s, i) => `${x(i).toFixed(1)} ${y(s.chronicWeekly * 0.8).toFixed(1)}`).reverse();
  const band = `M ${top.join(' L ')} L ${bot.join(' L ')} Z`;

  const dots = pts.map(([px, py], i) => (i % 2 === 0 || i === pts.length - 1)
    ? `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${i === pts.length - 1 ? 4 : 2.6}"
        fill="${STATUS_COLOR[series[i].status]}" stroke="var(--bg-2)" stroke-width="1.2"/>` : '').join('');

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
      <button class="fh-back" data-fh-hub aria-label="Back to fitness">←</button>
      <div class="fh-title"><small>Last 30 days</small><h2>Cardio Load</h2></div>
    </div>
    <section class="card fh-block">
      <div class="fh-cardio-body" style="margin-bottom:10px">
        <b class="fh-big">${cs.acute}</b>
        <span class="fh-status" style="color:${STATUS_COLOR[cs.status]}">${esc(cs.status)}</span>
      </div>
      <svg class="fh-svg" viewBox="0 0 ${W} ${H}" aria-hidden="true">
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
