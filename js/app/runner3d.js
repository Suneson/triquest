// runner3d.js — your 3D athlete on a painted item in the base: the run room's treadmill, the ice
// bath (docs/RUNNER3D.md, docs/CHARACTERS.md).
//
// The room is painted art and so is the item; the athlete is your wardrobe character (char3d.js),
// drawn into a transparent canvas that sits inside the item's element, so it pans, zooms, stacks
// and moves with it like any other item. The app's one WebGL renderer draws it (gl-shared.js):
// only while it is on screen and the base isn't covered. three.js (vendor/three/) is only loaded
// when an athlete is on screen.
//
// The camera is orthographic and matches the painted floor exactly: one scene
// unit is one floor tile, X runs along the floor's u axis (towards the right
// corner), Z along v (towards the left corner), Y up. Looking at the floor from
// the front corner, 45° round and tilted down by `ISO_TILT`, a tile's edge comes
// out at the same slant as the art's (sin tilt = the floor's rise over run).
// The runner faces +Z: down and to the left, towards the treadmill's console
// and the camera.

const VENDOR = '../../vendor/three/';

/** The run room's floor rises 34.8 px for every 61.9 across: sin(tilt) = 0.562. */
export const ISO_TILT = Math.asin(34.8 / 61.9);

/**
 * Where the runner stands on the treadmill, in tiles from the footprint's back
 * corner (u across the belt, v along it, y up to the belt), and how big it is.
 * The treadmill is 1 × 2 tiles; its console is at the v = 2 end.
 */
export const RUNNER_SPOT = { u: 0.47, v: 1.02, y: 0.2, scale: 0.84 };

/** How tall the old runner model stood: `scale` in a spot is in those units, the characters are 1.8. */
const CHAR_HEIGHT = 1.8 / 1.85;

/** The canvas around the footprint, as multiples of the footprint's on-screen width. */
const FRAME = { w: 1.4, h: 1.9, below: 0.32 };

let lib = null;
const loadLib = () => (lib ||= Promise.all([
  import(`${VENDOR}three.module.min.js`),
  import(`${VENDOR}GLTFLoader.js`),
  import(`${VENDOR}meshopt_decoder.module.js`),
]).then(([THREE, { GLTFLoader }, { MeshoptDecoder }]) => ({ THREE, GLTFLoader, MeshoptDecoder })));

/** three.js, its glTF loader and the meshopt decoder, loaded once (city3d.js shares them). */
export const loadThree = () => loadLib();

/** Can this device draw WebGL at all? (Without it the treadmill simply stands empty.) */
// Asked once and remembered: each test makes a WebGL context, and iPhone Safari keeps only a
// few, so asking on every render piled them up until the page ran out of memory.
let glOk = null;
export function webglOk() {
  if (glOk !== null) return glOk;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    glOk = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { glOk = false; }
  return glOk;
}

/**
 * Put your athlete in `host` (an element inside the item).
 *   char      what to draw: { model, clips, skin, eye, gear, hair } (files from js/core/wardrobe.js, the tints
 *             as linear RGB multipliers)
 *   clip      the clip to start on ('idle' when not given); `play(name, opts)` changes it later
 *   tile      the on-screen x and y (world px) of one tile along u: { ux, uy }
 *   anchor    where the footprint's centre is in host px: { x, y }
 *   yaw       the runner's turn in radians (0 faces the console)
 *   still     draw one frame and stop (reduced motion)
 *   spot      where on the footprint it stands and which way it faces: { u, v, yaw } in tiles from
 *             the footprint's back corner and radians (RUNNER_SPOT, facing +v, when not given)
 *   foot      the footprint in tiles, { w, h } (1 x 2 when not given)
 * Returns { setYaw, layout, play, dispose } at once; the model appears when loaded.
 */
