// build-items.mjs: the base's items as 3D models (js/app/base-gl.js, docs/THREE-ROOM.md stage 5),
// from the Tripo GLBs the item pictures were rendered from (art/items/glb, tools/render-items).
//
//   npm install --no-save @gltf-transform/core@4.1.1 @gltf-transform/extensions@4.1.1 \
//     @gltf-transform/functions@4.1.1 meshoptimizer@0.22.0 sharp
//   node tools/build-items.mjs [name ...]
//
// Each model is named like its picture without the facing (treadmill-t2: icons/Items/treadmill-t2-a.webp).
// It's turned as its picture was for facing a (tools/render-items/render-batch2.py), sized in metres
// as there, stood on y = 0 and centred on x and z, cut to a light game copy and given one WebP
// texture. The app sizes it to its picture on screen and turns it 90° for facing b.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, dedup, prune, reorder, quantize, simplify, getBounds, transformPrimitive } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

const ONLY = process.argv.slice(2);
const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(REPO, 'art', 'items', 'glb');
const OUT = path.join(REPO, 'models', 'items');
const TEX = 1024;
const MAX_TRIS = 14000;

/**
 * name: [source model, size in metres, measured along ('up': height, 'z': depth, 'across': the
 * longest side), turn round the up axis for facing a, in degrees]: as render.py and render-batch2.py.
 */
export const ITEMS = {
  'coffee-machine-t1': ['coffee-machine-t1', 1.45, 'up', 0],
  'coffee-machine-t2': ['coffee-machine-t2', 1.45, 'up', 0],
  'coffee-machine-t3': ['coffee-machine-t3', 1.45, 'up', 0],
  'treadmill-t1': ['treadmill-t1', 1.9, 'across', 270],
  'treadmill-t2': ['treadmill-t2', 1.9, 'across', 270],
  'treadmill-t3': ['treadmill-t3', 1.9, 'across', 270],
  'road-bike-stand': ['bike-stand-pedestal', 2.0, 'z', 0],
  'trophy-gold-mountain': ['gold-mountain-trophy', 1.0, 'up', 0],
  'lockers-t1': ['blue-locker-base', 1.9, 'up', 0],
  'drinks-fridge': ['blue-mini-fridge', 0.9, 'up', 0],
  'dumbbell-rack': ['dumbbell-rack-3d-model', 0.9, 'up', 0],
  'ice-bath': ['ice-tub-barrel', 1.0, 'up', 0],
  'kettlebell-set': ['kettlebell-base', 0.6, 'up', 0],
  'massage-table': ['massage-table', 0.95, 'up', 0],
  'bike-workstand': ['mechanic-bike-stand', 1.6, 'up', 0],
  'race-podium': ['podium-moske', 0.9, 'up', 0],
  'punching-bag': ['punching-bag', 2.0, 'up', 0],
  'rowing-machine': ['rowing-machine-base', 2.2, 'across', 0],
  'shoe-rack': ['shoe-stand', 1.3, 'up', 0],
  'trophy-cabinet-t1': ['trophy-cabinet-navy-small', 1.5, 'up', 0],
  'trophy-cabinet-t2': ['trophy-cabinet-medium-blue-and-white', 1.9, 'up', 0],
};

await MeshoptDecoder.ready; await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// glTF is y-up; Blender's turn round its z is the same turn round glTF's y
const yawMatrix = (deg) => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];   // column-major, a turn round +Y
};
const moveMatrix = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const scaleMatrix = (k) => [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, 0, 0, 0, 1];

const prims = (doc) => doc.getRoot().listNodes().filter((n) => n.getName() === doc.__id).flatMap((n) => n.getMesh()?.listPrimitives() || []);
const bounds = (doc) => getBounds(doc.getRoot().listScenes()[0]);
const turnAll = (doc, m) => { for (const p of prims(doc)) transformPrimitive(p, m); };

async function build(name, [file, size, along, yaw]) {
  const doc = await io.read(path.join(SRC, `${file}.glb`));
  doc.__id = name;
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  const root = doc.getRoot();
  // one node, its meshes in its own space: every node's transform baked into its mesh
  const scene = root.listScenes()[0];
  const keep = doc.createNode(name);
  scene.traverse((node) => {
    const mesh = node.getMesh(); if (!mesh) return;
    const world = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) transformPrimitive(p, world);
    node.setMesh(null); keep.setMesh(keep.getMesh() || doc.createMesh(name));
    for (const p of mesh.listPrimitives()) { mesh.removePrimitive(p); keep.getMesh().addPrimitive(p); }
  });
  for (const n of scene.listChildren()) scene.removeChild(n);
  scene.addChild(keep);

  // sized as its picture was (before turning, as render.py measures it), then turned for facing a
  let b = bounds(doc);
  const ext = b.max.map((v, i) => v - b.min[i]);
  turnAll(doc, scaleMatrix(size / (along === 'up' ? ext[1] : along === 'z' ? ext[2] : Math.max(ext[0], ext[2]))));
  if (yaw) turnAll(doc, yawMatrix(yaw));
  b = bounds(doc);
  turnAll(doc, moveMatrix(-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2));

  // the colour texture only (the lights in the base shade it), smaller
  for (const p of prims(doc)) {
    const m = p.getMaterial(); if (!m) continue;
    const base = m.getBaseColorTexture();
    m.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null)
      .setMetallicFactor(0).setRoughnessFactor(0.7).setDoubleSided(false);
    if (base) base.setImage(await sharp(Buffer.from(base.getImage())).resize(TEX, TEX, { kernel: 'mitchell', fit: 'fill' }).webp({ quality: 86 }).toBuffer()).setMimeType('image/webp');
  }
  await doc.transform(prune(), dedup(), weld());
  let tris = 0; for (const p of prims(doc)) tris += p.getIndices().getCount() / 3;
  if (tris > MAX_TRIS) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: MAX_TRIS / tris, error: 0.002 }));
  tris = 0; for (const p of prims(doc)) tris += p.getIndices().getCount() / 3;

  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await doc.transform(prune(), reorder({ encoder: MeshoptEncoder }), quantize({ quantizePosition: 14 }));
  for (const e of root.listExtensionsUsed()) if (!['EXT_meshopt_compression', 'KHR_mesh_quantization', 'EXT_texture_webp'].includes(e.extensionName)) e.dispose();
  const out = path.join(OUT, `${name}.glb`);
  await io.write(out, doc);
  const s = bounds(doc);
  console.log(`  ${name.padEnd(22)} ${(fs.statSync(out).size / 1024).toFixed(0).padStart(4)} KB ${String(Math.round(tris)).padStart(6)} tris  size ${s.max.map((v, i) => (v - s.min[i]).toFixed(2)).join(' ')}`);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [name, spec] of Object.entries(ITEMS)) if (!ONLY.length || ONLY.includes(name)) await build(name, spec);
