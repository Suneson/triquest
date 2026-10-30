// runner3d.js — a 3D athlete running on the run room's treadmill (docs/RUNNER3D.md).
//
// The room is painted art and the treadmill is a painted item; the runner is a
// rigged glTF model (models/runner.glb) drawn into a transparent WebGL canvas
// that sits inside the treadmill's item element, so it pans, zooms, stacks and
// moves with it like any other item. three.js (vendor/three/) is only loaded
// when a runner is on screen.
//
// The camera is orthographic and matches the painted floor exactly: one scene
// unit is one floor tile, X runs along the floor's u axis (towards the right
// corner), Z along v (towards the left corner), Y up. Looking at the floor from
// the front corner, 45° round and tilted down by `ISO_TILT`, a tile's edge comes
// out at the same slant as the art's (sin tilt = the floor's rise over run).
// The runner faces +Z: down and to the left, towards the treadmill's console
// and the camera.

const MODEL = 'models/runner.glb';
const VENDOR = '../../vendor/three/';

/** The run room's floor rises 34.8 px for every 61.9 across: sin(tilt) = 0.562. */
export const ISO_TILT = Math.asin(34.8 / 61.9);

/**
 * Where the runner stands on the treadmill, in tiles from the footprint's back
 * corner (u across the belt, v along it, y up to the belt), and how big it is.
 * The treadmill is 1 × 2 tiles; its console is at the v = 2 end.
 */
export const RUNNER_SPOT = { u: 0.47, v: 1.02, y: 0.2, scale: 0.84 };

/** The canvas around the footprint, as multiples of the footprint's on-screen width. */
const FRAME = { w: 1.4, h: 1.9, below: 0.32 };

let lib = null;
const loadLib = () => (lib ||= Promise.all([
  import(`${VENDOR}three.module.min.js`),
  import(`${VENDOR}GLTFLoader.js`),
  import(`${VENDOR}meshopt_decoder.module.js`),
]).then(([THREE, { GLTFLoader }, { MeshoptDecoder }]) => ({ THREE, GLTFLoader, MeshoptDecoder })));

let model = null;
const loadModel = (L) => (model ||= new Promise((res, rej) => {
  const loader = new L.GLTFLoader();
  loader.setMeshoptDecoder(L.MeshoptDecoder);
  loader.load(new URL(`../../${MODEL}`, import.meta.url).href, res, undefined, rej);
}));

/** Can this device draw WebGL at all? (Without it the treadmill simply stands empty.) */
export function webglOk() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/**
 * Put a running athlete in `host` (an element inside the treadmill item).
 *   tile      the on-screen x and y (world px) of one tile along u: { ux, uy }
 *   anchor    where the footprint's centre is in host px: { x, y }
 *   yaw       the runner's turn in radians (0 faces the console)
 *   still     draw one frame and stop (reduced motion)
 * Returns { setYaw, layout, dispose } at once; the model appears when loaded.
 */
