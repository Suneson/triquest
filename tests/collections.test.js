// Collections, blueprints and prestige (js/core/collections.js, docs/LOOP.md §4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLECTION_RULES, PRESTIGE, collectionsFor, collectionAwards, fragmentsEarned, blueprintState, canBuild,
  sportLevel, canPrestige, prestigeBp, prestigeFloor,
} from '../js/core/collections.js';
import { RARE_PROPS, rareById, scenePropsFor, propsFor, SCENES, PROPS } from '../js/core/scenes.js';
import { quadrantPoints } from '../js/core/workshop.js';
import { gearBoost, starRow } from '../js/core/boosts.js';
import { walletFold } from '../js/core/wallet.js';
import { GEAR_RULES } from '../js/core/gear.js';
import { xpToReachLevel } from '../js/core/scoring.js';

const at = (d) => `2026-11-${String(d).padStart(2, '0')}T10:00:00.000Z`;
const set = (sport, slots, tier, day) => slots.map((sl, i) => ({ item_id: `${sport}-${sl}-t${tier}`, acquired_at: at(day + i) }));
const BIKE = ['wheels', 'aerobars', 'frame', 'power'];

test('collections: three empty frames per sport from the start', () => {
  const c = collectionsFor('bike', []);
  assert.deepEqual(c.map((x) => x.tier), [1, 2, 3]);
  assert.ok(c.every((x) => !x.done && x.have === 0 && x.slots.length === 4 && x.at === null));
  assert.deepEqual(c.map((x) => x.coins), COLLECTION_RULES.setCoins.slice(1));
});

test('a set completes when its last slot reaches the tier, at that moment', () => {
  const inv = [...set('bike', BIKE, 1, 1), ...set('bike', ['wheels', 'aerobars', 'frame'], 2, 10)];
  const [t1, t2, t3] = collectionsFor('bike', inv);
  assert.equal(t1.done, true);
  assert.equal(t1.at, at(4), 'the fourth piece completes it');
  assert.equal(t2.done, false);
  assert.equal(t2.have, 3);
  assert.equal(t3.have, 0);
  // a higher tier fills the lower frames too, from when it arrived
  const jump = [...set('run', ['shoes', 'watch', 'kit'], 1, 1), { item_id: 'run-recovery-t1', acquired_at: at(20) }, { item_id: 'run-recovery-t2', acquired_at: at(8) }];
  const r1 = collectionsFor('run', jump)[0];
  assert.equal(r1.at, at(8), 'the tier-2 piece arrived first and counts for tier 1');
});

test('collection awards: every completed set, in time order, with its coins', () => {
  const inv = [...set('bike', BIKE, 1, 1), ...set('gym', ['belt', 'shoes', 'sleeves', 'bar'], 1, 2), ...set('bike', BIKE, 2, 10)];
  const a = collectionAwards(inv);
  assert.deepEqual(a.map((x) => `${x.sport}${x.tier}`), ['bike1', 'gym1', 'bike2']);
  assert.deepEqual(a.map((x) => x.coins), [40, 40, 140]);
  // and the wallet counts them as earnings
  const base = walletFold({});
  const w = walletFold({ awards: a });
  assert.equal(w.coins - base.coins, 220);
  assert.equal(w.earned.coins - base.earned.coins, 220);
});

test('a collection bonus respects the storage cap like any earning', () => {
  const full = walletFold({ moves: [{ id: 1, coins: GEAR_RULES.storageCap, created_at: at(1) }], awards: [{ sport: 'bike', tier: 1, at: at(2), coins: 40 }] });
  assert.equal(full.coins, GEAR_RULES.storageCap);
  assert.equal(full.lost.coins, GEAR_RULES.starterPurse + 40);
});

