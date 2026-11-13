// build-characters.mjs: the animated characters (js/app/char3d.js), from the Mixamo and Meshy / Tripo
// files in MOSKE APP/Characters. See docs/CHARACTERS.md.
//
//   npm install --no-save three@0.170.0 @gltf-transform/core@4.1.1 @gltf-transform/extensions@4.1.1 \
//     @gltf-transform/functions@4.1.1 meshoptimizer@0.22.0
//   node tools/build-characters.mjs "<path to MOSKE APP/Characters>" [name ...]
//
// With names (male, female, mechanic, robot, clips, bosses, boss-<name>, or an outfit file's name) it builds only those.
//
// What it reads:
//   Clips/Male/*.fbx      Mixamo clips. One of them must be "With Skin": that's the rigged male.
//   Clips/Female/*.fbx    Mixamo clips for the female skeleton (skin or no skin).
//   Clips/Mechanic/*.fbx  the mechanic's.
//   Rigged/…fbx + png     the bodies as they were uploaded to Mixamo, for the textures and, when no
//                         clip carries the skin, the mesh.
//   GLB Assets/Outfits/<Male|Female>/<outfit>-<male|female>.glb   a whole dressed character each.
//   GLB Assets/Mechanic/Mechanic.glb
//
// What it writes, in models/chars/:
//   <body>.glb            the body, skinned, feet on y = 0, 1.8 tall, facing +Z
//   <outfit>-<body>.glb   the same character dressed: its own mesh on the same skeleton
//   <body>-clips.glb      the skeleton and every clip, no mesh. A clip drives any model of that body.
//   mechanic.glb, mechanic-clips.glb, and mechanic-red/-green/-orange.glb (his twins, recoloured)
//   boss-<name>.glb        a boss (GLB Assets/Bosses/<name>.glb). With clips made on him in Mixamo
//                          (Clips/Bosses/<name>/*.fbx) he gets his own skeleton and boss-<name>-clips.glb;
//                          without, he is on the male skeleton and male-clips.glb drives him.
//
// How a mesh without a skin gets one. Only the male comes out of Mixamo with its skin. Everything
// else (the female body, every outfit, the mechanic) is a plain mesh that has to be bound to a
// skeleton here:
//  1. the skeleton is posed to match the mesh: the arms and legs are turned, and the mesh moved and
//     scaled, until a rigged body laid over it fits as closely as it can (`fit`);
//  2. every vertex takes the bone weights of the nearest skin on that rigged body that faces the
//     same way (`transfer`), smoothed over the mesh so a seam never tears;
//  3. the pose from step 1 becomes this mesh's bind pose. Each model keeps its own bind pose, so an
//     outfit generated with its arms higher than the body's still animates correctly.
// Fingers are folded into the hand on those meshes: copied finger weights are never clean.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, dedup, prune, reorder, quantize, simplify, resample } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import { skinTexture } from './lib/skin-texture.mjs';
import { recolour, MECH_TONES } from './lib/recolour.mjs';

globalThis.self = globalThis;
globalThis.window = { URL: { createObjectURL: () => 'blob:none' } };
globalThis.document = { createElementNS: () => ({ style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {} }) };
const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const { mergeVertices } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');

const SRC = process.argv[2];
const ONLY = process.argv.slice(3);
const want = (name) => !ONLY.length || ONLY.includes(name);
const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(REPO, 'models', 'chars');
const HEIGHT = 1.8;          // every character in the app
const SRC_HEIGHT = 1.9;      // what Meshy and Mixamo work in
const TEX = 1024;
const MAX_TRIS = 30000;
const PRE = 'mixamorig';

/** Mixamo's file names to the app's clip names. Anything not listed is skipped. */
const CLIP_NAMES = {
  idle: 'idle', walk: 'walk', walking: 'walk', runslow: 'run-slow', runmedium: 'run', runfast: 'run-fast',
  swim: 'swim', swimming: 'swim', airsquat: 'squat', pushup: 'pushup', sittingidle: 'sit',
  taunt1: 'taunt1', taunt2: 'taunt2', victory: 'victory', wavestatic: 'wave', wave: 'wave', waving: 'wave',
  fixingitemonknees: 'work', confidentstrut: 'walk', confidentwalk: 'walk',
  // the bosses' own (Clips/Bosses/<name>/)
  armstretching: 'stretch', laughing: 'laugh', rumbadancing: 'dance', sillydancing: 'dance2', running: 'run',
  // the clan robot's (Clips/ClubRobot/)
  breathingidle: 'idle', sadidle: 'sad',
};
/** Clips that travel in Mixamo unless "In Place" was ticked: any drift is taken out here. */
const IN_PLACE = ['walk', 'run', 'run-slow', 'run-fast'];

// ---- reading -----------------------------------------------------------------------------

function loadFbx(file) {
  const buf = fs.readFileSync(file);
  const silence = console.warn; console.warn = () => {};
  const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  console.warn = silence;
  obj.updateMatrixWorld(true);
  return obj;
}
const fbxIn = (dir) => {
  const out = [];
  const walk = (d) => { if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.fbx$/i.test(f)) out.push(p); } };
  walk(dir);
  return out;
};
const short = (n) => n.replace(PRE, '');
/** three.js reads an FBX's texture coordinates bottom-up; glTF counts from the top. */
const flipV = (uv) => { const out = Float32Array.from(uv); for (let i = 1; i < out.length; i += 2) out[i] = 1 - out[i]; return out; };

