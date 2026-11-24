// bake-walls.js: a level's base walls from its 3D wall kit (Tripo: pillar, wall run, gate; MOSKE APP/Island/
// tripo-walls), laid out round the lawn exactly as tools/cut-walls.py lays the painted ones, rendered with the base's
// camera (base-gl.js) and the map's sun so each casts a real shadow on the grass, and saved as the same pictures
// (icons/Plot/walls-<slug>-<side>-<tag>.webp) with their layout (walls-<slug>-<tag>.json) for plot-walls.js.
//
//   tools/bake-walls.html?theme=05-navy-club&tag=t3     (the kit in tools/bake/<theme>/{pillar,wall-run,gate}.glb)
//   tools/bake-walls.html?theme=05-navy-club&repaint=1  each side for repainting instead: the walls alone on flat
//       #00FF00 (<side>-render.png, padded to a picture shape Gemini keeps), their shadow alone (<side>-shade.png) and
//       where both go (layout.json), into the theme's repaint folder in MOSKE APP; tools/cut-wall-repaints.py puts the
//       repaints back over the shadows
//
// The scene: one unit is one lawn tile, X along u, Z along v, Y up, so a ground point (u, 0, v) lands on the map at
// B + u·EU + v·EV, as cut-walls.py's P(u, v).

import * as THREE from '../vendor/three/three.module.min.js';
import { GLTFLoader } from '../vendor/three/GLTFLoader.js';

const q = new URLSearchParams(location.search);
const THEME = q.get('theme') || '05-navy-club';
const SLUG = THEME.split('-').slice(1).join('-');
const TAG = q.get('tag') || 't3';
const SAVE = q.get('save') !== '0';
const REPAINT = q.get('repaint') === '1';
const log = (m) => { document.querySelector('#log').textContent += `${m}\n`; console.log(m); };

// ---- the lawn and the walls' lines, as cut-walls.py ----
const B = [5239.9, 5627.0], R = [7701.3, 6855.3], L = [2795.8, 6852.7];
const EU = [(R[0] - B[0]) / 48, (R[1] - B[1]) / 48], EV = [(L[0] - B[0]) / 48, (L[1] - B[1]) / 48];
const BACK = -5.3, FRONT = 48 + 11.4;
const SIDES = [   // id, layer, from (u, v), to (u, v), which end is a corner
  ['bl', 'back', [BACK, FRONT], [BACK, 27.0], 'a'],
  ['br', 'back', [27.0, BACK], [FRONT, BACK], 'c'],
  ['fl1', 'front', [BACK, FRONT], [23.3, FRONT], 'a'],
  ['fl2', 'front', [26.6, FRONT], [FRONT, FRONT], 'c'],
  ['fr1', 'front', [FRONT, FRONT], [FRONT, 27.8], 'a'],
  ['fr2', 'front', [FRONT, 20.3], [FRONT, BACK], 'c'],
];
const GATES = [['road', 'fl1', 'fl2'], ['jetty', 'fr1', 'fr2']];
// back to front, as they're stacked on the page
const ORDER = ['bl', 'br', 'fl1', 'road', 'fl2', 'fr2', 'jetty', 'fr1'];
// the corner pillars, and which picture each goes in (the nearer of its two sides)
const CORNERS = [[[BACK, FRONT], 'fl1'], [[FRONT, FRONT], 'fr1'], [[FRONT, BACK], 'fr2']];
const SUN = [0.55, 0.22];   // the map's shadows: their run per px of height (right, down)
const PILLAR = 390;          // world px from a pillar's cap to its foot
const GATE_H = 1.3;          // a gate's top over a pillar's
const STORE = 0.75;          // the pictures are stored at 3/4 of their world size
const SS = 2;                // rendered at twice that, then scaled down (smooth edges)

