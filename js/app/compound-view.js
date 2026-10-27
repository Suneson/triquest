// compound-view.js — the Profile tab's base: the unified compound (docs/COMPOUND.md).
//
// One painted isometric room per discipline you train plus the locker room,
// locked together on black, in a viewport you pan (drag) and zoom (pinch,
// wheel, or the buttons). Items stand on the rooms' floor tiles and move the
// way a base-building game moves them:
//
//   tap an item       it bounces, a tick buzzes, four blue arrows show round its base
//   drag it           it lifts and follows the finger tile by tile; the tiles under
//                     it glow green where it can stand, red where it can't (walls,
//                     the pool's water, another item)
//   let go            on green it lands (thud, saved); on red it springs back
//   tap an arrow,     it moves one tile that way (the keyboard does the same with
//   or arrow keys     the arrow keys; Escape puts it down)
//   tap the floor     deselects
//
// The geometry and the rules are js/core/placement.js; positions are kept by
// placement-state.js. Under reduced motion nothing bounces, lifts or springs.

import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { t } from '../core/i18n.js';
import {
  compoundLayout, roomsOf, roomArt, ROOM_SIZE, SPORT_OF, ROOM_OF, DISCIPLINES, tileToPct, pctToTile, boxCorners, footprint,
  canPlace, placeablesFor, placeableById, resolvePlacements, depthOf, ROW_TUCK, normalizeDisciplines, ROOM_GEOMETRY,
} from '../core/placement.js';
import { sceneFor, propById } from '../core/scenes.js';
import { earnsXp } from '../core/scoring.js';
import { featsFor } from '../core/feats.js';
import { gearById } from '../core/gear.js';
import { building } from '../core/base.js';
import { quadrantLevel } from '../core/workshop.js';
import { gearState, gearEnabled, serverNow, sportLevelOf, refreshGear, unseenFinished } from './gear-state.js';
import { featAwards } from './feats-state.js';
import { resourceBars, clockLeft } from './gear-view.js';
import { savedPlacements, savePlacement } from './placement-state.js';
import { haptic } from './haptics.js';
import { playPlace, prefersReducedMotion } from './effects.js';
import * as store from './store.js';

const U = 1000;          // world px per column
const MIN_ZOOM = 0.85;   // × the fit scale
const MAX_ZOOM = 4;

// ---- which rooms ------------------------------------------------------------------------

/**
 * The disciplines in your compound: the ones you chose (Settings, or the
 * Rooms button), else the ones you've trained, else all four.
 */
export function compoundDisciplines(workouts) {
  const chosen = store.getSettings().disciplines;
  if (Array.isArray(chosen) && chosen.length) return normalizeDisciplines(chosen);
  const trained = new Set((workouts || []).filter((w) => w?.completed && earnsXp(w)).map((w) => ROOM_OF[w.type]).filter(Boolean));
  return normalizeDisciplines([...trained]);
}

const roomName = (room) => t(`cp.room.${room}`);
const itemName = (id) => t(`cp.item.${id}`);

// ---- the world, in px of a 1000-wide column -------------------------------------------

function worldOf(ctx) {
  const layout = compoundLayout(compoundDisciplines(ctx.workouts));
  const rooms = roomsOf(layout).map((r) => {
    const [w, h] = ROOM_SIZE[r.geom];
    const width = r.span * U;
    return { ...r, w: width, h: width * h / w };
  });
  let y = 0;
  layout.rows.forEach((_, i) => {
    const inRow = rooms.filter((r) => r.row === i);
    const rowH = Math.max(...inRow.map((r) => r.h));
    inRow.forEach((r) => { r.x = r.col * U; r.y = y; });
    y += rowH * (i === layout.rows.length - 1 ? 1 : 1 - ROW_TUCK);
  });
  return { layout, rooms, W: layout.cols * U, H: y };
}

