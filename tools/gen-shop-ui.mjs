// gen-shop-ui.mjs — the shop's tab icons and card plates (the shop overhaul,
// docs/SHOP.md), generated with Google's Gemini image model.
//
//   GEMINI_API_KEY=… node tools/gen-shop-ui.mjs <out-dir> [name…]
//
// The key is read from the environment only and is never written anywhere.
// Icons take the coffee machine (the house item style) as their reference so
// they sit with the rest of the app's 3D items. tools/cut-shop-ui.py keys out
// the green and fits them into icons/UI/.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('Set GEMINI_API_KEY'); process.exit(1); }
const OUT = process.argv[2];
if (!OUT) { console.error('Usage: node tools/gen-shop-ui.mjs <out-dir> [name…]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const COFFEE = `${ROOT}icons/Pixelart/NEW/ITEMS/coffee-machine.webp`;
const ICON = (what) => `Stylised 3D game item icon in the style of Clash of Clans and of the reference image: ${what}, chunky rounded form, glossy specular highlights, thick dark outline. One single object, centred, filling about 80% of the frame, no text, no letters. Flat solid green background #00FF00, no shadows, no gradient.`;
const PLATE = (what) => `A square mobile game shop card inset texture, seen straight on, filling the whole frame edge to edge, no border, no object, no text: ${what}. Smooth, slightly glossy, with a soft light burst behind the centre where an item will sit, like the item wells of the Clash of Clans league shop.`;

const JOBS = {
  'tab-fuel': { refs: [COFFEE], prompt: ICON('an energy gel sachet in electric blue and white with a small lightning bolt') },
  'tab-clothes': { refs: [COFFEE], prompt: ICON('a folded racing athletic jersey in navy and gold with white accents, chunky 3D folds, glossy finish') },
  'tab-gear': { refs: [COFFEE], prompt: ICON('a pair of carbon-fiber clip-on aerobars and an aero helmet, glossy metallic finish') },
  'tab-base': { refs: [COFFEE], prompt: ICON('a small isometric training building with a navy roof and a gold flag on top') },
  'tab-stall': { refs: [COFFEE], prompt: ICON('a small market stall with a navy and gold striped awning and a wooden counter') },
  'card-plate-blue': { refs: [], prompt: PLATE('a radial gradient from vivid royal blue #0C4CAE in the centre to deep navy #16264D at the edges, with soft sky blue #6EA8FF highlights in the corners') },
  'card-plate-grey': { refs: [], prompt: PLATE('the same plate desaturated: a radial gradient from slate grey #6B7280 in the centre to dark charcoal #2B2F3B at the edges, with soft pale grey highlights in the corners') },
};

const pngB64 = async (path) => (await sharp(readFileSync(path)).png().toBuffer()).toString('base64');

async function generate(name, { refs, prompt }) {
  const parts = [];
  for (const r of refs) parts.push({ inlineData: { mimeType: 'image/png', data: await pngB64(r) } });
  parts.push({ text: prompt });
  const body = { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } } };
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
  try { writeFileSync(`${OUT}/${name}.png`, await sharp(await generate(name, JOBS[name])).png().toBuffer()); console.log(`${name}: ok`); } catch (e) { console.error(String(e.message || e)); }
}));
