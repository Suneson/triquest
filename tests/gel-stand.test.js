import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GELS, SHELF, INGREDIENTS, menu, gelById, gelCost, readyMadeCost, normalise, missing, missingCost, buy, start,
  scorePour, scoreDial, scoreDrops, scoreStir, scoreSeal, stars, boostOf, bagged,
} from '../js/core/gel-stand.js';

test('eight ingredients on the shelf, water free', () => {
  assert.equal(SHELF.length, 8);
  assert.equal(INGREDIENTS.water.cost, 0);
});

test('every gel: known ingredients, steps that end fill then seal, pours that rise', () => {
  for (const g of GELS) {
    for (const ing of Object.keys(g.uses)) assert.ok(INGREDIENTS[ing] && !INGREDIENTS[ing].free, `${g.id} ${ing}`);
    assert.deepEqual(g.steps.slice(-2).map((s) => s.kind), ['fill', 'seal'], g.id);
    let lv = 0;
    for (const s of g.steps.filter((x) => x.kind === 'pour')) { assert.ok(s.to > lv && s.to < 1, `${g.id} ${s.ing}`); lv = s.to; }
    // what's poured is what's used (water aside)
    for (const s of g.steps) if (s.ing && !INGREDIENTS[s.ing].free) assert.ok(g.uses[s.ing], `${g.id} uses ${s.ing}`);
  }
});

test('the menu opens by level', () => {
  assert.deepEqual(menu(1).filter((g) => g.open).map((g) => g.id), ['classic', 'honey']);
  assert.equal(menu(4).filter((g) => g.open).length, GELS.length);
  assert.equal(menu(99).filter((g) => g.open).length, GELS.length);
});

test('costs: the classic gel is 50 g, ready-made 5 times that', () => {
  const g = gelById('classic');
  assert.equal(gelCost(g), 50);
  assert.equal(readyMadeCost(g), 250);
  assert.equal(gelCost(gelById('race')), 95);
});

test('stock: missing, buying, starting', () => {
  const g = gelById('classic');
  let stock = normalise({ stock: { malto: 1 } }).stock;
  assert.deepEqual(missing(stock, g), { fructose: 1, salt: 1 });
  assert.equal(missingCost(stock, g), 30);
  assert.deepEqual(start(stock, g, 1), { error: 'stock' });
  assert.deepEqual(buy(stock, 'fructose', 1, 10), { error: 'carbs' });
  assert.deepEqual(buy(stock, 'water', 1, 100), { error: 'free' });
  let r = buy(stock, 'fructose', 1, 100); stock = r.stock; assert.equal(r.carbs, 80);
  r = buy(stock, 'salt', 2, r.carbs); stock = r.stock; assert.equal(r.carbs, 60);
  const s = start(stock, g, 1);
  assert.deepEqual(s.stock, { ...stock, malto: 0, fructose: 0, salt: 1 });
  assert.deepEqual(start(s.stock, gelById('race'), 1), { error: 'locked' });
});

test('normalise drops junk', () => {
  const n = normalise({ stock: { malto: -3, honey: '2', water: 9 }, bag: [{ id: 'classic', stars: 3 }, { id: 'nope', stars: 2 }, { id: 'honey', stars: 7 }] });
  assert.equal(n.stock.malto, 0); assert.equal(n.stock.honey, 2); assert.equal(n.stock.water, undefined);
  assert.deepEqual(n.bag.map((b) => b.id), ['classic']);
});

test('scores', () => {
  assert.equal(scorePour(0.3, 0.3), 1);
  assert.equal(scorePour(0.31, 0.3), 1);
  assert.ok(scorePour(0.36, 0.3) < 1 && scorePour(0.36, 0.3) > 0.5);
  assert.equal(scorePour(0.9, 0.3), 0);
  // a small pour is judged on its own size, with a floor
  assert.ok(scorePour(0.58, 0.54, 0.3) > 0.5);
  assert.equal(scoreDial(0.45, 0.45), 1);
  assert.equal(scoreDial(0.95, 0.45), 0);
  assert.deepEqual([scoreDrops(2, 2), scoreDrops(3, 2), scoreDrops(5, 2)], [1, 0.5, 0]);
  assert.equal(scoreStir(3, 2), 1);
  assert.equal(scoreStir(3, 0.5), 0.7);
  assert.equal(scoreSeal(1), 1);
  assert.equal(scoreSeal(0.4), 0);
});

test('stars and boosts', () => {
  assert.equal(stars([1, 1, 0.95]), 3);
  assert.equal(stars([1, 0.5, 0.7]), 2);
  assert.equal(stars([0.2, 0.5]), 1);
  const g = gelById('classic');
  assert.deepEqual([1, 2, 3].map((s) => boostOf(g, s)), [2100, 3000, 3450]);
  const beet = gelById('beet');
  assert.equal(boostOf(beet, 2, 'run'), 4500);
  assert.equal(boostOf(beet, 2, 'bike'), 3000);
  assert.deepEqual(bagged([], 'classic', 3, 5), [{ id: 'classic', stars: 3, at: 5 }]);
});
