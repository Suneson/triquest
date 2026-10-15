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
import { t, fmtNum } from '../core/i18n.js';

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
    ? `<div class="lb-countdown">${svg('clock')} ${t('lb.daysLeft', { n: s.daysRemaining, s: s.number })}</div>` : '';
  return `<div class="day-header"><h2>${t('lb.title')}</h2></div>
    <div class="lb-banner">${svg('trophy')}<div><b>${t('lb.monthly')}</b>${t('lb.prize')}</div></div>
    <div class="lb-toggle">
      <button class="lb-tab ${view === 'season' ? 'on' : ''}" data-action="lb-toggle" data-view="season">${t('lb.season')}</button>
      <button class="lb-tab ${view === 'all' ? 'on' : ''}" data-action="lb-toggle" data-view="all">${t('lb.allTime')}</button>
    </div>${countdown}
    <p class="lb-legend muted small">${esc(t('xp.lbLegend'))}</p>
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
  return `<span class="sr">${t('lb.loading')}</span><div class="lb-podium" aria-hidden="true">${pod(2, 0)}${pod(1, 1)}${pod(3, 2)}</div>${rival}<ul class="lb-list">${Array.from({ length: n }, (_, i) => row(i + 4)).join('')}</ul>`;
}

export async function loadLeaderboard(view, today) {
  const body = document.getElementById('lb-body');
  if (!body) return;
  const done = () => body.removeAttribute('aria-busy');
  if (!SYNC_ENABLED && !isDemo()) { body.innerHTML = dialogue({ who: t('lb.ranks'), icon: 'trophy', text: t('lb.noSync'), cls: 'empty-dlg' }); return; }
  try {
    let data;
    if (isDemo()) {
      data = demoLeaderboard(view);
    } else {
      const c = await client();
      const since = view === 'season' ? seasonInfo(today).start.toISOString() : null;
      // the proof share is a separate call so the board still loads if it fails
      const [res, proof] = await Promise.all([
        c.rpc('leaderboard', { p_since: since }),
        Promise.resolve(c.rpc('leaderboard_proof', { p_since: since })).catch(() => ({ data: null })),
      ]);
      if (res.error) throw res.error;
      const pct = new Map((proof?.data || []).map((p) => [p.user_id, p.verified_pct]));
      data = (res.data || []).map((r) => ({ ...r, verified_pct: pct.get(r.user_id) ?? null }));
    }
    const me = isDemo() ? DEMO_ME : currentUser()?.id;
    const rows = (data || []).map((r, i) => ({ ...r, rank: i + 1, level: levelFromTotalXp(Number(r.xp)).level }));
    _athletes = new Map(rows.map((r) => [r.user_id, r]));
    const myRank = rows.find((r) => r.user_id === me)?.rank || null;
    const delta = rankDelta(previousRank(view, me), myRank);
    if (myRank) rememberRank(view, me, myRank);
    body.innerHTML = rows.length
      ? podiumBlock(rows, me) + rivalBlock(rows, me, delta) + list(rows.slice(3), me, delta)
      : dialogue({ who: t('lb.ranks'), icon: 'trophy', text: t('lb.empty'), cls: 'empty-dlg' });
  } catch (e) {
    body.innerHTML = dialogue({ who: t('lb.ranks'), icon: 'trophy', text: t('lb.failed'), cls: 'empty-dlg' });
  }
  done();
}

const xp = (n) => fmtNum(n);

// ✓ and the share of the athlete's XP that Strava verified (nothing when none)
const proofChip = (r) => (r.verified_pct > 0
  ? ` <span class="lb-proof" aria-label="${esc(t('xp.lbAria', { pct: r.verified_pct }))}" title="${esc(t('xp.lbAria', { pct: r.verified_pct }))}">${svg('check')}${t('xp.lbChip', { pct: r.verified_pct })}</span>` : '');

// Last-loaded athletes by id — lets the profile view reuse avatar/xp/rank
// without stuffing large base64 photos into data attributes.
let _athletes = new Map();
export const athleteByUid = (uid) => _athletes.get(uid) || null;

// Dynamic per-athlete discipline indicators: only the sports they actually log.
const SPORT_ORDER = ['run', 'bike', 'swim'];
const SPORT_TITLE = { run: 'running', bike: 'cycling', swim: 'swimming' }; // keys under sport.*
function sportDots(sports) {
  const active = SPORT_ORDER.filter((s) => (sports || []).includes(s));
  if (!active.length) return '';
  return `<span class="lb-sports">${active.map((s) =>
    `<i class="lbs lbs-${s}" title="${t(`sport.${SPORT_TITLE[s]}`)}"></i>`).join('')}</span>`;
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
  if (d.dir === 'up') return `<span class="lb-delta up" aria-label="${t('lb.up', { n: d.by })}"><i></i>${d.by}</span>`;
  if (d.dir === 'down') return `<span class="lb-delta down" aria-label="${t('lb.down', { n: d.by })}"><i></i>${d.by}</span>`;
  if (d.dir === 'new') return `<span class="lb-delta new">${t('lb.new')}</span>`;
  return `<span class="lb-delta same" aria-label="${t('lb.same')}">=</span>`;
}

// The top three on blocks: second, first, third. Taller block, higher place.
function podiumBlock(rows, me) {
  const top = podium(rows);
  if (!top.length) return '';
  return `<div class="lb-podium" role="list" aria-label="${t('lb.top3')}">${top.map((r) => `
    <button class="pod pod-r${r.rank}${r.user_id === me ? ' me' : ''}" role="listitem" ${rowAttrs(r)} aria-label="${esc(t('lb.podAria', { rank: r.rank, name: r.display_name, xp: xp(r.xp) }))}">
      ${r.rank === 1 ? `<span class="pod-crown" aria-hidden="true">${svg('trophy')}</span>` : ''}
      ${avatar(r)}
      <b class="pod-name">${esc((r.display_name || '').split(' ')[0])}</b>
      <small class="pod-xp">${xp(r.xp)} XP${proofChip(r)}</small>
      <span class="pod-block" aria-hidden="true">${r.rank}</span>
    </button>`).join('')}</div>`;
}

// Pinned under the podium: the athlete directly above me and the XP gap as a
// meter. At #1 it's the chaser below and how close they are.
function rivalBlock(rows, me, delta) {
  const r = rivalOf(rows, me);
  if (!r) return '';
  const head = r.kind === 'above'
    ? t('lb.toPass', { xp: xp(r.gap), name: esc(r.rival.display_name) })
    : t('lb.behind', { xp: xp(r.gap), name: esc(r.rival.display_name) });
  return `<section class="lb-rival" aria-label="${t('lb.rival')}">
    <div class="lb-rival-top"><h4>${r.kind === 'above' ? t('lb.rival') : t('lb.chaser')}</h4>
      <span class="lb-you">${t('lb.you', { rank: r.me.rank })} ${deltaBadge(delta)}</span></div>
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
        <small class="lb-meta">LVL ${r.level} · ${xp(r.xp)} XP${proofChip(r)}</small>
      </span>
      ${sportDots(r.sports)}
    </li>`).join('')}</ul>`;
}
