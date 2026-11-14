// training.js — the rules for in-gym drills: energy, discipline ladders, classes
// and the mechanic. Pure; no DOM, no clock, no randomness of its own. The server
// will hold the same numbers, as it does for the wallet and the workshop.
//
// Not wired into the app yet. docs/TRAINING.md explains the design and the order
// it gets built in.
//
// Percentages are basis points (10000 = 100%), like the rest of the economy.

import { TYPE_FACTOR, INTENSITY_FACTOR, PROOF_BONUS } from './xp-rules.js';
import { GEAR_RULES } from './gear.js';

/**
 * @typedef {'run'|'bike'|'swim'|'lift'} DisciplineId
 * @typedef {'pacer'|'triathlete'|'functional'|'titan'} ClassId
 *
 * @typedef {Object} Discipline
 * @property {DisciplineId} id
 * @property {'run'|'bike'|'swim'|'gym'} sport  whose XP, gear and level it uses
 * @property {string} machine                   the base item a drill runs on
 * @property {'km'|'kg'} unit
 * @property {string} intensity                 for the equivalent real session
 * @property {boolean} cardio
 * @property {number} burnL1                    stamina level 1 costs before any buff
 * @property {number[]} targets                 km, or kg moved in total, per level
 * @property {number[]} realMin                 how long that takes a real athlete
 *
 * @typedef {Object} Athlete  What a drill needs to know about the player.
 * @property {number} sportLevel                the discipline's sport level, from real XP
 * @property {number} machineTier               tier of the machine used (1..4)
 * @property {number} gearBp                    the sport's gear boost, without prestige
 * @property {ClassId|null} classId
 * @property {boolean} cleared                  has this level been completed before?
 * @property {boolean} [fuelled]                carbs burned for this drill
 * @property {number} [setDrainBp]             from the clothes worn (setBonus)
 *
 * @typedef {Object} EnergyAnchor  Stored; the current value is worked out from it.
 * @property {number} value                     float stamina at `at`
 * @property {number} at                        ms since the epoch
 * @property {number} [cutBp]                   recovery buff in force, 0 when none
 *
 * @typedef {Object} DrillPlan
 * @property {number} burn                      stamina it costs on an average day
 * @property {number} burnLow
 * @property {number} burnHigh
 * @property {number} durationMin               in real minutes on the player's clock
 * @property {number} drainPerMin               at the average burn
 *
 * @typedef {Object} DrillResult
 * @property {boolean} ok
 * @property {number} burn                      stamina this attempt needed
 * @property {number} spent                     stamina taken from the gauge
 * @property {number} stoppedAtMin              when the athlete stopped
 * @property {number} xp
 * @property {number} coins                     before the daily drill cap
 * @property {'first-clear'|'replay'|null} bonus
 *
 * @typedef {Object} Job  An upgrade the mechanic is working on.
 * @property {string} id
 * @property {'gear'|'machine'|'floor'|'facility'|'expansion'|'repair'} kind
 * @property {string} target
 * @property {number} startsAt
 * @property {number} endsAt
 * @property {number} worker
 */

// ---- Energy -----------------------------------------------------------------

export const ENERGY = {
  baseMax: 100,
  fullHours: 36,             // empty to full, whatever the maximum is
  maxPerRank: 0.5,           // account level
  maxFromRank: 40,
  maxPerClear: 1,            // each level cleared in any discipline
};

/** The most a recovery station takes off the time left to recharge. */
export const RECOVERY = {
  'ice-bath': { cutBp: [5000, 5500, 6000] }, // by tier
  sauna: { cutBp: [5000, 5500, 6000] },
};

export function maxStamina({ rank = 1, cleared = 0 } = {}) {
  const fromRank = Math.min(ENERGY.maxFromRank, ENERGY.maxPerRank * Math.max(0, rank - 1));
  return ENERGY.baseMax + fromRank + ENERGY.maxPerClear * Math.max(0, cleared);
}

/** Stamina per millisecond for this maximum and buff. */
function regenRate(max, cutBp = 0) {
  return (max / (ENERGY.fullHours * 3600000)) / (1 - cutBp / 10000);
}

export const freshEnergy = (max, now) => ({ value: max, at: now, cutBp: 0 });

