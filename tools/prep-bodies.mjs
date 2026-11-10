// prep-bodies.mjs: the character bodies for the wardrobe (js/app/wardrobe3d.js), from their Meshy and
// Tripo exports in MOSKE APP/BASE MESH/MESHES.
//
//   npm install --no-save three@0.170.0 @gltf-transform/core@4.1.1 @gltf-transform/extensions@4.1.1 \
//     @gltf-transform/functions@4.1.1 meshoptimizer@0.22.0
//   node tools/prep-bodies.mjs "<path to BASE MESH/MESHES>"
//
// Writes models/bodies/<body>.glb. Every body comes out the same way:
// - 1.8 units tall, feet on y = 0, centred, one mesh, one material;
// - matte skin: roughness 0.8, no metal and no specular layer (the female export was shiny);
// - one shared light skin tone, so the bodies match (the exports came in three different tones);
// - a mask of what the wardrobe recolours, in the emissive slot with emissive strength 0 (so it never
//   lights anything; wardrobe3d.js reads it): red is skin, green the eyes' irises (painted grey here,
//   coloured in the app). Its own texture, not the base colour's alpha: one channel per mark blends
//   cleanly at seams and edges, where a three-level alpha would fake an iris;
// - 1024 px WebP textures and meshopt compression.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, dedup, prune, reorder, quantize, simplify } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

const SRC = process.argv[2];
const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(REPO, 'models', 'bodies');
const HEIGHT = 1.8;
const TEX = 1024;
// the shared skin tone, in Lab: a light, fair skin (about #EEC9B2)
const SKIN = { L: 83, a: 10.5, b: 15 };
// the iris is painted this grey, and the app tints it: a mid grey keeps the painted shading
const IRIS_L = 52;
// a body on a phone needs no more than this: the tracksuit came out of Meshy at 300,000
const MAX_TRIS = 40000;

const BODIES = {
  endurance: { glb: 'Endurance/Endurance Nude.glb' },
  hybrid: { fbx: 'Meshy_AI_Bald_Titan_Pose_1030210123_texture_fbx/Meshy_AI_Bald_Titan_Pose_1030210123_texture.fbx',
    tex: 'Meshy_AI_Bald_Titan_Pose_1030210123_texture_fbx/Meshy_AI_Bald_Titan_Pose_1030210123_texture.png',
    normal: 'Meshy_AI_Bald_Titan_Pose_1030210123_texture_fbx/Meshy_AI_Bald_Titan_Pose_1030210123_texture_normal.png' },
  female: { glb: 'Female.glb' },
  // the file name misleads: this tracksuit was made on the hybrid body (Titan_Pose), arms out
  'hybrid-tracksuit': { glb: 'Endurance/Endurance Tracksuit.glb' },
};

