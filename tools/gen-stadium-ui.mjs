// gen-stadium-ui.mjs — the stadium screen's plates, generated with Google's Gemini image model in
// the style of the Close plate (icons/Pixelart/NEW/UI/close-plate.webp), so they sit with the rest
// of the app's chunky glossy buttons.
//
//   GEMINI_API_KEY=… node tools/gen-stadium-ui.mjs <out-dir> [name…]
//
// The key is read from the environment only and is never written anywhere. No lettering in the
// pictures: the app writes the countdown and the label over them, so they can be translated.
// tools/cut-ui-plates.py keys out the green and fits each one.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
const KEY = process.env.GEMINI_API_KEY;
const [OUT] = process.argv.slice(2);
if (!OUT) { console.error('Usage: node tools/gen-stadium-ui.mjs <out-dir> [name…]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const REF = new URL('../icons/Pixelart/NEW/UI/close-plate.webp', import.meta.url);

const STYLE = 'in exactly the same style as the reference button: a chunky glossy mobile game UI plate with thick rounded corners, a bevelled rim, a bright glossy highlight along the top edge, a darker thick base underneath giving it depth, and a dark navy outline around the whole shape. No text, no letters, no numbers, no icons anywhere. Seen straight from the front, centred, filling about 92% of the width. Background: one flat solid pure green colour #00FF00 everywhere around it, no drop shadow, no gradient in the background.';
const JOBS = {
  'clock-plate': { ratio: '21:9', prompt: `A wide horizontal scoreboard panel for a race countdown, ${STYLE} Colours: a deep navy blue (#16264D) body with a polished gold (#F2C14E) bevelled rim all round, and a recessed darker navy inner screen area across the middle where numbers will be written later.` },
  'talk-plate': { ratio: '21:9', prompt: `A wide horizontal rectangular push button, about four times as wide as it is tall, ${STYLE} Colours: a warm sunny golden yellow (#F2C14E to #FFD34D) face with a lighter top highlight and a darker amber-brown base underneath, and a dark navy outline.` },
  'talk-plate-down': { ratio: '21:9', prompt: `A wide horizontal rectangular push button shown PRESSED DOWN, about four times as wide as it is tall, ${STYLE} The face is pushed down into its base, so the dark base underneath is much thinner than usual and the top highlight is softer. Colours: a warm golden yellow (#E8B43E to #F2C14E) face, a darker amber-brown base, and a dark navy outline.` },
};

const pngB64 = async (path) => (await sharp(readFileSync(path)).png().toBuffer()).toString('base64');

async function generate(name, { prompt, ratio }) {
  const body = {
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/png', data: await pngB64(REF) } }, { text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: ratio } },
  };
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
await Promise.all(names.map(async (name) => {
  try { writeFileSync(`${OUT}/${name}.png`, await sharp(await generate(name, JOBS[name])).png().toBuffer()); console.log(`${name}: ok`); } catch (e) { console.error(String(e.message || e)); }
}));
