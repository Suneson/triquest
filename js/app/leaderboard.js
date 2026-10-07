// leaderboard.js — global Supabase leaderboard with seasonal (3-month, resets)
// and all-time (cumulative) tracks. Reads the aggregated `leaderboard` RPC.

import { client, currentUser } from './auth.js';
import { SYNC_ENABLED } from './config.js';
import { levelFromTotalXp } from '../core/scoring.js';
import { esc, dialogue } from './ui.js';
import { svg } from '../core/icons.js';
import { isDemo, demoLeaderboard } from './demo.js';

const SEASON_EPOCH = new Date('2026-01-01T00:00:00'); // monthly seasons
const SEASON_MONTHS = 1;

export function seasonInfo(todayIso) {
  const now = new Date(`${todayIso}T12:00:00`);
  const months = (now.getFullYear() - SEASON_EPOCH.getFullYear()) * 12 + (now.getMonth() - SEASON_EPOCH.getMonth());
  const idx = Math.max(0, Math.floor(months / SEASON_MONTHS));
  const start = new Date(SEASON_EPOCH); start.setMonth(SEASON_EPOCH.getMonth() + idx * SEASON_MONTHS);
  const end = new Date(start); end.setMonth(start.getMonth() + SEASON_MONTHS);
  return { start, end, number: idx + 1, daysRemaining: Math.max(0, Math.ceil((end - now) / 86400000)) };
}

export function leaderboardShell(view, today) {
  const s = seasonInfo(today);
  const countdown = view === 'season'
    ? `<div class="lb-countdown">${svg('clock')} <b>${s.daysRemaining}</b> days left in season ${s.number}</div>` : '';
  return `<div class="day-header"><h2>Leaderboards</h2></div>
    <div class="lb-banner">${svg('trophy')}<div><b>Monthly season</b>First place wins a 20% discount on your next MOSKE order.</div></div>
    <div class="lb-toggle">
      <button class="lb-tab ${view === 'season' ? 'on' : ''}" data-action="lb-toggle" data-view="season">Season</button>
      <button class="lb-tab ${view === 'all' ? 'on' : ''}" data-action="lb-toggle" data-view="all">All-time</button>
    </div>${countdown}
    <div id="lb-body" aria-busy="true">${skeletonRows()}</div>`;
}

// Loading tiles shaped like the real rows (same classes, same heights), so the
// list doesn't jump when the data lands.
function skeletonRows(n = 6) {
  const row = (i) => `<li class="lb-row is-sk" aria-hidden="true" style="--sk-i:${i}">
      <span class="lb-rank"><i class="sk-line" style="width:1ch"></i></span>
      <span class="lb-avatar sk-tile"></span>
      <span class="lb-id"><b class="lb-name"><i class="sk-line" style="width:${[62, 48, 70, 55, 66, 44][i % 6]}%"></i></b>
        <small class="lb-meta"><i class="sk-line" style="width:40%"></i></small></span>
    </li>`;
  return `<span class="sr">Loading the leaderboard…</span><ul class="lb-list">${Array.from({ length: n }, (_, i) => row(i)).join('')}</ul>`;
}

export async function loadLeaderboard(view, today) {
  const body = document.getElementById('lb-body');
  if (!body) return;
  const done = () => body.removeAttribute('aria-busy');
  if (!SYNC_ENABLED && !isDemo()) { body.innerHTML = dialogue({ who: 'Ranks', icon: 'trophy', text: 'Leaderboards need cloud sync configured.', cls: 'empty-dlg' }); return; }
  try {
    let data;
    if (isDemo()) {
      data = demoLeaderboard(view);
    } else {
      const c = await client();
      const since = view === 'season' ? seasonInfo(today).start.toISOString() : null;
      const res = await c.rpc('leaderboard', { p_since: since });
      if (res.error) throw res.error;
      data = res.data;
    }
    const me = currentUser()?.id;
    const rows = (data || []).map((r, i) => ({ ...r, rank: i + 1, level: levelFromTotalXp(Number(r.xp)).level }));
    _athletes = new Map(rows.map((r) => [r.user_id, r]));
    body.innerHTML = rows.length
      ? list(rows, me)
      : dialogue({ who: 'Ranks', icon: 'trophy', text: 'No ranked athletes yet. Complete a verified workout to appear here.', cls: 'empty-dlg' });
  } catch (e) {
    body.innerHTML = dialogue({ who: 'Ranks', icon: 'trophy', text: 'Couldn’t load the leaderboard. Check your connection and try again.', cls: 'empty-dlg' });
  }
  done();
}

const xp = (n) => Number(n).toLocaleString();

// Last-loaded athletes by id — lets the profile view reuse avatar/xp/rank
// without stuffing large base64 photos into data attributes.
let _athletes = new Map();
export const athleteByUid = (uid) => _athletes.get(uid) || null;

// Dynamic per-athlete discipline indicators: only the sports they actually log.
const SPORT_ORDER = ['run', 'bike', 'swim'];
const SPORT_TITLE = { run: 'Running', bike: 'Cycling', swim: 'Swimming' };
function sportDots(sports) {
  const active = SPORT_ORDER.filter((t) => (sports || []).includes(t));
  if (!active.length) return '';
  return `<span class="lb-sports">${active.map((t) =>
    `<i class="lbs lbs-${t}" title="${SPORT_TITLE[t]}"></i>`).join('')}</span>`;
}

// One unified premium list — no podium, no card boxes. Metallic top-3 ranks,
// real profile photos (initial fallback), rows open the athlete's dashboard.
function list(rows, me) {
  return `<ul class="lb-list">${rows.map((r) => `
    <li class="lb-row ${r.user_id === me ? 'me' : ''}" role="button" tabindex="0" data-action="view-athlete-profile" data-uid="${esc(r.user_id)}" data-name="${esc(r.display_name)}" data-rank="${r.rank}" data-xp="${r.xp}">
      <span class="lb-rank r${Math.min(r.rank, 4)}">${r.rank}</span>
      <span class="lb-avatar">${r.avatar
        ? `<img src="${esc(r.avatar)}" alt="" loading="lazy">`
        : esc((r.display_name || 'A').trim().charAt(0).toUpperCase())}</span>
      <span class="lb-id">
        <b class="lb-name">${esc(r.display_name)}</b>
        <small class="lb-meta">LVL ${r.level} · ${xp(r.xp)} XP</small>
      </span>
      ${sportDots(r.sports)}
    </li>`).join('')}</ul>`;
}