/** The float value of the gauge at `now`. */
export function energyAt(anchor, max, now) {
  const v = Number(anchor?.value);
  const at = Number(anchor?.at);
  if (!Number.isFinite(v) || !Number.isFinite(at)) return max;
  const start = Math.max(0, Math.min(max, v));
  return Math.min(max, start + Math.max(0, now - at) * regenRate(max, anchor.cutBp || 0));
}

/** Milliseconds until the gauge is full. */
export function msToFull(anchor, max, now) {
  return (max - energyAt(anchor, max, now)) / regenRate(max, anchor?.cutBp || 0);
}

/** Using a recovery station. Buffs don't stack; the better one stays. */
export function useRecovery(anchor, max, now, station, tier = 1) {
  const table = RECOVERY[station]?.cutBp;
  if (!table) return anchor;
  const cutBp = table[Math.min(table.length, Math.max(1, tier)) - 1];
  return { value: energyAt(anchor, max, now), at: now, cutBp: Math.max(cutBp, anchor?.cutBp || 0) };
}

/** Taking stamina off the gauge. A drill ends the recovery buff. */
export function spendEnergy(anchor, max, now, amount) {
  return { value: Math.max(0, energyAt(anchor, max, now) - amount), at: now, cutBp: 0 };
}

// ---- Disciplines ------------------------------------------------------------

export const OPEN_LEVELS = 8;  // the ladder goes further; only this many are open

/** @type {Record<DisciplineId, Discipline>} */
export const DISCIPLINES = {
  run: {
    id: 'run', sport: 'run', machine: 'treadmill', unit: 'km', intensity: 'steady', cardio: true, burnL1: 6,
    targets: [1, 2, 3, 5, 8, 10, 15, 21.1],
    realMin: [5, 11, 17, 28, 44, 55, 82, 110],
  },
  bike: {
    id: 'bike', sport: 'bike', machine: 'smart-bike', unit: 'km', intensity: 'steady', cardio: true, burnL1: 10,
    targets: [5, 10, 15, 25, 40, 60, 80, 100],
    realMin: [12, 24, 35, 55, 85, 125, 165, 200],
  },
  swim: {
    id: 'swim', sport: 'swim', machine: 'pool-lane', unit: 'km', intensity: 'steady', cardio: true, burnL1: 6,
    targets: [0.1, 0.2, 0.4, 0.75, 1, 1.5, 1.9, 3.8],
    realMin: [2.5, 5, 10, 18, 25, 38, 48, 76],
  },
  lift: {
    id: 'lift', sport: 'gym', machine: 'bench-press', unit: 'kg', intensity: 'moderate', cardio: false, burnL1: 6,
    targets: [500, 1000, 1800, 3000, 5000, 8000, 12000, 18000],
    realMin: [5, 8, 14, 22, 35, 50, 70, 90],
  },
};

export const TRAINING = {
  // Duration: a drill is shorter on the clock than the real thing.
  durationAt5Min: 5,         // a real 5 minutes is 5 on the clock…
  durationPower: 0.75,       // …and longer sessions are compressed
  minDurationMin: 3,
  // Burn: the same top of the ladder for every discipline.
  burnAtTop: 270,            // stamina at level OPEN_LEVELS, before any buff
  entryBurn: 5,              // every attempt costs this as well; no buff touches it,
                             // so the easy levels aren't the best pay per stamina
  burnAfterTop: 1.06,        // growth per level above it
  growthAfterTop: 1.12,      // distance and time per level above it
  // What brings the burn down.
  statPerLevelBp: 300,       // sport level above 1
  statTopLevel: 10,
  machineBp: [0, 800, 1600, 2400],   // tier 1..4
  gearDrainPerBoost: 1.5,    // Buff 1: a 16% gear boost is 24% less drain
  replayBp: 1000,            // a level you've cleared costs 10% less
  // How much an attempt can vary, on a server-side roll.
  firstVarianceBp: 800,      // +/- on a level you haven't cleared
  replayVarianceBp: 300,     // +/- on one you have
  // The lowest machine tier that may start each level (1-based level).
  minMachineTier: [1, 1, 1, 2, 2, 3, 3, 3],
  // Pay: a share of what the same session earns in the real world.
  payFloorBp: 2500,
  payCeilBp: 3000,
  replayPayBp: 200,
  fuelPayBp: 200,
  failShareBp: 1000,         // a failed drill: 10% of its base XP, no bonus
  dailyDrillCoinCap: 36,     // 30% of the real-world daily cap
  crateBuffPerBoost: 1,      // Buff 2: a 16% gear boost is 16% more crate reward
};

