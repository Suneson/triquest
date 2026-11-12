// wardrobe3d.js: the character standing in the wardrobe, in 3D (js/app/wardrobe-view.js).
//
// One canvas, one character (char3d.js): 1.8 units tall, feet on y = 0, facing +Z, tinted with the
// look's skin tone and eye colour. It plays its idle clip, and now and then shows off (a taunt or
// the victory clip) before going back to it. Drag sideways to turn the character round.

import { loadThree, webglOk } from './runner3d.js';
import { skinTint, eyeColour, hairColour } from '../core/wardrobe.js';
import { spawnChar } from './char3d.js';
import { retune, fitFor } from './gear3d.js';

/** What the character does between idles, and how long it waits (seconds) before the next. */
const FLOURISH = ['taunt1', 'victory', 'taunt2'];
const WAIT = [9, 16];

/**
 * Mount the stage in `host`. Returns { show(model, clips, look, gear), setLook(look), dispose() }, or null when
 * the device can't draw WebGL. `editor` (the fit editor, fit-editor.js): no flourishes or slow look
 * round, and also { setView({ yaw, focus }), setMoving(on), retune(id, fit) }.
 */
export async function mountWardrobe(host, { editor = false } = {}) {
  if (!webglOk()) return null;
  const L = await loadThree();
  const { THREE } = L;
  const canvas = document.createElement('canvas');
  canvas.className = 'wr-canvas';
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x2a3550, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(-1.6, 3, 2.4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9cc4ff, 1.1); rim.position.set(2, 2.2, -2); scene.add(rim);
  // a soft round shadow to stand on
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    r.addColorStop(0, 'rgba(5,12,30,.55)'); r.addColorStop(1, 'rgba(5,12,30,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; scene.add(shadow);

  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
  const uniforms = { uSkin: { value: new THREE.Vector3(1, 1, 1) }, uEye: { value: new THREE.Vector3(0.3, 0.2, 0.1) } };
  const turn = new THREE.Group(); scene.add(turn);
  let figure = null, url = null, width = 1.2, yaw = 0, drag = null, raf = 0, last = 0, t0 = performance.now(), gone = false;
  let flourishAt = 0, backAt = 0, nth = 0;
  let focus = 'body', moving = !editor;
  const wait = () => WAIT[0] + Math.random() * (WAIT[1] - WAIT[0]);

  const fit = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    if (focus !== 'body' && figure) {
      // close up on the head or the feet (the fit editor)
      const at = new THREE.Vector3();
      if (focus === 'head') {
        let head = null; figure.root.traverse((o) => { if (!head && o.isBone && /Head$/.test(o.name)) head = o; });
        if (head) { head.getWorldPosition(at); at.y += 0.1; } else at.set(0, 1.62, 0);
      } else at.set(0, 0.07, 0.03);
      const half = focus === 'head' ? 0.27 : 0.26;
      const dist = Math.max(half / Math.tan(vfov / 2), half / (Math.tan(vfov / 2) * camera.aspect));
      camera.position.set(at.x, at.y + (focus === 'feet' ? 0.12 : 0), at.z + dist);
      camera.lookAt(at);
      camera.updateProjectionMatrix();
      return;
    }
    // the whole figure, arms out included, with a little room round it
    const tall = 2.05, wide = Math.max(width, 0.9) * 1.15;
    const dist = Math.max(tall / 2 / Math.tan(vfov / 2), wide / 2 / (Math.tan(vfov / 2) * camera.aspect));
    camera.position.set(0, 1.0, dist);
    camera.lookAt(0, 0.92, 0);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(fit); ro.observe(host);

  const frame = (now) => {
    raf = 0;
    if (gone) return;
    if (document.hidden) { last = 0; return; }
    if (now - last >= 30) {
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      const s = (now - t0) / 1000;
      if (figure && moving) {
        figure.update(Math.min(0.1, dt));
        // now and then a flourish, then back to the idle
        if (flourishAt && s > flourishAt && !editor) {
          const name = FLOURISH[nth++ % FLOURISH.length];
          const len = figure.length(name);
          if (len && figure.play(name, { fade: 0.25 })) backAt = s + len - 0.3;
          flourishAt = 0;
        }
        if (backAt && s > backAt) { figure.play('idle', { fade: 0.3 }); backAt = 0; flourishAt = s + wait(); }
        // a slow look round while nobody's turning it
        if (!drag && !editor) yaw += (Math.sin(s * 0.3) * 0.32 - yaw) * 0.02;
      }
      turn.rotation.y = yaw;
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);
  };
  const run = () => { if (!raf && !gone) raf = requestAnimationFrame(frame); };
  const onVis = () => { if (!document.hidden) run(); };
  document.addEventListener('visibilitychange', onVis);

  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, yaw }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (drag) yaw = drag.yaw + (e.clientX - drag.x) * 0.012; });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  const setLook = (look) => {
    uniforms.uSkin.value.set(...skinTint(look.skin));
    uniforms.uEye.value.set(...eyeColour(look.eyes));
  };

  /**
   * Stand this character on the stage, wearing `gear` ([{ id, slot, url }], js/core/wardrobe.js
   * gearFor). The old one stays until the new one has loaded.
   */
  const show = async (model, clips, look, gear = []) => {
    setLook(look);
    const key = `${model}|${look.hairColour}|${gear.map((g) => g.id).join(',')}`;
    if (key === url) return;
    url = key;
    const next = await spawnChar(L, { model, clips, uniforms, gear, hair: hairColour(look.hairColour) });
    if (gone || url !== key) { next.dispose(); return; }
    if (figure) { turn.remove(figure.root); figure.dispose(); }
    figure = next;
    figure.play('idle', { fade: 0 });
    figure.update(0);
    const box = new THREE.Box3().setFromObject(figure.root);
    width = Math.max(0.9, box.max.x - box.min.x);
    turn.add(figure.root);
    flourishAt = (performance.now() - t0) / 1000 + 4; backAt = 0;
    fit(); run();
  };

  // the fit editor's controls
  const setView = ({ yaw: y = yaw, focus: f = focus } = {}) => { yaw = y; focus = f; fit(); run(); };
  const setMoving = (on) => {
    moving = on;
    if (!on && figure) { figure.play('idle', { fade: 0 }); figure.update(0); }
    run();
  };

  fit(); run();
  return {
    show, setLook, setView, setMoving,
    retune: (id, f) => { retune(figure?.root, id, f); run(); },
    /** Put every piece back at its fit in use (after the fit editor). */
    refit: () => { for (const p of figure?.root.userData.gear || []) p.apply(p.body ? fitFor(p.body, p.id) : null); run(); },
    dispose() {
      gone = true;
      cancelAnimationFrame(raf); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      figure?.dispose();
      shadow.geometry.dispose(); shadow.material.dispose(); shadowTex.dispose();
      renderer.dispose(); renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
