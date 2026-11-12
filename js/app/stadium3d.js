// stadium3d.js: the stadium seen from above, the boss running his one lap (stadium-view.js).
//
// One canvas, one renderer. The ground is a flat picture of the stadium seen straight down
// (icons/Stadium/track.webp when there is one, else drawn here), laid on the ground in metres
// (js/core/stadium.js TRACK), so a point on the track is a point on the picture. The camera looks
// down at it at a slant, and the boss, a lot bigger than life so he reads on a phone, runs in lane 4.
// It draws at most 30 times a second, at most 1.5× the screen's sharpness, and not at all while
// the page is hidden.

import { loadThree, webglOk } from './runner3d.js';
import { spawnChar } from './char3d.js';
import { TRACK, trackPoint } from '../core/stadium.js';

const TILT = (56 * Math.PI) / 180;       // the camera's angle down from level
const BOSS_SCALE = 13;                    // times life size
const LANE = 4;
const STANDS = 17;                        // metres of stands round the outside lane
const OUT = TRACK.radius + TRACK.lanes * TRACK.lane + STANDS;   // half the stadium's width
const W = OUT * 2; const H = TRACK.straight + OUT * 2;
const PX = 8;                             // the drawn picture's pixels per metre
/**
 * The painted stadium (icons/Stadium/track.webp, tools/gen-stadium.mjs), measured: its size in px,
 * the track's centre, its inner kerb's radius and straight, and a lane's width, in px. It isn't to
 * scale (its lanes are wide), so it is laid out as wide as the drawn one and the boss follows its
 * own lanes.
 */
const PIC = { w: 768, h: 1376, cx: 384, cy: 686, radius: 143.5, straight: 410, lane: 11.5 };
const PIC_M = W / PIC.w;                  // metres per px of it
// The scene is in the boss's units: the stadium is shrunk round him rather than him grown (a
// skinned character keeps its own scale), so a metre of track is K units.
const K = 1 / BOSS_SCALE;

/** The stadium seen straight down, drawn: stands, the 8-lane track, the infield. */
function drawGround() {
  const c = document.createElement('canvas');
  c.width = Math.round(W * PX); c.height = Math.round(H * PX);
  const g = c.getContext('2d');
  const L = TRACK.straight;
  g.setTransform(PX, 0, 0, PX, c.width / 2, c.height / 2);   // metres, centred: x right, z down
  const oval = (r) => {
    g.beginPath(); g.moveTo(r, L / 2); g.lineTo(r, -L / 2);
    g.arc(0, -L / 2, r, 0, -Math.PI, true); g.lineTo(-r, L / 2);
    g.arc(0, L / 2, r, Math.PI, 0, true); g.closePath();
  };
  const R = TRACK.radius; const Rout = R + TRACK.lanes * TRACK.lane;
  // the stands: navy rows, lighter towards the track, a gold rim
  g.fillStyle = '#0E1A38'; g.fillRect(-W / 2, -H / 2, W, H);
  for (let i = 0; i <= 12; i++) {
    const r = OUT - i * ((STANDS - 2) / 12);
    oval(r); g.fillStyle = i % 2 ? '#1B2C5C' : '#22386F'; g.fill();
  }
  oval(OUT); g.lineWidth = 1.2; g.strokeStyle = '#F2C14E'; g.stroke();
  // the apron round the track
  oval(Rout + 2); g.fillStyle = '#C9D3E6'; g.fill();
  // the track
  oval(Rout); g.fillStyle = '#C8553D'; g.fill();
  oval(R); g.fillStyle = '#3F9A4A'; g.fill();
  // the infield's mowing stripes
  g.save(); oval(R - 0.3); g.clip();
  for (let z = -H / 2, i = 0; z < H / 2; z += 6, i++) { g.fillStyle = i % 2 ? '#47A853' : '#3B9146'; g.fillRect(-W / 2, z, W, 6); }
  g.restore();
  // lane lines and the kerb
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 0.12;
  for (let i = 0; i <= TRACK.lanes; i++) { oval(R + i * TRACK.lane); g.stroke(); }
  oval(R); g.lineWidth = 0.45; g.strokeStyle = '#FFFFFF'; g.stroke();
  // the finish line, across the right-hand straight's near end, chequered
  const fz = L / 2;
  for (let i = 0; i < TRACK.lanes * 2; i++) {
    for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#FFFFFF' : '#16264D';
      g.fillRect(R + (i * TRACK.lane) / 2, fz - 0.6 + j * 0.6, TRACK.lane / 2, 0.6);
    }
  }
  // flags round the rim: gold and white
  const per = 2 * L + 2 * Math.PI * (OUT - 1);
  for (let i = 0; i < 36; i++) {
    const p = (() => { const s = (i / 36) * per; const r = OUT - 1;
      if (s < L) return [r, L / 2 - s]; let t = s - L;
      if (t < Math.PI * r) return [r * Math.cos(t / r), -L / 2 - r * Math.sin(t / r)]; t -= Math.PI * r;
      if (t < L) return [-r, -L / 2 + t]; t -= L; return [-r * Math.cos(t / r), L / 2 + r * Math.sin(t / r)]; })();
    g.beginPath(); g.arc(p[0], p[1], 0.9, 0, Math.PI * 2); g.fillStyle = i % 2 ? '#FFFFFF' : '#F2C14E'; g.fill();
  }
  return c;
}

