// effects.js — confetti, generated sound and toasts. All dependency-free.
// Animations respect prefers-reduced-motion (and the in-app setting).

import { getSettings } from './store.js';

export function prefersReducedMotion() {
  const setting = getSettings()?.reduceMotion;
  if (setting) return true;
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---- confetti --------------------------------------------------------------

const DISCIPLINE_COLORS = ['#ff5a5f', '#3da9fc', '#2ec4b6', '#F2C14E', '#9b5de5', '#ff8c42'];
const GRID = 4; // confetti snaps to a 4px grid and moves every other frame — pixel, not smooth

/** Burst pixel confetti from a screen point (defaults to centre). */
export function confetti(originX, originY, count = 90) {
  if (prefersReducedMotion()) return;
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const ox = originX ?? window.innerWidth / 2;
  const oy = originY ?? window.innerHeight / 3;
  const parts = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    return {
      x: ox, y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      size: GRID * (1 + ((Math.random() * 2) | 0)),
      color: DISCIPLINE_COLORS[(Math.random() * DISCIPLINE_COLORS.length) | 0],
      life: 1,
    };
  });

  let frame = 0;
  const snap = (v) => Math.round(v / GRID) * GRID;
  function tick() {
    frame++;
    if (frame % 2) { requestAnimationFrame(tick); return; } // stepped: draw every other frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of parts) {
      p.vy += 0.56; // gravity (per drawn frame)
      p.vx *= 0.98;
      p.x += p.vx * 2;
      p.y += p.vy * 2;
      p.life -= 0.024;
      if (p.life <= 0 || p.y > window.innerHeight + 40) continue;
      alive = true;
      ctx.globalAlpha = p.life > 0.5 ? 1 : 0.5; // two-step fade
      ctx.fillStyle = p.color;
      ctx.fillRect(snap(p.x), snap(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    if (alive && frame < 240) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(tick);
}

// ---- generated sound (Web Audio, no asset files) ---------------------------

let audioCtx = null;
function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  return audioCtx;
}

function blip(freq, start, dur, type = 'sine', gain = 0.18) {
  const ac = ctx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  g.gain.setValueAtTime(0.0001, ac.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.02);
}

function soundOn() {
  return !!getSettings()?.sound;
}

export function playComplete() {
  if (!soundOn()) return;
  const ac = ctx();
  if (ac && ac.state === 'suspended') ac.resume();
  blip(523.25, 0, 0.12, 'triangle');     // C5
  blip(783.99, 0.09, 0.18, 'triangle');  // G5
}

export function playLevelUp() {
  if (!soundOn()) return;
  const ac = ctx();
  if (ac && ac.state === 'suspended') ac.resume();
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(f, i * 0.1, 0.22, 'triangle', 0.2));
}

export function playQuest() {
  if (!soundOn()) return;
  const ac = ctx();
  if (ac && ac.state === 'suspended') ac.resume();
  [659.25, 783.99, 987.77].forEach((f, i) => blip(f, i * 0.07, 0.12, 'square', 0.1));
}

/** Quest accepted: a short two-note "got it". */
export function playAccept() {
  if (!soundOn()) return;
  const ac = ctx();
  if (ac && ac.state === 'suspended') ac.resume();
  blip(392, 0, 0.08, 'square', 0.1);
  blip(587.33, 0.07, 0.14, 'square', 0.1);
}

export function playBadge() {
  if (!soundOn()) return;
  const ac = ctx();
  if (ac && ac.state === 'suspended') ac.resume();
  blip(659.25, 0, 0.15, 'square', 0.12);
  blip(987.77, 0.12, 0.25, 'square', 0.12);
}

// ---- XP pop ------------------------------------------------------------------

/** "+40 XP" rising from a screen point. Skipped under reduced motion. */
export function xpPop(text, x, y) {
  if (prefersReducedMotion()) return;
  const el = document.createElement('div');
  el.className = 'xp-pop';
  el.textContent = text;
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

// ---- toasts ----------------------------------------------------------------
// Dialogue-style toasts, at most two on screen; the FAB lifts while any show.
const MAX_TOASTS = 2;
function syncToastState(wrap) {
  document.body.classList.toggle('toast-up', wrap.children.length > 0);
}

export function toast(html, { duration = 3800, icon = '', actionLabel = '', onAction = null } = {}) {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = (icon ? `<span class="toast-icon">${icon}</span>` : '') + `<div>${html}</div>`;
  if (actionLabel && onAction) {
    const btn = document.createElement('button');
    btn.className = 'btn tiny toast-action';
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => { onAction(); el.classList.remove('show'); setTimeout(() => { el.remove(); syncToastState(wrap); }, 200); });
    el.appendChild(btn);
  }
  while (wrap.children.length >= MAX_TOASTS) wrap.firstElementChild.remove();
  wrap.appendChild(el);
  syncToastState(wrap);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.remove(); syncToastState(wrap); }, 260);
  }, duration);
}

// ---- the coach speaking --------------------------------------------------------
// Types out marked dialogue lines a character at a time (28 ms each), swapping
// the portrait to its "talk" frame while it types, and blinks idle portraits
// now and then. Without frames or under reduced motion, lines show at once.

const TYPE_MS = 28;
const _timers = new WeakMap();

export function typeLines(root = document) {
  root.querySelectorAll('.coach-line[data-type]').forEach((p) => {
    const full = p.textContent;
    p.removeAttribute('data-type');
    if (prefersReducedMotion() || !full) return;
    const pic = p.closest('.dlg')?.querySelector('.dlg-portrait');
    const rest = pic?.getAttribute('src');
    const talk = pic?.dataset.talk;
    // screen readers get the whole line at once; the typing is visual only
    p.innerHTML = '<span class="sr"></span><span aria-hidden="true"></span>';
    const [sr, shown] = p.children;
    sr.textContent = full;
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      shown.textContent = full.slice(0, i);
      if (talk && pic) pic.src = i % 4 < 2 ? talk : rest; // mouth flaps every two letters
      if (i >= full.length || !p.isConnected) {
        clearInterval(t);
        p.textContent = full;
        if (pic && rest) pic.src = rest;
      }
    }, TYPE_MS);
  });
  root.querySelectorAll('.dlg-portrait[data-blink]').forEach((pic) => {
    if (_timers.has(pic) || prefersReducedMotion()) return;
    const rest = pic.getAttribute('src');
    const t = setInterval(() => {
      if (!pic.isConnected) { clearInterval(t); return; }
      pic.src = pic.dataset.blink;
      setTimeout(() => { pic.src = rest; }, 140);
    }, 3600);
    _timers.set(pic, t);
  });
}