function levelOf(room, ctx) {
  if (room === 'locker') return Math.max(1, Math.min(10, ctx.acct?.level || 1));
  const sport = SPORT_OF[room];
  return Math.min(10, sportLevelOf(sport, ctx.boost?.sportXp?.[sport] || 0).artLevel);
}

// ---- drawing ---------------------------------------------------------------------------

const pt = (p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
const poly = (corners, cls, extra = '') => `<polygon class="${cls}" points="${corners.map(pt).join(' ')}"${extra}/>`;

/** The four blue arrows round a footprint, each one tile out from its edge. */
function arrows(geom, it, p) {
  const { u, v } = p; const w = it.w; const h = it.h;
  const tri = (pts) => pts.map(([a, b]) => tileToPct(geom, a, b));
  const set = [
    ['+u', [[u + w + 0.95, v + h / 2], [u + w + 0.3, v + h / 2 - 0.4], [u + w + 0.3, v + h / 2 + 0.4]]],
    ['-u', [[u - 0.95, v + h / 2], [u - 0.3, v + h / 2 - 0.4], [u - 0.3, v + h / 2 + 0.4]]],
    ['+v', [[u + w / 2, v + h + 0.95], [u + w / 2 - 0.4, v + h + 0.3], [u + w / 2 + 0.4, v + h + 0.3]]],
    ['-v', [[u + w / 2, v - 0.95], [u + w / 2 - 0.4, v - 0.3], [u + w / 2 + 0.4, v - 0.3]]],
  ];
  return set.map(([dir, pts]) => poly(tri(pts), 'cp-arrow', ` data-nudge="${dir}" role="button" aria-label="${esc(t(`cp.nudge.${dir}`))}"`)).join('');
}

/** An item standing on its footprint: centred on it, its base on the front corner. */
function itemHtml(it, p, room, sel, artOpts) {
  const [, right, front, left] = boxCorners(room.geom, p.u, p.v, it.w, it.h);
  const width = (right.x - left.x) * (it.scale || 1.1);
  return `<button class="cp-item${sel ? ' is-sel' : ''}" data-item="${it.id}"
      style="--x:${((left.x + right.x) / 2).toFixed(3)}%;--y:${front.y.toFixed(3)}%;--w:${width.toFixed(3)}%;--lift:${it.lift || 0};z-index:${Math.round(10 + depthOf(it, p))}"
      aria-pressed="${sel}" aria-label="${esc(t(sel ? 'cp.itemSelAria' : 'cp.itemAria', { name: itemName(it.id), room: roomName(p.room) }))}">
    <img src="${esc(it.art(artOpts))}" alt="" draggable="false"></button>`;
}

/** The cyclist for your bike level (the animation; the kit you wear where it has a sprite). */
function riderArt(ctx) {
  const s = sceneFor('bike', levelOf('bike', ctx));
  return s?.entry?.char || '';
}

function plateHtml(room, ctx, s, now, wonIds) {
  const lvl = levelOf(room.room, ctx);
  if (room.room === 'locker') {
    return `<div class="cp-plates"><button class="cp-plate" data-action="open-inventory" aria-label="${esc(t('cp.lockerAria', { n: lvl }))}">
      <b>${esc(roomName('locker'))}</b><i class="data-num">${t('loop.quad.lv', { n: lvl })}</i></button></div>`;
  }
  const sport = SPORT_OF[room.room];
  const q = quadrantLevel(sport, s.inventory);
  const feats = [...featsFor(sport), ...featsFor('cross')];
  const won = feats.filter((f) => wonIds.has(f.id)).length;
  const job = building(s.jobs, now).find((j) => (gearById(j.item_id)?.sport || propById(j.item_id)?.sport) === sport);
  const end = job ? Date.parse(job.finishes_at) : 0;
  return `<div class="cp-plates">
    <button class="cp-plate" data-action="open-sport-levels" data-sport="${sport}" aria-label="${esc(t('cp.roomAria', { room: roomName(room.room), n: lvl, q: q.level }))}">
      <b>${esc(roomName(room.room))}</b><i class="data-num">${t('loop.quad.lv', { n: q.level })}</i></button>
    <button class="cp-chip" data-action="open-trophies" data-sport="${sport}" aria-label="${esc(t('feat.ui.boardAria', { n: won, total: feats.length }))}">${svg('trophy')}<b class="data-num">${won}</b></button>
    ${job ? `<span class="cp-chip is-job" aria-label="${esc(t('loop.base.buildingAria', { name: gearById(job.item_id)?.name || propById(job.item_id)?.name || '' }))}">${svg('wrench')}<b data-ws-left="${end}" class="data-num">${clockLeft(end - now)}</b></span>` : ''}
  </div>`;
}

function roomHtml(room, ctx, items, placements, sel, s, now, wonIds, artOpts) {
  const lvl = levelOf(room.room, ctx);
  const here = items.filter((it) => placements[it.id]?.room === room.room);
  const chosen = sel && placements[sel]?.room === room.room ? placeableById(sel) : null;
  return `<div class="cp-room is-${room.room}" data-room="${room.room}" data-geom="${room.geom}"
      style="left:${room.x}px;top:${room.y}px;width:${room.w}px;height:${room.h}px;--rw:${room.w};z-index:${(room.row + 1) * 100}">
    <img class="cp-room-art" src="${esc(roomArt(room.room, lvl, room.landscape))}" alt="${esc(t('cp.roomAlt', { room: roomName(room.room), n: lvl }))}" draggable="false">
    <svg class="cp-floor" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="${chosen ? 'false' : 'true'}">
      <g class="cp-cells"></g>
      ${chosen ? `<g class="cp-arrows">${arrows(room.geom, chosen, placements[sel])}</g>` : ''}
    </svg>
    ${here.map((it) => itemHtml(it, placements[it.id], room, sel === it.id, artOpts)).join('')}
    ${plateHtml(room, ctx, s, now, wonIds)}
  </div>`;
}

// ---- the screen -------------------------------------------------------------------------

const view = { s: 0, tx: 0, ty: 0, fit: 0, sel: null, key: '' };

/** The Profile tab: the compound with its HUD. */
export function renderCompound(ctx, avatarBtn = '') {
  const ready = unseenFinished().length;
  return `<section class="cp-screen" data-cp>
    <header class="cp-top">
      <h1 class="cp-title">${svg('home')} ${t('loop.base.title')}</h1>
      ${avatarBtn}
    </header>
    ${resourceBars(ctx.workouts, { cls: 'on-base cp-res' })}
    <div class="cp-viewport" data-cp-vp tabindex="0" role="application" aria-roledescription="${esc(t('cp.roledesc'))}" aria-label="${esc(t('cp.vpAria'))}">
      <div class="cp-world" data-cp-world></div>
      <p class="cp-hint" data-cp-hint aria-live="polite"></p>
    </div>
    <div class="cp-zoom" role="group" aria-label="${esc(t('cp.zoom'))}">
      <button class="cp-zbtn" data-cp-zoom="in" aria-label="${esc(t('cp.zoomIn'))}">+</button>
      <button class="cp-zbtn" data-cp-zoom="out" aria-label="${esc(t('cp.zoomOut'))}">−</button>
      <button class="cp-zbtn" data-cp-zoom="fit" aria-label="${esc(t('cp.zoomFit'))}">${svg('target')}</button>
    </div>
    <nav class="cp-acts" aria-label="${esc(t('cp.actsAria'))}">
      <button class="cp-act" data-action="open-inventory"><img src="icons/Pixelart/GEAR/btn-inventory.png" width="128" height="128" alt=""><span>${t('gear.inventory')}</span></button>
      <button class="cp-act" data-action="open-next">${svg('target')}<span>${t('loop.base.next')}</span></button>
      <button class="cp-act" data-action="open-rooms">${svg('home')}<span>${t('cp.rooms')}</span></button>
      <button class="cp-act" data-action="open-gear"><img src="icons/Pixelart/GEAR/btn-shop.png" width="128" height="128" alt=""><span>${t('gear.shop')}</span>${ready ? `<i class="pg-dot data-num" aria-label="${esc(t('loop.ws.readyN', { n: ready }))}">${ready}</i>` : ''}</button>
    </nav>
  </section>`;
}

/** Wire the compound in `root` (the view): draw the world and handle every gesture on it. */
export function wireCompound(root, ctx) {
  const vp = root.querySelector('[data-cp-vp]');
  const worldEl = root.querySelector('[data-cp-world]');
  const hint = root.querySelector('[data-cp-hint]');
  if (!vp || !worldEl) return;
  const reduced = () => prefersReducedMotion() || document.body.classList.contains('rm');
  const s = gearState();
  const inv = s.inventory;
  const world = worldOf(ctx);
  const items = placeablesFor(inv, world.rooms.map((r) => r.room));
  const artOpts = { inventory: inv, rider: riderArt(ctx) };
  let placements = resolvePlacements(world.layout, items, savedPlacements());
  if (view.sel && !placements[view.sel]) view.sel = null;
  const roomBy = (room) => world.rooms.find((r) => r.room === room);

  const draw = () => {
    const now = serverNow();
    const wonIds = new Set(featAwards().map((a) => a.featId));
    worldEl.style.width = `${world.W}px`;
    worldEl.style.height = `${world.H}px`;
    worldEl.innerHTML = world.rooms.map((r) => roomHtml(r, ctx, items, placements, view.sel, s, now, wonIds, artOpts)).join('');
  };
  const apply = () => {
    worldEl.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`;
    worldEl.style.setProperty('--s', String(view.s));
  };
  const fit = () => {
    const r = vp.getBoundingClientRect();
    const f = Math.min(r.width / world.W, r.height / world.H) * 0.98;
    view.fit = f; view.s = f;
    view.tx = (r.width - world.W * f) / 2; view.ty = (r.height - world.H * f) / 2;
  };
  const clampView = () => {
    const r = vp.getBoundingClientRect();
    view.s = Math.min(view.fit * MAX_ZOOM, Math.max(view.fit * MIN_ZOOM, view.s));
    const w = world.W * view.s; const h = world.H * view.s;
    const m = 60; // keep at least this much of the compound on screen
    view.tx = Math.min(r.width - m, Math.max(m - w, view.tx));
    view.ty = Math.min(r.height - m, Math.max(m - h, view.ty));
  };
  // a new layout (other rooms) fits again; otherwise keep where you were
  const key = `${world.layout.rows.map((row) => row.map((c) => c.room).join(',')).join('/')}`;
  draw();
  if (view.key !== key || !view.s) { fit(); view.key = key; }
  clampView();
  apply();

  const say = (msg) => { hint.textContent = msg; hint.classList.toggle('on', !!msg); };
  // picking something up when zoomed out brings it close enough to handle
  const focusOn = (id) => {
    const el = worldEl.querySelector(`[data-item="${id}"]`);
    if (!el || view.s >= view.fit * 1.8) return;
    const r = vp.getBoundingClientRect(); const e = el.getBoundingClientRect();
    if (!reduced()) {
      worldEl.classList.add('is-easing');
      setTimeout(() => worldEl.classList.remove('is-easing'), 280);
    }
    zoomAt(view.fit * 2.2, e.left + e.width / 2, e.top + e.height / 2);
    // then bring it to the middle
    const e2 = el.getBoundingClientRect();
    view.tx += r.left + r.width / 2 - (e2.left + e2.width / 2);
    view.ty += r.top + r.height * 0.45 - (e2.top + e2.height / 2);
    clampView(); apply();
  };
  const select = (id) => {
    view.sel = id;
    draw();
    focusOn(id);
    const el = worldEl.querySelector(`[data-item="${id}"]`);
    if (el && !reduced()) { el.classList.remove('bounce'); void el.offsetWidth; el.classList.add('bounce'); }
    haptic('select');
    say(id ? t('cp.selHint', { name: itemName(id) }) : '');
    el?.focus({ preventScroll: true });
  };
  const deselect = () => { if (!view.sel) return; view.sel = null; draw(); say(''); };

  // pointer → world px → a room and a fractional tile on its floor
  const toWorld = (cx, cy) => {
    const r = vp.getBoundingClientRect();
    return { x: (cx - r.left - view.tx) / view.s, y: (cy - r.top - view.ty) / view.s };
  };
  const tileAt = (cx, cy, it) => {
    const p = toWorld(cx, cy);
    // the frontmost room whose floor is under the point
    for (const room of [...world.rooms].sort((a, b) => b.row - a.row)) {
      const px = ((p.x - room.x) / room.w) * 100; const py = ((p.y - room.y) / room.h) * 100;
      if (px < 0 || px > 100 || py < 0 || py > 100) continue;
      const f = pctToTile(room.geom, px, py);
      const u = Math.round(f.u - it.w / 2); const v = Math.round(f.v - it.h / 2);
      if (f.u >= -0.5 && f.v >= -0.5) return { room, u, v };
    }
    return null;
  };

  // the glow under a dragged item: green where it can stand, red where it can't
  const showCells = (room, it, u, v, ok) => {
    worldEl.querySelectorAll('.cp-cells').forEach((g) => { g.innerHTML = ''; });
    if (!room) return;
    const g = worldEl.querySelector(`.cp-room[data-room="${room.room}"] .cp-cells`);
    if (g) g.innerHTML = footprint(it, u, v).map(([a, b]) => poly(boxCorners(room.geom, a, b), `cp-cell ${ok ? 'is-ok' : 'is-bad'}`)).join('');
  };
  // the item follows the finger: moved into the room it's over, at that tile
  const moveEl = (el, it, room, u, v) => {
    const host = worldEl.querySelector(`.cp-room[data-room="${room.room}"]`);
    if (host && el.parentElement !== host) host.appendChild(el);
    const [, right, front, left] = boxCorners(room.geom, u, v, it.w, it.h);
    el.style.setProperty('--x', `${((left.x + right.x) / 2).toFixed(3)}%`);
    el.style.setProperty('--y', `${front.y.toFixed(3)}%`);
    el.style.setProperty('--w', `${((right.x - left.x) * (it.scale || 1.1)).toFixed(3)}%`);
    el.style.zIndex = String(Math.round(10 + depthOf(it, { u, v })));
  };

  const place = (id, to) => {
    placements = { ...placements, [id]: to };
    savePlacement(id, to);
    haptic('place');
    playPlace();
    draw();
    const el = worldEl.querySelector(`[data-item="${id}"]`);
    if (el && !reduced()) el.classList.add('landed');
    say(t('cp.placed', { name: itemName(id), room: roomName(to.room) }));
  };
  const refuse = (reason) => { haptic('refuse'); say(t(`cp.why.${reason || 'bounds'}`)); };

  // one tile along an axis (the arrows and the arrow keys)
  const nudge = (dir) => {
    const id = view.sel; if (!id) return;
    const it = placeableById(id); const p = placements[id]; const room = roomBy(p.room);
    const to = { room: p.room, u: p.u + (dir === '+u' ? 1 : dir === '-u' ? -1 : 0), v: p.v + (dir === '+v' ? 1 : dir === '-v' ? -1 : 0) };
    const c = canPlace(room.geom, room.room, it, to.u, to.v, placements);
    if (c.ok) place(id, to); else refuse(c.reason);
  };

  // ---- gestures ----
  const pts = new Map();
  let g = null; // { mode: 'pan' | 'drag' | 'tap' | 'pinch', ... }
  vp.onpointerdown = (e) => {
    if (e.button !== undefined && e.button > 0) return;
    if (e.target.closest('.cp-plates')) return; // the plates are plain buttons
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      // two fingers: pinch to zoom, whatever the first one was doing
      if (g?.mode === 'drag') cancelDrag();
      const [a, b] = [...pts.values()];
      g = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), s0: view.s, tx0: view.tx, ty0: view.ty, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    if (pts.size > 2) return;
    const nud = e.target.closest('[data-nudge]');
    if (nud) { g = { mode: 'nudge', dir: nud.dataset.nudge, x0: e.clientX, y0: e.clientY }; return; }
    const itemEl = e.target.closest('[data-item]');
    vp.setPointerCapture?.(e.pointerId);
    if (itemEl && itemEl.dataset.item === view.sel) {
      const it = placeableById(view.sel);
      g = { mode: 'drag', id: view.sel, it, el: itemEl, from: placements[view.sel], at: placements[view.sel], ok: true, x0: e.clientX, y0: e.clientY, moved: false };
      itemEl.classList.add('is-lift');
      return;
    }
    g = { mode: 'pan', item: itemEl?.dataset.item || null, x0: e.clientX, y0: e.clientY, tx0: view.tx, ty0: view.ty, moved: false };
  };
  vp.onpointermove = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!g) return;
    if (g.mode === 'pinch' && pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(g.s0 * (d / Math.max(1, g.d0)), g.mx, g.my, g);
      return;
    }
    const dx = e.clientX - g.x0; const dy = e.clientY - g.y0;
    if (Math.hypot(dx, dy) > 6) g.moved = true;
    if (g.mode === 'pan' && g.moved) {
      view.tx = g.tx0 + dx; view.ty = g.ty0 + dy; clampView(); apply();
    } else if (g.mode === 'drag' && g.moved) {
      g.cx = e.clientX; g.cy = e.clientY;
      if (!g.edgeLoop) g.edgeLoop = requestAnimationFrame(edgePan);
      track(g);
    }
  };
  // near the edge while carrying something, the view scrolls that way, so an
  // item can go to a room that's off screen
  const edgePan = () => {
    if (!g || g.mode !== 'drag') return;
    const r = vp.getBoundingClientRect(); const m = 44; const k = 10;
    const dx = g.cx < r.left + m ? k : g.cx > r.right - m ? -k : 0;
    const dy = g.cy < r.top + m ? k : g.cy > r.bottom - m ? -k : 0;
    if (dx || dy) { view.tx += dx; view.ty += dy; clampView(); apply(); track(g); }
    g.edgeLoop = requestAnimationFrame(edgePan);
  };
  // the carried item follows the point under the finger, tile by tile
  const track = (d) => {
    const hit = tileAt(d.cx, d.cy, d.it);
    if (!hit) { d.ok = false; d.el.classList.add('is-bad'); showCells(null); return; }
    const c = canPlace(hit.room.geom, hit.room.room, d.it, hit.u, hit.v, placements);
    // off the floor entirely: hold it at the nearest edge tile, in red
    const gm = ROOM_GEOMETRY[hit.room.geom];
    const u = Math.max(0, Math.min(hit.u, gm.cols - d.it.w));
    const v = Math.max(0, Math.min(hit.v, gm.rows - d.it.h));
    d.at = { room: hit.room.room, u: c.ok ? hit.u : u, v: c.ok ? hit.v : v };
    d.ok = c.ok; d.why = c.reason;
    d.el.classList.toggle('is-bad', !c.ok);
    moveEl(d.el, d.it, hit.room, d.at.u, d.at.v);
    showCells(hit.room, d.it, d.at.u, d.at.v, c.ok);
    worldEl.querySelectorAll('.cp-arrows').forEach((el) => { el.style.display = 'none'; });
  };
  const end = (e) => {
    pts.delete(e.pointerId);
    if (!g) return;
    if (g.mode === 'pinch') { if (pts.size < 2) g = null; return; }
    const done = g; g = null;
    if (done.edgeLoop) cancelAnimationFrame(done.edgeLoop);
    if (done.mode === 'nudge') { nudge(done.dir); return; }
    if (done.mode === 'drag') {
      done.el.classList.remove('is-lift', 'is-bad');
      showCells(null);
      if (!done.moved) { draw(); return; }
      const same = done.at && done.at.room === done.from.room && done.at.u === done.from.u && done.at.v === done.from.v;
      if (done.ok && !same) { place(done.id, done.at); return; }
      // back where it came from, with a spring
      const room = roomBy(done.from.room);
      if (!reduced()) done.el.classList.add('spring');
      moveEl(done.el, done.it, room, done.from.u, done.from.v);
      if (!done.ok) refuse(done.why);
      setTimeout(draw, reduced() ? 0 : 420);
      return;
    }
    if (done.mode === 'pan' && !done.moved) {
      if (done.item) select(done.item); else deselect();
    }
  };
  vp.onpointerup = end;
  vp.onpointercancel = (e) => {
    if (g?.mode === 'drag') cancelDrag();
    pts.delete(e.pointerId); g = null;
  };
  const cancelDrag = () => { const d = g; g = null; if (!d) return; if (d.edgeLoop) cancelAnimationFrame(d.edgeLoop); d.el.classList.remove('is-lift'); showCells(null); draw(); };

  const zoomAt = (s, cx, cy, from = null) => {
    const r = vp.getBoundingClientRect();
    const ox = cx - r.left; const oy = cy - r.top;
    const s0 = from ? from.s0 : view.s; const tx0 = from ? from.tx0 : view.tx; const ty0 = from ? from.ty0 : view.ty;
    const ns = Math.min(view.fit * MAX_ZOOM, Math.max(view.fit * MIN_ZOOM, s));
    view.tx = ox - (ox - tx0) * (ns / s0); view.ty = oy - (oy - ty0) * (ns / s0); view.s = ns;
    clampView(); apply();
  };
  vp.onwheel = (e) => { e.preventDefault(); zoomAt(view.s * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); };
  root.querySelectorAll('[data-cp-zoom]').forEach((b) => {
    b.onclick = () => {
      const r = vp.getBoundingClientRect();
      if (b.dataset.cpZoom === 'fit') { fit(); clampView(); apply(); return; }
      zoomAt(view.s * (b.dataset.cpZoom === 'in' ? 1.4 : 1 / 1.4), r.left + r.width / 2, r.top + r.height / 2);
    };
  });

  // the keyboard: Enter/Space on an item selects it; arrows move the selected one; Escape lets go
  vp.onkeydown = (e) => {
    const itemEl = e.target.closest?.('[data-item]');
    if ((e.key === 'Enter' || e.key === ' ') && itemEl) { e.preventDefault(); select(itemEl.dataset.item); return; }
    if (!view.sel) return;
    const dir = { ArrowRight: '+u', ArrowLeft: '-u', ArrowDown: '+v', ArrowUp: '-v' }[e.key];
    if (dir) { e.preventDefault(); nudge(dir); worldEl.querySelector(`[data-item="${view.sel}"]`)?.focus({ preventScroll: true }); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); deselect(); }
  };
  // a click on an item's button (keyboard, screen readers) selects it too
  worldEl.onclick = (e) => {
    const itemEl = e.target.closest('[data-item]');
    if (itemEl && e.detail === 0) select(itemEl.dataset.item);
  };

  // the workshop countdowns on the plates
  clearInterval(view.tick);
  view.tick = setInterval(() => {
    if (!root.isConnected) { clearInterval(view.tick); return; }
    const els = root.querySelectorAll('[data-cp] [data-ws-left]');
    const now = serverNow();
    let fin = false;
    els.forEach((el) => { const left = Number(el.dataset.wsLeft) - now; if (left <= 0) fin = true; el.textContent = clockLeft(left); });
    if (fin) { clearInterval(view.tick); if (gearEnabled()) refreshGear(); }
  }, 1000);
}

/** Forget the selection (leaving the tab). */
export const resetCompound = () => { view.sel = null; };

export { DISCIPLINES as COMPOUND_DISCIPLINES };
