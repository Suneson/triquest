// floor-paint-view.js — painting floor squares on the lawn and the club room floor (docs/FLOOR-PAINT.md).
//
// The paint is drawn as one SVG in the room's picture (under the floor's lines and the items): a group
// with the floor's own tile-to-picture matrix, so a tile is a 1 × 1 square in it and each material's
// texture, a pattern REPEAT tiles wide, is laid on in the floor's perspective. Painting: pick a material in
// the tray, then hold and drag over the floor (diorama-view.js hands the finger's tiles here). Two fingers
// still pan and zoom: the stroke they started is taken back.

import * as store from './store.js';
import { t } from '../core/i18n.js';
import { esc } from './ui.js';
import { haptic } from './haptics.js';
import { ROOM_GEOMETRY, tileToPct } from '../core/placement.js';
import { MATERIALS, REPEAT, kindOf, texture, swatch, keyOf, paintable, clean, line, rect, shapes } from '../core/floor-paint.js';

const KEY = 'floorPaint';   // settings: { [geom]: { 'u,v': material } }
const all = () => store.getSettings()[KEY] || {};
/** A floor's saved paint, made safe. */
export const paintOf = (geom) => clean(all()[geom], ROOM_GEOMETRY[geom], kindOf(geom));

const mode = { on: false, geom: null, mat: null, tool: 'brush', undo: [] };
let live = null;      // the paint while a stroke is going: { geom, paint, before }
let last = null;      // drawPaint's last arguments, to redraw during a stroke
const rerender = () => document.dispatchEvent(new CustomEvent('dg-room', { bubbles: true }));

/** Is the paint tray open (on this floor)? */
export const painting = (geom) => mode.on && (!geom || mode.geom === geom);

export function openPaint(geom) {
  Object.assign(mode, { on: true, geom, mat: mode.geom === geom && mode.mat ? mode.mat : MATERIALS[kindOf(geom)][0], tool: 'brush', undo: [] });
  rerender();
}
export function closePaint() { mode.on = false; live = null; rerender(); }

/** The tray along the bottom while painting: materials, the tools, undo and done. */
export function trayHtml(geom) {
  if (!painting(geom)) return '';
  const mats = MATERIALS[kindOf(geom)];
  const tool = (id, ico) => `<button class="fp-tool${mode.tool === id ? ' is-on' : ''}" data-fp-tool="${id}" aria-pressed="${mode.tool === id}" aria-label="${esc(t(`floorPaint.${id}`))}">${ico}<span>${esc(t(`floorPaint.${id}`))}</span></button>`;
  return `<div class="fp-tray" role="toolbar" aria-label="${esc(t('floorPaint.title'))}">
    <div class="fp-mats">${mats.map((m) => `<button class="fp-mat${mode.mat === m && mode.tool !== 'erase' ? ' is-on' : ''}" data-fp-mat="${m}" aria-label="${esc(t(`floorPaint.mat.${m}`))}"
      aria-pressed="${mode.mat === m}"><img src="${swatch(m)}" alt="" width="56" height="56" draggable="false"><span>${esc(t(`floorPaint.mat.${m}`))}</span></button>`).join('')}</div>
    <div class="fp-tools">
      ${tool('brush', '<i class="fp-ico is-brush"></i>')}${tool('rect', '<i class="fp-ico is-rect"></i>')}${tool('erase', '<i class="fp-ico is-erase"></i>')}
      <button class="fp-tool" data-fp-undo ${mode.undo.length ? '' : 'disabled'} aria-label="${esc(t('floorPaint.undo'))}"><i class="fp-ico is-undo"></i><span>${esc(t('floorPaint.undo'))}</span></button>
      <button class="fp-done" data-fp-done>${esc(t('floorPaint.done'))}</button>
    </div>
  </div>`;
}

/** The tray's taps (wired once per render by diorama-view.js). */
export function wireTray(root) {
  root.querySelector('.fp-tray')?.addEventListener('click', (e) => {
    const b = (s) => e.target.closest(s);
    if (b('[data-fp-done]')) { haptic('tick'); closePaint(); return; }
    if (b('[data-fp-undo]')) {
      const prev = mode.undo.pop();
      if (prev) { save(mode.geom, prev); haptic('tick'); }
      return;
    }
    const m = b('[data-fp-mat]');
    if (m) { mode.mat = m.dataset.fpMat; if (mode.tool === 'erase') mode.tool = 'brush'; haptic('select'); rerender(); return; }
    const tl = b('[data-fp-tool]');
    if (tl) { mode.tool = tl.dataset.fpTool; haptic('select'); rerender(); }
  });
}

