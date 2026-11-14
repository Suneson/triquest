import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  fitsBody,
  OUTFITS, SLOTS, SKIN_TONES, EYE_COLOURS, HAIR_COLOURS, BODY_MODELS, ACCESSORY_MODELS, DEFAULT_LOOK, TRY_ALL_ACCESSORIES, normaliseLook, outfitState, accessoryState, modelFor, gearFor, skinTint, ownsItem, slotOf,
} from '../js/core/wardrobe.js';

const look = (o = {}) => ({ ...DEFAULT_LOOK, gear: { ...DEFAULT_LOOK.gear }, ...o });

test('every body and outfit model is in the repo', () => {
  for (const url of Object.values(BODY_MODELS)) assert.ok(existsSync(url), url);
  for (const o of OUTFITS) for (const url of Object.values(o.models)) assert.ok(existsSync(url), url);
  for (const [id, url] of Object.entries(ACCESSORY_MODELS)) { assert.ok(existsSync(url), url); assert.ok(slotOf(id), `${id} is in a slot`); }
});

test('ids are unique, and every outfit is for at least one class', () => {
  const ids = [...OUTFITS.map((o) => o.id), ...SLOTS.flatMap((s) => s.items)];
  assert.equal(new Set(ids).size, ids.length);
  for (const o of OUTFITS) assert.ok(o.for.length, o.id);
  assert.equal(SKIN_TONES[0].id, DEFAULT_LOOK.skin, 'the bodies are painted in the first, default tone');
});

test('a broken or empty saved look comes back as the default', () => {
  assert.deepEqual(normaliseLook(null), look());
  assert.deepEqual(normaliseLook({ cls: 'wizard', skin: 'green', eyes: 7, outfit: 'cape', gear: { hat: 'crown' } }), look());
});

test('you only wear what you have, for your class, with a model for your body', () => {
  assert.equal(outfitState('tracksuit', look({ cls: 'endurance' })), 'owned', 'the starter outfit, made');
  assert.equal(outfitState('heavy-day', look({ body: 'female' }), ['heavy-day']), 'soon', 'owned, but not made for her yet');
  assert.equal(outfitState('heavy-day', look(), ['heavy-day']), 'owned', 'made for him');
  assert.equal(normaliseLook({ cls: 'hybrid' }).cls, 'endurance', 'there is no hybrid class any more');
  assert.equal(outfitState('aero-suit', look()), 'locked');
  assert.equal(outfitState('aero-suit', look(), ['aero-suit']), 'owned', 'owned and its models are in');
  assert.equal(normaliseLook({ cls: 'endurance', outfit: 'tracksuit' }).outfit, 'tracksuit');
  assert.equal(normaliseLook({ body: 'female', outfit: 'heavy-day' }).outfit, 'base', 'no model for her: the plain body');
});

test('the 3D view loads the outfit when it can be worn, the plain body otherwise', () => {
  // one male body, whatever the class
  assert.equal(modelFor(look({ cls: 'endurance', outfit: 'tracksuit' })), 'models/chars/tracksuit-male.glb');
  assert.equal(modelFor(look({ body: 'female', outfit: 'heavy-day' })), 'models/chars/female.glb', 'not made for her yet');
  assert.equal(modelFor(look({ body: 'female' })), 'models/chars/female.glb');
});

test('accessories: you wear what you have and what has a model; hair is free', () => {
  assert.ok(ownsItem('shoe-starter'));
  assert.equal(accessoryState('shoe-starter'), 'owned');
  assert.equal(accessoryState('helmet-aero'), TRY_ALL_ACCESSORIES ? 'owned' : 'locked', 'free to try for now');
  assert.equal(accessoryState('helmet-aero', ['helmet-aero']), 'owned');
  assert.equal(accessoryState('watch-gold', ['watch-gold']), 'soon', 'no watch models yet');
  assert.equal(accessoryState('hair-braids'), 'owned', 'every hair style is free');
  if (!TRY_ALL_ACCESSORIES) assert.equal(normaliseLook({ gear: { helmet: 'helmet-aero' } }).gear.helmet, null, 'not bought');
  assert.equal(normaliseLook({ gear: { watch: 'watch-gold' } }).gear.watch, null, 'no model, nothing to wear');
  const l = normaliseLook({ body: 'female', hairColour: 'blonde', gear: { shoes: 'shoe-starter', hair: 'hair-long' } });
  assert.equal(l.gear.shoes, 'shoe-starter'); assert.equal(l.gear.hair, 'hair-long'); assert.equal(l.hairColour, 'blonde');
  assert.deepEqual(gearFor(l).map((g) => [g.slot, g.url]), [['hair', 'models/gear/hair-long.glb'], ['shoes', 'models/gear/shoe-starter.glb']]);
  assert.equal(normaliseLook({ hairColour: 'green' }).hairColour, DEFAULT_LOOK.hairColour);
  assert.ok(HAIR_COLOURS.some((h) => h.id === DEFAULT_LOOK.hairColour));
  for (const s of SLOTS) assert.equal(typeof s.buff, 'boolean');
  assert.deepEqual(SLOTS.filter((s) => s.buff).map((s) => s.id), ['helmet', 'shoes'], 'only helmets and shoes give buffs');
});

test('skin tints: the default leaves the painted skin as it is, darker tones only darken', () => {
  assert.deepEqual(skinTint('fair').map((v) => +v.toFixed(6)), [1, 1, 1]);
  for (const s of SKIN_TONES.slice(1)) for (const v of skinTint(s.id)) assert.ok(v > 0 && v <= 1, s.id);
  assert.equal(EYE_COLOURS.length, new Set(EYE_COLOURS.map((e) => e.id)).size);
});

test('hair is per body: crop and curls for men, the rest for women', () => {
  assert.equal(normaliseLook({ body: 'male', gear: { hair: 'hair-long' } }).gear.hair ?? null, null);
  assert.equal(normaliseLook({ body: 'male', gear: { hair: 'hair-curls' } }).gear.hair, 'hair-curls');
  assert.equal(normaliseLook({ body: 'female', gear: { hair: 'hair-crop' } }).gear.hair ?? null, null);
  assert.equal(normaliseLook({ body: 'female', gear: { hair: 'hair-braids' } }).gear.hair, 'hair-braids');
  assert.equal(fitsBody('hat-visor', 'female'), true, 'only hair is per body');
});
