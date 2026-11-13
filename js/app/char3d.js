// char3d.js: a rigged character and its clips, for the wardrobe (wardrobe3d.js) and the base
// (runner3d.js). The models come from tools/build-characters.mjs (docs/CHARACTERS.md):
//   models/chars/<body>.glb, <outfit>-<body>.glb   a skinned mesh on that body's skeleton, 1.8 tall,
//                                                  feet on y = 0, facing +Z
//   models/chars/<body>-clips.glb                  the skeleton and every clip, no mesh
// A clip finds its bones by name, so one clips file drives the body and every outfit made for it.
// The emissive map is a mask, not a glow: red marks the skin and green the irises, which `tintable`
// recolours with the look's skin tone and eye colour.

import { dress } from './gear3d.js';

const files = new Map();   // url -> Promise<gltf>, shared between every view

/** A glTF file, loaded once. `L` is runner3d.js's loadThree(). */
export function loadGltf(L, url) {
  if (!files.has(url)) {
    files.set(url, new Promise((res, rej) => {
      const loader = new L.GLTFLoader();
      loader.setMeshoptDecoder(L.MeshoptDecoder);
      loader.load(new URL(`../../${url}`, import.meta.url).href, res, undefined, rej);
    }).catch((e) => { files.delete(url); throw e; }));
  }
  return files.get(url);
}

/**
 * Let a file go: its geometry and textures leave the GPU, and it's read again (from the service
 * worker's cache) the next time it's wanted. Only for a file nothing on screen uses any more: the
 * stadium's boss and robot when it closes. (Figures share the cached file's geometry and textures;
 * their own dispose() frees only their cloned materials.)
 */
export function forgetGltf(url) {
  const p = files.get(url);
  if (!p) return;
  files.delete(url);
  p.then((g) => g.scene.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
      m.dispose();
    }
  })).catch(() => {});
}

/** The skin and iris tint, patched into three.js's standard material after its map is read. */
export function tintable(mat, uniforms) {
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

// A cloned skinned mesh must point at the clone's bones, not the original's.
function rebindSkins(src, dst) {
  const bones = new Map();
  dst.traverse((o) => { if (o.isBone) bones.set(o.name, o); });
  const from = []; src.traverse((o) => { if (o.isSkinnedMesh) from.push(o); });
  const to = []; dst.traverse((o) => { if (o.isSkinnedMesh) to.push(o); });
  to.forEach((m, i) => {
    const sk = from[i].skeleton;
    m.bind(new sk.constructor(sk.bones.map((b) => bones.get(b.name) || b), sk.boneInverses), m.bindMatrix);
  });
}

/**
 * Load a character and put a copy of it in the scene's hands.
 *   model   the mesh's file, clips  that body's clips file (js/core/wardrobe.js: modelFor, clipsFor)
 *   uniforms  { uSkin, uEye } to tint it with, or null to leave it as painted
 *   gear      the accessories on it: [{ id, slot, url }] (js/core/wardrobe.js gearFor), hung on its
 *             head and feet by gear3d.js; `hair` the hair colour as linear RGB
 * @returns {Promise<{ root, mixer, has(name), length(name), play(name, opts), update(dt), dispose() }>}
 *   play(name, { fade = 0.2, speed = 1 }): cross-fade to that clip (an unknown name keeps the current one)
 */
export async function spawnChar(L, { model, clips, uniforms = null, gear = [], hair = null }) {
  const { THREE } = L;
  const [gltf, anim] = await Promise.all([loadGltf(L, model), clips ? loadGltf(L, clips) : null]);
  const root = gltf.scene.clone(true);
  rebindSkins(gltf.scene, root);
  const mats = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;   // a skinned mesh's bounds don't follow its pose
    o.material = o.material.clone(); mats.push(o.material);
    o.material.side = THREE.FrontSide;
    o.material.roughness = 0.8; o.material.metalness = 0;
    o.material.emissive?.setRGB(0, 0, 0);   // the emissive map is the recolour mask, never a glow
    if (uniforms && o.material.emissiveMap) tintable(o.material, uniforms);
  });
  // measured in the bind pose, so before any clip plays
  mats.push(...await dress(THREE, root, gear, { load: (url) => loadGltf(L, url), hair }));
  const mixer = new THREE.AnimationMixer(root);
  const byName = new Map((anim?.animations || []).map((c) => [c.name, c]));
  let now = null;
  return {
    root, mixer,
    has: (name) => byName.has(name),
    /** A clip's length in seconds (0 when the body hasn't got it). */
    length: (name) => byName.get(name)?.duration || 0,
    play(name, { fade = 0.2, speed = 1 } = {}) {
      const clip = byName.get(name);
      if (!clip) return false;
      const next = mixer.clipAction(clip);
      next.timeScale = speed;
      if (now === next) return true;
      next.reset().play();
      if (now) now.crossFadeTo(next, fade, false);
      now = next;
      return true;
    },
    update: (dt) => mixer.update(dt),
    dispose() { mixer.stopAllAction(); for (const m of mats) m.dispose(); },
  };
}