// ---- the camera: base-gl.js's, turned and tilted to the map's slant; G maps its frame to world px ----
const slant = (Math.abs(EU[1] / EU[0]) + Math.abs(EV[1] / EV[0])) / 2;
const tilt = Math.asin(Math.min(0.95, slant));
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
const target = new THREE.Vector3(27, 0, 27);
camera.position.copy(target).addScaledVector(new THREE.Vector3(Math.cos(tilt) * Math.SQRT1_2, Math.sin(tilt), Math.cos(tilt) * Math.SQRT1_2), 600);
camera.lookAt(target); camera.updateMatrixWorld(true);
const viewOf = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
const q0 = viewOf(0, 0, 0), qu = viewOf(1, 0, 0), qv = viewOf(0, 0, 1);
const a_ = qu.x - q0.x, b_ = qv.x - q0.x, c_ = qu.y - q0.y, d_ = qv.y - q0.y, det = a_ * d_ - b_ * c_;
const i11 = d_ / det, i12 = -b_ / det, i21 = -c_ / det, i22 = a_ / det;
const g11 = EU[0] * i11 + EV[0] * i21, g12 = EU[0] * i12 + EV[0] * i22;
const g21 = EU[1] * i11 + EV[1] * i21, g22 = EU[1] * i12 + EV[1] * i22;
const G = [g11, g12, B[0] - g11 * q0.x - g12 * q0.y, g21, g22, B[1] - g21 * q0.x - g22 * q0.y];
/** A scene point's place on the map, in world px. */
const toWorld = (p) => { const v = viewOf(p.x, p.y, p.z); return [G[0] * v.x + G[1] * v.y + G[2], G[3] * v.x + G[4] * v.y + G[5]]; };
const P = (u, v) => new THREE.Vector3(u, 0, v);
// how many world px a tile of height is on screen, so a pillar is PILLAR px tall
const KV = toWorld(new THREE.Vector3(0, 0, 0))[1] - toWorld(new THREE.Vector3(0, 1, 0))[1];
const HP = PILLAR / KV;
log(`tilt ${(tilt * 180 / Math.PI).toFixed(1)}°, ${KV.toFixed(1)} px a tile of height, a pillar ${HP.toFixed(2)} tiles tall`);
/** Show the world rect [x0, x0 + w] × [y0, y0 + h] (base-gl.js project). */
function frame(x0, y0, w, h) {
  const n = 1, f = 2000;
  camera.projectionMatrix.set(
    (2 * G[0]) / w, (2 * G[1]) / w, 0, (2 * (G[2] - x0)) / w - 1,
    (-2 * G[3]) / h, (-2 * G[4]) / h, 0, 1 - (2 * (G[5] - y0)) / h,
    0, 0, -2 / (f - n), -(f + n) / (f - n),
    0, 0, 0, 1);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

// ---- the sun: the direction whose shadows fall as the map's ----
// a point Y up casts its shadow (dx, dz) along the ground; on the map that's SUN × its height in px
const wx = toWorld(new THREE.Vector3(1, 0, 0)), wz = toWorld(new THREE.Vector3(0, 0, 1)), w0 = toWorld(new THREE.Vector3(0, 0, 0));
const mx = [wx[0] - w0[0], wx[1] - w0[1]], mz = [wz[0] - w0[0], wz[1] - w0[1]];
const want = [SUN[0] * KV, SUN[1] * KV];
const md = mx[0] * mz[1] - mz[0] * mx[1];
const dx = (want[0] * mz[1] - mz[0] * want[1]) / md, dz = (mx[0] * want[1] - want[0] * mx[1]) / md;
const sunDir = new THREE.Vector3(-dx, 1, -dz).normalize();

// ---- the renderer and the scene ----
const canvas = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;   // with radius: soft edges, like the map's
const scene = new THREE.Scene();
const hemi = new THREE.HemisphereLight(0xfff1e0, 0xa89668, Number(q.get('hemi') || 2.2));
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffdcae, Number(q.get('sun') || 2.9));
sun.castShadow = true;
sun.shadow.mapSize.set(8192, 8192);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
sun.shadow.radius = Number(q.get('soft') || 5); sun.shadow.blurSamples = 16;
scene.add(sun); scene.add(sun.target);
// the grass takes the shadows and nothing else
const catcher = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: Number(q.get('shade') || 0.42) }));
catcher.position.set(27, 0, 27); catcher.receiveShadow = true; scene.add(catcher);
// and a soft dark line where a wall meets it: a band dark in its middle, across a wall's thickness (contact())
const band = (across) => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
  const g = across === 'x' ? x.createLinearGradient(0, 0, 64, 0) : x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
};
const bandX = band('x'), bandZ = band('z');

