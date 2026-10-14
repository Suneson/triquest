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

## Phase 2 — the logger

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

## Phase 3 — picker, editing, supersets, routines

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
