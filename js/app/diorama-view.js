// diorama-view.js — the Profile tab: one room at a time, standing in its plot
// on the generated terrain, under a bubbly game HUD (docs/COMPOUND.md).
//
//   top left      your badge: avatar, name, account level
//   top right     coins, carbs and stamina, as glossy capsule gauges
//   the stage     the room and the terrain in one world you pan and pinch;
//                 it never zooms out past the terrain (js/core/diorama.js)
//   bottom        a square button per sport and a wide Locker Room button
//
// Items stand on the room's 8×8 floor and move the way a base-building game
// moves them: tap to pick one up (it bounces, buzzes, shows its blue footprint
// and four arrows), drag it tile by tile (the footprint goes red over a wall,
// the pool's water or another item), let go to set it down (or it springs
// back), tap an arrow or press an arrow key to move it a tile, tap the floor
// to put it down. The floor rules are js/core/placement.js; positions are kept
// by placement-state.js. Under reduced motion nothing bounces, lifts or springs.

import { esc } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import {
  roomArt, ROOM_SIZE, SPORT_OF, tileToPct, pctToTile, boxCorners, footprint, canPlace, placeablesFor, placeableById,
  resolvePlacements, ROOM_GEOMETRY,
} from '../core/placement.js';
import { ENV, STAGE_ROOMS, stageGeom, roomPlacement, roomPctToWorld, worldToRoomPct, clampView, homeView, minZoom, MAX_ZOOM } from '../core/diorama.js';
import { STAMINA, staminaAt, freshStamina } from '../core/stamina.js';
import { sceneFor, propById } from '../core/scenes.js';
import { featsFor } from '../core/feats.js';
import { gearById } from '../core/gear.js';
import { building } from '../core/base.js';
import { quadrantLevel } from '../core/workshop.js';
import { gearState, gearEnabled, serverNow, sportLevelOf, refreshGear, unseenFinished, walletNow } from './gear-state.js';
import { featAwards } from './feats-state.js';
import { clockLeft } from './gear-view.js';
import { savedPlacements, savePlacement } from './placement-state.js';
import { currentUser } from './auth.js';
import { haptic } from './haptics.js';
import { playPlace, prefersReducedMotion } from './effects.js';
import * as store from './store.js';

const ROOM_KEY = 'moske-room';
const roomName = (room) => t(`cp.room.${room}`);
const itemName = (id) => t(`cp.item.${id}`);

/** The room on the stage (remembered on the device). */
export function activeRoom() {
  try { const r = localStorage.getItem(ROOM_KEY); if (STAGE_ROOMS.includes(r)) return r; } catch { /* private mode */ }
  return 'bike';
}
export function setActiveRoom(room) {
  if (!STAGE_ROOMS.includes(room)) return;
  try { localStorage.setItem(ROOM_KEY, room); } catch { /* private mode */ }
  view.sel = null;
  view.v = null; // a new room opens at its home view
}

function levelOf(room, ctx) {
  if (room === 'locker') return Math.max(1, Math.min(10, ctx.acct?.level || 1));
  const sport = SPORT_OF[room];
  return Math.min(10, sportLevelOf(sport, ctx.boost?.sportXp?.[sport] || 0).artLevel);
}

// every room, for working out where items stand (the locker is the square one on the stage)
const STAGE_LAYOUT = { rows: [STAGE_ROOMS.map((room, i) => ({ room, geom: stageGeom(room), col: i, span: 1, landscape: false }))] };

// ---- stamina: anchored once, then it fills on its own -----------------------------------

function staminaAnchor() {
  const a = store.getSettings().stamina;
  if (a && Number.isFinite(Number(a.at))) return a;
  const fresh = freshStamina(Date.now());
  store.setSetting('stamina', fresh);
  return fresh;
}

// ---- the HUD -----------------------------------------------------------------------------

function gauge(kind, value, max, icon, label) {
  const f = Math.max(0, Math.min(1, value / max));
  return `<div class="dg-gauge is-${kind}" role="img" aria-label="${esc(label)}" style="--f:${f.toFixed(4)}">
    <span class="dg-track"><i class="dg-fill"></i><b class="dg-num" data-dg-${kind}>${fmtNum(value)}</b></span>
    <img class="dg-ico" src="${icon}" width="64" height="64" alt="">
  </div>`;
}

