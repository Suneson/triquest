// gen-buttons.mjs — the base's room buttons (Cycling, Swim, Run, Gym, Locker
// Room), generated with Google's Gemini image model in the house's chunky
// tan-framed game-button style (docs/gear/LOOP-ART.md).
//
//   GEMINI_API_KEY=… node tools/gen-buttons.mjs <out-dir> <style-ref.png> [name…]
//
// The key is read from the environment only and is never written anywhere.
// The style reference is only sent to the model, never committed. The label is
// not in the picture: the app writes it in its own heavy type, so it can be
// translated. tools/cut-buttons.py keys out the green and fits each tile.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('Set GEMINI_API_KEY'); process.exit(1); }
const [OUT, REF] = process.argv.slice(2);
if (!OUT || !REF) { console.error('Usage: node tools/gen-buttons.mjs <out-dir> <style-ref.png> [name…]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const BUTTON = (icon) => `A square mobile strategy game menu button in exactly the style of the reference image: rounded corners, a chunky bevelled frame in light sand and warm tan stone with a bright top-left highlight and a darker bottom-right edge, a warm cream inner panel, a soft dark outline around the whole button. In the upper two thirds of the panel, a big glossy stylised 3D icon with thick dark outlines and bright highlights: ${icon}. The lower third of the panel is left plain and empty (a label will be written there later). No text, no letters, no numbers anywhere. The button is seen straight from the front, centred, filling about 90% of the frame. Background: one flat solid pure green colour #00FF00 everywhere around the button, no drop shadow, no gradient.`;

const JOBS = {
  'btn-bike': BUTTON('a racing road bicycle in navy blue with gold rims, seen from the side'),
  'btn-swim': BUTTON('a pair of blue swimming goggles over a curling blue water wave with white foam'),
  'btn-run': BUTTON('a bright running shoe in royal blue with a gold swoosh stripe and white sole, with small speed lines'),
  'btn-gym': BUTTON('a heavy steel dumbbell with chunky navy blue plates and gold collars'),
  'btn-locker': BUTTON('a navy blue sports backpack with gold zips, a rolled white towel and a water bottle beside it'),
};

const pngB64 = async (path) => (await sharp(readFileSync(path)).png().toBuffer()).toString('base64');

async function generate(name, prompt) {
  const body = {
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/png', data: await pngB64(REF) } }, { text: prompt }] }],
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

const names = process.argv.slice(4).length ? process.argv.slice(4) : Object.keys(JOBS);
await Promise.all(names.map(async (name) => {
  try { writeFileSync(`${OUT}/${name}.png`, await sharp(await generate(name, JOBS[name])).png().toBuffer()); console.log(`${name}: ok`); } catch (e) { console.error(String(e.message || e)); }
}));
