# GEAR: the training workshop (economy design)

Status: **Phases 1–4 built. 0014 applied live (as 0014_gear_a–d), and strava-sync and strava-webhook redeployed with the UTC start (v5).** Phase 0 was
signed off with the recommended answer to every question in §9: a free
starter plus three bought tiers, Recovery instead of run hydration, a +30%
gel for 4 h, a +16% cap, coins from launch with a 300 purse, and T3 at 850.
Every number lives in one constants block (`GEAR_RULES` in
`js/core/gear.js`). The SQL copy in `0014_gear.sql` is generated from it by
`tools/gear-sql.mjs`, so tuning is a one-line change plus one command.

The short version:

| Constant | Proposal | Your instinct | Why it changed |
| --- | --- | --- | --- |
| Coins per session | ½ of base session XP, rounded down | ≈ ½ of session XP | Same |
| Daily coin cap | 120 | "a daily cap" | Trims only a monster day (a 3 h ride) |
| Starter purse | 300 coins, once | — | Enough for one tier-1 item per main discipline on day one |
| Coins from history | Only sessions dated from launch day | — | Otherwise long-time users kit out on day one |
| Tier costs | 100 / 350 / 850 | — | First upgrade inside a week; a discipline in ~16 weeks |
| Gear boost per item (cumulative) | +1% / +2% / +4% | +2–5% per tier | Yours hits the cap after 1½ items, so the rest of the kit would be dead weight |
| Cap per discipline | **+16%** (= full kit) | +15% | Lets the last purchase still count; the cap stays as a hard guard |
| Gel | **+30% for 4 h** | +50% for 8 h | Yours makes gels worth more than all the gear combined (see §5) |
| Gels per week | 2 in any 7 days, one active at a time | 2 a week | Same; rolling window avoids timezone games |
| Gel price | 60 coins, hold at most 3 | — | Bought like gear, so they're also earned only |

---

## 1. Where coins come from

**Coins for a day = ½ of that day's base XP, rounded down, at most 120.**
(Per day rather than per session so the client and the SQL sum the same way
whatever order sessions arrive in. The session summary shows what each
session added to its day.)

- "Base XP" is the number `xpLedger()` already gives: the session passed
  `earnsXp`, the Strava ×1.1 is applied, and app-logged gym XP is already
  capped at 150/day. So coins come from exactly one place, and cheating the
  shop means cheating the XP rules.
- Coins are computed from **base XP, never boosted XP**. Otherwise gear would
  earn coins that buy more gear, and that loop compounds.
- The daily cap is per session date, the same date the gym cap uses.
- **Quest XP earns no coins.** Quests are a reward on top; keeping coins on
  sessions only makes "one source of truth" literal.
- **History:** only sessions dated on or after the launch day (`GEAR_SINCE`)
  earn coins. Everyone gets a one-off **starter purse of 300**. That's
  enough for a tier-1 item in each of three disciplines, or 3 gels, on day one.
  Without this rule, someone with eight months of rides opens the workshop
  with ~10,000 coins and kits out a whole discipline in one tap, which
  kills the progression. The purse is a constant added inside
  `coins_earned()`, not a row anyone can write.

### Worked weeks (computed with the real `xpForWorkout`)

**Light week (3 sessions), 240 XP → 120 coins**

| Session | XP | Coins |
| --- | --- | --- |
| Run 45 min easy, 8 km, Strava | 68 | 34 |
| Ride 60 min steady, 25 km, Strava | 114 | 57 |
| Gym 50 min moderate, logged in the app | 58 | 29 |
| **Week** | **240** | **120** |

**Typical week (6 sessions)**: about 650 XP, so **about 325 coins**.

**Heavy week (10 sessions), 1,249 XP → 583 coins**

| Session | XP | Coins |
| --- | --- | --- |
| Run 50 min easy, 10 km | 77 | 38 |
| Run 60 min threshold, 12 km | 114 | 57 |
| Long run 100 min steady, 18 km | 163 | 81 |
| Ride 60 min steady, 25 km | 114 | 57 |
| Ride 75 min threshold, 30 km | 157 | 78 |
| Long ride 3 h easy, 75 km | 322 | 161 → **120** (cap) |
| Swim 45 min moderate, 2.2 km | 72 | 36 |
| Swim 60 min steady, 3 km | 92 | 46 |
| Gym 60 min moderate (app) ×2 | 69 + 69 | 34 + 34 |
| **Week** | **1,249** | **583** (624 before the cap) |

