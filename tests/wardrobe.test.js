import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  OUTFITS, SLOTS, SKIN_TONES, EYE_COLOURS, BODY_MODELS, DEFAULT_LOOK, normaliseLook, outfitState, accessoryState, modelFor, skinTint, ownsItem,
} from '../js/core/wardrobe.js';

const look = (o = {}) => ({ ...DEFAULT_LOOK, gear: { ...DEFAULT_LOOK.gear }, ...o });

test('every body and outfit model is in the repo', () => {
  for (const url of Object.values(BODY_MODELS)) assert.ok(existsSync(url), url);
  for (const o of OUTFITS) for (const url of Object.values(o.models)) assert.ok(existsSync(url), url);
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
  assert.equal(outfitState('tracksuit', look({ cls: 'hybrid' })), 'soon', 'owned, but its models are not made yet');
  assert.equal(outfitState('tracksuit', look({ cls: 'endurance' })), 'soon');
  assert.equal(outfitState('road-racer', look({ cls: 'hybrid' })), 'class');
  assert.equal(outfitState('aero-suit', look()), 'locked');
  assert.equal(outfitState('aero-suit', look(), ['aero-suit']), 'soon');
  assert.equal(normaliseLook({ cls: 'endurance', outfit: 'tracksuit' }).outfit, 'base');
  assert.equal(normaliseLook({ cls: 'hybrid', outfit: 'tracksuit' }).outfit, 'base', 'an outfit with no model falls back to the body');
});

test('the 3D view loads the outfit when it can be worn, the plain body otherwise', () => {
  // one male body, whatever the class
  assert.equal(modelFor(look({ cls: 'hybrid', outfit: 'tracksuit' })), 'models/chars/male.glb');
  assert.equal(modelFor(look({ cls: 'endurance' })), modelFor(look({ cls: 'hybrid' })));
  assert.equal(modelFor(look({ cls: 'endurance', outfit: 'tracksuit' })), 'models/chars/male.glb');
  assert.equal(modelFor(look({ body: 'female', cls: 'hybrid' })), 'models/chars/female.glb');
});

test('accessories: the free trainers are yours, but none has a model yet', () => {
  assert.ok(ownsItem('shoe-starter'));
  assert.equal(accessoryState('shoe-starter'), 'soon');
  assert.equal(accessoryState('helmet-aero'), 'locked');
  assert.equal(normaliseLook({ gear: { shoes: 'shoe-starter' } }).gear.shoes, null);
  for (const s of SLOTS) assert.equal(typeof s.buff, 'boolean');
  assert.deepEqual(SLOTS.filter((s) => s.buff).map((s) => s.id), ['helmet', 'shoes'], 'only helmets and shoes give buffs');
});

test('skin tints: the default leaves the painted skin as it is, darker tones only darken', () => {
  assert.deepEqual(skinTint('fair').map((v) => +v.toFixed(6)), [1, 1, 1]);
  for (const s of SKIN_TONES.slice(1)) for (const v of skinTint(s.id)) assert.ok(v > 0 && v <= 1, s.id);
  assert.equal(EYE_COLOURS.length, new Set(EYE_COLOURS.map((e) => e.id)).size);
});
