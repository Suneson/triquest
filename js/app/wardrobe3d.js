// wardrobe3d.js: the character standing in the wardrobe, in 3D (js/app/wardrobe-view.js).
//
// One canvas, one character. The models come from tools/prep-bodies.mjs: 1.8 units tall, feet on
// y = 0, facing +Z. Their emissive map is a mask, not a glow (its strength is 0): red marks the skin
// and green the irises, which the shader below recolours with the look's skin tone and eye colour.
//
// The bodies have no skeleton yet (BUILD-PLAN.md section 7), so the idle is the whole figure
// breathing and swaying a little. Once the rigged bodies and the idle clip are in, this plays the
// clip instead. Drag sideways to turn the character round.

import { loadThree, webglOk } from './runner3d.js';
import { skinTint, eyeColour } from '../core/wardrobe.js';

const models = new Map();   // url -> Promise<gltf>, shared between opens
const loadGltf = (L, url) => {
  if (!models.has(url)) {
    models.set(url, new Promise((res, rej) => {
      const loader = new L.GLTFLoader();
      loader.setMeshoptDecoder(L.MeshoptDecoder);
      loader.load(new URL(`../../${url}`, import.meta.url).href, res, undefined, rej);
    }).catch((e) => { models.delete(url); throw e; }));
  }
  return models.get(url);
};

/** The skin and iris tint, patched into three.js's standard material after its map is read. */
function tintable(mat, uniforms) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSkin = uniforms.uSkin;
    shader.uniforms.uEye = uniforms.uEye;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 uSkin;\nuniform vec3 uEye;\nvoid main() {')
      .replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef USE_EMISSIVEMAP
        vec2 mk = texture2D(emissiveMap, vEmissiveMapUv).rg;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uSkin, smoothstep(0.35, 0.9, mk.r));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uEye * 5.0, smoothstep(0.25, 0.8, mk.g));
      #endif`);
  };
  mat.customProgramCacheKey = () => 'moske-tint';
  mat.needsUpdate = true;
}

/**
 * Mount the stage in `host`. Returns { show(url, look), setLook(look), dispose() }, or null when
 * the device can't draw WebGL.
 */
export async function mountWardrobe(host) {
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

  const fit = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // the whole figure, arms out included, with a little room round it
    const tall = 2.05, wide = Math.max(width, 0.9) * 1.15;
    const vfov = THREE.MathUtils.degToRad(camera.fov);
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
      last = now;
      const s = (now - t0) / 1000;
      if (figure) {
        // breathing, a small weight shift, and a slow look round while nobody's turning it
        figure.scale.set(1 + Math.sin(s * 1.7) * 0.004, 1 + Math.sin(s * 1.7) * 0.008, 1 + Math.sin(s * 1.7) * 0.004);
        figure.rotation.z = Math.sin(s * 0.55) * 0.018;
        figure.position.x = Math.sin(s * 0.55) * 0.012;
        if (!drag) yaw += (Math.sin(s * 0.3) * 0.32 - yaw) * 0.02;
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

  /** Stand this model on the stage (the old one stays until the new one has loaded). */
  const show = async (next, look) => {
    setLook(look);
    if (next === url) return;
    url = next;
    const gltf = await loadGltf(L, next);
    if (gone || url !== next) return;
    if (figure) turn.remove(figure);
    figure = gltf.scene.clone(true);
    figure.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.roughness = 0.8; o.material.metalness = 0;
      o.material.emissive?.setRGB(0, 0, 0);   // the emissive map is the recolour mask, never a glow
      tintable(o.material, uniforms);
    });
    const box = new THREE.Box3().setFromObject(figure);
    width = box.max.x - box.min.x;
    turn.add(figure);
    fit(); run();
  };

  fit(); run();
  return {
    show, setLook,
    dispose() {
      gone = true;
      cancelAnimationFrame(raf); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      scene.traverse((o) => { if (o.isMesh && o !== shadow) o.material.dispose?.(); });
      shadow.geometry.dispose(); shadow.material.dispose(); shadowTex.dispose();
      renderer.dispose(); renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
