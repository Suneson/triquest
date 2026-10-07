import { test } from 'node:test';
import assert from 'node:assert/strict';
import { svg, ICON_NAMES, _bitmaps } from '../js/core/icons.js';

test('every icon bitmap is a 16×16 grid of . and #', () => {
  for (const [name, art] of Object.entries(_bitmaps)) {
    const rows = art.trim().split('\n').map((r) => r.trim());
    assert.equal(rows.length, 16, `${name} has ${rows.length} rows`);
    for (const r of rows) {
      assert.equal(r.length, 16, `${name} row "${r}" is ${r.length} wide`);
      assert.match(r, /^[.#]+$/, `${name} has a stray character`);
    }
    assert.ok(rows.join('').includes('#'), `${name} is blank`);
  }
});

test('svg() keeps the old API: class, currentColor, aria-hidden', () => {
  const s = svg('run', 'tint');
  assert.match(s, /^<svg viewBox="0 0 16 16" class="ic tint"/);
  assert.match(s, /fill="currentColor"/);
  assert.match(s, /shape-rendering="crispEdges"/);
  assert.match(s, /aria-hidden="true"/);
  assert.match(s, /<path d="M\d/);
});

test('every name the app used before still exists', () => {
  const legacy = ['run', 'bike', 'swim', 'gym', 'brick', 'mobility', 'other', 'plus', 'regen', 'trash', 'edit',
    'bag', 'trophy', 'medal', 'clock', 'spark', 'flame', 'route', 'check', 'flag', 'moon', 'warn', 'lock'];
  for (const n of legacy) assert.ok(ICON_NAMES.includes(n), n);
});

test('unknown names fall back to the "other" glyph', () => {
  assert.equal(svg('no-such-icon'), svg('other'));
});
