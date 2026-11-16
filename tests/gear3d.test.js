import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import { place, onScalp, onHead, headMatrix } from '../js/app/gear3d.js';

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

test('hair made on the head is stretched onto the head box', () => {
  assert.ok(onHead('hair-m-fade') && onHead('hair-f-bob'));
  assert.ok(!onHead('hat-cap-navy') && !onHead('hair-crop'));
  const box = new THREE.Box3(new THREE.Vector3(-0.12, 1.54, -0.14), new THREE.Vector3(0.12, 1.8, 0.13));
  const m = headMatrix(THREE, box, null);
  const lo = new THREE.Vector3(0, 0, 0).applyMatrix4(m), hi = new THREE.Vector3(1, 1, 1).applyMatrix4(m);
  assert.ok(lo.distanceTo(box.min) < 1e-9 && hi.distanceTo(box.max) < 1e-9, '0..1 is the head box');
  // a hand-set move is in head heights, a size change keeps the head's middle
  const up = new THREE.Vector3(0.5, 0.5, 0.5).applyMatrix4(headMatrix(THREE, box, { y: 0.1, s: 1.2 }));
  assert.ok(Math.abs(up.y - (1.67 + 0.026)) < 1e-9);
});
