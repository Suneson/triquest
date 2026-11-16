// gear3d.js: hair, hats, helmets, glasses and shoes on a character (char3d.js spawnChar).
//
// Each accessory is a plain mesh (models/gear/<id>.glb, from tools/build-accessories.mjs): facing
// +Z, standing on y = 0, centred on x and z. It is sized and placed here from the character it goes
// on, so one file fits the male, the female and every outfit:
//  1. with the character in its bind pose, the skin that moves with the head (or a foot) is
//     measured: its box in the character's own space;
//  2. the accessory is scaled and placed against that box, by its slot's rule (FIT) and any
//     change for that item (ITEM_FIT);
//  3. the hand-set fit for that item on that body is added (js/core/gear-fit.js, or this device's
//     own from the fit editor, js/app/fit-editor.js);
//  4. it is hung on the head bone (or the foot bones, a mirrored copy on the right), so it moves
//     with every clip without being skinned.

import { GEAR_FIT, cleanFit } from '../core/gear-fit.js';

/** Fits made in the fit editor on this device: { male: { id: fit }, female: {...} }. */
const LOCAL_FITS = 'moske-gear-fit';
export function localFits() {
  try { const f = JSON.parse(localStorage.getItem(LOCAL_FITS) || 'null'); return f && typeof f === 'object' ? f : {}; } catch { return {}; }
}
export function saveLocalFits(f) { try { localStorage.setItem(LOCAL_FITS, JSON.stringify(f)); } catch { /* private mode */ } }
/** The fit in use for an item on a body: this device's, else the one in the code. */
export function fitFor(body, id) {
  const here = localFits()[body];
  // a fit set here wins, even one set back to nothing
  if (here && typeof here === 'object' && Object.hasOwn(here, id)) return cleanFit(here[id]);
  return GEAR_FIT[body]?.[id] || null;
}

/** How each slot sits on the box: width as a share of the head's (or length of the foot's), and where. */
const FIT = {
  // top: how far above the head's top, in head heights; front: where its front edge is, in head depths
  hair: { across: 1.2, top: 0.1, front: -0.02 },
  hat: { across: 1.2, top: 0.16, back: 0.1 },
  helmet: { across: 1.34, top: 0.24, back: 0.12 },
  // eye: the lenses' middle, as a share of the head's height from its lowest point
  glasses: { across: 1.06, eye: 0.56, front: 0.02 },
  shoes: { along: 1.08, wide: 0.96 },
};

/** Changes for one item, over its slot's rule. */
export const ITEM_FIT = {
  'hat-visor': { across: 1.1, top: -0.08 },
  'hat-beanie': { across: 1.12, top: 0.4 },
  'hat-bucket': { top: 0.34 },
  'hair-bun-low': { top: 0.22, across: 1.28, front: -0.12 },
  'helmet-aero': { back: undefined, front: 0.1 },
  'hat-gold': { top: 0.3 },
  'glasses-gold': { eye: 0.4 },
  'hat-cap-navy': { across: 1.22, top: 0.3 },
};

/**
 * How much of the hair a hat or helmet hides: the hair above this height (a share of the head's
 * height, from its lowest point) is cut away, so what hangs below it (a ponytail, long hair, the
 * nape) still shows under the brim. null: it hides no hair (the visor). Any other hat: HAIR_CUT.hat.
 */
export const HAIR_CUT = {
  hat: 0.5, helmet: 0.48,
  'hat-visor': null,
  'hat-beanie': 0.42,
};
export const hairCutFor = (g) => (Object.hasOwn(HAIR_CUT, g.id) ? HAIR_CUT[g.id] : HAIR_CUT[g.slot]);

/**
 * The scalp: where the hair grows on the head, in the head's box (u: height share from the lowest
 * point, f: depth share from the back, x: share of the half-width out from the middle). The
 * hairline is low at the nape, rises over the ears at the sides and to the forehead at the front;
 * the ears themselves stay bare.
 */
