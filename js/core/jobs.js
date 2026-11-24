// jobs.js: the builders' jobs (docs/JOBS.md). Pure: no DOM, no clock.
//
// Every upgrade on the base is a builder's job, as in a castle-builder game: you pay its coins when
// it starts, one of your builders works on it for its hours, and the building goes up a level when
// the time is up. A builder does one job at a time, a building takes one job at a time, and the
// building keeps working at its old level meanwhile. Delivering a new item is never a job.
//
// A building's level is 1 plus its finished jobs: there's no level stored anywhere else.
//
// The server keeps the same rules (supabase/migrations/0039_builder_jobs.sql, builder_rules()) and is
// the one that charges: tests/jobs-sql.test.js holds the two together.
//
//   job: { id, builder, target, to_level, cost, started_at, finishes_at }

import { BUILDERS, hasBuilder } from './builders.js';

const HOUR = 3600e3;
const L = (coins, hours) => ({ coins, hours });
/**
 * What can be upgraded, by its item id on the base (placement.js), and each level's price:
 * levels[n] takes it from level n - 1 to n; level 1 is what you're given. First guesses, to be tuned.
 */
export const TARGETS = {
  // the locker room is the base's hall: its level caps every other building's (HALL_CAPS)
  locker: { levels: [null, null, L(1000, 4), L(2500, 12), L(5000, 24), L(9000, 36), L(15000, 48)] },
  'gel-stand': { levels: [null, null, L(400, 2), L(900, 6), L(1800, 12), L(3500, 24), L(6000, 36)] },
  'coffee-shop': { levels: [null, null, L(500, 2), L(1000, 6), L(2000, 12), L(4000, 24), L(7000, 36)] },
};
export const isTarget = (id) => Object.hasOwn(TARGETS, id);
/** The hall: the building whose level caps all the others. */
export const HALL = 'locker';
/** The highest level the other buildings can reach, by the hall's level. */
export const HALL_CAPS = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 6 };
/** A target's top level. */
export const maxLevel = (target) => (isTarget(target) ? TARGETS[target].levels.length - 1 : 1);

const at = (iso) => Date.parse(iso);
const done = (j, now) => at(j.finishes_at) <= now;

/** A building's level now: 1 plus its finished jobs, never past its top. */
export const levelOf = (jobs, target, now) =>
  Math.min(maxLevel(target), 1 + (jobs || []).filter((j) => j?.target === target && done(j, now)).length);
/** The job running on a building now, or null. */
export const jobOn = (jobs, target, now) => (jobs || []).find((j) => j?.target === target && !done(j, now)) || null;
/** The job a builder is on now, or null. */
export const jobOf = (jobs, who, now) => (jobs || []).find((j) => j?.builder === who && !done(j, now)) || null;
/** Time left on a job, ms. */
export const left = (j, now) => Math.max(0, at(j.finishes_at) - now);
/** How far along a job is, 0 to 1. */
export const progress = (j, now) => { const a = at(j.started_at); const b = at(j.finishes_at); return b > a ? Math.min(1, Math.max(0, (now - a) / (b - a))) : 1; };

/** The highest level a building can reach now (the hall's cap; the hall only by its own top). */
export const capOf = (jobs, target, now) =>
  (target === HALL ? maxLevel(target) : Math.min(maxLevel(target), HALL_CAPS[levelOf(jobs, HALL, now)] ?? maxLevel(target)));
/** The hall level a building's level needs. */
export const hallFor = (level) => Number(Object.entries(HALL_CAPS).find(([, c]) => c >= level)?.[0] || maxLevel(HALL));

/** The next level of a building and its price: { to, coins, hours }, or null at the top. */
export function nextLevel(jobs, target, now) {
  if (!isTarget(target)) return null;
  const to = levelOf(jobs, target, now) + 1;
  const p = TARGETS[target].levels[to];
  return p ? { to, coins: p.coins, hours: p.hours } : null;
}

/**
 * The builders as the upgrade sheet shows them: { who, hired, job } each, in hiring order.
 * `inventory`: the user_gear rows (a hired builder is one).
 */
export const crew = (jobs, inventory, now) => BUILDERS.map((b) => ({ who: b.who, hired: hasBuilder(b, inventory), job: jobOf(jobs, b.who, now) }));
/** The first hired builder with nothing to do, or null. */
export const freeBuilder = (jobs, inventory, now) => crew(jobs, inventory, now).find((c) => c.hired && !c.job)?.who || null;