function hud(ctx, avatarBtn) {
  const u = currentUser?.();
  const name = (u?.user_metadata?.display_name || u?.email?.split('@')[0] || t('pg.athlete')).trim();
  const w = gearEnabled() ? walletNow(ctx.workouts) : { coins: 0, carbs: 0, cap: 10000 };
  const st = staminaAt(staminaAnchor(), Date.now());
  return `<header class="dg-hud">
    <div class="dg-badge">${avatarBtn}<span class="dg-who"><b>${esc(name)}</b><i>${t('cp.lvl', { n: ctx.acct?.level || 1 })}</i></span></div>
    <div class="dg-gauges">
      ${gauge('coins', w.coins, w.cap, 'icons/Pixelart/GEAR/coin.png', t('cp.coinsAria', { n: fmtNum(w.coins) }))}
      ${gauge('carbs', w.carbs, w.cap, 'icons/Pixelart/GEAR/carbs.png', t('cp.carbsAria', { n: fmtNum(w.carbs) }))}
      ${gauge('stamina', st, STAMINA.max, 'icons/Pixelart/NEW/stamina-bolt.png', t('cp.staminaAria', { n: st, max: STAMINA.max }))}
    </div>
  </header>`;
}

/** The room's own plate: name and level, its trophies, and what's building for it. */
function roomPill(room, ctx) {
  const lvl = levelOf(room, ctx);
  if (room === 'locker') {
    return `<div class="dg-pill"><button class="dg-pill-name" data-action="open-inventory" aria-label="${esc(t('cp.lockerAria', { n: lvl }))}"><b>${esc(roomName('locker'))}</b><i>${t('loop.quad.lv', { n: lvl })}</i></button></div>`;
  }
  const s = gearState();
  const sport = SPORT_OF[room];
  const q = quadrantLevel(sport, s.inventory);
  const wonIds = new Set(featAwards().map((a) => a.featId));
  const feats = [...featsFor(sport), ...featsFor('cross')];
  const won = feats.filter((f) => wonIds.has(f.id)).length;
  const now = serverNow();
  const job = building(s.jobs, now).find((j) => (gearById(j.item_id)?.sport || propById(j.item_id)?.sport) === sport);
  const end = job ? Date.parse(job.finishes_at) : 0;
  return `<div class="dg-pill">
    <button class="dg-pill-name" data-action="open-sport-levels" data-sport="${sport}" aria-label="${esc(t('cp.roomAria', { room: roomName(room), n: lvl, q: q.level }))}"><b>${esc(roomName(room))}</b><i>${t('loop.quad.lv', { n: q.level })}</i></button>
    <button class="dg-pill-chip" data-action="open-trophies" data-sport="${sport}" aria-label="${esc(t('feat.ui.boardAria', { n: won, total: feats.length }))}">${svg('trophy')}<b>${won}</b></button>
    ${job ? `<span class="dg-pill-chip is-job" aria-label="${esc(t('loop.base.buildingAria', { name: gearById(job.item_id)?.name || propById(job.item_id)?.name || '' }))}">${svg('wrench')}<b data-ws-left="${end}">${clockLeft(end - now)}</b></span>` : ''}
  </div>`;
}

function roomNav(active) {
  const btn = (room) => `<button class="dg-room${room === active ? ' is-on' : ''}${room === 'locker' ? ' is-wide' : ''}" data-room-go="${room}"
      aria-pressed="${room === active}">${svg(room === 'locker' ? 'backpack' : SPORT_OF[room])}<span>${t(`cp.nav.${room}`)}</span></button>`;
  return `<nav class="dg-rooms" aria-label="${esc(t('cp.roomsAria'))}">
    <div class="dg-rooms-row">${STAGE_ROOMS.filter((r) => r !== 'locker').map(btn).join('')}</div>
    ${btn('locker')}
  </nav>`;
}

