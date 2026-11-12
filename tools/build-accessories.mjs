// build-accessories.mjs: hair, hats, helmets, glasses and shoes for the characters (js/app/gear3d.js),
// from the Tripo GLBs in MOSKE APP/Items/z_GLB MODELS. See docs/CHARACTERS.md, "Accessories".
//
//   npm install --no-save @gltf-transform/core@4.1.1 @gltf-transform/extensions@4.1.1 \
//     @gltf-transform/functions@4.1.1 meshoptimizer@0.22.0 sharp
//   node tools/build-accessories.mjs "<path to z_GLB MODELS>" [id ...]
//
// Each model is turned to face +Z (the characters do), stood on y = 0 and centred on x and z, cut
// to a few thousand triangles, and given one 512 px WebP texture. A shoe comes as one shoe: it is
// laid along Z with its toe at +Z (the heel is the taller end). The size and place on the body are
// worked out in the app, from the head or the foot of whichever character wears it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, dedup, prune, reorder, quantize, simplify, getBounds, transformPrimitive } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

const SRC = process.argv[2];
const ONLY = process.argv.slice(3);
const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(REPO, 'models', 'gear');
const TEX = 512;
const MAX_TRIS = 6000;

/**
 * The items: the app's id, the source file, and how far to turn it round Y (degrees) so its front
 * faces +Z. Shoes are turned automatically.
 */
export const ITEMS = [
  { id: 'hair-braids', file: 'hair/female/hairfemale1.glb', yaw: -90 },
  { id: 'hair-bun-low', file: 'hair/female/hairfemale3.glb', yaw: -90 },
  { id: 'hair-long', file: 'hair/female/hairfemale5.glb', yaw: -90 },
  { id: 'hair-curls', file: 'hair/male/hairmale1.glb', yaw: -90 },
  { id: 'hair-crop', file: 'hair/male/hairmale2.glb', yaw: -90 },
  { id: 'hat-beanie', file: 'hats/tripo_convert_20c57b6e-b332-4ac1-92ff-e98d5d427b6e.glb', yaw: 0 },
  { id: 'hat-cap-white', file: 'hats/tripo_convert_377ab5d5-7a2a-4855-be0d-e5790217afa7.glb', yaw: -90 },
  { id: 'hat-bucket', file: 'hats/tripo_convert_6877eb40-d64e-496f-9155-7f9ca54b9036.glb', yaw: 0 },
  { id: 'hat-visor', file: 'hats/tripo_convert_a43cdfeb-c804-4bc6-a163-07428f753de5.glb', yaw: 0 },
  { id: 'hat-gold', file: 'hats/tripo_convert_daa99e5d-a50d-4d4d-817a-c841728b6a05.glb', yaw: 0 },
  { id: 'helmet-gold', file: 'helmets/tripo_convert_25886998-78be-438b-8ae2-c46106a558cb.glb', yaw: -90 },
  { id: 'hat-cap-navy', file: 'helmets/tripo_convert_3187e585-09e7-484a-8b09-70f4d00a485b.glb', yaw: -90 },
  { id: 'helmet-aero', file: 'helmets/tripo_convert_3c8b5f6a-4405-4437-a14a-3a0a9ed7ada3.glb', yaw: -90 },
  { id: 'helmet-road', file: 'helmets/tripo_convert_d3f6363e-5f0c-42c1-803d-723468c80f69.glb', yaw: -90 },
  { id: 'helmet-blue', file: 'helmets/tripo_convert_ebd2bd19-a65e-4955-a8aa-071261acb927.glb', yaw: -90 },
  { id: 'glasses-sport', file: 'glasses/sunglasses 3d model.glb', yaw: 0 },
  { id: 'glasses-blue', file: 'glasses/tripo_convert_858c923c-bdb3-41a0-accd-48d251898413.glb', yaw: 0 },
  { id: 'glasses-gold', file: 'glasses/tripo_convert_8a29552d-d1a2-4888-a338-62ef8c003163.glb', yaw: -90 },
  { id: 'glasses-casual', file: 'glasses/tripo_convert_8b32618a-9704-499e-a070-f663b4584970.glb', yaw: -90 },
  { id: 'shoe-runner', file: 'Shoes/tripo_convert_03c68283-d813-4ca9-a768-990534051a4c.glb', shoe: true },
  { id: 'shoe-lifter', file: 'Shoes/tripo_convert_6e0ed79b-f2a5-43bb-a116-28b375a1754c.glb', shoe: true },
  { id: 'shoe-trainer', file: 'Shoes/tripo_convert_7bd71d9f-7224-45c5-b78a-bf3778b2e964.glb', shoe: true },
  { id: 'shoe-trail', file: 'Shoes/tripo_convert_82617d16-bb57-4d02-809b-63abc61a7f68.glb', shoe: true },
  { id: 'shoe-cycling', file: 'Shoes/tripo_convert_af215489-1b45-41c0-80cf-e5407a128490.glb', shoe: true },
  { id: 'shoe-starter', file: 'Shoes/tripo_convert_b8ed89d8-dc35-4729-a661-30dbe20b1933.glb', shoe: true },
  { id: 'shoe-gold', file: 'Shoes/tripo_convert_f45ec966-daa4-43af-8453-73d838e1735e.glb', shoe: true },
  { id: 'shoe-racer', file: 'Shoes/tripo_convert_f769abe2-311f-461e-b7fe-356c75054bca.glb', shoe: true },
];

