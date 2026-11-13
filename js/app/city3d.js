// city3d.js — what moves in the base's city (docs/CITY.md, "In the app"):
//
//   the sign       a street sign by the garage door (models/city/sign.glb), its white panel
//                  counting down to the next delivery; tap it for the list (delivery-view.js)
//   the truck      the MOSKE van (models/city/truck.glb): it drives in from the bottom right as a
//                  delivery's countdown runs out, waits at the garage door, and drives off
//
// A transparent canvas covers the stage's viewport, over the island, drawn by the app's one WebGL
// renderer (gl-shared.js) only when something on it changes: the stage pans or zooms, the sign's
// countdown ticks (once a second), or the truck drives. (The 3D clouds that drifted over the city
// are gone: they kept the whole viewport redrawing 30 times a second.) Its orthographic camera matches the city: X runs along the ground's e1 = (1, SLOPE) world px,
// Z along e2 = (−1, SLOPE), Y up, so a ground point (X, Z) is world px (X − Z, SLOPE (X + Z)).
// The camera follows the stage's pan and zoom (setView). three.js loads only on the base.

import { loadThree } from './runner3d.js';
import { addView } from './gl-shared.js';
import { ISLAND_ART } from '../core/island-art.js';

const SLOPE = 0.489;
const EL = Math.asin(SLOPE);              // the camera's tilt: a ground edge falls SLOPE per px
const SIGMA = Math.SQRT2;                 // world px per camera unit (X runs 1 px across per unit)
const UP = Math.cos(EL) * SIGMA;          // world px a point rises on screen per unit of height
const FPS = 30;

// in px of the city picture (CITY in diorama.js; drawn in tiles, icons/City/layers/tiles/)
const [BASE_X, BASE_Y] = ISLAND_ART.plots.base;
export const SIGN_AT = [BASE_X + 161, BASE_Y + 367]; // on the pavement, left of the garage door
export const SIGN_HEIGHT = 170;                  // px tall on screen
// the truck's road: in from the bottom right, round the corner, to the garage door; then it
// turns round and drives off down the same road, out at the bottom
// The street grid (tools/compose-city.py) in px of the city picture: block (a, b) has its centre
// at C0 + (a − b) P across and (a + b) SLOPE P down; the roads run along a = ±½ and b = ±½.
const GRID = { c0: [BASE_X, BASE_Y], P: 1391 };
const lat = (a, b) => [GRID.c0[0] + (a - b) * GRID.P, GRID.c0[1] + (a + b) * SLOPE * GRID.P];
// in from the right along the road between the stadium and the pool (b = −½), round the corner
// by the stadium onto the road past the garage (a = ½), stopping at its door; then on down that
// road and out at the bottom. Each leg keeps to the lane on the tower's side.
const ROUTE_IN = [lat(1.7, -0.45), lat(0.45, -0.45), lat(0.45, 0.12)];
const ROUTE_OUT = [lat(0.45, 0.12), lat(0.45, 1.7)];
/** Where the truck stops at the garage door (px of the city picture): the parcels wait there. */
export const TRUCK_STOP = ROUTE_IN[ROUTE_IN.length - 1];
const TRUCK_LEN = 150;                    // px along the road
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

let shared = null;   // the canvas, kept across the stage's re-renders

/**
 * The city's moving things over the stage's viewport `vp` (an element the world is in).
 *   deliveries()  when each delivery ends (epoch ms): those still coming and those just come
 *   now()         the server's time (epoch ms)
 *   label         { title, clock(ms) }: the sign's words and its countdown format
 *   parked()      true while a parcel waits at the door: the truck stays until it's opened
 *   reduced()     true under reduced motion: the truck only appears parked
 *   front         the buildings in front of its road out, [{ src, x, y, w, h }] in px of the city, or a function giving them
 *                 picture: drawn over the truck while it's about (and gone again after), so it
 *                 drives off behind them
 * Returns { setView(v, w, h) }.
 */
export function mountCity3d(vp, { deliveries, now, label, parked, reduced, front: frontArt = [] }) {
  if (!shared) {
    const c = document.createElement('canvas'); c.className = 'dg-3d is-front'; c.setAttribute('aria-hidden', 'true');
    shared = { front: { canvas: c }, view: null };
  }
  // into this render's viewport, over the world
  vp.querySelector('[data-dg-world]').after(shared.front.canvas);
  shared.opts = { deliveries, now, label, parked, reduced, front: frontArt };
  if (!shared.started) start();
  shared.draw?.();
  return {
    setView(v, w, h) { shared.view = { v, w, h }; shared.draw?.(); },
  };
}

