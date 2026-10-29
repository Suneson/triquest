// shop-cards.js — what a shop card says (docs/SHOP.md). Pure.
//
// Every card in the shop is one of a few states, worked out here so the view
// only draws: you can buy it, you're short of the price (and by how much),
// your storage for it is full, you own it, or it's in the workshop. A card
// never shows a dead button without saying why.

/**
 * A card's state from what it costs and what you have.
 *   cost      the price
 *   balance   coins or carbs you hold
 *   held      how many you hold now (fuel)       — optional
 *   max       how many you may hold (fuel)       — optional
 *   owned     you own it already (gear, kits)    — optional
 *   building  it's in the workshop               — optional
 * → { state: 'buy' | 'short' | 'max' | 'owned' | 'building', short, storage }
 *   short: what's missing when state is 'short' (else 0)
 *   storage: { n, max } when the item has a storage limit, else null
 */
export function cardState({ cost, balance, held = null, max = null, owned = false, building = false }) {
  const storage = max != null ? { n: Math.max(0, held || 0), max } : null;
  if (owned) return { state: 'owned', short: 0, storage };
  if (building) return { state: 'building', short: 0, storage };
  if (storage && storage.n >= storage.max) return { state: 'max', short: 0, storage };
  const short = Math.max(0, (Number(cost) || 0) - (Number(balance) || 0));
  return { state: short > 0 ? 'short' : 'buy', short, storage };
}

/** The well a card sits on: lit blue while you can still get it, grey once there's nothing more to do. */
export const cardPlate = (state) => (state === 'max' || state === 'owned' ? 'grey' : 'blue');

/** A storage counter as the card prints it: "2/3". */
export const storageText = (s) => (s ? `${s.n}/${s.max}` : '');