/** A skeleton as a flat list, parents first: [{ name, parent, pos: Vector3, quat: Quaternion }]. */
function skeletonOf(obj) {
  const bones = [];
  const add = (b, parent) => {
    const i = bones.length;
    bones.push({ name: short(b.name), parent, pos: b.position.clone(), quat: b.quaternion.clone() });
    for (const c of b.children) if (c.isBone) add(c, i);
  };
  let root = null; obj.traverse((o) => { if (!root && o.isBone) root = o; });
  add(root, -1);
  return bones;
}

/** A clip's tracks by bone: { name, duration, hips: { times, values }, quats: { bone: { times, values } } }. */
function clipOf(obj, name) {
  const c = obj.animations[0];
  if (!c) return null;
  const out = { name, duration: c.duration, hips: null, quats: {} };
  for (const t of c.tracks) {
    const [node, prop] = t.name.split('.');
    if (prop === 'quaternion') out.quats[short(node)] = { times: Float32Array.from(t.times), values: Float32Array.from(t.values) };
    else if (prop === 'position' && short(node) === 'Hips') out.hips = { times: Float32Array.from(t.times), values: Float32Array.from(t.values) };
  }
  if (out.hips && IN_PLACE.includes(name)) {
    // stay on the spot: take the straight-line drift out of x and z, keep the sway and the bounce
    const { times, values } = out.hips; const n = times.length; const T = times[n - 1] - times[0] || 1;
    for (const k of [0, 2]) { const d = values[(n - 1) * 3 + k] - values[k]; for (let i = 0; i < n; i++) values[i * 3 + k] -= d * ((times[i] - times[0]) / T); }
  }
  return out;
}

function clipsIn(dir, known = null) {
  const clips = {}; let skinned = null; let rest = null;
  for (const f of fbxIn(dir)) {
    const key = path.basename(f, path.extname(f)).toLowerCase().replace(/^.*without_skin_/, '').replace(/[^a-z0-9]/g, '');
    const name = CLIP_NAMES[key];
    const obj = loadFbx(f);
    let sk = null; obj.traverse((o) => { if (o.isSkinnedMesh) sk = o; });
    // a clip made on another rig (Meshy's own animations) can't drive a Mixamo skeleton
    const odd = known && skeletonOf(obj).find((b) => !known.has(b.name));
    if (odd) { console.log(`  skipped (not a Mixamo skeleton, it has a "${odd.name}" bone):`, path.basename(f)); continue; }
    if (sk && !skinned) skinned = { obj, sk };
    if (!sk && !rest) rest = skeletonOf(obj);
    if (!name) { console.log('  skipped (no clip name for it):', path.basename(f)); continue; }
    if (clips[name]) continue;
    clips[name] = clipOf(obj, name);
  }
  return { clips, skinned, rest };
}

/** A plain mesh from a GLB, node transforms baked in, simplified to MAX_TRIS: { pos, nrm, uv, idx, mat }. */
async function meshOfGlb(io, file) {
  const doc = await io.read(file);
  const tris = doc.getRoot().listMeshes().reduce((t, m) => t + m.listPrimitives().reduce((s, p) => s + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
  const steps = [weld()];
  if (tris > MAX_TRIS) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: MAX_TRIS / tris, error: 0.002 }));
  await doc.transform(...steps);
  const node = doc.getRoot().listNodes().find((n) => n.getMesh());
  const prim = node.getMesh().listPrimitives()[0];
  const m = node.getWorldMatrix();
  const p = prim.getAttribute('POSITION').getArray(), np = prim.getAttribute('NORMAL')?.getArray();
  const pos = new Float32Array(p.length), nrm = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    const [x, y, z] = [p[i], p[i + 1], p[i + 2]];
    pos[i] = m[0] * x + m[4] * y + m[8] * z + m[12]; pos[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; pos[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    if (np) { const [a, b, c] = [np[i], np[i + 1], np[i + 2]]; const v = [m[0] * a + m[4] * b + m[8] * c, m[1] * a + m[5] * b + m[9] * c, m[2] * a + m[6] * b + m[10] * c]; const l = Math.hypot(...v) || 1; nrm.set(v.map((q) => q / l), i); }
  }
  const idx = prim.getIndices() ? Uint32Array.from(prim.getIndices().getArray()) : Uint32Array.from({ length: p.length / 3 }, (_, i) => i);
  const mesh = { pos, nrm, uv: Float32Array.from(prim.getAttribute('TEXCOORD_0').getArray()), idx };
  if (!np) mesh.nrm = normalsOf(pos, idx);
  const mat = prim.getMaterial();
  const img = (t) => (t ? Buffer.from(t.getImage()) : null);
  return { mesh, base: img(mat.getBaseColorTexture()), normal: img(mat.getNormalTexture()) };
}

/** A plain mesh from an FBX (the bodies as uploaded to Mixamo): centimetres, Z up, turned to metres, Y up. */
function meshOfFbx(file) {
  const obj = loadFbx(file);
  let geo = null;
  obj.traverse((o) => { if (o.isMesh && !geo) geo = o.geometry.clone().applyMatrix4(o.matrixWorld); });
  geo.deleteAttribute('normal');
  geo = mergeVertices(geo, 1e-6);
  geo.computeVertexNormals();
  const pos = Float32Array.from(geo.attributes.position.array);
  let hi = -Infinity, lo = Infinity; for (let i = 1; i < pos.length; i += 3) { hi = Math.max(hi, pos[i]); lo = Math.min(lo, pos[i]); }
  const s = SRC_HEIGHT / (hi - lo); for (let i = 0; i < pos.length; i++) pos[i] *= s;
  return { pos, nrm: Float32Array.from(geo.attributes.normal.array), uv: flipV(geo.attributes.uv.array), idx: Uint32Array.from(geo.index.array) };
}

