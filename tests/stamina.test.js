// Stamina regenerates from a timestamp (js/core/stamina.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAMINA, staminaAt, freshStamina, msToNext, msToFull } from '../js/core/stamina.js';

const MIN = 60e3;

test('fills one point a minute, to the cap, catching up after time away', () => {
  const a = freshStamina(0);
  assert.equal(staminaAt(a, 0), 0);
  assert.equal(staminaAt(a, 59e3), 0);
  assert.equal(staminaAt(a, MIN), 1);
  assert.equal(staminaAt(a, 37 * MIN + 5e3), 37);
  assert.equal(staminaAt(a, 3 * 24 * 60 * MIN), STAMINA.max, 'three days away: full, not more');
  assert.equal(staminaAt({ value: 95, at: 0 }, 10 * MIN), 100);
});

test('a broken anchor is empty, and the clock running backwards never drains it', () => {
  assert.equal(staminaAt(null, 0), 0);
  assert.equal(staminaAt({ value: 'x', at: 0 }, MIN), 0);
  assert.equal(staminaAt({ value: 40, at: 10 * MIN }, 0), 40);
});

test('time to the next point and to full', () => {
  const a = freshStamina(0);
  assert.equal(msToNext(a, 15e3), 45e3);
  assert.equal(msToFull(a, 0), 100 * MIN);
  assert.equal(msToFull({ value: 99, at: 0 }, 30e3), 30e3);
  assert.equal(msToNext({ value: 100, at: 0 }, 5), 0);
});
