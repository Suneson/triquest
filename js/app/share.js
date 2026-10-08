// share.js — the session-complete share card. Drawn on a canvas with image
// smoothing off, so the pixel art stays hard-edged: the sport's scene at the
// athlete's current level, the session's numbers, the level chip and the MOSKE
// wordmark. Two sizes: 1080×1350 (feed) and 1080×1920 (story). Offered through
// the Web Share API with files; anywhere that can't share files gets downloads.
//
// Both cards are rendered when the sheet opens, so the share button can call
// navigator.share() straight from the tap (iOS needs the user gesture intact).

import { svg } from '../core/icons.js';
import { sceneFor, cornerPolygon } from '../core/scenes.js';
import { sportProgress, xpForWorkout } from '../core/scoring.js';
import { DISCIPLINES } from '../core/disciplines.js';
import { shortLabel } from '../core/dates.js';
import { esc } from './ui.js';
import { toast } from './effects.js';

const C = {
  bg: '#0B1222', bg2: '#121C33', bg3: '#1A2744', line: '#5372B5', shade: '#050912',
  fg: '#F2F5FC', muted: '#9AA8C7', accent: '#F2C14E', accentLo: '#B98A1E', onAccent: '#1A1205',
};
const PIXEL = "'Silkscreen', ui-monospace, monospace";
const DATA = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const load = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`could not load ${src}`));
  img.src = src;
});

/** A pixel icon from icons.js as an image, in one colour, at 16×`scale` px. */
function iconImage(name, color, scale) {
  const s = svg(name).replace('fill="currentColor"', `fill="${color}"`)
    .replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${16 * scale}" height="${16 * scale}" `);
  return load(`data:image/svg+xml,${encodeURIComponent(s)}`);
}

/** The pixel frame: a 4px border with one-step notched corners and a hard drop edge. */
function frame(g, x, y, w, h, { fill = C.bg2, border = C.line, edge = C.shade, px = 4 } = {}) {
  g.fillStyle = edge; g.fillRect(x + px, y + h, w - 2 * px, px * 2);
  g.fillStyle = fill; g.fillRect(x + px, y + px, w - 2 * px, h - 2 * px);
  g.fillStyle = border;
  g.fillRect(x + px, y, w - 2 * px, px); g.fillRect(x + px, y + h - px, w - 2 * px, px);
  g.fillRect(x, y + px, px, h - 2 * px); g.fillRect(x + w - px, y + px, px, h - 2 * px);
}

/** The session's own numbers: Strava actuals when it was synced, else the plan. */
export function sessionNumbers(w) {
  const min = Math.round(Number(w.actual?.durationMin ?? w.durationMin) || 0);
  const km = Number(w.actual?.distanceKm ?? w.metrics?.distanceKm) || 0;
  return { min, km: km ? Math.round(km * 10) / 10 : 0, xp: xpForWorkout(w) };
}

// how far down each still the athlete sits (same values as the Home strip)
const FOCUS_Y = { run: 0.52, gym: 0.64, swim: 0.56 };

/** The iso corner covers that hide each still's baked-in label and generator
 *  mark (the same polygons the Profile stage uses), drawn in art coordinates. */
function coverCorners(g, e, ax, ay, aw, ah) {
  for (const c of e.corners || []) {
    const pts = [...cornerPolygon(c).matchAll(/([\d.]+)% ([\d.]+)%/g)].map((m) => [ax + (m[1] / 100) * aw, ay + (m[2] / 100) * ah]);
    if (!pts.length) continue;
    g.fillStyle = e.backdrop.bottom;
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath(); g.fill();
  }
}

