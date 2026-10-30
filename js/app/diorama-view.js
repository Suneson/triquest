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
import { fitOf } from '../core/item-fit.js';
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
import { boardCount, openMissionBoard, BOARD_ART } from './missions-view.js';
import { mountRunner, webglOk } from './runner3d.js';
import { isChestAdmin } from './chests-state.js';
import { isDemo } from './demo.js';

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

// the room buttons: the shop's game tabs (css/tabs.css), each with its sport's
// icon (tools/cut-shop-ui.py); the locker room is the same plate, wide
const SPORT_ART = { bike: 'sport-bike', pool: 'sport-swim', run: 'sport-run', gym: 'sport-gym', locker: 'sport-locker' };
const btnArt = (room) => `icons/UI/sports/${SPORT_ART[room]}.webp`;

function roomNav(active) {
  const btn = (room) => `<button class="dg-room game-tab${room === active ? ' is-on' : ''}${room === 'locker' ? ' is-wide' : ''}" data-room-go="${room}"
      aria-pressed="${room === active}"><img src="${btnArt(room)}" width="128" height="128" alt="" draggable="false"><span>${t(`cp.nav.${room}`)}</span></button>`;
  return `<nav class="dg-rooms" aria-label="${esc(t('cp.roomsAria'))}">
    <div class="dg-rooms-row">${STAGE_ROOMS.filter((r) => r !== 'locker').map(btn).join('')}</div>
    ${btn('locker')}
  </nav>`;
}

