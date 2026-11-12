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
  'hair-buns': { top: 0.3 },
  'hair-bun-low': { top: 0.22, across: 1.28, front: -0.12 },
  'helmet-aero': { back: undefined, front: 0.1 },
  'hat-gold': { top: 0.3 },
  'glasses-gold': { eye: 0.4 },
  'hat-cap-navy': { across: 1.22, top: 0.3 },
};

/** Hats and helmets that hide the hair under them. */
const COVERS = new Set(['hat', 'helmet']);
const SHOWS_HAIR = new Set(['hat-visor']);

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
 * dispose with the character. Each piece is listed on `root.userData.gear`, for retune().
 */
export async function dress(THREE, root, gear, { load, hair = null } = {}) {
  const mats = [];
  root.userData.gear = [];
  if (!gear?.length) return mats;
  const covered = gear.some((g) => COVERS.has(g.slot) && !SHOWS_HAIR.has(g.id));
  const wear = gear.filter((g) => !(g.slot === 'hair' && covered));
  const files = await Promise.all(wear.map((g) => load(g.url).catch(() => null)));
  const body = measureBody(THREE, root);
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
