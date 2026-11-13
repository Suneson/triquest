// room-gl.js: the three.js test room (docs/THREE-ROOM.md).
//
// The room on the stage, drawn by three.js on one canvas instead of as web page pictures: the
// painted room, its items and your athlete walking among them, all in one scene, drawn straight
// into the page (gl-shared.js borrow: no copy). It's a test of how smooth the base can be on a
// game renderer before moving the base over. Turned on per device with ?three=1 (off: ?three=0);
// a "3D test" button then shows on the base.
//
// The scene: one unit is one floor tile, X along u (to the right corner), Z along v (to the left
// corner), Y up, as in runner3d.js. The camera is orthographic, 45° round and tilted to the art's
// slant, so the athlete stands on the painted floor. The painted room is a picture stuck to the
// camera, far back, laid so its floor's corners fall exactly on the scene's floor corners. Each
// item is its picture on a card facing the camera, standing at its footprint's middle, so the
// athlete walks in front of and behind it. Panning and zooming move the camera's window, not
// the scene.
//
// You can pan, pinch (or wheel) to zoom, tap an item to pick it up, drag it tile by tile and let
// go to set it down (saved as on the base). The top bar counts frames a second and draw calls.

import { openLayer } from './nav.js';
import { esc } from './ui.js';
import { t } from '../core/i18n.js';
import { ROOM_GEOMETRY, tileToPct, footprint } from '../core/placement.js';
import { fitOf } from '../core/item-fit.js';
import { roomCopy } from '../core/room-art.js';
import { findPath, wanderTile, facing, entryTile } from '../core/walk.js';
import { needsFull } from '../core/expansions.js';
import { loadThree } from './runner3d.js';
import { haptic } from './haptics.js';

/** The athlete's size, as on the base (walker.js SPOT): `scale` in the old runner's units. */
const ATH_SCALE = 2.52 / (1.8 / 1.85);
/** Tiles a second, as on the base. */
const SPEED = 2.5;
const REST = [4, 10];
/** The most frames a second it draws (a 120 Hz phone would otherwise draw twice as often). */
const FPS = 60;
/** The closest zoom: one tile across is this many CSS px. */
const TILE_MAX_PX = 56;

/**
 * Open the test room.
 *   room, geom      the room on the stage and its floor (placement.js ROOM_GEOMETRY)
 *   title           what the top bar says
 *   src, full       the room's picture now, and its sharp one (loaded once you zoom in far enough)
 *   items           [{ it, p, src }]: each item in the room (oriented), where it stands, its picture
 *   canPlace(it, u, v, placements)  → { ok, reason }
 *   save(id, p)     an item set down somewhere new
 *   grid(placements) the room's walkable grid (walk.js floorGrid)
 *   start           the tile the athlete starts on, or null
 *   char            the athlete (diorama-view.js athlete())
 *   reduced         reduced motion: the athlete stands, nothing bounces
 */
export function openRoomGL(o) {
  let closed = false;
  let stop = () => {};
  const root = openLayer('room-gl', { className: 'rg-layer', onClose: () => { closed = true; stop(); } });
  root.innerHTML = `<div class="fh-screen rg-screen" role="dialog" aria-modal="true" aria-label="${esc(o.title)}">
    <div class="rg-stage" data-rg-stage><p class="rg-msg" data-rg-msg>${esc(t('wardrobe.loading'))}</p></div>
    <header class="rg-top"><b>${esc(o.title)}</b><span class="data-num" data-rg-fps></span></header>
    <p class="rg-hint" data-rg-hint aria-live="polite"></p>
    <div class="sh-footbar" aria-hidden="true"></div>
    <button type="button" class="sh-close" data-layer-close><span>${esc(t('sheet.close'))}</span></button>
  </div>`;
  const stageEl = root.querySelector('[data-rg-stage]');
  const fpsEl = root.querySelector('[data-rg-fps]');
  const hintEl = root.querySelector('[data-rg-hint]');
  const say = (m) => { hintEl.textContent = m; hintEl.classList.toggle('on', !!m); };

  start(o, { stageEl, fpsEl, say, closed: () => closed }).then((s) => {
    if (!s) return;
    if (closed) s(); else stop = s;
  }).catch((e) => {
    console.warn('three.js test room', e);
    const msg = root.querySelector('[data-rg-msg]');
    if (msg) msg.textContent = `Couldn't start: ${e.message || e}`;
  });
  return root;
}

