# Builders' jobs

Every upgrade on the base is a builder's job, as in a castle-builder game. Delivering a new item is never a job.

- **Rules:** `js/core/jobs.js`. `TARGETS` lists what can be upgraded, keyed by its item id on the base, with each level's coins and hours. The server mirrors them in `builder_rules()` (`supabase/migrations/0039_builder_jobs.sql`), and `tests/jobs-sql.test.js` checks the two match.
- **How a job works:**
  - The coins are paid when the job starts.
  - The builder works for the level's hours. The building keeps working at its old level meanwhile.
  - A builder does one job at a time, and a building takes one job at a time.
  - Blue is everyone's; red, green and gold must be hired first (0038).
- **Levels:** a building's level is 1 plus its finished jobs. It isn't stored anywhere else, so there's nothing to settle when a timer runs out.
- **UI:**
  - `js/app/upgrade-sheet.js` is the one upgrade sheet: next level, price, time, builder picker, and a progress bar while a job runs.
  - It opens from the Upgrade button in the base's item menu, the gel stand's upgrade row, and the coffee shop's top bar.
  - On the base, a building with a job shows the builder's face and the time left over it.
  - `builds-changed` tells every screen when a job starts or finishes.
- **Faces:** `icons/Builders/face-<who>.webp`, rendered from `models/chars/mechanic-<who>.glb`.

## Adding a building

1. Add its item id and its level prices to `TARGETS`.
2. Write a migration that replaces `builder_rules()` with the new JSON (`JOB_RULES`).
3. Draw its picture from `levels.<key>` in `placement.js`, and add that key to `artOpts.levels` in `diorama-view.js`.

## Still to come

- Builder powers (Rush, Power Push, Share the Load, Mentor) and speed-ups from workouts.
- Finishing a job early.
- The locker room as the Town Hall: its level caps everything else.
- Upgrades for the huts, the pool, the stadium and the club house.

## The locker room is the hall (0040)

The locker room is a builder's job like the others (levels 2–6), and its level caps every other
building's: `HALL_CAPS` in js/core/jobs.js (hall level → the others' top level: 1→2, 2→3, 3→4, 4→5,
5→6). The server refuses a level past the cap with `gear:hall_low`; the upgrade sheet says which
locker level is needed, and the locker's own sheet says what its next level opens up. Its Upgrade
button sits on the locker room's plate at the top of the base.
