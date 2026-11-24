// chest3d.js: a reward chest as 3D models for the chest screen (chest-view.js), opened the way the big chest
// games do it: it drops in, each tap throws it into a flip, the last charge spins it up while the screen goes
// white, and under the white the shut model gives way to its open parts: a box whose lid swings back on its
// hinge, or an open bag that pops in, with the tier's light pouring out of it.
//
// Models (tools/build-chests.mjs): models/chests/<tier>.glb shut, and <tier>-box.glb + <tier>-lid.glb, or
// <tier>-open.glb for the bags. Each is one unit tall as built; here the parts are fitted to the shut chest.
// The models' fronts all look along −X.
//
//   const c = mountChest3d(host, tier, color)   c.ready → true once drawn (false: keep the stills)
//   c.drop()        it falls in and lands
//   c.tap(n)        tap n (1…3): a hop and a flip, a different one each time
//   c.charge(ms)    it lifts and spins up, shaking harder, for ms
//   c.open(quick)   the shut chest gives way to the open one (quick: already open, no motion)
//   c.dispose()

import { loadThree, webglOk } from './runner3d.js';

/** Per tier: the open parts, how far it's zoomed out, how wild its flips are, and for boxes the quarter turns
 *  that face the box and the lid the shut chest's way. */
export const CHESTS = {
  common: { open: 'bag', zoom: 1, wild: 0.8 },
  uncommon: { open: 'box', zoom: 1, wild: 0.9, turn: [0, -1] },
  rare: { open: 'bag', zoom: 1.05, wild: 1 },
  legendary: { open: 'box', zoom: 1, wild: 1.15, turn: [0, 0] },
  mythic: { open: 'box', zoom: 1, wild: 1.3, turn: [-1, -1] },
};
/** The stills' view: a little from above, turned so the front (−X) faces down-left. */
const VIEW = { pitch: 0.55, turn: -0.62 };
/** The canvas is this much bigger than the chest's square, so hops and flips never touch its edge. */
export const ROOM = 1.8;
/** How far the lid swings back (radians). */
const LID_OPEN = 1.95;

const cache = new Map();
const loadModel = (L, name) => {
  if (!cache.has(name)) {
    const loader = new L.GLTFLoader(); loader.setMeshoptDecoder(L.MeshoptDecoder);
    cache.set(name, loader.loadAsync(new URL(`../../models/chests/${name}.glb`, import.meta.url).href).catch((e) => { cache.delete(name); throw e; }));
  }
  return cache.get(name);
};

const clamp01 = (k) => Math.max(0, Math.min(1, k));
const easeOut = (k) => 1 - (1 - k) ** 3;
const easeInOut = (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
/** A damped spring towards `to`: call step(dt); kick it with v. */
const spring = (x, k = 260, d = 14) => ({ x, v: 0, to: x, step(dt) { this.v += (k * (this.to - this.x) - d * this.v) * dt; this.x += this.v * dt; return this.x; } });

/** The (world-space) geometry of a glTF scene's one mesh, and its material. */
function meshOf(THREE, gltf, inside = false) {
  const src = gltf.scene.getObjectByProperty('isMesh', true);
  src.updateWorldMatrix(true, false);
  const geo = src.geometry.clone();
  // the models come quantized (16-bit, normalised): unpack them to floats first, or moving and scaling them
  // here would clamp their vertices at ±1
  for (const name of ['position', 'normal']) {
    const a = geo.attributes[name]; if (!a || a.array instanceof Float32Array) continue;
    const f = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) f.set([a.getX(i), a.getY(i), a.getZ(i)], i * 3);
    geo.setAttribute(name, new THREE.BufferAttribute(f, 3));
  }
  geo.applyMatrix4(src.matrixWorld);
  geo.computeBoundingBox();
  // a part with its own inside shell shows only its outside faces, or the two would fight
  const mat = inside ? Object.assign(src.material.clone(), { side: THREE.FrontSide }) : src.material;
  return { geo, mat };
}
/** The width (x) and depth (z) of a geometry's vertices below height y. */
function footAt(THREE, geo, y) {
  const p = geo.attributes.position; const b = new THREE.Box3(); const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) if (p.getY(i) <= y) b.expandByPoint(v.set(p.getX(i), p.getY(i), p.getZ(i)));
  return b.getSize(new THREE.Vector3());
}
/** The box round a geometry's vertices above height y. */
function spanAbove(THREE, geo, y) {
  const p = geo.attributes.position; const b = new THREE.Box3(); const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) if (p.getY(i) >= y) b.expandByPoint(v.set(p.getX(i), p.getY(i), p.getZ(i)));
  return b;
}
/** Soft fades: a cone's (bright at its foot, clear well before its top) and a round glow. */
function fades(THREE) {
  const mk = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  return {
    cone: mk((x) => { const g = x.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.3, 'rgba(255,255,255,.4)'); g.addColorStop(0.8, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }),
    disc: mk((x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }),
  };
}

