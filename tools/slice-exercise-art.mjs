// slice-exercise-art.mjs — cut exercise sheets into one picture per exercise.
// Build-time only (sharp is a dev dependency; the app never loads it).
//
// A sheet is a grid of exercise cards on a near-uniform cream background: the
// figure with its working muscles highlighted, and the exercise name and
// muscle group printed underneath. For each cell this:
//   1. crops the cell (with a small inset so card edges don't count),
//   2. finds the figure: pixels that differ from the cream, grouped into bands
//      of rows; the tallest band is the figure, shorter ones below it are the
//      printed labels, which are dropped (the app prints its own),
//   3. pads the figure's bounding box to a square with a margin,
//   4. quantises to a small palette (clears JPEG noise) and scales to
//      256×256 with nearest-neighbour, so the pixel art stays hard-edged.
// Output: icons/Pixelart/EXERCISES/<id>.png, plus a contact sheet of every
// crop at docs/gym/art-check.png to check them all at a glance.
//
// Usage:
//   node tools/slice-exercise-art.mjs                    every sheet in docs/gym/sheets.json
//   node tools/slice-exercise-art.mjs <sheet> <cols>x<rows> id1,id2,...   one sheet, ids in reading order
// Options: --size=256  --colors=24  --margin=0.08  --out=icons/Pixelart/EXERCISES  --manifest=docs/gym/sheets.json
// An id of "-" skips that cell.
//
// sheets.json: [{ "file": "docs/gym/sheets/sheet-1.jpg", "grid": "3x3", "ids": ["back-squat", ...] }, ...]

import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const SIZE = Number(opt('size', 256));
const COLORS = Number(opt('colors', 24));
const MARGIN = Number(opt('margin', 0.08));
const OUT = opt('out', 'icons/Pixelart/EXERCISES');
const CONTACT = opt('contact', 'docs/gym/art-check.png');
const positional = args.filter((a) => !a.startsWith('--'));

function sheetsToRun() {
  if (positional.length >= 3) {
    return [{ file: positional[0], grid: positional[1], ids: positional[2].split(',').map((s) => s.trim()) }];
  }
  const manifest = opt('manifest', 'docs/gym/sheets.json');
  if (!existsSync(manifest)) throw new Error(`No sheet given and no ${manifest}. See the usage at the top of this file.`);
  return JSON.parse(readFileSync(manifest, 'utf8'));
}

const dist = (r1, g1, b1, r2, g2, b2) => Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);

/** The card's cream: the most common colour in the cell (sampled, 4-level buckets). */
function cardColour(px, w, h, ch) {
  const buckets = new Map();
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < w; x += 3) {
      const i = (y * w + x) * ch;
      const k = ((px[i] >> 2) << 12) | ((px[i + 1] >> 2) << 6) | (px[i + 2] >> 2);
      const b = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 };
      b.n++; b.r += px[i]; b.g += px[i + 1]; b.b += px[i + 2];
      buckets.set(k, b);
    }
  }
  let best = null;
  for (const b of buckets.values()) if (!best || b.n > best.n) best = b;
  return [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)];
}

/**
 * Find the figure in one cell: { left, top, width, height } or null.
 * Rows with foreground pixels form bands separated by empty gaps; the tallest
 * band is the figure, the short ones under it are printed text.
 */