/**
 * Mount the stadium in `host`. `boss`: js/core/stadium.js BOSSES entry. Returns { setLap(f),
 * bossHead(), centre() → { x, y } in host px, onFrame(fn), dispose() }, or null without WebGL.
 */
export async function mountStadium(host, boss) {
  if (!webglOk()) return null;
  const L = await loadThree();
  const { THREE } = L;
  const canvas = document.createElement('canvas');
  canvas.className = 'st-canvas';
  host.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x2a3550, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-30, 60, 40); scene.add(key);

  // the ground: the painted track if there is one, else the drawn one
  let painted = true;
  const tex = await new Promise((res) => {
    new THREE.TextureLoader().load(new URL('../../icons/Stadium/track.webp', import.meta.url).href, res, undefined, () => { painted = false; res(new THREE.CanvasTexture(drawGround())); });
  });
  const GW = painted ? PIC.w * PIC_M : W, GH = painted ? PIC.h * PIC_M : H;
  // the lanes the boss runs in, and where the track's centre is on the ground
  const geom = painted ? { straight: PIC.straight * PIC_M, radius: PIC.radius * PIC_M, lane: PIC.lane * PIC_M, lanes: 8 } : TRACK;
  const off = painted ? { x: (PIC.cx - PIC.w / 2) * PIC_M, z: (PIC.cy - PIC.h / 2) * PIC_M } : { x: 0, z: 0 };
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GW * K, GH * K), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // a soft shadow under the boss
  const blob = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    r.addColorStop(0, 'rgba(5,12,30,.5)'); r.addColorStop(1, 'rgba(5,12,30,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.scale.set(0.9, 0.9, 1); m.position.y = 0.01;
    scene.add(m); return m;
  })();

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const fit = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const fh = Math.max(GH * Math.sin(TILT), GW / aspect) * 1.02 * K;
    camera.left = (-fh * aspect) / 2; camera.right = (fh * aspect) / 2; camera.top = fh / 2; camera.bottom = -fh / 2;
    camera.position.set(0, Math.sin(TILT) * 60, Math.cos(TILT) * 60);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    dirty = true;
  };
  let dirty = true;
  const ro = new ResizeObserver(fit); ro.observe(host);

  let figure = null, lap = 0, gone = false, raf = 0, last = 0;
  const rig = new THREE.Group(); scene.add(rig);
  const frames = new Set();
  try {
    figure = await spawnChar(L, { model: boss.model, clips: boss.clips });
    figure.play('run', { fade: 0 });
    rig.add(figure.root);
  } catch { figure = null; }
  if (gone) return null;

  const at = () => { const p = trackPoint(lap, LANE, geom); return { ...p, x: p.x + off.x, z: p.z + off.z }; };
  const place = () => {
    const p = at();
    rig.position.set(p.x * K, 0, p.z * K); rig.rotation.y = p.dir + Math.PI;
    blob.position.set(p.x * K, 0.01, p.z * K);
  };
  const v = new THREE.Vector3();
  const project = (x, y, z) => {
    v.set(x, y, z).project(camera);
    return { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight };
  };

  const frame = (now) => {
    raf = 0;
    if (gone) return;
    if (document.hidden || !canvas.isConnected) { last = 0; return; }
    if (now - last >= 33 || dirty) {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now; dirty = false;
      figure?.update(dt);
      renderer.render(scene, camera);
      for (const fn of frames) fn();
    }
    raf = requestAnimationFrame(frame);
  };
  const run = () => { if (!raf && !gone) raf = requestAnimationFrame(frame); };
  const onVis = () => { if (!document.hidden) run(); };
  document.addEventListener('visibilitychange', onVis);

  fit(); place(); run();
  return {
    /** Put the boss `f` of the way round his lap. */
    setLap(f) { lap = f; place(); dirty = true; run(); },
    /** The boss's head, for the tag over it. */
    bossHead: () => { const p = at(); return project(p.x * K, 1.95, p.z * K); },
    centre: () => project(off.x * K, 0, off.z * K),
    onFrame: (fn) => { frames.add(fn); return () => frames.delete(fn); },
    dispose() {
      gone = true; cancelAnimationFrame(raf); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      figure?.dispose();
      ground.geometry.dispose(); ground.material.dispose(); tex.dispose();
      blob.geometry.dispose(); blob.material.map.dispose(); blob.material.dispose();
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
