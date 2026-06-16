// plan.js — the periodized training plan, encoded as weekly templates per phase
// and expanded over real calendar dates. Pure logic: no DOM, no storage.
//
// Source of truth for the seed. Expanding templates (rather than hand-typing
// every day) keeps the plan tweakable and the logic unit-testable.

import { dateRange, weekdayMon0, startOfWeek, diffDays, parseISO } from './dates.js';

export const PLAN_START = '2026-07-01';
export const PLAN_END = '2026-12-06';

export const PHASES = [
  {
    id: 'base', name: 'Base + Strength', start: '2026-07-01', end: '2026-08-31',
    focus: 'Strength, aerobic engine, run base, swim', hours: '10–12',
  },
  {
    id: 'specific', name: '70.3 Specific', start: '2026-09-01', end: '2026-10-19',
    focus: 'Bike sharpening, bricks, race pace, taper', hours: '10–12',
  },
  {
    id: 'bridge', name: 'Marathon Bridge', start: '2026-10-20', end: '2026-12-06',
    focus: 'Run durability, long-run build, taper', hours: '7–9',
  },
];

export const RACES = [
  {
    date: '2026-10-19', title: 'IRONMAN 70.3', emoji: '🏆',
    note: '1.9 km swim · 90 km bike · 21.1 km run. Race fuelling 60–90 g carbs/h.',
  },
  {
    date: '2026-12-06', title: 'Marathon', emoji: '🥇',
    note: '42.2 km. Marathon pace set after the 70.3.',
  },
];

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const PACKING = {
  run: ['Running shoes', 'Run watch / HR strap', 'Cap or visor', 'Gels / chews', 'Anti-chafe balm', 'Water flask'],
  bike: ['Bib shorts', 'Cycling shoes', 'Towel', 'Fan on', '2× bottles', 'Chamois cream', 'HR strap'],
  swim: ['Swimsuit', 'Goggles', 'Swim cap', 'Towel', 'Flip-flops', 'Anti-fog spray'],
  gym: ['Lifting shoes', 'Belt', 'Knee sleeves', 'Chalk / straps', 'Water bottle'],
  brick: ['Bib shorts', 'Cycling + run shoes', 'Race belt', 'Bottles + gels', 'Towel', 'Transition towel'],
  mobility: ['Mat', 'Foam roller', 'Resistance band'],
  other: ['Water bottle', 'Towel'],
};

const GYM = {
  lowerA: [
    { name: 'Back squat', sets: 4, reps: '5' },
    { name: 'Romanian deadlift', sets: 3, reps: '6' },
    { name: 'Bulgarian split squat', sets: 3, reps: '8 / leg' },
    { name: 'Standing calf raise', sets: 4, reps: '8' },
    { name: 'Copenhagen plank', sets: 3, reps: '20 s / side' },
  ],
  lowerB: [
    { name: 'Trap-bar deadlift', sets: 4, reps: '4' },
    { name: 'Step-up', sets: 3, reps: '8 / leg' },
    { name: 'Nordic hamstring curl', sets: 3, reps: '5' },
    { name: 'Standing calf raise', sets: 3, reps: '10' },
    { name: 'Pallof press', sets: 3, reps: '10 / side' },
  ],
  upper: [
    { name: 'Pull-up', sets: 4, reps: '6–8' },
    { name: 'DB bench press', sets: 3, reps: '8' },
    { name: 'Seated row', sets: 3, reps: '10' },
    { name: 'Shoulder press', sets: 3, reps: '8' },
    { name: 'Face pull', sets: 2, reps: '15' },
  ],
  maintenance: [
    { name: 'Back squat', sets: 3, reps: '4' },
    { name: 'Romanian deadlift', sets: 2, reps: '5' },
    { name: 'Standing calf raise', sets: 3, reps: '12' },
  ],
  light: [
    { name: 'Trap-bar deadlift', sets: 2, reps: '5' },
    { name: 'Nordic hamstring curl', sets: 2, reps: '5' },
    { name: 'Standing calf raise', sets: 3, reps: '12' },
  ],
};