The cap costs a heavy athlete 7% of their coins and a light one nothing.
That's the intent: it stops farming, not training.

---

## 2. The catalog, and what it costs

### Tiers

Each item has a **free starter (tier 0)** that everyone owns, plus **three
tiers to buy**. The brief's ladders start at "none" or "trainers", so read
literally they only have two upgrades. I added a third rung to each, marked
*new* below. (The alternative is two bought tiers per item. That's 8
purchases per discipline instead of 12 and a thinner progression.)

| Discipline | Slot | T0 (free) | T1 | T2 | T3 |
| --- | --- | --- | --- | --- | --- |
| Cycling | Wheels | Stock | Alloy training | Carbon | *Deep-section carbon* |
| Cycling | Aerobars | None | Clip-on | *Carbon clip-on* | Integrated cockpit |
| Cycling | Frame | Steel | Alloy | Carbon | *Carbon TT* |
| Cycling | Power | None | Single-sided | Dual-sided | *Dual + smart trainer* |
| Swim | Goggles | Basic | Anti-fog | *Mirrored* | Racing |
| Swim | Paddles | None | *Finger* | Small | Full |
| Swim | Buoy and fins | None | Buoy | Buoy and fins | *+ snorkel* |
| Swim | Wetsuit | None | Sleeveless | Full | *Race full* |
| Run | Shoes | Trainers | *Daily trainer* | Tempo | Carbon racer |
| Run | Watch | None | GPS | *GPS + HR strap* | Multisport |
| Run | Kit | Cotton | Technical | *Lightweight* | Race singlet |
| Run | Hydration → **Recovery?** | None | Handheld | Vest | *Race belt* |
| Gym | Belt | None | Nylon | Leather | *Lever* |
| Gym | Shoes | Trainers | Flat | Lifting | *Competition lifting* |
| Gym | Straps and sleeves | None | Straps | Straps and sleeves | *+ wrist wraps* |
| Gym | Bar | None | Chalk | Chalk and good bar | *+ calibrated plates* |

**Weak slots, as you asked:**
- **Run hydration** is the weakest. A vest is trail-running kit, and it's the
  one slot a road triathlete wouldn't feel. I'd swap it for **Recovery**:
  foam roller, then massage gun, then compression boots. Every runner
  recognises that ladder, and it draws well as pixel art. Your call; the
  economy doesn't change.
- **Gym "chalk and bar"** works better named **Bar**, with chalk as tier 1.
  "Chalk and good bar" as a slot name reads like two items.
- **Power meter** is a training tool, not speed. That's fine: it's the most
  coveted item in a triathlete's garage.
- **Wetsuit** is open-water only. Fine as flavour; flagging it in case you
  want pool-only swimmers to see something more relevant (a tech suit).

### Prices

All items cost the same at the same tier. Every item costs the same, so
choosing is about the item, not the price. (Option: make wheels and frame
cost 1.5×, the way they do in real life. Easy to add later.)

| Tier | Price | Weeks for light (120/wk) | Typical (325/wk) | Heavy (583/wk) |
| --- | --- | --- | --- | --- |
| T1 | 100 | 0.8 | 0.3 | 0.2 |
| T2 | 350 | 2.9 | 1.1 | 0.6 |
| T3 | 850 | 7.1 | 2.6 | 1.5 |
| One item, T1→T3 | 1,300 | 11 | 4 | 2.2 |
| **One discipline (4 items)** | **5,200** | **43** | **16** | **9** |
| Everything (4 disciplines) | 20,800 | 173 | 64 | 36 |

Against your targets:
- **First upgrade inside a week:** yes for everyone, on day one with the
  starter purse.
- **One discipline kitted out in ~4 months:** 16 weeks for a typical athlete,
  about 2 months for a heavy one, and 10 months for a light one. A light trainer
  still gets every tier-1 item in their main discipline within 3½ weeks, so
  something lands about once a fortnight. If you'd rather the light trainer
  finished in about 6 months, drop T3 to 600. A discipline then costs 4,200,
  which is 13 weeks typical and 7 heavy.
- **Not over in a fortnight:** even the heavy athlete needs about 9 months
  for the full workshop.

Gels at 60 coins each, two a week, cost 120 coins a week if used every week.
That's a third of a typical week's coins, so using every gel slows gear by
about a third. Gels compete with gear for the same coins, and that's the
point.