/** The Profile tab. */
export function renderDiorama(ctx, avatarBtn = '') {
  const room = activeRoom();
  const ready = unseenFinished().length;
  return `<section class="dg-screen" data-dg>
    <div class="dg-viewport" data-dg-vp tabindex="0" role="application" aria-roledescription="${esc(t('cp.roledesc'))}" aria-label="${esc(t('cp.vpAria'))}">
      <div class="dg-world" data-dg-world style="width:${ENV.w}px;height:${ENV.h}px"></div>
    </div>
    ${hud(ctx, avatarBtn)}
    ${roomPill(room, ctx)}
    <p class="dg-hint" data-dg-hint aria-live="polite"></p>
    <div class="dg-side is-left">
      <button class="dg-round" data-action="open-inventory" aria-label="${esc(t('gear.inventory'))}"><img src="icons/Pixelart/GEAR/btn-inventory.png" width="128" height="128" alt=""></button>
      <button class="dg-round is-small" data-action="open-next" aria-label="${esc(t('loop.base.next'))}">${svg('target')}</button>
    </div>
    <div class="dg-side is-right">
      <button class="dg-round" data-action="open-gear" aria-label="${esc(t('gear.shop'))}"><img src="icons/Pixelart/GEAR/btn-shop.png" width="128" height="128" alt="">${ready ? `<i class="pg-dot" aria-label="${esc(t('loop.ws.readyN', { n: ready }))}">${ready}</i>` : ''}</button>
    </div>
    ${roomNav(room)}
  </section>`;
}

// ---- the stage ---------------------------------------------------------------------------

const view = { v: null, sel: null, tick: null };