export function mountRunner(host, { tile, anchor, yaw = 0, still = false } = {}) {
  let disposed = false;
  let api = null;
  const canvas = document.createElement('canvas');
  canvas.className = 'r3d-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const pending = { yaw, tile, anchor };

  const ready = (async () => {
    const L = await loadLib();
    const gltf = await loadModel(L);
    if (disposed) return;
    const { THREE } = L;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();

    // warm, soft light like the painted art: a warm key from the top left, a cool rim behind
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const key = new THREE.DirectionalLight(0xfff5e6, 2.5);
    key.position.set(-2, 5, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6ea8ff, 1.8);
    rim.position.set(3, 3, -3);
    scene.add(rim);

    // the runner: its own clone of the model (the skeleton too), on the belt
    const runner = gltf.scene.clone(true);
    rebindSkins(gltf.scene, runner);
    runner.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false; // a skinned mesh's bounds don't follow its pose
        if (o.material) { o.material.side = THREE.FrontSide; }
      }
    });
    const rig = new THREE.Group();
    rig.add(runner);
    rig.position.set(RUNNER_SPOT.u, RUNNER_SPOT.y, RUNNER_SPOT.v);
    rig.scale.setScalar(RUNNER_SPOT.scale);
    scene.add(rig);

    const mixer = new THREE.AnimationMixer(runner);
    const clips = gltf.animations || [];
    const clip = clips.find((c) => /run/i.test(c.name)) || clips[0];
    if (clip) mixer.clipAction(clip).play();

    // the camera: from the floor's front corner, 45° round, tilted to the art's slant
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 50);
    const target = new THREE.Vector3(0.5, 0, 1); // the footprint's centre on the floor
    const dir = new THREE.Vector3(Math.cos(ISO_TILT) * Math.SQRT1_2, Math.sin(ISO_TILT), Math.cos(ISO_TILT) * Math.SQRT1_2);
    camera.position.copy(target).addScaledVector(dir, 20);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);

    const layout = ({ tile: tl = pending.tile, anchor: an = pending.anchor } = {}) => {
      pending.tile = tl; pending.anchor = an;
      // one tile along u is 1/√2 scene units across the screen: px per scene unit
      const s = tl.ux / Math.SQRT1_2;
      const footW = tl.ux * 3; // 1 tile along u plus 2 along v, across the screen
      const w = footW * FRAME.w; const h = footW * FRAME.h;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      canvas.style.left = `${an.x - w / 2}px`;
      canvas.style.top = `${an.y - h * (1 - FRAME.below)}px`;
      const dpr = Math.min(2, window.devicePixelRatio || 1) * 1.5; // the stage is usually zoomed in
      renderer.setPixelRatio(1);
      renderer.setSize(Math.round(w * dpr), Math.round(h * dpr), false);
      camera.left = -w / 2 / s; camera.right = w / 2 / s;
      camera.top = (h * (1 - FRAME.below)) / s; camera.bottom = -(h * FRAME.below) / s;
      camera.updateProjectionMatrix();
    };
    const setYaw = (r) => { pending.yaw = r; rig.rotation.y = r; };
    setYaw(pending.yaw);
    layout();

    const clock = new THREE.Clock();
    let raf = 0;
    let last = 0;
    let gone = 0;
    const frame = (now) => {
      if (disposed) return;
      if (!canvas.isConnected) {
        // taken off the stage (another room): let go of the GPU after a moment
        if (!gone) gone = now; else if (now - gone > 1500) { dispose(); return; }
      } else gone = 0;
      raf = requestAnimationFrame(frame);
      if (document.hidden || now - last < 1000 / 30) return; // 30 fps is plenty, and kind to batteries
      last = now;
      mixer.update(Math.min(0.1, clock.getDelta()));
      renderer.render(scene, camera);
    };
    if (still) { mixer.setTime(0.2); renderer.render(scene, camera); } else raf = requestAnimationFrame(frame);

    api = {
      setYaw: (r) => { setYaw(r); if (still) renderer.render(scene, camera); },
      layout: (o) => { layout(o); renderer.render(scene, camera); },
      stop: () => cancelAnimationFrame(raf),
      renderer, mixer,
    };
    return api;
  })().catch((e) => { console.warn('3D runner unavailable', e); return null; });

  function dispose() {
    if (disposed) return;
    disposed = true;
    api?.stop();
    api?.renderer.dispose();
    api?.renderer.forceContextLoss?.();
    canvas.remove();
  }
  return {
    ready,
    setYaw: (r) => { pending.yaw = r; api?.setYaw(r); },
    layout: (o) => { Object.assign(pending, o); api?.layout(o); },
    dispose,
  };
}

// A cloned skinned mesh must point at the clone's bones, not the original's.
function rebindSkins(src, dst) {
  const bones = new Map();
  dst.traverse((o) => { if (o.isBone) bones.set(o.name, o); });
  const srcMeshes = []; src.traverse((o) => { if (o.isSkinnedMesh) srcMeshes.push(o); });
  const dstMeshes = []; dst.traverse((o) => { if (o.isSkinnedMesh) dstMeshes.push(o); });
  dstMeshes.forEach((m, i) => {
    const sk = srcMeshes[i].skeleton;
    const newBones = sk.bones.map((b) => bones.get(b.name) || b);
    m.bind(new sk.constructor(newBones, sk.boneInverses), m.bindMatrix);
  });
}
