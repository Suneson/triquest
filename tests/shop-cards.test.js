// Shop card states (js/core/shop-cards.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardState, cardPlate, storageText } from '../js/core/shop-cards.js';

test('a card you can afford is to buy; one you can not says how much is missing', () => {
  assert.deepEqual(cardState({ cost: 120, balance: 500 }), { state: 'buy', short: 0, storage: null });
  assert.deepEqual(cardState({ cost: 120, balance: 80 }), { state: 'short', short: 40, storage: null });
  assert.equal(cardState({ cost: 120, balance: 120 }).state, 'buy', 'exactly enough is enough');
});

test('storage: full storage wins over the price, and the counter is kept', () => {
  assert.deepEqual(cardState({ cost: 120, balance: 9999, held: 3, max: 3 }), { state: 'max', short: 0, storage: { n: 3, max: 3 } });
  assert.deepEqual(cardState({ cost: 120, balance: 0, held: 3, max: 3 }).state, 'max', 'full even when you could not afford another');
  assert.deepEqual(cardState({ cost: 120, balance: 500, held: 1, max: 3 }), { state: 'buy', short: 0, storage: { n: 1, max: 3 } });
  assert.equal(storageText({ n: 1, max: 3 }), '1/3');
  assert.equal(storageText(null), '');
});

test('owned and in-the-workshop come first', () => {
  assert.equal(cardState({ cost: 100, balance: 0, owned: true }).state, 'owned');
  assert.equal(cardState({ cost: 100, balance: 0, building: true }).state, 'building');
});

test('the plate: blue while there is something to get, grey when full or owned', () => {
  assert.equal(cardPlate('buy'), 'blue');
  assert.equal(cardPlate('short'), 'blue');
  assert.equal(cardPlate('building'), 'blue');
  assert.equal(cardPlate('max'), 'grey');
  assert.equal(cardPlate('owned'), 'grey');
});
