// One-off: downscale Pixelart PNGs to web size. Pixel art quantises extremely
// well, so we cap the long edge at 512px and write a palette PNG. Run: node tools/optimize-pixelart.mjs
import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'icons/Pixelart';
const MAX = 512;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const pngs = walk(ROOT).filter((f) => f.toLowerCase().endsWith('.png'));
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
