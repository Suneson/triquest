// reward-stills.mjs — the still each chest rests on once its clip ends
// (icons/AnimatedRewards/still/<Tier>.webp), read from the clip's last frame.
//
//   node tools/reward-stills.mjs     (needs the dev server: node tools/serve.mjs 8744)
//
// The clips are the source and are never re-encoded: Chromium decodes the last
// frame with its alpha, and tools/cut-reward-stills.py writes the webp. When the
// painted JPG stills are in icons/AnimatedRewards/JPG/, cut-reward-stills.py keys
// those instead (and this isn't needed).

import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = `${ROOT}icons/AnimatedRewards/still/`;
const TIERS = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Mythic'];
const PW = process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);

mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const p = await b.newPage();
await p.goto('http://localhost:8744/manifest.webmanifest').catch(() => {});
for (const n of TIERS) {
  const url = await p.evaluate(async (n) => {
    const v = document.createElement('video');
    v.muted = true; v.src = `/icons/AnimatedRewards/WEBM/${n}.webm`;
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = rej; });
    v.currentTime = Math.max(0, v.duration - 0.04);
    await new Promise((res) => { v.onseeked = () => requestAnimationFrame(() => requestAnimationFrame(res)); });
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    return c.toDataURL('image/png');
  }, n);
  const png = `${OUT}${n}.png`;
  writeFileSync(png, Buffer.from(url.split(',')[1], 'base64'));
  console.log('frame', png);
}
await b.close();
execFileSync('python3', [`${ROOT}tools/cut-reward-stills.py`, '--frames'], { stdio: 'inherit' });
