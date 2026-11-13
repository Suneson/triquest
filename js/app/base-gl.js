// base-gl.js: the base's items and your athlete drawn by three.js (docs/THREE-ROOM.md), on with
// ?three=1 for now.
//
// The page still lays the base out: the city, the room's picture, the floor's lines, the item
// buttons (what you tap and drag, and their tags) and the view's pan and zoom. This draws what
// stands in the room on one canvas: each item's picture on a card, and the athlete as a real 3D
// figure among them, so it walks in front of and behind them. Before this, the athlete was drawn
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
    dispose() { gone = true; api?.dispose(); canvas.remove(); },
  };
}

function build(L, canvas, layer, reduced) {
  const { THREE } = L;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
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
  let dirty = true; let raf = 0; let last = 0; let onscreen = true;
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
    renderer.render(scene, camera);
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

  return {
    setRoom, setView, body, machine,
    dispose() {
      cancelAnimationFrame(raf); mo.disconnect(); io.disconnect(); bodyObs.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      for (const c of [...byId.values()]) remove(c);
      figure?.dispose(); blob.dispose(); shadow.geometry.dispose(); shadow.material.dispose(); cardGeo.dispose();
      renderer.dispose();
    },
  };
}