// ---- colour ------------------------------------------------------------------------------

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const f3 = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const fi = (t) => (t > 0.2069 ? t ** 3 : (t - 16 / 116) / 7.787);
function toLab(r, g, b) {
  const R = lin(r / 255), G = lin(g / 255), B = lin(b / 255);
  const x = f3((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505), y = f3(0.2126 * R + 0.7152 * G + 0.0722 * B), z = f3((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function fromLab(L, a, b) {
  const y = (L + 16) / 116, x = a / 500 + y, z = y - b / 200;
  const X = fi(x) * 0.9505, Y = fi(y), Z = fi(z) * 1.089;
  const c = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
  return c.map((v) => Math.round(Math.min(1, Math.max(0, gam(Math.max(0, v)))) * 255));
}

/** The convex hull of some (x, y) points, anticlockwise (Andrew's monotone chain). */
function hull(pts) {
  pts = pts.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const lo = [], hi = [];
  for (const p of pts) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.reverse()) { while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
const inHull = (h, x, y) => h.length > 2 && h.every((p, i) => { const q = h[(i + 1) % h.length]; return (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]) >= -0.5; });

/**
 * The base colour, re-toned and marked, worked out at the export's full size (the eyes are small)
 * and saved at TEX. Skin is whatever sits close to the picture's most common skin colour. An eye's
 * white is a small white patch with a dark pupil inside its outline; its iris is everything dark inside the patch's
 * outline (its convex hull), which leaves out the lids and lashes outside it. Lashes and irises are
 * the same brown, so colour alone can't tell them apart.
 */
async function skinTexture(png) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height, W = info.width, H = info.height;
  const lab = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) lab.set(toLab(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]), i * 3);
  // the reference skin: the median of the warm, mid-bright pixels
  const warm = [];
  for (let i = 0; i < n; i += 3) { const L = lab[i * 3], a = lab[i * 3 + 1], b = lab[i * 3 + 2]; if (L > 45 && L < 92 && a > 5 && b > 5 && a < 40 && b < 45) warm.push(i); }
  const med = (k) => { const v = warm.map((i) => lab[i * 3 + k]).sort((x, y) => x - y); return v[v.length >> 1]; };
  const ref = { L: med(0), a: med(1), b: med(2) };
  const kind = new Uint8Array(n); // 1 skin, 2 eye white, 3 iris
  for (let i = 0; i < n; i++) {
    const L = lab[i * 3], a = lab[i * 3 + 1], b = lab[i * 3 + 2];
    const dab = Math.hypot(a - ref.a, b - ref.b), chroma = Math.hypot(a, b);
    if (L < 4) continue;                                        // the unused black around the islands
    if (dab < 16 && L > ref.L - 30 && L < ref.L + 18) kind[i] = 1;   // darker is lashes and brows
    else if (L > 78 && chroma < 22) kind[i] = 2;
  }
  const seen = new Uint8Array(n);
  for (let s0 = 0; s0 < n; s0++) {
    if (kind[s0] !== 2 || seen[s0]) continue;
    const patch = [s0]; seen[s0] = 1;
    for (let k = 0; k < patch.length; k++) {
      const i = patch[k], x = i % W;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= n || (j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
        if (kind[j] !== 2) continue;
        if (!seen[j]) { seen[j] = 1; patch.push(j); }
      }
    }
    // a white bigger than an eye's is clothing
    let eye = patch.length >= 20 && patch.length <= 2000;
    const h = eye ? hull(patch.map((i) => [i % W, (i / W) | 0])) : [];
    const box = h.reduce((m, [x, y]) => [Math.min(m[0], x), Math.min(m[1], y), Math.max(m[2], x), Math.max(m[3], y)], [W, H, 0, 0]);
    const inside = [];
    if (eye) for (let y = box[1]; y <= box[3]; y++) for (let x = box[0]; x <= box[2]; x++) {
      const i = y * W + x;
      // inside an eye nothing is skin: the female's brown iris is close to her skin's colour, only darker
      if (kind[i] !== 2 && lab[i * 3] < 75 && (kind[i] !== 1 || lab[i * 3] < ref.L - 10) && inHull(h, x, y)) inside.push(i);
    }
    // an eye has a dark pupil in it
    // a pupil is dark but not the texture's empty padding: white seams along an island's edge have padding inside
    eye = eye && !inside.some((i) => lab[i * 3] < 4) && inside.filter((i) => lab[i * 3] < 30).length >= 4;
    // and sits in a face: skin all round it (white and dark on a sleeve's print has cloth round it)
    const bw = box[2] - box[0] + 1, bh = box[3] - box[1] + 1;
    const near = [Math.max(0, box[0] - bw), Math.max(0, box[1] - bh), Math.min(W - 1, box[2] + bw), Math.min(H - 1, box[3] + bh)];
    if (eye) {
      let skin = 0, all = 0;
      for (let y = near[1]; y <= near[3]; y++) for (let x = near[0]; x <= near[2]; x++) { all++; if (kind[y * W + x] === 1) skin++; }
      // and the painted irises are all brown or grey: a strong blue inside is the tracksuit's print
      const blue = inside.filter((i) => lab[i * 3 + 2] < -15).length;
      // and an eye shows more white than dark: a big dark hole with a fleck of white is a mouth or a fold
      eye = skin / all >= 0.25 && blue < inside.length * 0.3 && inside.length < patch.length * 1.5;
    }
    if (!eye) { for (const i of patch) kind[i] = 0; continue; }
    for (const i of inside) kind[i] = 3;
    // the iris often reaches past the white's outline (the white shows on its sides only): grow it
    // through the iris-dark pixels round it, but not into the near-black lashes or the skin
    // no further from the pupil than an iris's width (the white's height), so it stops before the lids
    const pupil = inside.filter((i) => lab[i * 3] < 30);
    const px = pupil.reduce((t, i) => t + (i % W), 0) / pupil.length, py = pupil.reduce((t, i) => t + ((i / W) | 0), 0) / pupil.length;
    const reach = Math.max(3, Math.max(bw, bh) * 0.5);
    const grow = [...inside];
    for (let k = 0; k < grow.length; k++) {
      const i = grow[k], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H || Math.hypot(nx - px, ny - py) > reach) continue;
        const L = lab[j * 3];
        if (kind[j] === 0 && L > 18 && L < 62) { kind[j] = 3; grow.push(j); }
      }
    }
  }
  const out = Buffer.alloc(n * 3), mask = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) {
    let [r, g, b] = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
    const L = lab[i * 3], a = lab[i * 3 + 1], bb = lab[i * 3 + 2];
    if (kind[i] === 1) [r, g, b] = fromLab(SKIN.L + (L - ref.L) * 0.9, SKIN.a + (a - ref.a) * 0.35, SKIN.b + (bb - ref.b) * 0.35);
    else if (kind[i] === 3) [r, g, b] = fromLab(Math.max(4, IRIS_L + (L - 45) * 0.8), 0, 0);
    out.set([r, g, b], i * 3);
    // the unused padding counts as skin, so a seam never blends skin with nothing
    mask.set([kind[i] === 1 || L < 4 ? 255 : 0, kind[i] === 3 ? 255 : 0, 0], i * 3);
  }
  const counts = [0, 0, 0, 0]; for (const k of kind) counts[k]++;
  const raw = { raw: { width: W, height: H, channels: 3 } };
  return {
    png: await sharp(out, raw).resize(TEX, TEX, { kernel: 'mitchell' }).png().toBuffer(),
    mask: await sharp(mask, raw).resize(TEX, TEX, { kernel: 'mitchell' }).png().toBuffer(),
    ref, counts,
  };
}

