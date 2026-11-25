import { test } from 'node:test';
import assert from 'node:assert/strict';
import { line, rect, shapes, paintable, clean, kindOf } from '../js/core/floor-paint.js';

test('a stroke leaves no tiles touching only at a corner', () => {
  const t = line({ u: 0, v: 0 }, { u: 5, v: 3 });
  for (let i = 1; i < t.length; i += 1) {
    const d = Math.abs(t[i][0] - t[i - 1][0]) + Math.abs(t[i][1] - t[i - 1][1]);
    assert.equal(d, 1);
  }
  assert.deepEqual(t[0], [0, 0]); assert.deepEqual(t[t.length - 1], [5, 3]);
});

test('a rectangle covers every tile between its corners', () => {
  assert.equal(rect({ u: 2, v: 5 }, { u: 4, v: 3 }).length, 9);
});

test('edges only where a patch meets another floor', () => {
  const s = shapes({ '0,0': 'gravel', '1,0': 'gravel' });
  assert.equal(s.edges.split('M').length - 1, 6);
  assert.ok(s.fills.gravel.includes('M0 0h1v1h-1z'));
});

test('paint stays off blocked tiles, the raised floor and the grid edge, and unknown materials go', () => {
  const g = { cols: 10, rows: 10, blocked: [[0, 0, 2, 2]], raised: { box: [5, 5, 8, 8] } };
  assert.equal(paintable(g, 1, 1), false);
  assert.equal(paintable(g, 6, 6), false);
  assert.equal(paintable(g, 10, 3), false);
  assert.equal(paintable(g, 3, 3), true);
  assert.deepEqual(clean({ '3,3': 'gravel', '4,4': 'lava', '1,1': 'sand', '3,4': 'club-parquet' }, g, 'garden'), { '3,3': 'gravel' });
  assert.equal(kindOf('club-32'), 'club'); assert.equal(kindOf('plot-48'), 'garden');
});
