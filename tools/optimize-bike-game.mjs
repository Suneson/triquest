// One-off: shrink the BIKE "game" assets for web. Platforms/background are static
// PNGs (palette + alpha); characters are ANIMATED webp (resized with animation kept).
// Each layer keeps its own aspect ratio (fit:inside), so the stacked layers stay aligned.
// Run: node tools/optimize-bike-game.mjs
import sharp from 'sharp';
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BIKE = 'icons/Pixelart/BIKE';

// Read source into a Buffer first so libvips never keeps the file mmap'd while we
// overwrite the same path (avoids Windows sharing-violation on write). Skip files
// already shrunk below `skipUnder` so re-runs are cheap and idempotent.
async function pngs(dir, max, skipUnder = 300 * 1024) {
  for (const name of readdirSync(dir)) {
    if (!name.toLowerCase().endsWith('.png')) continue;
    const f = join(dir, name);
    const before = statSync(f).size;
    if (before < skipUnder) { console.log(`${name}  skip (${(before / 1024).toFixed(0)}KB)`); continue; }
    const buf = await sharp(readFileSync(f))
      .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
      .png({ palette: true, quality: 90, effort: 10 })
      .toBuffer();
    writeFileSync(f, buf);
    console.log(`${name}  ${(before / 1048576).toFixed(1)}MB -> ${(buf.length / 1024).toFixed(0)}KB`);
  }
}

async function webps(dir, max, skipUnder = 1024 * 1024) {
  for (const name of readdirSync(dir)) {
    if (!name.toLowerCase().endsWith('.webp')) continue;
    const f = join(dir, name);
    const before = statSync(f).size;
    if (before < skipUnder) { console.log(`${name}  skip (${(before / 1024).toFixed(0)}KB)`); continue; }
    const buf = await sharp(readFileSync(f), { animated: true })
      .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72, effort: 5 })
      .toBuffer();
    writeFileSync(f, buf);
    console.log(`${name}  ${(before / 1048576).toFixed(1)}MB -> ${(buf.length / 1024).toFixed(0)}KB`);
  }
}

await pngs(join(BIKE, 'BACKGROUND'), 1024);
await pngs(join(BIKE, 'PLATFORMS'), 1024);
await webps(join(BIKE, 'CHARACTERS'), 768);
console.log('done');