/**
 * Can this job start? Returns null when it can, or the server's error code:
 * unknown_target, top, hall_low, busy_target, not_hired, builder_busy, insufficient.
 */
export function whyNot({ jobs, inventory, coins, target, builder, now }) {
  if (!isTarget(target)) return 'gear:unknown_target';
  const next = nextLevel(jobs, target, now);
  if (!next) return 'gear:top';
  if (next.to > capOf(jobs, target, now)) return 'gear:hall_low';
  if (jobOn(jobs, target, now)) return 'gear:busy_target';
  const b = BUILDERS.find((x) => x.who === builder);
  if (!b || !hasBuilder(b, inventory)) return 'gear:not_hired';
  if (jobOf(jobs, builder, now)) return 'gear:builder_busy';
  if (!(Number(coins) >= next.coins)) return 'gear:insufficient';
  return null;
}

/** A new job row, as the server makes it (for the demo). */
export function startRow(jobs, target, builder, now, id = 1) {
  const n = nextLevel(jobs, target, now);
  return { id, builder, target, to_level: n.to, cost: n.coins, started_at: new Date(now).toISOString(), finishes_at: new Date(now + n.hours * HOUR).toISOString() };
}

/** The rules as the server holds them (builder_rules()). */
export const JOB_RULES = {
  targets: Object.fromEntries(Object.entries(TARGETS).map(([id, t]) => [id, Object.fromEntries(t.levels.map((p, n) => [n, p]).filter(([, p]) => p).map(([n, p]) => [String(n), p]))])),
  builders: Object.fromEntries(BUILDERS.map((b) => [b.who, b.cost])),
  hall: HALL,
  caps: Object.fromEntries(Object.entries(HALL_CAPS).map(([k, v]) => [String(k), v])),
};

// ---- the builders' abilities (docs/JOBS.md) ---------------------------------------------------------
// Each builder has one active ability, used while they're on a job, then resting for `cooldown` hours.
// It takes time off a running job (never past now): `cut` minutes off their own job, `share` of what's
// left of it, or `all` minutes off every builder's job. The server holds the same (0041, ability_rules()).
const MIN = 60e3;
export const ABILITIES = {
  blue: { id: 'rush', cut: 60, cooldown: 24 },          // Rush Job: an hour off his job
  red: { id: 'overdrive', share: 0.25, cooldown: 24 },  // Overdrive: a quarter of what's left, off
  green: { id: 'teamwork', all: 30, cooldown: 24 },     // Teamwork: half an hour off every job running
  gold: { id: 'master', cut: 180, cooldown: 48 },       // Master's Touch: three hours off his job
};
/** When a builder can use their ability again (ms), from their uses ({ builder, used_at }); 0 = now. */
export function abilityReadyAt(uses, who, now) {
  const a = ABILITIES[who]; if (!a) return Infinity;
  const last = Math.max(0, ...(uses || []).filter((u) => u?.builder === who).map((u) => at(u.used_at)));
  const ready = last ? last + a.cooldown * HOUR : 0;
  return ready > now ? ready : 0;
}
/** Can a builder use their ability now? null when they can, or why not: not_hired, idle, cooldown. */
export function abilityWhyNot({ jobs, inventory, uses, who, now }) {
  const b = BUILDERS.find((x) => x.who === who);
  if (!b || !ABILITIES[who] || !hasBuilder(b, inventory)) return 'gear:not_hired';
  if (!jobOf(jobs, who, now)) return 'gear:idle';
  if (abilityReadyAt(uses, who, now)) return 'gear:cooldown';
  return null;
}
/** The jobs after a builder's ability: the same rows, the ones it shortens with a new finishes_at. */
export function useAbility(jobs, who, now) {
  const a = ABILITIES[who]; const mine = jobOf(jobs, who, now);
  return (jobs || []).map((j) => {
    if (done(j, now)) return j;
    let off = 0;
    if (a.all) off = a.all * MIN;
    else if (j === mine) off = a.cut ? a.cut * MIN : left(j, now) * a.share;
    if (!off) return j;
    return { ...j, finishes_at: new Date(Math.max(now, at(j.finishes_at) - off)).toISOString() };
  });
}
