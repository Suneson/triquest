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
// Status: seeded with every exercise the built-in plan uses. The remaining
// entries from the seven exercise sheets are added once the sheets are in the
// repo (see docs/gym/BRIEF.md).

export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Traps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Abs', 'Full body', 'Cardio'];

export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Kettlebell', 'Machine', 'Cable', 'Band',
  'Trap bar', 'Bodyweight', 'Other'];

export const EXERCISE_KINDS = ['weight_reps', 'bodyweight', 'time', 'distance'];

const ex = (id, name, equipment, muscle, secondary, defaultKind, defaultRestSec, cues, aliases = []) =>
  ({ id, name, equipment, muscle, secondary, defaultKind, defaultRestSec, cues, aliases });

export const EXERCISES = [
  ex('back-squat', 'Back Squat', 'Barbell', 'Quads', ['Glutes', 'Hamstrings', 'Abs'], 'weight_reps', 180,
    ['Brace your core before you descend', 'Knees track over toes, sit between the hips', 'Drive the floor away — full depth'],
    ['barbell squat', 'barbell back squat', 'squat', 'high bar squat', 'low bar squat']),
  ex('romanian-deadlift', 'Romanian Deadlift', 'Barbell', 'Hamstrings', ['Glutes', 'Back'], 'weight_reps', 150,
    ['Hinge at the hips, soft knees', 'Bar stays close, shins vertical', 'Feel the hamstring stretch, flat back'],
    ['rdl', 'barbell rdl', 'stiff leg deadlift', 'stiff-legged deadlift']),
  ex('trap-bar-deadlift', 'Trap Bar Deadlift', 'Trap bar', 'Glutes', ['Quads', 'Hamstrings', 'Back'], 'weight_reps', 180,
    ['Chest up, push the floor away', 'Neutral spine, lats engaged', 'Stand tall, squeeze glutes at the top'],
    ['hex bar deadlift', 'trap-bar deadlift', 'hex-bar deadlift']),
  ex('bulgarian-split-squat', 'Bulgarian Split Squat', 'Dumbbell', 'Quads', ['Glutes', 'Adductors'], 'weight_reps', 90,
    ['Most weight through the front heel', 'Drop straight down, torso tall', 'Control the rear knee toward the floor'],
    ['rear foot elevated split squat', 'rfess', 'split squat']),
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
    ['db bench press', 'db bench', 'dumbbell bench', 'dumbbell press']),
  ex('seated-cable-row', 'Seated Cable Row', 'Cable', 'Back', ['Biceps'], 'weight_reps', 90,
    ['Tall chest, pull to the navel', 'Squeeze shoulder blades together', 'Don’t lean back — stay over the hips'],
    ['seated row', 'cable row', 'low row', 'seated rows']),
  ex('shoulder-press', 'Shoulder Press', 'Dumbbell', 'Shoulders', ['Triceps'], 'weight_reps', 120,
    ['Brace, don’t arch the lower back', 'Press to a locked-out finish', 'Bar/dumbbells over the mid-foot'],
    ['overhead press', 'ohp', 'military press', 'dumbbell shoulder press', 'db shoulder press']),
  ex('face-pull', 'Face Pull', 'Cable', 'Shoulders', ['Traps', 'Back'], 'weight_reps', 60,
    ['Pull to eye level, elbows high', 'Externally rotate at the end', 'Light weight, slow tempo'],
    ['face pulls', 'cable face pull', 'rope face pull']),
  ex('pallof-press', 'Pallof Press', 'Cable', 'Abs', [], 'weight_reps', 60,
    ['Square hips and shoulders to the front', 'Press straight out, resist the twist', 'Slow out, slow back'],
    ['pallof', 'anti-rotation press', 'band pallof press']),
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

/** The library entry for an id, or null. */
export const exerciseById = (id) => BY_ID.get(id) || null;

/** Normalise free text for matching: lowercase, no punctuation, "db" → dumbbell. */
export function normName(s) {
  return String(s ?? '').toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bdb\b/g, 'dumbbell')
    .replace(/\bbb\b/g, 'barbell')
    .replace(/\bkb\b/g, 'kettlebell')
    .replace(/\s+/g, ' ')
    .trim();
}

// every name and alias, normalised, longest first (so "bulgarian split squat"
// beats "split squat", and "romanian deadlift" beats "deadlift")
const NAMES = EXERCISES
  .flatMap((e) => [e.name, e.id.replace(/-/g, ' '), ...e.aliases].map((n) => [normName(n), e.id]))
  .sort((a, b) => b[0].length - a[0].length);

/**
 * Map free text ("DB bench press", "Pull-ups", "Back squat 4x5") to a library
 * id, or null when nothing fits. An exact name or alias wins; otherwise the
 * longest name or alias that appears as whole words inside the text.
 */
export function matchExercise(freeText) {
  const t = normName(freeText);
  if (!t) return null;
  for (const [n, id] of NAMES) if (n === t) return id;
  const padded = ` ${t} `;
  for (const [n, id] of NAMES) if (n && padded.includes(` ${n} `)) return id;
  // plurals: "pull ups" vs "pull up", "calf raises" vs "calf raise"
  const singular = t.replace(/s\b/g, '');
  for (const [n, id] of NAMES) if (n.replace(/s\b/g, '') === singular) return id;
  return null;
}

/** Coaching cues for a library id, or null when it has none. */
export const cuesForId = (id) => exerciseById(id)?.cues || null;

/** Where an exercise's pixel art lives (it may not exist yet). */
export const exerciseArtSrc = (id) => (id ? `icons/Pixelart/EXERCISES/${id}.png` : null);
