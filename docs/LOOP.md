# The long loop: base building, clubs, collections, seasons

Status: **Phases 1–6 built.** 1 and 2 shipped on 2026-10-27 (`0022_workshop.sql` live); 3 and 4 on 2026-10-27
(`0023_collections.sql`); 5 and 6 on 2026-10-28 (`0025_missions.sql`, `0026_clubs.sql`). Phases 7–10 come after the next checkpoint.

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

## 3. The home base

The Profile tab now lands on **your base** (`js/app/base-view.js`), not on one sport's scene.

**The island:**
- All four quadrants sit on one island, each as a live miniature of its scene at the level you reached, with the props and rare pieces you've built.
- Each quadrant shows its quadrant level, your sport level (with any prestige stars), the trophy board's count, and a countdown when something for that sport is in the workshop.
- Tapping a quadrant goes into its full scene. The scene is a route in `nav.js`, so the system back, Escape, the edge swipe and the new home button top-left all return to the base.
- Inside a scene, the sport buttons and the swipe work as before. Tapping the Profile tab always comes back to the base.

**What's next** sits under the island (`js/core/base.js`, pure and tested). It shows four plain facts and never asks for a session:

| Row | What it shows | Where it goes |
| --- | --- | --- |
| In the workshop | the job finishing soonest, with a live countdown (or "the workshop is free") | the shop |
| Coins | how many things you can build now, or the cheapest thing you can't yet and the coins it needs | the shop's Base tab |
| Closest feat | the unwon feat you're nearest to, with your best against the target | the trophy case |
| Blueprints | your target and the fragments left, or "choose one" | the blueprints in the shop |

## 4. Collections, blueprints and prestige

The rules are in `js/core/collections.js`. The server copy is `0023_collections.sql`, whose rules block is generated by `tools/collections-sql.mjs`, and `tests/collections-sql.test.js` runs both.

### 4.1 Collections

A sport's four slots at tier 1 or better complete its **bronze set**; tier 2 is **silver** and tier 3 is **gold**.

| Set | Bonus (once) |
| --- | --- |
| Bronze | 40 coins |
| Silver | 140 coins |
| Gold | 340 coins |

- **Where they show:** in the shop's Base tab, as three frames per sport from day one, with an empty cell per slot that fills with the piece's art.
- **When it pays:** the bonus is paid the moment the last piece is yours. A finished workshop job counts from its finish.
- **On the board:** a plaque goes up on the sport's trophy board.
- **How it's paid:** `wallet_fold()` derives it from what you own (rank 4 in the fold), so nothing is stored and it can't be paid twice. Gear is never taken away, so a set stays complete. The storage cap applies like any other earning.

### 4.2 Blueprints

- **Fragments:** every mission completed since 2026-10-22 is one fragment. They're counted from `quest_completions`, which the server already holds.
- **Rare pieces:** there are four, one per scene, each 24 fragments and worth 5 build points:

  | Sport | Piece |
  | --- | --- |
  | Cycling | gold podium |
  | Running | runner statue |
  | Swimming | gold starting block |
  | Gym | trophy cabinet |

- **Choosing:** you pick the one to work towards (saved in your settings) and see how many fragments are left. Fragments are one pool, so changing your mind loses nothing.
- **Building:** `build_blueprint()` spends the fragments and the piece is yours at once.
- **Never sold:** rare pieces are not in `gear_catalog`, so `buy_gear()` can't sell them.
- **Nothing random:** the same missions give the same fragments to everyone, and every price is shown before you start.

### 4.3 Prestige

At **level 10** in a discipline you may reset it to level 1. In exchange you get:
- a **star** on its board and on the level chip;
- **+1%** on every later session in that discipline, outside the 16% gear cap.

There are up to five stars per discipline.

**What it keeps.** Your Ranks (base XP), coins, gear, props, feats and scenery stay exactly as they are; the scene keeps the art of the highest level you reached. A reset is never treated as a level-up.

**How it's offered:**
- It appears only in the levels sheet you open yourself, and only once you're at the level or already hold a star.
- It asks before doing anything, says plainly what changes and what doesn't, and nothing anywhere else points to it.

**On the server:**
- `prestige()` checks the level against `boosted_sport_xp()` since the last reset, with `level_from_xp()` matching `levelFromTotalXp()`.
- It records the XP the star was taken at.
- `gear_bp_sport()` adds the stars taken by the session's end.

## 5. Missions and seasons

### 5.1 Weekly missions

The rules are in `js/core/missions.js`. The server copy is `0025_missions.sql`, whose rules block is generated by `tools/missions-sql.mjs`, and `tests/missions-sql.test.js` runs both.

- **The board:** each week (Monday to Sunday) has three missions: two training ones and one rest or recovery one. They rotate through a fixed pool in a fixed order (`weeklyMissions()`), so everyone sees the same board, and next week's board is shown now.
- **The pool:**

  | Kind | Missions |
  | --- | --- |
  | Training | three sessions, four hours, 40 km, two sports, one session of 90+ min, three days |
  | Rest and recovery | two full rest days, one full rest day, an easy 20–40 min session |

- **Pay:** every mission pays the same, 60 coins and 40 g of carbs, rest missions included.
- **What counts:** only verified work (`earnsXp`, the XP rule). A rest day counts only once it's over (by the server's UTC date).
- **How it's paid:** without a tap. When a mission is done, the app asks `claim_mission()`, which checks the same measure on the server and pays once. A claim is allowed in the mission's own week or the week after.
- **The wallet:** a paid mission is an earning in `wallet_fold()` (rank 5), from the moment it was paid. Balances stay derived.
- **Where it shows:** a mission board stands in every room of the diorama (a placeable, like the coffee machine) with this week's count on it. Picking it up shows an *Open the board* button, and tapping it again opens it. "What's next" has a row for it too.

