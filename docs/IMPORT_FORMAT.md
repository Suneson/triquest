# TriQuest import format

What **Settings → ⬆ Import JSON** accepts. Hand this file to Claude (or any
model) and it can generate a plan the app will load correctly first time.

## The one rule that bites

The importer takes a **whole app snapshot**, not a plan document. If the
top-level `workouts` array is missing, `migrate()` silently falls back to
regenerating the stock 200+ session plan — so a wrong shape doesn't error, it
**looks like the import did nothing**. Everything outside the four keys below is
discarded.

```json
{
  "version": 2,
  "settings": { },
  "workouts": [ ],
  "unlockedBadges": []
}
```

| Key | Required | Notes |
|---|---|---|
| `version` | yes | Always `2`. |
| `settings` | yes | Merged over defaults, so partial is fine. |
| `workouts` | **yes** | The plan. Missing ⇒ silent reseed. |
| `unlockedBadges` | yes | `[]` unless restoring a backup. |

## A workout

```json
{
  "id": "plan-2026-09-08-0",
  "date": "2026-09-08",
  "type": "bike",
  "title": "Sweet spot re-introduction",
  "intensity": "threshold",
  "durationMin": 130,
  "metrics": { "distanceKm": 45 },
  "completed": false,
  "completedAt": null,
  "phase": "Re-entry",
  "weekNum": 1,
  "deload": false,
  "isRace": false,
  "seeded": false,
  "source": "custom",
  "segments": [],
  "exercises": [],
  "packing": [],
  "notes": "[Warm-up] 20min Z2 [Main] 3x 8min @ 240-255W / 5min Z1 recovery [Cool-down] 15min Z1",
  "actual": null,
  "strava_activity_id": null,
  "hr_zone": 3,
  "updated_at": "2026-09-01T00:00:00.000Z",
  "power": [{ "min": 20, "watts": 181 }, { "min": 8, "watts": 248 }]
}
```

### Fields

| Field | Type | Rules |
|---|---|---|
| `id` | string | **Unique across the file.** Never start it with `seed-`. |
| `date` | string | `YYYY-MM-DD`. This alone places it on the calendar. |
| `type` | enum | `run` `bike` `swim` `gym` `brick` `mobility` `other` — **nothing else**. Drives the icon, colour and XP factor. |
| `intensity` | enum | `easy` `steady` `moderate` `threshold` `quality` `vo2` `race` — **nothing else**. XP multiplier 1.0 → 1.6. |
| `durationMin` | number | Minutes. Main XP driver. |
| `metrics.distanceKm` | number \| `""` | Use `""` (not `null`/`0`) when a session has no distance, e.g. gym. |
| `completed` | boolean | Always `false` for a plan. Only verified Strava activities may set this. |
| `hr_zone` | 1–5 | Renders the neon Z1–Z5 badge. |
| `source` | string | `"custom"` for an imported plan. |
| `updated_at` | ISO string | Sync uses last-write-wins on this. |
| `segments` `exercises` `packing` | arrays | Must exist, `[]` is fine. |
| `phase` `weekNum` `deload` `isRace` | optional | Block label, week number, deload/taper tag, RACE tag. |

### `notes` — must be bracketed or it is invisible

The detail view **only** renders text inside `[Label] …` blocks. Loose prose is
dropped entirely.

```
[Warm-up] 20min Z2  [Main] 4x 8min @ 260-275W / 4min Z1  [Cool-down] 15min
```

Commas and semicolons inside a block split it into bullet pills — great for
movement lists, bad for prose. Write prose with `·` instead of commas.

### `power` — Zwift-style bars (bike only)

An ordered list of `{ "min": <minutes>, "watts": <absolute watts> }` covering
warm-up → main set → cool-down, with repeats **expanded into individual blocks**.
Watts must be absolute and scaled to the athlete's FTP, not `%FTP`. Max 40 blocks.

Note: when `power` is present on a bike session the app shows the chart *instead
of* the `notes` blocks, so don't put anything in `notes` that only exists there.

### `exercises` — gym only

```json
{ "name": "Squat", "sets": 3, "reps": "8", "done": false,
  "weight": "60% 1RM", "actualReps": "", "rpe": "", "notes": "", "imageUrl": "" }
```

The app draws its own illustration and form cues per movement. Don't also list
sets/reps in `notes` — it duplicates.

### `settings` worth setting

```json
{ "ftp": 275,
  "units": "metric",
  "weekStart": 1,
  "goals": { "sessions": 12, "km": 355, "hours": 18 },
  "events": [{ "title": "Half Ironman #4", "date": "2026-10-18" }] }
```

`ftp` scales every power chart; `events` drives the home race banner (next
future date wins); `goals` sets the weekly rings.

## Prompt to paste

> Generate a TriQuest import file. Output **only** JSON shaped as
> `{"version":2,"settings":{…},"workouts":[…],"unlockedBadges":[]}` — a missing
> top-level `workouts` array makes the app silently reseed its stock plan.
> Every workout needs a unique `id`, ISO `date`, `type` from
> run|bike|swim|gym|brick|mobility|other, `intensity` from
> easy|steady|moderate|threshold|quality|vo2|race, `durationMin`,
> `metrics.distanceKm` (number, or `""` for gym), `completed:false`,
> `source:"custom"`, `hr_zone` 1–5, ISO `updated_at`, and `segments`,
> `exercises`, `packing` as arrays. Put all session detail in `notes` as
> `[Label] text` blocks — unbracketed prose is not rendered. For bike sessions
> add `power` as `[{min,watts}]` in absolute watts scaled to FTP, repeats
> expanded. For gym sessions use `exercises` rather than notes.

## Converting an existing plan

`tools/convert-plan.mjs` turns a `triquest-plan/v2` coaching document (weeks →
days → sessions) into this format, and warns about dates that fall outside their
declared week:

```
node tools/convert-plan.mjs my-plan.json import-me.json
```
