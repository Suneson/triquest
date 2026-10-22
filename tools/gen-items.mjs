// gen-items.mjs — the shop's item art, generated with Google's Gemini image
// model ("Nano Banana") and then cut out and pixel-snapped to the house size.
//
//   GEMINI_API_KEY=… node tools/gen-items.mjs [name…]   (no names: all of them)
//
// The key is read from the environment only and is never written anywhere.
// Each item is asked for on a flat #00FF00 background with two of the app's
// own pictures as style references (an exercise card and the MOSKE logo), then:
//   - the green is keyed out (with spill suppression) and the sprite trimmed,
//   - it is fitted into a 128×128 square, nearest-neighbour, and quantised,
//   - the raw model output is kept in docs/gear/gen/ for review.
// Output: icons/Pixelart/GEAR/<name>.png and a contact sheet docs/gear/gen-sheet.png.
// Build-time only (sharp + fetch).

import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../js/core/gear.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = `${ROOT}icons/Pixelart/GEAR/`;
const RAW = `${ROOT}docs/gear/gen/`;
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('Set GEMINI_API_KEY'); process.exit(1); }

const STYLE = `Style: detailed pixel art game item icon, the same pixel-art language as the first reference image
(clean dark 1-pixel outlines, soft cel shading with 3-4 tones per colour, a warm light from the top left).
One single object, centred, seen at a slight three-quarter angle, filling about 80% of the frame,
no text, no letters, no watermark, no shadow on the ground, no frame or border.
Background: one flat solid pure green colour #00FF00 everywhere around the object, no gradient, no texture.`;

const LOGO = 'The second reference image is the MOSKE logo (a stylised blue bird made of horizontal speed lines); where the object carries a logo, use exactly that bird shape, small, in white or blue.';

const ITEMS = {
  'fuel-gel': `A single energy gel sachet for endurance athletes, glossy white foil pouch with a torn-off tab at the top, a royal blue (#0C4CAE) label band across the middle carrying the MOSKE bird logo in white, a thin gold stripe under the label. ${LOGO}`,
  'fuel-energy-bar': 'A single energy bar for cyclists, gold foil wrapper with crimped ends, torn open at one end showing an oat-and-honey bar with visible oats, a navy blue band on the wrapper with a small gold lightning bolt.',
  'fuel-pasta': 'A white bowl with a royal blue rim, piled with spaghetti and tomato sauce, a basil leaf on top, a silver fork stuck in the pasta. A hearty carb-loading meal.',
  coin: 'A single thick gold coin seen slightly from the side so its edge shows, an embossed letter M on its face, a bright shine highlight. Game currency.',
  carbs: 'A single wheat ear rendered in shades of bright royal blue and sky blue (a stylised blue game currency, not a real-colour plant), with plump separate grains, long awns and one small blue leaf on the stalk. A game currency icon for carbohydrates.',
  'kit-moske-navy': `A cycling jersey laid flat, short sleeves, navy blue fabric, a gold band across the chest, gold sleeve cuffs, a full-length zip, a small white MOSKE bird logo on the chest. ${LOGO}`,
  'kit-moske-sand': `A cycling jersey laid flat, short sleeves, sand beige fabric, a dark slate-blue band across the chest, slate-blue sleeve cuffs, a full-length zip, a small navy MOSKE bird logo on the chest. ${LOGO}`,
  'fuel-gel-caffeine': `A single energy gel sachet, glossy red foil pouch with a torn-off tab at the top, a dark crimson label band with the MOSKE bird logo in white and a small white coffee bean mark, a thin silver stripe. Stronger and more premium than a plain gel. ${LOGO}`,
  'fuel-gel-race': `A single premium race-day energy gel sachet, shiny gold metallic foil pouch with a torn-off tab, a black label band with the MOSKE bird logo in gold and a small star, a subtle sparkle highlight. The rarest, most expensive gel. ${LOGO}`,
  'fuel-rice-cake': 'A cyclist rice cake: a square of sticky white rice with a few dark raisins, half wrapped in crinkled silver aluminium foil. A classic pro cycling pocket snack.',
  'fuel-recovery-shake': `A recovery shake: a clear plastic shaker bottle with a royal blue screw lid, filled with a creamy chocolate-brown shake, a white label with the MOSKE bird logo. ${LOGO}`,
  'kit-moske-crimson': `A cycling jersey laid flat, short sleeves, deep crimson red fabric, a white band across the chest, white sleeve cuffs, a full-length zip, a small white MOSKE bird logo on the chest. ${LOGO}`,
  'kit-moske-climber': `A cycling jersey laid flat, short sleeves, white fabric with royal blue polka dots, royal blue sleeve cuffs, a full-length zip, a small blue MOSKE bird logo on the chest. A climber's jersey. ${LOGO}`,
  'kit-moske-pro': `A premium cycling jersey laid flat, short sleeves, matte black fabric, thin gold pinstripes, gold sleeve cuffs, a full-length gold zip, a small gold MOSKE bird logo on the chest. The pro team kit. ${LOGO}`,
  'btn-shop': 'A small market stall shop for a sports game: a wooden counter with a striped awning in gold and navy, a few cycling items on display (a water bottle, a small wheel, an energy gel), a hanging sign with no text.',
  'btn-inventory': 'A sporty athlete backpack in navy blue with gold zips and straps, a water bottle in the side pocket, slightly open at the top showing an energy gel and a rolled jersey.',
};