// ---- the kit ----
const loader = new GLTFLoader();
const load = (name) => new Promise((ok, bad) => loader.load(`bake/${THEME}/${name}.glb`, (g) => ok(g.scene), undefined, bad));
const box = (o) => new THREE.Box3().setFromObject(o);
/** A kit piece turned so its length runs along Z (Tripo lays some along X), and a further `turn` quarter turns
 *  (?turn=2 for a theme whose face looks the wrong way; ?pturn= for its pillar). */
function upright(o, long, turn) {
  const s = box(o).getSize(new THREE.Vector3());
  const g = new THREE.Group(); g.add(o);
  g.rotation.y = ((long && s.x > s.z ? 1 : 0) + turn) * Math.PI / 2;
  g.updateMatrixWorld(true);
  return g;
}
const TURN = Number(q.get('turn') || 0), PTURN = Number(q.get('pturn') || 0);
const [pillar0, run0, gate0] = await Promise.all([load('pillar'), load('wall-run'), load('gate')])
  .then(([p, r, g]) => [upright(p, false, PTURN), upright(r, true, TURN), upright(g, true, Number(q.get('gturn') ?? TURN))]);
for (const o of [pillar0, run0, gate0]) o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
const bp = box(pillar0), br = box(run0), bg = box(gate0);
log(`pillar ${bp.getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(2))}, run ${br.getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(2))}, gate ${bg.getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(2))}`);
// the run and the gate lie along their Z; their face (the side the picture showed) looks along +X or −X
const FLIP = q.get('flip') === '1';
const kRun = HP / (br.max.y - br.min.y);
const kPil = HP / (bp.max.y - bp.min.y);
const kGate = GATE_H * HP / (bg.max.y - bg.min.y);
const runLen = (br.max.z - br.min.z) * kRun;
const pilW = (bp.max.x - bp.min.x) * kPil;           // a pillar's width, in tiles
const gateLen = (bg.max.z - bg.min.z) * kGate;
log(`run ${runLen.toFixed(1)} tiles long, pillar ${pilW.toFixed(2)} wide, gate ${gateLen.toFixed(1)} long`);

/** A copy of a kit piece standing at ground point p, its length along the unit vector d (in XZ), scaled k (and s along its length). */
function piece(src, b, p, d, k, s = 1) {
  const o = src.clone(true);
  const g = new THREE.Group();
  // centre its footprint on the origin, its foot on the ground
  o.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.add(o);
  g.scale.set(k, k, k * s);
  // its Z along d: turned about Y; flipped round if its face looks the other way
  g.rotation.y = Math.atan2(d.x, d.z) + (FLIP ? Math.PI : 0);
  g.position.copy(p);
  return g;
}

/** A side's walls from A to C: runs end to end, each end pillar on the next one's first, stretched to fit. */
function wallSide(A, C, corner) {
  const d = C.clone().sub(A); const len = d.length(); d.normalize();
  let a0 = 0, a1 = len;
  if (corner.includes('a')) a0 -= pilW / 2;
  if (corner.includes('c')) a1 += pilW / 2;
  const S = a1 - a0;
  const step = runLen - pilW;
  // as many runs as stretch them least (squashed or pulled, the same)
  const fitOf = (m) => Math.abs(Math.log(S / (m * step + pilW)));
  let n = Math.max(1, Math.floor((S - pilW) / step));
  if (fitOf(n + 1) < fitOf(n)) n += 1;
  const s = S / (n * step + pilW);
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const mid = a0 + (i * step + runLen / 2) * s;
    g.add(piece(run0, br, A.clone().addScaledVector(d, mid), d, kRun, s));
  }
  g.userData.n = n; g.userData.s = s;
  return g;
}

