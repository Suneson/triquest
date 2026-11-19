// builders.js: the club's four builders on the single-plot base (?plot=1, docs/PLOT.md).
// Each builder works from a hut on its own pad (icons/Items/builder-<who>-2-<a|b>.webp, made by
// tools/render-items/make-builders.py). You start with the blue one, the head mechanic; the other
// three are bought in the shop's Base tab. A hut is an item like any other: move it anywhere on the
// lawn, turn it, put it away.

/**
 * who        the builder's colour (its item id is builder-<who>)
 * cost       coins (0: everyone has it from the start). Prices are a first guess, to be tuned.
 * spot/face  where its hut is first set down: round the platform, a tile out from it, its door
 *            towards the lawn (a: down-left, the stairs' side; b: down-right, the right side)
 */
export const BUILDERS = [
  { who: 'blue', cost: 0, spot: [28, 4], face: 'b' },
  { who: 'red', cost: 1500, spot: [28, 12], face: 'b' },
  { who: 'green', cost: 3000, spot: [4, 28], face: 'a' },
  { who: 'gold', cost: 6000, spot: [19, 28], face: 'a' },
];

export const builderId = (who) => `builder-${who}`;
export const builderById = (id) => BUILDERS.find((b) => builderId(b.who) === id) || null;
/** Is this builder yours? The first one always; the others once bought (an inventory row). */
export const hasBuilder = (b, inventory) => b.cost === 0 || (inventory || []).some((r) => r.item_id === builderId(b.who));
/** How many builders you have. */
export const builderCount = (inventory) => BUILDERS.filter((b) => hasBuilder(b, inventory)).length;
