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
  'gel-stand': { levels: [null, null, L(400, 2), L(900, 6), L(1800, 12), L(3500, 24), L(6000, 36)] },
  'coffee-shop': { levels: [null, null, L(500, 2), L(1000, 6), L(2000, 12), L(4000, 24), L(7000, 36)] },
};
export const isTarget = (id) => Object.hasOwn(TARGETS, id);
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
 * unknown_target, top, busy_target, not_hired, builder_busy, insufficient.
 */
export function whyNot({ jobs, inventory, coins, target, builder, now }) {
  if (!isTarget(target)) return 'gear:unknown_target';
  const next = nextLevel(jobs, target, now);
  if (!next) return 'gear:top';
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
};