/** The GYM tab (it was Profile). */
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
    <button class="dg-act" data-dg-act hidden></button>
    <div class="dg-side is-left">
      <button class="dg-round" data-action="open-inventory" aria-label="${esc(t('gear.inventory'))}"><img src="icons/Pixelart/GEAR/btn-inventory.png" width="128" height="128" alt=""></button>
      <button class="dg-round is-small" data-action="open-next" aria-label="${esc(t('loop.base.next'))}">${svg('target')}</button>
    </div>
    <div class="dg-side is-right">
      <button class="dg-round" data-action="open-gear" aria-label="${esc(t('gear.shop'))}"><img src="icons/Pixelart/GEAR/btn-shop.png" width="128" height="128" alt="">${ready ? `<i class="pg-dot" aria-label="${esc(t('loop.ws.readyN', { n: ready }))}">${ready}</i>` : ''}</button>
    </div>
    ${room === 'run' && (isChestAdmin() || isDemo()) ? turnBar() : ''}
    ${roomNav(room)}
  </section>`;
}

// ---- the 3D runner on the treadmill (runner3d.js) -----------------------------------------

const YAW_KEY = 'moske-runner-yaw';
const runnerYaw = () => { try { return Number(localStorage.getItem(YAW_KEY)) || 0; } catch { return 0; } };
const saveYaw = (deg) => { try { localStorage.setItem(YAW_KEY, String(deg)); } catch { /* private mode */ } };

/** Admins: turn the runner 45° at a time, to check how it sits on the belt. */
const turnBar = () => `<div class="dg-turn" role="group" aria-label="${esc(t('cp.r3d.aria'))}">
    <button data-r3d-turn="-45" aria-label="${esc(t('cp.r3d.left'))}">${svg('back')}<span>${t('cp.r3d.left')}</span></button>
    <b data-r3d-angle>${runnerYaw()}°</b>
    <button data-r3d-turn="45" aria-label="${esc(t('cp.r3d.right'))}"><span>${t('cp.r3d.right')}</span>${svg('back')}</button>
  </div>`;

/**
 * Put the runner on a treadmill item's element (once), sized by the room's floor:
 * the canvas lives inside the element, so it moves and stacks with it.
 */
function placeRunner(el, it, p, geom, src, still) {
  if (el._r3d || !webglOk()) return;
  const a = roomPctToWorld(geom, ...Object.values(tileToPct(geom, p.u, p.v)));
  const b1 = roomPctToWorld(geom, ...Object.values(tileToPct(geom, p.u + 1, p.v)));
  const c = roomPctToWorld(geom, ...Object.values(tileToPct(geom, p.u + it.w / 2, p.v + it.h / 2)));
  const box = itemBox(it, p, geom, src);
  const img = el.querySelector('img');
  const aspect = img?.naturalWidth ? img.naturalHeight / img.naturalWidth : 609 / 768;
  const H = box.w * aspect;
  // the footprint's centre, in the element's own px (its box is the picture's)
  const anchor = { x: c[0] - (box.x - box.w / 2), y: c[1] - (box.y - H * (1 - box.pad)) };
  el._r3d = mountRunner(el, { tile: { ux: Math.abs(b1[0] - a[0]), uy: b1[1] - a[1] }, anchor, yaw: (runnerYaw() * Math.PI) / 180, still });
}

// ---- the stage ---------------------------------------------------------------------------

const view = { v: null, sel: null, tick: null };
// the world's DOM, kept between renders (see wireDiorama)
const stage = { world: null, gen: 0 };

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

/**
 * Where an item stands in the world. Its picture is set down inside its
 * footprint, concentric with it: the object's base covers `fit` of the
 * footprint (0.8 by default), so it sits within the blue lines, its foot on the
 * front corner of that smaller diamond. The picture's own measures (item-fit.js)
 * say how wide the object is inside the file and how much empty space is under it.
 * Returns the picture's box (x, y = the object's foot, w) and the floor shadow.
 */
function itemBox(it, p, geom, src) {
  const pts = boxCorners(geom, p.u, p.v, it.w, it.h).map((c) => roomPctToWorld(geom, c.x, c.y));
  const xs = pts.map((q) => q[0]); const ys = pts.map((q) => q[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
  const fit = it.fit ?? 0.8;
  const f = fitOf(src);
  const w = ((maxX - minX) * fit) / f.w;
  return { x: cx + (0.5 - f.mid) * w, y: cy + ((maxY - minY) / 2) * fit, w, pad: f.pad, cx, cy, sw: (maxX - minX) * fit, sh: (maxY - minY) * fit };
}

/** Wire the stage in `root` (the view). */
export function wireDiorama(root, ctx) {
  const vp = root.querySelector('[data-dg-vp]');
  let worldEl = root.querySelector('[data-dg-world]');
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

  // The world is built once and kept across renders (the app re-renders the
  // whole tab often): the terrain and the room stay painted, the floor's lines
  // are redrawn, items are moved in place and a new room's art only goes up
  // once it's decoded. Nothing ever flashes to the background colour.
  if (stage.world && stage.world !== worldEl) { worldEl.replaceWith(stage.world); worldEl = stage.world; }
  stage.world = worldEl;
  const gen = ++stage.gen;
  if (!worldEl.querySelector('.dg-env')) {
    worldEl.innerHTML = `<img class="dg-env" src="${ENV.src}" width="${ENV.w}" height="${ENV.h}" alt="" draggable="false">
      <div class="dg-room-art"><img alt="" draggable="false">
        <svg class="dg-floor" viewBox="0 0 100 100" preserveAspectRatio="none"><g class="dg-cells"></g><g class="dg-arrows"></g></svg>
      </div>
      <div class="dg-shadows"></div>
      <div class="dg-items"></div>`;
  }
  // an item's picture and its shadow on the floor move together
  const moveEl = (el, it, u, v) => {
    const b = itemBox(it, { u, v }, geom, it.art(artOpts));
    el.style.left = `${b.x.toFixed(1)}px`; el.style.top = `${b.y.toFixed(1)}px`; el.style.width = `${b.w.toFixed(1)}px`;
    el.style.setProperty('--lift', b.pad);
    el.style.zIndex = String(it.flat ? 1 : Math.round(b.y));
    const sh = worldEl.querySelector(`.dg-shadow[data-for="${it.id}"]`);
    if (sh) Object.assign(sh.style, { left: `${b.cx.toFixed(1)}px`, top: `${b.cy.toFixed(1)}px`, width: `${b.sw.toFixed(1)}px`, height: `${b.sh.toFixed(1)}px` });
  };
  const board = boardCount(ctx.workouts);
  const draw = () => {
    const shown = roomImg.getAttribute('src') === src;
    const here = shown ? items.filter((it) => placements[it.id]?.room === room) : [];
    const chosen = shown && view.sel ? placeableById(view.sel) : null;
    worldEl.querySelector('.dg-cells').innerHTML = chosen ? footprint(chosen, placements[view.sel].u, placements[view.sel].v).map(([a, b]) => poly(boxCorners(geom, a, b), 'dg-cell is-ok')).join('') : '';
    const ar = worldEl.querySelector('.dg-arrows');
    ar.innerHTML = chosen ? arrows(geom, chosen, placements[view.sel]) : '';
    ar.style.display = '';
    // items: keep each one's node (and its decoded picture), update it in place
    const layer = worldEl.querySelector('.dg-items');
    const keep = new Set(here.map((it) => it.id));
    layer.querySelectorAll('[data-item]').forEach((el) => { if (!keep.has(el.dataset.item)) { el._r3d?.dispose(); el.remove(); } });
    const shadows = worldEl.querySelector('.dg-shadows');
    shadows.querySelectorAll('[data-for]').forEach((el) => { if (!keep.has(el.dataset.for)) el.remove(); });
    for (const it of here) {
      let el = layer.querySelector(`[data-item="${it.id}"]`);
      if (!el) {
        el = document.createElement('button');
        el.dataset.item = it.id;
        el.innerHTML = '<img alt="" draggable="false">';
        layer.append(el);
      }
      if (!it.flat && !shadows.querySelector(`[data-for="${it.id}"]`)) {
        const sh = document.createElement('i');
        sh.className = 'dg-shadow'; sh.dataset.for = it.id;
        shadows.append(sh);
      }
      const p = placements[it.id]; const sel = view.sel === it.id;
      el.className = `dg-item${sel ? ' is-sel' : ''}`;
      moveEl(el, it, p.u, p.v);
      el.setAttribute('aria-pressed', String(sel));
      el.setAttribute('aria-label', t(sel ? 'cp.itemSelAria' : 'cp.itemAria', { name: itemName(it.id), room: roomName(p.room) }));
      const img = el.querySelector('img'); const a = it.art(artOpts);
      if (img.getAttribute('src') !== a) img.src = a;
      if (it.runner3d) {
        const go = () => placeRunner(el, it, p, geom, a, reduced());
        if (img.complete && img.naturalWidth) go(); else img.addEventListener('load', go, { once: true });
      }
      // the mission board carries this week's count
      if (it.opens === 'missions') {
        let tag = el.querySelector('.dg-tag');
        if (!tag) { tag = document.createElement('i'); tag.className = 'dg-tag'; el.append(tag); }
        tag.textContent = `${board.done}/${board.total}`;
        tag.classList.toggle('is-all', board.done === board.total);
      }
    }
    // a picked-up item that opens something shows the way in
    const act = root.querySelector('[data-dg-act]');
    const opens = chosen?.opens;
    act.hidden = !opens;
    if (opens) act.innerHTML = `<img src="${BOARD_ART}" width="28" height="28" alt="">${esc(t('mission.ui.open'))} <b>${board.done}/${board.total}</b>`;
  };

  const box = () => vp.getBoundingClientRect();
  const apply = () => {
    const r = box();
    view.v = clampView(view.v || homeView(r.width, r.height), r.width, r.height);
    worldEl.style.transform = `translate(${view.v.tx}px, ${view.v.ty}px) scale(${view.v.s})`;
  };
  const artEl = worldEl.querySelector('.dg-room-art');
  const roomImg = artEl.querySelector('img');
  const src = roomArt(room, levelOf(room, ctx));
  const showRoom = () => {
    artEl.className = `dg-room-art is-${room}`;
    artEl.style.width = `${rw}px`; artEl.style.height = `${rh}px`;
    artEl.style.transform = `matrix(${M.map((n) => +n.toFixed(5)).join(',')})`;
    roomImg.alt = t('cp.roomAlt', { room: roomName(room), n: levelOf(room, ctx) });
  };
  if (roomImg.getAttribute('src') !== src) {
    const next = new Image(); next.src = src;
    const swap = () => { if (stage.gen !== gen) return; roomImg.src = src; showRoom(); draw(); };
    (next.decode ? next.decode() : Promise.resolve()).then(swap, swap);
    if (!roomImg.getAttribute('src')) swap();
  } else showRoom();

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
      // a second tap on a picked-up board opens it
      if (!done.moved) { draw(); if (done.it.opens === 'missions') openMissionBoard(ctx); return; }
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

  root.querySelector('[data-dg-act]').onclick = () => { haptic('tick'); openMissionBoard(ctx); };
  root.querySelectorAll('[data-r3d-turn]').forEach((b) => b.addEventListener('click', () => {
    const deg = (((runnerYaw() + Number(b.dataset.r3dTurn)) % 360) + 360) % 360;
    saveYaw(deg);
    root.querySelector('[data-r3d-angle]').textContent = `${deg}°`;
    worldEl.querySelectorAll('.dg-item').forEach((el) => el._r3d?.setYaw((deg * Math.PI) / 180));
    haptic('tick');
  }));

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