/** Carbs burned before a drill. Pay and luck for that drill only. */
export const fuelCost = (level) => 10 + 5 * level;
export const FUEL_LUCK_BP = 1000;

function rung(table, level, growth) {
  const last = table.length;
  if (level <= last) return table[level - 1];
  return table[last - 1] * growth ** (level - last);
}

/** The distance (km) or total weight moved (kg) of a level. */
export const levelTarget = (d, level) => rung(d.targets, level, TRAINING.growthAfterTop);

/** How long the same session takes in the real world, in minutes. */
export const levelRealMin = (d, level) => rung(d.realMin, level, TRAINING.growthAfterTop);

/** Stamina a level costs before anything brings it down. */
export function rawBurn(d, level) {
  const top = OPEN_LEVELS;
  const r = (TRAINING.burnAtTop / d.burnL1) ** (1 / (top - 1));
  if (level <= top) return d.burnL1 * r ** (level - 1);
  return TRAINING.burnAtTop * TRAINING.burnAfterTop ** (level - top);
}

/** The lowest machine tier that may start this level. */
export const minTierFor = (level) => TRAINING.minMachineTier[level - 1] ?? 4;

/** Is this level open to this player? They clear the ladder in order. */
export function canStart(level, topCleared, machineTier) {
  if (level > OPEN_LEVELS) return { ok: false, reason: 'closed' };
  if (level > topCleared + 1) return { ok: false, reason: 'ladder' };
  if ((machineTier || 1) < minTierFor(level)) return { ok: false, reason: 'machine' };
  return { ok: true };
}

/** The two things good gear does. `gearBp` is gearBoost without prestige. */
export function gearBuffs(gearBp) {
  const bp = Math.max(0, Math.min(GEAR_RULES.sportCapBp, gearBp || 0));
  return { drainBp: Math.round(bp * TRAINING.gearDrainPerBoost), crateBp: Math.round(bp * TRAINING.crateBuffPerBoost) };
}

/** Everything that multiplies the burn, as a factor. */
export function burnFactor(d, athlete) {
  const cls = CLASSES[athlete.classId];
  const stat = Math.max(1, Math.min(TRAINING.statTopLevel, athlete.sportLevel || 1)) - 1;
  const machine = TRAINING.machineBp[Math.max(1, Math.min(4, athlete.machineTier || 1)) - 1];
  const parts = [
    1 - (stat * TRAINING.statPerLevelBp) / 10000,
    1 - machine / 10000,
    1 - gearBuffs(athlete.gearBp).drainBp / 10000,
    1 + (cls?.drainBp?.[d.id] || 0) / 10000,
    athlete.cleared ? 1 - TRAINING.replayBp / 10000 : 1,
    1 - (athlete.setDrainBp || 0) / 10000,
  ];
  return parts.reduce((a, b) => a * b, 1);
}

/** The clock time of a drill, in minutes. */
export function drillMinutes(d, level, classId = null) {
  const real = levelRealMin(d, level);
  const min = TRAINING.durationAt5Min * (real / 5) ** TRAINING.durationPower;
  const cls = CLASSES[classId];
  return Math.max(TRAINING.minDurationMin, min * (1 + (cls?.durationBp?.[d.id] || 0) / 10000));
}

/**
 * What an attempt will take, before it starts.
 * @returns {DrillPlan}
 */
export function planDrill(d, level, athlete) {
  const burn = rawBurn(d, level) * burnFactor(d, athlete) + TRAINING.entryBurn;
  const v = (athlete.cleared ? TRAINING.replayVarianceBp : TRAINING.firstVarianceBp) / 10000;
  const durationMin = drillMinutes(d, level, athlete.classId);
  return { burn, burnLow: burn * (1 - v), burnHigh: burn * (1 + v), durationMin, drainPerMin: burn / durationMin };
}

