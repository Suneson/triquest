// exercises.js — the exercise library. Pure data plus lookups; no DOM.
//
// One entry per exercise:
//   { id, name, equipment, muscle, secondary, defaultKind, defaultRestSec, cues, aliases }
// `defaultKind` is how a set is logged: weight_reps | bodyweight | time | distance.
// `aliases` are other names the same movement goes by; matchExercise() uses
// them to turn free text (old plans, the AI, a typed name) into a library id.
//
// Art lives at icons/Pixelart/EXERCISES/<id>.png (cut from the exercise sheets
// by tools/slice-exercise-art.mjs). Until an entry has art, the app falls back
// to the line drawing from poses.js.
//
// Names and cues are written here in English and translated in the locales
// (ex.<id>.name / ex.<id>.cues): `name` and `cues` read the active language,
// `nameEn` stays English for matching and for the AI. The id never changes.
//
// Covers the 52 exercises on the sheets (docs/gym/sheets, mapping in
// docs/gym/sheets.json), which include every exercise the built-in plan uses.

import { t, tList, has, valueAt } from './i18n.js';

export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Traps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Abs', 'Full body', 'Cardio'];

export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Kettlebell', 'Machine', 'Cable', 'Band',
  'Trap bar', 'Bodyweight', 'Other'];

export const EXERCISE_KINDS = ['weight_reps', 'bodyweight', 'time', 'distance'];

const ex = (id, nameEn, equipment, muscle, secondary, defaultKind, defaultRestSec, cuesEn, aliases = []) => ({
  id, nameEn, equipment, muscle, secondary, defaultKind, defaultRestSec, cuesEn, aliases,
  get name() { return has(`ex.${id}.name`) ? t(`ex.${id}.name`) : nameEn; },
  get cues() { return has(`ex.${id}.cues`) ? tList(`ex.${id}.cues`) : cuesEn; },
});

/** A muscle group / piece of equipment in the active language (the stored value stays English). */
export const muscleLabel = (m) => (has(`muscle.${m}`) ? t(`muscle.${m}`) : m);
export const equipLabel = (e) => (has(`equip.${e}`) ? t(`equip.${e}`) : e);

