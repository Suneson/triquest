import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GELS, SHELF, INGREDIENTS, menu, gelById, gelCost, readyMadeCost, normalise, missing, missingCost, buy, fill, STOCK_MAX, start,
  scorePour, scoreDial, scoreSalt, sweetSpot, verdict, scoreDrops, scoreStir, scoreSeal, stars, boostOf, bagged, UPGRADES, nextUpgrade, levelOf, MAX_LEVEL, startUpgrade, settleBuild, buildLeft, buildOf,
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
  assert.deepEqual(menu(2).filter((g) => g.open && g.level === 2).map((g) => g.id), ['maple', 'hydro']);
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
  // better gels come with the levels: no level's best is weaker than the one before
  const best = (n) => Math.max(...GELS.filter((x) => x.level === n).map((x) => x.boostBp));
  for (let n = 2; n <= 4; n++) assert.ok(best(n) > best(n - 1), `level ${n}`);
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
  assert.deepEqual([1, 2, 3].map((s) => boostOf(g, s)), [1800, 3000, 4200]);
  assert.deepEqual([1, 2, 3].map((s) => boostOf(gelById('honey'), s)), [1500, 2500, 3500]);
  const beet = gelById('beet');
  assert.equal(boostOf(beet, 2, 'run'), 5500);
  assert.equal(boostOf(beet, 2, 'bike'), 4000);
  assert.deepEqual(bagged([], 'classic', 3, 5), [{ id: 'classic', stars: 3, at: 5 }]);
});

test('levels: saved level made safe, upgrades cost more each time, none past the top', () => {
  assert.deepEqual([levelOf(null), levelOf({ level: 3 }), levelOf({ level: 99 }), levelOf({ level: 'x' })], [1, 3, MAX_LEVEL, 1]);
  for (let n = 3; n <= MAX_LEVEL; n++) assert.ok(UPGRADES[n].coins > UPGRADES[n - 1].coins && UPGRADES[n].hours > UPGRADES[n - 1].hours);
  assert.deepEqual(nextUpgrade(1), UPGRADES[2]);
  assert.equal(nextUpgrade(MAX_LEVEL), null);
});

test('upgrading: coins at once, then the build hours, then the level', () => {
  const t0 = 1_000_000;
  assert.deepEqual(startUpgrade({ level: 1 }, 100, t0), { error: 'coins' });
  assert.deepEqual(startUpgrade({ level: MAX_LEVEL }, 1e9, t0), { error: 'top' });
  const r = startUpgrade({ level: 1 }, 1000, t0);
  assert.equal(r.coins, 1000 - UPGRADES[2].coins);
  const saved = { level: 1, build: r.build };
  assert.deepEqual(startUpgrade(saved, 1e9, t0), { error: 'busy' });
  assert.equal(buildLeft(saved, t0), UPGRADES[2].hours * 3600e3);
  assert.equal(settleBuild(saved, t0 + 1000), saved);            // not done: nothing changes
  const done = settleBuild(saved, r.build.done);
  assert.equal(levelOf(done), 2);
  assert.equal(buildOf(done), null);
  // a build that doesn't match the level is junk
  assert.equal(buildOf({ level: 3, build: r.build }), null);
});

test('salt is shaken in; sweet spots hold the scores of 0.8 and up; verdicts', () => {
  for (const g of GELS) for (const st of g.steps) if (st.ing === 'salt') assert.equal(st.kind, 'salt', g.id);
  assert.equal(scoreSalt(0.45, 0.45), 1);
  const s = { kind: 'salt', to: 0.45 };
  const [lo, hi] = sweetSpot(s);
  assert.ok(scoreSalt(lo + 1e-6, 0.45) >= 0.8 && scoreSalt(hi - 1e-6, 0.45) >= 0.8);
  assert.ok(scoreSalt(hi + 0.02, 0.45) < 0.8);
  const p = { kind: 'pour', to: 0.54 };
  const [plo, phi] = sweetSpot(p, 0.3);
  assert.ok(scorePour(plo + 1e-6, 0.54, 0.3) >= 0.8 && scorePour(phi - 1e-6, 0.54, 0.3) >= 0.8);
  assert.ok(scorePour(phi + 0.02, 0.54, 0.3) < 0.8);
  assert.deepEqual([verdict(1), verdict(0.7), verdict(0.2, 0.9, 0.5), verdict(0.2, 0.1, 0.5)], ['exact', 'good', 'over', 'under']);
});

test('a restock bag fills the bar as far as the carbs pay, one price a bar', () => {
  assert.equal(STOCK_MAX, 4);
  assert.deepEqual(fill({ malto: 4 }, 'malto', 999), { error: 'full' });
  assert.deepEqual(fill({ malto: 0 }, 'malto', 19), { error: 'carbs' });
  assert.deepEqual(fill({}, 'water', 99), { error: 'free' });
  let r = fill({ malto: 1 }, 'malto', 1000);
  assert.equal(r.n, 3); assert.equal(r.stock.malto, 4); assert.equal(r.cost, 60); assert.equal(r.carbs, 940);
  r = fill({ malto: 0 }, 'malto', 45);   // only two bars' worth
  assert.equal(r.n, 2); assert.equal(r.stock.malto, 2); assert.equal(r.carbs, 5);
});