function normalsOf(pos, idx) {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    for (const i of [a, b, c]) { n[i] += x; n[i + 1] += y; n[i + 2] += z; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}

/** Stand a mesh where the skeletons expect it: SRC_HEIGHT tall, its box centred on the origin. */
function centre(mesh) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], mesh.pos[i + k]); hi[k] = Math.max(hi[k], mesh.pos[i + k]); }
  const s = SRC_HEIGHT / (hi[1] - lo[1]);
  for (let i = 0; i < mesh.pos.length; i += 3) for (let k = 0; k < 3; k++) mesh.pos[i + k] = (mesh.pos[i + k] - (lo[k] + hi[k]) / 2) * s;
}

// ---- the skeleton in a pose ----------------------------------------------------------------

/** The limbs `fit` may turn, and about which world axes: z raises or spreads, y swings forward. */
const DOF = [
  ['LeftArm', 'z'], ['LeftArm', 'y'], ['LeftForeArm', 'z'], ['LeftUpLeg', 'z'],
  ['RightArm', 'z'], ['RightArm', 'y'], ['RightForeArm', 'z'], ['RightUpLeg', 'z'],
];
const AXIS = { z: new THREE.Vector3(0, 0, 1), y: new THREE.Vector3(0, 1, 0) };

/**
 * World matrices of a skeleton with local rotations `quats`, the DOF joints turned by `turn`
 * (radians, in DOF's order) about world axes.
 * @returns {{ mats: THREE.Matrix4[], wq: THREE.Quaternion[] }}
 */
function pose(bones, quats, turn = null) {
  const wq = [], wp = [], mats = [];
  const one = new THREE.Vector3(1, 1, 1);
  bones.forEach((b, i) => {
    const q = b.parent < 0 ? quats[i].clone() : wq[b.parent].clone().multiply(quats[i]);
    const p = b.parent < 0 ? b.pos.clone() : b.pos.clone().applyQuaternion(wq[b.parent]).add(wp[b.parent]);
    if (turn) DOF.forEach(([name, ax], k) => { if (name === b.name && turn[k]) q.premultiply(new THREE.Quaternion().setFromAxisAngle(AXIS[ax], turn[k])); });
    wq.push(q); wp.push(p); mats.push(new THREE.Matrix4().compose(p, q, one));
  });
  return { mats, wq };
}
const localQuats = (bones, wq) => bones.map((b, i) => (b.parent < 0 ? wq[i].clone() : wq[b.parent].clone().invert().multiply(wq[i])));

/** Linear blend skinning of points (and normals) by `mats[j] × ibm[j]`. */
function skinPoints(src, mats, only = null) {
  const M = mats.map((m, j) => m.clone().multiply(src.ibm[j]).elements);
  const n = only ? only.length : src.pos.length / 3;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
  for (let o = 0; o < n; o++) {
    const i = only ? only[o] : o;
    const x = src.pos[i * 3], y = src.pos[i * 3 + 1], z = src.pos[i * 3 + 2];
    const a = src.nrm[i * 3], b = src.nrm[i * 3 + 1], c = src.nrm[i * 3 + 2];
    let px = 0, py = 0, pz = 0, nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < 4; k++) {
      const w = src.weights[i * 4 + k]; if (!w) continue;
      const e = M[src.joints[i * 4 + k]];
      px += w * (e[0] * x + e[4] * y + e[8] * z + e[12]); py += w * (e[1] * x + e[5] * y + e[9] * z + e[13]); pz += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
      nx += w * (e[0] * a + e[4] * b + e[8] * c); ny += w * (e[1] * a + e[5] * b + e[9] * c); nz += w * (e[2] * a + e[6] * b + e[10] * c);
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    pos.set([px, py, pz], o * 3); nrm.set([nx / l, ny / l, nz / l], o * 3);
  }
  return { pos, nrm };
}

// ---- fitting the skeleton to a mesh --------------------------------------------------------

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function sample(count, n, seed) { const r = rng(seed); const out = new Uint32Array(Math.min(n, count)); for (let i = 0; i < out.length; i++) out[i] = Math.floor(r() * count); return out; }

/** How far apart two point clouds are: the mean distance to the nearest point, both ways, capped. */
function apart(A, B) {
  const na = A.length / 3, nb = B.length / 3, CAP = 0.2 * 0.2;
  const bestB = new Float32Array(nb).fill(Infinity);
  let sum = 0;
  for (let i = 0; i < na; i++) {
    const x = A[i * 3], y = A[i * 3 + 1], z = A[i * 3 + 2];
    let best = Infinity;
    for (let j = 0; j < nb; j++) {
      const dx = B[j * 3] - x, dy = B[j * 3 + 1] - y, dz = B[j * 3 + 2] - z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < best) best = d;
      if (d < bestB[j]) bestB[j] = d;
    }
    sum += Math.sqrt(Math.min(best, CAP));
  }
  let sumB = 0; for (let j = 0; j < nb; j++) sumB += Math.sqrt(Math.min(bestB[j], CAP));
  return sum / na + sumB / nb;
}

/**
 * Pose `bones` (from `quats`) and place `mesh` so that `src`, a rigged body, lies on it.
 * @returns {{ mats, quats, scale, shift, err }} the pose, and how the mesh was moved (already applied to it)
 */