---

## 3. The boost table

| Tier owned | Boost from that item (cumulative) |
| --- | --- |
| T0 (starter) | 0% |
| T1 | +1% |
| T2 | +2% |
| T3 | +4% |

**Discipline boost = sum of its four items, capped at +16%.**

- A full kit is exactly the cap. Your +2–5% per tier would give one fully
  upgraded item about +10%, so the cap would be hit after one and a half items
  and the rest of the workshop would do nothing. With 1/2/4, every one of the
  48 purchases moves the number, and T3 feels like the premium step it should.
- **Brick sessions** get the average of the bike and run boosts. Mobility
  and "other" get no gear boost.
- Gear applies to XP **after** the gym daily cap. The cap limits base XP, and
  the boost multiplies what survived.
- **Gear owned when the session was completed** is what counts. Buying wheels
  today never touches last March.

---

## 4. Gels (the builder potion)

| Rule | Proposal |
| --- | --- |
| Effect | +30% XP for sessions inside the window, all disciplines |
| Window | 4 hours from the moment you use it (server time). It can't be scheduled ahead |
| Active | One at a time. Using one while one is running is refused |
| Limit | 2 used in any rolling 7 days (no calendar week, so no timezone edge) |
| Price | 60 coins; hold at most 3 |
| Stacking | Multiplies with gear: total = base × (1 + gear) × (1 + gel × overlap) |

**A session that straddles the window gets the gel in proportion.** The
multiplier is `1 + 0.30 × (minutes inside the window ÷ session minutes)`.

Example: a 2-hour ride that starts 3 hours into the gel has 60 minutes inside,
so it gets +15%. A ride entirely inside gets +30%. One that starts after the
window closes gets nothing.

A session's time span is:

| Session type | Span |
| --- | --- |
| Strava | Strava's UTC `start_date` plus `elapsed_time` |
| App-logged gym | First tick to last tick |
| No start time known | Back from the completion time by its duration |

Why prorated instead of "counts if it ends inside": an all-or-nothing rule
rewards starting a 4-hour ride at minute 239 of the gel, and punishes
the athlete whose long ride overran by five minutes. Proration is fair at both
edges and needs no special case.

**Why +30% for 4 h, not +50% for 8 h.** A gel matters as much as the share of
the week it covers. Eight hours covers a whole double day (swim in the
morning, long ride in the afternoon). A heavy athlete timing two gels on their
two biggest days covers about 47% of their week's XP, so +50% adds +23% a
week. That's more than the whole workshop (+16%), from two taps. It would
make gear feel pointless and gels compulsory. Four hours fits one long
session or a brick, covering about 35% of the week. At +30% that's +10%
a week: noticeable, worth planning around, and smaller than a full kit.

---

## 5. How much this inflates a discipline level over a year

The level curve is super-linear: going from level L to L+1 costs
`100 × L^1.6` XP, so level grows roughly with XP^0.38. A boost of +X% XP
moves the level much less than X%. The figures below are modelled over 50
weeks: gear bought at the pace in §2 (rising linearly from 0 to +16%), then
two gels a week on the biggest sessions.

| Athlete (one discipline) | Base level after a year | Gear only | Gear + gel (proposal: +30%/4 h) | Gear + gel (+50%/8 h) |
| --- | --- | --- | --- | --- |
| Light, 114 XP/wk | 7.3 | 7.6 (+9% XP) | 7.8 (+20%) | 8.1 (+33%) |
| Typical, 300 XP/wk | 10.4 | 10.9 (+13%) | 11.3 (+24%) | 11.7 (+37%) |
| Heavy, 593 XP/wk | 13.4 | 14.1 (+14%) | 14.5 (+25%) | 15.1 (+38%) |

Reading it:
- With the proposal, a fully engaged athlete is **about one level ahead** of
  their unboosted self after a year. Levels keep their meaning: a level-14
  cyclist is still someone who trained like a level-13 to 14 cyclist. With
  +50%/8 h it's about 1.5 to 1.7 levels, and the gel does most of that.
- The light athlete gains the most from gels in relative terms, because two
  gels cover two of their three sessions. I think that's acceptable, since
  showing up is what we want to reward. If you disagree, a gel could cover
  only the first session completed in its window.
- Ranks is untouched by every row of this table (§6).
- The scene art tops out at level 10. A boost can bring the next scene
  forward by a few weeks for a typical athlete. That's the visible payoff of
  gear, and it's small enough not to skip the art.