/** Build a repeating interval block as colour-coded segments. */
function intervals({ warmup = 0, reps, work, rest, workKind, restKind = 'easy', cooldown = 0, workLabel, restLabel }) {
  const segs = [];
  if (warmup) segs.push({ label: 'Warm-up', kind: 'warmup', value: warmup, intensity: 'easy' });
  for (let i = 0; i < reps; i++) {
    segs.push({ label: workLabel || `Rep ${i + 1}`, kind: 'work', value: work, intensity: workKind });
    if (i < reps - 1 || rest) segs.push({ label: restLabel || 'Float', kind: 'rest', value: rest, intensity: restKind });
  }
  if (cooldown) segs.push({ label: 'Cool-down', kind: 'cooldown', value: cooldown, intensity: 'easy' });
  return segs;
}

let _uid = 0;
function s(desc) {
  // Normalise a session descriptor into a full session object (no date yet).
  return {
    type: 'other', intensity: 'easy', durationMin: 45, completed: false,
    metrics: {}, segments: [], exercises: [], packing: [], notes: '',
    optional: false,
    ...desc,
    packing: (desc.packing || PACKING[desc.type] || PACKING.other).map((item) => ({ item, checked: false })),
    exercises: (desc.exercises || []).map((e) => ({ done: false, weight: '', rpe: '', actualReps: '', notes: '', imageUrl: '', ...e })),
  };
}

// ---------------------------------------------------------------------------
// Weekly templates — index 0..6 == Mon..Sun. Each day is an array of sessions.
// ---------------------------------------------------------------------------

