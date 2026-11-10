// wardrobe.js: what a character can wear, and how a look is checked (js/app/wardrobe-view.js).
//
// A look is: a class (endurance or hybrid, for the stats), a body (male or female, a look only),
// a skin tone, an eye colour, one outfit, and one accessory per slot. Outfits are complete sets
// (BUILD-PLAN.md section 2); helmets and shoes give buffs, hats, glasses and watches are looks only.
// Only the bodies and the tracksuit have models so far: everything else is listed so you can see
// what's coming, and can't be worn yet.

export const CLASSES = ['endurance', 'hybrid'];
export const BODY_LOOKS = ['male', 'female'];

/** The model each class and body wears under its clothes (tools/prep-bodies.mjs). */
export const BODY_MODELS = {
  'endurance-male': 'models/bodies/endurance.glb',
  'hybrid-male': 'models/bodies/hybrid.glb',
  'endurance-female': 'models/bodies/female.glb',
  'hybrid-female': 'models/bodies/female.glb',
};

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
 * by class and body. `base` is the plain body: everyone has it.
 */
export const OUTFITS = [
  { id: 'base', kind: 'starter', for: CLASSES, models: {} },
  { id: 'tracksuit', kind: 'shop', for: CLASSES, models: { 'hybrid-male': 'models/bodies/hybrid-tracksuit.glb' } },
  { id: 'starter-tee', kind: 'shop', for: CLASSES, models: {} },
  { id: 'navy-training', kind: 'shop', for: CLASSES, models: {} },
  { id: 'white-gold', kind: 'shop', for: CLASSES, models: {} },
  { id: 'blue-half-zip', kind: 'shop', for: CLASSES, models: {} },
  { id: 'sky-club', kind: 'shop', for: CLASSES, models: {} },
  { id: 'road-racer', kind: 'shop', for: ['endurance'], models: {} },
  { id: 'distance', kind: 'shop', for: ['endurance'], models: {} },
  { id: 'iron-gym', kind: 'shop', for: ['hybrid'], models: {} },
  { id: 'heavy-day', kind: 'shop', for: ['hybrid'], models: {} },
  { id: 'aero-suit', kind: 'blueprint', for: CLASSES, models: {} },
  { id: 'tri-pro', kind: 'blueprint', for: CLASSES, models: {} },
  { id: 'storm-shell', kind: 'blueprint', for: CLASSES, models: {} },
  { id: 'gold-line', kind: 'blueprint', for: CLASSES, models: {} },
  { id: 'marathon-elite', kind: 'blueprint', for: ['endurance'], models: {} },
  { id: 'forge', kind: 'blueprint', for: ['hybrid'], models: {} },
  { id: 'first-finisher', kind: 'earned', for: CLASSES, models: {} },
  { id: 'streak-keeper', kind: 'earned', for: CLASSES, models: {} },
  { id: 'clan-champion', kind: 'earned', for: CLASSES, models: {} },
];

/** Accessory slots, in the order the wardrobe lists them. `buff`: it helps your training. */
export const SLOTS = [
  { id: 'helmet', buff: true, items: ['helmet-road', 'helmet-aero', 'helmet-blue', 'helmet-gold'] },
  { id: 'shoes', buff: true, items: ['shoe-starter', 'shoe-runner', 'shoe-racer', 'shoe-trail', 'shoe-lifter', 'shoe-trainer', 'shoe-cycling', 'shoe-gold'] },
  { id: 'hat', buff: false, items: ['hat-cap-navy', 'hat-cap-white', 'hat-visor', 'hat-beanie', 'hat-bucket', 'hat-gold'] },
  { id: 'glasses', buff: false, items: ['glasses-sport', 'glasses-blue', 'glasses-gold', 'glasses-casual'] },
  { id: 'watch', buff: false, items: ['watch-basic', 'watch-blue', 'watch-gold'] },
];
/** Accessory models made so far, by item id. None yet. */
export const ACCESSORY_MODELS = {};

/**
 * What every player has before buying anything: the plain body, the tracksuit (for now the one
 * outfit with a model, so the wardrobe has something to try on) and the free trainers.
 */
export const STARTER = ['base', 'tracksuit', 'shoe-starter'];

export const DEFAULT_LOOK = Object.freeze({
  cls: 'endurance', body: 'male', skin: 'fair', eyes: 'brown', outfit: 'base',
  gear: Object.freeze({ helmet: null, shoes: null, hat: null, glasses: null, watch: null }),
});

const outfitById = (id) => OUTFITS.find((o) => o.id === id) || null;
export const slotOf = (item) => SLOTS.find((s) => s.items.includes(item))?.id || null;

/** Do you have it? `owned`: the item ids in your inventory. */
export const ownsItem = (id, owned = []) => STARTER.includes(id) || owned.includes(id);

/** The model for this outfit on this class and body, or null when it isn't made yet. */
export function outfitModel(outfitId, look) {
  const o = outfitById(outfitId);
  if (!o) return null;
  if (o.id === 'base') return BODY_MODELS[`${look.cls}-${look.body}`];
  return o.models[`${look.cls}-${look.body}`] || null;
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

/** The same for an accessory. */
export function accessoryState(item, owned = []) {
  if (!slotOf(item)) return 'locked';
  if (!ownsItem(item, owned)) return 'locked';
  if (!ACCESSORY_MODELS[item]) return 'soon';
  return 'owned';
}

/** What the 3D view loads: the outfit's model if it can be worn, else the plain body. */
export const modelFor = (look, owned = []) =>
  (outfitState(look.outfit, look, owned) === 'owned' ? outfitModel(look.outfit, look) : BODY_MODELS[`${look.cls}-${look.body}`]);

/** A saved look, checked: anything unknown or not allowed goes back to the default. */
export function normaliseLook(raw, owned = []) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const look = {
    cls: pick(r.cls, CLASSES, DEFAULT_LOOK.cls),
    body: pick(r.body, BODY_LOOKS, DEFAULT_LOOK.body),
    skin: pick(r.skin, SKIN_TONES.map((s) => s.id), DEFAULT_LOOK.skin),
    eyes: pick(r.eyes, EYE_COLOURS.map((e) => e.id), DEFAULT_LOOK.eyes),
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
