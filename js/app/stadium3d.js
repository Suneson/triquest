// stadium3d.js: the stadium, the boss and the clan's robot on its track (stadium-view.js).
//
// The ground is a picture of the stadium seen at a slant (icons/Stadium/stadium.webp, from
// tools/cut-stadium.py), laid flat on the ground and stretched down by 1/sin(tilt), so the camera,
// looking down at that same tilt, sees exactly the picture again. A point on its track is then a
// point on the ground, and the runners stand on it: big, so they read clearly on a phone.
//
// The track has two lanes: the boss runs in the inner one, the robot waits in the outer one. Both
// stand just behind the start line during the warm-up. The view is zoomed in, follows the boss,
// and can be dragged sideways to look round the track.
//
// Drawn by the app's one WebGL renderer (gl-shared.js): at most 30 times a second, at most 2× the
// screen's sharpness, and not at all while hidden.

import { loadThree, webglOk } from './runner3d.js';
import { spawnChar, forgetGltf } from './char3d.js';
import { addView, ratio } from './gl-shared.js';

/**
 * The picture, measured by tools/cut-stadium.py, in its px: its size, the track's centre, the inner
 * kerb's half width and half height, and the track's width across (at a bend) and down (on a
 * straight). Redo these if the picture changes.
 */
const PIC = { w: 2048, h: 828, cx: 1024.7, cy: 417.7, innerX: 505.4, innerY: 112.7, across: 142.9, down: 82.5 };
/** The finish line, across the near straight's right-hand end: px right of the track's centre. */
const FINISH_X = 314.5;
const SIN = PIC.down / PIC.across;             // the camera's tilt: the track looks this squashed
const TILT = Math.asin(SIN);
// the track on the ground, in px of the picture across (x right, z towards the camera)
const R_IN = PIC.innerY / SIN;                 // the bends' inner radius
const HALF = PIC.innerX - R_IN;                // half a straight
const LANE = PIC.across / 2;
/** How tall a runner stands, in px of the ground: about four lanes, so they read clearly. */
const RUNNER_PX = 300;
// The scene is in the runners' units (a character is 1.8 tall): K units per px of the picture.
const K = 1.8 / RUNNER_PX;
/** Where they wait, px behind the start line: the boss just behind it, the robot a runner's width further back. */
const BEHIND = { 1: 70, 2: 250 };

/**
 * Where a runner is `f` of the way round a lap from the finish line (or `back` px behind it), in
 * `lane` (1 inner, 2 outer), running anticlockwise as seen from above: right along the near
 * straight, round the right-hand bend, left along the far straight. { x, z, yaw } in px of the
 * ground from the track's centre, and the model's turn (it faces +z at 0).
 */
export function lanePoint(f, lane = 1, back = 0) {
  const R = R_IN + (lane - 0.5) * LANE;
  const per = 4 * HALF + 2 * Math.PI * R;
  const at = (s) => {
    s = ((s % per) + per) % per;
    if (s < 2 * HALF) return [-HALF + s, R];
    s -= 2 * HALF;
    if (s < Math.PI * R) { const a = s / R; return [HALF + R * Math.sin(a), R * Math.cos(a)]; }
    s -= Math.PI * R;
    if (s < 2 * HALF) return [HALF - s, -R];
    s -= 2 * HALF;
    const a = s / R; return [-HALF - R * Math.sin(a), -R * Math.cos(a)];
  };
  const s = HALF + FINISH_X + f * per - back;
  const [x, z] = at(s); const [x2, z2] = at(s + 1);
  return { x, z, yaw: Math.atan2(x2 - x, z2 - z) };
}

/**
 * Mount the stadium in `host`. `boss`: js/core/stadium.js BOSSES entry; `robot`: { model, clips,
 * warmup, waiting } (ROBOT there). Returns { setLap(f), setWarm(on), heads() → { boss, robot } in
 * host px, onFrame(fn), dispose() }, or null without WebGL.
 */