const TEMPLATES = {
  base: [
    // Mon — run quality + swim
    [
      { type: 'run', title: 'Run quality — Fartlek', intensity: 'quality', durationMin: 60, metrics: { distanceKm: 12 },
        segments: intervals({ warmup: 15, reps: 6, work: 3, rest: 2, workKind: 'threshold', restKind: 'easy', cooldown: 10, workLabel: 'Hard', restLabel: 'Float' }),
        notes: 'Fartlek 6×(3′ hard / 2′ float). Stay relaxed on the hard reps — controlled, not maximal.' },
      { type: 'swim', title: 'Swim — own plan', intensity: 'steady', durationMin: 40, metrics: { distanceKm: 1.6 },
        notes: 'Technique + aerobic. Your own set.' },
    ],
    // Tue — gym Lower A + easy spin
    [
      { type: 'gym', title: 'Gym — Lower A (heavy)', intensity: 'quality', durationMin: 50, exercises: GYM.lowerA,
        notes: 'Heavy strength. Brace hard, full depth on squats. Log weight + RPE.' },
      { type: 'bike', title: 'Easy spin', intensity: 'easy', durationMin: 30, metrics: { distanceKm: 14 },
        notes: 'Pure recovery flush, conversational RPE 3.' },
    ],
    // Wed — bike Z2 + gym Upper
    [
      { type: 'bike', title: 'Bike Z2 endurance', intensity: 'steady', durationMin: 96, metrics: { distanceKm: 50 },
        notes: 'Z2 conversational (RPE 3–4). Slot in 4×1′ at 100+ rpm high-cadence inside the ride.' },
      { type: 'gym', title: 'Gym — Upper', intensity: 'moderate', durationMin: 45, exercises: GYM.upper,
        notes: 'Pull-focused upper body. Keep it crisp.' },
    ],
    // Thu — bike VO2 + swim
    [
      { type: 'bike', title: 'Bike VO₂', intensity: 'vo2', durationMin: 66, metrics: { distanceKm: 35 },
        segments: intervals({ warmup: 12, reps: 5, work: 3, rest: 3, workKind: 'vo2', restKind: 'easy', cooldown: 10, workLabel: 'VO₂', restLabel: 'Easy' }),
        notes: '5×(3′ VO₂ RPE 8–9 / 3′ easy). HR + RPE, ignore gym-bike watts.' },
      { type: 'swim', title: 'Swim — own plan', intensity: 'steady', durationMin: 40, metrics: { distanceKm: 1.6 } },
    ],
    // Fri — gym Lower B (optional)
    [
      { type: 'gym', title: 'Gym — Lower B (single-leg + Nordics)', intensity: 'moderate', durationMin: 45, exercises: GYM.lowerB, optional: true,
        notes: 'Flex / optional. Nordics + calf work protect the past run injury — don’t skip those two.' },
    ],
    // Sat — long run
    [
      { type: 'run', title: 'Long run — easy', intensity: 'easy', durationMin: 100, metrics: { distanceKm: 18 },
        notes: 'Easy pace ~5:05–5:30/km. Practice fuelling 60–90 g carbs/h.' },
    ],
    // Sun — long ride
    [
      { type: 'bike', title: 'Long ride Z2', intensity: 'steady', durationMin: 135, metrics: { distanceKm: 70 },
        notes: 'Backbone of the 200 km week. Z2, can hold a conversation. Practice on-bike fuelling.' },
    ],
  ],

  specific: [
    // Mon — swim + strength maintenance
    [
      { type: 'swim', title: 'Swim aerobic', intensity: 'steady', durationMin: 40, metrics: { distanceKm: 1.8 } },
      { type: 'gym', title: 'Gym — strength maintenance', intensity: 'moderate', durationMin: 30, exercises: GYM.maintenance,
        notes: 'Maintenance dose, 1×/week now. Keep the bar moving fast.' },
    ],
    // Tue — bike threshold / sweet-spot
    [
      { type: 'bike', title: 'Bike threshold / sweet-spot', intensity: 'threshold', durationMin: 85, metrics: { distanceKm: 42 },
        segments: intervals({ warmup: 12, reps: 3, work: 13, rest: 5, workKind: 'threshold', restKind: 'easy', cooldown: 8, workLabel: 'Threshold', restLabel: 'Easy' }),
        notes: '2–3×12–15′ at RPE 6–7 / 5′ easy. Build sustainable power for 70.3.' },
    ],
    // Wed — run threshold + optional swim
    [
      { type: 'run', title: 'Run threshold', intensity: 'threshold', durationMin: 60, metrics: { distanceKm: 12 },
        segments: intervals({ warmup: 12, reps: 4, work: 8, rest: 2, workKind: 'threshold', restKind: 'easy', cooldown: 10, workLabel: 'Tempo', restLabel: 'Easy' }),
        notes: '4×8′ tempo (or 6×3′) at ~4:10–4:25/km, RPE 6–7.' },
      { type: 'swim', title: 'Easy swim', intensity: 'easy', durationMin: 30, metrics: { distanceKm: 1.4 }, optional: true },
    ],
    // Thu — bike Z2 long
    [
      { type: 'bike', title: 'Bike Z2 long', intensity: 'steady', durationMin: 135, metrics: { distanceKm: 68 },
        notes: '2–2.5 h steady Z2. Some races-effort surges optional. Fuel it.' },
    ],
    // Fri — easy run + swim
    [
      { type: 'run', title: 'Easy run', intensity: 'easy', durationMin: 35, metrics: { distanceKm: 7 }, optional: true,
        notes: 'Easy shakeout, or rest if tired. Sleep beats an extra session.' },
      { type: 'swim', title: 'Easy swim', intensity: 'easy', durationMin: 30, metrics: { distanceKm: 1.4 }, optional: true },
    ],
    // Sat — brick
    [
      { type: 'brick', title: 'Brick — ride + run', intensity: 'race', durationMin: 200, metrics: { distanceKm: 78 },
        notes: 'Ride 2.5–3 h with race-effort blocks → straight into 20–30′ run at 70.3 pace. Dial transitions + fuelling.' },
    ],
    // Sun — long run w/ race pace
    [
      { type: 'run', title: 'Long run + 70.3 pace', intensity: 'moderate', durationMin: 100, metrics: { distanceKm: 18 },
        notes: '90–110′ with some at 70.3 pace, or easy + open-water swim.' },
    ],
  ],

  bridge: [
    // Mon — rest / easy swim
    [
      { type: 'swim', title: 'Easy swim or rest', intensity: 'easy', durationMin: 30, metrics: { distanceKm: 1.2 }, optional: true,
        notes: 'Swim is parked this phase — optional flush only. Rest is fine.' },
    ],
    // Tue — run quality
    [
      { type: 'run', title: 'Run quality — threshold', intensity: 'threshold', durationMin: 60, metrics: { distanceKm: 12 },
        segments: intervals({ warmup: 12, reps: 4, work: 8, rest: 2, workKind: 'threshold', restKind: 'easy', cooldown: 10, workLabel: 'Threshold', restLabel: 'Easy' }),
        notes: '4×8′ threshold, or marathon-pace 2×5 km. ~4:10–4:25/km.' },
    ],
    // Wed — easy bike + light strength
    [
      { type: 'bike', title: 'Easy bike (recovery)', intensity: 'easy', durationMin: 50, metrics: { distanceKm: 22 },
        notes: 'Maintenance / recovery spin only. Bike is easy this phase.' },
      { type: 'gym', title: 'Light strength', intensity: 'moderate', durationMin: 25, exercises: GYM.light,
        notes: 'Keep Nordics + calves going for run durability.' },
    ],
    // Thu — easy run + strides
    [
      { type: 'run', title: 'Easy run + strides', intensity: 'easy', durationMin: 45, metrics: { distanceKm: 9 },
        notes: 'Easy + 6×20 s strides. Smooth and light.' },
    ],
    // Fri — rest / easy swim
    [
      { type: 'swim', title: 'Easy swim or rest', intensity: 'easy', durationMin: 25, metrics: { distanceKm: 1 }, optional: true },
    ],
    // Sat — pre-long shakeout
    [
      { type: 'run', title: 'Easy run (shakeout)', intensity: 'easy', durationMin: 35, metrics: { distanceKm: 7 },
        notes: 'Pre-long-run shakeout. Loose and easy.' },
    ],
    // Sun — long run (overridden by progression below)
    [
      { type: 'run', title: 'Long run', intensity: 'easy', durationMin: 90, metrics: { distanceKm: 16 },
        notes: 'Easy long run.' },
    ],
  ],
};

