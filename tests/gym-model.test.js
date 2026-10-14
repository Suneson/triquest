import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, MUSCLES, EQUIPMENT, EXERCISE_KINDS, ART_IDS, matchExercise, exerciseById, normName, cuesForId, exerciseArtSrc } from '../js/core/exercises.js';
import { readFileSync, readdirSync } from 'node:fs';
import { upgradeExercise, upgradeExercises, parsePrescription, isUpgraded, newSet, workSets, prescription, SET_KINDS } from '../js/core/sets.js';
import { expandPlan } from '../js/core/plan.js';
import { normalizeWorkout, migrate } from '../js/app/stores/local-store.js';
import { rowToWorkout } from '../js/app/stores/supabase-store.js';

// ---- library -----------------------------------------------------------------------

test('every library entry is complete and uses known values', () => {
  const ids = new Set();
  for (const e of EXERCISES) {
    assert.match(e.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, e.id);
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`); ids.add(e.id);
    assert.ok(e.name, e.id);
    assert.ok(EQUIPMENT.includes(e.equipment), `${e.id} equipment ${e.equipment}`);
    assert.ok(MUSCLES.includes(e.muscle), `${e.id} muscle ${e.muscle}`);
    for (const m of e.secondary) assert.ok(MUSCLES.includes(m), `${e.id} secondary ${m}`);
    assert.ok(EXERCISE_KINDS.includes(e.defaultKind), e.id);
    assert.ok(e.defaultRestSec >= 30 && e.defaultRestSec <= 300, e.id);
    assert.ok(e.cues.length >= 2, `${e.id} cues`);
  }
});

test('no two entries claim the same name or alias', () => {
  const seen = new Map();
  for (const e of EXERCISES) {
    for (const n of [e.name, ...e.aliases].map(normName)) {
      assert.ok(!seen.has(n) || seen.get(n) === e.id, `"${n}" is on ${seen.get(n)} and ${e.id}`);
      seen.set(n, e.id);
    }
  }
});

test('every exercise name in the seed plan resolves to the library', () => {
  const names = new Set(expandPlan().flatMap((w) => (w.exercises || []).map((x) => x.name)));
  assert.ok(names.size >= 14);
  for (const n of names) assert.ok(matchExercise(n), `"${n}" has no library match`);
});

test('matchExercise: the names from the brief, variants and junk', () => {
  const cases = {
    'Back squat': 'back-squat', 'DB bench press': 'dumbbell-bench-press', 'Seated row': 'seated-cable-row',
    'Pull-up': 'pull-up', 'Face pull': 'face-pull', 'Standing calf raise': 'standing-calf-raise',
    'Romanian deadlift': 'romanian-deadlift', 'Trap-bar deadlift': 'trap-bar-deadlift',
    'Bulgarian split squat': 'bulgarian-split-squat', 'Step-up': 'step-up',
    'Nordic hamstring curl': 'nordic-hamstring-curl', 'Copenhagen plank': 'copenhagen-plank', 'Pallof press': 'pallof-press',
    // variants
    'pull ups': 'pull-up', 'Pullups': 'pull-up', 'RDL': 'romanian-deadlift', 'Hex bar deadlift': 'trap-bar-deadlift',
    'Back squat 4x5': 'back-squat', 'dumbbell bench': 'dumbbell-bench-press', 'Calf raises': 'standing-calf-raise',
    'OHP': 'shoulder-press', 'Chin-up': 'pull-up',
  };
  for (const [text, id] of Object.entries(cases)) assert.equal(matchExercise(text), id, text);
  assert.equal(matchExercise(''), null);
  assert.equal(matchExercise(null), null);
  assert.equal(matchExercise('underwater basket weaving'), null);
});

test('every sheet name matches its own entry; the art list, the files and the sheet mapping agree', () => {
  const sheetNames = {
    'Bench Press (Barbell)': 'barbell-bench-press', 'Bench Press (Dumbbell)': 'dumbbell-bench-press',
    'Bent Over Row (Barbell)': 'bent-over-row', 'Bicep Curl (Dumbbell)': 'dumbbell-curl',
    'Cable Fly Crossovers': 'cable-fly-crossover', 'Deadlift (Barbell)': 'deadlift', 'Face Pull': 'face-pull',
    'Hammer Curl (Dumbbell)': 'hammer-curl', 'Incline Bench Press (Dumbbell)': 'incline-dumbbell-press',
    'Lat Pulldown (Cable)': 'lat-pulldown', 'Lateral Raise (Dumbbell)': 'lateral-raise',
    'Leg Extension (Machine)': 'leg-extension', 'Leg Press (Machine)': 'leg-press',
    'Lying Leg Curl (Machine)': 'lying-leg-curl', 'Seated Cable Row - V Grip (Cable)': 'seated-cable-row',
    'Seated Leg Curl (Machine)': 'seated-leg-curl', 'Shoulder Press (Dumbbell)': 'shoulder-press',
    'Squat (Barbell)': 'back-squat', 'Triceps Pushdown': 'triceps-pushdown', 'Triceps Rope Pushdown': 'triceps-rope-pushdown',
    '21s Bicep Curl': 'bicep-curl-21s', 'Ab Scissors': 'ab-scissors', 'Ab Wheel': 'ab-wheel', 'Aerobics': 'aerobics',
    'Air Bike': 'air-bike', 'Arnold Press (Dumbbell)': 'arnold-press', 'Bicycle Crunch': 'bicycle-crunch',
    'Bicycle Crunch Raised Legs': 'bicycle-crunch-raised-legs', 'Bird Dog': 'bird-dog', 'Box Jump': 'box-jump',
    'Box Squat (Barbell)': 'box-squat', 'Boxing': 'boxing', 'Bulgarian Split Squat (Barbell)': 'barbell-bulgarian-split-squat',
    'Bulgarian Split Squat (Dumbbell)': 'bulgarian-split-squat', 'Burpee': 'burpee',
    'Calf Extension (Machine)': 'calf-extension-machine', 'Calf Press (Machine)': 'calf-press', 'Chest Dip': 'chest-dip',
    'Chest Dip (Assisted)': 'assisted-chest-dip', 'Chest Dip (Weighted)': 'weighted-chest-dip',
    'Chest Fly (Band)': 'band-chest-fly', 'Chest Fly (Dumbbell)': 'dumbbell-chest-fly',
    'Chest Fly (Machine)': 'machine-chest-fly', 'Chest Fly (Suspension)': 'suspension-chest-fly',
    'Romanian Deadlift': 'romanian-deadlift', 'Trap-Bar Deadlift': 'trap-bar-deadlift', 'Step-Up': 'step-up',
    'Standing Calf Raise': 'standing-calf-raise', 'Nordic Curl': 'nordic-hamstring-curl',
    'Copenhagen Plank': 'copenhagen-plank', 'Pull-Up': 'pull-up', 'Pallof Press': 'pallof-press',
  };
  assert.equal(Object.keys(sheetNames).length, 52);
  for (const [name, id] of Object.entries(sheetNames)) assert.equal(matchExercise(name), id, name);
  for (const id of ART_IDS) assert.ok(exerciseById(id), `art for unknown id ${id}`);
  const files = readdirSync(new URL('../icons/Pixelart/EXERCISES/', import.meta.url)).map((f) => f.replace(/\.png$/, ''));
  assert.deepEqual([...files].sort(), [...ART_IDS].sort());
  const mapped = JSON.parse(readFileSync(new URL('../docs/gym/sheets.json', import.meta.url), 'utf8'))
    .flatMap((sh) => sh.ids).filter((id) => id !== '-');
  assert.deepEqual([...mapped].sort(), [...ART_IDS].sort());
  assert.equal(exerciseArtSrc('deadlift'), 'icons/Pixelart/EXERCISES/deadlift.png');
  assert.equal(exerciseArtSrc('nope'), null);
  assert.equal(EXERCISES.length, ART_IDS.size, 'every library entry has art');
});

test('common names land on the right variant', () => {
  const cases = {
    'Bench press': 'barbell-bench-press', 'Incline DB press': 'incline-dumbbell-press', 'Dips': 'chest-dip',
    'Pec deck': 'machine-chest-fly', 'Barbell row': 'bent-over-row', 'Assault bike': 'air-bike', 'Leg curl': 'lying-leg-curl',
    'Deadlift': 'deadlift', 'Romanian deadlift': 'romanian-deadlift', 'Bulgarian split squat': 'bulgarian-split-squat',
    'Box squat': 'box-squat', 'Rope pushdown': 'triceps-rope-pushdown', 'Leg press calf raise': 'calf-press',
  };
  for (const [text, id] of Object.entries(cases)) assert.equal(matchExercise(text), id, text);
});

test('the longest name wins: "split squat" inside "bulgarian split squat"', () => {
  assert.equal(matchExercise('bulgarian split squat'), 'bulgarian-split-squat');
  assert.equal(matchExercise('Romanian deadlift'), 'romanian-deadlift');
});

test('cues are folded into the library', () => {
  assert.ok(cuesForId('back-squat').length >= 2);
  assert.equal(cuesForId('nope'), null);
  assert.equal(exerciseById('nope'), null);
});

// ---- prescription parsing -------------------------------------------------------------

test('old free-text prescriptions', () => {
  assert.deepEqual(parsePrescription('8'), { reps: 8, seconds: null, note: '' });
  assert.deepEqual(parsePrescription('6–8'), { reps: 6, seconds: null, note: '6–8 reps' });
  assert.deepEqual(parsePrescription('8 / leg'), { reps: 8, seconds: null, note: 'per leg' });
  assert.deepEqual(parsePrescription('10 / side'), { reps: 10, seconds: null, note: 'per side' });
  assert.deepEqual(parsePrescription('20 s / side'), { reps: null, seconds: 20, note: 'per side' });
  assert.deepEqual(parsePrescription('45s'), { reps: null, seconds: 45, note: '' });
  assert.deepEqual(parsePrescription('1 min'), { reps: null, seconds: 60, note: '' });
  assert.deepEqual(parsePrescription(''), { reps: null, seconds: null, note: '' });
});

// ---- migration ---------------------------------------------------------------------------

test('an old exercise becomes one with its own sets; logged values land on the first', () => {
  const old = { name: 'Back squat', sets: 4, reps: '8', weight: '100', actualReps: '7', rpe: '8.5', done: false, notes: 'belt' };
  const e = upgradeExercise(old, 0);
  assert.ok(isUpgraded(e));
  assert.equal(e.libId, 'back-squat');
  assert.equal(e.muscle, 'Quads');
  assert.equal(e.equipment, 'Barbell');
  assert.equal(e.kind, 'weight_reps');
  assert.equal(e.restSec, 180);
  assert.equal(e.note, 'belt');
  assert.equal(e.sets.length, 4);
  assert.ok(e.sets.every((s) => s.kind === 'work' && SET_KINDS.includes(s.kind)));
  assert.deepEqual(e.sets[0], { kind: 'work', weight: 100, reps: 7, seconds: null, done: false, doneAt: null, rpe: 8.5 });
  assert.deepEqual(e.sets[1], newSet('work', { reps: 8 }));
  assert.equal(prescription(e), '4×8', 'one short logged set doesn’t rewrite the plan');
});

test('a timed old exercise becomes a time exercise', () => {
  const e = upgradeExercise({ name: 'Copenhagen plank', sets: 3, reps: '20 s / side' });
  assert.equal(e.kind, 'time');
  assert.equal(e.sets.length, 3);
  assert.ok(e.sets.every((s) => s.seconds === 20 && s.reps == null));
  assert.equal(e.note, 'per side');
  assert.equal(prescription(e), '3×20s');
});

test('a done old exercise marks every set done; an unknown name keeps working', () => {
  const e = upgradeExercise({ name: 'Zercher carry thing', sets: 2, reps: '10', done: true });
  assert.equal(e.libId, null);
  assert.equal(e.kind, 'weight_reps');
  assert.equal(e.restSec, 90);
  assert.ok(e.sets.every((s) => s.done));
});

test('bad old values are clamped, not trusted', () => {
  const e = upgradeExercise({ name: 'Pull-up', sets: 'lots', reps: 'max', weight: 'heavy' });
  assert.equal(e.sets.length, 1);
  assert.equal(e.sets[0].reps, null);
  assert.equal(e.sets[0].weight, null);
  assert.equal(upgradeExercise({ name: 'x', sets: 999 }).sets.length, 20);
});

test('the migration is idempotent and leaves new-shape data alone', () => {
  const once = upgradeExercises([{ name: 'Back squat', sets: 3, reps: '5' }, { name: 'Pull-up', sets: 3, reps: '6–8' }]);
  const twice = upgradeExercises(once);
  assert.equal(twice, once, 'same array back when nothing changed');
  assert.deepEqual(JSON.parse(JSON.stringify(twice)), JSON.parse(JSON.stringify(once)));
  const fresh = { id: 'a', libId: null, name: 'Mine', kind: 'time', restSec: 30, note: '', sets: [newSet('warmup')] };
  assert.equal(upgradeExercise(fresh), fresh);
  assert.deepEqual(upgradeExercises(null), []);
});

test('warm-ups are not work sets', () => {
  const e = { kind: 'weight_reps', sets: [newSet('warmup', { reps: 10 }), newSet('work', { reps: 5 }), newSet('drop', { reps: 8 })] };
  assert.equal(workSets(e).length, 2);
  assert.equal(prescription(e), '2×5');
});

// ---- runs on every read ----------------------------------------------------------------

test('the seed plan is born in the new shape', () => {
  const gym = expandPlan().filter((w) => w.type === 'gym');
  assert.ok(gym.length > 0);
  for (const w of gym) for (const e of w.exercises) assert.ok(isUpgraded(e) && e.id, w.title);
});

test('old local data and old Supabase rows open in the new shape', () => {
  const old = { id: 'w1', date: '2026-10-01', type: 'gym', exercises: [{ name: 'Seated row', sets: 3, reps: '10', weight: '50' }] };
  const local = normalizeWorkout(old);
  assert.ok(isUpgraded(local.exercises[0]));
  assert.equal(local.exercises[0].sets[0].weight, 50);
  const snap = migrate({ workouts: [old], settings: {} });
  assert.ok(isUpgraded(snap.workouts[0].exercises[0]));
  const row = rowToWorkout({ id: 'w1', date: '2026-10-01', type: 'gym', exercises: old.exercises });
  assert.equal(row.exercises[0].libId, 'seated-cable-row');
  assert.equal(normalizeWorkout(local).exercises, local.exercises, 'second read changes nothing');
});
