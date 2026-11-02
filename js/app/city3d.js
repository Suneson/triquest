// city3d.js — what moves in the base's city (docs/CITY.md, "In the app"):
//
//   far clouds     flat pictures far behind everything (icons/City/sky-clouds/), drifting right
//                  to left slowly in screen space, so they feel far away
//   clouds         3D clouds (models/city/cloud-*.glb) drifting right to left in the city: some
//                  behind the buildings, a few in front of them
//   the sign       a street sign by the garage door (models/city/sign.glb), its white panel
//                  counting down to the next delivery; tap it for the list (delivery-view.js)
//   the truck      the MOSKE van (models/city/truck.glb): it drives in from the bottom right as a
//                  delivery's countdown runs out, waits at the garage door, and drives off
//
// Two transparent WebGL canvases cover the stage's viewport: one under the city picture (the
// clouds behind the buildings show only through its transparent sky) and one over it. Their
// orthographic camera matches the city: X runs along the ground's e1 = (1, SLOPE) world px,
// Z along e2 = (−1, SLOPE), Y up, so a ground point (X, Z) is world px (X − Z, SLOPE (X + Z)).
// The camera follows the stage's pan and zoom (setView). three.js loads only on the base.

import { loadThree } from './runner3d.js';

const SLOPE = 0.489;
const EL = Math.asin(SLOPE);              // the camera's tilt: a ground edge falls SLOPE per px
const SIGMA = Math.SQRT2;                 // world px per camera unit (X runs 1 px across per unit)
const UP = Math.cos(EL) * SIGMA;          // world px a point rises on screen per unit of height
const FPS = 30;
const CLOUD_UP = 2400;                    // how high the 3D clouds fly (units: above the tallest roof)

// in px of the city picture (5376 × 4980; drawn in tiles, icons/City/layers/tiles/)
export const SIGN_AT = [2940, 3548];             // on the pavement, left of the garage door
export const SIGN_HEIGHT = 320;                  // px tall on screen
// the truck's road: in from the bottom right, round the corner, to the garage door; then it
// turns round and drives off down the same road, out at the bottom
// The street grid (tools/compose-city.py) in px of the city picture: block (a, b) has its centre
// at C0 + (a − b) P across and (a + b) SLOPE P down; the roads run along a = ±½ and b = ±½.
const GRID = { c0: [2691.5, 3245.5], P: 1391 };
const lat = (a, b) => [GRID.c0[0] + (a - b) * GRID.P, GRID.c0[1] + (a + b) * SLOPE * GRID.P];
// in from the right along the road between the stadium and the pool (b = −½), round the corner
// by the stadium onto the road past the garage (a = ½), stopping at its door; then on down that
// road and out at the bottom. Each leg keeps to the lane on the tower's side.
const ROUTE_IN = [lat(1.6, -0.45), lat(0.45, -0.45), lat(0.45, 0.24)];
const ROUTE_OUT = [lat(0.45, 0.24), lat(0.45, 2.3)];
/** Where the truck stops at the garage door (px of the city picture): the parcels wait there. */
export const TRUCK_STOP = ROUTE_IN[ROUTE_IN.length - 1];
const TRUCK_LEN = 250;                    // px along the road
const SPEED = 150;                        // px of the city picture per second
const WAIT = 8;                           // s at the garage door

/** A world px point on the ground as a 3D point. */
const ground = ([wx, wy]) => ({ x: (wx + wy / SLOPE) / 2, z: (wy / SLOPE - wx) / 2 });
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const routeLength = (r) => r.slice(1).reduce((s, p, i) => s + dist(r[i], p), 0);
const IN_S = routeLength(ROUTE_IN) / SPEED;     // how long the drive in takes
const OUT_S = routeLength(ROUTE_OUT) / SPEED;

/** Where along a route the truck is after `d` px, and which way it faces. */
function along(route, d) {
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]; const b = route[i]; const l = dist(a, b);
    if (d <= l || i === route.length - 1) {
      const t = Math.min(1, Math.max(0, d / l));
      return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], dir: [b[0] - a[0], b[1] - a[1]] };
    }
    d -= l;
  }
  return { p: route[route.length - 1], dir: [1, 0] };
}

/**
 * Where the truck is `t` seconds from a delivery's end (negative before it): driving in during
 * the last IN_S seconds, waiting WAIT seconds at the door, then driving off. null when it's
 * not on screen.
 */
/** How long after a delivery's end the truck is still on screen (s): it waits, then drives off. */
export const TRUCK_AFTER = WAIT + OUT_S;