// the 48 gear upgrades, described from the catalog: tier 1 entry level, tier 2 mid-range, tier 3 pro
const TIER_LOOK = {
  1: 'an entry-level, simple, honest version in plain colours',
  2: 'a mid-range, well-made version with some navy and steel details',
  3: 'a top-of-the-range pro version, sleek, carbon fibre and gold accents, clearly the most premium',
};
const SPORT_WORD = { bike: 'cycling', swim: 'swimming', run: 'running', gym: 'weightlifting' };
for (const e of CATALOG) {
  if (!e.tier) continue;
  ITEMS[e.id] = `A single piece of ${SPORT_WORD[e.sport]} equipment for a triathlete: ${e.name} (the "${e.slotName}" slot), shown as ${TIER_LOOK[e.tier]}. Just the object itself, no person.`;
}

const b64 = (p) => readFileSync(p).toString('base64');
const refs = [
  { inlineData: { mimeType: 'image/png', data: b64(`${ROOT}icons/Pixelart/EXERCISES/ab-wheel.png`) } },
  { inlineData: { mimeType: 'image/png', data: b64(`${ROOT}icons/logo.png`) } },
];

async function generate(name, prompt) {
  const body = {
    contents: [{ role: 'user', parts: [...refs, { text: `${prompt}\n\n${STYLE}` }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (part) return Buffer.from(part.inlineData.data, 'base64');
    console.warn(`${name}: attempt ${attempt} failed (${res.status}) ${JSON.stringify(json?.error?.message || json?.candidates?.[0]?.finishReason || '')}`);
  }
  throw new Error(`${name}: no image`);
}

// key the green out: pixels close to pure green go transparent; green spill
// on the edges is pulled back toward the pixel's other channels
async function cutout(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let fringe = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
    const greenness = g - Math.max(r, b);
    if (greenness > 90 && g > 150) { data[i + 3] = 0; continue; }
    if (greenness > 25) { data[i + 1] = Math.max(r, b) + 10; fringe++; } // spill suppression
  }
  return { img: sharp(data, { raw: info }), fringe, total: info.width * info.height };
}

async function snap(img) {
  const trimmed = await img.png().toBuffer().then((b) => sharp(b).trim({ threshold: 1 }).png().toBuffer());
  // fit into 120 inside a 128 square so outlines never touch the edge
  const fit = await sharp(trimmed).resize(120, 120, { fit: 'contain', kernel: 'nearest', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const sq = await sharp({ create: { width: 128, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fit, left: 4, top: 4 }]).png().toBuffer();
  // hard alpha (pixel art has no half-transparent pixels) and a small palette
  const { data, info } = await sharp(sq).raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] > 128 ? 255 : 0;
  return sharp(data, { raw: info }).png({ palette: true, colours: 48, dither: 0 }).toBuffer();
}

mkdirSync(OUT, { recursive: true });
mkdirSync(RAW, { recursive: true });
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ITEMS);
const done = [];
for (const name of names) {
  const raw = await generate(name, ITEMS[name]);
  writeFileSync(`${RAW}${name}.png`, await sharp(raw).resize(512, 512, { fit: 'inside' }).png().toBuffer());
  const { img, fringe, total } = await cutout(raw);
  const png = await snap(img);
  writeFileSync(`${OUT}${name}.png`, png);
  const pct = (100 * fringe) / total;
  console.log(`${name}: ok${pct > 1.5 ? `  WARNING: green fringe on ${pct.toFixed(1)}% of pixels, check the edges` : ''}`);
  done.push(name);
}

// contact sheet of everything generated this run
const cell = 144;
const parts = done.map((n, i) => ({ input: `${OUT}${n}.png`, left: (i % 5) * cell + 8, top: Math.floor(i / 5) * cell + 8 }));
await sharp({ create: { width: cell * Math.min(5, done.length), height: cell * Math.ceil(done.length / 5), channels: 4, background: '#0B1222' } })
  .composite(parts).png().toFile(`${ROOT}docs/gear/gen-sheet.png`);
console.log('sheet: docs/gear/gen-sheet.png');
