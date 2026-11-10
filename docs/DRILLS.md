# Drills and recovery

Training and recovering inside your base. The app's "workouts" are your real training; a **drill** is the game's: your athlete does it on a machine in your base, in real time.

Code: `js/core/drills.js` (the rules, no DOM, tested in `tests/drills.test.js`), `js/app/drill-view.js` (the windows and the saved state), `js/app/diorama-view.js` (tapping the machine, the clock tag, the athlete's clip).

## The treadmill

Tap the treadmill, press **Train**:
- The window lists the run levels, what each costs in stamina, and whether you have enough.
- Pick an open level and press **Start**. The athlete runs on the treadmill until it ends; a clock on the machine shows the time left.
- The drill drains stamina steadily while it runs. The bar doesn't refill during a drill.

| Level | Run | Time | Stamina |
| --- | --- | --- | --- |
| 1 | 1 km | 6 min | 10 |
| 2 | 3 km | 18 min | 30 |
| 3 | 5 km | 30 min | 48 |
| 4 | 5 km, under 25 min | 25 min | 60 |
| 5 | 8 km | 44 min | 75 |
| 6 | 10 km | 55 min | 90 |
| 7 | 5 km, under 20 min | 20 min | 100 |
| 8 | 15 km | 80 min | 115 |
| 9 | Half marathon | 110 min | 135 |
| 10 | Marathon | 210 min | 170 |

What happens at the end:
- **Enough stamina:** the level is complete and the next one opens.
- **Not enough:** stamina reaches zero part way. The drill fails at that distance, nothing opens, and the bar refills from the moment it ran out.
- **Stop:** the stamina spent so far is gone, and nothing opens.

The result is shown once, the next time you open the base ("Workout failed: level 2. Stamina ran out at 1.2 km.").

Levels 8 to 10 cost more than a full bar, so they need **efficiency**, which takes a share off every cost:
- the treadmill's tier: 0%, 5%, 10% or 15%;
- later: shoes, outfit buffs and skill points (endurance and speed). The cap is 60%.

## Recovery

Stamina refills on its own from empty to full in 30 hours. Recovery tools give it back faster: each takes longer than the last and gives more.

| Tool | Time | Stamina | In the game |
| --- | --- | --- | --- |
| Massage gun | 5 min | +8 | not yet |
| Ice bath | 10 min | +15 | yes: the ice bath item in the locker room |
| Sauna | 20 min | +28 | not yet |
| Compression boots | 40 min | +50 | not yet |

Tap the ice bath, press **Recover**, then **Get in**. **Get out** ends it early, with nothing gained.

You can do one thing at a time: no recovering during a drill, and no training in the ice bath.

## What's kept

`settings.drills`: the highest level open on each machine, the drill running, the recovery running, and the result still to tell you. Stamina is `settings.stamina` (docs/COMPOUND.md). Both are on this device for now, like the rest of settings.

## Next

- Cycling, swimming and gym drills, on their machines (the gym waits for a bench press clip).
- Shoes, treadmill upgrades and outfit buffs for efficiency; a skill tree (endurance and speed) from run room levels, which you can reset for coins.
- The athlete sitting in the ice bath; the sauna, compression boots and massage gun once their items are painted.
- Keeping drills on the server, so they can't be changed on the device and follow you between phone and laptop.
