// wardrobe.js: what a character can wear, and how a look is checked (js/app/wardrobe-view.js).
//
// A look is: a class (endurance only since November 2026: there is no hybrid athlete), a body (male or female, a look only),
// a skin tone, an eye colour, a hair style and colour, one outfit, and one accessory per slot. Outfits are complete sets
// (BUILD-PLAN.md section 2); helmets and shoes give buffs, hats, glasses and watches are looks only.
// There is one male body and one female body (BUILD-PLAN.md section 2, 10 November 2026): the
// class changes your stats, never your shape. Every outfit is listed so you can see what's coming,
// and can't be worn until its two models are in (tools/build-characters.mjs makes them).

export const CLASSES = ['endurance'];
export const BODY_LOOKS = ['male', 'female'];

const CHARS = 'models/chars';
/** The two bodies (tools/build-characters.mjs): the same for both classes. */
export const BODY_MODELS = {
  male: `${CHARS}/male.glb`,
  female: `${CHARS}/female.glb`,
};
/** Each body's clips: one file drives the body and every outfit made for it. */
export const BODY_CLIPS = {
  male: `${CHARS}/male-clips.glb`,
  female: `${CHARS}/female-clips.glb`,
};
/** The clips every body has (docs/CHARACTERS.md). */
export const CLIPS = ['idle', 'walk', 'run-slow', 'run', 'run-fast', 'swim', 'squat', 'pushup', 'sit', 'taunt1', 'taunt2', 'victory'];
const made = (id) => ({ male: `${CHARS}/${id}-male.glb`, female: `${CHARS}/${id}-female.glb` });

/** Skin tones, lightest first. The bodies are painted in the first, the default. */
export const SKIN_TONES = [
  { id: 'fair', hex: '#EEC9B2' },
  { id: 'light', hex: '#E2B393' },
  { id: 'warm', hex: '#D19C76' },
  { id: 'medium', hex: '#B9825C' },
  { id: 'tan', hex: '#9A6644' },
  { id: 'brown', hex: '#7A4C31' },
  { id: 'deep', hex: '#5A3624' },
  { id: 'ebony', hex: '#3F261A' },
];
/** Hair colours: the hair models are painted grey and multiplied by one of these. */
export const HAIR_COLOURS = [
  { id: 'black', hex: '#2A2522' },
  { id: 'dark', hex: '#4A3426' },
  { id: 'brown', hex: '#7A5232' },
  { id: 'auburn', hex: '#8E4A2C' },
  { id: 'blonde', hex: '#D2AE6E' },
  { id: 'platinum', hex: '#E8E0D0' },
];
export const EYE_COLOURS = [
  { id: 'brown', hex: '#6B4226' },
  { id: 'hazel', hex: '#8A6A35' },
  { id: 'amber', hex: '#B07A2A' },
  { id: 'green', hex: '#4E7D47' },
  { id: 'blue', hex: '#3E6FB8' },
  { id: 'grey', hex: '#7D8896' },
];

/**
 * Outfits (BUILD-PLAN.md section 8). `for`: the classes that can wear it. `models`: the made ones,
 * by body (`male`, `female`). `base` is the plain body: everyone has it.
 */
