// stadium.js: the stadium's PVE race against a boss (BUILD-PLAN.md sections 2 and 12, docs/STADIUM.md).
//
// For testing it runs non-stop, the same for everyone, counted from EPOCH, so no server is needed
// to know which race is on and how far it has got: 10 hours of warm-up (the boss stretches and
// shows off on the start line, a countdown to the start), then the 72-hour race, then the next
// warm-up. The boss runs his distance at an even pace over the 72 hours, and once round the 400 m
// track: he crosses the finish line just as the clock runs out.
//
// The clan's robot (it races him with the km the clan logs) comes next: the robot's ten levels and
// the clan XP that raises them are below, ready for it.

export const RACE_MS = 72 * 3600e3;
/** The warm-up before each race. */
export const WARM_MS = 10 * 3600e3;
export const CYCLE_MS = WARM_MS + RACE_MS;
/**
 * The first warm-up started here: when the robot joined the stadium (PR 79), so its first race
 * starts 10 hours after that went live.
 */
export const EPOCH = Date.UTC(2026, 10, 13, 1, 30);

/** The bosses, in turn: one a race for now (once a month later). */
export const BOSSES = [
  {
    id: 'blomvelt', name: 'Kristoff Blomvelt', sport: 'triathlon', // i18n-ignore (a name)
    // his own skeleton and clips (made on him in Mixamo); the male's fill in wave, victory and walk
    model: 'models/chars/boss-blomvelt.glb', clips: 'models/chars/boss-blomvelt-clips.glb',
    reward: 'blomvelt-set',
    /** What he does on the start line during the warm-up, in turn. */
    warmup: ['stretch', 'laugh', 'dance', 'stretch', 'dance2'],
    /** His pose for each line of his talk (stadium.intro.<i>). */
    poses: ['wave', 'laugh', 'stretch', 'dance', 'victory'],
  },
];

/** The boss's distance, by how many of the clan queue (3, 6, 9 or 12). */
export const BOSS_KM = { 3: 50, 6: 100, 9: 150, 12: 200 };
export const SQUADS = [3, 6, 9, 12];
export const bossKm = (squad = 12) => BOSS_KM[squad] || BOSS_KM[12];

/**
 * The race on at `now`: its number, when its warm-up begins (`warm`), start, end, whether it is
 * still warming up, how far through the race (0..1, 0 in the warm-up), the time to the start
 * (`startsIn`) and to the end (`left`), and its boss.
 */
export function raceAt(now = Date.now()) {
  const n = Math.floor((now - EPOCH) / CYCLE_MS);
  const warm = EPOCH + n * CYCLE_MS;
  const start = warm + WARM_MS;
  const end = start + RACE_MS;
  const p = Math.min(1, Math.max(0, (now - start) / RACE_MS));
  return {
    n, warm, start, end, p, warming: now < start, startsIn: Math.max(0, start - now), left: end - now,
    boss: BOSSES[((n % BOSSES.length) + BOSSES.length) % BOSSES.length],
  };
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

// ---- the clan robot ----------------------------------------------------------------------------
// It stands on the start line with the boss (stadium3d.js), in the outer lane. Until the server
// counts each clan's km it waits there at 0 km. Clan XP comes from clan PVP (Clan Games) and clan
// PVE (this race), and the robot's level (its look, models/chars/robot-<level>.glb) follows it.

export const ROBOT = {
  /** Its look at a level (1..10). */
  model: (level = 1) => `models/chars/robot-${Math.min(10, Math.max(1, level))}.glb`,
  clips: 'models/chars/robot-clips.glb',
  /** What it does on the start line in the warm-up, in turn. */
  warmup: ['stretch', 'idle'],
  /** And while the boss runs and it has no km yet. */
  waiting: ['idle', 'sad'],
};

export const ROBOT_XP = [0, 500, 1500, 3000, 5000, 8000, 12000, 17000, 23000, 30000];
/** The robot's level (1..10) for a clan's XP. */
export const robotLevel = (xp) => ROBOT_XP.reduce((lvl, need, i) => (xp >= need ? i + 1 : lvl), 1);
/** XP for a clan's part in a race: its km, and more when it beat the boss. */
export const raceXp = (km, beat) => Math.round(Math.max(0, km) * 10 + (beat ? 1000 : 0));

// ---- the boss's talk when you first come in ----------------------------------------------------
/** Each line's pose, for a boss without his own (`poses`). Lines are in the locales: stadium.intro.<i>. */
export const INTRO_POSES = ['wave', 'taunt1', 'idle', 'taunt2', 'victory'];