async function start() {
  shared.started = true;
  let L;
  try { L = await loadThree(); } catch { return; }
  const { THREE } = L;
  const loader = new L.GLTFLoader(); loader.setMeshoptDecoder(L.MeshoptDecoder);
  const load = (name) => new Promise((res, rej) => loader.load(new URL(`../../models/city/${name}.glb`, import.meta.url).href, (g) => res(g.scene), undefined, rej));

  const lights = (scene) => {
    // soft sky light from above, a pale blue bounce from below, the sun from the upper left
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa9c2ea, 2.1));
    const sun = new THREE.DirectionalLight(0xfff4e6, 1.6); sun.position.set(-3, 6, 2); scene.add(sun);
  };
  const frontScene = new THREE.Scene(); lights(frontScene);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 40000);
  const D = 20000;
  cam.position.set(D * Math.cos(EL) * Math.SQRT1_2, D * Math.sin(EL), D * Math.cos(EL) * Math.SQRT1_2);
  cam.lookAt(0, 0, 0);

  const [sign, truck] = await Promise.all(['sign', 'truck'].map((n) => load(n).catch(() => null)));
  const size = (g) => new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());

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

  // the buildings in front of the truck's road out: flat pictures on the ground, drawn after
  // everything else in the front scene and through it, so they cover the truck where they stand
  // in front of it. Loaded while the truck is about, let go once it's gone.
  let cover = null;
  const coverOn = (on) => {
    const f = shared.opts?.front;
    const art = !on ? [] : typeof f === 'function' ? f() : f || [];   // what stands there can change while the truck's about
    const key = art.map((p) => p.src).join();
    if (cover && (!on || cover.key !== key)) {
      for (const m of cover.meshes) { frontScene.remove(m); m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose(); }
      cover = null;
    }
    if (on && !cover) {
      const live = cover = { meshes: [], key };
      const tl = new THREE.TextureLoader();
      for (const p of art) {
        tl.load(new URL(`../../${p.src}`, import.meta.url).href, (tex) => {
          if (cover !== live) { tex.dispose(); return; }
          tex.colorSpace = THREE.SRGBColorSpace;
          const c = [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]].map(ground);
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(c.flatMap((q) => [q.x, 0, q.z]), 3));
          geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
          geo.setIndex([0, 3, 1, 1, 3, 2]);
          const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
          const m = new THREE.Mesh(geo, mat);
          m.renderOrder = 10; m.frustumCulled = false;
          frontScene.add(m); live.meshes.push(m);
          shared.draw?.();
        });
      }
    }
  };

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

  // Drawn only when something changes: the view (setView), the sign's countdown (once a second,
  // below), or the truck while it drives (then every frame: `live`).
  let driving = false;
  const tick = (dt, now) => {
    const o = shared.opts || {};
    const still = o.reduced?.();
    const vw = shared.view?.w || 1; const vh = shared.view?.h || 1; const v = shared.view?.v;
    if (!v) return;
    // the canvas fills the viewport at the device's pixel ratio (at most 1.5: they're soft shapes)
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const c = shared.front.canvas;
    if (c.width !== Math.round(vw * dpr) || c.height !== Math.round(vh * dpr)) view.size(vw * dpr, vh * dpr);
    // the camera shows exactly the part of the city the stage shows
    cam.left = (-v.tx / v.s) / SIGMA; cam.right = ((vw - v.tx) / v.s) / SIGMA;
    cam.top = (v.ty / v.s) / SIGMA; cam.bottom = (-(vh - v.ty) / v.s) / SIGMA;
    cam.updateProjectionMatrix();

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
      driving = !!show && at.moving;
      coverOn(tr.mode === 'in' || tr.mode === 'out');  // parked, nothing stands in front of it
      if (show) {
        const p = ground(at.p); const d = ground([at.p[0] + at.dir[0], at.p[1] + at.dir[1]]);
        const dX = d.x - p.x; const dZ = d.z - p.z;
        truckObj.position.set(p.x, truckY, p.z);
        // the model faces −X: turn it so it faces the way it drives
        truckObj.rotation.y = Math.atan2(dZ, -dX);
      }
    }
  };
  const view = addView(THREE, {
    canvas: shared.front.canvas, scene: frontScene, camera: cam, tick, fps: FPS,
    live: () => driving,
    // a full screen is over the base (js/app/nav.js): nothing of the city shows, so nothing is drawn
    paused: () => document.body.classList.contains('base-covered'),
  });
  shared.draw = () => view.draw();
  // the sign's countdown, and a truck setting off: looked at once a second
  setInterval(() => { if (shared.front.canvas.isConnected) view.draw(); }, 1000);
}
