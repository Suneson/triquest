// clubs.js — small teams with a crest, a weekly target and a relay
// (docs/LOOP.md §6). Pure.
//
// A club is cooperative, never a contest between its members: it has one
// weekly target that everyone's verified hours fill together, and a relay
// that everyone's verified kilometres carry round a route on the island map.
// Nobody in a club can see another member's days, missed or not: the server
// only ever returns the club's totals (0026_clubs.sql). Leaving, or a quiet
// week, costs nothing and is never shown.

export const CLUB_RULES = {
  maxMembers: 12,
  nameMin: 3,
  nameMax: 24,
  /** The weekly target when the club hasn't set one: this many minutes per member. */
  defaultMinPerMember: 180,
  /** What a club may set its weekly target to, in hours for the whole club. */
  targetHours: { min: 1, max: 200 },
  crests: ['wave', 'bolt', 'peak', 'sun', 'wheel', 'bird'],
};

export const crestArt = (id) => `icons/Pixelart/NEW/CLUBS/crest-${CLUB_RULES.crests.includes(id) ? id : 'wave'}.png`;
export const RELAY_MAP = 'icons/Pixelart/NEW/CLUBS/relay-gran-canaria.webp';

// places on the map, as fractions of the picture (x right, y down)
const P = {
  laspalmas: [0.78, 0.14], telde: [0.79, 0.5], arinaga: [0.8, 0.63], vecindario: [0.72, 0.74],
  maspalomas: [0.5, 0.84], arguineguin: [0.4, 0.8], mogan: [0.25, 0.7], laaldea: [0.15, 0.5],
  agaete: [0.14, 0.36], galdar: [0.3, 0.2], arucas: [0.55, 0.16],
  valleseco: [0.52, 0.32], artenara: [0.33, 0.38], tejeda: [0.42, 0.42], nieves: [0.5, 0.45], santabrigida: [0.62, 0.36],
};

/**
 * The relay routes, in the order a club takes them on. `km`: what the club
 * covers together to finish it. `via`: the places it passes, drawn on the map.
 * Real distances, rounded; the line on the map is a sketch of the way.
 */
export const RELAY_ROUTES = [
  { id: 'gc-cumbre', km: 120, via: ['laspalmas', 'santabrigida', 'nieves', 'tejeda', 'artenara', 'valleseco', 'arucas', 'laspalmas'] },
  { id: 'gc-vuelta', km: 230, via: ['laspalmas', 'telde', 'arinaga', 'vecindario', 'maspalomas', 'arguineguin', 'mogan', 'laaldea', 'agaete', 'galdar', 'arucas', 'laspalmas'] },
  { id: 'gc-grande', km: 500, via: ['laspalmas', 'telde', 'arinaga', 'vecindario', 'maspalomas', 'arguineguin', 'mogan', 'laaldea', 'agaete', 'galdar', 'artenara', 'tejeda', 'nieves', 'santabrigida', 'valleseco', 'arucas', 'laspalmas'] },
];
export const routeById = (id) => RELAY_ROUTES.find((r) => r.id === id) || null;
/** The route after this one (the last one comes round again). */
export const nextRoute = (id) => {
  const i = RELAY_ROUTES.findIndex((r) => r.id === id);
  return RELAY_ROUTES[(i + 1) % RELAY_ROUTES.length];
};

/** A route's points on the map, in a 0–100 box. */
export const routePoints = (route) => route.via.map((p) => P[p].map((n) => +(n * 100).toFixed(2)));

/** The route's line as an SVG path in a 0–100 viewBox. */
export const routePath = (route) => routePoints(route).map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

/** Length of the drawn line (viewBox units), for the dash that fills it in. */
export function routeLength(route) {
  const pts = routePoints(route);
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return n;
}

/** Where the relay stands: { km, of, frac, done, at: [x, y] } (the marker on the line). */
export function relayProgress(route, km) {
  const of = route.km;
  const done = km >= of;
  const frac = Math.max(0, Math.min(1, (Number(km) || 0) / of));
  const pts = routePoints(route);
  let left = frac * routeLength(route);
  let at = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (left <= seg) {
      const k = seg ? left / seg : 0;
      at = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
      break;
    }
    left -= seg;
    at = pts[i];
  }
  return { km: Math.round((Number(km) || 0) * 10) / 10, of, frac, done, at: at.map((n) => +n.toFixed(2)) };
}

/** A club name, tidied: { name } or { error: 'short' | 'long' | 'chars' }. */
export function checkClubName(raw) {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < CLUB_RULES.nameMin) return { error: 'short' };
  if (name.length > CLUB_RULES.nameMax) return { error: 'long' };
  if (!/^[\p{L}\p{N} .'&-]+$/u.test(name)) return { error: 'chars' };
  return { name };
}

/** The week's target in minutes: the club's own, or the default for its size. */
export const weeklyTargetMin = (members, setMinutes = null) => (Number(setMinutes) > 0
  ? Number(setMinutes)
  : Math.max(1, members) * CLUB_RULES.defaultMinPerMember);

/** How the week stands: { minutes, target, frac, done }. */
export const weekStanding = (minutes, target) => ({
  minutes: Math.max(0, Math.round(Number(minutes) || 0)), target,
  frac: Math.max(0, Math.min(1, (Number(minutes) || 0) / target)), done: (Number(minutes) || 0) >= target,
});
