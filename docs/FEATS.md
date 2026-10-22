# Feats and trophies

Status: **Phase 1 live (2026-10-23).** 0018 applied as 0018_feats_a–f; strava-sync and strava-webhook v6 import best efforts and segments and run `award_feats` after every sync. The engine is `js/core/feats.js` (tests: `tests/feats.test.js`), the server copy `supabase/migrations/0018_feats.sql` (parity: `tests/feats-sql.test.js`). The first live attempt used temp tables, which the connector couldn't apply, so the engine was rewritten to hold the history in an array; a leftover `feat_tri_pick(date, text, numeric)` from that attempt is live, unused and revoked, and can be dropped any time.
goes into one constants block in `js/core/feats.js`, and the SQL copy
(`0018_feats.sql`) is generated from it, as `tools/gear-sql.mjs` does for GEAR.

Feats sit above `js/core/badges.js`. Badges stay as they are, for volume
milestones counted on the device. Feats are about **how fast, how far and how
hard**. They are checked by the server against stored Strava data, they drop a
trophy on the sport's board, and the big ones unlock a wearable item.

---

## 1. Rules every feat follows

| Rule | Detail |
| --- | --- |
| **Strava only** | The session has a Strava activity (`strava_activity_id`). App-logged sessions never unlock a performance feat, with one labelled exception: the gym strength feats (§5). |
| **No manual entries** | Strava lets you type an activity in by hand (`manual: true`). Those never count. Today `hasStravaProof()` accepts them for XP; see §7. |
| **No machines for speed or distance** | Treadmill runs (`VirtualRun`, `trainer`), indoor rides (`VirtualRide`, `trainer`) and e-bikes (`EBikeRide`) don't count for run, bike or cross feats. They still earn XP as before. |
| **Not on a planned rest day** | A session on a planned rest day (`js/core/rest.js`) never counts toward a feat. The server stamps this once, when the session first earns (`workouts.on_rest_day`, like `boost`), so editing the plan afterwards can't change it. |
| **From launch** | Only sessions dated on or after `FEATS_SINCE` (launch day) count. Otherwise long-time users unlock the whole board on day one, as with coins in GEAR. |
| **Sanity bounds** | Every feat carries bounds that reject impossible data (§3). A rejected session is skipped quietly: no award, no message. The reason is written to `feat_rejections` so it can be checked. |
| **Once, or once a season** | One-off feats are earned once ever. Repeatable feats (the monthly ones and a real race) can be earned once per season, and each earning adds a mark to the trophy (×2, ×3…). |

### What a session must carry (Phase 1 adds it)

Today `actual` keeps distance, moving minutes, elevation, HR, watts and the UTC
start. Phase 1 adds the following:

- `sportType`, `manual`, `trainer` and `maxSpeedKmh`.
- `workoutType`: Strava's race flag.
- `elapsedSec`: already stored.
- `bestEfforts`: for runs, `{ '5k': sec, '10k': sec, half: sec, '30k': sec, marathon: sec }`, from Strava's `best_efforts`.
- `topClimb`: the hardest climb category among the ride's segment efforts, plus that effort's elevation and time.

**Best efforts (§1.3 of the brief): not imported today.**
- The webhook already fetches the detailed activity, which carries `best_efforts`, `segment_efforts` and `laps`, but `actualsFromActivity()` throws them away.
- The poller (`strava-sync`) only reads the activity list, which never carries them.
- Phase 1 keeps them from the webhook, and makes the poller fetch the detail for each new activity from the last 30 days. That's one extra API call per new activity, well inside Strava's 1,000 calls a day for this user base.
- A run with no best efforts (an old import, or a detail fetch that failed) falls back to whole-activity pace. The trophy then says **"whole activity"** next to the time.

---

## 2. The feat table

Bounds are in §3. "Item" means a wearable or cosmetic reward (§4); every feat
also drops its trophy on the board.

### Run (`Run`, `TrailRun`; no treadmill)

| id | Tier | Condition | Repeats | Item |
| --- | --- | --- | --- | --- |
| `run-10k` | 1 | 10 km in one run | once | — |
| `run-5k-25` | 1 | 5 km in ≤ 25:00 (best effort, else whole activity) | once | — |
| `run-5k-22` | 2 | 5 km in ≤ 22:00 | once | — |
| `run-5k-20` | 3 | 5 km in ≤ 20:00 | once | **Sub-20 run kit** (limited) |
| `run-10k-50` | 2 | 10 km in ≤ 50:00 | once | — |
| `run-10k-45` | 3 | 10 km in ≤ 45:00 | once | — |
| `run-half` | 2 | ≥ 21.1 km in one run | once | MOSKE run cap |
| `run-30k` | 3 | ≥ 30 km in one run | once | — |
| `run-marathon` | 4 | ≥ 42.2 km in one run | once | **Finisher shirt** |
| `run-month-50` | 1 | 50 km of running in a calendar month | each season | — |
| `run-month-100` | 3 | 100 km of running in a calendar month | each season | — |

