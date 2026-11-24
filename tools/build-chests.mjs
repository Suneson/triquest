// build-chests.mjs: the reward chests as light game models (js/app/chest3d.js), from their Tripo GLBs
// (MOSKE APP/Island/tripo-chests/<n>-<tier>.glb, image to 3D from the chests' stills).
//
//   node tools/build-chests.mjs [tier ...]      (deps: see tools/build-items.mjs)
//
// Each is one mesh, one unit tall, stood on y = 0 and centred on x and z, its colour texture cut to 1024 WebP
// and its metal/roughness kept (the gold trim shines), compressed with meshopt. The open parts (box + lid, or the
// open bag) are fitted to the shut chest in chest3d.js; tools/chest-lab.html shows them all.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, dedup, prune, reorder, quantize, simplify, getBounds, transformPrimitive } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(REPO, '..', 'MOSKE APP', 'Island', 'tripo-chests');
const OUT = path.join(REPO, 'models', 'chests');
const TIERS = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];
const ONLY = process.argv.slice(2);
const TEX = 1024;
const MAX_TRIS = 16000;

await MeshoptDecoder.ready; await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const prims = (doc) => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
const move = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const scale = (k) => [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, 0, 0, 0, 1];
const webp = async (tex, q = 84) => tex && tex.setImage(await sharp(Buffer.from(tex.getImage())).resize(TEX, TEX, { fit: 'fill' }).webp({ quality: q }).toBuffer()).setMimeType('image/webp');

// each chest's parts: the shut one taps, the open ones take over under the flash (chest3d.js)
const PARTS = { common: ['', 'open'], uncommon: ['', 'box', 'lid'], rare: ['', 'open'], legendary: ['', 'box', 'lid'], mythic: ['', 'box', 'lid'] };

async function build(tier, i, part) {
  const suffix = part ? `-${part}` : '';
  const file = path.join(SRC, `${i + 1}-${tier}${suffix}.glb`);
  const doc = await io.read(file);
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  const scene = doc.getRoot().listScenes()[0];
  // every node's transform into its mesh, so the model sits in its own space
  scene.traverse((n) => { if (n.getMesh()) for (const p of n.getMesh().listPrimitives()) transformPrimitive(p, n.getWorldMatrix()); n.setMatrix(move(0, 0, 0)); });
  let b = getBounds(scene);
  for (const p of prims(doc)) transformPrimitive(p, scale(1 / (b.max[1] - b.min[1])));
  b = getBounds(scene);
  for (const p of prims(doc)) transformPrimitive(p, move(-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2));
  for (const p of prims(doc)) {
    const m = p.getMaterial(); if (!m) continue;
    m.setNormalTexture(null).setOcclusionTexture(null).setEmissiveTexture(null).setDoubleSided(true);
    await webp(m.getBaseColorTexture(), 86);
    await webp(m.getMetallicRoughnessTexture(), 80);
  }
  await doc.transform(prune(), dedup(), weld());
  let tris = 0; for (const p of prims(doc)) tris += p.getIndices().getCount() / 3;
  if (tris > MAX_TRIS) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: MAX_TRIS / tris, error: 0.001 }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await doc.transform(prune(), reorder({ encoder: MeshoptEncoder }), quantize({ quantizePosition: 14 }));
  for (const e of doc.getRoot().listExtensionsUsed()) if (!['EXT_meshopt_compression', 'KHR_mesh_quantization', 'EXT_texture_webp'].includes(e.extensionName)) e.dispose();
  const out = path.join(OUT, `${tier}${suffix}.glb`);
  await io.write(out, doc);
  tris = 0; for (const p of prims(doc)) tris += p.getIndices().getCount() / 3;
  const s = getBounds(doc.getRoot().listScenes()[0]);
  console.log(`  ${(tier + suffix).padEnd(16)} ${(fs.statSync(out).size / 1024).toFixed(0).padStart(5)} KB ${String(tris).padStart(6)} tris  size ${s.max.map((v, k) => (v - s.min[k]).toFixed(2)).join(' ')}`);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [i, tier] of TIERS.entries()) if (!ONLY.length || ONLY.includes(tier)) for (const part of PARTS[tier]) await build(tier, i, part);
