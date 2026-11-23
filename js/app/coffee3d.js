// coffee3d.js: the customer behind the coffee shop's counter, a rigged character seen from the waist up
// (char3d.js, the shared renderer in gl-shared.js). Who stands there and their clips: CUSTOMERS below; a
// clip a model hasn't got is skipped, so the new builder and boss models drop in with their own names.
import { loadThree, webglOk } from './runner3d.js';
import { spawnChar, letGo } from './char3d.js';
import { addView, ratio } from './gl-shared.js';

/**
 * Each customer's model and what they do. idle / talk / happy / sad / wave / walk: clip names, the first one
 * the model has wins. The builders: models/chars/mechanic-<colour>.glb (tools/build-characters.mjs); green
 * has no clips of its own and plays the blue one's.
 */
const MECH = { idle: ['idle'], talk: ['talk', 'idle'], happy: ['happy'], sad: ['sad'], wave: ['wave'], walk: ['walk', 'walk-happy'] };
const mech = (colour, clips = colour) => ({ ...MECH, model: `models/chars/mechanic-${colour}.glb`, clips: `models/chars/mechanic-${clips}-clips.glb` });
export const CUSTOMERS = {
  blue: mech('blue'),
  red: mech('red'),
  green: mech('green', 'blue'),
  gold: mech('gold'),
  blomvelt: { model: 'models/chars/boss-blomvelt.glb', clips: 'models/chars/boss-blomvelt-clips.glb',
    idle: ['Idle', 'idle'], talk: ['Talking', 'laugh'], happy: ['Happy', 'victory'], sad: ['Disappointed', 'taunt1'], wave: ['Wave', 'wave'], walk: ['walk'] },
};

/** Mount the counter's customer in `host` (a box over the counter). Returns { show(id), act(kind), leave(), dispose() } or null. */
export async function mountCustomer(host) {
  if (!webglOk()) return null;
  const L = await loadThree();
  const { THREE } = L;
  const canvas = document.createElement('canvas');
  canvas.className = 'cf-canvas';
  host.append(canvas);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x5a3a2a, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(-2, 4, 5); scene.add(key);
  // from the front, a little below the eyes: the head and chest fill the box
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  camera.position.set(0, 1.42, 3.4); camera.lookAt(0, 1.34, 0);
  const rig = new THREE.Group(); scene.add(rig);
  let figure = null; let who = null; let urls = []; let timer = 0; let walk = null; let gone = false;
  // which way they face: the way they walk, then towards the till (+Z is the camera)
  const TILL = -0.15; let face = TILL;

  const view = addView(THREE, {
    canvas, scene, camera, fps: 30, live: () => !!figure,
    tick: (dt) => {
      figure?.update(dt);
      if (figure) { const r = figure.root.rotation; r.y += (face - r.y) * Math.min(1, dt * 8); }
      if (walk) {
        // walking in from the side, or out
        walk.t = Math.min(1, walk.t + dt / walk.secs);
        const k = walk.t < 0.5 ? 2 * walk.t * walk.t : 1 - (-2 * walk.t + 2) ** 2 / 2;
        rig.position.x = walk.from + (walk.to - walk.from) * k;
        if (walk.t >= 1) { const done = walk.done; walk = null; face = TILL; done?.(); }
      }
    },
  });
  const fit = () => {
    const w = host.clientWidth || 1; const h = host.clientHeight || 1;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const r = Math.min(1.5, ratio());
    view.size(w * r, h * r);
  };
  const ro = new ResizeObserver(fit); ro.observe(host); fit();

  const clip = (kind) => (CUSTOMERS[who]?.[kind] || []).find((c) => figure?.has(c));
  /** Play a kind of clip; a one-off (happy, sad, wave) goes back to idle when it ends. */
  const act = (kind) => {
    if (!figure) return;
    const c = clip(kind); if (!c) return;
    figure.play(c, { fade: 0.3 });
    clearTimeout(timer);
    if (!['idle', 'talk', 'walk'].includes(kind)) timer = setTimeout(() => act('idle'), Math.max(1.2, figure.length(c)) * 1000);
  };
  const moveTo = (from, to, secs, done) => { rig.position.x = from; face = to > from ? Math.PI / 2 : -Math.PI / 2; walk = { from, to, t: 0, secs, done }; view.draw(); };

  return {
    /** Bring a customer in (a builder's colour or a boss's id): they walk in from the left and wave. */
    async show(id) {
      if (who === id && figure) { act('talk'); return; }
      this.clear();
      who = id;
      const c = CUSTOMERS[id] || CUSTOMERS.blomvelt;
      try {
        const f = await spawnChar(L, { model: c.model, clips: c.clips });
        if (gone || who !== id) { f.dispose(); return; }
        figure = f; urls = f.urls || [];
        rig.add(f.root);
        f.root.rotation.y = Math.PI / 2;
        // walking in, then a wave, then the order
        act(clip('walk') ? 'walk' : 'idle');
        moveTo(-2.2, 0, 1.1, () => { act('wave'); clearTimeout(timer); timer = setTimeout(() => act('talk'), 1800); });
      } catch { /* no model: the counter shows without them */ }
    },
    act,
    /** They walk out to the right. */
    leave() {
      if (!figure) return Promise.resolve();
      clearTimeout(timer); act('walk');
      return new Promise((done) => moveTo(rig.position.x, 2.4, 1.1, () => { this.clear(); done(); }));
    },
    clear() {
      clearTimeout(timer);
      if (figure) { rig.remove(figure.root); figure.dispose(); figure = null; }
      who = null; view.draw();
    },
    dispose() {
      gone = true; this.clear(); ro.disconnect(); view.dispose(); canvas.remove();
      letGo(Object.values(CUSTOMERS).flatMap((c) => [c.model, c.clips]));
    },
  };
}