function fit(src, bones, quats, mesh, label) {
  const sIdx = sample(src.pos.length / 3, 1800, 7), tIdx = sample(mesh.pos.length / 3, 1800, 11);
  const T0 = new Float32Array(tIdx.length * 3); tIdx.forEach((v, i) => { T0[i * 3] = mesh.pos[v * 3]; T0[i * 3 + 1] = mesh.pos[v * 3 + 1]; T0[i * 3 + 2] = mesh.pos[v * 3 + 2]; });
  // p: scale, x, y, z of the mesh, then DOF's angles
  const p = new Float64Array(4 + DOF.length); p[0] = 1;
  const T = new Float32Array(T0.length);
  const cost = (q) => {
    for (let i = 0; i < T0.length; i += 3) { T[i] = T0[i] * q[0] + q[1]; T[i + 1] = T0[i + 1] * q[0] + q[2]; T[i + 2] = T0[i + 2] * q[0] + q[3]; }
    return apart(skinPoints(src, pose(bones, quats, q.subarray(4)).mats, sIdx).pos, T);
  };
  let best = cost(p);
  const start = best;
  // the arms first, coarsely: a mesh with its arms 40° higher is a long way from the start
  for (const k of [0, 4]) {
    const sign = k === 0 ? 1 : -1; let at = 0;
    for (let deg = -30; deg <= 70; deg += 5) { const q = p.slice(); q[4 + k] = sign * deg * Math.PI / 180; const c = cost(q); if (c < best) { best = c; at = q[4 + k]; } }
    p[4 + k] = at;
  }
  const step = new Float64Array(p.length);
  step[0] = 0.02; step[1] = step[2] = step[3] = 0.02; for (let k = 4; k < p.length; k++) step[k] = 6 * Math.PI / 180;
  for (let round = 0; round < 7; round++) {
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (let k = 0; k < p.length; k++) for (const d of [1, -1]) {
        const q = p.slice(); q[k] += d * step[k];
        const c = cost(q);
        if (c < best - 1e-6) { best = c; p.set(q); moved = true; break; }
      }
      if (!moved) break;
    }
    for (let k = 0; k < step.length; k++) step[k] /= 2;
  }
  for (let i = 0; i < mesh.pos.length; i += 3) { mesh.pos[i] = mesh.pos[i] * p[0] + p[1]; mesh.pos[i + 1] = mesh.pos[i + 1] * p[0] + p[2]; mesh.pos[i + 2] = mesh.pos[i + 2] * p[0] + p[3]; }
  const posed = pose(bones, quats, p.subarray(4));
  const deg = Array.from(p.subarray(4), (r) => Math.round(r * 180 / Math.PI));
  console.log(`  fit ${label}: ${(start * 500).toFixed(1)} mm -> ${(best * 500).toFixed(1)} mm apart; scale ${p[0].toFixed(3)}, moved ${[p[1], p[2], p[3]].map((v) => (v * 1000).toFixed(0)).join(' ')} mm; turned ${DOF.map(([n, a], k) => `${n}.${a} ${deg[k]}°`).join(', ')}`);
  return { mats: posed.mats, quats: localQuats(bones, posed.wq), err: best / 2 };
}

// ---- copying the weights -------------------------------------------------------------------

const FINGER = /Hand(Thumb|Index|Middle|Ring|Pinky)/;

/**
 * Give `mesh` the weights of `src` as posed by `mats`: each vertex from the nearest skin that faces
 * the same way. `fold[j]` is the joint that joint j's weight ends up on (fingers go to the hand).
 * @returns {{ joints: Uint16Array, weights: Float32Array }}
 */
