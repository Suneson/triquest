// decode-glb.mjs: Tripo's GLBs are meshopt-compressed, which Blender can't read: this writes plain
// copies (tools/render-items/README.md, step 2), every GLB in <in dir> to <out dir>.
//   node tools/decode-glb.mjs "<in dir>" "<out dir>"
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const [IN, OUT] = process.argv.slice(2);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(IN).filter((n) => n.toLowerCase().endsWith('.glb'))) {
  const out = path.join(OUT, f);
  if (fs.existsSync(out)) continue;
  const doc = await io.read(path.join(IN, f));
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'EXT_meshopt_compression') e.dispose();
  await io.write(out, doc);
  console.log('  ', f);
}