export function findFigure(px, w, h, ch, bg, { threshold = 60, minPixels = 2 } = {}) {
  // Ink is anything dark or saturated. The cream card, the page around it and
  // the card's soft shadow are all light and nearly grey, so they never count.
  const fg = (x, y) => {
    const i = (y * w + x) * ch;
    const r = px[i]; const g = px[i + 1]; const b = px[i + 2];
    if (dist(r, g, b, ...bg) <= threshold) return false;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    return luma < 175 || Math.max(r, g, b) - Math.min(r, g, b) > 55;
  };
  const rowCount = new Array(h).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (fg(x, y)) rowCount[y]++;
  // The printed name sits at the bottom of the card. Text flips between ink
  // and card many times per row (feet, bench legs and machine bases don't),
  // so find the highest such row in the lower half, step up through the
  // letters' tops, and ignore everything from there down.
  const flips = (y) => {
    let n = 0; let prev = false;
    for (let x = 0; x < w; x++) { const f = fg(x, y); if (f !== prev) n++; prev = f; }
    return n;
  };
  let labelTop = h;
  const maxGap = Math.round(h * 0.08);
  for (let y = h - 1, miss = 0; y > h * 0.5 && miss < maxGap; y--) {
    if (flips(y) >= 14) { labelTop = y; miss = 0; } else if (labelTop < h) miss++;
  }
  // the card above can spill a sliver of its label into this cell's top edge
  for (let y = 0; y < Math.round(h * 0.02); y++) rowCount[y] = 0;
  if (labelTop < h) {
    const capH = Math.round(h * 0.035);
    let y = labelTop;
    // climb through the tops of tall letters (still a few flips per row), but
    // stop at feet or a box that the label happens to touch
    while (y > labelTop - capH && rowCount[y - 1] >= minPixels && flips(y - 1) >= 8) y--;
    for (let k = y - 1; k < h; k++) if (k >= 0) rowCount[k] = 0;
  }
  const gap = Math.max(2, Math.round(h * 0.006)); // empty rows that split two bands
  const bands = [];
  let start = -1; let empty = 0;
  for (let y = 0; y < h; y++) {
    if (rowCount[y] >= minPixels) {
      if (start < 0) start = y;
      empty = 0;
    } else if (start >= 0 && ++empty >= gap) {
      bands.push([start, y - empty]); start = -1; empty = 0;
    }
  }
  if (start >= 0) bands.push([start, h - 1]);
  if (!bands.length) return null;
  // the figure is the band with the most ink; the printed name is a short band below it
  const mass = ([a, b]) => { let m = 0; for (let y = a; y <= b; y++) m += rowCount[y]; return m; };
  const [top, bottom] = bands.reduce((a, b) => (mass(b) > mass(a) ? b : a));
  let left = w; let right = -1;
  for (let y = top; y <= bottom; y++) if (rowCount[y]) for (let x = 0; x < w; x++) if (fg(x, y)) { if (x < left) left = x; if (x > right) right = x; }
  if (right < 0) return null;
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function sliceSheet({ file, grid, ids }) {
  const [cols, rows] = String(grid).toLowerCase().split('x').map(Number);
  const img = sharp(file).removeAlpha();
  const { width: W, height: H } = await img.metadata();
  const raw = await img.raw().toBuffer({ resolveWithObject: true });
  const ch = raw.info.channels;
  const cw = Math.floor(W / cols); const chh = Math.floor(H / rows);
  const inset = Math.round(Math.min(cw, chh) * 0.03);
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = ids[r * cols + c];
      if (!id || id === '-') continue;
      const cx = c * cw + inset; const cy = r * chh + inset;
      const w = cw - inset * 2; const h = chh - inset * 2;
      const cell = Buffer.alloc(w * h * ch);
      for (let y = 0; y < h; y++) raw.data.copy(cell, y * w * ch, ((cy + y) * W + cx) * ch, ((cy + y) * W + cx + w) * ch);
      const bg = cardColour(cell, w, h, ch);
      const box = findFigure(cell, w, h, ch, bg);
      if (!box) { console.warn(`  ${id}: no figure found in ${file} r${r + 1}c${c + 1}`); continue; }
      // keep only the figure's own box (so neither the label nor the card's
      // edge can creep in), then pad it to a square with the card's cream
      const side = Math.round(Math.max(box.width, box.height) * (1 + MARGIN * 2));
      const padX = side - box.width; const padY = side - box.height;
      const square = await sharp(cell, { raw: { width: w, height: h, channels: ch } })
        .extract(box)
        .extend({ top: padY >> 1, bottom: padY - (padY >> 1), left: padX >> 1, right: padX - (padX >> 1),
          background: { r: bg[0], g: bg[1], b: bg[2] } })
        .png({ palette: true, colors: COLORS, dither: 0 })
        .toBuffer();
      const png = await sharp(square)
        .resize(SIZE, SIZE, { kernel: 'nearest', fit: 'fill' })
        .png({ palette: true, colors: COLORS, dither: 0, effort: 10 })
        .toBuffer();
      const path = join(OUT, `${id}.png`);
      await sharp(png).toFile(path);
      out.push({ id, path, sourceSide: side });
      if (side < SIZE) console.warn(`  ${id}: figure is only ${side}px in the sheet, so it is scaled UP to ${SIZE}. A larger PNG sheet would be sharper.`);
    }
  }
  return out;
}

async function contactSheet(items) {
  if (!items.length) return;
  const tile = 128; const label = 18; const per = 8;
  const rows = Math.ceil(items.length / per);
  const W = per * tile; const H = rows * (tile + label);
  const composites = [];
  for (const [i, it] of items.entries()) {
    const x = (i % per) * tile; const y = Math.floor(i / per) * (tile + label);
    composites.push({ input: await sharp(it.path).resize(tile, tile, { kernel: 'nearest' }).toBuffer(), left: x, top: y });
    const text = it.id.length > 20 ? `${it.id.slice(0, 19)}…` : it.id;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${label}"><rect width="100%" height="100%" fill="#0B1222"/>`
      + `<text x="4" y="13" font-family="monospace" font-size="11" fill="#F2F5FC">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`;
    composites.push({ input: Buffer.from(svg), left: x, top: y + tile });
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: '#050912' } })
    .composite(composites).png().toFile(CONTACT);
  console.log(`contact sheet → ${CONTACT} (${items.length} crops)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(CONTACT.replace(/\/[^/]+$/, ''), { recursive: true });
  const all = [];
  for (const s of sheetsToRun()) {
    console.log(`${s.file} (${s.grid})`);
    all.push(...await sliceSheet(s));
  }
  await contactSheet(all);
  console.log(`${all.length} exercise images → ${OUT}`);
}
