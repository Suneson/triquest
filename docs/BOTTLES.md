# Bottles

The MOSKE sports bottles are the game's potions. Workout chests drop them, and you drink them from the inventory's
Fuel tab. The rules are in `js/core/bottles.js`; the server runs the same rules in `0042_bottles.sql`.

## Drops

A chest's bottles are rolled once, when the server makes the chest. You own them once the chest is opened.

| Chest | Slots (chance each holds a bottle) | Weights, strength 1 / 2 / 3 / 4 |
|---|---|---|
| Common | 12% | 60 / 30 / 10 / 0 |
| Uncommon | 30% | 50 / 30 / 15 / 5 |
| Rare | 60% | 40 / 30 / 20 / 10 |
| Legendary | 100%, 40% | 25 / 30 / 27 / 18 |
| Mythic | 100%, 100%, 50% | 15 / 25 / 32 / 28 |

The stronger the bottle, the rarer it is, and the rarer the chest, the more it leans to the strong ones.

## The bottles

| Bottle | Strength | What it does | Where |
|---|---|---|---|
| Recovery Mix | 1 | Stamina to full | the app (stamina lives on the device) |
| Electrolyte Surge | 2 | +50% XP on workouts for 24 h | a `user_boosts` row, stamped like food |
| Build Brew | 3 | Builders 10× as fast for 1 h: up to 9 h off every running job, at once | `builder_jobs` |
| Chest Charger | 4 | The next workout chest comes one rarity higher | waits in `bottle_drinks` till `chests_grant()` uses it |
| VO2 Max | 4 | Top gear in the next stadium race | doesn't drop yet |

These rules apply to drinking:

- **One of a kind at a time:** you can't drink a bottle while one of the same kind is still working. That covers a
  charge waiting for its chest, the Surge's 24 h and the Brew's hour.
- **Surge and fuel:** the Surge is a fuel boost, so it can't go on while a gel or food is on, and food can't go on
  while it is. The fuel cap is +50%, which is why the Surge gives +50% and not double XP.
- **Build Brew needs a job:** with no builder at work it is refused (`gear:idle`), so it isn't wasted.

## Server

The migration adds these to the database:

| Name | Kind | What it is |
|---|---|---|
| `reward_chests.bottles` | column | the bottles the chest holds |
| `reward_chests.charged` | column | true when a Chest Charger raised the chest |
| `bottle_drinks` | table | one row per bottle drunk |

What you hold is not stored anywhere: it is worked out as the bottles in opened chests minus the ones drunk.

`my_chests()` returns the bottles too (`bottles_for()`). `drink_bottle(id)` checks the rules and does the effect.

Tests: `tests/bottles.test.js` covers the JS rules, and the SQL in PGlite.
