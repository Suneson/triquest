// draw-props.mjs — stand-in art for the scene props (docs/LOOP.md §2), drawn as
// pixel art in code so a built prop shows in its scene before the real art
// lands. Each is a 32×32 sprite in the app's palette, outlined in ink, scaled
// nearest-neighbour to 128×128 with a transparent background. The real art is
// briefed in docs/gear/LOOP-ART.md; drop it at the same paths to replace these.
//
//   node tools/draw-props.mjs      writes icons/Pixelart/PROPS/<id>.png
//
// Build-time only (sharp).

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = `${ROOT}icons/Pixelart/PROPS/`;
const N = 32;
const SCALE = 4;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const C = {
  ink: '#0B1222', navy: '#16264D', navy2: '#24396E', blue: '#0C4CAE', blue2: '#2F6FD6', sky: '#6EA8FF',
  white: '#F2F5FC', mist: '#C9D4E8', steel: '#8FA6C9', steel2: '#5E7395', gold: '#F2C14E', gold2: '#B8892A', gold3: '#FFE08A',
  oat: '#C9944F', oat2: '#9A6A33', red: '#D9443B', red2: '#9E2A24', black: '#1A1C22', grey: '#3A3F4A',
};

function canvas() {
  const px = new Array(N * N).fill(null);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) px[y * N + x] = c; };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
  const line = (x0, y0, x1, y1, c) => {
    const dx = Math.abs(x1 - x0); const dy = -Math.abs(y1 - y0); const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy; let x = x0; let y = y0;
    for (;;) { set(x, y, c); if (x === x1 && y === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; } }
  };
  const disc = (cx, cy, r, c) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) set(cx + x, cy + y, c); };
  const ring = (cx, cy, r, c) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = x * x + y * y; if (d <= r * r + r * 0.6 && d >= (r - 1) * (r - 1)) set(cx + x, cy + y, c); } };
  // an ink outline round everything drawn (the art sheet's 1px dark edge)
  const outline = () => {
    const filled = px.map((v) => v != null);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (filled[y * N + x]) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const X = x + a; const Y = y + b; return X >= 0 && Y >= 0 && X < N && Y < N && filled[Y * N + X]; });
      if (near) px[y * N + x] = C.ink;
    }
  };
  // a soft ground shadow so it sits on the diorama
  const shadow = (x, y, w) => { for (let i = 0; i < w; i++) set(x + i, y, '#0B122299'); };
  return { px, set, rect, line, disc, ring, outline, shadow };
}