function transfer(src, mats, mesh, fold) {
  const S = skinPoints(src, mats);
  const ns = S.pos.length / 3, nv = mesh.pos.length / 3, nb = mats.length;
  const to = fold;
  // vertices that share a place share their weights: a UV seam must not tear
  const group = new Uint32Array(nv); const key = new Map(); const gp = [], gn = [];
  for (let v = 0; v < nv; v++) {
    const k = `${Math.round(mesh.pos[v * 3] * 2e4)},${Math.round(mesh.pos[v * 3 + 1] * 2e4)},${Math.round(mesh.pos[v * 3 + 2] * 2e4)}`;
    let g = key.get(k);
    if (g === undefined) { g = gp.length / 3; key.set(k, g); gp.push(mesh.pos[v * 3], mesh.pos[v * 3 + 1], mesh.pos[v * 3 + 2]); gn.push(0, 0, 0); }
    gn[g * 3] += mesh.nrm[v * 3]; gn[g * 3 + 1] += mesh.nrm[v * 3 + 1]; gn[g * 3 + 2] += mesh.nrm[v * 3 + 2];
    group[v] = g;
  }
  const ng = gp.length / 3;
  let W = new Float32Array(ng * nb);
  const K = 4; const bd = new Float64Array(K), bi = new Int32Array(K);
  for (let g = 0; g < ng; g++) {
    const x = gp[g * 3], y = gp[g * 3 + 1], z = gp[g * 3 + 2];
    const l = Math.hypot(gn[g * 3], gn[g * 3 + 1], gn[g * 3 + 2]) || 1; const a = gn[g * 3] / l, b = gn[g * 3 + 1] / l, c = gn[g * 3 + 2] / l;
    bd.fill(Infinity); bi.fill(-1);
    for (let j = 0; j < ns; j++) {
      const dx = S.pos[j * 3] - x, dy = S.pos[j * 3 + 1] - y, dz = S.pos[j * 3 + 2] - z;
      let d = dx * dx + dy * dy + dz * dz;
      if (d >= bd[K - 1]) continue;
      // skin facing the other way (the far side of an arm, the thigh next to a hand) counts as further off
      const facing = S.nrm[j * 3] * a + S.nrm[j * 3 + 1] * b + S.nrm[j * 3 + 2] * c;
      if (facing < 0) d = d * 4 + 0.0004;
      if (d >= bd[K - 1]) continue;
      let k = K - 1; while (k > 0 && bd[k - 1] > d) { bd[k] = bd[k - 1]; bi[k] = bi[k - 1]; k--; }
      bd[k] = d; bi[k] = j;
    }
    for (let k = 0; k < K; k++) {
      if (bi[k] < 0) continue;
      const f = 1 / (bd[k] + 1e-6);
      for (let q = 0; q < 4; q++) { const w = src.weights[bi[k] * 4 + q]; if (w) W[g * nb + to[src.joints[bi[k] * 4 + q]]] += f * w; }
    }
  }
  // smooth over the mesh, so the nearest-point choice leaves no steps
  const nbrs = Array.from({ length: ng }, () => new Set());
  for (let t = 0; t < mesh.idx.length; t += 3) { const [a, b, c] = [group[mesh.idx[t]], group[mesh.idx[t + 1]], group[mesh.idx[t + 2]]]; nbrs[a].add(b).add(c); nbrs[b].add(a).add(c); nbrs[c].add(a).add(b); }
  const norm = (A) => { for (let g = 0; g < ng; g++) { let s = 0; for (let j = 0; j < nb; j++) s += A[g * nb + j]; if (s) for (let j = 0; j < nb; j++) A[g * nb + j] /= s; } };
  norm(W);
  for (let it = 0; it < 3; it++) {
    const N = new Float32Array(W.length);
    for (let g = 0; g < ng; g++) {
      const ns2 = nbrs[g]; const share = ns2.size ? 0.5 / ns2.size : 0;
      for (let j = 0; j < nb; j++) N[g * nb + j] = W[g * nb + j] * (ns2.size ? 0.5 : 1);
      for (const h of ns2) for (let j = 0; j < nb; j++) N[g * nb + j] += W[h * nb + j] * share;
    }
    W = N;
  }
  // the four strongest per vertex
  const joints = new Uint16Array(nv * 4), weights = new Float32Array(nv * 4);
  const gj = new Uint16Array(ng * 4), gw = new Float32Array(ng * 4);
  for (let g = 0; g < ng; g++) {
    const top = [];
    for (let j = 0; j < nb; j++) { const w = W[g * nb + j]; if (w > 0.01) top.push([w, j]); }
    top.sort((p, q) => q[0] - p[0]); top.length = Math.min(4, top.length);
    if (!top.length) top.push([1, 0]);
    const s = top.reduce((t, [w]) => t + w, 0);
    top.forEach(([w, j], k) => { gj[g * 4 + k] = j; gw[g * 4 + k] = w / s; });
  }
  for (let v = 0; v < nv; v++) for (let k = 0; k < 4; k++) { joints[v * 4 + k] = gj[group[v] * 4 + k]; weights[v * 4 + k] = gw[group[v] * 4 + k]; }
  return { joints, weights };
}

// ---- writing -------------------------------------------------------------------------------

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const K = HEIGHT / SRC_HEIGHT;

/** The skeleton as nodes under a root that scales it to the app's height. Returns { root, nodes }. */
function addSkeleton(doc, scene, bones, quats, lift) {
  const root = doc.createNode('rig').setScale([K, K, K]);
  scene.addChild(root);
  const nodes = bones.map((b, i) => {
    const p = b.pos.toArray(); if (b.parent < 0) p[1] += lift;
    return doc.createNode(PRE + b.name).setTranslation(p).setRotation(quats[i].toArray());
  });
  bones.forEach((b, i) => (b.parent < 0 ? root : nodes[b.parent]).addChild(nodes[i]));
  return { root, nodes };
}

/**
 * Write a skinned character. `rig`: { bones, quats (bind, local), mats (bind, world), lift }.
 * `tex`: { base, mask, normal } as PNG buffers (mask and normal may be missing).
 */
async function writeChar(name, mesh, skin, rig, tex) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
  const webp = async (png, quality) => sharp(png).resize(TEX, TEX, { kernel: 'mitchell' }).webp({ quality }).toBuffer();
  const mat = doc.createMaterial(name).setRoughnessFactor(0.8).setMetallicFactor(0).setDoubleSided(true)
    .setBaseColorTexture(doc.createTexture('base').setMimeType('image/webp').setImage(await webp(tex.base, 86)));
  if (tex.mask) mat.setEmissiveTexture(doc.createTexture('mask').setMimeType('image/webp').setImage(await webp(tex.mask, 90))).setEmissiveFactor([0, 0, 0]);
  if (tex.normal) mat.setNormalTexture(doc.createTexture('normal').setMimeType('image/webp').setImage(await webp(tex.normal, 86)));
  const prim = doc.createPrimitive().setMaterial(mat)
    .setAttribute('POSITION', acc('VEC3', Float32Array.from(mesh.pos))).setAttribute('NORMAL', acc('VEC3', Float32Array.from(mesh.nrm)))
    .setAttribute('TEXCOORD_0', acc('VEC2', Float32Array.from(mesh.uv)))
    .setAttribute('JOINTS_0', acc('VEC4', Uint16Array.from(skin.joints))).setAttribute('WEIGHTS_0', acc('VEC4', Float32Array.from(skin.weights)))
    .setIndices(acc('SCALAR', Uint32Array.from(mesh.idx)));
  const scene = doc.createScene();
  const { nodes } = addSkeleton(doc, scene, rig.bones, rig.quats, rig.lift);
  const ibm = new Float32Array(rig.bones.length * 16);
  rig.mats.forEach((m, i) => ibm.set(m.clone().invert().elements, i * 16));
  const sk = doc.createSkin(name).setSkeleton(nodes[0]).setInverseBindMatrices(acc('MAT4', ibm));
  nodes.forEach((n) => sk.addJoint(n));
  scene.addChild(doc.createNode(`${name}-mesh`).setMesh(doc.createMesh(name).addPrimitive(prim)).setSkin(sk));
  doc.getRoot().setDefaultScene(scene);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await doc.transform(dedup(), prune({ keepLeaves: true }), reorder({ encoder: MeshoptEncoder }), quantize({ quantizePosition: 14 }));
  const file = path.join(OUT, `${name}.glb`);
  await io.write(file, doc);
  console.log(`  wrote ${name}.glb ${(fs.statSync(file).size / 1024).toFixed(0)} KB, ${mesh.idx.length / 3} tris`);
}

