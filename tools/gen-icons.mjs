// gen-icons.mjs — generate PNG app icons procedurally (zero dependencies).
// Pure-JS PNG encoder + a geometric trident drawn to match icon.svg.
// Run: node tools/gen-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(OUT, { recursive: true });

// ---- minimal PNG encoder ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // no filter
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- drawing ----
function draw(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const ia = a / 255, ib = 1 - ia;
    px[i] = r * ia + px[i] * ib; px[i + 1] = g * ia + px[i + 1] * ib;
    px[i + 2] = b * ia + px[i + 2] * ib; px[i + 3] = Math.max(px[i + 3], a);
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const gold = (t) => [lerp(255, 255, t), lerp(227, 140, t), lerp(154, 66, t)];

  // background vertical gradient
  for (let y = 0; y < size; y++) {
    const t = y / size;
    const r = lerp(26, 11, t), g = lerp(34, 14, t), b = lerp(48, 19, t);
    for (let x = 0; x < size; x++) { const i = (y * size + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; }
  }

  const S = size / 512;
  const stroke = 26 * S;
  // thick line via stamped discs
  const line = (x1, y1, x2, y2) => {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, cx = lerp(x1, x2, t), cy = lerp(y1, y2, t);
      const c = gold(cy / size);
      const rad = stroke / 2;
      for (let dy = -rad; dy <= rad; dy++)
        for (let dx = -rad; dx <= rad; dx++)
          if (dx * dx + dy * dy <= rad * rad) set(cx + dx, cy + dy, c[0], c[1], c[2]);
    }
  };
  const tri = (cx, ty, w) => {
    for (let y = 0; y <= w; y++) {
      const half = (w - y) * (w / w);
      for (let x = -half; x <= half; x++) { const c = gold((ty + y) / size); set(cx + x, ty + y, c[0], c[1], c[2]); }
    }
  };

  line(256 * S, 150 * S, 256 * S, 430 * S);  // shaft
  line(150 * S, 210 * S, 362 * S, 210 * S);  // crossbar
  line(150 * S, 210 * S, 150 * S, 114 * S);  // left prong
  line(256 * S, 210 * S, 256 * S, 100 * S);  // centre prong
  line(362 * S, 210 * S, 362 * S, 114 * S);  // right prong
  line(214 * S, 430 * S, 298 * S, 430 * S);  // base
  tri(256 * S, 70 * S, 22 * S);
  tri(150 * S, 84 * S, 20 * S);
  tri(362 * S, 84 * S, 20 * S);

  return px;
}

for (const size of [192, 512, 180]) {
  const png = encodePNG(size, size, draw(size));
  const name = size === 180 ? 'icon-180.png' : `icon-${size}.png`;
  writeFileSync(join(OUT, name), png);
  console.log('wrote', name, png.length, 'bytes');
}
