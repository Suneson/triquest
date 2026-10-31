// gen-city.mjs — the base's city (docs/CITY.md), generated with Google's Gemini image model
// at its largest size. House style: docs/ART-DIRECTION.md (modern, no wood).
//
//   GEMINI_API_KEY=… node tools/gen-city.mjs <out-dir> [name…]
//
// Every floor of the MOSKE tower is one picture, a little wider than the phone (3:4), so the
// slab's left and right corners are in it: the phone shows the middle and the city swipes
// sideways to the edges. The tower's flat roof slab is the stage a room stands on (big enough
// for a 16 × 16 floor). The sky is painted flat green so it can be keyed out: the sky is its
// own picture behind, and the clouds that cover a move between floors are their own pictures
// in front. Each floor shows one more storey under the slab than the floor below.
// The key is read from the environment only and never written anywhere.

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

// the city picture chosen as the look (icons/UI/ref/city-ref.jpg)
const CITY_REF = `${ROOT}icons/UI/ref/city-ref.jpg`;
const STYLE = 'Modern, clean, cartoony stylised 3D render, exactly the style, colours and materials of the reference city: soft rounded forms, smooth matte and satin plastic, glass and brushed metal, navy blue, white, warm grey and baby blue with small gold accents, soft daylight, gentle ambient occlusion. No wood anywhere, no text, no letters, no logos except the white winged bird, no people.';
const CAMERA = 'Orthographic isometric camera exactly like the reference: ground edges slope at about 29 degrees, no perspective, every building perfectly vertical.';
const SKY = 'Everything above the buildings is one flat, solid pure green #00FF00, with no clouds, no gradient and no haze, so the sky can be keyed out.';
const SLAB = 'In the middle of the picture stands the MOSKE tower. Its roof is one large, completely flat, empty, light grey concrete slab seen as an isometric diamond, about 86% of the picture\'s width with its left and right corners inside the picture, its top corner about 28% down from the top edge. The slab\'s edge is a clean flat rim flush with the slab, with no railing, no parapet, no wall and nothing raised: a room will stand on it. Under the slab the tower\'s two front facades go straight down.';
const WIDE = '3:4 portrait picture, a little wider than a phone screen, with the whole slab in it including its left and right corners.';

// the next floor up: the same slab, one more row of office windows under it. Floor 1 has two rows
// of office windows above the lobby and floor n has n + 1. The two floors below are both shown,
// so the model sees the tower grow. Align each result to floor 0 after (tools/cut-city.py align).
const upFloor = (n) => ({
  aspect: '3:4',
  refs: [`@floor-${n - 1}`, `@floor-${n - 2}`, CITY_REF],
  prompt: `${STYLE} ${CAMERA} ${WIDE} The two reference pictures are floors of the MOSKE tower: the second has ${n} rows of baby-blue office windows between the navy lobby canopy and the roof slab, the first has ${n + 1}. Paint the next floor up, which has exactly ${n + 2} rows of office windows between the navy lobby canopy and the roof slab: count them, ${n + 2} identical horizontal bands of long baby-blue windows in white and warm-grey panels, stacked one above the other. The roof slab looks exactly as in the first reference, with the same navy rim and the same thin gold trim along its edge (no railing). Because the tower is taller, the lobby, its canopy and the street sit lower under the slab than in the first reference, and the rooftops of the lower buildings round the tower start to show. The buildings round the tower are a little taller, and the tallest still rise out of the top of the picture. ${SKY}`,
});

const JOBS = {
  // the sky behind every floor
  sky: {
    aspect: '16:9',
    refs: [CITY_REF],
    prompt: `${STYLE} A wide, soft, clear daytime sky for that city: a gentle gradient from baby blue at the top to a pale, warm, almost white blue at the bottom, with a few small, soft, rounded cartoon clouds high up. Only sky, no buildings, no ground, no birds.`,
  },
  // the clouds that cover a move between floors (in front of everything)
  'clouds-a': {
    aspect: '9:16',
    refs: [CITY_REF],
    prompt: `${STYLE} A dense, tall bank of soft, fluffy, rounded cartoon clouds, white with soft pale blue shading, filling the middle three quarters of the picture from side to side, with puffy edges top and bottom. Only clouds. The background above and below the clouds is one flat, solid pure green #00FF00.`,
  },
  'clouds-b': {
    aspect: '9:16',
    refs: [CITY_REF],
    prompt: `${STYLE} A scattered layer of separate soft, fluffy, rounded cartoon clouds of different sizes, white with soft pale blue shading, spread over the whole picture with gaps between them. Only clouds. The background is one flat, solid pure green #00FF00.`,
  },

  // floor 0, the locker room: street level, the tall buildings round it rise out of the top
  'floor-0': {
    aspect: '3:4',
    refs: [`${ROOT}icons/UI/ref/city-floor0-ref.jpg`, CITY_REF],
    prompt: `${STYLE} ${CAMERA} ${WIDE} Repaint the first reference picture, the street-level floor of the MOSKE tower, as a slightly wider picture so the whole slab fits with its left and right corners showing, keeping everything else the same. ${SLAB} One storey shows under the slab: the tower's glass lobby with a navy canopy carrying the white winged bird, glass doors and a delivery bay with a roller door, and in front of it the wide street with pavements, crossings, trees in planters, lamp posts and bus stops filling the lower part of the picture. Behind and beside the tower, tall towers of the city rise right out of the top of the picture, so their roofs are not seen. ${SKY}`,
  },
  // floor 1, the gym: one storey more under the slab, taller buildings round it. Gemini frames it a
  // little wider, so scale it after until its slab lands on floor 0's (docs/CITY.md).
  'floor-1': {
    aspect: '3:4',
    refs: ['@floor-0', CITY_REF],
    prompt: `${STYLE} ${CAMERA} ${WIDE} The first reference picture is the street-level floor of the MOSKE tower. Paint the next floor up: the same tower, the same flat concrete roof slab (no railing) with the same size, shape and position in the picture, but now exactly two storeys show under the slab instead of one: an office storey of white and warm-grey panels with long baby-blue windows, and under it the same glass lobby with its navy canopy and roller door at street level. Because the tower is one storey taller, the street and pavements sit a storey lower in the picture and less of them shows at the bottom. The buildings round the tower are taller than on the floor below: mid-rise and high-rise towers with rooftop units and planters, and the tallest still rise out of the top of the picture. ${SKY}`,
  },
  // floors 2 and 3 (bike, run): each one row of office windows more under the same slab
  'floor-2': upFloor(2),
  'floor-3': upFloor(3),
};

const pngB64 = async (path) => (await sharp(readFileSync(path)).png().toBuffer()).toString('base64');

async function generate(name, { refs, prompt, aspect }) {
  const parts = [];
  for (const r of refs) {
    // '@name' is another job's output in this folder
    const p = r.startsWith('@') ? `${OUT}/${r.slice(1)}.png` : r;
    if (!existsSync(p)) throw new Error(`${name}: needs ${r} first`);
    parts.push({ inlineData: { mimeType: 'image/png', data: await pngB64(p) } });
  }
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

// the names run side by side; a floor needs the floor below, so run it after
const names = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(JOBS);
await Promise.all(names.map(async (n) => {
  const buf = await generate(n, JOBS[n]);
  writeFileSync(`${OUT}/${n}.png`, await sharp(buf).png().toBuffer());
  const m = await sharp(`${OUT}/${n}.png`).metadata();
  console.log(`${n}: ${m.width}×${m.height}`);
}));