// Phase-3 Sunday long-run progression, keyed by date.
const BRIDGE_LONG_RUNS = {
  '2026-10-25': { durationMin: 85, distanceKm: 16, intensity: 'easy', notes: 'Very easy 75–90′ — first long run off the 70.3. No pace pressure.' },
  '2026-11-01': { durationMin: 130, distanceKm: 23, intensity: 'easy', notes: '22–24 km easy. Build durability gently.' },
  '2026-11-08': { durationMin: 155, distanceKm: 27, intensity: 'moderate', notes: '27–28 km, last 5 km steady.' },
  '2026-11-15': { durationMin: 180, distanceKm: 32, intensity: 'moderate', notes: 'Peak 32 km — middle 2×6 km at MP. Ceiling, not a must: 28–30 km is fine if anything niggles.' },
  '2026-11-22': { durationMin: 130, distanceKm: 24, intensity: 'moderate', notes: '24 km with 8 km at marathon pace.' },
  '2026-11-29': { durationMin: 95, distanceKm: 17, intensity: 'easy', notes: '16–18 km easy — taper week.' },
};

// Race-day sessions replace the normal template for that date.
const RACE_SESSIONS = {
  '2026-10-19': { type: 'brick', title: 'IRONMAN 70.3 — RACE DAY', intensity: 'race', durationMin: 330, metrics: { distanceKm: 113 },
    packing: ['Wetsuit', 'Goggles ×2', 'Tri suit', 'Bike + helmet', 'Race shoes', 'Race belt + bib', 'Gels / carbs 60–90 g/h', 'Bottles', 'Bodyglide', 'Timing chip'],
    notes: '1.9 km swim · 90 km bike · 21.1 km run. Execute fuelling 60–90 g carbs/h. Trust the training.' },
  '2026-12-06': { type: 'run', title: 'Marathon — RACE DAY', intensity: 'race', durationMin: 210, metrics: { distanceKm: 42.2 },
    packing: ['Race shoes', 'Race kit + bib', 'Gels (carbs)', 'Cap', 'Anti-chafe', 'Throwaway layer', 'Timing chip'],
    notes: '42.2 km at marathon pace ~4:40–4:55/km (lock in after the 70.3). Even effort, fuel early.' },
};

// Taper window inside the 70.3 phase (cut volume, keep short race-pace primers).
const TAPER_START = '2026-10-06';
const TAPER_END = '2026-10-18';

// ---------------------------------------------------------------------------
// Expansion
// ---------------------------------------------------------------------------

export function phaseFor(iso) {
  return PHASES.find((p) => diffDays(iso, p.start) >= 0 && diffDays(iso, p.end) <= 0) || null;
}

/** 1-based week number within a phase (Monday-anchored weeks). */
export function weekNumberInPhase(iso, phase) {
  const phaseMonday = startOfWeek(phase.start, 1);
  return Math.floor(diffDays(startOfWeek(iso, 1), phaseMonday) / 7) + 1;
}