export const OUTFITS = [
  { id: 'base', kind: 'starter', for: CLASSES, models: {} },
  { id: 'tracksuit', kind: 'shop', for: CLASSES, models: {} },
  { id: 'starter-tee', kind: 'shop', for: CLASSES, models: {} },
  { id: 'navy-training', kind: 'shop', for: CLASSES, models: {} },
  { id: 'white-gold', kind: 'shop', for: CLASSES, models: {} },
  { id: 'blue-half-zip', kind: 'shop', for: CLASSES, models: {} },
  { id: 'sky-club', kind: 'shop', for: CLASSES, models: {} },
  { id: 'road-racer', kind: 'shop', for: CLASSES, models: made('road-racer') },
  { id: 'distance', kind: 'shop', for: CLASSES, models: {} },
  { id: 'iron-gym', kind: 'shop', for: CLASSES, models: {} },
  { id: 'heavy-day', kind: 'shop', for: CLASSES, models: {} },
  { id: 'aero-suit', kind: 'blueprint', for: CLASSES, models: {} },
  { id: 'tri-pro', kind: 'blueprint', for: CLASSES, models: {} },
  { id: 'storm-shell', kind: 'blueprint', for: CLASSES, models: made('storm-shell') },
  { id: 'gold-line', kind: 'blueprint', for: CLASSES, models: {} },
  { id: 'marathon-elite', kind: 'blueprint', for: CLASSES, models: {} },
  { id: 'forge', kind: 'blueprint', for: CLASSES, models: {} },
  { id: 'first-finisher', kind: 'earned', for: CLASSES, models: {} },
  { id: 'streak-keeper', kind: 'earned', for: CLASSES, models: {} },
  { id: 'clan-champion', kind: 'earned', for: CLASSES, models: {} },
];

/**
 * Accessory slots, in the order the wardrobe lists them. `buff`: it helps your training. `free`:
 * everyone has every item (hair is part of the look, on the Look tab).
 */
export const SLOTS = [
  { id: 'hair', buff: false, free: true, items: ['hair-crop', 'hair-curls', 'hair-long', 'hair-braids', 'hair-bun-top', 'hair-bun-low', 'hair-buns'] },
  { id: 'helmet', buff: true, items: ['helmet-road', 'helmet-aero', 'helmet-blue', 'helmet-gold'] },
  { id: 'shoes', buff: true, items: ['shoe-starter', 'shoe-runner', 'shoe-racer', 'shoe-trail', 'shoe-lifter', 'shoe-trainer', 'shoe-cycling', 'shoe-gold'] },
  { id: 'hat', buff: false, items: ['hat-cap-navy', 'hat-cap-white', 'hat-visor', 'hat-beanie', 'hat-bucket', 'hat-gold'] },
  { id: 'glasses', buff: false, items: ['glasses-sport', 'glasses-blue', 'glasses-gold', 'glasses-casual'] },
  { id: 'watch', buff: false, items: ['watch-basic', 'watch-blue', 'watch-gold'] },
];
/** Accessory models made so far (tools/build-accessories.mjs), by item id. */
export const ACCESSORY_MODELS = Object.fromEntries([
  'hair-crop', 'hair-curls', 'hair-long', 'hair-braids', 'hair-bun-top', 'hair-bun-low', 'hair-buns',
  'helmet-road', 'helmet-aero', 'helmet-blue', 'helmet-gold',
  'shoe-starter', 'shoe-runner', 'shoe-racer', 'shoe-trail', 'shoe-lifter', 'shoe-trainer', 'shoe-cycling', 'shoe-gold',
  'hat-cap-navy', 'hat-cap-white', 'hat-visor', 'hat-beanie', 'hat-bucket', 'hat-gold',
  'glasses-sport', 'glasses-blue', 'glasses-gold', 'glasses-casual',
].map((id) => [id, `models/gear/${id}.glb`]));

/** What every player has before buying anything: the plain body, the tracksuit and the free trainers. */
export const STARTER = ['base', 'tracksuit', 'shoe-starter'];

export const DEFAULT_LOOK = Object.freeze({
  cls: 'endurance', body: 'male', skin: 'fair', eyes: 'brown', hairColour: 'dark', outfit: 'base',
  gear: Object.freeze({ hair: null, helmet: null, shoes: null, hat: null, glasses: null, watch: null }),
});

const outfitById = (id) => OUTFITS.find((o) => o.id === id) || null;
export const slotOf = (item) => SLOTS.find((s) => s.items.includes(item))?.id || null;

/** Do you have it? `owned`: the item ids in your inventory. */
export const ownsItem = (id, owned = []) => STARTER.includes(id) || owned.includes(id) || !!SLOTS.find((s) => s.free && s.items.includes(id));

/** The model for this outfit on this body, or null when it isn't made yet. */
export function outfitModel(outfitId, look) {
  const o = outfitById(outfitId);
  if (!o) return null;
  if (o.id === 'base') return BODY_MODELS[look.body];
  return o.models[look.body] || null;
}

