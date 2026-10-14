# Gym trainer — brief and status

The working brief for the gym trainer, kept in the repo so each phase can pick
up where the last one stopped. Branch: `feature/gym-trainer` (cut from
`redesign/pixel-gamify`, brought level with `main`). Never push or merge to `main`.

## Where the source images live

These are on the owner's PC; a cloud session can't read a `D:\` path. Copies
are now in the repo:

| What | Owner's path | Put them in the repo at |
| --- | --- | --- |
| 8 exercise sheets (69 cards, 52 different exercises) | `D:\00_CLAUDE\MOSKE APP NEW FILES\PIXEL GYM` | `docs/gym/sheets/batch-1…8.jpg` ✅ |
| 4 Hevy screenshots (behaviour reference only — never copy the look) | `D:\00_CLAUDE\MOSKE APP NEW FILES\FEATURES REFERENCE` | `docs/gym/reference/IMG_9187…9190.PNG` ✅ |

House style of the sheets: 3×3 grid of cards on cream, a figure with the
working muscles highlighted orange, exercise name and muscle group printed
underneath.

Batches 1, 4 and 8 are 2×4 grids; the rest are 3×3. Batch 8 holds the eight plan exercises the first seven lacked. Batch 7 repeats batch 1
(plus Incline Bench Press) and batch 3 repeats batch 2 (plus Squat). Where an
exercise appears twice the grey-suit version is used (batches 3 and 7), to
match the other sheets; `docs/gym/sheets.json` maps every cell to a library id
("-" = skipped), so swapping a version is a one-line change and
`npm run slice-art` again. Check `docs/gym/art-check.png` afterwards.

## Standing constraints

- Vanilla ES modules and plain CSS, no build step, no new runtime dependencies
  (`sharp` is build-time only).
- `js/core` stays pure and tested; `npm test` green.
- Bump the service-worker `CACHE` on asset changes.
- Respect reduce-motion.
- DESIGN.md wins over any skill's defaults.
- Don't push or merge to `main`.
- Anti-cheat: `completed` only ever comes from a verified Strava activity.

Skills to use where they fit: redesign-existing-projects, design-taste-frontend
(variance 3, motion 6, density 5 for the logger), industrial-brutalist-ui
(tactical telemetry, our palette, the set grid), minimalist-ui (dense tables),
image-to-code (analysis/implementation only — no image generation),
imagegen-frontend-mobile (prompts only), dataviz, web-design-guidelines,
playwright-cli, full-output-enforcement.

## Phase 1 — model, library, art pipeline  ✅

1.1 **Sets model.** Exercise `{ id, libId, name, equipment, muscle, kind, restSec, note, sets: [...] }`,
set `{ kind: warmup|work|drop|failure, weight, reps, seconds, done, doneAt, rpe }`,
exercise kind `weight_reps|bodyweight|time|distance`. Pure, tested, idempotent
migration (`js/core/sets.js` → `upgradeExercises`) expands old `sets: 4, reps: '8'`
into four work sets, carries weight/actualReps/rpe onto the first, leaves new
shape alone. Runs on every read: local hydrate/import, Supabase rows, seed plan.
No SQL migration (`exercises` is jsonb).

1.2 **Library** `js/core/exercises.js`: `{ id, name, equipment, muscle, secondary, defaultKind, defaultRestSec, cues, aliases }`.
`matchExercise(freeText)` → id or null. Tested against every seed-plan name.
Cues from `poses.js` folded in; `poseSvgFor()` stays as the fallback picture.
**Status:** 52 entries, all with art. Muscle names follow the app's list: the
sheets' "Lats"/"Upper Back" → Back, "Quadriceps" → Quads, "Abdominals" → Abs,
"Obliques" → Abs.

1.3 **Slicer** `tools/slice-exercise-art.mjs` (sharp): cell crop → figure bbox on
cream (label band dropped) → pad to square → palette quantise → 256×256
nearest-neighbour → `icons/Pixelart/EXERCISES/<id>.png`, contact sheet
`docs/gym/art-check.png`. Documented in README. Run on all eight sheets: 52
images, ~13 KB each. Machine Chest Fly and Standing Calf Raise lose a few
pixels at the feet, where the printed name touches them.

1.4 Art is **not** precached (not in `ASSETS`), lazy-loaded; every `<img>` has
width, height, `loading="lazy"`. `exerciseArtSrc(libId)` only returns a path
for ids in `ART_IDS`, so nothing requests a missing file; a test keeps
`ART_IDS`, the PNGs and `sheets.json` in step.

## Phase 2 — the logger  ✅

Done: `js/core/gym-log.js` (pure, `tests/gym-log.test.js`) holds the rules;
`js/app/gym-logger.js` draws and wires them into the workout sheet. Session bar
sticks to the top (elapsed clock from the first ticked set, rest timer with
−15/+15/skip and a 10-segment bar, Finish). Each exercise: art, name, muscle ·
equipment, rest chip (native select of presets), note chip, "How to" cues
collapsed, set grid SET / LAST / KG / REPS / tick (bodyweight shows +KG, timed
exercises a TIME column with a play/stop count-up). The set label is a native
select over the W/1/D/F label: Warm-up / Work / Drop / Failure / Remove set.
LAST fills the row on tap and shows last time's numbers as placeholders;
ticking a blank set fills it from last time. Below ~300px of panel width
(a 320 phone) LAST folds into a "Last …" line under each set. Timers are end
timestamps in localStorage (`moske-rest`, `moske-stopwatch`); the ticker keeps
running while a rest does, beeps (`playRestDone`, only with sound on) and
vibrates; a rest that ran out while the app was shut is cleared quietly.
Finish writes `gymLoggedAt` + `gymDurationSec` (synced through `extra`), never
`completed`, and shows "Logged. Sync with Strava to earn XP." with time, sets
and volume (warm-ups excluded). Screens: `docs/gym/after/phase-2/`.

The brief for this phase:

- Session header: elapsed timer, Finish, rest timer.
- Per exercise: art, name, muscle, rest chip, note chip, cues collapsed.
- Set grid: SET / PREVIOUS / KG / REPS / ✓. Warm-up = gold "W", not counted in
  volume. Tapping PREVIOUS fills the row. Ticking a set starts the rest timer.
- Add / remove sets, change set kind. Time exercises get a TIME column with a count-up.
- Rest timer stores its end timestamp (survives reloads), skip / extend, sound
  when `settings.sound`, vibrate.
- 16px numeric inputs; no horizontal scroll at 320px — drop PREVIOUS into a subtitle there.
- Anti-cheat: Finish writes `extra.gymLoggedAt`, does **not** set `completed`.
  Finish screen: "Logged. Sync with Strava to earn XP." Raise, don't change.

## Phase 3 — picker, editing, supersets, routines  ✅

Done: `js/core/gym-edit.js` (pure, `tests/gym-edit.test.js`) holds search,
recents, grouping, custom exercises, reorder, supersets and routines.
- **Picker** (`js/app/gym-picker.js`, its own `#sheet-root` layer over the
  workout sheet): search by word prefix over names and aliases ("db ben"),
  equipment and muscle filters (secondary muscles count), Recent first, then
  grouped by muscle, art thumbs. Multi-select numbered in tap order, then
  Add N. **Create** saves a custom exercise (name, equipment, main muscle,
  logged as weight/bodyweight/time) to `settings.customExercises`; ids are
  `custom-<slug>`, duplicate names are refused.
