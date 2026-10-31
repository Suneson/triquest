// gen-city.mjs — the base's city backdrops (docs/CITY.md): one 16:9 picture per floor of
// the MOSKE tower, plus the delivery truck, generated with Google's Gemini image model
// at its largest size (4K). House style: docs/ART-DIRECTION.md (modern, no wood).
//
//   GEMINI_API_KEY=… node tools/gen-city.mjs <out-dir> [name…]
//
// Each floor is the same tower seen from the same isometric camera, one storey higher:
// a flat concrete roof slab in the middle (the stage a room stands on, big enough for a
// 16 × 16 floor), the tower's facade under it, and the city around at that height. A
// floor is generated with the floor below it as a reference, so the tower, the city and
// the light carry on. The key is read from the environment only and never written.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('Set GEMINI_API_KEY'); process.exit(1); }
const OUT = process.argv[2];
if (!OUT) { console.error('Usage: node tools/gen-city.mjs <out-dir> [name…]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

// the house style and its references (docs/ART-DIRECTION.md)
const MODERN = [`${ROOT}icons/UI/ref/modern-building.jpg`, `${ROOT}icons/UI/ref/modern-shop.jpg`];
const STYLE = 'Modern, clean, cartoony stylised 3D render in the style of the reference images: soft rounded forms, smooth matte and satin plastic, glass and brushed metal, navy blue, white, warm grey and baby blue with small gold accents, soft daylight, gentle ambient occlusion. No wood anywhere, no medieval or fantasy elements, no text, no letters, no characters.';
// the camera every room's art uses: floor edges rise 34.8 px for every 61.9 across (about 29°)
const CAMERA = 'Orthographic isometric camera, exactly like the reference room: the ground diamond\'s edges slope at about 29 degrees from horizontal, no perspective, no vanishing points, the tower perfectly vertical.';
// the room art, so the model sees the angle and the scale a room has on the slab
const ROOM_REF = `${ROOT}icons/Pixelart/NEW/RUN/level-1.webp`;
const SLAB = 'In the exact centre of the image, the flat roof of the MOSKE tower: one large, completely flat, empty, light grey concrete slab seen as an isometric diamond, about 52% of the image width and its top corner about 22% down from the top edge, with a slim navy and white parapet edge. Nothing stands on the slab: it is the stage a room will be placed on.';

const floor = (storey, around) => `${STYLE} ${CAMERA} A wide 16:9 view of a modern sunny sports city. ${SLAB} Under the slab, the tower's front two facades go straight down: ${storey} Around the tower, ${around} Clear soft blue sky with a few small clouds above the slab and the skyline, filling the top quarter. The scene carries on to the left and right edges so the view can be panned sideways.`;

const JOBS = {
  truck: {
    aspect: '1:1',
    refs: [], // with a reference, the model copies its street plinth under the truck
    prompt: `${STYLE} ${CAMERA} One modern delivery box truck on its own, nothing else (no signs, no road, no pavement under it), seen from the isometric camera as it drives down a street that runs from the top right to the bottom left of the frame, facing the bottom left: a rounded white cab with baby-blue trim, a navy cargo box with a simple white stylised winged bird emblem on its side, chunky dark tyres with grey hubs, a small gold accent stripe. One single object, centred, filling about 80% of the frame. Flat solid green background #00FF00, no ground, no shadow, no gradient.`,
  },
  // the locker room: the ground floor, at street level
  'floor-0-locker': {
    refs: [...MODERN, ROOM_REF],
    prompt: floor(
      'this is the ground floor, so the slab sits low: just below it is the tower\'s glass lobby with a navy canopy carrying the white winged bird logo, automatic glass doors and a delivery bay with a roller door, and in front of it a wide two-lane street crossing the bottom of the image from the bottom left to the right, with a pavement, a crossing, kerbs and parking bays; the lowest 25% of the image is street.',
      'neighbouring low-rise shops, cafes and offices along the same street, small round trees in planters, lamp posts and bus stops, with taller towers further back rising above the slab.'),
  },
  // the gym: one storey up (made with the locker floor as a reference)
  'floor-1-gym': {
    refs: [...MODERN, ROOM_REF],
    below: 'floor-0-locker',
    prompt: `The first reference image is the floor below this one. Make the same picture with the camera raised by exactly one storey: the concrete roof slab stays exactly the same size and in exactly the same place in the frame, but the tower under it is now one storey taller, so one more storey of facade sits between the slab and everything that was below it, and the whole city around the tower (streets, shops, neighbouring buildings, cars) sits one storey lower in the frame than in the reference. Do not add a new building on top of the slab, the slab stays flat and empty. Keep the very same tower, colours, light and city. ${floor(
      'one storey of the tower\'s facade, white and warm grey panels with long baby-blue windows and a navy stripe, continuing straight down out of the bottom of the image; the street is now further below and only its far edges show at the bottom corners, with small cars.',
      'the same neighbourhood seen from one storey up: the rooftops of the low-rise shops just below, with rooftop units and planters, and the taller towers around now at about the same height.')}`,
  },
  // the bike room: two storeys up
  'floor-2-bike': {
    refs: [...MODERN, ROOM_REF],
    below: 'floor-1-gym',
    prompt: `The first reference image is the floor below this one. Make the same picture with the camera raised by exactly one storey: the concrete roof slab stays exactly the same size and in exactly the same place in the frame, but the tower under it is now one storey taller, so one more storey of facade sits between the slab and everything that was below it, and the whole city around the tower (streets, shops, neighbouring buildings, cars) sits one storey lower in the frame than in the reference. Do not add a new building on top of the slab, the slab stays flat and empty. Keep the very same tower, colours, light and city. ${floor(
      'one storey of the tower\'s facade, the same white and warm grey panels with long baby-blue windows, continuing straight down out of the image; no street shows any more.',
      'mid-rise office towers with green roof terraces at about the same height, the low-rise neighbourhood well below, and a few taller glass towers behind.')}`,
  },
  // the run room: three storeys up
  'floor-3-run': {
    refs: [...MODERN, ROOM_REF],
    below: 'floor-2-bike',
    prompt: `The first reference image is the floor below this one. Make the same picture with the camera raised by exactly one storey: the concrete roof slab stays exactly the same size and in exactly the same place in the frame, but the tower under it is now one storey taller, so one more storey of facade sits between the slab and everything that was below it, and the whole city around the tower (streets, shops, neighbouring buildings, cars) sits one storey lower in the frame than in the reference. Do not add a new building on top of the slab, the slab stays flat and empty. Keep the very same tower, colours, light and city. ${floor(
      'one storey of the tower\'s facade with a slim balcony running along it, continuing straight down out of the image.',
      'the city spreads out further below: rooftops with running tracks and pools, a park with round trees in the distance, and only the tallest towers still rising above.')}`,
  },
  // the pool: the top floor
  'floor-4-pool': {
    refs: [...MODERN, ROOM_REF],
    below: 'floor-3-run',
    prompt: `The first reference image is the floor below this one. Make the same picture with the camera raised by exactly one storey, to the top of the tower: the concrete roof slab stays exactly the same size and in exactly the same place in the frame, one more storey of facade sits under it, and the whole city sits one storey lower. Do not add a new building on top of the slab. Keep the very same tower, colours, light and city. ${floor(
      'the top storey of the tower\'s facade with a glass crown and a navy band carrying the white winged bird logo, continuing straight down out of the image.',
      'the whole city far below: a sea of rooftops, a river with bridges, distant hills, and soft clouds drifting at the height of the slab.')}`,
  },
};

const pngB64 = async (path) => (await sharp(readFileSync(path)).png().toBuffer()).toString('base64');

async function generate(name, { refs, prompt, aspect = '16:9', below }) {
  const parts = [];
  // the floor below goes first, so "the first reference image" is it
  if (below) {
    const p = `${OUT}/${below}.png`;
    if (!existsSync(p)) throw new Error(`${name}: generate ${below} first`);
    parts.push({ inlineData: { mimeType: 'image/png', data: await pngB64(p) } });
  }
  for (const r of refs) parts.push({ inlineData: { mimeType: 'image/png', data: await pngB64(r) } });
  parts.push({ text: prompt });
  const body = { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect, imageSize: '4K' } } };
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

// in order: each floor needs the one below it
const names = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(JOBS);
for (const n of names) {
  const buf = await generate(n, JOBS[n]);
  writeFileSync(`${OUT}/${n}.png`, await sharp(buf).png().toBuffer());
  const m = await sharp(`${OUT}/${n}.png`).metadata();
  console.log(`${n}: ${m.width}×${m.height}`);
}
