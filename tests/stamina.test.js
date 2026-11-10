// Stamina regenerates from a timestamp (js/core/stamina.js): empty to full in 30 hours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAMINA, staminaAt, freshStamina, msToNext, msToFull, staminaSet, staminaAdd } from '../js/core/stamina.js';

const MIN = 60e3;
const STEP = STAMINA.regenSec * 1000;   // 18 minutes a point

test('empty to full takes 30 hours, a point every 18 minutes, and never goes past the cap', () => {
  const a = { value: 0, at: 0 };
  assert.equal(STEP, 18 * MIN);
  assert.equal(staminaAt(a, STEP - 1), 0);
  assert.equal(staminaAt(a, STEP), 1);
  assert.equal(staminaAt(a, 15 * 3600e3), 50, 'half way in 15 hours');
  assert.equal(staminaAt(a, 30 * 3600e3), STAMINA.max);
  assert.equal(staminaAt(a, 3 * 24 * 3600e3), STAMINA.max, 'three days away: full, not more');
});

test('a new athlete starts rested', () => {
  assert.equal(staminaAt(freshStamina(0), 0), STAMINA.max);
});

test('a broken anchor is empty, and the clock running backwards never drains it', () => {
  assert.equal(staminaAt(null, 0), 0);
  assert.equal(staminaAt({ value: 'x', at: 0 }, MIN), 0);
  assert.equal(staminaAt({ value: 40, at: 10 * MIN }, 0), 40);
});

test('time to the next point and to full', () => {
  const a = { value: 0, at: 0 };
  assert.equal(msToNext(a, 15e3), STEP - 15e3);
  assert.equal(msToFull(a, 0), 100 * STEP);
  assert.equal(msToFull({ value: 99, at: 0 }, 30e3), STEP - 30e3);
  assert.equal(msToNext({ value: 100, at: 0 }, 5), 0);
});

test('set and add move the anchor, kept between 0 and the cap', () => {
  assert.deepEqual(staminaSet(120, 5), { value: 100, at: 5 });
  assert.deepEqual(staminaSet(-3, 5), { value: 0, at: 5 });
  assert.deepEqual(staminaAdd({ value: 40, at: 0 }, 15, 2 * STEP), { value: 57, at: 2 * STEP });
});