export function mountRunner(host, { tile, anchor, yaw = 0, still = false, spot = null, foot = { w: 1, h: 2 }, char, clip = 'idle' } = {}) {
  const at = { ...RUNNER_SPOT, yaw: 0, ...(spot || {}) };
  let disposed = false;
  let api = null;
  const canvas = document.createElement('canvas');
  canvas.className = 'r3d-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const pending = { yaw, tile, anchor, clip, clipOpts: { fade: 0 } };

  const ready = (async () => {
    const L = await loadLib();
    const { THREE } = L;
    const uniforms = { uSkin: { value: new THREE.Vector3(...(char.skin || [1, 1, 1])) }, uEye: { value: new THREE.Vector3(...(char.eye || [0.3, 0.2, 0.1])) } };
    const { spawnChar } = await import('./char3d.js');
    const figure = await spawnChar(L, { model: char.model, clips: char.clips, uniforms, gear: char.gear || [], hair: char.hair || null });
    if (disposed) { figure.dispose(); return null; }
    const { addView, ratio } = await import('./gl-shared.js');
    const scene = new THREE.Scene();

    // warm, soft light like the painted art: a warm key from the top left, a cool rim behind
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const key = new THREE.DirectionalLight(0xfff5e6, 2.5);
    key.position.set(-2, 5, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6ea8ff, 1.8);
    rim.position.set(3, 3, -3);
    scene.add(rim);

    // the athlete: its own copy of the model (the skeleton too), on the item
    const rig = new THREE.Group();
    rig.add(figure.root);
    rig.position.set(at.u, at.y, at.v);
    rig.scale.setScalar(at.scale / CHAR_HEIGHT);
    scene.add(rig);
    figure.play(pending.clip, pending.clipOpts);

    // the camera: from the floor's front corner, 45° round, tilted to the art's slant
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 50);
    const target = new THREE.Vector3(foot.w / 2, 0, foot.h / 2); // the footprint's centre on the floor
    const dir = new THREE.Vector3(Math.cos(ISO_TILT) * Math.SQRT1_2, Math.sin(ISO_TILT), Math.cos(ISO_TILT) * Math.SQRT1_2);
    camera.position.copy(target).addScaledVector(dir, 20);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);

    const layout = ({ tile: tl = pending.tile, anchor: an = pending.anchor } = {}) => {
      pending.tile = tl; pending.anchor = an;
      // one tile along u is 1/√2 scene units across the screen: px per scene unit
      const s = tl.ux / Math.SQRT1_2;
      const footW = tl.ux * (foot.w + foot.h); // the footprint's tiles along u plus along v, across the screen
      const w = footW * FRAME.w; const h = footW * FRAME.h;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      canvas.style.left = `${an.x - w / 2}px`;
      canvas.style.top = `${an.y - h * (1 - FRAME.below)}px`;
      const dpr = ratio(1.5);   // the stage is usually zoomed in (at most 2: gl-shared.js)
      view?.size(w * dpr, h * dpr);
      camera.left = -w / 2 / s; camera.right = w / 2 / s;
      camera.top = (h * (1 - FRAME.below)) / s; camera.bottom = -(h * FRAME.below) / s;
      camera.updateProjectionMatrix();
    };
    const setYaw = (r) => { pending.yaw = r; rig.rotation.y = at.yaw + r; };
    setYaw(pending.yaw);
    // off screen (another tab keeps the stage's DOM aside), in the background or under a full
    // screen: not drawn, everything kept, so coming back to HOME carries on mid-stride with no
    // reload. The diorama disposes the runner when its treadmill leaves the room.
    let view = null;
    view = addView(THREE, {
      canvas, scene, camera,
      tick: (dt) => figure.update(dt),
      live: () => !still,
      paused: () => document.body.classList.contains('base-covered'),
    });
    layout();
    if (still) figure.update(0.2);

    api = {
      setYaw: (r) => { setYaw(r); view.draw(); },
      layout: (o) => { layout(o); view.draw(); },
      play: (name, o) => { figure.play(name, o); if (still) figure.update(0.2); view.draw(); },
      stop: () => { view.dispose(); figure.dispose(); },
    };
    return api;
  })().catch((e) => { console.warn('3D runner unavailable', e); return null; });

  function dispose() {
    if (disposed) return;
    disposed = true;
    api?.stop();
    canvas.remove();
  }
  return {
    ready,
    setYaw: (r) => { pending.yaw = r; api?.setYaw(r); },
    layout: (o) => { Object.assign(pending, o); api?.layout(o); },
    /** Cross-fade to another clip: play('run', { fade: 0.3, speed: 1.1 }). */
    play: (name, o = {}) => { if (pending.clip === name && pending.speed === o.speed) return; pending.clip = name; pending.speed = o.speed; pending.clipOpts = o; api?.play(name, o); },
    dispose,
  };
}