const DRAW = {
  'bike-rack': (k) => {
    k.rect(4, 24, 24, 2, C.steel2);
    for (const x of [7, 13, 19, 25]) { k.rect(x - 2, 16, 1, 8, C.steel); k.rect(x + 2, 16, 1, 8, C.steel); k.rect(x - 2, 15, 5, 1, C.steel); }
    k.ring(10, 18, 6, C.black); k.ring(10, 18, 5, C.grey); k.set(10, 18, C.steel);
    k.line(10, 18, 16, 14, C.red); k.line(16, 14, 22, 14, C.red);
    k.ring(22, 18, 6, C.black); k.ring(22, 18, 5, C.grey); k.set(22, 18, C.steel);
  },
  'bike-stand': (k) => {
    k.line(16, 20, 9, 28, C.steel2); k.line(16, 20, 23, 28, C.steel2); k.line(16, 20, 16, 28, C.steel2);
    k.rect(15, 8, 2, 13, C.steel); k.rect(13, 7, 6, 3, C.gold);
    k.line(17, 9, 26, 9, C.red); k.line(26, 9, 22, 16, C.red); k.line(22, 16, 17, 9, C.red2);
    k.ring(27, 15, 3, C.black);
  },
  'bike-tent': (k) => {
    k.rect(4, 9, 24, 2, C.white);
    for (let i = 0; i < 24; i += 4) k.rect(4 + i, 11, 2, 3, C.blue2), k.rect(6 + i, 11, 2, 3, C.white);
    k.line(4, 9, 10, 4, C.blue); k.line(28, 9, 22, 4, C.blue); k.rect(10, 4, 12, 5, C.blue); k.rect(10, 5, 12, 1, C.blue2);
    k.rect(5, 14, 1, 13, C.steel); k.rect(26, 14, 1, 13, C.steel);
    k.rect(9, 21, 14, 2, C.oat); k.rect(10, 23, 1, 4, C.oat2); k.rect(21, 23, 1, 4, C.oat2);
    k.rect(12, 19, 2, 2, C.sky); k.rect(17, 19, 3, 2, C.gold);
  },
  'bike-lights': (k) => lights(k),
  'run-lights': (k) => lights(k),
  'run-water': (k) => {
    k.rect(4, 17, 24, 3, C.oat); k.rect(4, 17, 24, 1, '#E6B877');
    k.rect(6, 20, 1, 8, C.oat2); k.rect(25, 20, 1, 8, C.oat2);
    for (const x of [6, 10, 14, 18, 22]) { k.rect(x, 13, 3, 4, C.white); k.rect(x, 13, 3, 1, C.sky); }
    k.rect(24, 8, 3, 9, C.blue2); k.rect(24, 8, 3, 2, C.sky);
  },
  'run-gate': (k) => {
    k.rect(4, 6, 3, 22, C.navy2); k.rect(25, 6, 3, 22, C.navy2);
    k.rect(4, 4, 24, 6, C.navy); k.rect(5, 5, 22, 1, C.blue2);
    k.rect(12, 5, 8, 4, C.black); for (const x of [13, 15, 17, 19]) k.set(x, 7, C.gold);
    k.rect(4, 26, 3, 2, C.gold); k.rect(25, 26, 3, 2, C.gold);
  },
  'run-stand': (k) => stand(k, C.navy2, C.steel),
  'swim-stand': (k) => stand(k, C.blue, C.mist),
  'swim-reel': (k) => {
    k.disc(10, 18, 8, C.steel2); k.disc(10, 18, 6, C.blue2);
    for (let a = 0; a < 6; a++) k.ring(10, 18, 2 + a, a % 2 ? C.white : C.red);
    k.disc(10, 18, 1, C.steel);
    k.rect(18, 17, 10, 2, C.steel2); k.rect(26, 12, 2, 16, C.steel2);
    k.rect(18, 25, 12, 2, C.steel2);
  },
  'swim-clock': (k) => {
    k.disc(16, 13, 10, C.navy); k.disc(16, 13, 8, C.white);
    for (const [x, y] of [[16, 6], [23, 13], [16, 20], [9, 13]]) k.set(x, y, C.navy);
    k.line(16, 13, 16, 7, C.red); k.line(16, 13, 20, 15, C.black);
    k.rect(15, 23, 2, 6, C.steel2);
  },
  'gym-chalk': (k) => {
    k.rect(14, 18, 4, 10, C.steel2); k.rect(11, 27, 10, 2, C.steel2);
    k.rect(8, 14, 16, 4, C.steel); k.rect(9, 18, 14, 1, C.steel2);
    k.disc(16, 13, 5, C.white); k.rect(10, 13, 13, 2, C.mist);
  },
  'gym-sound': (k) => {
    k.rect(5, 6, 10, 22, C.black); k.rect(17, 6, 10, 22, C.black);
    for (const x of [10, 22]) { k.disc(x, 12, 3, C.grey); k.disc(x, 12, 1, C.steel); k.disc(x, 21, 4, C.grey); k.disc(x, 21, 2, C.steel2); }
    k.rect(5, 6, 22, 1, C.grey); k.set(13, 26, C.gold); k.set(25, 26, C.gold);
  },
};
function lights(k) {
  k.rect(15, 8, 2, 20, C.steel2); k.rect(12, 27, 8, 2, C.steel2);
  k.rect(8, 3, 16, 6, C.grey); k.rect(9, 4, 14, 4, C.gold3);
  for (const x of [11, 15, 19]) k.rect(x, 5, 2, 2, C.white);
}
function stand(k, seat, frame) {
  for (let r = 0; r < 3; r++) { k.rect(4 + r * 2, 22 - r * 6, 24 - r * 4, 2, seat); k.rect(4 + r * 2, 24 - r * 6, 24 - r * 4, 1, frame); }
  k.rect(4, 24, 1, 5, frame); k.rect(27, 24, 1, 5, frame);
  for (const [x, y, c] of [[9, 19, C.gold], [14, 13, C.red], [20, 19, C.sky], [17, 7, C.white]]) { k.disc(x, y, 1, c); k.rect(x - 1, y + 2, 3, 2, C.navy2); }
}

mkdirSync(OUT, { recursive: true });
for (const [id, draw] of Object.entries(DRAW)) {
  const k = canvas();
  draw(k);
  k.outline();
  const raw = Buffer.alloc(N * N * 4);
  k.px.forEach((c, i) => {
    if (!c) return;
    const [r, g, b] = hex(c.slice(0, 7));
    raw.set([r, g, b, c.length > 7 ? parseInt(c.slice(7, 9), 16) : 255], i * 4);
  });
  await sharp(raw, { raw: { width: N, height: N, channels: 4 } }).resize(N * SCALE, N * SCALE, { kernel: 'nearest' }).png().toFile(`${OUT}${id}.png`);
}
console.log(`drew ${Object.keys(DRAW).length} props into ${OUT}`);
