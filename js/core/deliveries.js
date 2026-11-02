// deliveries.js — what's on its way from the shop (docs/CITY.md). Pure.
//
// Everything bought in the shop is a workshop job with a finish time; until then it's a
// delivery. The base's street sign counts down to the next one and the truck brings it
// (js/app/city3d.js); the list is js/app/delivery-view.js.

import { jobPhase } from './workshop.js';

/** The deliveries still coming, soonest first. */
export function deliveriesComing(jobs, now) {
  return (jobs || []).filter((j) => ['waiting', 'fitting'].includes(jobPhase(j, now)))
    .sort((a, b) => Date.parse(a.finishes_at) - Date.parse(b.finishes_at));
}

/** When each delivery ends (epoch ms): those coming and those that came in the last `recentMs`. */
export function deliveryEnds(jobs, now, recentMs) {
  return (jobs || []).filter((j) => j.state !== 'cancelled' && j.finishes_at)
    .map((j) => Date.parse(j.finishes_at)).filter((e) => e > now - recentMs);
}
