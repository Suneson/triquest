// gen-shop-ui.mjs — the shop's tab icons (the shop overhaul, docs/SHOP.md),
// and the GYM tab's dumbbell, generated with Google's Gemini image model. The card plates and (i) buttons
// are painted by hand: icons/UI/cards/src/, fitted by tools/cut-card-art.py.
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

const JOBS = {
  'tab-fuel': { refs: [COFFEE], prompt: ICON('an energy gel sachet in electric blue and white with a small lightning bolt') },
  'tab-clothes': { refs: [COFFEE], prompt: ICON('a folded racing athletic jersey in navy and gold with white accents, chunky 3D folds, glossy finish') },
  'tab-gear': { refs: [COFFEE], prompt: ICON('a pair of carbon-fiber clip-on aerobars and an aero helmet, glossy metallic finish') },
  'tab-base': { refs: [COFFEE], prompt: ICON('a small isometric training building with a navy roof and a gold flag on top') },
  'tab-stall': { refs: [COFFEE], prompt: ICON('a small market stall with a navy and gold striped awning and a wooden counter') },
  // the GYM tab's sport buttons: the other three are the swim cap, the bike and the T3 shoe
  // the base's side buttons (docs/JOURNAL.md): a green orb each, the icon sitting over it
  'side-orb': { refs: [`${ROOT}icons/Pixelart/GEAR/btn-shop.png`], prompt: 'Stylised 3D mobile game round button base in the style of Clash Royale: a glossy emerald-green sphere-like disc seen from the front, a thick dark green rim, a soft white specular highlight on the upper left, a slightly darker lower half, empty in the middle, no icon, no text. One single object, centred, filling about 90% of the frame. Flat solid magenta background #FF00FF, no shadows, no gradient.' },
  'side-trophy': { refs: [`${ROOT}icons/Pixelart/GEAR/btn-inventory.png`, `${ROOT}icons/Pixelart/GEAR/btn-shop.png`], prompt: ICON('a gold trophy cup with two handles on a navy blue base with a small gold star, the same painted game-icon style as the reference backpack and stall') },
  'side-target': { refs: [`${ROOT}icons/Pixelart/GEAR/btn-inventory.png`, `${ROOT}icons/Pixelart/GEAR/btn-shop.png`], prompt: ICON('an archery target in navy blue, white and gold rings with a gold arrow stuck in the bullseye, the same painted game-icon style as the reference backpack and stall') },
  // the Chat tab's switches: General and Club (Direct is the dock's chat icon)
  'chat-general': { refs: [`${ROOT}icons/UI/nav/src/nav-chat.jpg`, `${ROOT}icons/UI/nav/src/nav-ranks.jpg`], prompt: ICON('a small glossy blue globe with a beige speech bubble beside it, meaning a chat room for everyone, the same glossy 3D style and blue and beige colours as the reference speech bubbles') },
  'chat-club': { refs: [`${ROOT}icons/UI/nav/src/nav-chat.jpg`, `${ROOT}icons/UI/chat/src/club-ref.jpg`], prompt: ICON('a heraldic club shield emblem with a thick carved wooden frame like the second reference, the shield face royal blue with the white winged bird logo from the first reference in its middle, glossy 3D game style') },
  'sport-gym': { refs: [`${ROOT}icons/UI/tabs/tab-gear.webp`, `${ROOT}icons/UI/tabs/tab-fuel.webp`], prompt: ICON('a single heavy hexagonal dumbbell, navy blue rubber heads with gold rims and a knurled chrome handle, seen from a slight three-quarter angle') },
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
