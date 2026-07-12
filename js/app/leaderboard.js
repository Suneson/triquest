// leaderboard.js — global Supabase leaderboard with seasonal (3-month, resets)
// and all-time (cumulative) tracks. Reads the aggregated `leaderboard` RPC.

import { client, currentUser } from './auth.js';
import { SYNC_ENABLED } from './config.js';
import { levelFromTotalXp } from '../core/scoring.js';
import { esc } from './ui.js';
import { svg } from '../core/icons.js';

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
    ? `<div class="lb-countdown">${svg('clock')} <b>${s.daysRemaining}</b> days remaining · Season ${s.number} <span class="muted">(resets monthly)</span></div>` : '';
  return `<div class="lb-banner">${svg('trophy', 'tint')} Season Reset: Monthly &nbsp;|&nbsp; ${svg('medal', 'tint')} 1st Place wins a 20% discount coupon on your next Moske order!</div>
    <div class="day-header"><h2>Leaderboards</h2></div>
    <div class="lb-toggle">
      <button class="lb-tab ${view === 'season' ? 'on' : ''}" data-action="lb-toggle" data-view="season">Season</button>
      <button class="lb-tab ${view === 'all' ? 'on' : ''}" data-action="lb-toggle" data-view="all">All-time</button>
    </div>${countdown}
    <div id="lb-body"><p class="muted lb-loading">Loading…</p></div>`;
}

export async function loadLeaderboard(view, today) {
  const body = document.getElementById('lb-body');
  if (!body) return;
  if (!SYNC_ENABLED) { body.innerHTML = '<p class="muted">Leaderboards need cloud sync configured.</p>'; return; }
  try {
    const c = await client();
    const since = view === 'season' ? seasonInfo(today).start.toISOString() : null;
    const { data, error } = await c.rpc('leaderboard', { p_since: since });
    if (error) throw error;
    const me = currentUser()?.id;
    const rows = (data || []).map((r, i) => ({ ...r, rank: i + 1, level: levelFromTotalXp(Number(r.xp)).level }));
    body.innerHTML = rows.length
      ? list(rows, me)
      : '<p class="muted">No ranked athletes yet — complete a verified workout to appear here.</p>';
  } catch (e) {
    body.innerHTML = '<p class="muted">Couldn’t load the leaderboard. Check your connection.</p>';
  }
}

const xp = (n) => Number(n).toLocaleString();

// Dynamic per-athlete discipline indicators: only the sports they actually log.
const SPORT_ORDER = ['run', 'bike', 'swim'];
const SPORT_TITLE = { run: 'Running', bike: 'Cycling', swim: 'Swimming' };
function sportDots(sports) {
  const active = SPORT_ORDER.filter((t) => (sports || []).includes(t));
  if (!active.length) return '';
  return `<span class="lb-sports">${active.map((t) =>
    `<i class="lbs lbs-${t}" title="${SPORT_TITLE[t]}"></i>`).join('')}</span>`;
}

// One unified premium list — no podium, no card boxes. Metallic top-3 ranks.
function list(rows, me) {
  return `<ul class="lb-list">${rows.map((r) => `
    <li class="lb-row ${r.user_id === me ? 'me' : ''}" data-action="open-profile" data-uid="${esc(r.user_id)}" data-name="${esc(r.display_name)}" data-rank="${r.rank}" data-xp="${r.xp}">
      <span class="lb-rank r${Math.min(r.rank, 4)}">${r.rank}</span>
      <span class="lb-avatar">${esc((r.display_name || 'A').trim().charAt(0).toUpperCase())}</span>
      <span class="lb-id">
        <b class="lb-name">${esc(r.display_name)}</b>
        <small class="lb-meta">Lv ${r.level} · ${xp(r.xp)} XP</small>
      </span>
      ${sportDots(r.sports)}
    </li>`).join('')}</ul>`;
}