/**
 * Can this look put the outfit on? `owned` | `class` (not for your class) | `locked` (you
 * haven't got it) | `soon` (no model for your body yet).
 */
export function outfitState(outfitId, look, owned = []) {
  const o = outfitById(outfitId);
  if (!o) return 'locked';
  if (!o.for.includes(look.cls)) return 'class';
  if (!ownsItem(o.id, owned)) return 'locked';
  if (!outfitModel(o.id, look)) return 'soon';
  return 'owned';
}

/**
 * While the accessories are being tried out, everyone can wear every one that has a model.
 * Turn this off when they go on sale in the shop.
 */
export const TRY_ALL_ACCESSORIES = true;

/** The same for an accessory. */
export function accessoryState(item, owned = []) {
  if (!slotOf(item)) return 'locked';
  if (!ownsItem(item, owned) && !(TRY_ALL_ACCESSORIES && ACCESSORY_MODELS[item])) return 'locked';
  if (!ACCESSORY_MODELS[item]) return 'soon';
  return 'owned';
}

/** What the 3D view loads: the outfit's model if it can be worn, else the plain body. */
export const modelFor = (look, owned = []) =>
  (outfitState(look.outfit, look, owned) === 'owned' ? outfitModel(look.outfit, look) : BODY_MODELS[look.body]);

/** What the 3D view hangs on the character: [{ id, slot, url }], only what can be worn. */
export const gearFor = (look, owned = []) => SLOTS
  .map((s) => ({ id: look.gear?.[s.id], slot: s.id }))
  .filter((g) => g.id && accessoryState(g.id, owned) === 'owned')
  .map((g) => ({ ...g, url: ACCESSORY_MODELS[g.id] }));

/** The hair colour as linear RGB, for the 3D view. */
export const hairColour = (id) => hexToLinear((HAIR_COLOURS.find((h) => h.id === id) || HAIR_COLOURS[1]).hex);

/** The clips file for this look's body. */
export const clipsFor = (look) => BODY_CLIPS[look.body] || BODY_CLIPS.male;

/** Every outfit's and accessory's id: what an admin or the demo may try on. */
export const ALL_OUTFITS = [...OUTFITS.map((o) => o.id), ...SLOTS.flatMap((s) => s.items)];

/** A saved look, checked: anything unknown or not allowed goes back to the default. */
export function normaliseLook(raw, owned = []) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const look = {
    cls: pick(r.cls, CLASSES, DEFAULT_LOOK.cls),
    body: pick(r.body, BODY_LOOKS, DEFAULT_LOOK.body),
    skin: pick(r.skin, SKIN_TONES.map((s) => s.id), DEFAULT_LOOK.skin),
    eyes: pick(r.eyes, EYE_COLOURS.map((e) => e.id), DEFAULT_LOOK.eyes),
    hairColour: pick(r.hairColour, HAIR_COLOURS.map((h) => h.id), DEFAULT_LOOK.hairColour),
    outfit: 'base',
    gear: { ...DEFAULT_LOOK.gear },
  };
  if (outfitState(r.outfit, look, owned) === 'owned') look.outfit = r.outfit;
  for (const slot of SLOTS) {
    const item = r.gear?.[slot.id];
    if (slot.items.includes(item) && accessoryState(item, owned) === 'owned') look.gear[slot.id] = item;
  }
  return look;
}

/** A hex colour as linear RGB (0–1), for the 3D view's tint. */
export function hexToLinear(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
}

/** How much to multiply the painted (fair) skin by to get this tone, per channel in linear light. */
export function skinTint(id) {
  const base = hexToLinear(SKIN_TONES[0].hex);
  const want = hexToLinear((SKIN_TONES.find((s) => s.id === id) || SKIN_TONES[0]).hex);
  return want.map((w, i) => w / base[i]);
}

export const eyeColour = (id) => hexToLinear((EYE_COLOURS.find((e) => e.id === id) || EYE_COLOURS[0]).hex);