export async function mountStadium(host, boss, robot) {
  if (!webglOk()) return null;
  const L = await loadThree();
  const { THREE } = L;
  const canvas = document.createElement('canvas');
  canvas.className = 'st-canvas';
  host.prepend(canvas);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x2a3550, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3, 6, 4); scene.add(key);

  // the ground: the picture, stretched down so the tilted camera sees it as painted
  const tex = await new Promise((res, rej) => new THREE.TextureLoader().load(new URL('../../icons/Stadium/stadium.webp', import.meta.url).href, res, undefined, rej));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(PIC.w * K, (PIC.h / SIN) * K),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((PIC.w / 2 - PIC.cx) * K, 0, ((PIC.h / 2 - PIC.cy) / SIN) * K);
  ground.renderOrder = -1;
  scene.add(ground);

  // a soft shadow under each runner
  const blobTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    r.addColorStop(0, 'rgba(5,12,30,.45)'); r.addColorStop(1, 'rgba(5,12,30,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const blobGeo = new THREE.PlaneGeometry(1, 0.6);
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });

  let gone = false;
  // the runners: the boss (inner lane) and the robot (outer lane), each in a group on the ground
  const runner = async (who, lane) => {
    const rig = new THREE.Group(); scene.add(rig);
    const blob = new THREE.Mesh(blobGeo, blobMat); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.01; rig.add(blob);
    let figure = null;
    try { figure = await spawnChar(L, { model: who.model, clips: who.clips }); rig.add(figure.root); } catch { /* the stadium shows without them */ }
    return { rig, figure, lane, list: [], at: 0, timer: 0, f: 0, warm: true, p: null };
  };
  const [B, R] = await Promise.all([runner(boss, 1), robot ? runner(robot, 2) : null]);
  const all = [B, R].filter(Boolean);
  if (gone) return null;

  // a clip at a time from `list`, round and round
  const cycle = (r, list) => {
    clearTimeout(r.timer);
    r.list = (list || ['idle']).filter((c) => r.figure?.has(c));
    r.at = 0;
    const next = () => {
      if (!r.list.length || gone) return;
      const clip = r.list[r.at++ % r.list.length];
      r.figure.play(clip, { fade: 0.3 });
      if (r.list.length > 1) r.timer = setTimeout(next, Math.max(3, r.figure.length(clip) || 6) * 1000);
    };
    next();
  };

  const place = (r) => {
    // waiting behind the start line, facing us; running, facing the way round. The robot waits
    // there at 0 km for now, also while the boss runs.
    const waits = r.warm || r !== B;
    const p = waits ? lanePoint(0, r.lane, BEHIND[r.lane]) : lanePoint(r.f, r.lane);
    r.rig.position.set(p.x * K, 0, p.z * K);
    r.rig.rotation.y = waits ? 0 : p.yaw;
    r.p = p;
  };

  // the camera: orthographic, tilted to the picture's slant, zoomed in so the runners read
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  let w = 1, h = 1, scale = 1;        // css px per px of the picture
  let camX = 0, follow = true, dragged = null, followAt = 0;
  const mid = PIC.w / 2 - PIC.cx;     // the picture's middle, from the track's centre
  const aim = () => {
    const room = Math.max(0, (PIC.w * scale - w) / 2 / scale);
    camX = Math.max(mid - room, Math.min(mid + room, camX));
    const hw = (w / 2 / scale) * K, hh = (h / 2 / scale) * K;
    camera.left = -hw; camera.right = hw; camera.top = hh; camera.bottom = -hh;
    // looking at the picture's middle row, camX across
    const tz = ((PIC.h / 2 - PIC.cy) / SIN) * K;
    camera.position.set(camX * K, Math.sin(TILT) * 100, tz + Math.cos(TILT) * 100);
    camera.lookAt(camX * K, 0, tz);
    camera.updateProjectionMatrix();
  };
  let view = null;
  const fit = () => {
    w = host.clientWidth || 1; h = host.clientHeight || 1;
    // the track fills the room between the top band and the buttons at the foot: the picture 62% of
    // the screen high (its stands go under the bands), never narrower than the screen; drag left and
    // right for the rest. Sharpness at most 1.5×: a whole screen of 3D is a big draw.
    scale = Math.max(w / PIC.w, (h * 0.62) / PIC.h);
    const r = Math.min(1.5, ratio());
    view.size(w * r, h * r);
    aim();
  };

  const frames = new Set();
  const followX = () => (B.p?.x ?? 0);
  view = addView(THREE, {
    canvas, scene, camera, fps: 30,
    live: () => true,
    tick: (dt, now) => {
      for (const r of all) r.figure?.update(dt);
      if (!dragged && !follow && now > followAt) follow = true;
      if (follow) { camX += (followX() - camX) * Math.min(1, dt * 2.5); aim(); }
    },
    after: () => { for (const fn of frames) fn(); },
  });
  const ro = new ResizeObserver(fit); ro.observe(host);

  // drag sideways to look round the track; it goes back to following the boss a little later
  canvas.addEventListener('pointerdown', (e) => { dragged = { x: e.clientX, camX }; follow = false; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!dragged) return; camX = dragged.camX - (e.clientX - dragged.x) / scale; aim(); view.draw(); });
  const up = () => { if (!dragged) return; dragged = null; followAt = performance.now() + 5000; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

  const v = new THREE.Vector3();
  const project = (x, y, z) => {
    v.set(x, y, z).project(camera);
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
  };
  const head = (r) => (r?.p ? project(r.p.x * K, 2.0, r.p.z * K) : null);

  for (const r of all) { place(r); cycle(r, r === B ? boss.warmup : robot.warmup); }
  camX = followX();
  fit();
  return {
    /** The boss `f` of the way round his lap. */
    setLap(f) { if (B.f === f) return; B.f = f; place(B); },
    /** Warming up on the start line (true) or racing (false). */
    setWarm(on) {
      if (on === B.warm) return;
      for (const r of all) { r.warm = on; place(r); }
      if (on) { cycle(B, boss.warmup); if (R) cycle(R, robot.warmup); } else { cycle(B, ['run']); if (R) cycle(R, robot.waiting); }
      follow = true; view.draw();
    },
    /** The runners' heads, for the tags over them. */
    heads: () => ({ boss: head(B), robot: head(R) }),
    onFrame: (fn) => { frames.add(fn); return () => frames.delete(fn); },
    dispose() {
      gone = true; view.dispose(); ro.disconnect();
      for (const r of all) { clearTimeout(r.timer); r.figure?.dispose(); }
      ground.geometry.dispose(); ground.material.dispose(); tex.dispose();
      blobGeo.dispose(); blobMat.dispose(); blobTex.dispose();
      // the boss and the robot are only ever seen here: off the GPU until the stadium opens again
      for (const url of [boss.model, boss.clips, robot?.model, robot?.clips]) if (url) forgetGltf(url);
      canvas.remove();
    },
  };
}
