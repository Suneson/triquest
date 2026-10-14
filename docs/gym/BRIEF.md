# Gym trainer — brief and status

The working brief for the gym trainer, kept in the repo so each phase can pick
up where the last one stopped. Branch: `feature/gym-trainer` (cut from
`redesign/pixel-gamify`, brought level with `main`). Never push or merge to `main`.

## Where the source images live

These are on the owner's PC. A cloud session **cannot read a `D:\` path**, so
before the art step they have to be put in the repo (or attached in chat):

| What | Owner's path | Put them in the repo at |
| --- | --- | --- |
| 7 exercise sheets (3×3 cards, ~63 exercises) | `D:\00_CLAUDE\MOSKE APP NEW FILES\PIXEL GYM` | `docs/gym/sheets/` (PNG preferred over JPEG) |
| 4 Hevy screenshots (behaviour reference only — never copy the look) | `D:\00_CLAUDE\MOSKE APP NEW FILES\FEATURES REFERENCE` | `docs/gym/reference/` |

House style of the sheets: 3×3 grid of cards on cream, a figure with the
working muscles highlighted orange, exercise name and muscle group printed
underneath.

Once the sheets are in `docs/gym/sheets/`, list them in `docs/gym/sheets.json`:

```json
[{ "file": "docs/gym/sheets/sheet-1.png", "grid": "3x3", "ids": ["back-squat", "romanian-deadlift", "..."] }]
```

then `npm install && npm run slice-art` and check `docs/gym/art-check.png`.

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

## Phase 1 — model, library, art pipeline  ✅ (art waiting on the sheets)

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
**Status:** 14 entries (everything the built-in plan uses). The other ~49 come
from reading the printed names on the sheets.

1.3 **Slicer** `tools/slice-exercise-art.mjs` (sharp): cell crop → figure bbox on
cream (label band dropped) → pad to square → palette quantise → 256×256
nearest-neighbour → `icons/Pixelart/EXERCISES/<id>.png`, contact sheet
`docs/gym/art-check.png`. Documented in README. **Not yet run** — needs the sheets.

1.4 Art is **not** precached (not in `ASSETS`), lazy-loaded; every `<img>` has
width, height, `loading="lazy"`.

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