const loadTex = (THREE, url) => new THREE.TextureLoader().loadAsync(url).then((tx) => {
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
});

// a picture's alpha, small, for telling a tap on the item from a tap on its empty corners
function alphaOf(img) {
  const N = 64;
  const c = document.createElement('canvas'); c.width = N; c.height = N;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, N, N);
  const d = x.getImageData(0, 0, N, N).data;
  return (s, t) => d[(Math.min(N - 1, Math.floor(t * N)) * N + Math.min(N - 1, Math.floor(s * N))) * 4 + 3];
}

// a soft round shadow, drawn once
function blobTexture(THREE) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(8,10,20,.55)'); g.addColorStop(0.6, 'rgba(8,10,20,.28)'); g.addColorStop(1, 'rgba(8,10,20,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}

async function start(o, { stageEl, fpsEl, say, closed }) {
  const L = await loadThree();
  const { THREE } = L;
  const g = ROOM_GEOMETRY[o.geom];
  const bgTex = await loadTex(THREE, o.src);
  if (closed()) { bgTex.dispose(); return null; }
  const { borrow } = await import('./gl-shared.js');
  const gl = borrow(THREE);
  const { renderer, canvas } = gl;
  canvas.className = 'rg-canvas';
  stageEl.querySelector('[data-rg-msg]')?.remove();
  stageEl.append(canvas);
  renderer.setClearColor(0x16264d, 1);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = false;   // the room's picture, then the scene over it (frame)

  const disposables = [bgTex];
  const scene = new THREE.Scene();

  // ---- the camera, tilted to the art's slant ----
  const PW = bgTex.image.width, PH = bgTex.image.height;
  const px = (p) => [(p.x * PW) / 100, (p.y * PH) / 100];
  const b0 = px(tileToPct(o.geom, 0, 0)), bu = px(tileToPct(o.geom, g.cols, 0)), bv = px(tileToPct(o.geom, 0, g.rows));
  // a tile's edge rises sin(tilt) for every 1 across, on both of the floor's axes
  const slant = (Math.abs((bu[1] - b0[1]) / (bu[0] - b0[0])) + Math.abs((bv[1] - b0[1]) / (bv[0] - b0[0]))) / 2;
  const TILT = Math.asin(Math.min(0.95, slant));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  const target = new THREE.Vector3(g.cols / 2, 0, g.rows / 2);
  const dir = new THREE.Vector3(Math.cos(TILT) * Math.SQRT1_2, Math.sin(TILT), Math.cos(TILT) * Math.SQRT1_2);
  const DIST = 160;
  camera.position.copy(target).addScaledVector(dir, DIST);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  scene.add(camera);
  const inv = camera.matrixWorldInverse.clone();
  // a point of the scene in the camera's own frame: x right, y up, z towards you (−DIST at the floor's middle)
  const view = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(inv);

  // ---- the painted room: the picture laid so its floor corners land on the scene's ----
  // an affine map from the picture's px to the camera's frame, through three floor corners
  const q0 = view(0, 0, 0), qu = view(g.cols, 0, 0), qv = view(0, 0, g.rows);
  const e1 = [bu[0] - b0[0], bu[1] - b0[1]], e2 = [bv[0] - b0[0], bv[1] - b0[1]];
  const f1 = [qu.x - q0.x, qu.y - q0.y], f2 = [qv.x - q0.x, qv.y - q0.y];
  const det = e1[0] * e2[1] - e2[0] * e1[1];
  const ie = [[e2[1] / det, -e2[0] / det], [-e1[1] / det, e1[0] / det]];   // inverse of [e1 e2]
  const M = [
    [f1[0] * ie[0][0] + f2[0] * ie[1][0], f1[0] * ie[0][1] + f2[0] * ie[1][1]],
    [f1[1] * ie[0][0] + f2[1] * ie[1][0], f1[1] * ie[0][1] + f2[1] * ie[1][1]],
  ];
  const picToView = (x, y) => [q0.x + M[0][0] * (x - b0[0]) + M[0][1] * (y - b0[1]), q0.y + M[1][0] * (x - b0[0]) + M[1][1] * (y - b0[1])];
  const BG_Z = -(DIST + 80);
  const corners = [[0, 0], [PW, 0], [PW, PH], [0, PH]].map(([x, y]) => picToView(x, y));
  const bgGeo = new THREE.BufferGeometry();
  bgGeo.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap(([x, y]) => [x, y, BG_Z]), 3));
  bgGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  bgGeo.setIndex([0, 3, 1, 1, 3, 2]);
  const bgMat = new THREE.MeshBasicMaterial({ map: bgTex, transparent: true, depthWrite: false, depthTest: false });
  // drawn first, in a pass of its own: see-through at its edges, it would otherwise be drawn after
  // (and over) the athlete, who isn't see-through
  const bg = new THREE.Mesh(bgGeo, bgMat);
  bg.matrixAutoUpdate = false; bg.matrix.copy(camera.matrixWorld);   // the camera never moves, only its window
  const bgScene = new THREE.Scene(); bgScene.add(bg);
  disposables.push(bgGeo, bgMat);
  const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
  const pic = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };

  // ---- light, as runner3d.js ----
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const key = new THREE.DirectionalLight(0xfff5e6, 2.5); key.position.set(-2, 5, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6ea8ff, 1.8); rim.position.set(3, 3, -3); scene.add(rim);

  // ---- items ----
  const blob = blobTexture(THREE); disposables.push(blob);
  const card = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);   // its origin at its bottom middle
  const floorQuad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  disposables.push(card, floorQuad);
  let placements = Object.fromEntries(o.items.map((x) => [x.it.id, x.p]));
  const sprites = [];
  await Promise.all(o.items.map(async ({ it, src }) => {
    const tex = await loadTex(THREE, roomCopy(src)).catch(() => null);
    if (!tex) return;
    disposables.push(tex);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    disposables.push(mat);
    const mesh = new THREE.Mesh(card, mat);
    camera.add(mesh);
    let shadow = null;
    if (!it.flat) {
      const sm = new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false });
      disposables.push(sm);
      shadow = new THREE.Mesh(floorQuad, sm);
      shadow.renderOrder = -6;
      scene.add(shadow);
    }
    sprites.push({ it, src, mesh, shadow, aspect: tex.image.height / tex.image.width, alpha: alphaOf(tex.image), box: null, lift: 0, bounce: 0 });
  }));
  if (closed()) { cleanup(); return null; }

  // where an item's card stands, from its footprint (as diorama-view.js itemBox, in the camera's frame)
  const layoutItem = (s, p) => {
    const { it } = s;
    const pts = [[p.u, p.v], [p.u + it.w, p.v], [p.u + it.w, p.v + it.h], [p.u, p.v + it.h]].map(([u, v]) => view(u, 0, v));
    const cx0 = Math.min(...pts.map((q) => q.x)), cx1 = Math.max(...pts.map((q) => q.x));
    const cy0 = Math.min(...pts.map((q) => q.y)), cy1 = Math.max(...pts.map((q) => q.y));
    const fit = it.fit ?? 0.8;
    const f = fitOf(s.src);
    const w = ((cx1 - cx0) * fit) / f.w;
    const h = w * s.aspect;
    const footX = (cx0 + cx1) / 2 + (0.5 - f.mid) * w;
    const footY = (cy0 + cy1) / 2 - ((cy1 - cy0) / 2) * fit;
    const z = it.flat ? BG_Z + 1 : view(p.u + it.w / 2, 0, p.v + it.h / 2).z;
    s.box = { x: footX - w / 2, y: footY - f.pad * h, w, h, z };
    s.mesh.renderOrder = it.flat ? -8 : 0;
    if (s.shadow) {
      s.shadow.position.set(p.u + it.w / 2, 0.01, p.v + it.h / 2);
      s.shadow.scale.set(it.w * fit, 1, it.h * fit);
    }
  };
  const showItem = (s) => {
    const b = s.box;
    const k = 1 + 0.12 * Math.sin(Math.PI * Math.min(1, s.bounce));
    s.mesh.position.set(b.x + b.w / 2, b.y + s.lift, b.z);
    s.mesh.scale.set(b.w * (s.bounce > 0 && s.bounce < 1 ? k : 1), b.h * (s.bounce > 0 && s.bounce < 1 ? k : 1), 1);
  };
  for (const s of sprites) { layoutItem(s, placements[s.it.id]); showItem(s); }

  // the picked-up item's footprint, blue where it may stand and red where it may not
  const cellMat = new THREE.MeshBasicMaterial({ color: 0x3da9fc, transparent: true, opacity: 0.55, depthWrite: false });
  disposables.push(cellMat);
  const cells = new THREE.Group(); scene.add(cells);
  const showCells = (it, p, ok) => {
    cells.clear();
    if (!it) return;
    cellMat.color.set(ok ? 0x3da9fc : 0xff4d4d);
    for (const [u, v] of footprint(it, p.u, p.v)) {
      const m = new THREE.Mesh(floorQuad, cellMat);
      m.position.set(u + 0.5, 0.02, v + 0.5); m.scale.set(0.9, 1, 0.9); m.renderOrder = -5;
      cells.add(m);
    }
  };

  // ---- the athlete ----
  const { spawnChar } = await import('./char3d.js');
  const c = o.char;
  const uniforms = { uSkin: { value: new THREE.Vector3(...(c.skin || [1, 1, 1])) }, uEye: { value: new THREE.Vector3(...(c.eye || [0.3, 0.2, 0.1])) } };
  const figure = await spawnChar(L, { model: c.model, clips: c.clips, uniforms, gear: c.gear || [], hair: c.hair || null }).catch(() => null);
  if (closed()) { figure?.dispose(); cleanup(); return null; }
  const rig = new THREE.Group();
  const athShadow = new THREE.Mesh(floorQuad, new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }));
  disposables.push(athShadow.material);
  athShadow.renderOrder = -6; athShadow.scale.set(1.8, 1, 1.8);
  const grid = () => o.grid(placements);
  let pos = o.start && grid().free(...o.start) ? [...o.start] : entryTile(grid()) || [g.cols / 2, g.rows / 2];
  let path = []; let yaw = 0.6; let want = yaw;
  let restUntil = performance.now() + 1500;
  if (figure) {
    figure.root.scale.setScalar(ATH_SCALE);
    rig.add(figure.root); scene.add(rig); scene.add(athShadow);
    figure.play('idle', { fade: 0 });
  }
  const placeAth = () => {
    rig.position.set(pos[0] + 0.5, 0, pos[1] + 0.5);
    athShadow.position.set(pos[0] + 0.5, 0.012, pos[1] + 0.5);
    rig.rotation.y = yaw;
  };
  placeAth();
  const here = () => [Math.round(pos[0]), Math.round(pos[1])];
  const rest = () => { restUntil = performance.now() + (REST[0] + Math.random() * (REST[1] - REST[0])) * 1000; };
  const walkTo = (to) => {
    const p = findPath(grid(), here(), to);
    if (!p || p.length < 2) { rest(); return; }
    path = p.slice(1);
    figure?.play('walk', { fade: 0.2 });
  };
  const stepAthlete = (dt, now) => {
    if (!figure || o.reduced) return;
    if (path.length) {
      const [tu, tv] = path[0];
      const du = tu - pos[0], dv = tv - pos[1];
      const d = Math.hypot(du, dv); const step = SPEED * dt;
      if (d > 1e-6) want = facing(du, dv);
      if (d <= step) {
        pos = [tu, tv]; path.shift();
        if (!path.length) { figure.play('idle', { fade: 0.25 }); rest(); }
      } else pos = [pos[0] + (du / d) * step, pos[1] + (dv / d) * step];
    } else if (now > restUntil) {
      const gr = grid();
      const to = gr.free(...here()) ? wanderTile(gr, here()) : null;
      if (to) walkTo(to); else rest();
    }
    let a = want - yaw; a = Math.atan2(Math.sin(a), Math.cos(a));
    yaw += a * Math.min(1, dt * 10);
    placeAth();
  };

  // ---- the window onto the scene: pan and zoom ----
  let W = 1, H = 1, dpr = 1;
  const tileAcross = Math.hypot(view(1, 0, 0).x - q0.x, 0);   // one tile along u, across the screen
  const floorW = Math.abs(qu.x - qv.x);
  const cam = { x: (qu.x + qv.x) / 2, y: (q0.y + view(g.cols, 0, g.rows).y) / 2, k: 1 };
  const minK = () => W / (pic.x1 - pic.x0);
  const maxK = () => Math.max(minK(), TILE_MAX_PX / tileAcross);
  const clampCam = () => {
    cam.k = Math.min(maxK(), Math.max(minK(), cam.k));
    const hw = W / 2 / cam.k, hh = H / 2 / cam.k;
    const fitAxis = (c, lo, hi, half) => (hi - lo <= half * 2 ? (lo + hi) / 2 : Math.min(hi - half, Math.max(lo + half, c)));
    cam.x = fitAxis(cam.x, pic.x0, pic.x1, hw);
    cam.y = fitAxis(cam.y, pic.y0, pic.y1, hh);
  };
  let dirty = true;
  const applyCam = () => {
    clampCam();
    camera.left = cam.x - W / 2 / cam.k; camera.right = cam.x + W / 2 / cam.k;
    camera.top = cam.y + H / 2 / cam.k; camera.bottom = cam.y - H / 2 / cam.k;
    camera.updateProjectionMatrix();
    sharpen();
    dirty = true;
  };
  let rect = null;
  const resize = () => {
    rect = stageEl.getBoundingClientRect();
    W = rect.width || 1; H = rect.height || 1;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    gl.size(W, H, dpr);
    applyCam();
  };
  // the sharp picture, once the half-size one is shown bigger than it is
  let sharp = !o.full || o.full === o.src; let sharpening = false;
  function sharpen() {
    if (sharp || sharpening || !needsFull((pic.x1 - pic.x0) * cam.k * dpr)) return;
    sharpening = true;
    loadTex(THREE, o.full).then((tx) => {
      if (closed()) { tx.dispose(); return; }
      sharp = true; bgMat.map = tx; bgMat.needsUpdate = true; bgTex.dispose(); disposables.push(tx); dirty = true;
    }).catch(() => { sharpening = false; });
  }
  resize();
  cam.k = W / floorW;   // the floor fills the screen's width
  applyCam();
  window.addEventListener('resize', resize);

  const toView = (cx, cy) => [cam.x + (cx - rect.left - W / 2) / cam.k, cam.y - (cy - rect.top - H / 2) / cam.k];
  // the floor under a point of the screen: along the camera's look from that point, down to y = 0
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  const floorAt = (cx, cy) => {
    const [vx, vy] = toView(cx, cy);
    const p = new THREE.Vector3(vx, vy, 0).applyMatrix4(camera.matrixWorld);
    const d = -p.y / fwd.y;
    return { u: p.x + fwd.x * d, v: p.z + fwd.z * d };
  };
  const zoomAt = (k, cx, cy) => {
    const [vx, vy] = toView(cx, cy);
    const k1 = Math.min(maxK(), Math.max(minK(), k));
    cam.x = vx - (vx - cam.x) * (cam.k / k1);
    cam.y = vy - (vy - cam.y) * (cam.k / k1);
    cam.k = k1;
    applyCam();
  };
  // the item under a point: the nearest card whose picture isn't empty there
  const itemUnder = (cx, cy) => {
    const [vx, vy] = toView(cx, cy);
    let best = null;
    for (const s of sprites) {
      const b = s.box;
      const sx = (vx - b.x) / b.w, sy = 1 - (vy - b.y - s.lift) / b.h;
      if (sx < 0 || sx > 1 || sy < 0 || sy > 1 || s.alpha(sx, sy) < 40) continue;
      if (!best || (b.z > best.box.z && !s.it.flat) || best.it.flat) best = s;
    }
    return best;
  };

  // ---- touch ----
  let sel = null;
  const select = (s) => {
    if (sel && sel !== s) { sel.lift = 0; showItem(sel); }
    sel = s;
    if (s) {
      s.lift = 8 / cam.k; s.bounce = o.reduced ? 0 : 0.0001;
      showCells(s.it, placements[s.it.id], true);
      haptic('select');
      say(t('cp.selHint', { name: t(`cp.item.${s.it.id}`) }));
    } else { showCells(null); say(''); }
    dirty = true;
  };
  const pointers = new Map();
  let gest = null;
  const down = (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    rect = stageEl.getBoundingClientRect();
    if (pointers.size === 2) {
      if (gest?.mode === 'drag') dropBack();
      const [a, b] = [...pointers.values()];
      gest = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), k0: cam.k };
      return;
    }
    if (pointers.size > 2) return;
    const hit = itemUnder(e.clientX, e.clientY);
    if (sel && hit === sel) {
      const f = floorAt(e.clientX, e.clientY);
      const p = placements[sel.it.id];
      gest = { mode: 'drag', s: sel, f0: f, from: p, at: p, ok: true, x0: e.clientX, y0: e.clientY, moved: false };
    } else gest = { mode: 'pan', hit, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false };
  };
  const move = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gest) return;
    if (gest.mode === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      zoomAt(gest.k0 * (Math.hypot(a.x - b.x, a.y - b.y) / gest.d0), (a.x + b.x) / 2, (a.y + b.y) / 2);
    } else if (gest.mode === 'pan') {
      if (Math.hypot(e.clientX - gest.x0, e.clientY - gest.y0) > 8) gest.moved = true;
      if (!gest.moved) return;
      cam.x -= (e.clientX - gest.x) / cam.k; cam.y += (e.clientY - gest.y) / cam.k;
      gest.x = e.clientX; gest.y = e.clientY;
      applyCam();
    } else if (gest.mode === 'drag') {
      if (Math.hypot(e.clientX - gest.x0, e.clientY - gest.y0) > 6) gest.moved = true;
      const f = floorAt(e.clientX, e.clientY);
      const at = { ...gest.from, u: gest.from.u + Math.round(f.u - gest.f0.u), v: gest.from.v + Math.round(f.v - gest.f0.v) };
      if (at.u === gest.at.u && at.v === gest.at.v) return;
      gest.at = at;
      gest.ok = o.canPlace(gest.s.it, at.u, at.v, placements).ok;
      haptic('tick');
      layoutItem(gest.s, at); showItem(gest.s);
      gest.s.mesh.material.color.set(gest.ok ? 0xffffff : 0xff9a9a);
      showCells(gest.s.it, at, gest.ok);
      dirty = true;
    }
  };
  function dropBack() {
    const s = gest.s;
    layoutItem(s, placements[s.it.id]); showItem(s);
    s.mesh.material.color.set(0xffffff);
    showCells(s.it, placements[s.it.id], true);
    dirty = true;
  }
  const up = (e) => {
    if (!pointers.delete(e.pointerId)) return;
    if (!gest) return;
    if (gest.mode === 'pinch') { if (pointers.size === 0) gest = null; else gest = { mode: 'pan', x0: 0, y0: 0, ...[...pointers.values()][0], moved: true }; return; }
    if (gest.mode === 'pan' && !gest.moved) select(gest.hit || null);
    else if (gest.mode === 'drag' && gest.moved) {
      const s = gest.s;
      if (gest.ok && (gest.at.u !== gest.from.u || gest.at.v !== gest.from.v)) {
        placements = { ...placements, [s.it.id]: gest.at };
        o.save(s.it.id, gest.at);
        s.mesh.material.color.set(0xffffff);
        showCells(s.it, gest.at, true);
        haptic('place');
        say(t('cp.placed', { name: t(`cp.item.${s.it.id}`), room: t(`cp.room.${o.room}`) }));
      } else { haptic('refuse'); dropBack(); }
    }
    gest = null;
  };
  const wheel = (e) => { e.preventDefault(); rect = stageEl.getBoundingClientRect(); zoomAt(cam.k * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });

  // ---- the loop: at most FPS frames a second, counting what it manages ----
  let raf = 0; let last = performance.now(); let drawn = 0; let since = last;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    if (now - last < 1000 / FPS - 2) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (figure && !o.reduced) { figure.update(dt); dirty = true; }
    stepAthlete(dt, now);
    if (sel && sel.bounce > 0 && sel.bounce < 1) { sel.bounce = Math.min(1, sel.bounce + dt / 0.32); showItem(sel); dirty = true; }
    if (!dirty) return;
    dirty = false;
    renderer.clear();
    renderer.render(bgScene, camera);
    renderer.render(scene, camera);
    drawn++;
    if (now - since >= 500) {
      fpsEl.textContent = `${Math.round((drawn * 1000) / (now - since))} fps · ${renderer.info.render.calls} draws`;
      drawn = 0; since = now;
    }
  };
  if (figure && o.reduced) figure.update(0.2);
  raf = requestAnimationFrame(frame);
  // for checking it from the console: where the athlete is, the camera, the items' cards
  canvas._rg = { ath: () => [...pos], cam, figure: !!figure, items: () => sprites.map((s) => [s.it.id, s.box]), sel: () => sel?.it.id || null, placements: () => placements };

  function cleanup() {
    for (const d of disposables) d.dispose?.();
    gl.release();
  }
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    figure?.dispose();
    cleanup();
  };
}
