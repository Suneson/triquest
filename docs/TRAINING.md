# Training update: design, maths and build order

In-gym drills, a slow stamina gauge, one mechanic and four classes, all feeding on real training rather than replacing it.

- **The rules:** `js/core/training.js`. Pure, not used by the app yet.
- **The tests:** `tests/training.test.js` holds every promise in this page to a number.
- **The tables below:** `node tools/training-table.mjs`.
- **What art it needs:** `docs/TRAINING-ASSETS.md`.

The game has no engine and no TypeScript, so the data models are ES modules with JSDoc types, like the rest of `js/core`. The server copies the numbers, as it does for the wallet and the workshop.

## What's already in the game

| Spec | In the game now | What changes |
| --- | --- | --- |
| Coins | `wallet.js`: from real XP, 120 a day at most; spent on gear, expansions and markets | Drills add a second source with its own cap. Wages and class fees are new sinks. |
| Carbs | `wallet.js`: from real XP, 300 a day at most | Crates and a cafe add to it. Fuelling up and class fees spend it. |
| Stamina | `stamina.js`: whole numbers, full in 100 minutes, kept on the device, spent on nothing | A float gauge on the server, full in 36 hours |
| Gear | `gear.js`: per-sport slots, tiers, a boost to session XP | Two more effects: less drain, more from crates |
| Mechanic | `workshop.js`: a fitting bay with a queue; a second bay comes with a feat | No queue, and it covers machines and floors too |
| Treadmill and runner | Tiers 1 to 4, a live 3D runner | Drills run on it |
| Ice bath, lockers, coffee machine | Placeable items that do nothing yet | Recovery, the class screen and carbs |

## The maths

**Stamina**

```
max = 100 + min(40, 0.5 x (account level - 1)) + levels cleared in any discipline
regen per hour = max / 36 / (1 - cut)        cut = 0, or 50-60% after a recovery station
```

- Empty to full takes 36 hours at any maximum, and 18 to 14.4 hours with a recovery station.
- The buff applies to whatever is left to recharge. It doesn't stack, and starting a drill ends it.
- Only `{ value, at, cutBp }` is stored; the current value is worked out from it.

**Duration**

```
minutes on the clock = max(3, 5 x (real minutes / 5) ^ 0.75)
```

A real 5 minutes stays 5 minutes. The century is 3 h 20 in real life and 1 h 20 on the clock. The Triathlete takes 10% off cardio drills.

**Burn and drain**

```
raw burn(L)  = B1 x (270 / B1) ^ ((L - 1) / 7)        B1 = 6, or 10 on the bike
burn         = raw burn x sport level x machine x gear x class x replay x set   + 5
drain rate   = burn / minutes on the clock
```

| Factor | Effect |
| --- | --- |
| Sport level, from real XP | -3% a level above 1, up to level 10 |
| Machine tier 1, 2, 3, 4 | 0%, -8%, -16%, -24% |
| Gear (Buff 1) | 1.5 x the sport's gear boost, so a full 16% is -24% |
| Class | See below |
| Replay of a cleared level | -10% |
| Full clothing set | -6%; two pieces -3% |

The flat 5 is what stops level 1 being the best pay per stamina. No buff touches it.

**Failure**

```
this attempt's burn = burn x (1 +/- 8%), or +/- 3% on a cleared level    rolled by the server at the start
chance shown        = (stamina - lowest burn) / (highest burn - lowest burn), held between 0 and 100%
stops at            = minutes x stamina / this attempt's burn
```

- If stamina is below this attempt's burn, the athlete stops exhausted when it runs out.
- All the stamina is spent. The player gets 10% of the base XP and no bonus.
- The outcome is fixed on the server when the drill starts. The clock only reveals it, so leaving the app or changing the phone's time changes nothing.

There are two kinds of gate:

1. **Hard:** levels go in order, and a level needs a minimum machine tier (1, 1, 1, 2, 2, 3, 3, 3).
2. **Soft:** the burn has to fit in the gauge.

**Pay**

```
share    = 25% + 2% on a replay + 2% fuelled + class bonus, never above 30%
drill XP = real session XP x share         the real session uses xpForWorkout's own formula
coins    = drill XP x 0.5, at most 36 a day from drills (30% of the real cap of 120)
```

Whatever is stacked, a drill pays between 25% and 30% of the same real session.

- **First clear:** a crate and +1 maximum stamina.
- **Replay:** carbs for certain (4 + 4 x level).
- **Buff 2 from gear:** real-world crates pay up to 16% more, up to 21% with a full set.

## The numbers

