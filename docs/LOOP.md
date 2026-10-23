# The long loop: base building, clubs, collections, seasons

Status: **Phases 1 and 2 built (2026-10-23), waiting for review at the first checkpoint.**
`0022_workshop.sql` is written and tested, not applied. Phases 3–10 come after the review.

Prompt 1 gave the app things to win. This gives it something to come back to:
there is always something being built, the base visibly becomes yours, and a
week away costs nothing you earned.

## 0. The lines that never move

Everything from Prompt 1 still holds:
- No real money.
- Ranks on base XP.
- Strava proof for performance.
- The server decides.
- The daily caps stay, rest is paid, and a broken streak has no penalty.

Two more:
- **Nothing expires that was earned.** A season closes the chance to earn, never the thing itself.
- **No randomised rewards.** Every drop is deterministic and its condition is shown before you work for it.

## 1. The workshop queue

Buying a gear tier or a scene prop pays for it at once and puts a **job** in the
workshop. The job is fitted in a **bay** and is yours from the moment it finishes.

| Rule | Value | Where |
| --- | --- | --- |
| Fitting time, gear tier 1 / 2 / 3 | 10 min / 1 h / 4 h | `WORKSHOP_RULES.fitMin` |
| Fitting time, props | 30 min – 3 h, per prop | `PROPS[].fitMin` |
| Bays | 1; a second with the *Four good weeks* feat (`cross-four-weeks`) | `bays`, `bay2Feat` |
| Remove a job that hasn't started | free, full refund | `cancelRefund()` |
| Cancel mid-fit | full refund the first time ever, then 50% | `cancelRefundBp` |
| Finish now | a gel (blue, red or gold) finishes the job being fitted | `skipKinds` |
| Kits and fuel | not fitted: owned at once, as before | |

**The clock is the server's.**
- `0022_workshop.sql` sets every start and finish time from `now()` on the server.
- `workshop()` returns the server's `now`, and the app keeps the offset, so countdowns follow the server however the phone is set.
- Changing the device's time changes nothing.

**Owning what's finished:**
- `workshop_settle()` writes a finished job into `user_gear`, with `acquired_at` set to the finish time, not the time anyone looked.
- `gear_bp_sport()` also counts a finished job that hasn't been settled yet. So a session's gear boost never depends on when the app was opened.

**Queueing:**
- A job goes to the bay that frees up first and starts then (or now).
- When a job leaves early (cancelled, or finished with a gel), the jobs waiting behind it move up, in order, keeping their lengths (`reflow()`).
- The next tier of a slot can be queued behind the tier below it.
- The tier below can't be cancelled while the next one waits on it.

**Refunds** lower the purchase's own `coin_spends` row, so the wallet needs no new kind of event.
**Gels** spent finishing a job count against what you hold (`fuel_held()`), so the same gel can't also be taken as a boost.

On screen:
- **Shop:** a workshop card sits at the top of the shop (Gear and Base tabs). It shows each bay with a live countdown and a stepped progress bar, *Finish with a gel*, *Cancel* (it asks first, and says what comes back), the waiting queue with *Remove*, and what finished today.
- **Profile:** the shop button carries a count of jobs finished since you last looked.
- **Finishing:** plays the existing stamp moment ("Fitted"), then a toast.

## 2. Scene props: the base becomes yours

Each sport has props you build into its diorama. They live in the scene manifest
(`PROPS` in `js/core/scenes.js`) as `{ id, sport, slot, cost, fitMin, points, anchor: { x, y, w }, z, glow, art }`.

| Sport | Props |
| --- | --- |
| Cycling | bike rack, workstand, team tent, floodlights |
| Running | water station, timing gate, spectator stand, track lights |
| Swimming | lane-rope reel, pace clock, poolside stand |
| Gym | chalk bowl, sound system |

**How props are drawn:**
- **Placement:** anchored by percentage of the art (or of the bike world). Each prop sits on a patch the level-1 art leaves free, at least 9% in from the sides, and never over the trophy board (tested).
- **Layering:** `z: 'back'` draws under the athlete layer, `'front'` over it. Both sit under the time-of-day tint, so a prop is lit like the scene.
- **Interaction:** props are never tappable, so the board, the scene buttons and the sport swipe work as before.
- **Floodlights:** they glow at dusk and night (`tod`), and only then.
- **Art:** each prop has a stand-in sprite drawn in code (`tools/draw-props.mjs`, in the app's palette with a 1px ink outline). The real art is briefed in `docs/gear/LOOP-ART.md`; drop it at the same path to replace it.

**Quadrant level** is separate from the sport level and comes from what you've built, not from XP:

- build points = each gear tier owned in the sport (1 each, up to 12) + each prop's `points` (2–4)
- level thresholds `QUADRANT_STEPS` = 0, 2, 5, 9, 14, 20, 27 (levels 1–7)

It shows as a plate on the scene ("VELODROME LV 3") between the inventory and
the shop. Tapping it opens the shop's new **Base** tab, which shows the level, a meter to
the next one, and that sport's props. A quiet training month never lowers it.

## 9. Health audit (kept up to date as phases land)

| Mechanic | What it rewards | Could it push training on a bad day? | Ceiling |
| --- | --- | --- | --- |
| Workshop timers | coming back to collect, spending coins | No: nothing about it needs a session. A gel used to finish a job is a gel not used as a training boost | — |
| Props | spending coins you already earned | No | Coins are still capped per day by training (`dailyCoinCap`) |
| Quadrant level | building, not XP | No: it never falls, so a rest week costs nothing | — |

## Status by phase

- **1 Workshop queue:** built, SQL written and tested (`0022_workshop.sql`), not applied.
- **2 Scene props:** built with stand-in art.
- **3–10:** not started (waiting for the checkpoint review).