---

## 6. Ranks stays honest

- `public.leaderboard()` and `leaderboard_proof()` are **not changed**. Ranks
  is base, unboosted session XP plus quest XP, exactly as today.
- Boosts apply to your **own** discipline levels, your account level and your
  scene progression.
- Wherever XP is shown, both numbers are shown: **"+320 XP (240 base · 80
  gear)"**. Where your number sits beside another athlete's (Ranks, a public
  profile, the share card), it's base, labelled as base.
- The rule goes into `docs/XP.md` as a third section, "Gear doesn't count
  on Ranks".

---

## 7. Anti-abuse

Every boost is a multiplier on XP that already passed `earnsXp`. That bounds
the whole system: the most a cheat can get from the workshop is 1.16 × 1.3
of whatever they could already fake, and none of it reaches Ranks. The list:

| What a determined user could try | What stops it |
| --- | --- |
| Farm coins with fake sessions | Coins only come from sessions that earn XP, so they have to beat the XP rules first. On top of that: the coin cap of 120 a day, and app-logged gym XP already capped at 150 a day (75 coins) |
| Tell the server "my multiplier is 1.46" | The multiplier is never read from the client. A trigger on `workouts` stamps `boost` (gear %, gel %) on the row the first time it starts earning, from server tables and the server clock. The column isn't writable by the client: the trigger overwrites it and the update grant is revoked |
| Back-date a session into a gel window | The gel applies only if the session's span overlaps the window **and** the server first saw the row earning no later than 24 h after the window closed. You can't use a gel on Monday and file a Saturday ride into it a week later. The 24 h grace covers a slow Strava sync |
| Buy gear, then sync an old ride to get it boosted | Gear counts only if `acquired_at` is before the session's completion time. The first-seen stamp can't move earlier than server now() |
| Un-complete and re-complete a session to restamp it into a gel | The stamp is written once, on first earning, and kept. Toggling `completed` doesn't restamp |
| Edit a stamped session's duration up | Same as today: the base is governed by the XP rules, and Strava durations come from Strava. The boost is a stored multiplier, so it scales whatever the base honestly is |
| Spend coins, then delete the sessions that earned them | Balance can go **negative**. You keep the gear, you see the debt, and you can't buy until it's paid off by training. Taking gear back would be worse UX for an honest user who deleted a duplicate |
| Two taps on Buy at once, or two devices, to overspend | `buy_gear` takes a per-user transaction lock (`pg_advisory_xact_lock`), recomputes the balance inside the transaction, then writes the spend and the grant together |
| Skip tiers, or buy T3 directly | `buy_gear` requires the tier below. A unique `(user_id, item_id)` on `user_gear` prevents buying a tier twice |
| Stack gels | One active gel, enforced by a check inside `use_gel` under the same lock. The rolling 7-day count is checked there too |
| Change the device clock | All windows and stamps use the server's `now()`. The client clock only drives the countdown display |
| Timezone games on the daily coin cap | The cap is per session date, the same date the gym cap uses. Changing timezone doesn't create a new day's allowance for the same session |
| Coins on a second account | Coins and gear can't be transferred, so there's nothing to move |
| A manual Strava activity (typed in, not recorded) | **This hole already exists for XP today.** Any session with a Strava id counts. Gels add a small extra reason to use it. I'd suggest the Strava import records `manual: true`, and manual activities earn XP and coins without the 1.1 proof bonus or not at all. That's your call and it's outside GEAR; listed here so it isn't missed |

### Two pre-existing issues to fix in Phase 1

1. **Strava times are stored in local time with a "Z".** `js/core/strava.js`
   sets `completedAt` from `start_date_local`. Strava sends that as local
   wall time, but it carries a misleading `Z` suffix. It's fine for dates and
   wrong by your UTC offset as an instant. A gel window is an instant, so
   Phase 1 stores the real UTC `start_date` and `elapsed_time` alongside it.
   The calendar date logic keeps using local time.
2. **`completedAt` is set to the activity's *start*,** not its end. Phase 1
   keeps that field as it is, for compatibility, and adds `startedAt` and
   `endedAt` (UTC) for the boost maths.

---

## 8. What gets built, in one paragraph per phase

**Built so far:**
- `js/core/gear.js`: the catalog, kits, the gel and `GEAR_RULES`.
- `js/core/wallet.js`: `coinDays`, `coinsEarned`, `coinsForSession`,
  `balance` and `gelsHeld`.