### 5.2 Seasons

The rules are in `js/core/seasons.js`.

- **What a season is:** a calendar quarter (`2026-Q4`), named after the island's year:

  | Quarter | Season |
  | --- | --- |
  | Q1 | Almond Blossom |
  | Q2 | Trade Winds |
  | Q3 | Calima |
  | Q4 | Sea of Clouds |

- **Colours:** each season has its own colours, which paint the mission board, and its own emblem.
- **The season board:** shows this season's sessions, hours, km, missions and feats.
- **The kit:** finish 6 weekly missions inside a season to win its kit colourway. It recolours the cyclist, made with `tools/kit-recolor.py`. Season kits are never sold. Each theme's kit is won once, and the kit is derived from `mission_claims`, so nothing new is stored on the server.
- **The recap:** after a season closes, its recap card opens once, on the first visit (`recapsSeen` in settings). It says what the season held for you.
- **Nothing expires:** when a season closes you can't earn its kit any more, but nothing earned is taken away.

### 5.3 The daily stall

The rules are in `js/core/stall.js`.

- **What it sells:** one decor item a day for your rooms (plant, cooler, bench, foam rollers, punch bag, trophy shelf, towels, rug), for coins only.
- **No luck involved:** the stall turns over at midnight UTC and walks the list in order, so everyone sees the same stall and the next three days are shown.
- **Buying:** `buy_stall()` sells only the day's item, and it's yours at once. `buy_gear()` refuses decor.
- **Where it goes:** a bought item stands in its home room and moves like any other item.

## 6. Clubs

The rules are in `js/core/clubs.js`. The server copy is `0026_clubs.sql`, and `tests/clubs-sql.test.js` runs both.

- **Size and membership:** up to 12 members, one club at a time. A club has a name (unique in any case) and one of six crests.
- **Joining:** anyone can start a club. Members invite by username, and the invite lands in the bell. Clubs are listable by name, but joining is by invite only.
- **Weekly target:** one target, in hours for the whole club, filled by everyone's verified sessions together (`club_week_minutes()`). Any member can set it. The default is 3 h per member.
- **Relay:** the club carries its verified run, ride and swim kilometres round a route on a painted map of Gran Canaria:

  | Route | Distance |
  | --- | --- |
  | Over the summit | 120 km |
  | Round the island | 230 km |
  | The grand tour | 500 km |

  The line fills in as the club goes. When a route is finished, anyone can start the next one. There are no stakes and no deadline.
- **Club room:** a tab in Chat beside General and Direct. It is `room_messages` with a `club_id`, so it shares General's rate limit, removal, reports and blocking, and only members can read or post (RLS). `room.js` is now a factory (`createRoom(clubId)`).
- **Privacy:** `club_board()` returns names and totals only. No query returns a member's days or minutes, missed or not. Membership checks only answer about the caller (`is_club_member(club)`, `my_club_id()`), so nobody can probe who is in which club.
- **Leaving:** free, and nobody is told. If the founder leaves, the longest-standing member takes over.

## 9. Health audit (kept up to date as phases land)

| Mechanic | What it rewards | Could it push training on a bad day? | Ceiling |
| --- | --- | --- | --- |
| Workshop timers | coming back to collect, spending coins | No: nothing about it needs a session. A gel used to finish a job is a gel not used as a training boost | — |
| Props | spending coins you already earned | No | Coins are still capped per day by training (`dailyCoinCap`) |
| Quadrant level | building, not XP | No: it never falls, so a rest week costs nothing | — |
| Home base "what next" | knowing where things stand | No: it shows what's building, what's affordable, the nearest feat and your blueprint; none of them is a dated ask to train | — |
| Collections | finishing a sport's kit | No: a one-off bonus from coins already earned by training | Coins stay capped per day (`dailyCoinCap`); each set pays once |
| Blueprints | completing missions | Only as much as missions already do; rest-day missions count the same | Missions are capped at 3 a day (`QUESTS_PER_DAY`); fragments add no new daily target |
| Prestige | long-term commitment to a discipline | Low: it's opt-in, never suggested, and resetting gives no reason to train harder on a given day | 5 stars, +1% each, outside the gear cap |
| Weekly missions | a balanced week | Low: a third of every board is rest or recovery and pays exactly the same; there is a whole week to do them and no penalty for missing one | 3 a week, a fixed reward each |
| Seasons | showing up across three months | Low: the kit needs 6 missions in ~13 weeks, and rest missions count toward it | One kit per theme; nothing is taken away at close |
| Daily stall | spending coins already earned | No | Coins are still capped per day by training |
| Clubs | training alongside others | Low: the target is shared, nobody's days are visible, and missing a week shows nowhere | The target is the club's choice; the relay has no deadline |

## Status by phase

- **1 Workshop queue:** built and live (`0022_workshop.sql`).
- **2 Scene props:** built with stand-in art.
- **3 Home base:** built.
- **4 Collections, blueprints, prestige:** built, SQL written and tested (`0023_collections.sql`). The rare pieces use stand-in art drawn in code.
- **5 Missions and seasons:** built (`0025_missions.sql`). The art was generated with Gemini (`tools/gen-loop5.mjs`, `tools/cut-loop5.py`).
- **6 Clubs:** built (`0026_clubs.sql`), with crests and the relay map generated the same way.
- **7–10:** not started (waiting for the next checkpoint).