// ---- geometry ----------------------------------------------------------------------------

async function fromFbx(file) {
  globalThis.self = globalThis;
  globalThis.window = { URL: { createObjectURL: () => 'blob:none' } };
  globalThis.document = { createElementNS: () => ({ style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {} }) };
  const THREE = await import('three');
  const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
  const { mergeVertices } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
  const buf = fs.readFileSync(file);
  const silence = console.warn; console.warn = () => {};
  const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  console.warn = silence;
  obj.updateMatrixWorld(true);
  let geo = null;
  obj.traverse((o) => { if (o.isMesh && !geo) { geo = o.geometry.clone().applyMatrix4(o.matrixWorld); } });
  geo.deleteAttribute('normal');
  geo = mergeVertices(geo, 1e-6);
  geo.computeVertexNormals();
  return { pos: geo.attributes.position.array, uv: geo.attributes.uv.array, nrm: geo.attributes.normal.array, idx: Uint32Array.from(geo.index.array) };
}

function fromGlb(doc) {
  // one mesh with one primitive in all three exports; its node's transform is baked in
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
  return { pos, uv: prim.getAttribute('TEXCOORD_0').getArray(), nrm, idx, mat: prim.getMaterial() };
}

/** Feet on the floor, centred, 1.8 tall. */
function normalise(pos) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pos[i + k]); hi[k] = Math.max(hi[k], pos[i + k]); }
  const s = HEIGHT / (hi[1] - lo[1]), cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
  for (let i = 0; i < pos.length; i += 3) { pos[i] = (pos[i] - cx) * s; pos[i + 1] = (pos[i + 1] - lo[1]) * s; pos[i + 2] = (pos[i + 2] - cz) * s; }
  return { width: +((hi[0] - lo[0]) * s).toFixed(3), depth: +((hi[2] - lo[2]) * s).toFixed(3) };
}

