// profile.js — public profile preview overlay opened from the leaderboard.
import { client } from './auth.js';
import { computeStreaks } from '../core/streaks.js';
import { levelFromTotalXp, formatDuration } from '../core/scoring.js';
import { esc, fmtKm } from './ui.js';

const todayISO = () => new Date().toISOString().slice(0, 10);

export async function fetchPublicUserProfile(targetUserId) {
  const c = await client();
  const { data, error } = await c.rpc('public_profile', { p_user: targetUserId });
  if (error) throw error;
  return data; // { display_name, completed, total_km, total_min, dates[] }
}

const MILESTONES = [
  { name: 'First Steps', icon: '🎯', got: (s) => s.completed >= 1 },
  { name: 'First 10K', icon: '🏃', got: (s) => s.km >= 10 },
  { name: 'Centurion', icon: '💯', got: (s) => s.km >= 100 },
  { name: 'Half Century', icon: '✅', got: (s) => s.completed >= 50 },
  { name: 'Consistency King', icon: '🔥', got: (s) => s.longest >= 7 },
  { name: 'Fortnight Beast', icon: '🌋', got: (s) => s.longest >= 14 },
];

export function openPublicProfile({ uid, name, rank, xp }) {
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  const level = levelFromTotalXp(Number(xp) || 0).level;
  const close = () => { root.innerHTML = ''; root.classList.remove('open'); };
  root.innerHTML = `
    <div class="modal-backdrop" data-pp-close></div>
    <div class="modal pp-modal" role="dialog" aria-modal="true" aria-label="Profile">
      <header class="modal-head"><h2>Profile</h2><button class="icon-btn" data-pp-close aria-label="Close">✕</button></header>
      <div class="modal-body">
        <div class="pp-header">
          <div class="pp-avatar">${esc((name || 'A').trim().charAt(0).toUpperCase())}</div>
          <div><div class="pp-name">${esc(name || 'Athlete')}</div>
            <div class="pp-tier">${rank ? `Season rank #${esc(rank)} · ` : ''}Level ${level}</div></div>
        </div>
        <div id="pp-body">${skeleton()}</div>
      </div>
    </div>`;
  root.querySelectorAll('[data-pp-close]').forEach((b) => b.addEventListener('click', close));

  fetchPublicUserProfile(uid).then((p) => {
    const km = Number(p.total_km) || 0;
    const streaks = computeStreaks((p.dates || []).map((d) => ({ date: d, completed: true })), todayISO());
    const s = { completed: Number(p.completed) || 0, km, longest: streaks.longest };
    const stats = `<div class="pp-stats">
      <div class="total"><small>✅ Workouts</small><b>${s.completed}</b></div>
      <div class="total"><small>📏 Distance</small><b>${fmtKm(km) || '0 km'}</b></div>
      <div class="total"><small>🔥 Streak</small><b>${streaks.current} d</b></div>
      <div class="total"><small>⏱️ Hours</small><b>${((Number(p.total_min) || 0) / 60).toFixed(1)}</b></div>
    </div>`;
    const badges = `<h4 class="pp-h4">Achievements</h4><div class="badge-wall">${MILESTONES.map((m) => {
      const on = m.got(s);
      return `<div class="badge ${on ? 'unlocked' : 'locked'}"><div class="badge-ico">${on ? m.icon : '🔒'}</div><div class="badge-name">${esc(m.name)}</div></div>`;
    }).join('')}</div>`;
    const body = document.getElementById('pp-body');
    if (body) body.innerHTML = stats + badges;
  }).catch(() => {
    const body = document.getElementById('pp-body');
    if (body) body.innerHTML = '<p class="muted">Couldn’t load this profile.</p>';
  });
}

function skeleton() {
  return `<div class="pp-stats">${'<div class="total sk"></div>'.repeat(4)}</div>
    <h4 class="pp-h4">Achievements</h4>
    <div class="badge-wall">${'<div class="badge sk"></div>'.repeat(6)}</div>`;
}