export const EXERCISES = [
  ex('back-squat', 'Back Squat', 'Barbell', 'Quads', ['Glutes', 'Hamstrings', 'Abs'], 'weight_reps', 180,
    ['Brace your core before you descend', 'Knees track over toes, sit between the hips', 'Drive the floor away — full depth'],
    ['squat (barbell)', 'barbell squat', 'barbell back squat', 'squat', 'high bar squat', 'low bar squat']),
  ex('romanian-deadlift', 'Romanian Deadlift', 'Barbell', 'Hamstrings', ['Glutes', 'Back'], 'weight_reps', 150,
    ['Hinge at the hips, soft knees', 'Bar stays close, shins vertical', 'Feel the hamstring stretch, flat back'],
    ['rdl', 'barbell rdl', 'stiff leg deadlift', 'stiff-legged deadlift']),
  ex('trap-bar-deadlift', 'Trap Bar Deadlift', 'Trap bar', 'Glutes', ['Quads', 'Hamstrings', 'Back'], 'weight_reps', 180,
    ['Chest up, push the floor away', 'Neutral spine, lats engaged', 'Stand tall, squeeze glutes at the top'],
    ['hex bar deadlift', 'trap-bar deadlift', 'hex-bar deadlift']),
  ex('bulgarian-split-squat', 'Bulgarian Split Squat', 'Dumbbell', 'Quads', ['Glutes', 'Adductors'], 'weight_reps', 90,
    ['Most weight through the front heel', 'Drop straight down, torso tall', 'Control the rear knee toward the floor'],
    ['bulgarian split squat (dumbbell)', 'dumbbell bulgarian split squat', 'rear foot elevated split squat', 'rfess', 'split squat']),
  ex('step-up', 'Step Up', 'Dumbbell', 'Quads', ['Glutes'], 'weight_reps', 90,
    ['Drive through the top foot', 'Don’t push off the trailing leg', 'Control the descent — no bouncing'],
    ['step-up', 'dumbbell step up', 'box step up', 'step ups']),
  ex('standing-calf-raise', 'Standing Calf Raise', 'Machine', 'Calves', [], 'weight_reps', 60,
    ['Full range — heels low to high', 'Pause at the top, squeeze', 'Slow on the way down'],
    ['calf raise', 'calf raises', 'standing calf raises']),
  ex('nordic-hamstring-curl', 'Nordic Hamstring Curl', 'Bodyweight', 'Hamstrings', [], 'bodyweight', 120,
    ['Anchor the ankles firmly', 'Lower as slowly as you can', 'Keep hips extended, hinge from the knees'],
    ['nordic curl', 'nordics', 'nordic hamstring curls']),
  ex('copenhagen-plank', 'Copenhagen Plank', 'Bodyweight', 'Adductors', ['Abs'], 'time', 60,
    ['Stack shoulder over elbow', 'Squeeze the top adductor', 'Keep a straight line head-to-hip'],
    ['copenhagen', 'copenhagen side plank', 'adductor plank']),
  ex('pull-up', 'Pull Up', 'Bodyweight', 'Back', ['Biceps'], 'bodyweight', 120,
    ['Start from a dead hang', 'Pull elbows down and back', 'Chin over the bar, control the lower'],
    ['pull-up', 'pullup', 'pull ups', 'chin up', 'chin-up', 'chinup']),
  ex('dumbbell-bench-press', 'Dumbbell Bench Press', 'Dumbbell', 'Chest', ['Triceps', 'Shoulders'], 'weight_reps', 120,
    ['Shoulder blades pinned to the bench', 'Lower to mid-chest', 'Press up and slightly together'],
    ['bench press (dumbbell)', 'db bench press', 'db bench', 'dumbbell bench', 'dumbbell press']),
  ex('seated-cable-row', 'Seated Cable Row', 'Cable', 'Back', ['Biceps'], 'weight_reps', 90,
    ['Tall chest, pull to the navel', 'Squeeze shoulder blades together', 'Don’t lean back — stay over the hips'],
    ['seated cable row - v grip (cable)', 'seated cable row v grip', 'v grip row', 'seated row', 'cable row', 'low row', 'seated rows']),
  ex('shoulder-press', 'Shoulder Press', 'Dumbbell', 'Shoulders', ['Triceps'], 'weight_reps', 120,
    ['Brace, don’t arch the lower back', 'Press to a locked-out finish', 'Bar/dumbbells over the mid-foot'],
    ['shoulder press (dumbbell)', 'overhead press', 'ohp', 'military press', 'dumbbell shoulder press', 'db shoulder press']),
  ex('face-pull', 'Face Pull', 'Cable', 'Shoulders', ['Traps', 'Back'], 'weight_reps', 60,
    ['Pull to eye level, elbows high', 'Externally rotate at the end', 'Light weight, slow tempo'],
    ['face pulls', 'cable face pull', 'rope face pull']),
  ex('pallof-press', 'Pallof Press', 'Cable', 'Abs', [], 'weight_reps', 60,
    ['Square hips and shoulders to the front', 'Press straight out, resist the twist', 'Slow out, slow back'],
    ['pallof', 'anti-rotation press', 'band pallof press']),

  // ---- from the exercise sheets (docs/gym/sheets) ----
  // chest
  ex('barbell-bench-press', 'Bench Press (Barbell)', 'Barbell', 'Chest', ['Triceps', 'Shoulders'], 'weight_reps', 180,
    ['Feet planted, shoulder blades squeezed', 'Lower to the lower chest, elbows ~45°', 'Press up and slightly back over the shoulders'],
    ['bench press', 'barbell bench press', 'barbell bench', 'flat bench press']),
  ex('incline-dumbbell-press', 'Incline Bench Press (Dumbbell)', 'Dumbbell', 'Chest', ['Shoulders', 'Triceps'], 'weight_reps', 120,
    ['Bench at 30–45°', 'Lower to the upper chest', 'Press up without clanking the bells'],
    ['incline dumbbell press', 'incline db press', 'incline dumbbell bench press', 'incline bench press', 'incline press']),
  ex('cable-fly-crossover', 'Cable Fly Crossovers', 'Cable', 'Chest', ['Shoulders'], 'weight_reps', 60,
    ['Soft bend in the elbows, keep it fixed', 'Hug a barrel — hands meet in front', 'Slow back to a stretch'],
    ['cable fly', 'cable crossover', 'cable crossovers', 'cable flyes']),
  ex('dumbbell-chest-fly', 'Chest Fly (Dumbbell)', 'Dumbbell', 'Chest', ['Shoulders'], 'weight_reps', 60,
    ['Slight bend in the elbows', 'Open wide to a stretch, not past the shoulders', 'Squeeze the chest to bring them together'],
    ['chest fly', 'dumbbell fly', 'db fly', 'dumbbell flyes', 'flat fly']),
  ex('machine-chest-fly', 'Chest Fly (Machine)', 'Machine', 'Chest', ['Shoulders'], 'weight_reps', 60,
    ['Seat so the handles are at chest height', 'Elbows soft, squeeze together', 'Control the return'],
    ['pec deck', 'pec fly', 'machine fly', 'butterfly']),
  ex('band-chest-fly', 'Chest Fly (Band)', 'Band', 'Chest', ['Shoulders'], 'weight_reps', 60,
    ['Step out until the band is tight at the start', 'Arms wide, slight elbow bend', 'Squeeze, pause, slow back'],
    ['band fly', 'resistance band chest fly']),
  ex('suspension-chest-fly', 'Chest Fly (Suspension)', 'Other', 'Chest', ['Shoulders', 'Abs'], 'bodyweight', 60,
    ['Body in a straight plank line', 'Open the arms slowly, elbows soft', 'Squeeze back up — steeper is harder'],
    ['trx fly', 'trx chest fly', 'suspension fly', 'ring fly']),
  ex('chest-dip', 'Chest Dip', 'Bodyweight', 'Chest', ['Triceps', 'Shoulders'], 'bodyweight', 120,
    ['Lean forward slightly to load the chest', 'Lower until shoulders are just below elbows', 'Press back up to lockout'],
    ['dip', 'dips', 'parallel bar dip', 'bar dip']),
  ex('assisted-chest-dip', 'Chest Dip (Assisted)', 'Machine', 'Chest', ['Triceps', 'Shoulders'], 'weight_reps', 90,
    ['More counterweight makes it easier', 'Lean forward, lower under control', 'Press up without bouncing off the pad'],
    ['assisted dip', 'assisted dips', 'machine assisted dip']),
  ex('weighted-chest-dip', 'Chest Dip (Weighted)', 'Other', 'Chest', ['Triceps', 'Shoulders'], 'weight_reps', 150,
    ['Belt snug, weight hanging still', 'Same depth as a bodyweight dip', 'Drive up, don’t swing'],
    ['weighted dip', 'weighted dips']),
  // back
  ex('bent-over-row', 'Bent Over Row (Barbell)', 'Barbell', 'Back', ['Biceps', 'Traps'], 'weight_reps', 120,
    ['Hinge to ~45°, flat back', 'Pull the bar to the lower ribs', 'Lower under control, no torso swing'],
    ['barbell row', 'bent over barbell row', 'bent-over row', 'bb row']),
  ex('lat-pulldown', 'Lat Pulldown (Cable)', 'Cable', 'Back', ['Biceps'], 'weight_reps', 90,
    ['Thighs locked under the pad', 'Pull the bar to the upper chest', 'Elbows down and in, slow on the way up'],
    ['lat pulldown', 'lat pull down', 'pulldown', 'wide grip pulldown']),
  ex('deadlift', 'Deadlift (Barbell)', 'Barbell', 'Glutes', ['Hamstrings', 'Back', 'Quads'], 'weight_reps', 180,
    ['Bar over mid-foot, shins close', 'Brace, push the floor away', 'Lock out with the glutes, not the lower back'],
    ['deadlift', 'barbell deadlift', 'conventional deadlift']),
  // shoulders
  ex('lateral-raise', 'Lateral Raise (Dumbbell)', 'Dumbbell', 'Shoulders', [], 'weight_reps', 60,
    ['Lead with the elbows', 'Raise to shoulder height, no higher', 'Slow down, no swinging'],
    ['lateral raise', 'side raise', 'side lateral raise', 'dumbbell lateral raise', 'lateral raises']),
  ex('arnold-press', 'Arnold Press (Dumbbell)', 'Dumbbell', 'Shoulders', ['Triceps'], 'weight_reps', 90,
    ['Start palms facing you at the chin', 'Rotate out as you press up', 'Reverse the turn on the way down'],
    ['arnold press', 'arnold dumbbell press']),
  // arms
  ex('dumbbell-curl', 'Bicep Curl (Dumbbell)', 'Dumbbell', 'Biceps', ['Forearms'], 'weight_reps', 60,
    ['Elbows pinned to your sides', 'Curl up, turn the pinkies in at the top', 'Lower all the way, slowly'],
    ['bicep curl', 'biceps curl', 'dumbbell curl', 'dumbbell bicep curl', 'db curl', 'curls']),
  ex('hammer-curl', 'Hammer Curl (Dumbbell)', 'Dumbbell', 'Biceps', ['Forearms'], 'weight_reps', 60,
    ['Thumbs up, palms facing each other', 'Elbows still, curl to the shoulder', 'Control the lower'],
    ['hammer curl', 'dumbbell hammer curl', 'hammer curls']),
  ex('bicep-curl-21s', '21s Bicep Curl', 'Barbell', 'Biceps', ['Forearms'], 'weight_reps', 90,
    ['7 reps bottom half, 7 top half, 7 full', 'Elbows stay at your sides', 'Lighter than your normal curl'],
    ['21s', '21s curl', 'twenty ones', 'barbell 21s']),
  ex('triceps-pushdown', 'Triceps Pushdown', 'Cable', 'Triceps', [], 'weight_reps', 60,
    ['Elbows pinned to your sides', 'Push down to full lockout', 'Only the forearms move'],
    ['tricep pushdown', 'triceps pushdown', 'cable pushdown', 'pushdown', 'bar pushdown']),
  ex('triceps-rope-pushdown', 'Triceps Rope Pushdown', 'Cable', 'Triceps', [], 'weight_reps', 60,
    ['Elbows tight to the ribs', 'Split the rope apart at the bottom', 'Control the rope back up'],
    ['rope pushdown', 'tricep rope pushdown', 'rope tricep pushdown']),
  // legs
  ex('leg-press', 'Leg Press (Machine)', 'Machine', 'Quads', ['Glutes', 'Hamstrings'], 'weight_reps', 120,
    ['Feet shoulder-width, mid-platform', 'Lower until the knees reach ~90°', 'Don’t lock the knees hard at the top'],
    ['leg press', 'machine leg press', '45 degree leg press']),
  ex('leg-extension', 'Leg Extension (Machine)', 'Machine', 'Quads', [], 'weight_reps', 60,
    ['Knee lined up with the machine’s pivot', 'Extend fully, squeeze the quads', 'Slow on the way down'],
    ['leg extension', 'leg extensions', 'quad extension']),
  ex('lying-leg-curl', 'Lying Leg Curl (Machine)', 'Machine', 'Hamstrings', ['Calves'], 'weight_reps', 60,
    ['Hips pressed into the pad', 'Curl the heels to the glutes', 'Lower under control'],
    ['lying leg curl', 'leg curl', 'prone leg curl', 'leg curls']),
  ex('seated-leg-curl', 'Seated Leg Curl (Machine)', 'Machine', 'Hamstrings', [], 'weight_reps', 60,
    ['Thigh pad snug above the knees', 'Curl the heels down and back', 'Slow return to a stretch'],
    ['seated leg curl', 'seated hamstring curl']),
  ex('box-squat', 'Box Squat (Barbell)', 'Barbell', 'Quads', ['Glutes', 'Hamstrings'], 'weight_reps', 150,
    ['Sit back to the box, shins vertical', 'Pause briefly, stay braced', 'Drive up without rocking'],
    ['box squat', 'barbell box squat']),
  ex('barbell-bulgarian-split-squat', 'Bulgarian Split Squat (Barbell)', 'Barbell', 'Quads', ['Glutes', 'Adductors'], 'weight_reps', 120,
    ['Bar on the upper back, rear foot on the bench', 'Drop straight down, torso tall', 'Drive through the front heel'],
    ['barbell bulgarian split squat', 'barbell split squat']),
  ex('box-jump', 'Box Jump', 'Other', 'Quads', ['Glutes', 'Calves'], 'bodyweight', 90,
    ['Swing the arms, jump up — not out', 'Land soft and quiet, knees out', 'Step down, don’t jump down'],
    ['box jump', 'box jumps', 'plyo box jump']),
  ex('calf-press', 'Calf Press (Machine)', 'Machine', 'Calves', [], 'weight_reps', 60,
    ['Balls of the feet on the platform edge', 'Full stretch at the bottom', 'Press up high and pause'],
    ['calf press', 'leg press calf raise', 'leg press calf press']),
  ex('calf-extension-machine', 'Calf Extension (Machine)', 'Machine', 'Calves', [], 'weight_reps', 60,
    ['Knees straight but not locked', 'Point the toes through the full range', 'Slow on the way back'],
    ['calf extension', 'seated calf extension']),
  // glutes and core
  ex('bird-dog', 'Bird Dog', 'Bodyweight', 'Glutes', ['Abs', 'Back'], 'bodyweight', 45,
    ['Hands under shoulders, knees under hips', 'Reach opposite arm and leg long', 'Hips stay level — no twisting'],
    ['bird dog', 'bird dogs', 'quadruped arm leg raise']),
  ex('ab-wheel', 'Ab Wheel', 'Other', 'Abs', ['Shoulders', 'Back'], 'bodyweight', 60,
    ['Tuck the pelvis, ribs down', 'Roll out only as far as you can hold a flat back', 'Pull back with the abs, not the hips'],
    ['ab wheel', 'ab rollout', 'ab roller', 'wheel rollout']),
  ex('ab-scissors', 'Ab Scissors', 'Bodyweight', 'Abs', [], 'bodyweight', 45,
    ['Lower back pressed into the floor', 'Legs long, cross and switch', 'Small, controlled kicks'],
    ['ab scissors', 'scissor kicks', 'scissors']),
  ex('bicycle-crunch', 'Bicycle Crunch', 'Bodyweight', 'Abs', [], 'bodyweight', 45,
    ['Elbow to the opposite knee', 'Extend the other leg long', 'Rotate through the ribs, not the neck'],
    ['bicycle crunch', 'bicycle crunches', 'bicycles']),
  ex('bicycle-crunch-raised-legs', 'Bicycle Crunch Raised Legs', 'Bodyweight', 'Abs', [], 'bodyweight', 45,
    ['Legs stay up off the floor throughout', 'Elbow to the opposite knee', 'Slow and controlled beats fast'],
    ['raised leg bicycle crunch', 'bicycle crunch raised legs']),
  // full body and cardio
  ex('burpee', 'Burpee', 'Bodyweight', 'Full body', ['Chest', 'Quads'], 'bodyweight', 60,
    ['Hands down, jump the feet back', 'Chest to the floor, push up', 'Feet in, jump with the arms overhead'],
    ['burpee', 'burpees']),
  ex('air-bike', 'Air Bike', 'Machine', 'Cardio', ['Quads', 'Shoulders'], 'time', 60,
    ['Push and pull the handles', 'Drive through the whole pedal stroke', 'Harder work = more air resistance'],
    ['air bike', 'assault bike', 'echo bike', 'fan bike']),
  ex('aerobics', 'Aerobics', 'Other', 'Cardio', ['Quads', 'Calves'], 'time', 60,
    ['Step fully onto the platform', 'Keep a steady rhythm', 'Breathe — conversational pace'],
    ['step aerobics', 'aerobic step', 'step class']),
  ex('boxing', 'Boxing', 'Other', 'Cardio', ['Shoulders', 'Abs'], 'time', 60,
    ['Hands up, chin down', 'Punch from the hips, not the arm', 'Stay light on the feet'],
    ['boxing', 'bag work', 'heavy bag', 'punching bag']),
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

/** The library entry for an id, or null. */
export const exerciseById = (id) => BY_ID.get(id) || null;

/** Normalise free text for matching: lowercase, no punctuation, "db" → dumbbell. */
export function normName(s) {
  return String(s ?? '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // "búlgara" matches "bulgara"
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bdb\b/g, 'dumbbell')
    .replace(/\bbb\b/g, 'barbell')
    .replace(/\bkb\b/g, 'kettlebell')
    .replace(/\s+/g, ' ')
    .trim();
}

// every name and alias, normalised, longest first (so "bulgarian split squat"
// beats "split squat", and "romanian deadlift" beats "deadlift"); the Spanish
// names count too, so "sentadilla búlgara" finds the same exercise
const NAMES = EXERCISES
  .flatMap((e) => [e.nameEn, valueAt('es', `ex.${e.id}.name`), e.id.replace(/-/g, ' '), ...e.aliases]
    .filter(Boolean).map((n) => [normName(n), e.id]))
  .sort((a, b) => b[0].length - a[0].length);

/**
 * Map free text ("DB bench press", "Pull-ups", "Back squat 4x5") to a library
 * id, or null when nothing fits. An exact name or alias wins; otherwise the
 * longest name or alias that appears as whole words inside the text.
 */
export function matchExercise(freeText) {
  const q = normName(freeText);
  if (!q) return null;
  for (const [n, id] of NAMES) if (n === q) return id;
  const padded = ` ${q} `;
  for (const [n, id] of NAMES) if (n && padded.includes(` ${n} `)) return id;
  // plurals: "pull ups" vs "pull up", "calf raises" vs "calf raise"
  const singular = q.replace(/s\b/g, '');
  for (const [n, id] of NAMES) if (n.replace(/s\b/g, '') === singular) return id;
  return null;
}

/** A logged exercise's name in the active language: the library's name when
 *  it came from the library, otherwise what the athlete typed. */
export const exName = (x) => (x?.libId && exerciseById(x.libId)?.name) || x?.name || '';

/** Coaching cues for a library id, or null when it has none. */
export const cuesForId = (id) => exerciseById(id)?.cues || null;

// Library ids that have a picture in icons/Pixelart/EXERCISES (cut from the
// sheets by tools/slice-exercise-art.mjs). A test keeps this list and the files in step.
export const ART_IDS = new Set([
  'back-squat', 'bulgarian-split-squat', 'dumbbell-bench-press', 'seated-cable-row', 'shoulder-press', 'face-pull',
  'barbell-bench-press', 'incline-dumbbell-press', 'cable-fly-crossover', 'dumbbell-chest-fly', 'machine-chest-fly',
  'band-chest-fly', 'suspension-chest-fly', 'chest-dip', 'assisted-chest-dip', 'weighted-chest-dip',
  'bent-over-row', 'lat-pulldown', 'deadlift', 'lateral-raise', 'arnold-press',
  'dumbbell-curl', 'hammer-curl', 'bicep-curl-21s', 'triceps-pushdown', 'triceps-rope-pushdown',
  'leg-press', 'leg-extension', 'lying-leg-curl', 'seated-leg-curl', 'box-squat', 'barbell-bulgarian-split-squat',
  'box-jump', 'calf-press', 'calf-extension-machine',
  'bird-dog', 'ab-wheel', 'ab-scissors', 'bicycle-crunch', 'bicycle-crunch-raised-legs',
  'burpee', 'air-bike', 'aerobics', 'boxing',
  'romanian-deadlift', 'trap-bar-deadlift', 'step-up', 'standing-calf-raise', 'nordic-hamstring-curl',
  'copenhagen-plank', 'pull-up', 'pallof-press',
]);

/** The exercise's pixel art, or null when it has none (the app then draws a pose). */
export const exerciseArtSrc = (id) => (ART_IDS.has(id) ? `icons/Pixelart/EXERCISES/${id}.png` : null);
