// How full a market's shelves are (js/core/shop.js shelfFill): the island's restock warnings.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shelfFill, RESTOCK_BELOW, SHOP_RULES } from '../js/core/shop.js';

const now = Date.parse('2026-11-13T12:00:00Z');
const at = (minAgo) => new Date(now - minAgo * 60e3).toISOString();

test('an empty market is all empty shelves', () => {
  const f = shelfFill(3, [], now);
  assert.equal(f.left, 0); assert.equal(f.empty, f.open); assert.equal(f.frac, 0);
});

test('units sold since the shelf was stocked come off what is left', () => {
  const L = SHOP_RULES.levels[0];
  // a tier-1 item sells one every SHOP_RULES.minutes[0] minutes
  const slots = [{ slot: 1, item: 'gym-bands', units: String(L.capacity), since: at(SHOP_RULES.minutes[0] * 3 + 1) }];
  const f = shelfFill(1, slots, now);
  assert.equal(f.left, L.capacity - 3);
  assert.equal(f.empty, 0);
  assert.ok(f.frac < 1 && f.frac > RESTOCK_BELOW);
});

test('a shelf sold right out counts as empty, and shelves past the level are ignored', () => {
  const slots = [{ slot: 1, item: 'gym-bands', units: 2, since: at(600) }, { slot: 9, item: 'gym-rope', units: 50, since: at(0) }];
  const f = shelfFill(1, slots, now);
  assert.equal(f.left, 0); assert.equal(f.empty, 1); assert.equal(f.open, 1);
});
