// effects.js — confetti, generated sound and toasts. All dependency-free.
// Animations respect prefers-reduced-motion (and the in-app setting).

import { getSettings } from './store.js';

export function prefersReducedMotion() {
  const setting = getSettings()?.reduceMotion;
  if (setting) return true;
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---- confetti --------------------------------------------------------------

const DISCIPLINE_COLORS = ['#ff5a5f', '#3da9fc', '#2ec4b6', '#ffd166', '#9b5de5', '#ff8c42'];

/** Burst confetti from a screen point (defaults to centre). */
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
      size: 5 + Math.random() * 7,
      color: DISCIPLINE_COLORS[(Math.random() * DISCIPLINE_COLORS.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      life: 1,
    };
  });

  let frame = 0;
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;
    let alive = false;
    for (const p of parts) {
      p.vy += 0.28; // gravity
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 0.012;
      if (p.life <= 0 || p.y > window.innerHeight + 40) continue;
      alive = true;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
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

export function playBadge() {
  if (!soundOn()) return;
  const ac = ctx();
  if (ac && ac.state === 'suspended') ac.resume();
  blip(659.25, 0, 0.15, 'square', 0.12);
  blip(987.77, 0.12, 0.25, 'square', 0.12);
}

// ---- toasts ----------------------------------------------------------------

export function toast(html, { duration = 3800, icon = '' } = {}) {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = icon ? `<span class="toast-icon">${icon}</span><div>${html}</div>` : html;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 350);
  }, duration);
}