async function writeClips(name, rig, clips) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const { nodes } = addSkeleton(doc, scene, rig.bones, rig.quats, rig.lift);
  const index = new Map(rig.bones.map((b, i) => [b.name, i]));
  const names = Object.keys(clips).sort();
  for (const cn of names) {
    const c = clips[cn]; const anim = doc.createAnimation(cn);
    const add = (node, pathName, type, t) => {
      const sampler = doc.createAnimationSampler().setInput(doc.createAccessor().setType('SCALAR').setArray(t.times).setBuffer(buffer))
        .setOutput(doc.createAccessor().setType(type).setArray(t.values).setBuffer(buffer)).setInterpolation('LINEAR');
      anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(pathName).setSampler(sampler));
    };
    if (c.hips) add(nodes[0], 'translation', 'VEC3', c.hips);
    for (const [bone, t] of Object.entries(c.quats)) if (index.has(bone)) add(nodes[index.get(bone)], 'rotation', 'VEC4', t);
  }
  doc.getRoot().setDefaultScene(scene);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await doc.transform(resample({ tolerance: 1e-4 }), dedup(), prune({ keepLeaves: true }), quantize());
  const file = path.join(OUT, `${name}.glb`);
  await io.write(file, doc);
  console.log(`  wrote ${name}.glb ${(fs.statSync(file).size / 1024).toFixed(0)} KB: ${names.map((n) => `${n} ${clips[n].duration.toFixed(2)}s`).join(', ')}`);
}

// ---- the build -----------------------------------------------------------------------------

await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
fs.mkdirSync(OUT, { recursive: true });
const find = (dir, re) => { const hit = []; const walk = (d) => { if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (re.test(f)) hit.push(p); } }; walk(dir); return hit; };
/** The body as uploaded to Mixamo: its mesh file and its base colour and normal pictures. */
const uploaded = (who) => {
  const dir = find(path.join(SRC, 'Rigged'), /\.fbx$/i).map((f) => path.dirname(f)).find((d) => d.split(path.sep).some((seg) => seg.toLowerCase().startsWith(`${who.toLowerCase()}_model`)));
  if (!dir) throw new Error(`No uploaded ${who} body under Rigged/`);
  const fbx = find(dir, /\.fbx$/i)[0]; const stem = fbx.replace(/\.fbx$/i, '');
  return { fbx, base: fs.readFileSync(`${stem}.png`), normal: fs.readFileSync(`${stem}_normal.png`) };
};

/** How far the hips are lifted at rest so the feet stand on y = 0: the meshes are centred on the origin. */
const LIFT = SRC_HEIGHT / 2;
const parentNames = (bones) => Object.fromEntries(bones.map((b) => [b.name, b.parent < 0 ? null : bones[b.parent].name]));
const foldFingers = (bones) => { const at = new Map(bones.map((b, i) => [b.name, i])); return bones.map((b, i) => (FINGER.test(b.name) ? at.get(b.name.replace(/Hand(Thumb|Index|Middle|Ring|Pinky)\d$/, 'Hand')) ?? i : i)); };

/**
 * A rigged body as something to lay over another skeleton: its joints renumbered to `bones`, and
 * a bone that skeleton lacks (the mechanic has few fingers) handed to the nearest one it has.
 */
function sourceFor(rig, bones) {
  const at = new Map(bones.map((b, i) => [b.name, i]));
  const own = new Map(rig.bones.map((b, i) => [b.name, i]));
  const up = parentNames(rig.bones);
  const to = rig.bones.map((b) => { let n = b.name; while (!at.has(n)) n = up[n] || bones[0].name; return at.get(n); });
  return {
    pos: rig.mesh.pos, nrm: rig.mesh.nrm, weights: rig.skin.weights,
    joints: Uint16Array.from(rig.skin.joints, (j) => to[j]),
    // a bone the rig hasn't got carries no weight, so its matrix is never used
    ibm: bones.map((b) => (own.has(b.name) ? rig.mats[own.get(b.name)].clone().invert() : new THREE.Matrix4())),
  };
}

/** Bind a plain mesh to `bones`, starting from the pose `quats`, by laying `rig` over it. */
function bind(rig, bones, quats, mesh, label) {
  centre(mesh);
  const s = sourceFor(rig, bones);
  const f = fit(s, bones, quats, mesh, label);
  const skin = transfer(s, f.mats, mesh, foldFingers(bones));
  return { bones, quats: f.quats, mats: f.mats, mesh, skin, lift: LIFT };
}

