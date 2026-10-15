import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSport } from '../js/app/swipe.js';

const ORDER = ['bike', 'swim', 'run', 'gym'];

test('swipe left moves to the next sport, right to the previous', () => {
  assert.equal(nextSport(ORDER, 'bike', 'left'), 'swim');
  assert.equal(nextSport(ORDER, 'run', 'right'), 'swim');
});

test('swipes stop at the ends instead of wrapping', () => {
  assert.equal(nextSport(ORDER, 'gym', 'left'), null);
  assert.equal(nextSport(ORDER, 'bike', 'right'), null);
});

test('an unknown current sport starts from the first', () => {
  assert.equal(nextSport(ORDER, 'brick', 'left'), 'swim');
});
