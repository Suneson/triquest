import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { SCENES, SCENE_SPORTS, sceneFor, sceneFiles, cornerPolygon, backdropCss, COACH } from '../js/core/scenes.js';

test('sceneFor clamps to the highest real art and keeps the true level', () => {
  assert.equal(sceneFor('gym', 1).artLevel, 1);
  assert.equal(sceneFor('gym', 9).artLevel, 9);
  const g = sceneFor('gym', 14);
  assert.equal(g.artLevel, 9);
  assert.equal(g.level, 14);
  assert.equal(sceneFor('swim', 6).artLevel, 1);
  assert.equal(sceneFor('run', 10).artLevel, 10);
  assert.equal(sceneFor('bike', 3).entry.char.endsWith('bikelvl3_char.webp'), true);
});

test('sceneFor tolerates junk levels and unknown sports', () => {
  assert.equal(sceneFor('run', 0).artLevel, 1);
  assert.equal(sceneFor('run', -4).artLevel, 1);
  assert.equal(sceneFor('run', NaN).artLevel, 1);
  assert.equal(sceneFor('run', '3').artLevel, 3);
  assert.equal(sceneFor('brick', 2), null);
});

test('the four Profile sports all have scenes', () => {
  for (const s of SCENE_SPORTS) assert.ok(SCENES[s]?.levels.length >= 1, s);
});

test('each entry has the fields its kind needs', () => {
  for (const [sport, s] of Object.entries(SCENES)) {
    for (const [i, e] of s.levels.entries()) {
      const at = `${sport} L${i + 1}`;
      if (s.kind === 'layered') {
        for (const k of ['bg', 'platform', 'char']) assert.equal(typeof e[k], 'string', `${at} ${k}`);
      } else {
        assert.equal(s.kind, 'still', at);
        assert.equal(typeof e.src, 'string', at);
        assert.ok(e.w > 0 && e.h > 0, `${at} size`);
        assert.match(e.backdrop.top, /^#[0-9a-f]{6}$/i, `${at} backdrop top`);
        assert.match(e.backdrop.bottom, /^#[0-9a-f]{6}$/i, `${at} backdrop bottom`);
        if (e.backdrop.bands) assert.match(e.backdrop.bands, /^([0-9a-f]{6})+$/i, `${at} bands`);
      }
    }
  }
});

test('every overlay box and point lies inside its image', () => {
  const inPct = (v) => v >= 0 && v <= 100;
  const box = (b, at) => {
    assert.ok(inPct(b.x) && inPct(b.y) && b.w > 0 && b.h > 0, at);
    assert.ok(b.x + b.w <= 100 && b.y + b.h <= 100, `${at} overflows`);
  };
  for (const [sport, s] of Object.entries(SCENES)) {
    if (s.kind !== 'still') continue;
    s.levels.forEach((e, i) => {
      const at = `${sport} L${i + 1}`;
      const fx = e.fx || {};
      for (const k of ['glow', 'dust']) (fx[k] || []).forEach((b) => box(b, `${at} ${k}`));
      if (fx.clouds) box(fx.clouds, `${at} clouds`);
      if (fx.clock) box(fx.clock, `${at} clock`);
      (fx.leaves?.from || []).forEach((b) => box(b, `${at} leaves`));
      (fx.shimmer || []).forEach(([x, y]) => assert.ok(inPct(x) && inPct(y), `${at} shimmer`));
      if (fx.ripples) assert.ok(inPct(fx.ripples.x) && inPct(fx.ripples.y), `${at} ripples`);
      for (const c of e.corners || []) {
        assert.ok(['left', 'right'].includes(c.side) && inPct(c.from) && inPct(c.to), `${at} corner`);
      }
    });
  }
});

test('no placeholder art is referenced', () => {
  for (const f of sceneFiles()) assert.ok(!/templvl/i.test(f), f);
});

test('every referenced art file exists on disk', () => {
  for (const f of sceneFiles()) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
});

test('cornerPolygon builds a closed staircase inside the box', () => {
  const p = cornerPolygon({ side: 'left', from: 86, to: 26 });
  assert.match(p, /^polygon\(0% 86%, /);
  assert.match(p, /, 0% 100%\)$/);
  const r = cornerPolygon({ side: 'right', from: 85, to: 72 });
  assert.match(r, /^polygon\(100% 85%, /);
  assert.match(r, /, 100% 100%\)$/);
  for (const m of p.matchAll(/(-?[\d.]+)% (-?[\d.]+)%/g)) {
    assert.ok(+m[1] >= 0 && +m[1] <= 100 && +m[2] >= 0 && +m[2] <= 100);
  }
});

test('backdropCss turns packed bands into hard-stop stripes', () => {
  assert.equal(backdropCss({ bands: 'ff0000' + '00ff00', top: '#000', bottom: '#111' }),
    'linear-gradient(#ff0000 0% 50%, #00ff00 50% 100%)');
  assert.equal(backdropCss({ top: '#000000', bottom: '#111111' }), 'linear-gradient(#000000 0 50%, #111111 50% 100%)');
  assert.match(backdropCss({ bands: 'bad', top: '#000', bottom: '#111' }), /50%/);
});

test('every coach frame that is set exists on disk', () => {
  for (const [k, f] of Object.entries(COACH)) {
    if (k === 'name' || !f) continue;
    assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${k}: ${f}`);
  }
});
