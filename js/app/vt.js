// vt.js — shared-element transitions. Tapping an athlete carries their avatar
// and level from the row into the profile header; an exercise's picture into
// its history; a session card's title into its sheet. One element, two
// places, so the eye follows it instead of seeing a cut.
//
// Built on the View Transitions API: the source elements are named, the
// update opens the layer, the matching elements in it take the same names.
// Without the API, or with reduced motion, the update simply runs.
// Stepped like everything else (CSS: ::view-transition-group(*.shared)).

import { prefersReducedMotion } from './effects.js';

const reduced = () => prefersReducedMotion() || document.body.classList.contains('rm');
let running = false;

/**
 * @param {Array<{ name: string, from: Element|null, to: string }>} pairs
 *   `from` is on screen now; `to` is a selector, searched in the newest layer after `update`.
 * @param {() => any} update  opens the layer (must render synchronously)
 */
export function morph(pairs, update) {
  const live = pairs.filter((p) => p.from?.isConnected);
  if (!document.startViewTransition || reduced() || running || !live.length) { update(); return; }
  running = true;
  const root = document.documentElement;
  root.classList.add('vt-shared');
  live.forEach((p) => { p.from.style.viewTransitionName = p.name; });
  let targets = [];
  const t = document.startViewTransition(() => {
    live.forEach((p) => { p.from.style.viewTransitionName = ''; });
    update();
    const layer = [...document.querySelectorAll('.layer')].pop() || document;
    targets = live.map((p) => {
      const el = layer.querySelector(p.to);
      if (el) el.style.viewTransitionName = p.name;
      return el;
    });
  });
  t.finished.finally(() => {
    targets.forEach((el) => { if (el) el.style.viewTransitionName = ''; });
    root.classList.remove('vt-shared');
    running = false;
  });
}
