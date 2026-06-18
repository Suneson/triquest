// leaderboard.js — global Supabase leaderboard with seasonal (3-month, resets)
// and all-time (cumulative) tracks. Reads the aggregated `leaderboard` RPC.

import { client, currentUser } from './auth.js';
import { SYNC_ENABLED } from './config.js';
import { levelFromTotalXp } from '../core/scoring.js';
import { esc } from './ui.js';

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
    ? `<div class="lb-countdown">⏳ <b>${s.daysRemaining}</b> days remaining · Season ${s.number} <span class="muted">(resets monthly)</span></div>` : '';
  return `<div class="lb-banner">🏆 Season Reset: Monthly &nbsp;|&nbsp; 🥇 1st Place wins a 20% discount coupon on your next Moske order!</div>
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
      ? podium(rows, me) + list(rows, me)
      : '<p class="muted">No ranked athletes yet — complete a verified workout to appear here.</p>';
  } catch (e) {
    body.innerHTML = '<p class="muted">Couldn’t load the leaderboard. Check your connection.</p>';
  }
}

const xp = (n) => Number(n).toLocaleString();

function podium(rows, me) {
  const order = [rows[1], rows[0], rows[2]].filter(Boolean); // 2nd · 1st · 3rd
  return `<div class="podium">${order.map((r) => `
    <div class="pod pod-${r.rank} ${r.user_id === me ? 'me' : ''}">
      <div class="medal m${r.rank}"><span>${r.rank}</span></div>
      <div class="pod-name">${esc(r.display_name)}</div>
      <div class="pod-xp">${xp(r.xp)} XP</div>
      <div class="pod-bar"><span>Lv ${r.level}</span></div>
    </div>`).join('')}</div>`;
}

function list(rows, me) {
  const rest = rows.slice(3);
  if (!rest.length) return '';
  return `<ul class="lb-list">${rest.map((r) => `
    <li class="${r.user_id === me ? 'me' : ''}">
      <span class="lb-rank">${r.rank}</span>
      <span class="lb-name">${esc(r.display_name)}</span>
      <span class="lb-lvl">Lv ${r.level}</span>
      <b class="lb-xp">${xp(r.xp)}</b>
    </li>`).join('')}</ul>`;
}
