// gen-stadium.mjs — the stadium race track for the PVE event (docs/STADIUM.md), from Gemini.
//
//   GEMINI_API_KEY=… node tools/gen-stadium.mjs <out-dir> [track]
//
// The key is read from the environment only and is never written anywhere.
// Writes the raw model output (PNG) to <out-dir>; the track is cut to
// icons/Stadium/track.webp by hand. Build-time only.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
const KEY = process.env.GEMINI_API_KEY;
// no key here: the environment's network secret for generativelanguage.googleapis.com adds it on the way out
if (!KEY) console.warn('No GEMINI_API_KEY: relying on the network secret for generativelanguage.googleapis.com');
const OUT = process.argv[2];
if (!OUT) { console.error('Usage: node tools/gen-stadium.mjs <out-dir> [track]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const pngB64 = async (path) => (await sharp(readFileSync(path)).png().toBuffer()).toString('base64');

const JOBS = {
  track: {
    aspect: '9:16',
    refs: [`${ROOT}icons/Island/stadium.webp`],
    prompt: 'The attached picture is the stadium building from the same mobile game: use it only for the art style (chunky hand-painted 3D, soft light, saturated colours, navy #16264D, white and gold, no wood). Draw a NEW image: the stadium seen from directly overhead, looking straight down like a map, with no perspective at all. A standard 400 m athletics running track, its two long straights running from the top of the picture to the bottom and the two semicircular bends at the top and the bottom, centred, the outside lane about 80% of the picture wide. Eight terracotta-red lanes of exactly equal width all the way round, perfectly concentric and symmetrical left to right, crisp white lane lines evenly spaced, the same eight lanes on both straights and both bends, a light grey apron round the outside, a chequered navy and white finish line across the lower end of the right-hand straight. Inside the track the bright green grass infield fills the whole inside of the inner lane, following its oval shape right up to the white kerb, with neat mowing stripes, empty. Around it the navy stands seen from above as rings of tiny seat rows, a gold rim on the outer edge with small gold and white flags. Fill the whole picture edge to edge: the navy stands continue out to all four corners, no background shows anywhere. No people, no text, no numbers, no logos.',
  },
};

async function generate(name, { refs, prompt, aspect = '1:1' }) {
  const parts = [];
  for (const r of refs) parts.push({ inlineData: { mimeType: 'image/png', data: await pngB64(r) } });
  parts.push({ text: prompt });
  const body = { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } } };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(KEY ? { 'x-goog-api-key': KEY } : {}) }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (part) return Buffer.from(part.inlineData.data, 'base64');
    console.warn(`${name}: attempt ${attempt} failed (${res.status}) ${JSON.stringify(json?.error?.message || json?.candidates?.[0]?.finishReason || '')}`);
  }
  throw new Error(`${name}: no image`);
}

const names = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(JOBS);
for (const n of names) {
  const buf = await generate(n, JOBS[n]);
  writeFileSync(`${OUT}/${n}.png`, await sharp(buf).png().toBuffer());
  console.log(`${n}: ${OUT}/${n}.png`);
}