function inTaper(iso) {
  return diffDays(iso, TAPER_START) >= 0 && diffDays(iso, TAPER_END) <= 0;
}

/** Is this a deload week? Every 4th week in phases base + specific (not taper). */
export function isDeloadWeek(iso) {
  const phase = phaseFor(iso);
  if (!phase || (phase.id !== 'base' && phase.id !== 'specific')) return false;
  if (inTaper(iso)) return false;
  return weekNumberInPhase(iso, phase) % 4 === 0;
}

function scaleSession(session, factor, tag) {
  const out = structuredClone(session);
  out.durationMin = Math.max(15, Math.round((out.durationMin * factor) / 5) * 5);
  if (out.metrics?.distanceKm) {
    out.metrics.distanceKm = Math.round(out.metrics.distanceKm * factor * 10) / 10;
  }
  out.title = `${out.title} ${tag}`;
  out.notes = `${tag === '(deload)' ? 'Deload week — ~40% less volume. ' : 'Taper — keep it short and sharp. '}${out.notes || ''}`.trim();
  return out;
}

/**
 * Expand the plan into dated, completable workout objects.
 * @returns {Array} workouts sorted by date.
 */
export function expandPlan({ start = PLAN_START, end = PLAN_END } = {}) {
  const out = [];
  for (const iso of dateRange(start, end)) {
    const phase = phaseFor(iso);
    if (!phase) continue;

    // Race day overrides everything.
    if (RACE_SESSIONS[iso]) {
      out.push(finalize(s(RACE_SESSIONS[iso]), iso, phase, 0, false, true));
      continue;
    }

    const wd = weekdayMon0(iso);
    const weekNum = weekNumberInPhase(iso, phase);
    const deload = isDeloadWeek(iso);
    const taper = inTaper(iso);

    let day = TEMPLATES[phase.id][wd].map((desc) => s(desc));

    // Phase-3 Sunday long-run progression.
    if (phase.id === 'bridge' && wd === 6 && BRIDGE_LONG_RUNS[iso]) {
      const lr = BRIDGE_LONG_RUNS[iso];
      day = [s({ type: 'run', title: 'Long run', intensity: lr.intensity, durationMin: lr.durationMin, metrics: { distanceKm: lr.distanceKm }, notes: lr.notes })];
    }

    if (deload) day = day.map((sess) => scaleSession(sess, 0.6, '(deload)'));
    else if (taper) day = day.map((sess) => scaleSession(sess, 0.55, '(taper)'));

    day.forEach((sess, i) => out.push(finalize(sess, iso, phase, i, deload || taper, false)));
  }
  return out;
}

function finalize(session, iso, phase, idx, deload, isRace) {
  return {
    id: `seed-${iso}-${idx}`,
    date: iso,
    phase: phase.name,
    phaseId: phase.id,
    weekNum: weekNumberInPhase(iso, phase),
    deload: !!deload,
    isRace: !!isRace,
    seeded: true,
    source: 'plan',
    completedAt: null,
    ...session,
  };
}

export const PLAN_PRINCIPLES = [
  'VO₂max is already 67 (lab) — gains come from threshold + strength economy + durability. One VO₂ session/week is enough.',
  'Never spike weekly run volume more than ~10%.',
  'Nordic curls + calf work every week — they protect the past run injury. Don’t skip them.',
  'Practice race fuelling: 60–90 g carbs/h on long rides and runs.',
  'Sleep beats an extra session. On heavy weeks protect: Mon run quality, Thu bike quality, the Sat long run, and one strength session — drop the rest guilt-free.',
];

export const PACE_REFERENCE = [
  { label: 'Easy / long run', value: '~5:05–5:30 /km', kind: 'easy' },
  { label: 'Marathon pace (provisional)', value: '~4:40–4:55 /km', kind: 'moderate' },
  { label: 'Threshold run', value: '~4:10–4:25 /km (RPE 6–7)', kind: 'threshold' },
  { label: 'Bike Z2', value: 'Conversational, RPE 3–4', kind: 'steady' },
  { label: 'Bike VO₂', value: '5×3′ hard RPE 8–9 / 3′ easy', kind: 'vo2' },
  { label: 'Bike threshold', value: '2–3×12–15′ RPE 6–7 / 5′ easy', kind: 'threshold' },
];
