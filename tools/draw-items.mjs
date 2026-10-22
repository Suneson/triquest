// draw-items.mjs — the shop's first item art, drawn as pixel art in code:
// fuel (gel, energy bar, pasta), the two currencies (coin, carbs) and one
// piece of clothing (the MOSKE jersey). Each sprite is drawn on a 32×32 grid
// in the app's palette, outlined, then scaled up nearest-neighbour to 128×128
// so it stays crisp. The gel and the jersey carry the real MOSKE logo
// (icons/logo.png), reduced to a few pixels.
//
//   node tools/draw-items.mjs        writes icons/Pixelart/GEAR/*.png and docs/gear/items-sheet.png
//
// Build-time only (sharp). Regenerate rather than hand-editing the PNGs.

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = `${ROOT}icons/Pixelart/GEAR/`;
const N = 32;
const SCALE = 4;

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const C = {
  ink: '#0B1222', navy: '#16264D', navy2: '#24396E', blue: '#0C4CAE', blue2: '#2F6FD6', sky: '#6EA8FF',
  white: '#F2F5FC', mist: '#C9D4E8', steel: '#8FA6C9', gold: '#F2C14E', gold2: '#B8892A', gold3: '#FFE08A',
  oat: '#C9944F', oat2: '#9A6A33', oat3: '#E6B877', red: '#D9443B', red2: '#9E2A24', pasta: '#F4D57A', pasta2: '#D9B04F',
  green: '#5BD08A', green2: '#2E8A55', wheat: '#E8B64C', wheat2: '#A8792A', wheat3: '#FFD978',
};

function canvas() {
  const px = new Array(N * N).fill(null);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N && c) px[y * N + x] = c; };
  const api = {
    px,
    set,
    get: (x, y) => (x >= 0 && y >= 0 && x < N && y < N ? px[y * N + x] : null),
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); },
    ellipse(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx; const dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) set(x, y, c);
        }
      }
    },
    line(x0, y0, x1, y1, c) {
      const dx = Math.abs(x1 - x0); const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        set(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    },
    // recolour already-filled pixels inside a box (for shading a shape)
    tint(x, y, w, h, c, only = null) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const cur = api.get(x + i, y + j);
        if (cur && (!only || cur === only)) set(x + i, y + j, c);
      }
    },
    // the house look: every shape gets a 1px ink outline
    outline() {
      const add = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (px[y * N + x]) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const g = api.get(x + a, y + b); return g && g !== C.ink; })) add.push([x, y]);
      }
      add.forEach(([x, y]) => set(x, y, C.ink));
    },
  };
  return api;
}

// the MOSKE bird, reduced to a w×h one-colour mask
async function logoMask(w, h) {
  const { data, info } = await sharp(`${ROOT}icons/logo.png`).trim({ threshold: 40 }).resize(w, h, { fit: 'contain', background: '#ffffff' })
    .greyscale().raw().toBuffer({ resolveWithObject: true });
  const m = [];
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * info.channels] < 150) m.push([x, y]);
  return m;
}

async function gel() {
  const k = canvas();
  // sachet body, tapering to the tear tab at the top
  k.rect(9, 7, 14, 21, C.white);
  k.rect(10, 28, 12, 1, C.white);
  k.rect(12, 4, 8, 3, C.white);
  k.rect(14, 2, 4, 2, C.mist);                 // the tear-off tip
  k.line(12, 6, 19, 6, C.mist);                // the tear line
  k.rect(9, 7, 2, 21, C.mist);                 // left shade
  k.rect(21, 8, 1, 19, C.white);
  k.rect(18, 9, 2, 6, '#FFFFFF');              // shine
  // the MOSKE label: blue band with the bird in white
  k.rect(9, 13, 14, 9, C.blue);
  k.rect(9, 13, 14, 1, C.blue2);
  k.rect(9, 21, 14, 1, C.navy2);
  for (const [x, y] of await logoMask(12, 6)) k.set(10 + x, 15 + y, C.white);
  // flavour stripe and crimped bottom
  k.rect(9, 23, 14, 2, C.gold);
  for (let x = 10; x < 22; x += 2) k.set(x, 28, C.mist);
  k.outline();
  return k;
}

function energyBar() {
  const k = canvas();
  // the wrapper, lying flat, crimped at the left end
  k.rect(5, 12, 18, 9, C.gold);
  k.rect(5, 12, 18, 1, C.gold3);
  k.rect(5, 20, 18, 1, C.gold2);
  for (let y = 12; y < 21; y += 2) { k.set(3, y, C.gold2); k.set(4, y, C.gold); k.set(4, y + 1, C.gold2); }
  // navy label band with a gold bolt
  k.rect(9, 14, 10, 5, C.navy);
  [[15, 14], [14, 15], [13, 16], [14, 16], [15, 16], [14, 17], [13, 18]].forEach(([x, y]) => k.set(x, y, C.gold3));
  // torn open at the right: the oat bar sticks out, with a bite
  k.rect(23, 13, 6, 7, C.oat);
  k.rect(23, 13, 6, 1, C.oat3);
  k.rect(23, 19, 6, 1, C.oat2);
  [[24, 15], [26, 14], [27, 17], [25, 18]].forEach(([x, y]) => k.set(x, y, C.oat3));
  [[25, 16], [28, 15], [24, 17]].forEach(([x, y]) => k.set(x, y, C.oat2));
  k.set(28, 13, null); k.set(28, 14, null); k.set(27, 13, null);
  k.px[13 * N + 28] = null; k.px[14 * N + 28] = null; k.px[13 * N + 27] = null;
  // the torn wrapper edge
  [[22, 12], [23, 12], [22, 20], [23, 20]].forEach(([x, y]) => k.set(x, y, C.gold2));
  k.outline();
  return k;
}