Burn is before any buff, and XP per stamina is for a newcomer.

**Run (treadmill)**

| Level | Target | On the clock | Burn | Real XP | Drill XP | XP per stamina |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 km | 5 min | 11 | 8 | 2 | 0.18 |
| 2 | 2 km | 9 min | 15 | 18 | 4 | 0.26 |
| 3 | 3 km | 13 min | 23 | 28 | 7 | 0.31 |
| 4 | 5 km | 18 min | 36 | 46 | 11 | 0.31 |
| 5 | 8 km | 26 min | 58 | 72 | 18 | 0.31 |
| 6 | 10 km | 30 min | 96 | 90 | 22 | 0.23 |
| 7 | 15 km | 41 min | 162 | 134 | 33 | 0.20 |
| 8 | 21.1 km | 51 min | 275 | 181 | 45 | 0.16 |

**Bike (road bike on rollers)**

| Level | Target | On the clock | Burn | Real XP | Drill XP | XP per stamina |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 5 km | 10 min | 15 | 23 | 6 | 0.40 |
| 2 | 10 km | 16 min | 21 | 46 | 11 | 0.52 |
| 3 | 15 km | 22 min | 31 | 67 | 17 | 0.55 |
| 4 | 25 km | 30 min | 46 | 108 | 27 | 0.59 |
| 5 | 40 km | 42 min | 71 | 169 | 42 | 0.59 |
| 6 | 60 km | 56 min | 110 | 250 | 63 | 0.57 |
| 7 | 80 km | 1 h 09 | 174 | 332 | 83 | 0.48 |
| 8 | 100 km | 1 h 20 | 275 | 407 | 102 | 0.37 |

**Swim (pool)**

| Level | Target | On the clock | Burn | Real XP | Drill XP | XP per stamina |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 100 m | 3 min | 11 | 4 | 1 | 0.09 |
| 2 | 200 m | 5 min | 15 | 8 | 2 | 0.13 |
| 3 | 400 m | 8 min | 23 | 15 | 4 | 0.18 |
| 4 | 750 m | 13 min | 36 | 27 | 7 | 0.20 |
| 5 | 1 km | 17 min | 58 | 38 | 9 | 0.16 |
| 6 | 1.5 km | 23 min | 96 | 58 | 14 | 0.15 |
| 7 | 1.9 km | 27 min | 162 | 73 | 18 | 0.11 |
| 8 | 3.8 km | 38 min | 275 | 117 | 29 | 0.11 |

**Strength (bench press), total weight moved**

| Level | Target | On the clock | Burn | Real XP | Drill XP | XP per stamina |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 500 kg | 5 min | 11 | 6 | 2 | 0.18 |
| 2 | 1,000 kg | 7 min | 15 | 10 | 3 | 0.20 |
| 3 | 1,800 kg | 11 min | 23 | 18 | 4 | 0.18 |
| 4 | 3,000 kg | 15 min | 36 | 28 | 7 | 0.20 |
| 5 | 5,000 kg | 22 min | 58 | 44 | 11 | 0.19 |
| 6 | 8,000 kg | 28 min | 96 | 63 | 16 | 0.17 |
| 7 | 12,000 kg | 36 min | 162 | 89 | 22 | 0.14 |
| 8 | 18,000 kg | 44 min | 275 | 114 | 28 | 0.10 |

**Level 8 against a gauge of 120** (account level 21, 10 levels cleared): burn, then the chance of finishing. A full build is sport level 8, a tier 3 machine and full gear.

| Build | Run | Bike | Swim | Strength |
| --- | --- | --- | --- | --- |
| Pacer, full build | 117 (68%) | 125 (26%) | 125 (26%) | 175 (0%) |
| Triathlete, full build | 128 (13%) | 128 (13%) | 128 (13%) | 148 (0%) |
| Functional, full build | 136 (0%) | 136 (0%) | 136 (0%) | 125 (26%) |
| Titan, full build | 182 (0%) | 182 (0%) | 182 (0%) | 107 (100%) |
| Triathlete, tier 4 machine | 116 (72%) | 116 (72%) | 116 (72%) | 134 (0%) |
| Pacer, no gear | 152 (0%) | 163 (0%) | 163 (0%) | 229 (0%) |
| Pacer, tier 1 machine | 138 (0%) | 148 (0%) | 148 (0%) | 208 (0%) |
| Pacer, sport level 3 | 138 (0%) | 148 (0%) | 148 (0%) | 208 (0%) |

Take away any one part and level 8 can't be finished, which is what the spec asks for.