/** The chance of finishing with this much stamina (0..1). Shown before starting. */
export function successChance(plan, stamina) {
  if (stamina >= plan.burnHigh) return 1;
  if (stamina < plan.burnLow) return 0;
  return (stamina - plan.burnLow) / (plan.burnHigh - plan.burnLow);
}

/** XP the same session earns in the real world, with Strava proof. */
export function realSessionXp(d, level) {
  const type = d.sport === 'gym' ? 'gym' : d.sport;
  const km = d.unit === 'km' ? levelTarget(d, level) : 0;
  const base = levelRealMin(d, level) * TYPE_FACTOR[type] * INTENSITY_FACTOR[d.intensity] + km * 1.5;
  return base * PROOF_BONUS;
}

/** The share of the real session a drill pays. Always inside the floor and ceiling. */
export function payShareBp(d, athlete) {
  const cls = CLASSES[athlete.classId];
  const bp = TRAINING.payFloorBp
    + (athlete.cleared ? TRAINING.replayPayBp : 0)
    + (athlete.fuelled ? TRAINING.fuelPayBp : 0)
    + (cls?.payBp?.[d.id] || 0);
  return Math.min(TRAINING.payCeilBp, Math.max(TRAINING.payFloorBp, bp));
}

const coinsFor = (xp) => Math.floor(xp * GEAR_RULES.coinsPerXp);

/**
 * Settles an attempt. `roll` is in [0, 1) and comes from the server when the
 * drill starts, so the outcome is known then and only shown as the clock runs.
 * Stamina is taken at the rate of the attempt's own burn; if it runs out first
 * the athlete stops there.
 * @returns {DrillResult}
 */
export function settleDrill(d, level, athlete, stamina, roll) {
  const plan = planDrill(d, level, athlete);
  const r = Math.max(0, Math.min(0.999999, roll));
  const burn = plan.burnLow + (plan.burnHigh - plan.burnLow) * r;
  const baseXp = realSessionXp(d, level) * TRAINING.payFloorBp / 10000;
  if (stamina < burn) {
    const xp = Math.round(baseXp * TRAINING.failShareBp / 10000);
    return { ok: false, burn, spent: stamina, stoppedAtMin: plan.durationMin * (stamina / burn), xp, coins: coinsFor(xp), bonus: null };
  }
  const xp = Math.max(1, Math.round(realSessionXp(d, level) * payShareBp(d, athlete) / 10000));
  return { ok: true, burn, spent: burn, stoppedAtMin: plan.durationMin, xp, coins: coinsFor(xp), bonus: athlete.cleared ? 'replay' : 'first-clear' };
}

/** What finishing pays beyond XP. A first clear drops a crate; a replay, carbs for certain. */
export function completionBonus(level, bonus) {
  if (bonus === 'first-clear') return { crate: true, carbs: 0, maxStamina: ENERGY.maxPerClear };
  if (bonus === 'replay') return { crate: false, carbs: 4 + 4 * level, maxStamina: 0 };
  return { crate: false, carbs: 0, maxStamina: 0 };
}

/** Drill coins left today after this many were earned. */
export const drillCoinsLeft = (earnedToday) => Math.max(0, TRAINING.dailyDrillCoinCap - Math.max(0, earnedToday || 0));

// ---- Classes ----------------------------------------------------------------

/**
 * drainBp: more or less stamina per discipline. durationBp: shorter or longer
 * drills. payBp: extra share of pay, still inside the floor and ceiling.
 * @type {Record<ClassId, {id: ClassId, body: string, drainBp: Partial<Record<DisciplineId, number>>, durationBp: Partial<Record<DisciplineId, number>>, payBp: Partial<Record<DisciplineId, number>>}>}
 */
export const CLASSES = {
  pacer: {
    id: 'pacer', body: 'lean',
    drainBp: { run: -1800, bike: -1200, swim: -1200, lift: 2500 },
    durationBp: {}, payBp: {},
  },
  triathlete: {
    id: 'triathlete', body: 'medium',
    drainBp: { run: -1000, bike: -1000, swim: -1000, lift: 500 },
    durationBp: { run: -1000, bike: -1000, swim: -1000 }, payBp: {},
  },
  functional: {
    id: 'functional', body: 'strong',
    drainBp: { run: -400, bike: -400, swim: -400, lift: -1200 },
    durationBp: {}, payBp: { lift: 200 },
  },
  titan: {
    id: 'titan', body: 'tank',
    drainBp: { run: 3000, bike: 3000, swim: 3000, lift: -2500 },
    durationBp: {}, payBp: { lift: 500 },
  },
};