await MeshoptDecoder.ready; await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const yawMatrix = (deg) => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];   // column-major, a turn round +Y
};
const moveMatrix = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];

// the one mesh the model ends up as (its primitives were moved there from the source's meshes)
const prims = (doc) => doc.getRoot().listNodes().filter((n) => n.getName() === doc.__id).flatMap((n) => n.getMesh()?.listPrimitives() || []);
const bounds = (doc) => getBounds(doc.getRoot().listScenes()[0]);
const turnAll = (doc, m) => { for (const p of prims(doc)) transformPrimitive(p, m); };

/** The highest point near each end of the shoe along Z: the heel is the taller end. */
function shoeEnds(doc) {
  const b = bounds(doc); const len = b.max[2] - b.min[2];
  let front = -Infinity, back = -Infinity;
  for (const p of prims(doc)) {
    const pos = p.getAttribute('POSITION'); const v = [];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      const t = (v[2] - b.min[2]) / len;
      if (t > 0.8) front = Math.max(front, v[1]); else if (t < 0.2) back = Math.max(back, v[1]);
    }
  }
  return { front, back };
}

async function build(item) {
  const doc = await io.read(path.join(SRC, item.file));
  doc.__id = item.id;
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  const root = doc.getRoot();
  // one node, its meshes in its own space: every node's transform baked into its mesh
  const scene = root.listScenes()[0];
  const keep = doc.createNode(item.id);
  scene.traverse((node) => {
    const mesh = node.getMesh(); if (!mesh) return;
    const world = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) transformPrimitive(p, world);
    node.setMesh(null); keep.setMesh(keep.getMesh() || doc.createMesh(item.id));
    for (const p of mesh.listPrimitives()) { mesh.removePrimitive(p); keep.getMesh().addPrimitive(p); }
  });
  for (const n of scene.listChildren()) scene.removeChild(n);
  scene.addChild(keep);

  if (item.shoe) {
    const b = bounds(doc);
    if (b.max[0] - b.min[0] > b.max[2] - b.min[2]) turnAll(doc, yawMatrix(90));
    const { front, back } = shoeEnds(doc);
    if (front > back) turnAll(doc, yawMatrix(180));   // the heel's at the front: turn it round
  } else if (item.yaw) turnAll(doc, yawMatrix(item.yaw));
  const b = bounds(doc);
  turnAll(doc, moveMatrix(-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2));

  // one plain material: the colour texture only, at 512 px
  for (const p of prims(doc)) {
    const m = p.getMaterial(); if (!m) continue;
    const base = m.getBaseColorTexture();
    m.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null)
      .setMetallicFactor(0).setRoughnessFactor(0.75).setDoubleSided(false);
    if (base) base.setImage(await sharp(Buffer.from(base.getImage())).resize(TEX, TEX, { kernel: 'mitchell', fit: 'fill' }).webp({ quality: 84 }).toBuffer()).setMimeType('image/webp');
  }
  await doc.transform(prune(), dedup(), weld());
  let tris = 0; for (const p of prims(doc)) tris += p.getIndices().getCount() / 3;
  if (tris > MAX_TRIS) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: MAX_TRIS / tris, error: 0.004 }));
  tris = 0; for (const p of prims(doc)) tris += p.getIndices().getCount() / 3;

  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await doc.transform(prune(), reorder({ encoder: MeshoptEncoder }), quantize({ quantizePosition: 14 }));
  for (const ext of root.listExtensionsUsed()) if (!['EXT_meshopt_compression', 'KHR_mesh_quantization', 'EXT_texture_webp'].includes(ext.extensionName)) ext.dispose();
  const file = path.join(OUT, `${item.id}.glb`);
  await io.write(file, doc);
  const s = bounds(doc);
  console.log(`  ${item.id.padEnd(16)} ${(fs.statSync(file).size / 1024).toFixed(0).padStart(4)} KB ${String(Math.round(tris)).padStart(5)} tris  size ${s.max.map((v, i) => (v - s.min[i]).toFixed(2)).join(' ')}`);
}

if (!SRC || !fs.existsSync(SRC)) { console.error('usage: node tools/build-accessories.mjs "<z_GLB MODELS>" [id ...]'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
for (const item of ITEMS) if (!ONLY.length || ONLY.includes(item.id)) await build(item);