export const SCALP = { nape: 0.36, side: 0.64, front: 0.8, ears: 0.8, earTop: 0.74 };
export function onScalp(u, f, x = 0, k = SCALP) {
  const ramp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
  const line = f < 0.45 ? ramp(k.nape, k.side, (f - 0.18) / 0.27) : ramp(k.side, k.front, (f - 0.45) / 0.3);
  if (x > k.ears && u < k.earTop) return false;
  return u > line;
}

const BONES = {
  head: /(^|:|rig)Head$/,
  footL: /(^|:|rig)Left(Foot|ToeBase|Toe_End)$/,
  footR: /(^|:|rig)Right(Foot|ToeBase|Toe_End)$/,
};
const ANCHOR = { head: /(^|:|rig)Head$/, footL: /(^|:|rig)LeftFoot$/, footR: /(^|:|rig)RightFoot$/ };

/**
 * The head's and the feet's boxes on this character, in its root's space, and the bones they hang
 * on. Measured once per character, in its bind pose: call it before any clip has played.
 */
export function measureBody(THREE, root) {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const out = {};
  for (const k of Object.keys(BONES)) out[k] = { box: new THREE.Box3(), bone: null };
  const v = new THREE.Vector3();
  root.traverse((m) => {
    if (!m.isSkinnedMesh) return;
    const bones = m.skeleton.bones;
    const group = Object.fromEntries(Object.keys(BONES).map((k) => [k, new Set(bones.map((b, i) => (BONES[k].test(b.name) ? i : -1)).filter((i) => i >= 0))]));
    for (const k of Object.keys(ANCHOR)) out[k].bone ||= bones.find((b) => ANCHOR[k].test(b.name)) || null;
    const pos = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
    if (!si || !sw) return;
    for (let i = 0; i < pos.count; i++) {
      for (const k of Object.keys(BONES)) {
        let w = 0;
        for (let j = 0; j < 4; j++) if (group[k].has(si.getComponent(i, j))) w += sw.getComponent(i, j);
        if (w < 0.5) continue;
        v.fromBufferAttribute(pos, i);
        m.applyBoneTransform(i, v);
        v.applyMatrix4(m.matrixWorld).applyMatrix4(toRoot);
        out[k].box.expandByPoint(v);
      }
    }
  });
  return out;
}

/**
 * A short buzz cut over the scalp, made from this character's own head (so it fits every outfit):
 * the skin's triangles on the scalp (onScalp), copied a little out from the skin and painted in the
 * hair colour. It moves with the same bones. Returns the meshes added.
 */