### Bike (`Ride`, `GravelRide`, `MountainBikeRide`; no trainer, no e-bike)

| id | Tier | Condition | Repeats | Item |
| --- | --- | --- | --- | --- |
| `bike-50` | 1 | 50 km ride | once | — |
| `bike-100` | 2 | 100 km ride | once | — |
| `bike-160` | 3 | 160 km ride | once | **Gran fondo cycling kit** (limited) |
| `bike-climb-2000` | 3 | ≥ 2,000 m climbing in one ride | once | — |
| `bike-40kph` | 3 | ≥ 20 km at ≥ 40 km/h moving average, **whole activity** | once | — |
| `bike-hc` | 4 | A Strava HC climb segment completed in one go | once | Climber's cap |
| `bike-month-200` | 1 | 200 km of riding in a calendar month | each season | — |
| `bike-month-500` | 3 | 500 km of riding in a calendar month | each season | — |

**"A 1,000 m climb unbroken" became `bike-hc`.** We can't see "unbroken"
without the ride's full GPS and altitude streams, which cost a request each and
are heavy to store. A Strava segment effort on a climb categorised **HC**
(roughly ≥ 1,000 m of climbing in one segment, like Teide from Vilaflor) is
the same idea, already verified by Strava. It means one climb done in one effort.

### Swim (`Swim`, pool or open water)

| id | Tier | Condition | Repeats | Item |
| --- | --- | --- | --- | --- |
| `swim-1k` | 1 | ≥ 1 km in one swim | once | — |
| `swim-1k-steady` | 2 | ≥ 1 km in one swim with elapsed time ≤ 110% of moving time | once | — |
| `swim-2k` | 2 | ≥ 2 km in one swim | once | **Limited trisuit** |
| `swim-1k-145` | 3 | ≥ 1 km at ≤ 1:45 /100 m moving pace, whole activity | once | — |
| `swim-month-10` | 2 | 10 km of swimming in a calendar month | each season | — |

**"1 km unbroken" became `swim-1k-steady`.**
- Strava doesn't say whether you stopped at the wall. Lap data is only there when the watch records lengths.
- "Elapsed within 10% of moving time" means barely any rest, which is checkable on every swim.
- If lengths are present we can tighten it later.

### Gym (see §5 before signing off)

| id | Tier | Condition | Repeats | Item |
| --- | --- | --- | --- | --- |
| `gym-25` | 1 | 25 sessions that earned XP | once | — |
| `gym-100` | 3 | 100 sessions that earned XP | once | — |
| `gym-bench-1` | 2 | Bench press ≥ 1.0 × bodyweight, a completed set of 1–5 reps, in a session with the gym check-in | once | — |
| `gym-squat-15` | 3 | Back squat ≥ 1.5 × bodyweight, 1–5 reps, with the check-in | once | — |
| `gym-dead-2` | 3 | Deadlift ≥ 2.0 × bodyweight, 1–5 reps, with the check-in | once | — |
| (all three) | — | The strength trio | — | **Lifting singlet** |

The session-count feats are consistency, not performance, so any session that
earned XP counts, including one logged in the app.

### Cross

| id | Tier | Condition | Repeats | Item |
| --- | --- | --- | --- | --- |
| `cross-four-weeks` | 3 | Four Monday–Sunday weeks in a row, each with run, bike, swim and gym (gym by any proof) | once | MOSKE training cap |
| `cross-olympic-day` | 3 | One local day with a swim ≥ 1.5 km, a ride ≥ 40 km and a run ≥ 10 km | once | Olympic frame badge |
| `cross-iron-day` | 5 | One local day with a swim ≥ 3.8 km, a ride ≥ 180 km and a run ≥ 42.2 km | once | **Iron kit** (the rarest) |
| `cross-race` | 2 | A real race: Strava's race flag (`workout_type` race) **and** the day matches a planned race session (`isRace`) or an event in your settings; a run ≥ 5 km or a ride ≥ 20 km | each season | Race-number frame badge |

**Full triathlon distance** is two feats, Olympic and Ironman. The Ironman day is
the rarest piece on the board. A **brick** counts for its parts only when
Strava has it as separate activities, which is how most watches record a race.