**Past level 8:** the ladders already run past level 20 in the code, with distance and time up 12% a level and burn up 6%. `OPEN_LEVELS` keeps them shut. Opening them will also need bigger gauges or stronger buffs, because level 20 is more than any build can afford today.

## Classes

| Class | Run, bike, swim drain | Strength drain | Other | Body |
| --- | --- | --- | --- | --- |
| Pacer | -18% run, -12% bike and swim | +25% | | Lean |
| Triathlete | -10% | +5% | Cardio drills 10% shorter | Medium |
| Functional Athlete | -4% | -12% | +2% pay on strength | Strong |
| Titan | +30% | -25% | +5% pay on strength, so always the 30% top | Tank |

Tapping a locker opens the class screen. The first choice is free; after that a switch costs 400 coins and 150 carbs. The Functional Athlete's rowing and functional work arrives as a fifth discipline: one more row in `DISCIPLINES`, using the rowing machine already in the game.

## The mechanic

One mechanic, one job at a time across the whole base. With nobody free, a job is refused rather than queued.

- **Machines:** 300, 900 and 2,000 coins to reach tiers 2, 3 and 4, taking 1, 4 and 12 hours. Floors cost 250 coins and take 2 hours.
- **Wages:** 10% on top of the price, paid when the job starts. A wage per job can't run up while someone's away; a daily wage would punish a player for having a holiday.
- **More workers:** `WORKERS` is a table, so a new mechanic is a new row. The second comes with the feat that already unlocks the workshop's second bay.

## Decisions made while writing this

Each is a line or two to change.

1. **Drill XP counts towards sport level and account level, but not the leaderboards.** The boards stay proven real sessions only.
2. **Drills have their own coin cap of 36 a day.** That keeps the 30% rule true at the daily level as well as per session.
3. **Levels have a small random element, shown up front as a percentage.** The spec's "higher reliability" on replays needs something to be reliable against. Without it, nobody would ever fail by surprise.
4. **Nothing wears out yet.** The spec mentions repairs, but there's no durability in the game, and adding it means bills arriving while someone is away. `repair` is reserved as a job kind.
5. **The workshop's queue goes away** when phase 4 lands, and jobs already queued finish as they are.

## Known imbalance

The bike pays about twice the run per stamina, and three to four times swimming and strength. The cause is the real-world XP formula, whose distance bonus is big on a 100 km ride, and the 25-30% rule passes that straight through. The daily coin cap limits the damage to coins, and the XP only feeds that sport's own level. I'd leave it for the first version and watch what players do. If the bike needs reining in, raise its `burnL1` or lower its distance bonus.

## Rigging decisions

### 1. Modular gear: option B, texture layers on one body, plus sockets

**One body mesh per class, with the same skeleton and the same UV layout across all four. Tops, bottoms and shoes are regions of one texture.** Sets are one texture each, and mixing them is painting regions onto a canvas at load.

- **It's the only option that survives four body types.** With separate clothing meshes, every piece has to be fitted to every body: 3 pieces x 4 sets x 4 bodies is 48 meshes to fit and weight. With one UV layout, each set is one texture and works on all four bodies.
- **It suits the subject.** Singlets, tights and shoes barely change a silhouette at about 150 pixels tall.
- **It's one draw call and one material,** with no gaps at the waist or ankle.
- **Hard accessories go on sockets.** Caps, headphones and hydration packs are small rigid meshes parented to a bone, without weights.

**Tripo mesh-splitting: no.** It gives each fragment its own UV island and bad weights at the cuts, and the seams need hand repair, once per piece, every time. Tripo is still the source of the art: you generate a whole athlete wearing the set, and its texture gets baked across onto the shared body.

**Full-body suits (option C)** would be simplest, but you couldn't mix pieces, so no set bonuses.

**The risk:** I haven't tested the texture bake yet. It's the first job of phase 6, on one set, before you make the rest.

### 2. The bike: yes, it needs a 3D model when someone is riding. You already have it.

A rider on a flat picture can't work. The far leg has to pass behind the frame and the near one in front, and the pedals in the picture don't move, so nothing would line up.

I tested the fix using the app's own `runner.glb` and your Tripo `road-bike-t1.glb` (`tools/bike-rig/spike.html`, seen from the side and the game's angle):

- **The feet don't slide.** They're solved onto the pedals every frame. Over a full turn, the ball of the foot stayed 0.012 model units from the pedal, about 2 cm at this bike's scale, and that gap is the pedal's thickness I set on purpose.
- **There's no need for a Mixamo cycling clip.** I couldn't find one, and the only forum reply I found said Mixamo wouldn't add one. The clip gets generated from the bike's own measurements, which is also why it fits.
- **The static cranks came out of the Tripo mesh by code,** replaced by plain turning ones. You don't need to split the model.
- **The rider is big for the bike,** because the character is stylised with a big head and short arms. The hands stop about 0.06 units short of the tops of the bars, and a bike scaled to suit can close that.

