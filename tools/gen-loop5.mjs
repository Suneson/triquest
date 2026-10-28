// gen-loop5.mjs — the art for missions, seasons, the stall and clubs
// (docs/LOOP.md §5–6, docs/gear/LOOP-ART.md), from Google's Gemini image model.
//
//   GEMINI_API_KEY=… node tools/gen-loop5.mjs <out-dir> [name…]   (no names: all of them)
//
// The key is read from the environment only and is never written anywhere.
// Writes the raw model output (PNG) to <out-dir>; tools/cut-loop5.py keys out
// the green and fits each picture into icons/Pixelart/NEW/. Build-time only.
// Room items take the coffee machine (the house item style) and a room as
// references, so they stand on the same floor in the same light.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('Set GEMINI_API_KEY'); process.exit(1); }
const OUT = process.argv[2];
if (!OUT) { console.error('Usage: node tools/gen-loop5.mjs <out-dir> [name…]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const pngB64 = async (path) => (await sharp(readFileSync(path)).png().toBuffer()).toString('base64');
const COFFEE = `${ROOT}icons/Pixelart/NEW/ITEMS/coffee-machine.webp`;
const ROOM = `${ROOT}icons/Pixelart/NEW/LOCKER/square-6.webp`;

// the house item style: the coffee machine (first reference) standing in a room (second)
const ITEM = (what) => `Stylised 3D isometric mobile strategy game item in exactly the style of the first reference image (the coffee machine): chunky rounded forms, painted textures, glossy highlights, navy blue and gold accents, a warm light from the top left, seen from the same isometric angle as the room in the second reference image so it can stand on that floor. The item: ${what}. One single object standing on the floor, centred, filling about 80% of the frame, the base of the object at the bottom of the frame, no text, no letters, no numbers, no person. Background: one flat solid pure green colour #00FF00 everywhere around the object, no floor, no drop shadow, no gradient.`;
// badges and emblems: the same painted language, seen from the front
const BADGE = (what) => `Stylised 3D mobile game badge icon in the painted, glossy style of the reference image (the coffee machine): chunky rounded forms, painted textures, bright highlights, a thick dark navy outline. The badge: ${what}. Seen straight from the front, centred, filling about 80% of the frame, no text, no letters, no numbers. Background: one flat solid pure green colour #00FF00 everywhere around it, no drop shadow, no gradient.`;

const JOBS = {
  // the daily stall (stall.js)
  'decor-plant': { refs: [COFFEE, ROOM], prompt: ITEM('a big leafy monstera plant in a round navy blue ceramic pot with a gold rim') },
  'decor-cooler': { refs: [COFFEE, ROOM], prompt: ITEM('an office water cooler with a big clear blue water bottle on top, a white and navy body and a small stack of paper cups') },
  'decor-bench': { refs: [COFFEE, ROOM], prompt: ITEM('a long wooden locker-room bench with navy steel legs and gold bolts, a folded white towel on one end, twice as long as it is wide') },
  'decor-roller': { refs: [COFFEE, ROOM], prompt: ITEM('a small wooden rack holding three foam rollers in navy, gold and white, and a rolled-up yoga mat') },
  'decor-punchbag': { refs: [COFFEE, ROOM], prompt: ITEM('a heavy red leather punch bag hanging from a navy steel stand with a gold chain, a pair of navy boxing gloves on the stand base') },
  'decor-shelf': { refs: [COFFEE, ROOM], prompt: ITEM('a small wooden trophy shelf on legs with three gold cups and a silver medal hanging from a hook') },
  'decor-towels': { refs: [COFFEE, ROOM], prompt: ITEM('a navy steel towel rack with three thick striped pool towels in blue, white and gold, and a pair of swim goggles hanging off the side') },
  'decor-rug': { refs: [COFFEE, ROOM], prompt: ITEM('a flat square rug lying on the floor, navy blue with a gold border and a gold lightning bolt in the middle, seen from the isometric angle so it is a diamond shape, completely flat') },
  // the weekly mission board, standing in every room
  'mission-board': { refs: [COFFEE, ROOM], prompt: ITEM('a wooden notice board on two sturdy legs with a small peaked roof, three paper mission notes pinned to it with gold pins, a small gold star on top, no writing on the notes, just squiggle lines') },
  // club crests (clubs.js): six shields to choose from
  'crest-wave': { refs: [COFFEE], prompt: BADGE('a heraldic shield in navy blue with a gold border, a stylised white ocean wave across it') },
  'crest-bolt': { refs: [COFFEE], prompt: BADGE('a heraldic shield in deep red with a gold border, a big yellow lightning bolt across it') },
  'crest-peak': { refs: [COFFEE], prompt: BADGE('a heraldic shield in teal with a gold border, a mountain peak with a white snowy top and a small sun') },
  'crest-sun': { refs: [COFFEE], prompt: BADGE('a heraldic shield in sky blue with a gold border, a big golden sun with rays') },
  'crest-wheel': { refs: [COFFEE], prompt: BADGE('a heraldic shield in black with a gold border, a gold bicycle wheel with spokes in the middle') },
  'crest-bird': { refs: [COFFEE], prompt: BADGE('a heraldic shield in royal blue with a gold border, a stylised white bird in flight made of horizontal speed lines') },
  // season emblems (seasons.js), one per theme
  'season-almendro': { refs: [COFFEE], prompt: BADGE('a round medallion badge with a gold rim, inside a branch of pink almond blossom against a pale pink sky') },
  'season-alisio': { refs: [COFFEE], prompt: BADGE('a round medallion badge with a gold rim, inside a teal sky with white wind swirls and a small windsock blowing sideways') },
  'season-calima': { refs: [COFFEE], prompt: BADGE('a round medallion badge with a gold rim, inside an orange hazy sky with a pale sun and sand dunes') },
  'season-mar-de-nubes': { refs: [COFFEE], prompt: BADGE('a round medallion badge with a gold rim, inside a sea of white clouds with a dark volcanic mountain peak rising above it under a starry blue sky') },
  // the club relay map (clubs.js): the island the route goes round
  'relay-gran-canaria': {
    refs: [COFFEE],
    prompt: 'Stylised 3D mobile strategy game world map in the painted, glossy style of the reference image: the island of Gran Canaria seen from straight above, roughly round, green and brown hills rising to a central volcanic peak, sandy beaches and dunes in the south, small white villages, surrounded by a deep navy blue sea with soft lighter blue shallows along the coast. The island fills about 75% of the square frame, centred. No roads, no text, no labels, no compass, no border.',
  },
};

async function generate(name, { refs, prompt, aspect = '1:1' }) {
  const parts = [];
  for (const r of refs) parts.push({ inlineData: { mimeType: 'image/png', data: await pngB64(r) } });
  parts.push({ text: prompt });
  const body = { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } } };
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

const names = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(JOBS);
await Promise.all(names.map(async (name) => {
  try {
    const raw = await generate(name, JOBS[name]);
    writeFileSync(`${OUT}/${name}.png`, await sharp(raw).png().toBuffer());
    console.log(`${name}: ok`);
  } catch (e) { console.error(String(e.message || e)); }
}));