// the sides' ends, the walls by a gate pulled back under its stubs
const ends = Object.fromEntries(SIDES.map(([id, , a, c]) => [id, [P(...a), P(...c)]]));
const groups = {};
for (const [name, before, after] of GATES) {
  const Pa = ends[before][1], Pc = ends[after][0];
  const Q = Pa.clone().add(Pc).multiplyScalar(0.5);
  const d = Pc.clone().sub(Pa).normalize();
  const half = gateLen / 2;
  // the walls' ends meeting the gap: half a pillar inside the gate's ends
  ends[before][1] = Q.clone().addScaledVector(d, -(half - pilW / 2));
  ends[after][0] = Q.clone().addScaledVector(d, half - pilW / 2);
  const g = new THREE.Group(); g.add(piece(gate0, bg, Q, d, kGate)); groups[name] = g;
}
for (const [id, , , , corner] of SIDES) {
  const [A, C] = ends[id];
  groups[id] = wallSide(A, C, corner);
  log(`${id}: ${groups[id].userData.n} runs, stretched ${groups[id].userData.s.toFixed(3)}`);
}
for (const [[u, v], into] of CORNERS) {
  groups[into].add(piece(pillar0, bp, P(u, v), new THREE.Vector3(0, 0, 1), kPil * 1.04));
}
for (const g of Object.values(groups)) { scene.add(g); g.updateMatrixWorld(true); }

/** A thin dark band under each piece where it meets the ground. */
function contact(g) {
  const out = new THREE.Group();
  for (const m of g.children) {
    const b = box(m); const sz = b.getSize(new THREE.Vector3()); const c = b.getCenter(new THREE.Vector3());
    if (Math.max(sz.x, sz.z) < 2 * Math.min(sz.x, sz.z)) continue;   // a pillar: its own shadow is enough
    const alongX = sz.x > sz.z;
    // a plane on the ground: its texture's x runs along X, its y along Z
    const geo = new THREE.PlaneGeometry(alongX ? sz.x + 0.6 : sz.x + 1.6, alongX ? sz.z + 1.6 : sz.z + 0.6).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0x0f1a14, alphaMap: alongX ? bandZ : bandX, transparent: true, opacity: 0.4, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(c.x, 0.01, c.z); mesh.renderOrder = -1;
    out.add(mesh);
  }
  return out;
}
const contacts = Object.fromEntries(Object.entries(groups).map(([k, g]) => { const c = contact(g); scene.add(c); return [k, c]; }));

// ---- bake each side on its own, with its own shadow ----
const show = (k) => { for (const [n, g] of Object.entries(groups)) { g.visible = n === k; contacts[n].visible = n === k; } };
async function bake(k) {
  show(k);
  const g = groups[k];
  const b = box(g);
  // the sun's shadow camera round this side
  const c = b.getCenter(new THREE.Vector3());
  sun.target.position.copy(c); sun.position.copy(c).addScaledVector(sunDir, 120);
  const r = b.getSize(new THREE.Vector3()).length() * 0.55 + 8;
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 400 });
  sun.shadow.camera.updateProjectionMatrix(); sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
  // the picture's rect: the side's box and where its shadow falls, in world px
  const pts = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
    pts.push(toWorld(new THREE.Vector3(x, y, z)));
    pts.push(toWorld(new THREE.Vector3(x + dx * y, 0, z + dz * y)));
  }
  const pad = 24;
  const x0 = Math.min(...pts.map((p) => p[0])) - pad, x1 = Math.max(...pts.map((p) => p[0])) + pad;
  const y0 = Math.min(...pts.map((p) => p[1])) - pad, y1 = Math.max(...pts.map((p) => p[1])) + pad;
  const W = Math.round((x1 - x0) * STORE), H = Math.round((y1 - y0) * STORE);
  frame(x0, y0, x1 - x0, y1 - y0);
  if (REPAINT) return forRepaint(k, g, { x0, y0, ww: x1 - x0, wh: y1 - y0, W, H });
  renderer.setPixelRatio(1); renderer.setSize(W * SS, H * SS, false);
  renderer.render(scene, camera);
  // down to its stored size, trimmed to what's drawn
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const ctx = out.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(canvas, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;
  let l = W, t = H, rr = 0, bb = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 3) { if (x < l) l = x; if (x > rr) rr = x; if (y < t) t = y; if (y > bb) bb = y; }
  const tw = rr - l + 1, th = bb - t + 1;
  const trim = document.createElement('canvas'); trim.width = tw; trim.height = th;
  trim.getContext('2d').drawImage(out, l, t, tw, th, 0, 0, tw, th);
  const name = `walls-${SLUG}-${k}-${TAG}.webp`;
  const blob = await new Promise((ok) => trim.toBlob(ok, 'image/webp', 0.86));
  if (SAVE) await fetch(`/__bake/${name}`, { method: 'PUT', body: blob });
  const thumb = trim.cloneNode(); thumb.getContext('2d').drawImage(trim, 0, 0);
  thumb.style.cssText = 'max-width:45%;margin:4px;background:#7aa65a'; document.body.append(thumb);
  log(`${name}: ${tw}×${th}, ${(blob.size / 1024).toFixed(0)} KB`);
  return { src: `icons/Plot/${name}`, x: +(x0 + l / STORE).toFixed(1), y: +(y0 + t / STORE).toFixed(1), w: +(tw / STORE).toFixed(1), h: +(th / STORE).toFixed(1) };
}

