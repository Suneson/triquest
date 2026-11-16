import { test } from 'node:test';
import assert from 'node:assert/strict';
import { place, onScalp, hairCutFor } from '../js/app/gear3d.js';

// a head about 0.24 wide, 0.26 tall, 0.27 deep, its top at 1.8, facing +Z
const head = { min: { x: -0.12, y: 1.54, z: -0.14 }, max: { x: 0.12, y: 1.8, z: 0.13 } };
const unit = { x: 1, y: 1, z: 1 };

test('a hat is sized to the head and sits on top of it', () => {
  const p = place('hat', unit, head);
  assert.ok(Math.abs(p.s - 0.24 * 1.2) < 1e-9, 'a fifth wider than the head');
  assert.ok(p.y + p.s > 1.8 && p.y < 1.8, 'its top above the head, its rim below the crown');
  assert.equal(p.x, 0);
});

test('glasses sit in front of the face at eye height', () => {
  const p = place('glasses', { x: 1, y: 0.4, z: 1 }, head);
  const front = p.z + p.s / 2;
  assert.ok(front > 0.13 && front < 0.15);
  const mid = p.y + (0.4 * p.s) / 2;
  assert.ok(mid > 1.65 && mid < 1.72);
});

test('a shoe is longer than the foot and stands on the floor', () => {
  const foot = { min: { x: 0.05, y: 0, z: -0.06 }, max: { x: 0.15, y: 0.1, z: 0.18 } };
  const p = place('shoes', { x: 0.45, y: 0.5, z: 1 }, foot);
  assert.ok(p.s * 1 > 0.24, 'covers the toes and the heel');
  assert.ok(p.y < 0 && p.y > -0.02);
});

import { cleanFit } from '../js/core/gear-fit.js';

test('a hand-set fit keeps only real changes, rounded', () => {
  assert.equal(cleanFit(null), null);
  assert.equal(cleanFit({ x: 0, s: 1, rx: 0 }), null, 'nothing changed');
  assert.deepEqual(cleanFit({ y: 0.12345, s: 0.9, rz: '5', junk: 3, z: NaN }), { y: 0.123, s: 0.9, rz: 5 });
});

test('the scalp covers the crown and the nape, never the face or the ears', () => {
  assert.ok(onScalp(0.95, 0.5), 'the crown');
  assert.ok(onScalp(0.4, 0.05), 'the nape, low at the back');
  assert.ok(!onScalp(0.6, 0.95), 'the forehead and face');
  assert.ok(!onScalp(0.5, 0.55), 'the side of the face, below the hairline');
  assert.ok(!onScalp(0.7, 0.5, 0.95), 'the ear, out at the side');
});

test('hats and helmets cut the hair above their brim, the visor none', () => {
  assert.equal(hairCutFor({ id: 'hat-visor', slot: 'hat' }), null);
  assert.ok(hairCutFor({ id: 'hat-cap-navy', slot: 'hat' }) > 0.3);
  assert.ok(hairCutFor({ id: 'helmet-road', slot: 'helmet' }) > 0.3);
  assert.ok(hairCutFor({ id: 'hat-beanie', slot: 'hat' }) < hairCutFor({ id: 'hat-cap-navy', slot: 'hat' }), 'a beanie comes down lower');
});