test('rare props: one per sport, never on sale, placed like props, priced in fragments', () => {
  assert.equal(RARE_PROPS.length, 4);
  for (const sport of Object.keys(SCENES)) {
    const r = RARE_PROPS.filter((p) => p.sport === sport);
    assert.equal(r.length, 1, sport);
    assert.ok(!propsFor(sport).includes(r[0]), 'not in the shop list');
    assert.ok(scenePropsFor(sport).includes(r[0]), 'but drawn in the scene');
  }
  for (const p of RARE_PROPS) {
    assert.equal(rareById(p.id), p);
    assert.ok(!PROPS.some((x) => x.id === p.id));
    assert.ok(p.fragments > 0 && p.points > 0 && p.rare);
    assert.ok(p.anchor.x >= 9 && p.anchor.x + p.anchor.w <= 91, `${p.id} sits within 9% of the sides`);
    const b = SCENES[p.sport].board;
    const a = p.anchor;
    assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.w), `${p.id} overlaps the board`);
  }
  // and they count towards the quadrant
  assert.equal(quadrantPoints('bike', [{ item_id: 'bike-podium' }]), rareById('bike-podium').points);
});

test('fragments: one per mission from the start date; the target shows what is left', () => {
  const since = COLLECTION_RULES.fragmentsSince;
  const quests = [{ day: '2026-10-01', quest_id: 'brick' }, ...Array.from({ length: 30 }, (_, i) => ({ day: since, quest_id: `q${i}` }))];
  assert.equal(fragmentsEarned(quests), 30);
  const s = blueprintState(quests, [], 'run-statue');
  assert.equal(s.free, 30);
  assert.equal(s.target.id, 'run-statue');
  assert.equal(s.left, 0);
  assert.deepEqual(canBuild('run-statue', quests, []), { ok: true });
  // building spends; the second target now has a shortfall
  const after = blueprintState(quests, [{ item_id: 'run-statue' }], 'bike-podium');
  assert.equal(after.spent, 24);
  assert.equal(after.free, 6);
  assert.equal(after.left, 18);
  assert.deepEqual(canBuild('bike-podium', quests, [{ item_id: 'run-statue' }]), { ok: false, reason: 'short' });
  assert.deepEqual(canBuild('run-statue', quests, [{ item_id: 'run-statue' }]), { ok: false, reason: 'built' });
  assert.deepEqual(canBuild('bike-rack', quests, []), { ok: false, reason: 'unknown' }, 'a shop prop is not a blueprint');
  // a built target is no target
  assert.equal(blueprintState(quests, [{ item_id: 'run-statue' }], 'run-statue').target, null);
});

test('prestige: only at the level, resets the level, keeps the scenery, adds a star', () => {
  const need = xpToReachLevel(PRESTIGE.level);
  assert.deepEqual(canPrestige(need - 1, [], 'run'), { ok: false, reason: 'level' });
  assert.deepEqual(canPrestige(need, [], 'run'), { ok: true });
  const p = [{ sport: 'run', star: 1, xp_at: need + 50, created_at: at(5) }];
  const lv = sportLevel(need + 150, p, 'run');
  assert.equal(lv.level, 2, '100 XP after the reset is level 2');
  assert.equal(lv.stars, 1);
  assert.equal(lv.artLevel, PRESTIGE.level, 'the scenery stays');
  assert.equal(prestigeFloor(p, 'run'), need + 50);
  assert.equal(sportLevel(need + 150, p, 'bike').stars, 0, 'per sport');
  assert.deepEqual(canPrestige(need * 3, Array.from({ length: PRESTIGE.maxStars }, (_, i) => ({ sport: 'run', star: i + 1, xp_at: 0 })), 'run'), { ok: false, reason: 'max' });
});

test('a star adds a permanent boost from when it was taken, outside the gear cap', () => {
  const p = [{ sport: 'bike', star: 1, xp_at: 0, created_at: at(5) }];
  assert.equal(prestigeBp(p, 'bike'), PRESTIGE.bonusBp);
  assert.equal(prestigeBp(p, 'bike', at(4)), 0, 'not before');
  assert.equal(prestigeBp(p, 'run'), 0);
  const full = ['wheels', 'aerobars', 'frame', 'power'].map((sl) => ({ item_id: `bike-${sl}-t3`, acquired_at: at(1) }));
  assert.equal(gearBoost(full, 'bike'), GEAR_RULES.sportCapBp);
  const withStar = [...full, starRow('bike', 1, at(5))];
  assert.equal(gearBoost(withStar, 'bike'), GEAR_RULES.sportCapBp + PRESTIGE.bonusBp);
  assert.equal(gearBoost(withStar, 'bike', at(4)), GEAR_RULES.sportCapBp);
  assert.equal(gearBoost(withStar, 'run'), 0);
});