- `js/core/boosts.js`:
  - `gearBoost`, `activeGel`, `canUseGel`, `sessionSpan` and `gelShare`
  - `boostStamp`, `applyBoost`, `boostFor`, `boostedLedger` and
    `boostedSportXp`
- `xp-rules.js` now exports `ledgerOrder`, so the coin and boost ledgers take
  sessions in exactly the order the gym cap does.
- Strava actuals now carry `startUtc` and `elapsedSec`, in the app and in the
  edge functions' shared mapping.
- `0014_gear.sql` and `tools/gear-sql.mjs`.
- Tests:
  - `tests/gear.test.js`
  - `tests/gear-sql.test.js`, which runs every migration in PGlite and
    checks that the ledger, every stamp, coins, boosted sport XP and the
    unchanged leaderboard match the JS over a fixture set; it also tests
    buying and gels end to end.
- CI now runs `npm ci` so PGlite is there.

- **Phase 1:** `js/core/gear.js` (catalog plus `GEAR_RULES`),
  `js/core/wallet.js` (coins from `xpLedger`, the cap, the purse and the
  balance) and `js/core/boosts.js` (`gearBoost`, `activeGel`, `boostFor` →
  `{ base, gear, gel, total }`, with the straddle proration). Plus tests,
  including a JS-vs-SQL fixture comparison run in PGlite, the same way 0013
  was checked.
- **Phase 2:** `0014_gear.sql`, as the brief specifies, with these
  additions:
  - the `boost` stamp column and its trigger on `workouts`
  - the per-user lock
  - the negative-balance rule
  - the 24 h gel grace
  - `boosted_sport_xp()` reading the stamps

  The catalog INSERTs are generated from `gear.js` by `tools/gear-sql.mjs`,
  and a test fails if the two drift. **This session has the Supabase
  connector**, so after your sign-off on the SQL I can apply it with
  `apply_migration`. As in 0013, statements containing `DROP`, `DELETE` or
  `REVOKE` stall the connector and are split into separate steps.
- **Phases 3 and 4 (built):**
  - `js/app/gear-state.js`: the server copy, cached for offline browsing; buy and gel calls; demo mode plays the rules locally.
  - `js/app/gear-view.js`: the GEAR layer.
  - `js/app/gel-chip.js`: the draining gel countdown on the Profile HUD, Home and the workshop.
  - `js/app/xp-split.js`: "+154 XP (114 base · 5 gear · 35 gel)" on session cards, the session detail and the gym finish view, which also shows coins.
  - The XP pop flies the boosted number with the base and coins under it.
  - Profile levels, the account level and the level-up moments use boosted XP.
  - The Ranks legend says gear doesn't count there.
  - Screens are in `docs/gear/after/`; clips of a purchase, a gel and a boosted session are in `docs/gear/clips/`.
- **Phase 5:** as briefed.
- **Phase 5b, kit colours by palette swap:** the ten per-level characters stay
  as they are.
  - Gear that changes the silhouette (frame, wheels, aerobars, wetsuit,
    carbon shoes) is already drawn by the level art. It is never layered
    onto the character; it goes on a kit card under the HUD instead.
  - Only clothing colour changes, as a build-time palette swap:
    1. `tools/quantise-char.mjs` reduces each sprite to an indexed palette.
    2. `tools/kit-ramp.mjs` dumps a labelled palette sheet, so the jersey,
       shorts and shoes indices can be tagged in `ramps.json`.
    3. `tools/kit-variants.mjs` writes `<base>--<kitId>.webp` for every kit
       in `KITS`.
  - The scene manifest picks the sprite by level and equipped kit.
  - The kit ramps live in `js/core/gear.js` (`KITS`), so a new kit is data
    plus one regeneration run.
- **Phase 6** (overlays on the animated character) is mostly overtaken by
  5b. Gear that changes the silhouette is never layered, so only a prototype
  would be left to decide.
- **Phase 7:** as briefed.

### What the audit of the character sprites found (Phase 5b, step 1)

Only cycling has animated characters today (run, gym and swim are stills, and
swim has only level 1). Bike, measured with sharp:

| Sprite | Canvas | Frames | Frame time | Opaque colours per frame | All frames | Semi-transparent px | Size |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bikelvl1_char | 768×624 | 8 | 83 ms (12 fps) | 26.4k–27.9k | 74k | 137k | 296 KB |
| bikelvl2_char | 768×624 | 16 | 83 ms | 22.2k–24.9k | 83k | 694k | 866 KB |
| bikelvl3_char | 768×624 | 8 | 83 ms | 24.4k–26.9k | 79k | 350k | 422 KB |
| bikelvl4_char | 768×624 | 8 | 83 ms | 25.5k–26.5k | 78k | 123k | 276 KB |
| bikelvl5_char | 768×624 | 9 | 83 ms | 25.9k–26.5k | 86k | 126k | 288 KB |
| bikelvl6_char | 768×624 | 7 | 83 ms | 26.0k–27.4k | 80k | 182k | 278 KB |
| bikelvl7_char | 768×624 | 10 | 83 ms | 25.9k–28.1k | 98k | 344k | 485 KB |
| bikelvl8_char | 768×624 | 7 | 83 ms | 23.3k–24.5k | 75k | 174k | 280 KB |
| bikelvl9_char | 768×624 | 9 | 83 ms | 60.5k–63.6k | 269k | 746k | 862 KB |
| bikelvl10_char | 768×624 | 8 | 83 ms | 73.1k–87.0k | 294k | 583k | 789 KB |

The 30k–106k you quoted fits the per-frame count for levels 1 to 8.
- **Levels 9 and 10 are about three times noisier.**
- **Every sprite has a large band of semi-transparent pixels.** That's lossy
  alpha from the video source. The quantise pass has to harden alpha
  (threshold to 0 or 255) before indexing. Otherwise the soft edge becomes
  dozens of near-duplicate palette entries, and a palette swap leaves a halo
  in the old colour.

---

## 9. Decisions I need from you

1. **Tiers:** a free starter plus three bought tiers, with the *new* rungs
   above (recommended)? Or a free starter plus two bought tiers?
2. **Run hydration:** keep it, or swap it for **Recovery** (foam roller,
   massage gun, compression boots)?
3. **Gel:** +30% for 4 h (recommended) or your +50% for 8 h?
4. **Cap:** +16%, equal to a full kit (recommended), or +15%? At +15%,
   tier 3 is +3.75% per item.
5. **History:** start coins at launch with a 300 starter purse (recommended)?
   Or count past training, at the risk of instant full kits?
6. **T3 price:** 850 (typical athlete kits a discipline in 16 weeks) or 600
   (13 weeks; a light athlete in about 6 months)?
7. **Manual Strava activities** (§7): leave as today, or stop them earning
   XP and coins? This one is separate from GEAR.

---

## 10. Carbs, fuel, storage and the scene buttons (added on review)

Asked for after Phase 4, and built ahead of Phase 5:

- **Two currencies**, both earned only by training and missions:
  - **Coins** buy gear upgrades and clothes.
  - **Carbs** (grams) buy fuel.
  - Each is held in a store of at most **10,000**. Anything earned while a store is full is lost, the way a full storage works in a base-building game.
  - Balances are still derived, never stored. `wallet_fold()` (0015) and `walletFold()` walk every earning and spend in time order. A day's training counts at the start of that day, a mission on its day, and a spend when it was made.
- **Earning from training:**
  - Carbs for a day = 0.8 g × that day's base XP, at most 300 g a day.
  - A typical week (~650 XP) gives ~520 g of carbs alongside ~325 coins.
  - Starting balance: 200 g of carbs, alongside the 300 coins.
- **Missions** pay coins or carbs on top of their XP (`QUEST_REWARDS`):

  | Mission | Reward |
  | --- | --- |
  | plan done | 25 coins |
  | two disciplines | 35 coins |
  | brick | 35 coins |
  | 45 min | 30 g carbs |
  | streak | 20 g carbs |
  | 10 km | 25 g carbs |
  | pack bag | 10 g carbs |
  | rest day | 15 g carbs |

- **Fuel** (bought with carbs). Only one fuel runs at a time, and each kind has its own limit in any 7 days. A session never gets more than the biggest fuel's worth (+30%).

  | Fuel | Price | Effect | Limit |
  | --- | --- | --- | --- |
  | Gel | 120 g | +30% for 4 h | 2 a week |
  | Energy bar | 80 g | +15% for 6 h | 2 a week |
  | Pasta meal | 150 g | +10% for 12 h | 1 a week |

  Worst case over a year this adds about a third of a level on top of §5, because the bar and the pasta are smaller and slower.
