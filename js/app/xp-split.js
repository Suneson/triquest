// xp-split.js — a session's XP as the two numbers GEAR promises to show:
// what it counts for on your own levels, and the base it was built from.
// "+320 XP (240 base · 64 gear · 16 gel)". Ranks only ever uses the base.

import { xpStatus } from '../core/scoring.js';
import { boostFor, gelClaims } from '../core/boosts.js';
import { t, fmtNum } from '../core/i18n.js';
import { gearState } from './gear-state.js';

/** { base, gear, gel, total } for a session that earns XP, else null. */
export function sessionXp(w, workouts) {
  if (!w?.completed) return null;
  const st = xpStatus(w, workouts || []);
  if (!(st.xp > 0)) return null;
  const g = gearState();
  // a waiting gel goes to one session only: the first that fits it
  return boostFor(w, g.inventory, g.boosts, st.xp, workouts ? gelClaims(workouts, g.boosts) : null);
}

/** "240 base · 64 gear · 16 gel", or '' when nothing was boosted. */
export function splitText(b) {
  if (!b || b.total === b.base) return '';
  return [
    t('xp.baseN', { n: fmtNum(b.base) }),
    b.gear ? t('xp.gearN', { n: fmtNum(b.gear) }) : '',
    b.gel ? t('xp.gelN', { n: fmtNum(b.gel) }) : '',
  ].filter(Boolean).join(' · ');
}
