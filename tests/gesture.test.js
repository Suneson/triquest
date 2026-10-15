import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EDGE, inEdge, classify, progress, velocity, shouldComplete, beneathOffset, scrimOpacity } from '../js/core/gesture.js';

test('only the left 24px start a back swipe', () => {
  assert.equal(EDGE, 24);
  assert.ok(inEdge(0));
  assert.ok(inEdge(24));
  assert.ok(!inEdge(25));
  assert.ok(!inEdge(-1));
});

test('classify waits for the slop, then picks a direction', () => {
  assert.equal(classify(4, 3), null);
  assert.equal(classify(20, 5), 'back');
  assert.equal(classify(5, 20), 'other');   // vertical scroll keeps working
  assert.equal(classify(-20, 2), 'other');  // leftward is never back
});

test('release past 40% or a flick completes; otherwise it springs back', () => {
  assert.ok(shouldComplete(160, 390, 0.1));   // 41%
  assert.ok(!shouldComplete(150, 390, 0.1));  // 38%
  assert.ok(shouldComplete(60, 390, 0.6));    // short but fast
  assert.ok(!shouldComplete(60, 390, 0.4));
  assert.ok(!shouldComplete(-30, 390, 2));    // dragged back past the start
});

test('velocity uses the recent window', () => {
  const s = [{ x: 0, t: 0 }, { x: 10, t: 100 }, { x: 40, t: 150 }, { x: 100, t: 200 }];
  assert.equal(velocity(s, 80), (100 - 10) / 100);
  assert.equal(velocity([{ x: 0, t: 0 }]), 0);
});

test('progress, parallax and scrim move together', () => {
  assert.equal(progress(195, 390), 0.5);
  assert.equal(progress(500, 390), 1);
  assert.equal(progress(-5, 390), 0);
  assert.equal(beneathOffset(0, 400), -80);
  assert.equal(beneathOffset(1, 400), -0);
  assert.equal(scrimOpacity(0), 0.5);
  assert.equal(scrimOpacity(1), 0);
});

test('pull to refresh: damped, capped, armed past the line', async () => {
  const { pullState, PULL_READY, PULL_MAX } = await import('../js/core/gesture.js');
  assert.deepEqual(pullState(-20), { offset: 0, frac: 0, ready: false });
  assert.equal(pullState(64).frac, 0.5);
  assert.equal(pullState(PULL_READY * 2).ready, true);
  assert.equal(pullState(PULL_READY * 2 - 2).ready, false);
  assert.equal(pullState(1000).offset, PULL_MAX);
});