export const CLASS_SWITCH = { coins: 400, carbs: 150, firstFree: true };

/** The price of moving to a class. The first choice is free; the same class costs nothing. */
export function classSwitchCost(current, next) {
  if (!CLASSES[next] || current === next) return { coins: 0, carbs: 0 };
  if (!current && CLASS_SWITCH.firstFree) return { coins: 0, carbs: 0 };
  return { coins: CLASS_SWITCH.coins, carbs: CLASS_SWITCH.carbs };
}

// ---- Clothes and sets --------------------------------------------------------

export const WEAR_SLOTS = ['top', 'bottom', 'shoes'];

/** Wearing pieces of one set adds up. Sets are data: the art is one texture per set. */
export const SETS = {
  aero: { id: 'aero', bonus: { 2: { drainBp: 300, crateBp: 0 }, 3: { drainBp: 600, crateBp: 500 } } },
  iron: { id: 'iron', bonus: { 2: { drainBp: 300, crateBp: 0 }, 3: { drainBp: 600, crateBp: 500 } } },
  forge: { id: 'forge', bonus: { 2: { drainBp: 300, crateBp: 0 }, 3: { drainBp: 600, crateBp: 500 } } },
  titan: { id: 'titan', bonus: { 2: { drainBp: 300, crateBp: 0 }, 3: { drainBp: 600, crateBp: 500 } } },
};

/** What the clothes worn add up to. `worn` is { top: setId, bottom: setId, shoes: setId }. */
export function setBonus(worn = {}) {
  const count = {};
  for (const slot of WEAR_SLOTS) if (SETS[worn[slot]]) count[worn[slot]] = (count[worn[slot]] || 0) + 1;
  const out = { drainBp: 0, crateBp: 0 };
  for (const [id, n] of Object.entries(count)) {
    const b = SETS[id].bonus[n];
    if (b) { out.drainBp += b.drainBp; out.crateBp += b.crateBp; }
  }
  return out;
}

// ---- The mechanic and what things cost --------------------------------------

/** Each worker past the first waits behind a milestone. Add a row to add a worker. */
export const WORKERS = [
  { id: 'mechanic-1', unlock: null },
  { id: 'mechanic-2', unlock: { feat: 'cross-four-weeks' } },
];

export const BUILD = {
  machinePrice: [0, 300, 900, 2000],     // to reach tier 1..4
  machineFitMin: [0, 60, 240, 720],
  floorPrice: 250,
  floorFitMin: 120,
  wageBp: 1000,                          // paid when the job is assigned, on top
};

/** The wage for a job at this price. */
export const wageFor = (price) => Math.ceil(Math.max(0, price) * BUILD.wageBp / 10000);

/** How many workers this player has. */
export const workerCount = (featIds = []) => WORKERS.filter((w) => !w.unlock || featIds.includes(w.unlock.feat)).length;

/** Workers free at `now`, by index. */
export function freeWorkers(jobs, featIds, now) {
  const busy = new Set((jobs || []).filter((j) => j.startsAt <= now && now < j.endsAt).map((j) => j.worker));
  return Array.from({ length: workerCount(featIds) }, (_, i) => i).filter((i) => !busy.has(i));
}

/** Gives a job to a free worker. There's no queue: with nobody free it's refused. */
export function assignJob(jobs, featIds, now, { id, kind, target, minutes }) {
  const free = freeWorkers(jobs, featIds, now);
  if (!free.length) return { ok: false, reason: 'busy' };
  return { ok: true, job: { id, kind, target, startsAt: now, endsAt: now + minutes * 60000, worker: free[0] } };
}

// ---- Carbs from the base ----------------------------------------------------

/** A cafe in the base makes carbs like a market makes coins: it fills, then stops until collected. */
export const CAFE = {
  'coffee-machine': { carbsPerHour: [2, 3, 4], holdsHours: 12 }, // by tier
};
