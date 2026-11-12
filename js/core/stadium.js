// stadium.js: the stadium's PVE race against a boss (BUILD-PLAN.md sections 2 and 12, docs/STADIUM.md).
//
// For testing it runs non-stop: one race every 72 hours, back to back, the same for everyone,
// counted from EPOCH, so no server is needed to know which race is on and how far it has got.
// The boss runs his distance at an even pace over the 72 hours, and once round the 400 m track:
// he crosses the finish line just as the clock runs out.
//
// The clan's robot (it races him with the km the clan logs) comes next: the robot's ten levels and
// the clan XP that raises them are below, ready for it.

export const RACE_MS = 72 * 3600e3;
/** The first race started here (a Monday, 00:00 UTC). */
export const EPOCH = Date.UTC(2026, 10, 9);

/** The bosses, in turn: one a race for now (once a month later). */
export const BOSSES = [
  {
    id: 'blomvelt', name: 'Kristoff Blomvelt', sport: 'triathlon', // i18n-ignore (a name)
    model: 'models/chars/boss-blomvelt.glb', clips: 'models/chars/male-clips.glb',
    reward: 'blomvelt-set',
  },
];

/** The boss's distance, by how many of the clan queue (3, 6, 9 or 12). */
export const BOSS_KM = { 3: 50, 6: 100, 9: 150, 12: 200 };
export const SQUADS = [3, 6, 9, 12];
export const bossKm = (squad = 12) => BOSS_KM[squad] || BOSS_KM[12];

/** The race on at `now`: its number, start, end, how far through (0..1) and its boss. */
export function raceAt(now = Date.now()) {
  const n = Math.floor((now - EPOCH) / RACE_MS);
  const start = EPOCH + n * RACE_MS;
  const end = start + RACE_MS;
  const p = Math.min(1, Math.max(0, (now - start) / RACE_MS));
  return { n, start, end, p, left: end - now, boss: BOSSES[((n % BOSSES.length) + BOSSES.length) % BOSSES.length] };
}

/** The boss's km at `now` in a race for `squad` players. */
export const bossKmAt = (now = Date.now(), squad = 12) => raceAt(now).p * bossKm(squad);

/** hh:mm:ss for what's left (hours can pass 24). */
export function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const two = (v) => String(v).padStart(2, '0');
  return `${two(Math.floor(s / 3600))}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`;
}

// ---- the track ---------------------------------------------------------------------------------
// A standard 400 m track, in metres, seen from above: x to the right, z down the screen (towards
// the camera), the straights running up and down. Lane 1's running line is 400 m round.

export const TRACK = { straight: 84.39, radius: 36.5, lanes: 8, lane: 1.22 };
const LAP = 2 * TRACK.straight + 2 * Math.PI * TRACK.radius;   // ≈ 398.1, the kerb line

/**
 * Where a runner is at `f` of the lap (0 = the finish line, at the near end of the right-hand
 * straight), in `lane` (1..8), running anticlockwise as seen from above: up the right-hand straight,
 * round the far bend, down the left-hand one. Returns { x, z, dir } with dir the heading in
 * radians (0 = up the screen, −z; π/2 = to the left, −x). `geom`: another track's shape (the
 * painted one's, which isn't to scale).
 */
export function trackPoint(f, lane = 1, geom = TRACK) {
  const { straight: L, radius } = geom;
  const R = radius + (lane - 0.5) * geom.lane;
  const per = 2 * L + 2 * Math.PI * R;
  let s = (((f % 1) + 1) % 1) * per;
  if (s < L) return { x: R, z: L / 2 - s, dir: 0 };
  s -= L;
  if (s < Math.PI * R) { const a = s / R; return { x: R * Math.cos(a), z: -L / 2 - R * Math.sin(a), dir: a }; }
  s -= Math.PI * R;
  if (s < L) return { x: -R, z: -L / 2 + s, dir: Math.PI };
  s -= L;
  const a = s / R;
  return { x: -R * Math.cos(a), z: L / 2 + R * Math.sin(a), dir: Math.PI + a };
}
export const LAP_M = LAP;

// ---- the clan robot (next) ---------------------------------------------------------------------
// Clan XP comes from clan PVP (Clan Games) and clan PVE (this race). The robot's level follows it.

export const ROBOT_XP = [0, 500, 1500, 3000, 5000, 8000, 12000, 17000, 23000, 30000];
/** The robot's level (1..10) for a clan's XP. */
export const robotLevel = (xp) => ROBOT_XP.reduce((lvl, need, i) => (xp >= need ? i + 1 : lvl), 1);
/** XP for a clan's part in a race: its km, and more when it beat the boss. */
export const raceXp = (km, beat) => Math.round(Math.max(0, km) * 10 + (beat ? 1000 : 0));

// ---- the boss's talk when you first come in ----------------------------------------------------
/** Each line's pose (a clip of the male body). Lines are in the locales: stadium.intro.<i>. */
export const INTRO_POSES = ['wave', 'taunt1', 'idle', 'taunt2', 'victory'];