const pt = (p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
const poly = (corners, cls, extra = '') => `<polygon class="${cls}" points="${corners.map(pt).join(' ')}"${extra}/>`;

/**
 * The four arrows round a footprint, flat on the floor: chunky arrows one tile
 * out from each side, pointing away along the floor's axes (NE, SE, SW, NW).
 */
function arrows(geom, it, p) {
  const { u, v } = p; const w = it.w; const h = it.h;
  // an arrow in floor units along axis a (the other axis b), from `from` outwards by `dir`
  const arrow = (axis, dir, mid) => {
    const base = dir > 0 ? (axis === 'u' ? u + w : v + h) + 0.2 : (axis === 'u' ? u : v) - 0.2;
    const shape = [[0, -0.18], [0.45, -0.18], [0.45, -0.42], [0.95, 0], [0.45, 0.42], [0.45, 0.18], [0, 0.18]];
    return shape.map(([a, b]) => {
      const along = base + a * dir;
      return axis === 'u' ? tileToPct(geom, along, mid + b) : tileToPct(geom, mid + b, along);
    });
  };
  const set = [['+u', arrow('u', 1, v + h / 2)], ['-u', arrow('u', -1, v + h / 2)], ['+v', arrow('v', 1, u + w / 2)], ['-v', arrow('v', -1, u + w / 2)]];
  return set.map(([dir, pts]) => poly(pts, 'dg-arrow', ` data-nudge="${dir}" role="button" aria-label="${esc(t(`cp.nudge.${dir}`))}"`)).join('');
}

/** Where an item stands in the world: on its footprint's front corner, as wide as the footprint × its scale. */
function itemBox(it, p, geom) {
  const pts = boxCorners(geom, p.u, p.v, it.w, it.h).map((c) => roomPctToWorld(geom, c.x, c.y));
  const xs = pts.map((q) => q[0]); const ys = pts.map((q) => q[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  return { x: (minX + maxX) / 2, y: Math.max(...ys), w: (maxX - minX) * (it.scale || 1.1) };
}

function itemHtml(it, p, geom, sel, artOpts) {
  const b = itemBox(it, p, geom);
  return `<button class="dg-item${sel ? ' is-sel' : ''}" data-item="${it.id}"
      style="left:${b.x.toFixed(1)}px;top:${b.y.toFixed(1)}px;width:${b.w.toFixed(1)}px;--lift:${it.lift || 0};z-index:${Math.round(b.y)}"
      aria-pressed="${sel}" aria-label="${esc(t(sel ? 'cp.itemSelAria' : 'cp.itemAria', { name: itemName(it.id), room: roomName(p.room) }))}">
    <img src="${esc(it.art(artOpts))}" alt="" draggable="false"></button>`;
}

/** Wire the stage in `root` (the view). */
export function wireDiorama(root, ctx) {
  const vp = root.querySelector('[data-dg-vp]');
  const worldEl = root.querySelector('[data-dg-world]');
  const hint = root.querySelector('[data-dg-hint]');
  if (!vp || !worldEl) return;
  const reduced = () => prefersReducedMotion() || document.body.classList.contains('rm');
  const room = activeRoom();
  const geom = stageGeom(room);
  const s = gearState();
  const inv = s.inventory;
  const items = placeablesFor(inv, STAGE_ROOMS);
  const artOpts = { inventory: inv, rider: sceneFor('bike', levelOf('bike', ctx))?.entry?.char || '' };
  let placements = resolvePlacements(STAGE_LAYOUT, items, savedPlacements());
  if (view.sel && placements[view.sel]?.room !== room) view.sel = null;
  const [rw, rh] = ROOM_SIZE[geom];
  const M = roomPlacement(geom);

  const draw = () => {
    const here = items.filter((it) => placements[it.id]?.room === room);
    const chosen = view.sel ? placeableById(view.sel) : null;
    worldEl.innerHTML = `<img class="dg-env" src="${ENV.src}" width="${ENV.w}" height="${ENV.h}" alt="" draggable="false">
      <div class="dg-room-art is-${room}" style="width:${rw}px;height:${rh}px;transform:matrix(${M.map((n) => +n.toFixed(5)).join(',')})">
        <img src="${esc(roomArt(room, levelOf(room, ctx)))}" alt="${esc(t('cp.roomAlt', { room: roomName(room), n: levelOf(room, ctx) }))}" draggable="false">
        <svg class="dg-floor" viewBox="0 0 100 100" preserveAspectRatio="none">
          <g class="dg-cells">${chosen ? footprint(chosen, placements[view.sel].u, placements[view.sel].v).map(([a, b]) => poly(boxCorners(geom, a, b), 'dg-cell is-ok')).join('') : ''}</g>
          ${chosen ? `<g class="dg-arrows">${arrows(geom, chosen, placements[view.sel])}</g>` : ''}
        </svg>
      </div>
      <div class="dg-items">${here.map((it) => itemHtml(it, placements[it.id], geom, view.sel === it.id, artOpts)).join('')}</div>`;
  };

  const box = () => vp.getBoundingClientRect();
  const apply = () => {
    const r = box();
    view.v = clampView(view.v || homeView(r.width, r.height), r.width, r.height);
    worldEl.style.transform = `translate(${view.v.tx}px, ${view.v.ty}px) scale(${view.v.s})`;
  };
  draw();
  apply();

  const say = (msg) => { hint.textContent = msg; hint.classList.toggle('on', !!msg); };
  const zoomAt = (ns, cx, cy, from = null) => {
    const r = box();
    const ox = cx - r.left; const oy = cy - r.top;
    const v0 = from || view.v;
    const lo = minZoom(r.width, r.height);
    const s1 = Math.min(lo * MAX_ZOOM, Math.max(lo, ns));
    view.v = { s: s1, tx: ox - (ox - v0.tx) * (s1 / v0.s), ty: oy - (oy - v0.ty) * (s1 / v0.s) };
    apply();
  };
  const select = (id) => {
    view.sel = id;
    draw();
    const el = worldEl.querySelector(`[data-item="${id}"]`);
    // picking something up from far away brings it closer
    const r = box(); const lo = minZoom(r.width, r.height);
    if (el && view.v.s < lo * 1.5) {
      if (!reduced()) { worldEl.classList.add('is-easing'); setTimeout(() => worldEl.classList.remove('is-easing'), 280); }
      const e = el.getBoundingClientRect();
      zoomAt(lo * 1.8, e.left + e.width / 2, e.top + e.height / 2);
    }
    if (el && !reduced()) { el.classList.remove('bounce'); void el.offsetWidth; el.classList.add('bounce'); }
    haptic('select');
    say(t('cp.selHint', { name: itemName(id) }));
    el?.focus({ preventScroll: true });
  };
  const deselect = () => { if (!view.sel) return; view.sel = null; draw(); say(''); };

  const toWorld = (cx, cy) => { const r = box(); return { x: (cx - r.left - view.v.tx) / view.v.s, y: (cy - r.top - view.v.ty) / view.v.s }; };
  const tileAt = (cx, cy, it) => {
    const p = toWorld(cx, cy);
    const q = worldToRoomPct(geom, p.x, p.y);
    const f = pctToTile(geom, q.x, q.y);
    return { u: Math.round(f.u - it.w / 2), v: Math.round(f.v - it.h / 2) };
  };
  const showCells = (it, u, v, ok) => {
    const g = worldEl.querySelector('.dg-cells');
    if (g) g.innerHTML = it ? footprint(it, u, v).map(([a, b]) => poly(boxCorners(geom, a, b), `dg-cell ${ok ? 'is-ok' : 'is-bad'}`)).join('') : '';
  };
  const moveEl = (el, it, u, v) => {
    const b = itemBox(it, { u, v }, geom);
    el.style.left = `${b.x.toFixed(1)}px`; el.style.top = `${b.y.toFixed(1)}px`; el.style.width = `${b.w.toFixed(1)}px`;
    el.style.zIndex = String(Math.round(b.y));
  };
  const place = (id, to) => {
    placements = { ...placements, [id]: to };
    savePlacement(id, to);
    haptic('place');
    playPlace();
    draw();
    const el = worldEl.querySelector(`[data-item="${id}"]`);
    if (el && !reduced()) el.classList.add('landed');
    say(t('cp.placed', { name: itemName(id), room: roomName(room) }));
  };
  const refuse = (reason) => { haptic('refuse'); say(t(`cp.why.${reason || 'bounds'}`)); };
  const nudge = (dir) => {
    const id = view.sel; if (!id) return;
    const it = placeableById(id); const p = placements[id];
    const to = { room, u: p.u + (dir === '+u' ? 1 : dir === '-u' ? -1 : 0), v: p.v + (dir === '+v' ? 1 : dir === '-v' ? -1 : 0) };
    const c = canPlace(geom, room, it, to.u, to.v, placements);
    if (c.ok) place(id, to); else refuse(c.reason);
  };

  // ---- gestures ----
  const pts = new Map();
  let g = null;
  vp.onpointerdown = (e) => {
    if (e.button !== undefined && e.button > 0) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      if (g?.mode === 'drag') cancelDrag();
      const [a, b] = [...pts.values()];
      g = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), from: { ...view.v }, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    if (pts.size > 2) return;
    const nud = e.target.closest('[data-nudge]');
    if (nud) { g = { mode: 'nudge', dir: nud.dataset.nudge, x0: e.clientX, y0: e.clientY }; return; }
    const itemEl = e.target.closest('[data-item]');
    vp.setPointerCapture?.(e.pointerId);
    if (itemEl && itemEl.dataset.item === view.sel) {
      g = { mode: 'drag', id: view.sel, it: placeableById(view.sel), el: itemEl, from: placements[view.sel], at: placements[view.sel], ok: true, x0: e.clientX, y0: e.clientY, moved: false };
      itemEl.classList.add('is-lift');
      return;
    }
    g = { mode: 'pan', item: itemEl?.dataset.item || null, x0: e.clientX, y0: e.clientY, from: { ...view.v }, moved: false };
  };
  vp.onpointermove = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!g) return;
    if (g.mode === 'pinch' && pts.size === 2) {
      const [a, b] = [...pts.values()];
      zoomAt(g.from.s * (Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, g.d0)), g.mx, g.my, g.from);
      return;
    }
    const dx = e.clientX - g.x0; const dy = e.clientY - g.y0;
    if (Math.hypot(dx, dy) > 6) g.moved = true;
    if (g.mode === 'pan' && g.moved) {
      view.v = { ...g.from, tx: g.from.tx + dx, ty: g.from.ty + dy }; apply();
    } else if (g.mode === 'drag' && g.moved) {
      g.cx = e.clientX; g.cy = e.clientY;
      if (!g.edgeLoop) g.edgeLoop = requestAnimationFrame(edgePan);
      track(g);
    }
  };
  const edgePan = () => {
    if (!g || g.mode !== 'drag') return;
    const r = box(); const m = 44; const k = 10;
    const dx = g.cx < r.left + m ? k : g.cx > r.right - m ? -k : 0;
    const dy = g.cy < r.top + m ? k : g.cy > r.bottom - m ? -k : 0;
    if (dx || dy) { view.v = { ...view.v, tx: view.v.tx + dx, ty: view.v.ty + dy }; apply(); track(g); }
    g.edgeLoop = requestAnimationFrame(edgePan);
  };
  // the carried item snaps from tile to tile under the finger; off the floor it
  // holds at the nearest edge tile, red
  const track = (d) => {
    const hit = tileAt(d.cx, d.cy, d.it);
    const gm = ROOM_GEOMETRY[geom];
    const c = canPlace(geom, room, d.it, hit.u, hit.v, placements);
    const u = Math.max(0, Math.min(hit.u, gm.cols - d.it.w));
    const v = Math.max(0, Math.min(hit.v, gm.rows - d.it.h));
    d.at = { room, u: c.ok ? hit.u : u, v: c.ok ? hit.v : v };
    d.ok = c.ok; d.why = c.reason;
    d.el.classList.toggle('is-bad', !c.ok);
    moveEl(d.el, d.it, d.at.u, d.at.v);
    showCells(d.it, d.at.u, d.at.v, c.ok);
    const ar = worldEl.querySelector('.dg-arrows'); if (ar) ar.style.display = 'none';
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
      if (!done.moved) { draw(); return; }
      const same = done.at.u === done.from.u && done.at.v === done.from.v;
      if (done.ok && !same) { place(done.id, done.at); return; }
      // back to where it was, with an elastic spring
      if (!reduced()) done.el.classList.add('spring');
      moveEl(done.el, done.it, done.from.u, done.from.v);
      showCells(done.it, done.from.u, done.from.v, true);
      if (!done.ok) refuse(done.why);
      setTimeout(draw, reduced() ? 0 : 460);
      return;
    }
    if (done.mode === 'pan' && !done.moved) { if (done.item) select(done.item); else deselect(); }
  };
  vp.onpointerup = end;
  vp.onpointercancel = (e) => { if (g?.mode === 'drag') cancelDrag(); pts.delete(e.pointerId); g = null; };
  const cancelDrag = () => { const d = g; g = null; if (!d) return; if (d.edgeLoop) cancelAnimationFrame(d.edgeLoop); d.el.classList.remove('is-lift'); draw(); };
  vp.onwheel = (e) => { e.preventDefault(); zoomAt(view.v.s * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); };
  vp.onkeydown = (e) => {
    const itemEl = e.target.closest?.('[data-item]');
    if ((e.key === 'Enter' || e.key === ' ') && itemEl) { e.preventDefault(); select(itemEl.dataset.item); return; }
    if (!view.sel) return;
    const dir = { ArrowRight: '+u', ArrowLeft: '-u', ArrowDown: '+v', ArrowUp: '-v' }[e.key];
    if (dir) { e.preventDefault(); nudge(dir); worldEl.querySelector(`[data-item="${view.sel}"]`)?.focus({ preventScroll: true }); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); deselect(); }
  };
  worldEl.onclick = (e) => { const it = e.target.closest('[data-item]'); if (it && e.detail === 0) select(it.dataset.item); };

  // the rooms
  root.querySelectorAll('[data-room-go]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.roomGo === activeRoom()) return;
      setActiveRoom(b.dataset.roomGo);
      haptic('tick');
      root.dispatchEvent(new CustomEvent('dg-room', { bubbles: true }));
    };
  });

  // stamina fills and the workshop counts down by the second
  clearInterval(view.tick);
  const anchor = staminaAnchor();
  view.tick = setInterval(() => {
    if (!root.isConnected) { clearInterval(view.tick); return; }
    const st = staminaAt(anchor, Date.now());
    const sg = root.querySelector('.dg-gauge.is-stamina');
    if (sg) { sg.style.setProperty('--f', (st / STAMINA.max).toFixed(4)); sg.querySelector('[data-dg-stamina]').textContent = fmtNum(st); sg.setAttribute('aria-label', t('cp.staminaAria', { n: st, max: STAMINA.max })); }
    const now = serverNow();
    let fin = false;
    root.querySelectorAll('[data-ws-left]').forEach((el) => { const left = Number(el.dataset.wsLeft) - now; if (left <= 0) fin = true; el.textContent = clockLeft(left); });
    if (fin && gearEnabled()) refreshGear();
  }, 1000);
}

/** Forget the selection (leaving the tab). */
export const resetDiorama = () => { view.sel = null; };