export function addScalp(THREE, root, box, colour) {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const size = box.getSize(new THREE.Vector3());
  const made = [];
  const skins = [];
  root.traverse((m) => { if (m.isSkinnedMesh && !m.userData.scalp) skins.push(m); });
  for (const m of skins) {
    const g = m.geometry, pos = g.attributes.position, nrm = g.attributes.normal;
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    if (!si || !sw || !nrm) continue;
    const head = new Set(m.skeleton.bones.map((b, i) => (BONES.head.test(b.name) ? i : -1)).filter((i) => i >= 0));
    const v = new THREE.Vector3();
    const on = new Uint8Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      let w = 0;
      for (let j = 0; j < 4; j++) if (head.has(si.getComponent(i, j))) w += sw.getComponent(i, j);
      if (w < 0.5) continue;
      v.fromBufferAttribute(pos, i);
      m.applyBoneTransform(i, v);
      v.applyMatrix4(m.matrixWorld).applyMatrix4(toRoot);
      on[i] = onScalp((v.y - box.min.y) / size.y, (v.z - box.min.z) / size.z, Math.abs(v.x - (box.min.x + box.max.x) / 2) / (size.x / 2)) ? 1 : 0;
    }
    const idx = g.index ? g.index.array : Array.from({ length: pos.count }, (_, i) => i);
    const keep = [];
    for (let t = 0; t < idx.length; t += 3) if (on[idx[t]] && on[idx[t + 1]] && on[idx[t + 2]]) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    if (!keep.length) continue;
    // the copy: only the vertices used, pushed out along their normals by a share of the scalp's size
    const remap = new Map();
    const used = [];
    for (const i of keep) if (!remap.has(i)) { remap.set(i, used.length); used.push(i); }
    const lo = new THREE.Box3();
    for (const i of used) lo.expandByPoint(v.fromBufferAttribute(pos, i));
    const lift = lo.getSize(new THREE.Vector3()).length() * 0.012;
    const P = new Float32Array(used.length * 3), N = new Float32Array(used.length * 3);
    const SI = new (si.array.constructor)(used.length * 4), SW = new Float32Array(used.length * 4);
    used.forEach((i, k) => {
      for (let c = 0; c < 3; c++) { N[k * 3 + c] = nrm.getComponent(i, c); P[k * 3 + c] = pos.getComponent(i, c) + N[k * 3 + c] * lift; }
      for (let c = 0; c < 4; c++) { SI[k * 4 + c] = si.getComponent(i, c); SW[k * 4 + c] = sw.getComponent(i, c); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
    geo.setIndex(keep.map((i) => remap.get(i)));
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
    mat.color.setRGB(...colour).multiplyScalar(0.85);
    const s = new THREE.SkinnedMesh(geo, mat);
    s.userData.scalp = true;
    s.frustumCulled = false; s.castShadow = false;
    s.position.copy(m.position); s.quaternion.copy(m.quaternion); s.scale.copy(m.scale);
    m.parent.add(s);
    s.bind(m.skeleton, m.bindMatrix);
    made.push(s);
  }
  return made;
}

/** Cut away a hair piece's triangles above `y` (root space; `toRoot`: the piece's mesh to root). */
function cutAbove(THREE, mesh, toRoot, y) {
  const g = mesh.geometry.clone();
  const pos = g.attributes.position;
  const idx = g.index ? g.index.array : Array.from({ length: pos.count }, (_, i) => i);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const keep = [];
  for (let t = 0; t < idx.length; t += 3) {
    a.fromBufferAttribute(pos, idx[t]).applyMatrix4(toRoot);
    b.fromBufferAttribute(pos, idx[t + 1]).applyMatrix4(toRoot);
    c.fromBufferAttribute(pos, idx[t + 2]).applyMatrix4(toRoot);
    if ((a.y + b.y + c.y) / 3 < y) keep.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  g.setIndex(keep);
  mesh.geometry = g;
  return keep.length > 0;
}

/** Where an accessory goes, in the character's root space: { s, x, y, z } for a model of `size`. */
export function place(slot, size, box, fit = {}) {
  const f = { ...FIT[slot], ...fit };
  const b = { min: box.min, max: box.max };
  const w = b.max.x - b.min.x, h = b.max.y - b.min.y, d = b.max.z - b.min.z;
  const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
  if (slot === 'shoes') {
    const s = Math.max((d * f.along) / size.z, (w * f.wide) / size.x);
    return { s, x: cx, y: b.min.y - 0.012, z: cz - d * 0.05 };
  }
  const s = (w * f.across) / size.x;
  if (slot === 'glasses') {
    const y = b.min.y + h * f.eye - (size.y * s) / 2;
    return { s, x: cx, y, z: b.max.z + d * f.front - (size.z * s) / 2 };
  }
  const y = b.max.y + h * f.top - size.y * s;
  const z = f.back !== undefined ? b.min.z - d * f.back + (size.z * s) / 2 : b.max.z + d * f.front - (size.z * s) / 2;
  return { s, x: cx, y, z };
}

const D2R = Math.PI / 180;

/** The piece's matrix in root space: the automatic place `p`, then the hand-set fit `f`. */
function compose(THREE, p, size, side, unit, f) {
  const k = f || {};
  const s = p.s * (k.s ?? 1);
  // a size change keeps the piece's middle where it was
  const pos = new THREE.Vector3(p.x + (k.x || 0) * unit * side, p.y + (k.y || 0) * unit + (size.y * (p.s - s)) / 2, p.z + (k.z || 0) * unit);
  const mid = new THREE.Vector3(0, (size.y * s) / 2, 0);
  // turns are about the piece's middle; the right shoe's are mirrored
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((k.rx || 0) * D2R, (k.ry || 0) * D2R * side, (k.rz || 0) * D2R * side, 'YXZ'));
  const m = new THREE.Matrix4().compose(pos.clone().add(mid), q, new THREE.Vector3(s * side, s, s));
  return m.multiply(new THREE.Matrix4().makeTranslation(0, -size.y / 2, 0));
}

/**
 * Put the accessories on. `gear`: [{ id, slot, url, body }] (js/core/wardrobe.js gearFor). `hair`: the hair
 * colour as linear RGB. `load(url)` → a glTF (char3d.js loadGltf). Returns the materials made, to
 * dispose with the character (and the geometries made for it). Each piece is listed on `root.userData.gear`, for retune().
 */
export async function dress(THREE, root, gear, { load, hair = null } = {}) {
  const mats = [];
  root.userData.gear = [];
  // a player's character (it has a hair colour) is never bald: the scalp is always under the rest
  const body = hair || gear?.length ? measureBody(THREE, root) : null;
  if (hair && !body.head.box.isEmpty()) for (const s of addScalp(THREE, root, body.head.box, hair)) mats.push(s.material, s.geometry);
  if (!gear?.length) return mats;
  // the lowest cut of any hat or helmet worn: the hair above it is hidden under that hat
  const cuts = gear.filter((g) => g.slot === 'hat' || g.slot === 'helmet').map(hairCutFor).filter((c) => c != null);
  const cut = cuts.length ? Math.min(...cuts) : null;
  const wear = gear;
  const files = await Promise.all(wear.map((g) => load(g.url).catch(() => null)));
  const rootInv = root.matrixWorld.clone().invert();
  wear.forEach((g, i) => {
    const gltf = files[i]; if (!gltf) return;
    const part = g.slot === 'shoes' ? [['footL', 1], ['footR', -1]] : [['head', 1]];
    for (const [where, side] of part) {
      const { box, bone } = body[where];
      if (!bone || box.isEmpty()) continue;
      const obj = gltf.scene.clone(true);
      const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
      const p = place(g.slot, size, box, ITEM_FIT[g.id]);
      const bs = box.getSize(new THREE.Vector3());
      const unit = g.slot === 'shoes' ? bs.z : bs.y;
      // the bone's place in root space now (the bind pose): the piece keeps its place from it
      const fromBone = rootInv.clone().multiply(bone.matrixWorld).invert();
      const piece = { id: g.id, slot: g.slot, body: g.body, obj, apply: (f) => { obj.matrix.copy(fromBone).multiply(compose(THREE, p, size, side, unit, f)); } };
      piece.apply(g.body ? fitFor(g.body, g.id) : null);
      obj.matrixAutoUpdate = false;
      if (g.slot === 'hair' && cut != null) {
        // the piece's meshes in root space: the bone's place now, then the piece's own matrix
        const pieceToRoot = rootInv.clone().multiply(bone.matrixWorld).multiply(obj.matrix);
        obj.updateMatrixWorld(true);
        const objInv = obj.matrixWorld.clone().invert();
        const y = box.min.y + bs.y * cut;
        const hide = [];
        obj.traverse((o) => {
          if (!o.isMesh) return;
          const toRoot = pieceToRoot.clone().multiply(objInv.clone().multiply(o.matrixWorld));
          if (!cutAbove(THREE, o, toRoot, y)) hide.push(o);
          mats.push(o.geometry);   // a copy of its own, freed with the character
        });
        hide.forEach((o) => { o.visible = false; });
      }
      obj.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        o.castShadow = false;
        o.material = o.material.clone(); mats.push(o.material);
        o.material.roughness = 0.75; o.material.metalness = 0;
        if (g.slot === 'hair' && hair) o.material.color.setRGB(...hair);
      });
      bone.add(obj);
      root.userData.gear.push(piece);
    }
  });
  return mats;
}

/** Move a piece already worn (the fit editor): `fit` as in js/core/gear-fit.js. */
export function retune(root, id, fit) {
  for (const piece of root?.userData.gear || []) if (piece.id === id) piece.apply(fit);
}