async function drawScene(g, scene, x, y, maxW, maxH) {
  const e = scene.entry;
  if (scene.kind === 'still') {
    const art = await load(e.src);
    // whole-number scale only (2× for the 512px art), cropped around the athlete
    const s = Math.max(1, Math.floor(maxW / art.width));
    const w = art.width * s;
    const h = art.height * s;
    const ax = x + (maxW - w) / 2;
    const ay = Math.min(y, Math.max(y + maxH - h, y + maxH / 2 - h * (FOCUS_Y[scene.sport] ?? 0.5)));
    g.save();
    g.beginPath(); g.rect(x, y, maxW, maxH); g.clip();
    g.fillStyle = e.backdrop.top; g.fillRect(x, y, maxW, maxH / 2);
    g.fillStyle = e.backdrop.bottom; g.fillRect(x, y + maxH / 2, maxW, maxH / 2);
    g.drawImage(art, ax, ay, w, h);
    coverCorners(g, e, ax, ay, w, h);
    g.restore();
    return;
  }
  // the bike world (bg, platform, rider) at 2×, cropped to the box around the rider
  const [bg, plat, rider] = await Promise.all([load(e.bg), load(e.platform), load(e.char)]);
  const s = 2;
  const ww = 572 * s;
  const wh = 1024 * s;
  const ox = x + (maxW - ww) / 2;
  const oy = y + maxH / 2 - wh * 0.49;
  g.save();
  g.beginPath(); g.rect(x, y, maxW, maxH); g.clip();
  g.drawImage(bg, ox, oy, ww, wh);
  g.drawImage(plat, ox + ww * 0.065, oy + wh * 0.065, ww * 0.87, wh * 0.87);
  const cw = ww * 0.4;
  const ch = cw * (rider.height / rider.width);
  g.drawImage(rider, ox + ww * 0.5 - cw / 2, oy + wh * 0.49 - ch / 2, cw, ch);
  g.restore();
}

/**
 * Render one card. `tall` = 1080×1920 story, else 1080×1350 feed post.
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderShareCard(w, workouts, { tall = false } = {}) {
  const W = 1080;
  const H = tall ? 1920 : 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  await Promise.all([document.fonts.load(`700 56px ${PIXEL}`), document.fonts.load(`400 32px ${PIXEL}`)]).catch(() => {});

  const sport = w.type === 'brick' ? 'bike' : w.type;
  const prog = sportProgress(workouts, sport);
  const scene = sceneFor(sport, prog.level);
  const n = sessionNumbers(w);
  const d = DISCIPLINES[w.type] || DISCIPLINES.other;

  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);

  // top bar: wordmark left, level chip right
  const top = tall ? 120 : 48;
  g.fillStyle = C.fg; g.font = `700 56px ${PIXEL}`; g.textBaseline = 'top';
  g.fillText('MOSKE', 56, top + 8);
  if (scene) {
    const chip = `LVL ${prog.level}`;
    g.font = `400 40px ${PIXEL}`;
    const cw = Math.ceil(g.measureText(chip).width) + 48;
    frame(g, W - 56 - cw, top, cw, 72, { fill: C.accent, border: C.accent, edge: C.accentLo });
    g.fillStyle = C.onAccent; g.fillText(chip, W - 56 - cw + 24, top + 16);
  }

  // the scene
  const artY = top + 112;
  const artH = tall ? 1024 : 860;
  if (scene) {
    try { await drawScene(g, scene, 0, artY, W, artH); } catch { /* art missing offline: the card still works */ }
  }

  // the session panel
  const py = artY + artH + (tall ? 64 : 24);
  const ph = H - py - (tall ? 200 : 48);
  frame(g, 40, py, W - 80, ph);
  const icon = await iconImage(w.type in DISCIPLINES ? w.type : 'other', C.accent, tall ? 4 : 3).catch(() => null);
  const ix = 88;
  let ty = py + (tall ? 56 : 36);
  if (icon) g.drawImage(icon, ix, ty, icon.width, icon.height);
  g.fillStyle = C.accent; g.font = `400 ${tall ? 40 : 32}px ${PIXEL}`;
  g.fillText(`${d.label.toUpperCase()} · ${shortLabel(w.date).toUpperCase()}`, ix + (icon ? icon.width + 20 : 0), ty + (tall ? 12 : 8));
  ty += tall ? 96 : 72;
  // the title in the body font; long titles are cut with an ellipsis
  g.fillStyle = C.fg; g.font = `700 ${tall ? 56 : 44}px ${DATA}`;
  let title = w.title || d.label;
  while (g.measureText(title).width > W - 176 && title.length > 4) title = `${title.slice(0, -2).trimEnd()}…`;
  g.fillText(title, ix, ty);
  ty += tall ? 112 : 76;

  // numbers: training data in the system font, the XP in the pixel font
  const stats = [[n.min, 'min'], ...(n.km ? [[n.km, 'km']] : [])];
  let sx = ix;
  for (const [v, unit] of stats) {
    g.fillStyle = C.fg; g.font = `700 ${tall ? 120 : 80}px ${DATA}`;
    const vs = String(v);
    g.fillText(vs, sx, ty);
    const vw = g.measureText(vs).width;
    g.fillStyle = C.muted; g.font = `600 ${tall ? 40 : 32}px ${DATA}`;
    g.fillText(unit, sx + vw + 12, ty + (tall ? 70 : 44));
    sx += vw + 12 + g.measureText(unit).width + (tall ? 72 : 56);
  }
  g.fillStyle = C.accent; g.font = `400 ${tall ? 64 : 48}px ${PIXEL}`;
  const xp = `+${n.xp} XP`;
  g.fillText(xp, W - 88 - g.measureText(xp).width, ty + (tall ? 36 : 20));

  // story footer: the app's line, where a feed post has no room for it
  if (tall) {
    g.fillStyle = C.muted; g.font = `400 32px ${PIXEL}`;
    g.fillText('TRAINED WITH MOSKE', 56, H - 140);
  }
  return canvas;
}

const toBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

/** Open the share sheet for a completed session. */
export async function openShareSheet(w, workouts) {
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  const close = () => {
    root.querySelectorAll('img[data-url]').forEach((i) => URL.revokeObjectURL(i.dataset.url));
    root.innerHTML = ''; root.classList.remove('open');
  };
  root.innerHTML = `<div class="modal-backdrop" data-sh-close></div>
    <div class="modal sh-modal" role="dialog" aria-modal="true" aria-label="Share card">
      <header class="modal-head"><h2>${svg('upload')} Share card</h2><button class="icon-btn" data-sh-close aria-label="Close">${svg('close')}</button></header>
      <div class="modal-body" id="sh-body" aria-busy="true">
        <span class="sr">Drawing your card…</span>
        <div class="sh-preview is-sk"><div class="sk-tile"></div></div>
      </div>
    </div>`;
  root.querySelectorAll('[data-sh-close]').forEach((b) => b.addEventListener('click', close));

  let post; let story;
  try {
    [post, story] = await Promise.all([
      renderShareCard(w, workouts).then(toBlob),
      renderShareCard(w, workouts, { tall: true }).then(toBlob),
    ]);
  } catch {
    const body = document.getElementById('sh-body');
    if (body) { body.removeAttribute('aria-busy'); body.innerHTML = '<p class="muted">Couldn’t draw the card. Try again in a moment.</p>'; }
    return;
  }
  const body = document.getElementById('sh-body');
  if (!body || !post || !story) return;
  const base = `moske-${w.type}-${w.date}`;
  const files = { post: new File([post], `${base}-post.png`, { type: 'image/png' }), story: new File([story], `${base}-story.png`, { type: 'image/png' }) };
  const canShare = !!navigator.canShare?.({ files: [files.post] });
  const url = URL.createObjectURL(post);
  body.removeAttribute('aria-busy');
  body.innerHTML = `
    <div class="sh-preview"><img src="${url}" data-url="${url}" alt="Your share card: ${esc(w.title || '')}" width="1080" height="1350"></div>
    <div class="sh-actions">
      ${canShare
        ? `<button class="btn primary" data-sh="post">${svg('upload')} Share post</button><button class="btn" data-sh="story">${svg('upload')} Share story</button>`
        : `<a class="btn primary" data-dl="post" download="${files.post.name}">${svg('download')} Save post</a><a class="btn" data-dl="story" download="${files.story.name}">${svg('download')} Save story</a>`}
    </div>
    <p class="muted small">Post is 1080 × 1350, story is 1080 × 1920.</p>`;
  body.querySelectorAll('[data-dl]').forEach((a) => {
    const u = URL.createObjectURL(files[a.dataset.dl]);
    a.href = u;
    a.addEventListener('click', () => setTimeout(() => URL.revokeObjectURL(u), 4000), { once: true });
  });
  body.querySelectorAll('[data-sh]').forEach((b) => b.addEventListener('click', () => {
    navigator.share({ files: [files[b.dataset.sh]], title: 'MOSKE', text: `${w.title || 'Session'} · done` })
      .catch((e) => { if (e?.name !== 'AbortError') toast('Sharing didn’t work here. Try Save instead.'); });
  }));
}
