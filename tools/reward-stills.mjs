// reward-stills.mjs — everything the chest opening needs, read from the clips
// in icons/AnimatedRewards/WEBM/ (the source; never re-encoded or touched):
//
//   still/<Tier>.webp        the clip's first frame: the shut chest you tap
//   still/<Tier>-open.webp   its last frame: the open chest the rewards sit on
//   WEBP/<Tier>.webp         the whole clip as an animated WebP, played once,
//                            for Safari (every browser on iPhone), which plays
//                            WebM but ignores its transparency
//
//   node tools/reward-stills.mjs     (needs the dev server: node tools/serve.mjs 8744)
//
// Frames are captured while the clip plays (seeking a VP9-alpha clip in headless
// Chromium returns the first frame), one per decoded frame, with their alpha;
// tools/cut-reward-stills.py --frames writes the files.

import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TIERS = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Mythic'];
const SIZE = 448;
const PW = process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);

const work = join(tmpdir(), 'reward-frames');
rmSync(work, { recursive: true, force: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.goto('http://localhost:8744/manifest.webmanifest').catch(() => {});
for (const n of TIERS) {
  const frames = await p.evaluate(async ({ n, size }) => {
    const v = document.createElement('video');
    v.muted = true; v.src = `/icons/AnimatedRewards/WEBM/${n}.webm`; v.playbackRate = 0.25;
    document.body.appendChild(v);
    await new Promise((res, rej) => { v.oncanplaythrough = res; v.onerror = rej; });
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const x = c.getContext('2d');
    const out = [];
    await new Promise((res) => {
      const grab = (now, md) => {
        x.clearRect(0, 0, size, size);
        x.drawImage(v, 0, 0, size, size);
        out.push({ t: md.mediaTime, png: c.toDataURL('image/png') });
        if (!v.ended) v.requestVideoFrameCallback(grab);
      };
      v.requestVideoFrameCallback(grab);
      v.onended = res;
      v.play();
    });
    v.remove();
    return out;
  }, { n, size: SIZE });
  const dir = join(work, n);
  mkdirSync(dir, { recursive: true });
  frames.sort((a, c) => a.t - c.t).forEach((f, i) => writeFileSync(join(dir, `${String(i).padStart(4, '0')}.png`), Buffer.from(f.png.split(',')[1], 'base64')));
  console.log(n, frames.length, 'frames');
}
await b.close();
execFileSync('python3', [`${ROOT}tools/cut-reward-stills.py`, '--frames', work], { stdio: 'inherit' });
rmSync(work, { recursive: true, force: true });