export function truckAt(t) {
  if (t < -IN_S || t > WAIT + OUT_S) return null;
  if (t <= 0) return { ...along(ROUTE_IN, (t + IN_S) * SPEED), moving: t < 0 };
  if (t <= WAIT) { const a = along(ROUTE_IN, Infinity); return { p: a.p, dir: a.dir, moving: false }; }
  return { ...along(ROUTE_OUT, (t - WAIT) * SPEED), moving: true };
}

const FAR = [
  { src: 'icons/City/sky-clouds/cloud-1.webp', y: 0.05, w: 0.42, v: 5 },
  { src: 'icons/City/sky-clouds/cloud-2.webp', y: 0.2, w: 0.36, v: 4 },
  { src: 'icons/City/sky-clouds/cloud-4.webp', y: 0.12, w: 0.22, v: 7 },
  { src: 'icons/City/sky-clouds/cloud-3.webp', y: 0.28, w: 0.14, v: 9 },
  { src: 'icons/City/sky-clouds/cloud-5.webp', y: 0.02, w: 0.12, v: 10 },
  { src: 'icons/City/sky-clouds/cloud-6.webp', y: 0.34, w: 0.08, v: 12 },
];
// the 3D clouds: which model, where (px of the city picture), how wide (px), and how fast (px/s)
const CLOUDS = [
  { m: 'a', at: [700, 900], w: 170, v: 16, front: false },
  { m: 'b', at: [2300, 650], w: 240, v: 13, front: false },
  { m: 'c', at: [4100, 1050], w: 210, v: 15, front: false },
  { m: 'b', at: [3300, 1500], w: 190, v: 18, front: false },
  { m: 'a', at: [1500, 1900], w: 140, v: 20, front: false },
  { m: 'c', at: [4900, 2100], w: 160, v: 17, front: false },
  { m: 'a', at: [3900, 350], w: 120, v: 22, front: true },
  { m: 'c', at: [1200, 2700], w: 140, v: 24, front: true },
];

let shared = null;   // the canvases and the far clouds, kept across the stage's re-renders

/**
 * The city's moving things over the stage's viewport `vp` (an element the world is in).
 *   worldW        the city picture's width (px), for where the clouds wrap round
 *   deliveries()  when each delivery ends (epoch ms): those still coming and those just come
 *   now()         the server's time (epoch ms)
 *   label         { title, clock(ms) }: the sign's words and its countdown format
 *   parked()      true while a parcel waits at the door: the truck stays until it's opened
 *   reduced()     true under reduced motion: no drifting, the truck only appears parked
 * Returns { setView(v, w, h) }.
 */
export function mountCity3d(vp, { worldW, deliveries, now, label, parked, reduced }) {
  if (!shared) shared = makeShared();
  const { far, back, front } = shared;
  // into this render's viewport: the far clouds and the back canvas under the world, the front over it
  const world = vp.querySelector('[data-dg-world]');
  vp.insertBefore(far, world); vp.insertBefore(back.canvas, world); world.after(front.canvas);
  shared.opts = { worldW, deliveries, now, label, parked, reduced };
  if (!shared.farLoop) farLoop();
  if (!shared.started) start();
  return {
    setView(v, w, h) { shared.view = { v, w, h }; shared.dirty = true; },
  };
}

function makeShared() {
  const far = document.createElement('div');
  far.className = 'dg-far';
  far.setAttribute('aria-hidden', 'true');
  // each one sized as a share of the viewport straight away (never its picture's natural size)
  far.innerHTML = FAR.map((c, i) => `<img src="${c.src}" alt="" draggable="false"
    style="width:${(c.w * 100).toFixed(1)}%;left:${((i / FAR.length) * 100).toFixed(1)}%;top:${(c.y * 100).toFixed(1)}%">`).join('');
  const canvas = (cls) => { const c = document.createElement('canvas'); c.className = `dg-3d ${cls}`; c.setAttribute('aria-hidden', 'true'); return c; };
  return { far, back: { canvas: canvas('is-back') }, front: { canvas: canvas('is-front') }, view: null, dirty: true, t0: performance.now(), farX: FAR.map((c, i) => i / FAR.length) };
}

