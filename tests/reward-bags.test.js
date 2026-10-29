import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RARITIES, rarityById, rarityRank, bagClip, playsWebmAlpha } from '../js/core/reward-bags.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('rarities run common → mythic', () => {
  assert.deepEqual(RARITIES.map((r) => r.id), ['common', 'uncommon', 'rare', 'legendary', 'mythic']);
  assert.equal(rarityRank('common'), 0);
  assert.equal(rarityRank('mythic'), 4);
  assert.equal(rarityRank('epic'), -1);
  assert.equal(rarityById('nope'), null);
});

test('every clip has its four files on disk', () => {
  for (const r of RARITIES) {
    for (let v = 0; v < r.variants.length; v++) {
      const c = bagClip(r.id, { variant: v });
      for (const f of [c.webm, c.webp, c.still, c.mp3]) {
        assert.ok(existsSync(join(ROOT, f)), `missing ${f}`);
        assert.ok(statSync(join(ROOT, f)).size > 1000, `empty ${f}`);
      }
    }
  }
});

test('bagClip picks a variant by index (wrapping) or by chance', () => {
  assert.equal(bagClip('rare', { variant: 0 }).slug, 'rare');
  assert.equal(bagClip('rare', { variant: 1 }).slug, 'rare-2');
  assert.equal(bagClip('rare', { variant: 2 }).slug, 'rare');
  assert.equal(bagClip('rare', { variant: -1 }).slug, 'rare-2');
  assert.equal(bagClip('rare', { rand: 0 }).slug, 'rare');
  assert.equal(bagClip('rare', { rand: 0.99 }).slug, 'rare-2');
  assert.equal(bagClip('mythic', { rand: 0.99 }).slug, 'mythic');
  assert.equal(bagClip('epic'), null);
  const c = bagClip('common', { variant: 1 });
  assert.deepEqual(c, {
    rarity: 'common', slug: 'common-2', ms: 4033,
    webm: 'assets/rewards/common-2.webm', webp: 'assets/rewards/common-2.webp',
    still: 'assets/rewards/common-2-still.webp', mp3: 'assets/rewards/common-2.mp3',
  });
});

test('WebM alpha only where it renders: not Safari, not iOS', () => {
  const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const edge = `${chrome} Edg/130.0`;
  const firefox = 'Mozilla/5.0 (Windows NT 10.0; rv:131.0) Gecko/20100101 Firefox/131.0';
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
  const safari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const iosChrome = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
  for (const ua of [chrome, edge, firefox, android]) assert.equal(playsWebmAlpha(ua, true), true, ua);
  for (const ua of [safari, iphone, iosChrome]) assert.equal(playsWebmAlpha(ua, true), false, ua);
  assert.equal(playsWebmAlpha(chrome, false), false);
});
