// base-gl.js: the base drawn by three.js: the city round the room, the room, its floor, its items
// and your athlete (docs/THREE-ROOM.md), on with
// ?three=1 for now.
//
// The page still lays the base out: the city, the room and its floor, the item buttons (their
// tags, and keyboard focus) and the view's pan and zoom. Which item a finger is on is found here,
// by the pixels drawn (pick). This draws the room on one canvas: its
// picture, the tape, the floor shadows, the held item's footprint and arrows, each item's picture
// on a card, and the athlete as a real 3D figure among them, so it walks in front of and behind them. Before this, the athlete was drawn
// off screen and copied into the page every frame (the costly part on iPhone); now it's drawn
// straight onto a canvas of its own, with its own WebGL context.
//
// The canvas sits inside the items layer (under the buttons, over the floor), counter-scaled so
// it covers the screen at its own resolution; the camera's window follows the view. It reads the
// item buttons (their place, size and state) whenever they change, so diorama-view.js moves them
// exactly as before and they're simply see-through.
//
// The scene: one unit is one floor tile, X along u, Z along v, Y up (as runner3d.js). The camera
// is orthographic, 45° round and tilted to the painted floor's slant. Its projection is worked out
// by hand so a point of the floor lands on exactly the screen pixel the page puts it on.

import { loadThree } from './runner3d.js';

/** The athlete's size (walker.js SPOT, in the old runner's units). */
const CHAR_HEIGHT = 1.8 / 1.85;
const DIST = 160;
const FAR_Z = -(DIST + 80);
/** Frames a second while only the athlete moves (panning draws at once, every frame). */
const FPS = 30;

const ease = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;   // easeOutBack, as the CSS spring

/**
 * Put the renderer in `layer` (the room's items layer). `reduced`: reduced motion (nothing
 * bounces, the athlete stands). Returns its handle at once; `ready` says whether it started.
 */