// ---- the male: Mixamo's own skin --------------------------------------------------------------

console.log('male');
const male = clipsIn(path.join(SRC, 'Clips', 'Male'));
if (!male.skinned) throw new Error('No male clip was downloaded "With Skin": the rigged male comes from one.');
if (!male.rest) throw new Error('No male clip was downloaded "Without Skin": its T-pose is how the other skeletons are lined up.');
const maleRig = (() => {
  const { obj, sk } = male.skinned;
  const bones = skeletonOf(obj);
  const at = new Map(bones.map((b, i) => [b.name, i]));
  const geo = mergeVertices(sk.geometry, 1e-6);
  const remap = sk.skeleton.bones.map((b) => at.get(short(b.name)));
  const joints = Uint16Array.from(geo.attributes.skinIndex.array, (j) => remap[j]);
  const weights = Float32Array.from(geo.attributes.skinWeight.array);
  for (let i = 0; i < weights.length; i += 4) { const s = weights[i] + weights[i + 1] + weights[i + 2] + weights[i + 3] || 1; for (let k = 0; k < 4; k++) weights[i + k] /= s; }
  const quats = bones.map((b) => b.quat);
  const mesh = { pos: Float32Array.from(geo.attributes.position.array), nrm: Float32Array.from(geo.attributes.normal.array), uv: flipV(geo.attributes.uv.array), idx: Uint32Array.from(geo.index.array) };
  return { bones, quats, mats: pose(bones, quats).mats, mesh, skin: { joints, weights }, lift: LIFT };
})();
const maleBind = new Map(maleRig.bones.map((b) => [b.name, b.quat]));
const maleT = new Map(male.rest.map((b) => [b.name, b.quat]));
/** The male's bind pose carried to a skeleton that came in its T-pose: each joint turned by as much. */
const bindLike = (bones) => bones.map((b) => (maleT.has(b.name) ? b.quat.clone().multiply(maleT.get(b.name).clone().invert()).multiply(maleBind.get(b.name)) : b.quat.clone()));

if (want('male')) {
  const up = uploaded('Male');
  const t = await skinTexture(up.base, TEX);
  await writeChar('male', maleRig.mesh, maleRig.skin, maleRig, { base: t.png, mask: t.mask, normal: up.normal });
}
if (want('male') || want('clips')) await writeClips('male-clips', maleRig, male.clips);

// ---- the female: the male's skin laid over her skeleton -------------------------------------------

const needFemale = want('female') || want('clips') || want('outfits') || ONLY.some((n) => /-female$/.test(n));
let femaleRig = null;
if (needFemale) {
  console.log('female');
  const female = clipsIn(path.join(SRC, 'Clips', 'Female'));
  const hipsY = (c) => c.clips.idle.hips.values[1];
  // clips she has no file for come from the male's, the hips moved to her height
  for (const [name, c] of Object.entries(male.clips)) {
    if (female.clips[name]) continue;
    const k = hipsY(female) / hipsY(male);
    female.clips[name] = { ...c, hips: c.hips && { times: c.hips.times, values: c.hips.values.map((v) => v * k) } };
    console.log(`  ${name}: the male's clip`);
  }
  const up = uploaded('Female');
  femaleRig = bind(maleRig, female.rest, bindLike(female.rest), meshOfFbx(up.fbx), 'female body');
  if (want('female')) {
    const t = await skinTexture(up.base, TEX);
    await writeChar('female', femaleRig.mesh, femaleRig.skin, femaleRig, { base: t.png, mask: t.mask, normal: up.normal });
  }
  if (want('female') || want('clips')) await writeClips('female-clips', femaleRig, female.clips);
}

// ---- outfits: a dressed character each, on its body's skeleton --------------------------------------

for (const [who, rig] of [['male', maleRig], ['female', femaleRig]]) {
  for (const file of find(path.join(SRC, 'GLB Assets', 'Outfits'), new RegExp(`-${who}\\.glb$`, 'i'))) {
    const name = path.basename(file, '.glb').toLowerCase();
    if (!rig || (!want(name) && !want('outfits'))) continue;
    console.log(name);
    const g = await meshOfGlb(io, file);
    const r = bind(rig, rig.bones, rig.quats, g.mesh, name);
    const t = await skinTexture(g.base, TEX);
    await writeChar(name, r.mesh, r.skin, r, { base: t.png, mask: t.mask, normal: g.normal });
  }
}

// ---- the bosses: a whole character each, on the male (or female) skeleton, playing its clips -------
// GLB Assets/Bosses/<name>.glb → boss-<name>.glb. Its own colours: no skin tint.

