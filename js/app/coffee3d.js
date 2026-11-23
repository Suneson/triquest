// coffee3d.js: the customer behind the coffee shop's counter, a rigged character seen from the waist up
// (char3d.js, the shared renderer in gl-shared.js). Who stands there and their clips: CUSTOMERS below; a
// clip a model hasn't got is skipped, so the new builder and boss models drop in with their own names.
import { loadThree, webglOk } from './runner3d.js';
import { spawnChar, letGo } from './char3d.js';
import { addView, ratio } from './gl-shared.js';

/**
 * Each customer's model and what they do. idle / talk / happy / sad / wave: clip names, the first one the
 * model has wins. (The builders' new models: models/chars/mechanic-<colour>.glb, see COFFEE-SHOP.md.)
 */
const MECH = { clips: 'models/chars/mechanic-clips.glb', idle: ['Idle', 'idle'], talk: ['Talking', 'idle'],
  happy: ['Happy', 'work'], sad: ['Disappointed', 'idle'], wave: ['Wave', 'walk'] };
export const CUSTOMERS = {
  blue: { ...MECH, model: 'models/chars/mechanic.glb' },
  red: { ...MECH, model: 'models/chars/mechanic-red.glb' },
  green: { ...MECH, model: 'models/chars/mechanic-green.glb' },
  gold: { ...MECH, model: 'models/chars/mechanic-orange.glb' },
  blomvelt: { model: 'models/chars/boss-blomvelt.glb', clips: 'models/chars/boss-blomvelt-clips.glb',
    idle: ['Idle', 'idle'], talk: ['Talking', 'laugh'], happy: ['Happy', 'victory'], sad: ['Disappointed', 'taunt1'], wave: ['Wave', 'wave'] },
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

  const view = addView(THREE, {
    canvas, scene, camera, fps: 30, live: () => !!figure,
    tick: (dt) => {
      figure?.update(dt);
      if (walk) {
        // walking in from the side, or out
        walk.t = Math.min(1, walk.t + dt / walk.secs);
        const k = walk.t < 0.5 ? 2 * walk.t * walk.t : 1 - (-2 * walk.t + 2) ** 2 / 2;
        rig.position.x = walk.from + (walk.to - walk.from) * k;
        if (walk.t >= 1) { const done = walk.done; walk = null; done?.(); }
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
    if (kind !== 'idle' && kind !== 'talk') timer = setTimeout(() => act('idle'), Math.max(1.2, figure.length(c)) * 1000);
  };
  const moveTo = (from, to, secs, done) => { rig.position.x = from; walk = { from, to, t: 0, secs, done }; view.draw(); };

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
        // facing a touch towards the till
        f.root.rotation.y = -0.15;
        const w = clip('wave') ? 'wave' : 'idle';
        act(clip('walk') ? 'idle' : w);
        moveTo(-2.2, 0, 0.9, () => { act(w); setTimeout(() => act('talk'), 1300); });
      } catch { /* no model: the counter shows without them */ }
    },
    act,
    /** They walk out to the right. */
    leave() {
      if (!figure) return Promise.resolve();
      return new Promise((done) => moveTo(rig.position.x, 2.4, 0.9, () => { this.clear(); done(); }));
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
