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
// Options: --size=256  --colors=24  --margin=0.08  --out=icons/Pixelart/EXERCISES
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
  const manifest = 'docs/gym/sheets.json';
  if (!existsSync(manifest)) throw new Error(`No sheet given and no ${manifest}. See the usage at the top of this file.`);
  return JSON.parse(readFileSync(manifest, 'utf8'));
}

const dist = (r1, g1, b1, r2, g2, b2) => Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);

/** Median colour of a cell's outer border = the card background. */
function borderColour(px, w, h, ch) {
  const rs = []; const gs = []; const bs = [];
  const push = (x, y) => { const i = (y * w + x) * ch; rs.push(px[i]); gs.push(px[i + 1]); bs.push(px[i + 2]); };
  for (let x = 0; x < w; x += 2) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y += 2) { push(0, y); push(w - 1, y); }
  const med = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  return [med(rs), med(gs), med(bs)];
}

/**
 * Find the figure in one cell: { left, top, width, height } or null.
 * Rows with foreground pixels form bands separated by empty gaps; the tallest
 * band is the figure, the short ones under it are printed text.
 */
export function findFigure(px, w, h, ch, bg, { threshold = 60, minPixels = 2 } = {}) {
  const fg = (x, y) => { const i = (y * w + x) * ch; return dist(px[i], px[i + 1], px[i + 2], ...bg) > threshold; };
  const rowCount = new Array(h).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (fg(x, y)) rowCount[y]++;
  const gap = Math.max(2, Math.round(h * 0.015)); // empty rows that split two bands
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
  const [top, bottom] = bands.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
  let left = w; let right = -1;
  for (let y = top; y <= bottom; y++) for (let x = 0; x < w; x++) if (fg(x, y)) { if (x < left) left = x; if (x > right) right = x; }
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
      const bg = borderColour(cell, w, h, ch);
      const box = findFigure(cell, w, h, ch, bg);
      if (!box) { console.warn(`  ${id}: no figure found in ${file} r${r + 1}c${c + 1}`); continue; }
      // square around the figure, with a margin, clamped to the cell
      const side = Math.round(Math.max(box.width, box.height) * (1 + MARGIN * 2));
      const sx = Math.round(box.left + box.width / 2 - side / 2);
      const sy = Math.round(box.top + box.height / 2 - side / 2);
      const pad = { top: Math.max(0, -sy), left: Math.max(0, -sx), bottom: Math.max(0, sy + side - h), right: Math.max(0, sx + side - w) };
      const ex = { left: Math.max(0, sx), top: Math.max(0, sy), width: Math.min(side, w - Math.max(0, sx)), height: Math.min(side, h - Math.max(0, sy)) };
      const square = await sharp(cell, { raw: { width: w, height: h, channels: ch } })
        .extract(ex)
        .extend({ ...pad, background: { r: bg[0], g: bg[1], b: bg[2] } })
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
