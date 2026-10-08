// leaderboard.js — global Supabase leaderboard with seasonal (3-month, resets)
// and all-time (cumulative) tracks. Reads the aggregated `leaderboard` RPC.

import { client, currentUser } from './auth.js';
import { SYNC_ENABLED } from './config.js';
import { levelFromTotalXp } from '../core/scoring.js';
import { esc, dialogue } from './ui.js';
import { svg } from '../core/icons.js';
import { isDemo, demoLeaderboard, DEMO_ME } from './demo.js';
import { podium, rankDelta, rivalOf } from '../core/ranks.js';
import { meter } from './ui.js';

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
function skeletonRows(n = 4) {
  const me = isDemo() ? DEMO_ME : currentUser()?.id;
  const pod = (rank, i) => `<span class="pod pod-r${rank} is-sk" style="--sk-i:${i}">
      ${rank === 1 ? `<span class="pod-crown">${svg('trophy')}</span>` : ''}<span class="lb-avatar sk-tile"></span><b class="pod-name"><i class="sk-line" style="width:5ch"></i></b>
      <small class="pod-xp"><i class="sk-line" style="width:6ch"></i></small><span class="pod-block sk-tile"></span></span>`;
  const rival = me ? `<section class="lb-rival is-sk" style="--sk-i:3"><div class="lb-rival-top"><h4><i class="sk-line" style="width:9ch"></i></h4></div>
      <div class="lb-rival-row"><span class="lb-rank"><i class="sk-line" style="width:1ch"></i></span><span class="lb-avatar sk-tile"></span>
      <span class="lb-id"><span class="lb-rival-line"><i class="sk-line" style="width:80%"></i><br><i class="sk-line" style="width:50%"></i></span><span class="meter"><i></i></span></span></div></section>` : '';
  const row = (i) => `<li class="lb-row is-sk" aria-hidden="true" style="--sk-i:${i}">
      <span class="lb-rank"><i class="sk-line" style="width:1ch"></i></span>
      <span class="lb-avatar sk-tile"></span>
      <span class="lb-id"><b class="lb-name"><i class="sk-line" style="width:${[62, 48, 70, 55, 66, 44][i % 6]}%"></i></b>
        <small class="lb-meta"><i class="sk-line" style="width:40%"></i></small></span>
    </li>`;
  return `<span class="sr">Loading the leaderboard…</span><div class="lb-podium" aria-hidden="true">${pod(2, 0)}${pod(1, 1)}${pod(3, 2)}</div>${rival}<ul class="lb-list">${Array.from({ length: n }, (_, i) => row(i + 4)).join('')}</ul>`;
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
    const me = isDemo() ? DEMO_ME : currentUser()?.id;
    const rows = (data || []).map((r, i) => ({ ...r, rank: i + 1, level: levelFromTotalXp(Number(r.xp)).level }));
    _athletes = new Map(rows.map((r) => [r.user_id, r]));
    const myRank = rows.find((r) => r.user_id === me)?.rank || null;
    const delta = rankDelta(previousRank(view, me), myRank);
    if (myRank) rememberRank(view, me, myRank);
    body.innerHTML = rows.length
      ? podiumBlock(rows, me) + rivalBlock(rows, me, delta) + list(rows.slice(3), me, delta)
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

// ---- rank memory: "since my last visit" ----------------------------------------
// The rank stored at the previous visit is read once per session, so every
// re-render in this visit compares against the same baseline.
const _baseline = {};
const rankKey = (view, me) => `moske-rank:${view}:${me}`;
function previousRank(view, me) {
  if (!me) return null;
  const k = rankKey(view, me);
  if (!(k in _baseline)) {
    try { _baseline[k] = Number(localStorage.getItem(k)) || null; } catch { _baseline[k] = null; }
  }
  return _baseline[k];
}
function rememberRank(view, me, rank) {
  try { localStorage.setItem(rankKey(view, me), String(rank)); } catch { /* private mode */ }
}

const avatar = (r) => `<span class="lb-avatar">${r.avatar
  ? `<img src="${esc(r.avatar)}" alt="" loading="lazy">`
  : esc((r.display_name || 'A').trim().charAt(0).toUpperCase())}</span>`;
const rowAttrs = (r) => `data-action="view-athlete-profile" data-uid="${esc(r.user_id)}" data-name="${esc(r.display_name)}" data-rank="${r.rank}" data-xp="${r.xp}"`;

/** ▲2 / ▼1 / NEW / — : movement since the last visit. */
function deltaBadge(d) {
  if (!d) return '';
  if (d.dir === 'up') return `<span class="lb-delta up" aria-label="Up ${d.by} since your last visit"><i></i>${d.by}</span>`;
  if (d.dir === 'down') return `<span class="lb-delta down" aria-label="Down ${d.by} since your last visit"><i></i>${d.by}</span>`;
  if (d.dir === 'new') return '<span class="lb-delta new">New</span>';
  return '<span class="lb-delta same" aria-label="Same rank as your last visit">=</span>';
}

// The top three on blocks: second, first, third. Taller block, higher place.
function podiumBlock(rows, me) {
  const top = podium(rows);
  if (!top.length) return '';
  return `<div class="lb-podium" role="list" aria-label="Top three">${top.map((r) => `
    <button class="pod pod-r${r.rank}${r.user_id === me ? ' me' : ''}" role="listitem" ${rowAttrs(r)} aria-label="${esc(`#${r.rank} ${r.display_name}, ${xp(r.xp)} XP`)}">
      ${r.rank === 1 ? `<span class="pod-crown" aria-hidden="true">${svg('trophy')}</span>` : ''}
      ${avatar(r)}
      <b class="pod-name">${esc((r.display_name || '').split(' ')[0])}</b>
      <small class="pod-xp">${xp(r.xp)} XP</small>
      <span class="pod-block" aria-hidden="true">${r.rank}</span>
    </button>`).join('')}</div>`;
}

// Pinned under the podium: the athlete directly above me and the XP gap as a
// meter. At #1 it's the chaser below and how close they are.
function rivalBlock(rows, me, delta) {
  const r = rivalOf(rows, me);
  if (!r) return '';
  const head = r.kind === 'above'
    ? `<b class="lb-gap">${xp(r.gap)} XP</b> to pass ${esc(r.rival.display_name)}`
    : `${esc(r.rival.display_name)} is <b class="lb-gap">${xp(r.gap)} XP</b> behind you`;
  return `<section class="lb-rival" aria-label="Your rival">
    <div class="lb-rival-top"><h4>${r.kind === 'above' ? 'Your rival' : 'Your chaser'}</h4>
      <span class="lb-you">You #${r.me.rank} ${deltaBadge(delta)}</span></div>
    <div class="lb-rival-row" role="button" tabindex="0" ${rowAttrs(r.rival)}>
      <span class="lb-rank">${r.rival.rank}</span>${avatar(r.rival)}
      <span class="lb-id"><span class="lb-rival-line">${head}</span>
        ${meter(r.frac, { segments: 16, cls: r.kind === 'above' ? '' : 'good', label: `${Math.round(r.frac * 100)}%`, key: `rival-${r.rival.user_id}` })}</span>
    </div>
  </section>`;
}

// Everyone below the podium. Real profile photos (initial fallback); rows open
// the athlete's dashboard. My row carries the movement badge.
function list(rows, me, delta) {
  if (!rows.length) return '';
  return `<ul class="lb-list">${rows.map((r) => `
    <li class="lb-row ${r.user_id === me ? 'me' : ''}" role="button" tabindex="0" ${rowAttrs(r)}>
      <span class="lb-rank r${Math.min(r.rank, 4)}">${r.rank}</span>
      ${avatar(r)}
      <span class="lb-id">
        <b class="lb-name">${esc(r.display_name)}${r.user_id === me ? ` ${deltaBadge(delta)}` : ''}</b>
        <small class="lb-meta">LVL ${r.level} · ${xp(r.xp)} XP</small>
      </span>
      ${sportDots(r.sports)}
    </li>`).join('')}</ul>`;
}