- **Editing in the logger:** a ⋮ menu per exercise (Move up / Move down /
  Superset with next / Remove from superset / Replace / Remove — removing
  logged sets asks first) and a grip for pointer drag (`js/app/drag-sort.js`).
  Add exercises and Save as routine sit under the list. A gym session with no
  exercises shows the logger with an empty state.
- **Session editor** (`editor.js`): rows are now art + name + sets × reps with
  ↑ ↓ buttons, a drag grip and remove; "Add exercises" opens the picker. The
  free-text name and custom image URL fields are gone (old `imageUrl`s still
  show in the logger).
- **Supersets:** `supersetId` shared by neighbouring exercises; lettered
  ("Superset A"), purple rail; no rest between exercises of a superset, rest
  after the last. Moves and removals split or dissolve groups that stop being
  neighbours.
- **Routines** (`settings.routines`): Save as routine (numbers kept, ticks
  cleared, same name replaces); start from Settings → Routines or from the +
  button's new-session sheet ("Start a routine"), which creates a gym session
  on that date and opens it. Delete from Settings.
Screens: `docs/gym/after/phase-3/`.

The brief for this phase:

- Picker: search name/alias, filter equipment/muscle, recents, grouped by
  muscle, art-thumb rows, "Create exercise" (custom ones saved in settings).
- Editing: add / remove / reorder (up/down buttons first, pointer drag on top);
  replaces the rows in `editor.js`.
- Supersets.
- Routines in settings: save / start; reachable from a gym session and the plus button.

## Phase 4 — tracking

- Per-exercise history, best set, Epley e1RM (labelled as an estimate), volume.
- PR detection → confetti + a records shelf in the trophy cabinet.
- Charts: e1RM over time, weekly volume per muscle (pixel-stepped).
- Muscle balance over the last 4 weeks — descriptive, not prescriptive.

## Phase 5 — split builder in the AI questionnaire

- Only when gym is in play: `s.eco === 'gym'`, or hybrid with "Gym / Strength".
- Presets: Full body ×3, Upper/Lower, PPL, Arnold, Bro split ×5, PPL ×6.
- Chip editor: tap-then-tap, pointer drag, arrow buttons; add / remove / rename
  / rest days. Warnings, not blocks.
- `gym_split: { preset, days: [{ label, groups: [] }] }` in the wizard payload and settings.
- `ai-plan` edge function returns structured exercises in the new shape,
  honouring the split; library ids in the system prompt; free text mapped
  client-side with `matchExercise`; validate/clamp like `power`. Keep the
  non-gym contract. **Show the owner the system prompt and the new function before deploying.**

## Phase 6 — docs and verification

- `docs/gym/EXERCISES.md`; ART-BRIEF exercise-card spec + imagegen prompts;
  HANDOFF / DESIGN / PLAN updates.
- web-design-guidelines pass; playwright screenshots at 320/390/430 into
  `docs/gym/after/`, clips into `docs/gym/clips/`; full-output-enforcement on rewrites.
- After each phase report: changed / unsure / needs me.