const texBytes = async (t) => Buffer.from(t.getImage());

async function build(name, cfg, io) {
  let g, basePng, normalPng;
  if (cfg.fbx) {
    g = await fromFbx(path.join(SRC, cfg.fbx));
    basePng = fs.readFileSync(path.join(SRC, cfg.tex)); normalPng = fs.readFileSync(path.join(SRC, cfg.normal));
  } else {
    const src = await io.read(path.join(SRC, cfg.glb));
    g = fromGlb(src);
    basePng = await texBytes(g.mat.getBaseColorTexture()); normalPng = g.mat.getNormalTexture() ? await texBytes(g.mat.getNormalTexture()) : null;
  }
  const size = normalise(g.pos);
  const skin = await skinTexture(basePng);
  const doc = new Document();
  const buffer = doc.createBuffer();
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
  const mat = doc.createMaterial(name).setRoughnessFactor(0.8).setMetallicFactor(0).setDoubleSided(true)
    .setBaseColorTexture(doc.createTexture('base').setMimeType('image/webp').setImage(await sharp(skin.png).webp({ quality: 86 }).toBuffer()))
    .setEmissiveTexture(doc.createTexture('mask').setMimeType('image/webp').setImage(await sharp(skin.mask).webp({ quality: 90 }).toBuffer()))
    .setEmissiveFactor([0, 0, 0]);
  if (normalPng) mat.setNormalTexture(doc.createTexture('normal').setMimeType('image/webp').setImage(await sharp(normalPng).resize(TEX, TEX).webp({ quality: 88 }).toBuffer()));
  const prim = doc.createPrimitive().setMaterial(mat)
    .setAttribute('POSITION', acc('VEC3', g.pos)).setAttribute('NORMAL', acc('VEC3', Float32Array.from(g.nrm)))
    .setAttribute('TEXCOORD_0', acc('VEC2', Float32Array.from(g.uv))).setIndices(acc('SCALAR', g.idx));
  const scene = doc.createScene();
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
  doc.getRoot().setDefaultScene(scene);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const tris = g.idx.length / 3;
  const steps = [weld(), dedup()];
  if (tris > MAX_TRIS) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: MAX_TRIS / tris, error: 0.002 }));
  await doc.transform(...steps, prune(), reorder({ encoder: MeshoptEncoder }), quantize());
  const file = path.join(OUT, `${name}.glb`);
  await io.write(file, doc);
  const left = doc.getRoot().listMeshes()[0].listPrimitives()[0].getIndices().getCount() / 3;
  console.log(name, `${(fs.statSync(file).size / 1024).toFixed(0)} KB`, `${left} tris`, size,
    'skin ref', Object.fromEntries(Object.entries(skin.ref).map(([k, v]) => [k, +v.toFixed(1)])), 'skin/white/iris px', skin.counts.slice(1));
  fs.writeFileSync(path.join(OUT, `${name}-base.png`), skin.png);   // to check by eye; not shipped
  fs.writeFileSync(path.join(OUT, `${name}-mask.png`), skin.mask);
}

await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
fs.mkdirSync(OUT, { recursive: true });
for (const [name, cfg] of Object.entries(BODIES)) await build(name, cfg, io);
