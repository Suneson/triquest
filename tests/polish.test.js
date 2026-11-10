// The UI polish pass (docs/UI-POLISH.md): half-size room pictures, the sheets, the press spring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXPANDED_ART, bigArt, midArt, needsFull, MID_W } from '../js/core/expansions.js';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => fs.readFileSync(path.join(REPO, f), 'utf8');

test('every big room picture has its half-size copy, at every level', () => {
  for (const room of Object.keys(EXPANDED_ART)) {
    for (let level = 1; level <= 10; level++) {
      const big = bigArt(room, level); const mid = midArt(room, level);
      assert.match(mid, /\/mid-\d+\.webp$/);
      assert.ok(fs.existsSync(path.join(REPO, big)), `${big} is missing`);
      assert.ok(fs.existsSync(path.join(REPO, mid)), `${mid} is missing: run tools/room-mids.py`);
      // the copy is the smaller file, or it isn't worth having
      assert.ok(fs.statSync(path.join(REPO, mid)).size < fs.statSync(path.join(REPO, big)).size, `${mid} is not smaller than ${big}`);
    }
  }
});

test('the full picture is only asked for once the half-size one would look soft', () => {
  assert.equal(needsFull(1200), false);          // a phone at the zoom the base opens at
  assert.equal(needsFull(MID_W), false);
  assert.equal(needsFull(MID_W * 1.1 + 1), true);
  assert.equal(needsFull(3000), true);
});

test('the shop, the inventory and the wardrobe open as sheets over the base', () => {
  assert.match(read('js/app/gear-view.js'), /openLayer\('shop-gear', \{[^}]*sheet: true/);
  assert.match(read('js/app/gear-view.js'), /openLayer\('inventory', \{[^}]*sheet: true/);
  assert.match(read('js/app/wardrobe-view.js'), /openLayer\('wardrobe', \{[^}]*sheet: true/);
});

test('the service worker caches what the page links, and serves pictures from the cache', () => {
  const sw = read('sw.js');
  for (const f of ['./css/polish.css', './js/app/press.js']) assert.ok(sw.includes(`'${f}'`), `${f} is not precached`);
  assert.ok(read('index.html').includes('css/polish.css'));
  assert.match(sw, /\(icons\|models\|fonts\|vendor\)/);
});

test('every animation the polish adds stops under reduced motion', () => {
  const css = read('css/polish.css');
  const names = [...css.matchAll(/@keyframes ([a-z-]+)/g)].map((m) => m[1]);
  assert.ok(names.length >= 8);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /body\.rm /);
});
