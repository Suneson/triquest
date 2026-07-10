// profile-game.js — the Profile tab as a full-screen, level-reactive "video game"
// environment for Cycling. Three stacked layers (background / platform / animated
// character) swap instantly with the athlete's bike level. The other sports are
// stubbed (work-in-progress). A decluttered avatar modal holds the core stats.

import { sportProgress } from '../core/scoring.js';
import { svg } from '../core/icons.js';
import { esc } from './ui.js';
import { currentUser } from './auth.js';

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
      <button class="pg-avatar" data-action="pg-profile" aria-label="Open profile">${initial}</button>
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

export function openProfileCard(ctx) {
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  const name = athleteName();
  const close = () => { root.innerHTML = ''; root.classList.remove('open'); };
  const stat = (value, label) => `<div class="pc-stat"><b>${esc(String(value))}</b><small>${esc(label)}</small></div>`;

  root.innerHTML = `
    <div class="modal-backdrop" data-pc-close></div>
    <div class="modal pc-modal" role="dialog" aria-modal="true" aria-label="Profile">
      <button class="icon-btn pc-x" data-pc-close aria-label="Close">✕</button>
      <div class="pc-head">
        <div class="pc-avatar">${esc((name || 'A').charAt(0).toUpperCase())}</div>
        <div class="pc-name">${esc(name)}</div>
      </div>
      <div class="pc-stats">
        ${stat((ctx.stats?.completedCount ?? 0).toLocaleString(), 'Total workouts')}
        ${stat(`${ctx.streaks?.current ?? 0} d`, 'Current streak')}
        ${stat(accountAge(ctx), 'Account age')}
        ${stat(ctx.stats?.level ?? 1, 'Overall level')}
      </div>
    </div>`;
  root.querySelectorAll('[data-pc-close]').forEach((b) => b.addEventListener('click', close));
}