---

## 3. Sanity bounds

A bound **rejects** the session for that feat; it never changes XP. Each bound
is a little looser than the world record, so a real athlete is never refused
and a car, a motorbike or a GPS jump always is.

| Applies to | Reject when | Why |
| --- | --- | --- |
| Any run feat | Max speed > 30 km/h | Usain Bolt peaks at 44, but no distance runner touches 30. Above it, the watch was in a car |
| Run 5 km | Time < 13:45 (2:45 /km) | The world record is 12:35; this leaves room for a GPS-short course without letting a vehicle through |
| Run 10 km | Time < 27:30 | The world record is 26:11 |
| Half, 30 km, marathon | Moving pace < 2:50 /km, or > 10:00 /km | Faster than the world record; slower is a hike (fine to do, not a run feat) |
| Run month | Any single day counts at most 45 km; days over 45 km log a flag | Stops one ultra or a bad GPS day filling the month |
| Any bike feat | Max speed > 100 km/h | Fast descents hit 90; beyond is a car or a GPS jump |
| 50 / 100 / 160 km ride | Moving average > 45 km/h | Faster than any amateur solo over that distance; a motorbike passes this easily |
| 40 km/h over 20 km | Moving average > 52 km/h | The hour record is about 56 km/h on a track; 52 keeps the door open for a tailwind and a fast bunch |
| Climbing 2,000 m | More than 60 m of climbing per km, or a ride under 40 km | Barometer drift or a cable car, not a ride |
| HC climb | Climbing speed (VAM) > 2,000 m/h | Pros climb at about 1,800 |
| Bike month | Any single day counts at most 200 km | Same as the run month |
| Any swim feat | Moving pace < 1:05 /100 m over ≥ 400 m, or one swim > 15 km | The 1,500 m world record is about 0:58 /100 m; a 15 km "swim" is a boat or a mis-tagged ride |
| Swim month | Any single day counts at most 6 km | |
| Gym lifts | The lift is more than 2.5× (bench), 3.5× (squat) or 4× (deadlift) bodyweight; or the set's estimated 1RM is more than 15% above your best on that lift in the previous 8 weeks; or the lift has fewer than 3 earlier logged sessions | World-class ratios cap the first bound. The jump check stops someone typing 200 kg into a first session. The history check means you've logged the lift before |
| Gym bodyweight | Uses the **heaviest** weight you logged in the 30 days before the session; with no weight logged in 30 days, no strength feat | Logging a low weight the day before can't make a lift look heavier |
| Cross days | Each part passes its own sport's bounds; the three parts can't overlap in time | Two activities recorded at the same time are one activity uploaded twice |

Heart rate is **not** a bound: straps drop out, and a missing or low HR would
refuse honest runs. A sub-20 5 km with an average HR under 100 is flagged for
review, never rejected.

---

## 4. Rewards

**Feats never pay coins or carbs.** They pay in items, which can't be bought.

- **Gear catalog rows with `source: 'feat'`.** They are shown in the shop as a locked plate with the condition spelled out ("Run 5 km under 20:00, Strava only"), never with a price, and `buy_gear()` refuses them.
- **Kits reuse the palette-swap pipeline.** A limited kit is a set of catalog colour values plus a `tools/kit-recolor.py` run, never new animation. The cycling character already wears kits. Run, swim and gym have no animated characters yet, so their limited items show on the board, in the inventory and on the share card until those characters exist.
- **The trophy** drops onto the sport's board, lit, with the date and the session that won it.
- **The rarest pieces** go with the cross feats: the Iron kit, and the Olympic and race frame badges around your avatar.

### Seasons

- **Four seasons a year**, by calendar quarter. The id is the quarter (`2026-Q4`); the names come later, and are one line each in the locale files.
- **A feat's item comes in that season's colourway.** Earn the sub-20 kit in 2027-Q2 and you get that season's colourway, which never returns. You keep it forever; only the chance to earn that colourway closes.
- **Where it's recorded:** the season goes on `user_feats.season`.
- **Repeatable feats:** they can be earned once in each season, and each earning adds a mark to the trophy.
- **One-off feats** (a sub-20 5 km) are earned once ever; the season only decides the colourway.

---

## 5. Gym strength feats: logged, and checked in

Strava doesn't carry lifts, so the three strength feats are the one exception to
"Strava only". **Decided: option A, with the gym check-in made mandatory for
them.**