export function mountBaseGL(layer, { reduced = () => false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'dg-gl';
  canvas.setAttribute('aria-hidden', 'true');
  let gone = false;
  let api = null;
  const pending = { room: null, view: null, ath: null };
  const ready = (async () => {
    const L = await loadThree();
    if (gone) return false;
    api = build(L, canvas, layer, reduced);
    layer.prepend(canvas);
    if (pending.room) api.setRoom(...pending.room);
    if (pending.view) api.setView(...pending.view);
    return true;
  })().catch((e) => { console.warn('base renderer unavailable', e); return false; });
  return {
    ready,
    on: () => !!api,
    setRoom: (...a) => { pending.room = a; api?.setRoom(...a); },
    setView: (...a) => { pending.view = a; api?.setView(...a); },
    /** The athlete for walker.js: { at(u, v), setYaw(r), play(name, o), dispose() }. */
    body: (char) => api.body(char),
    /** The athlete on a machine ({ u, v, y, yaw, scale } in tiles), or off it (null). */
    machine: (spot, clip, char) => api?.machine(spot, clip, char),
    /** The id of the item drawn at world px (x, y), or null. */
    pick: (x, y, slop) => api?.pick(x, y, slop) ?? null,
    dispose() { gone = true; api?.dispose(); canvas.remove(); },
  };
}

function build(L, canvas, layer, reduced) {
  const { THREE } = L;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;   // the floor's pass, then the scene over it (render)
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const key = new THREE.DirectionalLight(0xfff5e6, 2.5); key.position.set(-2, 5, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6ea8ff, 1.8); rim.position.set(3, 3, -3); scene.add(rim);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  scene.add(camera);
  // the cards live in the world's px (x right, y down), turned into the camera's frame by this
  const cards = new THREE.Group(); cards.matrixAutoUpdate = false; camera.add(cards);

  // ---- the room: the camera's tilt, and the map between its frame and the world's px ----
  let G = null;   // camera frame (x, y) → world px: [g11, g12, g13, g21, g22, g23]
  let roomKey = '';
  const viewOf = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
  function setRoom(keyNow, tileToWorld, cols, rows) {
    if (keyNow === roomKey) return;
    roomKey = keyNow;
    const w0 = tileToWorld(0, 0), wu = tileToWorld(cols, 0), wv = tileToWorld(0, rows);
    const slant = (Math.abs((wu[1] - w0[1]) / (wu[0] - w0[0])) + Math.abs((wv[1] - w0[1]) / (wv[0] - w0[0]))) / 2;
    const tilt = Math.asin(Math.min(0.95, slant));
    const target = new THREE.Vector3(cols / 2, 0, rows / 2);
    camera.position.copy(target).addScaledVector(new THREE.Vector3(Math.cos(tilt) * Math.SQRT1_2, Math.sin(tilt), Math.cos(tilt) * Math.SQRT1_2), DIST);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    const q0 = viewOf(0, 0, 0), qu = viewOf(cols, 0, 0), qv = viewOf(0, 0, rows);
    // G's linear part: [wu − w0, wv − w0] · [qu − q0, qv − q0]⁻¹
    const a = qu.x - q0.x, b = qv.x - q0.x, c = qu.y - q0.y, d = qv.y - q0.y;
    const det = a * d - b * c;
    const i11 = d / det, i12 = -b / det, i21 = -c / det, i22 = a / det;
    const ex = [wu[0] - w0[0], wv[0] - w0[0]], ey = [wu[1] - w0[1], wv[1] - w0[1]];
    const g11 = ex[0] * i11 + ex[1] * i21, g12 = ex[0] * i12 + ex[1] * i22;
    const g21 = ey[0] * i11 + ey[1] * i21, g22 = ey[0] * i12 + ey[1] * i22;
    G = [g11, g12, w0[0] - g11 * q0.x - g12 * q0.y, g21, g22, w0[1] - g21 * q0.x - g22 * q0.y];
    // and its inverse, for the cards
    const gd = g11 * g22 - g12 * g21;
    const h11 = g22 / gd, h12 = -g12 / gd, h21 = -g21 / gd, h22 = g11 / gd;
    cards.matrix.set(h11, h12, 0, -(h11 * G[2] + h12 * G[5]), h21, h22, 0, -(h21 * G[2] + h22 * G[5]), 0, 0, 1, 0, 0, 0, 0, 1);
    cards.matrixWorldNeedsUpdate = true;
    floorRoot.matrix.multiplyMatrices(camera.matrixWorld, cards.matrix); floorRoot.matrixWorldNeedsUpdate = true;
    overRoot.matrix.copy(floorRoot.matrix); overRoot.matrixWorldNeedsUpdate = true;
    buildFloor();
    collectCity();
    for (const c2 of byId.values()) c2.z = null;   // depths are per room
    project(); sync(); dirty = true;
  }

  // ---- the view: the canvas covers the screen, and the camera's window is what it shows ----
  let V = null; let W = 0, H = 0, dpr = 1;
  function setView(v, box) {
    V = v;
    const w = Math.round(box.width), h = Math.round(box.height);
    const d = Math.min(2, window.devicePixelRatio || 1);
    if (w !== W || h !== H || d !== dpr) {
      W = w; H = h; dpr = d;
      renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    }
    // inside the world, which is scaled by s: undo that, so the canvas is the screen's size
    canvas.style.transform = `translate(${(-v.tx / v.s).toFixed(2)}px, ${(-v.ty / v.s).toFixed(2)}px) scale(${(1 / v.s).toFixed(6)})`;
    project();
    reline();
    drawNow();   // in the same frame the page moves the world, so they never part
  }
  function project() {
    if (!G || !V || !W) return;
    const x0 = -V.tx / V.s, y0 = -V.ty / V.s, ww = W / V.s, wh = H / V.s;
    const [g11, g12, g13, g21, g22, g23] = G;
    const n = 1, f = 400;
    camera.projectionMatrix.set(
      (2 * g11) / ww, (2 * g12) / ww, 0, (2 * (g13 - x0)) / ww - 1,
      (-2 * g21) / wh, (-2 * g22) / wh, 0, 1 - (2 * (g23 - y0)) / wh,
      0, 0, -2 / (f - n), -(f + n) / (f - n),
      0, 0, 0, 1,
    );
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  // ---- the items: a card for each button in the layer ----
  // a card's shape: x from −½ to ½, y from −1 (its top, the world's y runs down) to 0 (its bottom)
  const cardGeo = new THREE.BufferGeometry();
  cardGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -1, 0, 0.5, -1, 0, 0.5, 0, 0, -0.5, 0, 0], 3));
  cardGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  cardGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const textures = new Map();   // src → { tex, aspect, n }
  const texOf = (src) => {
    let t = textures.get(src);
    if (!t) {
      t = { tex: null, aspect: 1, n: 0 };
      textures.set(src, t);
      new THREE.TextureLoader().load(src, (tx) => {
        tx.colorSpace = THREE.SRGBColorSpace;
        t.tex = tx; t.aspect = tx.image.height / tx.image.width;
        for (const c of byId.values()) if (c.src === src) { c.mat.map = tx; c.shade.map = tx; c.mat.needsUpdate = true; c.shade.needsUpdate = true; c.mesh.visible = true; place(c); }
        dirty = true; wake();
      });
    }
    t.n++;
    return t;
  };
  const dropTex = (src) => {
    const t = textures.get(src);
    if (t && --t.n <= 0) { t.tex?.dispose(); textures.delete(src); }
  };
  const byId = new Map();
  function sync(fresh = new Set()) {
    const seen = new Set();
    const now = performance.now();
    for (const el of layer.querySelectorAll('.dg-item')) {
      const id = el.dataset.item;
      const src = el.querySelector('img')?.getAttribute('src');
      if (!id || !src) continue;
      seen.add(id);
      let c = byId.get(id);
      if (c && c.src !== src) { remove(c); c = null; }
      if (!c) {
        const t = texOf(src);
        const mat = new THREE.MeshBasicMaterial({ map: t.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
        // the picture's own drop shadow (it was a CSS filter): the same shape, dark, a little lower
        const shade = new THREE.MeshBasicMaterial({ map: t.tex, color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(cardGeo, mat); mesh.frustumCulled = false; mesh.visible = !!t.tex;
        const under = new THREE.Mesh(cardGeo, shade); under.frustumCulled = false; mesh.add(under);
        c = { id, src, t, mat, shade, mesh, under, z: null, shown: null, cls: '', anim: null, from: null };
        cards.add(mesh);
        byId.set(id, c);
      }
      const st = el.style;
      const x = parseFloat(st.left), y = parseFloat(st.top), w = parseFloat(st.width);
      const pad = parseFloat(st.getPropertyValue('--lift')) || 0;
      const [cu, cv] = (el.dataset.uv || '0,0').split(',').map(Number);
      const flat = el.dataset.flat === '1';
      const cls = el.className;
      const had = c.cls;
      // a bounce when it's picked up, a little drop when it's set down
      if (!reduced()) {
        if (fresh.has(`${id}:bounce`) || (/\bbounce\b/.test(cls) && !/\bbounce\b/.test(had))) c.anim = { kind: 'bounce', t0: now, ms: 340 };
        if (fresh.has(`${id}:landed`) || (/\blanded\b/.test(cls) && !/\blanded\b/.test(had))) c.anim = { kind: 'land', t0: now, ms: 220 };
        // springing back to where it was: from where it's drawn now
        if (/\bspring\b/.test(cls) && c.shown && (c.shown.x !== x || c.shown.y !== y)) c.from = { x: c.shown.x, y: c.shown.y, t0: now };
      }
      c.cls = cls;
      c.box = { x, y, w, pad, cu, cv, flat, lift: /\bis-lift\b/.test(cls), bad: /\bis-bad\b/.test(cls) };
      if (c.z == null || c.cu !== cu || c.cv !== cv) { c.cu = cu; c.cv = cv; c.z = null; }
      place(c);
    }
    for (const c of [...byId.values()]) if (!seen.has(c.id)) remove(c);
    dirty = true; wake();
  }
  function remove(c) { cards.remove(c.mesh); c.mat.dispose(); c.shade.dispose(); dropTex(c.src); byId.delete(c.id); }
  // where a card is drawn now: its box, its state and what it's in the middle of
  function place(c, now = performance.now()) {
    const b = c.box;
    if (!b || !Number.isFinite(b.x) || !Number.isFinite(b.w)) { c.mesh.visible = false; return false; }
    if (c.z == null && G) c.z = b.flat ? FAR_Z + 1 : viewOf(b.cu, 0, b.cv).z;
    let x = b.x, y = b.y; let k = 1; let lift = b.lift ? 8 : 0; let busy = false;
    if (c.from) {
      const t = Math.min(1, (now - c.from.t0) / 440);
      const e = ease(t);
      x = c.from.x + (b.x - c.from.x) * e; y = c.from.y + (b.y - c.from.y) * e;
      if (t >= 1) c.from = null; else busy = true;
    }
    if (c.anim) {
      const t = Math.min(1, (now - c.anim.t0) / c.anim.ms);
      if (c.anim.kind === 'bounce') k = 1 + 0.18 * Math.sin(Math.PI * Math.min(1, t / 0.9));
      else lift += 8 * (1 - ease(t));
      if (t >= 1) c.anim = null; else busy = true;
    }
    c.shown = { x, y };
    const h = b.w * c.t.aspect;
    // the CSS: the picture's foot at (x, y), `pad` of it below; it scales round 50% 94%
    const bottom = y + b.pad * h;
    const top = bottom - h;
    const oy = top + 0.94 * h;
    c.mesh.position.set(x, oy + (bottom - oy) * k - lift, c.z ?? FAR_Z + 1);
    c.mesh.scale.set(b.w * k, h * k, 1);
    c.mesh.renderOrder = b.flat ? -8 : 0;
    c.mesh.visible = !!c.t.tex;
    c.mat.color.set(b.bad ? 0xff9a9a : 0xffffff);
    c.mat.opacity = b.bad ? 0.75 : 1;
    // the shadow: 6 px lower, a little behind (in the card's own units: it's scaled with it)
    c.under.position.set(0, (b.lift ? 18 : 6) / (h * k), -0.01);
    c.under.visible = !b.flat;
    c.under.renderOrder = c.mesh.renderOrder;   // just behind its card (z), so it sorts with it
    return busy;
  }
  // (the canvas's own style changes on every pan: not a change to the items.) A bounce is the class
  // taken off and put back in one go, so it's told by the record that adds it, not by the class now.
  const mo = new MutationObserver((recs) => {
    const fresh = new Set();
    let any = false;
    for (const r of recs) {
      if (r.target === canvas) continue;
      any = true;
      if (r.attributeName === 'class' && r.target.dataset?.item) {
        for (const k of ['bounce', 'landed']) if (r.target.classList.contains(k) && !new RegExp(`\\b${k}\\b`).test(r.oldValue || '')) fresh.add(`${r.target.dataset.item}:${k}`);
      }
    }
    if (any) sync(fresh);
  });
  mo.observe(layer, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'src', 'data-uv'], attributeOldValue: true });

  // ---- the floor: the room's picture, the tape, the floor shadows, the footprint and the arrows ----
  // Read from the page as it lays them out (the room's art element, its floor's SVG, the tape, the
  // shadows layer), drawn in a pass of their own before the scene, in the page's order. The page's
  // copies are hidden (styles.css, .is-gl); its arrows stay, unseen, for tapping.
  const world = layer.parentElement;
  const artEl = world.querySelector('.dg-room-art');
  const shadowsEl = world.querySelector('.dg-shadows');
  const floorScene = new THREE.Scene();
  const floorRoot = new THREE.Group(); floorRoot.matrixAutoUpdate = false; floorScene.add(floorRoot);
  const overlay = new THREE.Group(); floorRoot.add(overlay);   // rebuilt whenever the floor changes
  const flatMat = (color, opacity, map = null) => new THREE.MeshBasicMaterial({ color, opacity, map, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const quadGeo = (pts, uvs = [0, 1, 1, 1, 1, 0, 0, 0]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(([x, y]) => [x, y, FAR_Z]), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return g;
  };
  // the room's picture: its own mesh, kept while the overlay is rebuilt
  const pic = { mesh: null, src: '', key: '', tex: null, loading: '' };
  let art = null;   // { rw, rh, m: [a, b, c, d, e, f] }: the art's size and its matrix in the world
  const artToWorld = (x, y) => { const [a, b, c, d, e, f] = art.m; return [a * x + c * y + e, b * x + d * y + f]; };
  const readArt = () => {
    const st = artEl?.style;
    const m = /matrix\(([^)]+)\)/.exec(st?.transform || '');
    const rw = parseFloat(st?.width), rh = parseFloat(st?.height);
    art = m && rw && rh ? { rw, rh, m: m[1].split(',').map(Number) } : null;
  };
  function roomPicture() {
    const img = artEl?.querySelector(':scope > img');
    const src = img?.getAttribute('src') || '';
    if (!art || !src) { if (pic.mesh) pic.mesh.visible = false; return; }
    const key = `${art.rw}x${art.rh}|${art.m.join(',')}`;
    const corners = [[0, 0], [art.rw, 0], [art.rw, art.rh], [0, art.rh]].map(([x, y]) => artToWorld(x, y));
    if (!pic.mesh) {
      pic.mesh = new THREE.Mesh(quadGeo(corners), flatMat(0xffffff, 1));
      pic.mesh.renderOrder = 0; pic.mesh.frustumCulled = false; pic.mesh.visible = false;
      floorRoot.add(pic.mesh);
    } else if (key !== pic.key) {
      pic.mesh.geometry.dispose(); pic.mesh.geometry = quadGeo(corners);
    }
    // another room: hidden until its picture is in (a sharper copy of the same room swaps in place)
    if (key !== pic.key) { pic.key = key; if (src !== pic.src) pic.mesh.visible = false; }
    if (src === pic.src || src === pic.loading) return;
    pic.loading = src;
    new THREE.TextureLoader().load(src, (tx) => {
      if (pic.loading !== src) { tx.dispose(); return; }
      tx.colorSpace = THREE.SRGBColorSpace;
      tx.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      pic.tex?.dispose();
      pic.tex = tx; pic.src = src; pic.loading = '';
      pic.mesh.material.map = tx; pic.mesh.material.needsUpdate = true; pic.mesh.visible = true;
      world.classList.add('is-gl');
      dirty = true; wake();
    }, undefined, () => { if (pic.loading === src) pic.loading = ''; });
  }
  // a line along a polygon's edges, `px` screen px wide at the zoom it's built at
  const strokeGeo = (pts, px) => {
    const half = px / 2 / (V?.s || 1);
    const pos = []; const idx = [];
    pts.forEach(([x0, y0], i) => {
      const [x1, y1] = pts[(i + 1) % pts.length];
      const dx = x1 - x0, dy = y1 - y0; const l = Math.hypot(dx, dy) || 1;
      const nx = (-dy / l) * half, ny = (dx / l) * half;
      const ex = (dx / l) * half, ey = (dy / l) * half;   // past each end, so the corners close
      const n = pos.length / 3;
      pos.push(x0 - ex + nx, y0 - ey + ny, FAR_Z, x1 + ex + nx, y1 + ey + ny, FAR_Z, x1 + ex - nx, y1 + ey - ny, FAR_Z, x0 - ex - nx, y0 - ey - ny, FAR_Z);
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    return g;
  };
  const fillGeo = (pts) => {
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))));
    g.translate(0, 0, FAR_Z);
    return g;
  };
  const add = (geo, mat, order, dy = 0) => { const m = new THREE.Mesh(geo, mat); m.renderOrder = order; m.position.y = dy; m.frustumCulled = false; overlay.add(m); return m; };
  const tapeTex = new THREE.TextureLoader().load('icons/UI/tape.webp', (tx) => { tx.colorSpace = THREE.SRGBColorSpace; dirty = true; wake(); });
  tapeTex.wrapS = THREE.RepeatWrapping;
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);   // .dg-shadow's gradient
    g.addColorStop(0, 'rgba(8,10,20,.55)'); g.addColorStop(0.6, 'rgba(8,10,20,.28)'); g.addColorStop(1, 'rgba(8,10,20,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  })();
  const M = {
    dim: flatMat(0x0b1222, 0.34), tape: flatMat(0xffffff, 1, tapeTex), shadow: flatMat(0xffffff, 1, shadowTex),
    okFill: flatMat(0x0c4cae, 0.45), okLine: flatMat(0x6ea8ff, 1), badFill: flatMat(0xd9443b, 0.6), badLine: flatMat(0xd9443b, 1),
    arrow: flatMat(0x6ea8ff, 1), arrowLine: flatMat(0x0b1222, 1), arrowShade: flatMat(0x000000, 0.45),
  };
  let builtAt = 1;   // the zoom the lines were built at (they're a fixed width on screen)
  function buildFloor() {
    readArt();
    roomPicture();
    for (const m of [...overlay.children]) { m.geometry.dispose(); overlay.remove(m); }
    if (!art) return;
    builtAt = V?.s || 1;
    const pct = (s) => s.trim().split(/\s+/).map((p) => p.split(',').map(Number)).map(([x, y]) => artToWorld((x * art.rw) / 100, (y * art.rh) / 100));
    // the tape round an unexpanded room: the floor beyond it dimmed, and its two strips
    const tape = artEl.querySelector('.dg-tape');
    if (tape) {
      for (const p of tape.querySelectorAll('polygon')) add(fillGeo(pct(p.getAttribute('points'))), M.dim, 1);
      for (const i of tape.querySelectorAll('i')) {
        const w = parseFloat(i.style.width), h = parseFloat(i.style.height);
        const m = /matrix\(([^)]+)\)/.exec(i.style.transform || '');
        if (!w || !h || !m) continue;
        const [a, b, c, d, e, f] = m[1].split(',').map(Number);
        const pts = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => artToWorld(a * x + c * y + e, b * x + d * y + f));
        add(quadGeo(pts, [0, 1, w / 256, 1, w / 256, 0, 0, 0]), M.tape, 2);
      }
    }
    // the footprint of what's held, and the four arrows round it
    for (const p of artEl.querySelectorAll('.dg-floor polygon')) {
      const pts = pct(p.getAttribute('points'));
      const cls = p.getAttribute('class') || '';
      if (/dg-arrow/.test(cls)) {
        add(fillGeo(pts), M.arrowShade, 6, 2 / builtAt);
        add(fillGeo(pts), M.arrow, 7);
        add(strokeGeo(pts, 2.5), M.arrowLine, 8);
      } else if (/dg-cell/.test(cls)) {
        const bad = /is-bad/.test(cls);
        add(fillGeo(pts), bad ? M.badFill : M.okFill, 4);
        add(strokeGeo(pts, 2), bad ? M.badLine : M.okLine, 5);
      }
    }
    // the soft shadows under the items
    for (const s of shadowsEl?.querySelectorAll('.dg-shadow') || []) {
      const x = parseFloat(s.style.left), y = parseFloat(s.style.top), w = parseFloat(s.style.width), h = parseFloat(s.style.height);
      if (![x, y, w, h].every(Number.isFinite)) continue;
      add(quadGeo([[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]]), M.shadow, 9);
    }
    dirty = true; wake();
  }
  const floorObs = new MutationObserver(() => buildFloor());
  if (artEl) floorObs.observe(artEl, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'src', 'points', 'class'] });
  if (shadowsEl) floorObs.observe(shadowsEl, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  // the lines keep their width on screen: built again once the zoom has changed by a sixth
  const reline = () => { if (overlay.children.length && V && Math.abs(V.s - builtAt) / builtAt > 0.16) buildFloor(); };

  // ---- the city round the room: every other picture in the world (docs/THREE-ROOM.md, stage 3) ----
  // The city's ground, the tower, the railing, the island's plots and markets, the sign and the
  // truck: each a picture the page places with its inline style. They're drawn here in the page's
  // own order: what the page paints under the room (its layer's z-index below the room's) before
  // the floor, and what it paints over the items (the pool, the mall, the markets, the railing's
  // front, the sign, the truck) after them. The page's copy of each is hidden (.gl-on) once it's
  // drawn here. Its tap areas and its words (the sign's countdown, timers, coins) stay on top.
  const cityUnder = new THREE.Group(); floorRoot.add(cityUnder);
  const overScene = new THREE.Scene();
  const overRoot = new THREE.Group(); overRoot.matrixAutoUpdate = false; overScene.add(overRoot);
  const itemsEl = layer;
  const pics = new Map();   // img → { mesh, src, z, i, under, box, tex }
  const cityTex = new Map();   // src → { tex, n, ready: Promise }
  // the picture's rows top first (flipY off, so ImageBitmaps and images agree)
  const picUV = [0, 0, 1, 0, 1, 1, 0, 1];
  const loadCity = (src) => {
    let t = cityTex.get(src);
    if (t) { t.n++; clearTimeout(t.drop); return t; }
    t = { tex: null, n: 1, drop: 0 };
    cityTex.set(src, t);
    const done = (tx) => {
      if (cityTex.get(src) !== t) { tx.dispose(); return; }
      tx.colorSpace = THREE.SRGBColorSpace; tx.flipY = false; tx.needsUpdate = true;
      t.tex = tx;
      for (const p of pics.values()) if (p.src === src) { p.mesh.material.map = tx; p.mesh.material.needsUpdate = true; p.mesh.visible = !p.off; p.img.classList.add('gl-on'); }
      dirty = true; wake();
    };
    // decoded off the main thread where the browser can
    if (typeof createImageBitmap === 'function') {
      new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'none', premultiplyAlpha: 'none' }).load(src, (bmp) => done(new THREE.Texture(bmp)), undefined, () => new THREE.TextureLoader().load(src, done));
    } else new THREE.TextureLoader().load(src, done);
    return t;
  };
  const dropCity = (src, now = false) => {
    const t = cityTex.get(src);
    if (!t || --t.n > 0) return;
    // kept a moment: a picture that's just gone off the screen often comes back
    const go = () => { if (cityTex.get(src) === t && t.n <= 0) { t.tex?.source?.data?.close?.(); t.tex?.dispose(); cityTex.delete(src); } };
    if (now) go(); else t.drop = setTimeout(go, 4000);
  };
  // the stacking level the page paints a picture at: its own z-index, or its nearest layer's
  const zOf = (el) => { for (let e = el; e && e !== world; e = e.parentElement) { const z = getComputedStyle(e).zIndex; if (z !== 'auto') return Number(z) || 0; } return 0; };
  const roomArtEl = artEl;
  const isMirrored = (img) => !itemsEl.contains(img) && !roomArtEl?.contains(img);
  // where a picture is in the world: its inline left, top, size and translate (the truck moves by
  // transform; the sign's picture fills its box)
  const boxOf = (img) => {
    const host = img.parentElement?.classList.contains('dg-street-sign') ? img.parentElement : img;
    const st = host.style;
    let x = parseFloat(st.left) || 0, y = parseFloat(st.top) || 0;
    const tr = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(st.transform || '');
    if (tr) { x += Number(tr[1]); y += Number(tr[2]); }
    const w = parseFloat(st.width);
    const h = parseFloat(st.height) || (img.naturalWidth ? (w * img.naturalHeight) / img.naturalWidth : NaN);
    return Number.isFinite(w) && Number.isFinite(h) ? { x, y, w, h } : null;
  };
  const off = (img) => img.hidden || img.closest('[hidden]') || img.classList.contains('is-culled');
  function placePic(p) {
    p.box = boxOf(p.img);
    p.off = !p.box || off(p.img);
    if (p.box) {
      const { x, y, w, h } = p.box;
      // a tap on a plot gives it a little squeeze (the page's dg-isl-tap), round 50% 75%
      const k = p.tap ? 1 + 0.018 * Math.sin(Math.PI * Math.min(1, p.tap.t / 0.8)) : 1;
      p.mesh.position.set(x + w / 2, y + h * 0.75, FAR_Z);
      p.mesh.scale.set(w * k, h * k, 1);
    }
    p.mesh.visible = !p.off && !!cityTex.get(p.src)?.tex;
  }
  const picGeo = new THREE.BufferGeometry();
  picGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.75, 0, 0.5, -0.75, 0, 0.5, 0.25, 0, -0.5, 0.25, 0], 3));
  picGeo.setAttribute('uv', new THREE.Float32BufferAttribute(picUV, 2));
  picGeo.setIndex([0, 1, 2, 0, 2, 3]);
  function collectCity() {
    const imgs = [...world.querySelectorAll('img')].filter(isMirrored);
    const seen = new Set(imgs);
    for (const [img, p] of [...pics]) if (!seen.has(img)) { p.mesh.parent?.remove(p.mesh); p.mesh.material.dispose(); dropCity(p.src); pics.delete(img); }
    // the page's paint order: by stacking level, then where it is in the page
    imgs.forEach((img, i) => {
      const src = img.getAttribute('src') || '';
      let p = pics.get(img);
      if (p && p.src !== src) { if (p.src) dropCity(p.src); p.src = ''; }
      if (!p) {
        const mesh = new THREE.Mesh(picGeo, new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
        mesh.frustumCulled = false; mesh.visible = false;
        p = { img, mesh, src: '', z: 0, i, off: true, box: null, tap: null };
        pics.set(img, p);
      }
      p.i = i; p.z = zOf(img);
      const before = (el) => el && (img.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
      // painted before the room's picture: under it; the rest (the layers at z-index 3 to 6) over the items
      const under = p.z < 1 || (p.z === 1 && !!before(roomArtEl));
      (under ? cityUnder : overRoot).add(p.mesh);
      p.mesh.renderOrder = under ? -100000 + p.z * 1000 + i : p.z * 1000 + i;
      const isOff = off(img);
      // a picture on the screen has its texture; one that's off it lets it go (after a moment)
      if (!isOff && !p.src && src) { p.src = src; const t = loadCity(src); if (t.tex) { p.mesh.material.map = t.tex; p.mesh.material.needsUpdate = true; img.classList.add('gl-on'); } }
      else if (isOff && p.src) { dropCity(p.src); p.src = ''; p.mesh.material.map = null; }
      placePic(p);
    });
    dirty = true; wake();
  }
  const cityObs = new MutationObserver((recs) => {
    let full = false;
    const moved = new Set();
    for (const r of recs) {
      const el = r.target;
      if (el === canvas || itemsEl.contains(el) || roomArtEl?.contains(el) || shadowsEl?.contains(el)) continue;
      if (r.type === 'attributes' && r.attributeName === 'class') {
        // only our own mark, or the tap squeeze (taken off and put back in one go)
        const strip = (s) => (s || '').replace(/\b(gl-on|is-tap)\b/g, '').trim().replace(/\s+/g, ' ');
        if (strip(r.oldValue) === strip(el.getAttribute('class'))) {
          if (el.classList.contains('is-tap') && pics.has(el) && !reduced()) pics.get(el).tap = { t: 0 };
          continue;
        }
      }
      if (r.type === 'attributes' && r.attributeName === 'style' && (pics.has(el) || el.classList?.contains('dg-street-sign'))) { moved.add(el); continue; }
      full = true;
    }
    if (full) collectCity();
    else if (moved.size) {
      for (const el of moved) { const img = pics.has(el) ? el : el.querySelector('img'); const p = pics.get(img); if (p) placePic(p); }
      dirty = true; wake();
    }
  });
  cityObs.observe(world, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'src', 'hidden'], attributeOldValue: true });
  // a picture's size can wait on it loading (the markets are as tall as their picture makes them)
  world.addEventListener('load', (e) => { if (pics.has(e.target)) { placePic(pics.get(e.target)); dirty = true; wake(); } }, true);
  const tapping = (dt) => {
    let busy = false;
    for (const p of pics.values()) if (p.tap) { p.tap.t += dt / 0.24; if (p.tap.t >= 1) p.tap = null; else busy = true; placePic(p); }
    return busy;
  };

  // ---- the athlete ----
  const blob = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(8,10,20,.5)'); g.addColorStop(0.6, 'rgba(8,10,20,.25)'); g.addColorStop(1, 'rgba(8,10,20,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }));
  shadow.renderOrder = -6; shadow.visible = false; scene.add(shadow);
  const rig = new THREE.Group(); rig.visible = false; scene.add(rig);
  let figure = null; let figKey = ''; let loading = null;
  let mode = null;   // 'walk' | 'machine' | null
  let clipNow = { name: 'idle', o: { fade: 0 } };
  const want = { u: 0, v: 0, y: 0, yaw: 0, scale: 2.52 };
  function athlete(char) {
    const k = char.key || char.model;
    if (k === figKey) return loading;
    figKey = k;
    loading = (async () => {
      const uniforms = { uSkin: { value: new THREE.Vector3(...(char.skin || [1, 1, 1])) }, uEye: { value: new THREE.Vector3(...(char.eye || [0.3, 0.2, 0.1])) } };
      const { spawnChar } = await import('./char3d.js');
      const f = await spawnChar(L, { model: char.model, clips: char.clips, uniforms, gear: char.gear || [], hair: char.hair || null });
      if (figKey !== k) { f.dispose(); return; }
      if (figure) { rig.remove(figure.root); figure.dispose(); }
      figure = f;
      rig.add(f.root);
      f.play(clipNow.name, { fade: 0, ...(clipNow.o || {}) });
      if (reduced()) f.update(0.2);
      putAthlete();
    })().catch((e) => console.warn('athlete', e));
    return loading;
  }
  function putAthlete() {
    rig.visible = !!mode && !!figure;
    shadow.visible = rig.visible;
    rig.position.set(want.u, want.y, want.v);
    rig.rotation.y = want.yaw;
    rig.scale.setScalar(want.scale / CHAR_HEIGHT);
    shadow.position.set(want.u, 0.01, want.v);
    const r = mode === 'machine' ? 1.2 : 1.8;
    shadow.scale.set(r, 1, r);
    dirty = true; wake();
  }
  const play = (name, o = {}) => { clipNow = { name, o }; if (figure) { figure.play(name, o); if (reduced()) figure.update(0.2); } dirty = true; wake(); };
  function body(char) {
    athlete(char);
    mode = 'walk'; want.y = 0; want.scale = 2.52;
    putAthlete();
    let mine = true;
    return {
      at: (u, v) => { if (!mine) return; want.u = u; want.v = v; putAthlete(); },
      setYaw: (r) => { if (!mine) return; want.yaw = r; putAthlete(); },
      play: (name, o) => { if (mine) play(name, o); },
      dispose: () => { if (!mine) return; mine = false; if (mode === 'walk') { mode = null; putAthlete(); } },
    };
  }
  function machine(spot, clip, char) {
    if (!spot) { if (mode === 'machine') { mode = null; putAthlete(); } return; }
    athlete(char);
    mode = 'machine';
    Object.assign(want, { u: spot.u, v: spot.v, y: spot.y ?? 0, yaw: spot.yaw ?? 0, scale: spot.scale ?? 2.52 });
    if (clipNow.name !== clip) play(clip, { fade: 0.3 });
    putAthlete();
  }

  // ---- drawing: at once when the view moves, and FPS times a second while something moves ----
  let dirty = true; let raf = 0; let last = 0; let lastT = 0; let onscreen = true;
  const covered = () => document.body.classList.contains('base-covered');
  const paused = () => document.hidden || !onscreen || covered() || !canvas.isConnected;
  const io = new IntersectionObserver((es) => { onscreen = es.some((e) => e.isIntersecting); if (onscreen) { dirty = true; wake(); } });
  io.observe(layer.closest('.dg-world') || layer);   // the world is kept; the viewport is drawn anew
  const bodyObs = new MutationObserver(() => { dirty = true; wake(); });
  bodyObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const onVis = () => { dirty = true; wake(); };
  document.addEventListener('visibilitychange', onVis);
  function render() {
    if (!G || !V || !W) return;
    renderer.clear();
    renderer.render(floorScene, camera);
    renderer.render(scene, camera);
    renderer.render(overScene, camera);
    dirty = false;
  }
  function drawNow() { if (paused()) { dirty = true; return; } render(); }
  const live = () => !!figure && !!mode && !reduced();
  function wake() { if (!raf && !paused()) raf = requestAnimationFrame(loop); }
  function loop(now) {
    raf = 0;
    if (paused()) return;
    let busy = false;
    for (const c of byId.values()) if (c.anim || c.from) busy = place(c, now) || busy;
    if (tapping(lastT ? Math.min(0.1, (now - lastT) / 1000) : 0.016)) busy = true;
    lastT = busy ? now : 0;
    if (busy) dirty = true;
    const moving = live();
    if (moving && (!last || now - last >= 1000 / FPS - 2)) {
      figure.update(last ? Math.min(0.1, (now - last) / 1000) : 0);
      last = now;
      dirty = true;
    }
    if (!moving) last = 0;
    if (dirty) render();
    if (moving || busy) raf = requestAnimationFrame(loop);
  }

  // ---- picking: which item is under a point, by the pixels drawn (docs/THREE-ROOM.md, stage 4) ----
  // A tap through a picture's see-through corner reaches what's behind it. Each picture's alpha is
  // read once, small (64 px across), the first time a tap needs it. The cards are tried front to
  // back, as they're drawn: by renderOrder, then nearest the camera.
  const MASK = 64;
  const maskOf = (t) => {
    if (t.mask !== undefined) return t.mask;
    const im = t.tex?.image;
    if (!im?.width) return null;   // not in yet: asked again next time
    try {
      const w = MASK, h = Math.max(1, Math.round(MASK * t.aspect));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d', { willReadFrequently: true });
      x.drawImage(im, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h).data;
      const a = new Uint8Array(w * h);
      for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
      t.mask = { w, h, a };
    } catch { t.mask = null; }   // a picture that can't be read: its whole card counts
    return t.mask;
  };
  // is the world point (x, y) on a drawn pixel of card c?
  const solid = (c, x, y) => {
    const m = c.mesh; const sx = m.scale.x, sy = m.scale.y;
    if (!(sx > 0 && sy > 0)) return false;
    const u = (x - (m.position.x - sx / 2)) / sx;
    const v = (y - (m.position.y - sy)) / sy;   // from the picture's top
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
    const k = maskOf(c.t);
    if (!k) return true;
    return k.a[Math.floor(v * k.h) * k.w + Math.floor(u * k.w)] > 24;
  };
  /** The id of the item drawn at world px (x, y), or null; `slop` px round it if nothing's right there. */
  function pick(x, y, slop = 0) {
    const order = [...byId.values()].filter((c) => c.mesh.visible)
      .sort((a, b) => (b.mesh.renderOrder - a.mesh.renderOrder) || (b.mesh.position.z - a.mesh.position.z));
    for (const c of order) if (solid(c, x, y)) return c.id;
    if (slop > 0) {
      const around = [[slop, 0], [-slop, 0], [0, slop], [0, -slop], [slop, slop], [-slop, slop], [slop, -slop], [-slop, -slop]];
      for (const c of order) if (around.some(([dx, dy]) => solid(c, x + dx, y + dy))) return c.id;
    }
    return null;
  }

  return {
    setRoom, setView, body, machine, pick,
    dispose() {
      cancelAnimationFrame(raf); mo.disconnect(); floorObs.disconnect(); cityObs.disconnect();
      for (const p of pics.values()) p.mesh.material.dispose();
      for (const src of [...cityTex.keys()]) { const t = cityTex.get(src); t.n = 1; dropCity(src, true); }
      picGeo.dispose();
      for (const m of [...overlay.children]) m.geometry.dispose();
      pic.mesh?.geometry.dispose(); pic.mesh?.material.dispose(); pic.tex?.dispose(); tapeTex.dispose(); shadowTex.dispose();
      for (const m of Object.values(M)) m.dispose(); io.disconnect(); bodyObs.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      for (const c of [...byId.values()]) remove(c);
      figure?.dispose(); blob.dispose(); shadow.geometry.dispose(); shadow.material.dispose(); cardGeo.dispose();
      renderer.dispose();
    },
  };
}