const save = (geom, paint) => store.setSetting(KEY, { ...all(), [geom]: paint });

// ---- a stroke (diorama-view.js: the finger's tile, { u, v } whole tiles, or null off the floor) ----

function put(tiles) {
  const g = ROOM_GEOMETRY[live.geom];
  for (const [u, v] of tiles) {
    if (!paintable(g, u, v)) continue;
    if (mode.tool === 'erase') delete live.paint[keyOf(u, v)]; else live.paint[keyOf(u, v)] = mode.mat;
  }
}
export function strokeStart(geom, tile) {
  const before = paintOf(geom);
  live = { geom, paint: { ...before }, before, a: tile, at: tile };
  if (tile) { put([[tile.u, tile.v]]); haptic('select'); }
  redraw();
}
export function strokeMove(tile) {
  if (!live || !tile) return;
  if (live.at && tile.u === live.at.u && tile.v === live.at.v) return;
  if (mode.tool === 'rect') {
    live.paint = { ...live.before }; live.a ||= tile;
    put(rect(live.a, tile));
  } else put(line(live.at || tile, tile));
  live.at = tile;
  redraw();
}
export function strokeEnd() {
  if (!live) return;
  const { geom, paint, before } = live; live = null;
  if (JSON.stringify(paint) === JSON.stringify(before)) { redraw(); return; }
  mode.undo.push(before); if (mode.undo.length > 20) mode.undo.shift();
  haptic('place');
  save(geom, paint);
}
/** Two fingers came down: the stroke is taken back (they pan and zoom). */
export function strokeCancel() { live = null; redraw(); }

// ---- drawing ----

const redraw = () => { if (last) drawPaint(...last); };

/** Draw a floor's paint in its picture (`artEl`, `rw` × `rh` px). */
export function drawPaint(artEl, geom, rw, rh) {
  last = [artEl, geom, rw, rh];
  const g = ROOM_GEOMETRY[geom];
  const paint = live?.geom === geom ? live.paint : paintOf(geom);
  const on = painting(geom);
  let el = artEl.querySelector('.dg-paint');
  if (!g || (!Object.keys(paint).length && !on)) { el?.remove(); return; }
  const { fills, edges } = shapes(paint);
  const key = `${geom}|${rw}x${rh}|${on}|${JSON.stringify(fills)}`;
  if (el?.dataset.key === key) return;
  // the floor's matrix: tile (u, v) to the picture's px (the lawn is level: no lift)
  const at = (u, v) => { const p = tileToPct(geom, u, v, [-1, -1]); return [(p.x / 100) * rw, (p.y / 100) * rh]; };
  const [x0, y0] = at(0, 0); const [ux, uy] = at(1, 0); const [vx, vy] = at(0, 1);
  const m = [ux - x0, uy - y0, vx - x0, vy - y0, x0, y0].map((n) => +n.toFixed(4)).join(' ');
  const defs = Object.keys(fills).map((mat) => `<pattern id="fp-${mat}" patternUnits="userSpaceOnUse" width="${REPEAT}" height="${REPEAT}">
      <image href="${texture(mat)}" width="${REPEAT}" height="${REPEAT}" preserveAspectRatio="none"/></pattern>`).join('');
  const cols = g.limit ?? g.cols; const rows = g.limit ?? g.rows;
  const html = `<svg viewBox="0 0 ${rw} ${rh}" aria-hidden="true"><defs>${defs}
      <pattern id="fp-grid" patternUnits="userSpaceOnUse" width="1" height="1"><path d="M0 0h1M0 0v1" fill="none" stroke="#fff" stroke-width=".04" opacity=".55"/></pattern></defs>
    <g transform="matrix(${m})">
      ${Object.entries(fills).map(([mat, d]) => `<path data-mat="${mat}" d="${d}" fill="url(#fp-${mat})"/>`).join('')}
      ${edges ? `<path class="fp-edge" d="${edges}"/>` : ''}
      ${on ? `<rect class="fp-grid" width="${cols}" height="${rows}" fill="url(#fp-grid)"/>` : ''}
    </g></svg>`;
  if (!el) {
    el = document.createElement('div');
    el.className = 'dg-paint';
    artEl.querySelector('img')?.after(el);
  }
  el.dataset.key = key;
  el.dataset.m = m;   // base-gl.js draws the same from these: the matrix, each material's path, the edges, the grid
  el.dataset.repeat = REPEAT;
  el.innerHTML = html;
}