- **The session:** an app-logged session that passes every gym rule in `docs/XP.md`, and the bounds in §3 (bodyweight, the jump check and lift history).
- **The check-in is required.**
  - The session must carry the gym check-in pin (`gymCheckin: true`), so you must have saved your gym's location and been there when you finished.
  - Without the check-in turned on, the trophy case says "turn on the gym check-in to go for this one".
  - The check-in stays optional for XP. Making it mandatory for XP would change Ranks for everyone who lifts without it; that's a separate decision.
- **The label.** The trophy and the shop plate say **"logged"**, not "verified".
- **The reward:** only the lifting singlet.
- **Never in challenges.** Gym isn't a challenge sport at all (docs/CHALLENGES.md §1).

## 6. A month for a 5-hour athlete and a 12-hour athlete

These are computed with the real `xpForWorkout()` and `coinDays()`, for a
four-week block of Strava sessions:

| | 5 h a week | 12 h a week |
| --- | --- | --- |
| Week | Run 2 × 45 min (8 km), ride 2 × 60 min (25 km), gym 60 min | Swim 2 × 45 min (2.2 km), run 3 (10 km threshold, 9 km easy, 18 km long), ride 3 (30 km, 40 km, 85 km), gym 60 min |
| Month totals | 64 km run, 200 km ride, no swim | 148 km run, 620 km ride, 17.6 km swim |
| XP / coins | 1,844 XP · 920 coins | 4,780 XP · 2,148 coins (4 days hit the coin cap) |

### Feats in the first month

**5 h athlete: 2** (`run-month-50` and `bike-month-200`). Over the next
2–3 months they'll likely add these:

- `run-10k`, as the 8 km runs grow.
- `bike-50`.
- `run-5k-25`: at 5:37 /km threshold pace they're about 90 seconds off, and the board shows exactly that.
- `gym-25`, by about month six.

That's **about one new trophy every 3–4 weeks**: often enough to matter, not
routine.

**12 h athlete: 10** (`run-10k`, `run-month-50`, `run-month-100`, `bike-50`,
`bike-month-200`, `bike-month-500`, `swim-1k`, `swim-2k`, `swim-month-10` and
`cross-four-weeks`).

- **That's a backlog, not a rate.** Everything that's easy for them lands at once, because launch day starts everyone at zero.
- **After the burst** they're left with stretch goals: `bike-100` (their long ride is 85 km), `run-half` (18 km now), the 5 km and 10 km times, `bike-40kph` and `bike-hc`.
- **The repeatable monthly feats** come back once a season, not every month, so they don't become routine. That's about 12 earnings a year for this athlete.

**Verdict:**
- **Early on:** the 5 h athlete gets rewards often enough to matter.
- **After the first month:** the 12 h athlete is back to about one every 2–4 weeks, all of them real milestones.
- **What sends someone out again** is the near-miss line ("your best is 21:14").

If the first-month burst feels like too much, the fix is to make the monthly
tier-1 feats (`run-month-50`, `bike-month-200`) need a month that starts after
launch.

---

## 7. Things I found that need fixing on the way

1. **Manual Strava activities earn XP today.**
   - The problem: `hasStravaProof()` only checks that there is a Strava id, and a hand-typed Strava activity has one.
   - The fix: Phase 1 stores `manual`, and feats and challenges refuse it.
   - **Decided:** manual activities stop earning XP from the day 0018 goes live (`MANUAL_SINCE`), like the gym rule; earlier ones keep their XP.
2. **Two app accounts can link the same Strava athlete.** `strava_accounts.athlete_id` isn't unique. Challenges need it to be (one person, one account). Phase 1 adds a unique index, after checking the live table has no duplicates.

---

## 8. Server shape (Phase 1, shown before it runs)

- **`feats`:** the catalog, generated from `js/core/feats.js`.
- **`user_feats (user_id, feat_id, workout_id, season, value, achieved_at)`:**
  - `value` is the time, distance or climb that won it.
  - RLS: select your own; no insert, update or delete for anyone but the server.
  - The primary key is `(user_id, feat_id, season)`, which makes awarding idempotent.
- **`feat_rejections (user_id, feat_id, workout_id, reason, at)`:** select is admin only.
- **`award_feats(p_user)`:**
  - Security definer and idempotent.
  - It runs after `strava-sync` and from the webhook, and on demand from the trophy case's pull to refresh.
  - It reads only stored workouts.
- **`workouts.on_rest_day`:** stamped by the existing trigger when a session first earns.
- **Parity:** `js/core/feats.js` and the SQL run over the same fixture set in `tests/feats-sql.test.js`, as `tests/gear-sql.test.js` does for the economy.