// the picture shapes Gemini gives back as they went in
const SHAPES = [1, 4 / 3, 3 / 2, 16 / 9, 3 / 4, 2 / 3];
const png = (cv) => new Promise((ok) => cv.toBlob(ok, 'image/png'));
const put = (name, body) => fetch(`/__bake/repaint/${THEME}/${name}`, { method: 'PUT', body });
/** A side for repainting: the walls alone on green (twice the stored size), and their shadow alone. */
async function forRepaint(k, g, f) {
  const RS = 2;                                   // the render to repaint, at twice the stored size
  const sw = f.W * RS, sh = f.H * RS;
  // 1. the walls on flat green, lit and self-shadowed as in the game, nothing on the ground
  catcher.visible = false; contacts[k].visible = false;
  renderer.setClearColor(0x00ff00, 1);
  renderer.setPixelRatio(1); renderer.setSize(sw, sh, false);
  renderer.render(scene, camera);
  const shape = SHAPES.reduce((a, b) => (Math.abs(Math.log(b * sh / sw)) < Math.abs(Math.log(a * sh / sw)) ? b : a));
  const pw = Math.max(sw, Math.round(sh * shape)), ph = Math.max(sh, Math.round(pw / shape));
  const ox = Math.round((pw - sw) / 2), oy = Math.round((ph - sh) / 2);
  const src = document.createElement('canvas'); src.width = pw; src.height = ph;
  const sx = src.getContext('2d'); sx.fillStyle = '#00FF00'; sx.fillRect(0, 0, pw, ph); sx.drawImage(canvas, ox, oy);
  // 2. their shadow alone: the walls drawn into depth only, so they still throw it
  renderer.setClearColor(0x000000, 0);
  catcher.visible = true; contacts[k].visible = true;
  const mats = []; g.traverse((m) => { if (m.isMesh) for (const mt of [m.material].flat()) { mats.push(mt); mt.colorWrite = false; } });
  renderer.setSize(f.W * SS, f.H * SS, false);
  renderer.render(scene, camera);
  for (const mt of mats) mt.colorWrite = true;
  const shade = document.createElement('canvas'); shade.width = f.W; shade.height = f.H;
  const cx = shade.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(canvas, 0, 0, f.W, f.H);
  if (SAVE) { await put(`${k}-render.png`, await png(src)); await put(`${k}-shade.png`, await png(shade)); }
  const thumb = src.cloneNode(); thumb.getContext('2d').drawImage(src, 0, 0); thumb.style.cssText = 'max-width:30%;margin:4px'; document.body.append(thumb);
  log(`${k}: render ${pw}×${ph} (walls ${sw}×${sh} at ${ox},${oy}), shade ${f.W}×${f.H}`);
  return { side: k, layer: ['bl', 'br'].includes(k) ? 'back' : 'front', x0: f.x0, y0: f.y0, ww: f.ww, wh: f.wh, W: f.W, H: f.H, render: { w: pw, h: ph, ox, oy, sw, sh } };
}

if (REPAINT) {
  const sides = [];
  for (const k of ORDER) sides.push(await bake(k));
  if (SAVE) await put('layout.json', JSON.stringify({ theme: THEME, slug: SLUG, store: STORE, sides }, null, 1));
  log('done');
} else {
  const info = { theme: SLUG, back: [], front: [] };
  for (const k of ORDER) {
    const r = await bake(k);
    info[['bl', 'br'].includes(k) ? 'back' : 'front'].push(r);
  }
  if (SAVE) await fetch(`/__bake/walls-${SLUG}-${TAG}.json`, { method: 'PUT', body: JSON.stringify(info, null, 1) });
  window.BAKED = info;
  log('done');
}
