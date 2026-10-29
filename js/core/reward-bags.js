// reward-bags.js — the reward bags: rarities, their opening clips and which
// clip format a device can play. DOM-free so it is unit-tested.
//
// Every clip lives in assets/rewards/ as one slug with four files:
//   <slug>.webm        VP9 with alpha — Chrome, Edge, Firefox, Android
//   <slug>.webp        animated WebP with alpha, plays once — Safari and every iOS browser
//   <slug>-still.webp  the last frame, shown instead of the clip under reduced motion
//   <slug>.mp3         the sound, played alongside (the clips themselves are silent)
// The clips are made from the ProRes masters by tools/convert-rewards.sh.

export const REWARD_DIR = 'assets/rewards';

/** Lowest to highest. `ms` is each clip's length, so the reveal can wait for it. */
export const RARITIES = [
  { id: 'common', variants: [{ slug: 'common', ms: 3033 }, { slug: 'common-2', ms: 4033 }] },
  { id: 'uncommon', variants: [{ slug: 'uncommon', ms: 3033 }] },
  { id: 'rare', variants: [{ slug: 'rare', ms: 3033 }, { slug: 'rare-2', ms: 4033 }] },
  { id: 'legendary', variants: [{ slug: 'legendary', ms: 4033 }] },
  { id: 'mythic', variants: [{ slug: 'mythic', ms: 5033 }] },
];

export const rarityById = (id) => RARITIES.find((r) => r.id === id) || null;

/** 0 for common up to 4 for mythic; -1 when unknown. */
export const rarityRank = (id) => RARITIES.findIndex((r) => r.id === id);

/**
 * The clip for a bag. `variant` picks one of a rarity's alternate clips
 * (0-based, wraps round); without it, `rand` in [0, 1) picks one.
 */
export function bagClip(rarity, { variant = null, rand = Math.random() } = {}) {
  const r = rarityById(rarity);
  if (!r) return null;
  const n = r.variants.length;
  const i = Number.isInteger(variant) ? ((variant % n) + n) % n : Math.min(n - 1, Math.floor(rand * n));
  const { slug, ms } = r.variants[i];
  const at = (suffix) => `${REWARD_DIR}/${slug}${suffix}`;
  return { rarity: r.id, slug, ms, webm: at('.webm'), webp: at('.webp'), still: at('-still.webp'), mp3: at('.mp3') };
}

/**
 * True when a browser shows a WebM's VP9 alpha. Safari plays VP9 but draws the
 * transparent parts black, and every iOS browser is Safari underneath, so
 * those take the animated WebP.
 */
export function playsWebmAlpha(userAgent = '', canPlayWebm = false) {
  if (!canPlayWebm) return false;
  const ua = String(userAgent);
  if (/iPhone|iPad|iPod/.test(ua)) return false;
  const appleWebKit = /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg\/|OPR\//.test(ua);
  return !appleWebKit;
}
