// Downscale pixel-art PNGs to web size with nearest-neighbour (never smooth)
// and write a palette PNG. Pixel art quantises extremely well.
//   node tools/optimize-pixelart.mjs                      every PNG under icons/Pixelart, long edge 512
//   node tools/optimize-pixelart.mjs path/a.png dir/ ...  only these files / folders
//   node tools/optimize-pixelart.mjs --max=96 icons/trainer   trainer frames at 96px
// Generate art large (e.g. 1024 or 2048) on a clean pixel grid; this brings it
// down to the app's size without blurring the pixels.
import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const MAX = Number(args.find((a) => a.startsWith('--max='))?.slice(6)) || 512;
const targets = args.filter((a) => !a.startsWith('--'));
const ROOTS = targets.length ? targets : ['icons/Pixelart'];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const pngs = ROOTS.flatMap((r) => (statSync(r).isDirectory() ? walk(r) : [r]))
  .filter((f) => f.toLowerCase().endsWith('.png'));
let before = 0, after = 0;
for (const f of pngs) {
  before += statSync(f).size;
  const buf = await sharp(f)
    .resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true, kernel: 'nearest' })
    .png({ palette: true, quality: 90, effort: 10 })
    .toBuffer();
  const { writeFileSync } = await import('node:fs');
  writeFileSync(f, buf);
  after += statSync(f).size;
  console.log(`${f}  →  ${(buf.length / 1024).toFixed(0)} KB`);
}
console.log(`\nTOTAL  ${(before / 1048576).toFixed(1)} MB  →  ${(after / 1048576).toFixed(2)} MB  (${pngs.length} files)`);