- **On the Profile scene:**
  - Two storage bars top right (coins, carbs; "Max 10,000").
  - An **inventory** button bottom left: your fuel with a Use button on each, the clothes you own and the gear you've fitted.
  - A **shop** button bottom right, a stall icon in the gold accent: Gear (coins, by discipline), Clothes (coins) and Fuel (carbs) tabs, each showing the currency it costs.
  - The GEAR button in the top bar is gone.
- **Art drawn for this pass** (`tools/draw-items.mjs`, contact sheet in `docs/gear/items-sheet.png`): the gel (with the MOSKE bird from `icons/logo.png`), the energy bar, the pasta meal, the coin, carbs, and the navy and sand jerseys.
- **Kit on the animated rider:**
  - `tools/kit-recolor.py` recolours the level-6 cyclist's blue kit (jersey, shorts, helmet) to the sand colourway, keeping every frame's shading.
  - It's wired through `KIT_SPRITES`/`kitSprite()`, so wearing the sand kit at level 6 shows it on the bike.
  - Limit: it recolours by hue. A slight tint reaches the bike frame, and the tagged-palette pipeline (5b) is the proper version.
- **Generated art** (`tools/gen-items.mjs`, Gemini image model, run with `GEMINI_API_KEY` in the environment):
  - What it made: the gel, energy bar, pasta, coin, carbs, both jerseys, and the shop and inventory button pictures.
  - Inputs: each item is asked for on flat green with an exercise card and the MOSKE logo as style references.
  - Processing: the green is keyed out with spill suppression, alpha hardened, the sprite fitted into 128×128 nearest-neighbour and quantised to 48 colours.
  - Where things live: the model's raw outputs are kept in `docs/gear/gen/`, and the contact sheet is `docs/gear/gen-sheet.png`.
  - The earlier hand-drawn set now writes to `docs/gear/drawn/` for comparison.

## 11. More fuel and clothes, the art, and launch (added on review)

**Gels by colour** (the rarer the colour, the dearer and the stronger):

| Gel | Price | Effect | Limit |
| --- | --- | --- | --- |
| Blue | 120 g | +30% for 4 h | 2 a week |
| Red, caffeine | 220 g | +40% for 4 h | 1 a week |
| Gold, race | 360 g | +50% for 3 h | 1 a week, hold 1 |

**Food:**

| Food | Price | Effect | Limit |
| --- | --- | --- | --- |
| Rice cake | 60 g | +10% for 6 h | 3 a week |
| Energy bar | 80 g | +15% for 6 h | 2 a week |
| Recovery shake | 200 g | +20% for 8 h | 1 a week |
| Pasta meal | 150 g | +10% for 12 h | 1 a week |

**Clothes:**

| Kit | Price |
| --- | --- |
| Crimson | 400 coins |
| Climber (white with blue dots) | 400 coins |
| Pro black-and-gold | 700 coins |

All five kits are recoloured onto the level-6 cyclist.

**What carbs limit, not the rules.** Still only one fuel at a time. A session gets at most the strongest fuel's worth (+50%).

- What actually limits fuel is carbs. A typical week earns about 520 g, which is a gold gel and a bar, or two blue gels and a rice cake.
- So a typical athlete can fuel 2 or 3 sessions a week.
- Realistic extra on top of §5: about +12% XP, or about half a level a year. A heavy trainer fuelling every session gets up to +25%.
- Ranks still counts base XP only.

**Art**:
- All 48 gear tiers, the new fuel and the new kits are generated with `tools/gen-items.mjs`, and the carbs icon is now a blue wheat ear.
- The Phase 5 pipeline is in place:
  - `tools/slice-gear-art.mjs` cuts your own 3×3 sheets.
  - `tools/gear-anim.py` makes animated items from green-screen GIFs or frames.
  - `docs/gear/ART-BRIEF.md` has the style, every file name and what's still missing.
- Item art is lazy-loaded and not precached by the service worker.

**Bars:** no "max" label (a full bar says it), and they fill from the icon end, right to left, packed closer together.

**Launch:** `GEAR_SINCE` is 22 October 2026. Sessions and missions from that day earn coins and carbs, and everyone starts with 300 coins and 200 g of carbs.

**Phase 6** (gear layered on the animated character) is not built. Kit colour is done by palette swap (5b), and silhouette gear is already drawn by the level art. That was the agreed fallback.