export function mountChest3d(host, tier, color) {
  const spec = CHESTS[tier];
  let gone = false; let raf = 0; let api = null;
  let act = { kind: 'hidden', t0: 0 };
  const canvas = document.createElement('canvas');
  canvas.className = 'cx-3d';

  const ready = (async () => {
    if (!webglOk()) return false;
    const L = await loadThree();
    const { THREE } = L;
    const parts = spec.open === 'box' ? [tier, `${tier}-box`, `${tier}-lid`] : [tier, `${tier}-open`];
    const gl = await Promise.all(parts.map((n) => loadModel(L, n)));
    if (gone) return false;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x4a5270, 1.6));
    const key = new THREE.DirectionalLight(0xfff2dc, 2.6); key.position.set(-1.5, 3, 2.5); scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfd8ff, 1.4); rim.position.set(2, 1.5, -2); scene.add(rim);
    const tint = new THREE.Color(color);
    const disposables = [];
    const own = (x) => { disposables.push(x); return x; };

    // the rig: stand (its hop) > squash (from its feet) > spin (its flips, about its middle) > the models
    const MID = 0.5;
    const stand = new THREE.Group(); scene.add(stand);
    const squash = new THREE.Group(); stand.add(squash);
    const spin = new THREE.Group(); spin.position.y = MID; squash.add(spin);
    const body = new THREE.Group(); body.position.y = -MID; spin.add(body);

    // the shut chest
    const shut = meshOf(THREE, gl[0]); own(shut.geo);
    const shutMesh = new THREE.Mesh(shut.geo, shut.mat); body.add(shutMesh);
    const S = shut.geo.boundingBox.getSize(new THREE.Vector3());

    // the open chest, fitted to the shut one's size
    const opened = new THREE.Group(); opened.visible = false; body.add(opened);
    // its inside: the shell's back faces, darker the deeper they are
    const insideOf = (geo, top) => {
      const p = geo.attributes.position; const col = new Float32Array(p.count * 3);
      const lo = tint.clone().multiplyScalar(0.1); const hi = tint.clone().lerp(new THREE.Color(0xffffff), 0.2).multiplyScalar(0.55);
      const c = new THREE.Color();
      for (let v = 0; v < p.count; v++) { c.copy(lo).lerp(hi, clamp01(p.getY(v) / top) ** 2); col.set([c.r, c.g, c.b], v * 3); }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return own(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
    };
    const centre = (geo) => { const b = geo.boundingBox; geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); geo.computeBoundingBox(); return geo.boundingBox; };
    let lidHinge = null; let mouth;
    if (spec.open === 'box') {
      const box = meshOf(THREE, gl[1], true); const lid = meshOf(THREE, gl[2], true); own(box.geo); own(lid.geo); own(box.mat); own(lid.mat);
      // turned so their fronts look along −X like the shut chest's (Tripo faces each part its own way)
      box.geo.rotateY(spec.turn[0] * Math.PI / 2); lid.geo.rotateY(spec.turn[1] * Math.PI / 2);
      box.geo.computeBoundingBox(); lid.geo.computeBoundingBox();
      // the box as wide and deep as the shut chest
      const bs = box.geo.boundingBox.getSize(new THREE.Vector3());
      const kb = (S.x / bs.x + S.z / bs.z) / 2;
      box.geo.scale(kb, kb, kb); box.geo.computeBoundingBox();
      const B = centre(box.geo);
      opened.add(new THREE.Mesh(box.geo, box.mat), new THREE.Mesh(box.geo, insideOf(box.geo, B.max.y)));
      // the lid stretched to the box's top, sitting on it, hinged along its back (+X) edge
      // (to its rim, not its handles: the vertices round the top of the box)
      const rim = spanAbove(THREE, box.geo, B.max.y * 0.78);
      const ls = lid.geo.boundingBox.getSize(new THREE.Vector3());
      const kx = (rim.max.x - rim.min.x) * 1.04 / ls.x; const kz = (rim.max.z - rim.min.z) * 1.04 / ls.z;
      lid.geo.scale(kx, (kx + kz) / 2, kz); lid.geo.computeBoundingBox();
      const lb = lid.geo.boundingBox;
      lid.geo.translate(-lb.max.x, -lb.min.y, -(lb.min.z + lb.max.z) / 2); lid.geo.computeBoundingBox();
      lidHinge = new THREE.Group(); lidHinge.position.set(rim.max.x + (rim.max.x - rim.min.x) * 0.02, B.max.y - 0.01, (rim.min.z + rim.max.z) / 2); opened.add(lidHinge);
      lidHinge.add(new THREE.Mesh(lid.geo, lid.mat), new THREE.Mesh(lid.geo, insideOf(lid.geo, lid.geo.boundingBox.max.y)));
      mouth = { y: B.max.y, w: (rim.max.x - rim.min.x) * 0.8, d: (rim.max.z - rim.min.z) * 0.8, floor: B.max.y * 0.35 };
    } else {
      const bag = meshOf(THREE, gl[1], true); own(bag.geo); own(bag.mat);
      // the bag as wide as the shut one round its lower half
      const a = footAt(THREE, shut.geo, S.y * 0.45); const b = footAt(THREE, bag.geo, bag.geo.boundingBox.max.y * 0.45);
      const k = (a.x / b.x + a.z / b.z) / 2;
      bag.geo.scale(k, k, k); bag.geo.computeBoundingBox(); centre(bag.geo);
      opened.add(new THREE.Mesh(bag.geo, bag.mat), new THREE.Mesh(bag.geo, insideOf(bag.geo, S.y * 0.7)));
      const f = footAt(THREE, bag.geo, S.y * 0.6);
      mouth = { y: S.y * 0.6, w: f.x * 0.7, d: f.z * 0.7, floor: S.y * 0.3 };
    }

    // the light: a glow deep in the mouth, a cone pouring up out of it, and a light warming the inside
    const tex = fades(THREE); own(tex.cone); own(tex.disc);
    const glowMat = own(new THREE.MeshBasicMaterial({ color: tint.clone().lerp(new THREE.Color(0xffffff), 0.2), map: tex.disc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const glow = new THREE.Mesh(own(new THREE.PlaneGeometry(mouth.w, mouth.d).rotateX(-Math.PI / 2)), glowMat);
    glow.position.y = mouth.floor; opened.add(glow);
    const coneMat = own(new THREE.MeshBasicMaterial({ color: tint.clone().lerp(new THREE.Color(0xffffff), 0.15), map: tex.cone, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const r0 = Math.min(mouth.w, mouth.d) * 0.5;
    const cone = new THREE.Mesh(own(new THREE.CylinderGeometry(r0 * 1.5, r0 * 0.85, 1.3, 32, 1, true).translate(0, 0.65, 0)), coneMat);
    cone.position.y = mouth.floor; opened.add(cone);
    const inner = new THREE.PointLight(tint, 0, 3, 1.5); inner.position.y = mouth.y + 0.1; opened.add(inner);

    // the camera: the chest fills the middle square of a canvas ROOM times as big
    const R = Math.hypot(S.x, S.z) * 0.5 * spec.zoom * ROOM;
    const camera = new THREE.OrthographicCamera(-R, R, R, -R, 0.1, 30);
    const at = new THREE.Vector3(0, MID, 0);
    const eye = new THREE.Vector3(Math.sin(VIEW.turn) * Math.cos(VIEW.pitch), Math.sin(VIEW.pitch), Math.cos(VIEW.turn) * Math.cos(VIEW.pitch)).multiplyScalar(10);
    camera.position.copy(at).add(eye); camera.lookAt(at);

    // ---- the motion ----
    const sq = spring(1, 320, 13);              // squash: y this, x and z 1/√ of it
    const lidA = spring(0, 170, 11);            // the lid's swing
    let shake = 0;                               // camera shake, dying away
    const land = (amount) => { sq.x = 1 - 0.28 * amount; sq.v = 0; shake = Math.max(shake, 0.6 * amount); };
    // the three taps' flips: [axis, turns, hop]
    const FLIPS = [['y', 1, 0.45], ['z', -1, 0.6], ['x', 1, 0.75]];
    let lit = 0; let litOut = 0;
    const jitter = new THREE.Vector3();
    const resize = () => {
      const px = Math.max(1, Math.round(canvas.clientWidth * Math.min(2, devicePixelRatio)));
      if (canvas.width !== px) renderer.setSize(px, px, false);
    };
    let last = performance.now();
    const frame = (now) => {
      if (gone) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      resize();
      const t = (now - act.t0) / 1000;
      let y = 0; let rx = 0; let ry = 0; let rz = 0;
      const w = spec.wild;
      stand.visible = act.kind !== 'hidden';
      switch (act.kind) {
        case 'hidden': break;
        case 'drop': {
          const k = clamp01(t / 0.42);
          y = 2.4 * (1 - k * k);
          ry = (1 - easeOut(k)) * 1.2;
          if (k >= 1 && !act.landed) { act.landed = true; land(1.1); }
          break;
        }
        case 'flip': {
          const [axis, turns, hop] = FLIPS[(act.n - 1) % 3];
          const dur = 0.5 + 0.06 * w;
          const k = clamp01(t / dur);
          y = 4 * hop * w * k * (1 - k);
          const a = easeInOut(k) * Math.PI * 2 * turns * (act.n === 3 && w > 1.1 ? 2 : 1);
          if (axis === 'x') rx = a; else if (axis === 'y') ry = a; else rz = a;
          if (k >= 1 && !act.landed) { act.landed = true; land(0.7 + 0.2 * act.n); }
          break;
        }
        case 'charge': {
          const k = clamp01(t / act.s);
          y = 0.28 * easeOut(k);
          // spinning up, shaking harder
          act.spin = (act.spin || 0) + dt * (2 + 26 * k * k) * w;
          ry = act.spin;
          const j = 0.02 + 0.12 * k * k;
          rx = Math.sin(now * 0.09) * j; rz = Math.cos(now * 0.11) * j;
          sq.to = 1 + 0.08 * k;
          lit = 0.4 + 0.6 * k;
          break;
        }
        case 'open': {
          // under the white: the open chest, landing with a big squash, its lid flying back
          if (!act.swapped) {
            act.swapped = true; shutMesh.visible = false; opened.visible = true; sq.to = 1;
            if (act.quick) { lidA.x = lidA.to = LID_OPEN; lidA.v = 0; sq.x = 1; sq.v = 0; } else { land(1.4); sq.x = 0.62; lidA.to = LID_OPEN; lidA.v = 9; }
          }
          y = act.quick ? 0 : Math.max(0, 0.35 * (1 - t / 0.18));
          const on = act.quick ? 1 : clamp01((t - 0.08) / 0.35);
          const breathe = 0.85 + 0.15 * Math.sin(now / 1000 * 2.4);
          glowMat.opacity = on * 0.8 * breathe; coneMat.opacity = on * 0.45 * breathe;
          cone.scale.set(1, 0.5 + 0.5 * on, 1); cone.rotation.y = now / 2500;
          inner.intensity = 3.5 * on * breathe;
          // then it sways gently, showing its inside
          ry = Math.sin(now / 1000 * 0.7) * 0.16 * on;
          y += 0.02 * Math.sin(now / 1000 * 1.8) * on;
          lit = 0;
          break;
        }
        default: { // idle: a slow bob
          y = 0.025 * Math.sin(t * 2.2); ry = 0.07 * Math.sin(t * 0.9);
        }
      }
      stand.position.y = y;
      spin.rotation.set(rx, ry, rz);
      const s = sq.step(dt);
      squash.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
      if (lidHinge) lidHinge.rotation.z = -lidA.step(dt);
      litOut += (lit - litOut) * Math.min(1, dt * 8);
      host.style.setProperty('--lit3d', litOut.toFixed(3));
      // the camera shakes on the landings
      shake *= Math.exp(-dt * 9);
      camera.position.copy(at).add(eye);
      if (shake > 0.002) camera.position.add(jitter.set((Math.random() - 0.5) * shake * 0.12, (Math.random() - 0.5) * shake * 0.12, 0));
      renderer.render(scene, camera);
      // a finished drop or flip settles into the idle bob
      if ((act.kind === 'drop' && t > 0.9) || (act.kind === 'flip' && t > 0.8)) act = { kind: 'idle', t0: now };
    };
    raf = requestAnimationFrame(frame);
    host.append(canvas);
    canvas.__chest = { THREE, opened, lidHinge, camera, S };   // for tools/chest-lab.html
    api = { dispose: () => { renderer.dispose(); disposables.forEach((d) => d.dispose?.()); } };
    return true;
  })().catch((e) => { console.warn('chest3d', e); return false; });

  const start = (kind, extra = {}) => { act = { kind, t0: performance.now(), ...extra }; };
  return {
    ready,
    drop: () => start('drop'),
    tap: (n) => start('flip', { n }),
    charge: (ms) => start('charge', { s: ms / 1000 }),
    open: (quick = false) => { if (act.kind !== 'open') start('open', { quick }); },
    dispose() { gone = true; cancelAnimationFrame(raf); api?.dispose(); canvas.remove(); },
  };
}
