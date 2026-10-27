// gen-env.mjs — the base's generated art (docs/COMPOUND.md): the stamina bolt
// icon and the terrain the room stands on, from Google's Gemini image model.
//
//   GEMINI_API_KEY=… node tools/gen-env.mjs <out-dir> [bolt] [env]
//
// The key is read from the environment only and is never written anywhere.
// Writes the raw model output (PNG) to <out-dir>; tools/cut-env.py keys out
// the bolt's green and fits both into icons/Pixelart/NEW/. Build-time only.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('Set GEMINI_API_KEY'); process.exit(1); }
const OUT = process.argv[2];
if (!OUT) { console.error('Usage: node tools/gen-env.mjs <out-dir> [bolt] [env]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const pngB64 = async (path) => (await sharp(readFileSync(path)).png().toBuffer()).toString('base64');

const JOBS = {
  bolt: {
    refs: [],
    prompt: 'Stylised 3D game item icon in the style of Clash of Clans: an electric lightning bolt icon, chunky rounded 3D form, glossy specular highlights, bright saturated yellow with gold rim light. One single object, centred, filling about 80% of the frame, no text. Solid flat green background #00FF00, no drop shadows.',
  },
  env: {
    aspect: '2:3',
    refs: [`${ROOT}icons/Pixelart/NEW/GYM/level-10.webp`],
    prompt: 'Stylised 3D isometric mobile strategy game environment matching the camera angle of Clash of Clans: lush green stylized grass terrain surrounding a recessed foundation plot, stylized blue sky with soft fluffy cartoon clouds at the upper perimeter, and dark earth/dirt cutaway layers along the front edges. The terrain lines, ground plane, and perspective slopes must match a true 30-degree orthographic isometric angle to align with an architectural gym base. The reference image is the building that will stand on the plot: match its camera angle exactly, make the empty foundation plot a diamond centred horizontally and slightly below the middle of the image, about three quarters of the image wide, and leave it empty. The image is a tall portrait: grass all around the plot, sky with clouds across the top, the dirt cutaway at the bottom. Solid, vibrant colors, soft ambient shadows, no buildings, no characters, no text.',
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
for (const n of names) {
  const buf = await generate(n, JOBS[n]);
  writeFileSync(`${OUT}/${n}.png`, await sharp(buf).png().toBuffer());
  console.log(`${n}: ${OUT}/${n}.png`);
}