How it goes together:

```
Canvas, one per item, camera and lights as the runner's
├─ bike, reduced to about 15,000 triangles
│   ├─ crank group        turns at the clip's cadence
│   │   └─ 2 pedal groups counter-turn, to stay level
│   └─ 2 wheels           spin with the crank
└─ rider on the same skeleton as every other clip
    └─ a baked loop of 1 s: hips on the saddle, feet on the pedals, hands on the bars
```

- **The solving happens once, offline.** The app only plays a baked clip, like *Running*, with the crank's angle matched to the clip's time.
- **A picture while idle, 3D while riding.** The idle picture is rendered from the same model and camera, so the swap barely shows. Tiers still need their own models.
- **Each class needs its own baked clip,** because the bodies differ. It's generated, not made by hand.

**Strength and swimming are simpler.** The bench is below the body, so the picture can stay as it is, with the athlete and a 3D bar on top, the hands locked to the bar the same way. In the pool, the athlete swims over the painted water, cut off at the water line. Neither needs a live model of the machine.

**Not measured yet:** how this runs on a real iPhone. The test ran on a desktop, with the full 142,774-triangle runner and the full bike. Phase 3 begins by reducing both and testing on your phone.

### 3. Format: GLB in the app, FBX only from Mixamo

**GLB with meshopt compression and WebP textures,** as the app already does. FBX would need a large extra loader and is slower to parse. It's fine as an input from Mixamo, and gets converted here.

- **Root motion: none.** Clips stay in place, and the machine or the code supplies any travel. Download Mixamo clips with *In Place* ticked where it's offered; any forward drift left in the hips gets stripped here.
- **Compression:** resample at 30 fps, then meshopt. *Running* is already 7.7 KB for 120 channels, so clips will never be the problem. The mesh is: `runner.glb` has 142,774 triangles, and the target is 15,000 to 25,000.
- **Bones:** one skeleton, the 44 `mixamorig` bones the runner has today, trimmed to about 30. The finger bones and three extras (`headfront`, `Bone_045`, `Bone_046`) can go or be merged. At this size nobody sees fingers.
- **Bone LODs: not needed.** Only one 3D athlete is on screen per room, so there's nothing to thin out. If base visits ever show several, the far ones become still pictures.
- **The WebGL limit stands:** iPhone Safari keeps only a few contexts alive, so one rider at a time per room stays the rule.

## Build order

Each phase can be merged and played on its own. Phases 1, 2, 4, 5 and 7 need no new art to be playable.

| Phase | What ships | Server | Art needed |
| --- | --- | --- | --- |
| **1. Energy** | The 36-hour float gauge; the HUD shows it; tapping the ice bath gives the recovery buff | `user_energy`, `use_recovery()` | None; sauna later |
| **2. Drills on the treadmill** | The run ladder, drain on the clock, failure, replays, first-clear crate, Buff 1 | `start_drill()`, `finish_drill()`, `drill_log`, added to `wallet_fold()` | Exhausted clip |
| **3. Bike, then strength and swim** | Reduced models, baked cycling, live bike; then the bench and the pool | Disciplines added | Bike tiers, bench, pool, clips |
| **4. The mechanic** | Machine and floor tiers as jobs, one at a time, wages | Extend `0022_workshop.sql`, `assign_job()` | Mechanic character |
| **5. Classes** | Locker screen, class effects, fees | `user_class`, `switch_class()` | Portraits at first; bodies in phase 6 |
| **6. Bodies and clothes** | Bake test on one set, four bodies, sets, wardrobe, bonuses, Buff 2 | `user_wear`, in the boost fold | Bodies, sets, icons |
| **7. Carbs** | Cafe production, crate carbs, fuelling up | `collect_cafe()`, `fuel_up()` | Smoothie bar |

**How each phase is built** is the way the wallet and markets were:

1. The rule goes in `js/core`, with tests.
2. A generator (`tools/*-sql.mjs`) writes the numbers into the migration, and a PGlite test fails if the two disagree.
3. The RPCs take the payment. The server sets the time and the roll, never the phone.
4. The view comes last.
5. `sw.js` gets its cache bumped, and new files go in `ASSETS`.

**Mini-game milestones** are a coin source in the spec, but no mini-game exists yet. They're left for when one does.