/** The far clouds drift on their own, WebGL or not (left as a share of the viewport). */
function farLoop() {
  shared.farLoop = true;
  let last = performance.now();
  const step = (now) => {
    requestAnimationFrame(step);
    const dt = Math.min(0.2, (now - last) / 1000); last = now;
    if (!shared.far.isConnected || shared.opts?.reduced?.()) return;
    const vw = shared.far.clientWidth || 1;
    [...shared.far.children].forEach((el, i) => {
      const c = FAR[i];
      shared.farX[i] -= (c.v * dt) / vw;
      if (shared.farX[i] < -c.w) shared.farX[i] = 1 + Math.random() * 0.3;
      el.style.left = `${(shared.farX[i] * 100).toFixed(2)}%`;
    });
  };
  requestAnimationFrame(step);
}

async function start() {
  shared.started = true;
  let L;
  try { L = await loadThree(); } catch { return; }
  const { THREE } = L;
  const loader = new L.GLTFLoader(); loader.setMeshoptDecoder(L.MeshoptDecoder);
  const load = (name) => new Promise((res, rej) => loader.load(new URL(`../../models/city/${name}.glb`, import.meta.url).href, (g) => res(g.scene), undefined, rej));

  const mkRenderer = (canvas) => {
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
    r.setClearColor(0x000000, 0);
    return r;
  };
  const lights = (scene) => {
    // soft sky light from above, a pale blue bounce from below, the sun from the upper left
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa9c2ea, 2.1));
    const sun = new THREE.DirectionalLight(0xfff4e6, 1.6); sun.position.set(-3, 6, 2); scene.add(sun);
  };
  const backScene = new THREE.Scene(); lights(backScene);
  const frontScene = new THREE.Scene(); lights(frontScene);
  const backR = mkRenderer(shared.back.canvas); const frontR = mkRenderer(shared.front.canvas);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 40000);
  const D = 20000;
  cam.position.set(D * Math.cos(EL) * Math.SQRT1_2, D * Math.sin(EL), D * Math.cos(EL) * Math.SQRT1_2);
  cam.lookAt(0, 0, 0);

  // the clouds: their own soft white, not the model's texture
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, emissive: 0xdfe9fb, emissiveIntensity: 0.18 });
  const models = {};
  const [ca, cb, cc, sign, truck] = await Promise.all(['cloud-a', 'cloud-b', 'cloud-c', 'sign', 'truck'].map((n) => load(n).catch(() => null)));
  // smooth normals of their own: the compressed model's are packed integers, so they're dropped
  // and worked out again in full floats
  const prepCloud = (g) => {
    if (!g) return null;
    g.traverse((o) => { if (o.isMesh) { o.material = cloudMat; o.geometry.deleteAttribute('normal'); o.geometry.computeVertexNormals(); } });
    return g;
  };
  models.a = prepCloud(ca); models.b = prepCloud(cb); models.c = prepCloud(cc);
  const size = (g) => new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
  const clouds = CLOUDS.filter((c) => models[c.m]).map((c) => {
    const g = models[c.m].clone();
    const s = size(models[c.m]);
    // its width on screen is about the model's X extent across (1 px per unit of X)
    const k = c.w / Math.max(s.x, s.z);
    g.scale.setScalar(k);
    // long side square to the screen, so it drifts across it like the far clouds
    g.rotation.y = Math.PI / 4;
    (c.front ? frontScene : backScene).add(g);
    return { ...c, g };
  });

  // the sign: standing on the pavement, its panel facing out from the lobby (towards +X)
  let signObj = null; let panel = null; let panelCanvas = null; let panelTex = null;
  if (sign) {
    const s = size(sign);
    const k = SIGN_HEIGHT / UP / s.y;
    sign.scale.setScalar(k);
    sign.rotation.y = Math.PI / 2;
    const at = ground(SIGN_AT);
    sign.position.set(at.x, (s.y / 2) * k, at.z);
    frontScene.add(sign);
    signObj = sign;
    // the countdown, drawn onto a plane over the sign's white panel
    panelCanvas = document.createElement('canvas'); panelCanvas.width = 512; panelCanvas.height = 256;
    panelTex = new THREE.CanvasTexture(panelCanvas); panelTex.colorSpace = THREE.SRGBColorSpace;
    panel = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshBasicMaterial({ map: panelTex, transparent: true }));
    panel.position.set(0, s.y * 0.37, s.z / 2 + 0.012);
    sign.add(panel);
  }
  // the truck: parked out of sight until a delivery is near
  let truckObj = null; let truckY = 0;
  if (truck) {
    const s = size(truck);
    const k = TRUCK_LEN / s.x;
    truck.scale.setScalar(k);
    truckY = (s.y / 2) * k;
    truck.visible = false;
    frontScene.add(truck);
    truckObj = truck;
  }

  let lastText = '';
  const drawPanel = (text, sub) => {
    if (!panelCanvas || text === lastText) return;
    lastText = text;
    const g = panelCanvas.getContext('2d');
    g.clearRect(0, 0, 512, 256);
    g.fillStyle = '#16264D'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '800 44px "Mona Sans", system-ui, sans-serif'; g.fillText(sub, 256, 66);
    g.font = '900 112px "Mona Sans", system-ui, sans-serif'; g.fillText(text, 256, 160);
    panelTex.needsUpdate = true;
  };

  let last = 0;
  const frame = (now) => {
    requestAnimationFrame(frame);
    if (!shared.back.canvas.isConnected) return;
    if (now - last < 1000 / FPS && !shared.dirty) return;
    const dt = Math.min(0.2, (now - last) / 1000); last = now;
    const o = shared.opts || {};
    const still = o.reduced?.();
    const vw = shared.view?.w || 1; const vh = shared.view?.h || 1; const v = shared.view?.v;
    if (!v) return;
    // the canvases fill the viewport at the device's pixel ratio (at most 1.5: they're soft shapes)
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    for (const r of [backR, frontR]) { const c = r.domElement; if (c.width !== Math.round(vw * dpr) || c.height !== Math.round(vh * dpr)) { r.setPixelRatio(dpr); r.setSize(vw, vh, false); } }
    // the camera shows exactly the part of the city the stage shows
    cam.left = (-v.tx / v.s) / SIGMA; cam.right = ((vw - v.tx) / v.s) / SIGMA;
    cam.top = (v.ty / v.s) / SIGMA; cam.bottom = (-(vh - v.ty) / v.s) / SIGMA;
    cam.updateProjectionMatrix();

    // the clouds drift right to left and come round again past the city's right edge
    const W = o.worldW || 5376;
    for (const c of clouds) {
      if (!still) c.at = [c.at[0] - c.v * dt, c.at[1]];
      if (c.at[0] < -c.w) c.at = [W + c.w, c.at[1]];
      // high in the sky, above every roof: the point under it on the ground is CLOUD_UP lower
      // on screen, so it shows where `at` says
      const p = ground([c.at[0], c.at[1] + CLOUD_UP * UP]);
      c.g.position.set(p.x, CLOUD_UP, p.z);
    }

    // the sign counts down to the next delivery; the truck brings whichever is ending now
    const t = o.now?.() ?? Date.now();
    const ends = (o.deliveries?.() || []).slice().sort((a, b) => a - b);
    const next = ends.find((e) => e > t);
    if (signObj) drawPanel(next == null ? '—' : o.label?.clock(next - t) || '', o.label?.title || '');
    // the truck: drives in during a delivery's last seconds, then waits at the door for as long
    // as a parcel is waiting there (or its opening is on screen), then drives off
    if (truckObj) {
      const tr = shared.truck ||= { mode: 'off', t0: 0 };
      const nowS = now / 1000;
      const arriving = ends.find((e) => (t - e) / 1000 >= -IN_S && (t - e) / 1000 < 0);
      let at = null;
      if (arriving != null) { at = truckAt((t - arriving) / 1000); tr.mode = 'in'; }
      else if (o.parked?.()) { const a = along(ROUTE_IN, Infinity); at = { p: a.p, dir: a.dir, moving: false }; tr.mode = 'park'; }
      else if (tr.mode === 'in' || tr.mode === 'park') { tr.mode = 'out'; tr.t0 = nowS; }
      if (tr.mode === 'out') {
        const d = (nowS - tr.t0) * SPEED;
        if (d > routeLength(ROUTE_OUT)) tr.mode = 'off'; else at = { ...along(ROUTE_OUT, d), moving: true };
      }
      const show = at && (!still || !at.moving);
      truckObj.visible = !!show;
      if (show) {
        const p = ground(at.p); const d = ground([at.p[0] + at.dir[0], at.p[1] + at.dir[1]]);
        const dX = d.x - p.x; const dZ = d.z - p.z;
        truckObj.position.set(p.x, truckY, p.z);
        // the model faces −X: turn it so it faces the way it drives
        truckObj.rotation.y = Math.atan2(dZ, -dX);
      }
    }
    shared.dirty = false;
    backR.render(backScene, cam);
    frontR.render(frontScene, cam);
  };
  requestAnimationFrame(frame);
}
