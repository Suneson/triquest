// seasons.js — named three-month seasons and their recap (docs/LOOP.md §5.2). Pure.
//
// A season is a calendar quarter ('2026-Q4', the same key feats use). Each
// quarter has a theme from the island's year: almond blossom, the trade
// winds, the calima and the sea of clouds. A season has its own board (what
// you did in it), its own colours, and its own kit colourway, which you earn
// by finishing kitMissions weekly missions inside the season. When a season
// closes you can no longer earn its kit, but nothing earned is ever taken
// away: a kit you won stays yours, and the recap card says what you took home.

import { addDays, diffDays } from './dates.js';
import { seasonOf } from './feats.js';
import { earnsXp } from './xp-rules.js';
import { coinDays } from './wallet.js';
import { MISSION_RULES } from './missions.js';

export { seasonOf };

export const SEASON_RULES = {
  /** The first season with a board and a kit. */
  first: '2026-Q4',
  /** Weekly missions inside a season that earn its kit colourway. */
  kitMissions: 6,
};

/**
 * The four themes, by quarter. `colors`: the board's accent, its deep tone and
 * ink. `kit`: the colourway you can earn, as the ramps the kit recolour uses.
 */
export const SEASON_THEMES = {
  1: {
    id: 'almendro', colors: { accent: '#F6B8CF', deep: '#7A2E55', ink: '#2B0C1D' },
    ramps: { jersey: ['#6e2a4d', '#a5476f', '#d77c9d', '#f6b8cf'], shorts: ['#1e1420', '#30223a', '#46344f', '#5e4a68'], shoes: ['#c9c9c9', '#e0e0e0', '#efefef', '#ffffff'] },
  },
  2: {
    id: 'alisio', colors: { accent: '#7FE3D8', deep: '#11615E', ink: '#06231F' },
    ramps: { jersey: ['#0d4f4c', '#16807a', '#3fb8ad', '#8fe9de'], shorts: ['#0a1622', '#142636', '#20394d', '#2f5068'], shoes: ['#f2f2f2', '#ffffff', '#ffffff', '#ffffff'] },
  },
  3: {
    id: 'calima', colors: { accent: '#FFB55C', deep: '#8A4413', ink: '#2E1405' },
    ramps: { jersey: ['#7c3c10', '#b8641c', '#e6923a', '#ffc77a'], shorts: ['#2a1a0e', '#3d2716', '#553822', '#6e4b30'], shoes: ['#3a2a1a', '#5a4128', '#7c5c3a', '#a07e55'] },
  },
  4: {
    id: 'mar-de-nubes', colors: { accent: '#C9D8F2', deep: '#3B4F78', ink: '#121A2B' },
    ramps: { jersey: ['#334670', '#56699a', '#8ea3cc', '#d6e2f6'], shorts: ['#0e1424', '#1a2238', '#28324e', '#3a4566'], shoes: ['#a8771c', '#d9a52c', '#f2cf63', '#ffe9a6'] },
  },
};

/** The kit a theme gives (one per theme, won once, kept for good). */
export const seasonKitId = (themeId) => `kit-season-${themeId}`;
export const SEASON_KITS = Object.values(SEASON_THEMES).map((th) => ({ id: seasonKitId(th.id), theme: th.id, ramps: th.ramps }));

/** A season's facts: { id, year, q, theme, start, end } ('2026-Q4' or any date in it). */
export function seasonInfo(idOrDate) {
  const id = /^\d{4}-Q[1-4]$/.test(idOrDate) ? idOrDate : seasonOf(idOrDate);
  const [y, q] = [Number(id.slice(0, 4)), Number(id.slice(6))];
  const mm = String((q - 1) * 3 + 1).padStart(2, '0');
  const start = `${y}-${mm}-01`;
  const next = q === 4 ? `${y + 1}-01-01` : `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`;
  return { id, year: y, q, theme: SEASON_THEMES[q], start, end: addDays(next, -1) };
}

/** Days left in the season, today included. */
export const seasonDaysLeft = (today) => diffDays(seasonInfo(today).end, today) + 1;

/** The season before this one. */
export const previousSeason = (id) => {
  const { year, q } = seasonInfo(id);
  return q === 1 ? `${year - 1}-Q4` : `${year}-Q${q - 1}`;
};

/** Paid missions inside a season (by the week they were for). */
export const missionsIn = (id, claims) => {
  const s = seasonInfo(id);
  return (claims || []).filter((c) => String(c.week) >= s.start && String(c.week) <= s.end);
};

/**
 * Season kits you've won: inventory rows { item_id, acquired_at } from the
 * moment the kitMissions-th mission of that season was paid. A theme's kit is
 * won once; a later season of the same theme has nothing more to give.
 */
export function seasonKitsWon(claims) {
  const byTheme = new Map();
  const bySeason = new Map();
  for (const c of claims || []) {
    const id = seasonOf(String(c.week));
    if (id < SEASON_RULES.first) continue;
    if (!bySeason.has(id)) bySeason.set(id, []);
    bySeason.get(id).push(c);
  }
  for (const id of [...bySeason.keys()].sort()) {
    const list = bySeason.get(id).slice().sort((a, b) => String(a.claimed_at || a.week).localeCompare(String(b.claimed_at || b.week)));
    if (list.length < SEASON_RULES.kitMissions) continue;
    const theme = seasonInfo(id).theme.id;
    if (byTheme.has(theme)) continue;
    const c = list[SEASON_RULES.kitMissions - 1];
    byTheme.set(theme, { item_id: seasonKitId(theme), acquired_at: c.claimed_at || `${c.week}T00:00:00.000Z`, season: id });
  }
  return [...byTheme.values()];
}

/**
 * What a season held for you: the season board while it runs, the recap card
 * once it's over. `featAwards`: [{ featId, season }].
 */
export function seasonRecap(id, { workouts = [], claims = [], featAwards = [] } = {}) {
  const s = seasonInfo(id);
  const inS = (d) => d >= s.start && d <= s.end;
  const verified = (workouts || []).filter((w) => w?.date && inS(w.date) && earnsXp(w));
  const minutes = verified.reduce((a, w) => a + Math.max(0, Number(w.actual?.durationMin ?? w.durationMin) || 0), 0);
  const km = verified.reduce((a, w) => a + Math.max(0, Number(w.actual?.distanceKm ?? w.metrics?.distanceKm) || 0), 0);
  const missions = missionsIn(id, claims);
  const trainingCoins = coinDays(workouts).filter((d) => inS(d.date)).reduce((a, d) => a + d.coins, 0);
  const kit = seasonKitsWon(claims).find((k) => k.season === id) || null;
  return {
    id, theme: s.theme.id, start: s.start, end: s.end,
    sessions: verified.length,
    hours: Math.round(minutes / 6) / 10,
    km: Math.round(km),
    missions: missions.length,
    kitMissions: SEASON_RULES.kitMissions,
    feats: (featAwards || []).filter((a) => a.season === id).length,
    coins: trainingCoins + missions.length * MISSION_RULES.reward.coins,
    kit: kit ? kit.item_id : null,
  };
}

/** The season whose recap is due: the last one that closed, if you haven't seen it. */
export function recapDue(today, seen = []) {
  const prev = previousSeason(seasonOf(today));
  if (prev < SEASON_RULES.first || (seen || []).includes(prev)) return null;
  return prev;
}
