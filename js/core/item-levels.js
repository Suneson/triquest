// item-levels.js: the base items that come in levels (MOSKE APP/Island/ITEM-LEVELS.md).
//
// Each unlocks at a base level and is drawn there in that level's theme (its level 1); every level
// after takes the next theme, up to the base's top (10), so an item that unlocks late has fewer.
// Pictures: icons/Items/<id>-lv<n>-<a|b>.webp, cut from the repaints by
// tools/render-items/cutout-levels.py. The hidden machines also have a closed "in use" picture,
// <id>-lv<n>-in-use-<a|b>.webp.
//
// [id, w, h, unlocks at base level, kind, extra]: w x h its footprint facing a in tiles (before
// placement.js GROW), measured from its Tripo model at 0.6 m a tile.

export const LEVEL_ITEMS = [
  // the core three (the bike is its own model: models/bikes, js/core/bike-fit.js)
  ['treadmill', 2, 3, 1, 'core'],
  ['pool', 4, 7, 1, 'core'],
  // recovery machines
  ['ice-bath', 2, 3, 1, 'machine'],
  ['hot-tub', 4, 4, 2, 'machine'],
  ['massage-gun', 1, 1, 2, 'machine'],
  ['massage-table', 2, 3, 3, 'machine'],
  ['boots', 2, 3, 3, 'machine'],
  ['sauna', 3, 3, 4, 'machine', { inUse: true }],
  ['float-pod', 3, 4, 5, 'machine', { inUse: true }],
  ['contrast-plunge', 4, 5, 6, 'machine'],
  ['hydro-treadmill', 4, 3, 7, 'machine'],
  ['cryo', 3, 3, 8, 'machine', { inUse: true }],
  ['hyperbaric', 2, 5, 9, 'machine', { inUse: true }],
  ['antigrav-treadmill', 3, 4, 10, 'machine'],
  // decor: one version each
  ['cone-stack', 1, 2, 1, 'decor'],
  ['agility-ladder', 3, 5, 2, 'decor', { flat: true }],
  ['kickboards', 2, 2, 2, 'decor'],
  ['hydration-table', 1, 1, 2, 'decor'],
  ['hurdles', 2, 2, 3, 'decor'],
  ['start-blocks', 1, 2, 3, 'decor'],
  ['pool-start-block', 1, 1, 3, 'decor', { sides: 4 }],
  ['buoy-bin', 1, 1, 3, 'decor'],
  ['shoe-wall', 1, 3, 4, 'decor'],
  ['towel-cart', 1, 2, 4, 'decor'],
  ['pool-bench', 1, 3, 4, 'decor'],
  ['fins-rack', 2, 1, 4, 'decor'],
  ['pool-shower', 2, 2, 5, 'decor'],
  ['diving-board', 2, 5, 5, 'decor'],
  ['pool-pace-clock', 1, 2, 5, 'decor'],
  ['watch-dock', 2, 2, 6, 'decor'],
  ['run-pace-clock', 2, 2, 6, 'decor'],
  ['finish-arch', 2, 8, 7, 'decor'],
  ['water-fountain', 1, 1, 8, 'decor'],
  ['podium', 2, 4, 9, 'decor'],
  ['legend-statue', 2, 2, 10, 'decor'],
];

/** The levels painted so far for each (the rest wait for their repaints). */
export const PAINTED = {
  treadmill: 10, pool: 10, 'ice-bath': 10, 'hot-tub': 9, 'massage-table': 8, sauna: 7, 'float-pod': 6,
  'contrast-plunge': 5, 'hydro-treadmill': 4, cryo: 3, hyperbaric: 2,
};

export const levelItem = (id) => LEVEL_ITEMS.find((r) => r[0] === id) || null;

/** How many levels an item has: from its unlock level to the base's 10th (decor: one). */
export function maxLevel(id) {
  const r = levelItem(id);
  if (!r) return 1;
  return r[4] === 'decor' ? 1 : Math.min(11 - r[3], PAINTED[id] || 1);
}

/** The picture of `id` at level `n` (clamped to what's painted), facing `face`. */
export const levelArt = (id, n, face = 'a') => `icons/Items/${id}-lv${Math.max(1, Math.min(maxLevel(id), Number(n) || 1))}-${face}.webp`;