function pasta() {
  const k = canvas();
  // bowl
  k.ellipse(16, 18, 13, 4, C.white);
  k.rect(5, 18, 22, 4, C.white);
  k.ellipse(16, 22, 11, 5, C.white);
  k.tint(4, 22, 24, 6, C.mist);
  k.rect(4, 17, 24, 2, C.blue);                // MOSKE-blue rim
  k.rect(4, 17, 24, 1, C.blue2);
  // pasta heap
  k.ellipse(16, 14, 10, 5, C.pasta);
  for (let x = 8; x < 25; x += 3) k.line(x, 11 + (x % 2), x + 2, 16, C.pasta2);
  // sauce and basil
  k.ellipse(16, 11, 5, 3, C.red);
  k.rect(14, 10, 2, 1, '#F07A6A');
  k.set(18, 12, C.red2); k.set(13, 12, C.red2);
  k.rect(17, 9, 2, 1, C.green); k.set(18, 8, C.green2);
  // fork
  k.line(24, 4, 21, 13, C.steel);
  k.rect(23, 2, 1, 3, C.steel); k.rect(25, 2, 1, 3, C.steel);
  k.outline();
  return k;
}

function coin() {
  const k = canvas();
  k.ellipse(16, 16, 13, 13, C.gold2);
  k.ellipse(15.5, 15.5, 12, 12, C.gold);
  k.ellipse(16, 16, 9, 9, C.gold2);
  k.ellipse(15.5, 15.5, 8.5, 8.5, C.gold);
  // an embossed M
  k.rect(11, 11, 2, 10, C.gold2); k.rect(19, 11, 2, 10, C.gold2);
  k.line(13, 12, 16, 16, C.gold2); k.line(18, 12, 16, 16, C.gold2);
  k.rect(8, 8, 3, 2, C.gold3); k.rect(7, 10, 2, 3, C.gold3);     // shine
  k.outline();
  return k;
}

function carbs() {
  const k = canvas();
  // a wheat ear: a curved stalk, six pairs of separate grains, a leaf
  k.line(16, 30, 16, 20, C.wheat2);
  k.line(16, 20, 17, 8, C.wheat2);
  for (let i = 0; i < 5; i++) {
    const y = 8 + i * 4;
    for (const [cx, hi] of [[13, 12], [20, 19]]) {
      k.ellipse(cx, y + 1.5, 2.2, 1.9, C.wheat);
      k.set(hi, y + 1, C.wheat3);
      k.set(cx, y + 3, C.wheat2);                 // the seam under each grain keeps them apart
    }
  }
  k.ellipse(16.5, 5.5, 1.6, 2.4, C.wheat);
  k.set(16, 4, C.wheat3);
  k.line(17, 2, 17, 0, C.wheat2);                   // awns
  k.line(14, 3, 12, 0, C.wheat2); k.line(19, 3, 21, 0, C.wheat2);
  k.line(17, 26, 23, 22, C.green); k.line(17, 27, 23, 23, C.green2);
  k.outline();
  return k;
}

async function jersey(body = C.navy, body2 = C.navy2, band = C.gold, band2 = C.gold3, mark = C.white) {
  const k = canvas();
  // body and sleeves
  k.rect(9, 8, 14, 20, body);
  k.rect(4, 8, 6, 8, body); k.rect(22, 8, 6, 8, body);
  k.rect(4, 14, 5, 2, band); k.rect(23, 14, 5, 2, band);   // sleeve cuffs
  k.rect(12, 6, 8, 3, body2);                                 // collar
  k.rect(15, 7, 2, 10, C.steel);                                 // zip
  k.rect(9, 20, 14, 3, band);                                  // gold chest band
  k.rect(9, 20, 14, 1, band2);
  k.rect(9, 8, 2, 20, body2);
  // the MOSKE bird on the chest, white on navy
  for (const [x, y] of await logoMask(8, 4)) k.set(17 + x, 10 + y, mark);
  k.rect(10, 27, 12, 1, body2);
  k.outline();
  return k;
}

async function write(name, k) {
  const raw = Buffer.alloc(N * N * 4);
  k.px.forEach((c, i) => { if (c) raw.set(hex(c), i * 4); });
  await sharp(raw, { raw: { width: N, height: N, channels: 4 } })
    .resize(N * SCALE, N * SCALE, { kernel: 'nearest' }).png({ palette: true, colours: 64 })
    .toFile(`${OUT}${name}.png`);
  return { name, raw };
}

mkdirSync(OUT, { recursive: true });
const items = [
  await write('fuel-gel', await gel()),
  await write('fuel-energy-bar', energyBar()),
  await write('fuel-pasta', pasta()),
  await write('coin', coin()),
  await write('carbs', carbs()),
  await write('kit-moske-navy', await jersey()),
  await write('kit-moske-sand', await jersey('#CDB284', '#A88B62', '#2C3D52', '#3F566F', C.navy)),
];

// a contact sheet to review them side by side
const cell = N * SCALE + 16;
const sheet = sharp({ create: { width: cell * items.length, height: cell, channels: 4, background: '#0B1222' } });
const parts = await Promise.all(items.map(async (it, i) => ({
  input: await sharp(it.raw, { raw: { width: N, height: N, channels: 4 } }).resize(N * SCALE, N * SCALE, { kernel: 'nearest' }).png().toBuffer(),
  left: i * cell + 8, top: 8,
})));
mkdirSync(`${ROOT}docs/gear`, { recursive: true });
await sheet.composite(parts).png().toFile(`${ROOT}docs/gear/items-sheet.png`);
console.log('wrote', items.map((i) => i.name).join(', '));