for (const file of find(path.join(SRC, 'GLB Assets', 'Bosses'), /\.glb$/i)) {
  const base = path.basename(file, '.glb').toLowerCase();
  const name = `boss-${base.replace(/-(male|female)$/, '')}`;
  const rig = /-female$/.test(base) ? femaleRig : maleRig;
  if (!rig || (!want(name) && !want('bosses'))) continue;
  console.log(name);
  const g = await meshOfGlb(io, file);
  // clips made in Mixamo on the boss himself (Clips/Bosses/<name>/): his own skeleton, so his
  // joints sit where his body bends and nothing stretches. Without them, the male's.
  const own = clipsIn(path.join(SRC, 'Clips', 'Bosses', base.replace(/-(male|female)$/, '')), new Set(maleRig.bones.map((b) => b.name)));
  if (own.rest) {
    // Mixamo keeps the size the body was uploaded at: bring his skeleton (and his clips' hips) to
    // the male's scale, and its hips down to the middle of him as the male's are, since every mesh
    // is centred and made 1.9 tall (`centre`).
    const at = new Map(male.rest.map((b) => [b.name, b]));
    const span = (bones, ref) => bones.reduce((t, b) => t + (ref.has(b.name) && b.parent >= 0 ? b.pos.length() : 0), 0);
    const grow = span(male.rest, at) / span(own.rest, at);
    const standing = own.rest[0].pos.y * grow;
    for (const b of own.rest) b.pos.multiplyScalar(grow);
    if (standing > LIFT / 2) own.rest[0].pos.y -= LIFT;
    for (const c of Object.values(own.clips)) if (c.hips) c.hips.values = c.hips.values.map((v) => v * grow);
    console.log(`  his skeleton came ${grow.toFixed(2)} times too small: scaled up`);
    const r = bind(maleRig, own.rest, bindLike(own.rest), g.mesh, name);
    const has = new Set(own.rest.map((b) => b.name));
    const hipsY = (c) => c.hips.values[1];
    const k = own.clips.run?.hips && male.clips.run?.hips ? hipsY(own.clips.run) / hipsY(male.clips.run) : 1;
    // the male's for what he has no clip of, only those a boss plays (stadium.js)
    for (const [cn, c] of Object.entries(male.clips)) {
      if (own.clips[cn] || !['idle', 'walk', 'wave', 'victory', 'taunt1', 'taunt2'].includes(cn)) continue;
      own.clips[cn] = { ...c, hips: c.hips && { times: c.hips.times, values: c.hips.values.map((v) => v * k) }, quats: Object.fromEntries(Object.entries(c.quats).filter(([b]) => has.has(b))) };
    }
    await writeChar(name, r.mesh, r.skin, r, { base: g.base, normal: g.normal });
    await writeClips(`${name}-clips`, r, own.clips);
    continue;
  }
  const r = bind(rig, rig.bones, rig.quats, g.mesh, name);
  await writeChar(name, r.mesh, r.skin, r, { base: g.base, normal: g.normal });
}

// ---- the clan robot: ten levels on one skeleton (Clips/ClubRobot, made in Mixamo on level 1) ----
// GLB Assets/Robot/robot-lvl-<n>.glb → robot-<n>.glb, and robot-clips.glb drives every level.

if (want('robot')) {
  const files = find(path.join(SRC, 'GLB Assets', 'Robot'), /^robot-lvl-\d+\.glb$/i);
  const own = clipsIn(path.join(SRC, 'Clips', 'ClubRobot'), new Set(maleRig.bones.map((b) => b.name)));
  if (files.length && own.rest) {
    console.log('robot');
    // the same as a boss's own skeleton: brought to the male's size, its hips to the middle
    const at = new Map(male.rest.map((b) => [b.name, b]));
    const span = (bones, ref) => bones.reduce((t, b) => t + (ref.has(b.name) && b.parent >= 0 ? b.pos.length() : 0), 0);
    const grow = span(male.rest, at) / span(own.rest, at);
    const standing = own.rest[0].pos.y * grow;
    for (const b of own.rest) b.pos.multiplyScalar(grow);
    if (standing > LIFT / 2) own.rest[0].pos.y -= LIFT;
    for (const c of Object.values(own.clips)) if (c.hips) c.hips.values = c.hips.values.map((v) => v * grow);
    console.log(`  its skeleton came ${grow.toFixed(2)} times too small: scaled up`);
    let rig = null;
    const lvl = (f) => Number(f.match(/(\d+)\.glb$/i)[1]);
    for (const file of files.sort((a, b) => lvl(a) - lvl(b))) {
      const g = await meshOfGlb(io, file);
      const r = bind(maleRig, own.rest, bindLike(own.rest), g.mesh, `robot-${lvl(file)}`);
      rig ||= r;
      await writeChar(`robot-${lvl(file)}`, r.mesh, r.skin, r, { base: g.base, normal: g.normal });
    }
    await writeClips('robot-clips', rig, own.clips);
  }
}

// ---- the mechanic ---------------------------------------------------------------------------

if (want('mechanic')) {
  console.log('mechanic');
  const mech = clipsIn(path.join(SRC, 'Clips', 'Mechanic'), new Set(maleRig.bones.map((b) => b.name)));
  const g = await meshOfGlb(io, path.join(SRC, 'GLB Assets', 'Mechanic', 'Mechanic.glb'));
  const rig = bind(maleRig, mech.rest, bindLike(mech.rest), g.mesh, 'mechanic');
  const has = new Set(mech.rest.map((b) => b.name));
  // what he has no clip for comes from the male's, on the joints he has
  for (const name of ['idle', 'walk']) if (!mech.clips[name]) { mech.clips[name] = { ...male.clips[name], quats: Object.fromEntries(Object.entries(male.clips[name].quats).filter(([b]) => has.has(b))) }; console.log(`  ${name}: the male's clip`); }
  await writeChar('mechanic', rig.mesh, rig.skin, rig, { base: g.base, normal: g.normal });
  // his three twins, the blues of his outfit turned red, green and orange (mechanic.glb is the blue one)
  for (const [tone, t] of Object.entries(MECH_TONES)) await writeChar(`mechanic-${tone}`, rig.mesh, rig.skin, rig, { base: await recolour(g.base, t), normal: g.normal });
  await writeClips('mechanic-clips', rig, mech.clips);
}
