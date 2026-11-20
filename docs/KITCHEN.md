# Food: the kitchen, the gel stand and the coffee machine (plan)

Food is made on the base, by hand, from ingredients bought with carbs. What you make boosts your **next workout**:
gels give it more XP, meals give it more coins. Coffee is the exception: it's drunk on the spot and speeds up a
builder.

Nothing here is built yet. The art is queued in `MOSKE APP/PromptQueue Prompts/kitchen-restaurant.csv`, which
`MOSKE APP/Island/make-kitchen-csv.py` writes. The pictures already made are in
`Characters/Photos/Robots/Robots/Grounds/kitchen/` (and `gen/` for the CSV's results).

## Three stations

| Station | Makes | Boosts |
|---|---|---|
| **Gel stand** (new, small item on the base) | Race nutrition: gels | XP on your next workout |
| **Kitchen** (the restaurant item, 4 x 4) | Meals and shakes: carbs before, protein after | Coins on your next workout |
| **Coffee machine** (already on the base) | Coffee, drunk straight away | Time off a builder's job |

## The rules

### 1. Carbs buy ingredients

- Carbs stay as they are: earned by training (0.8 g per base XP, at most 300 g a day, stored up to 10,000 g;
  `GEAR_RULES` in `js/core/gear.js`).
- The **Pantry** sells ingredients for carbs (first prices, grams): oats 10, banana 10, milk 10, salt 10, rice 15,
  pasta 15, honey 15, berries 15, dates 15, yoghurt 15, sweet potato 15, coffee beans 15, maltodextrin 20,
  fructose 20, protein powder 30, caffeine 30.
- **Buying food ready-made costs 5 times** what its ingredients cost (a gel: 50 g to make, 250 g ready-made).
  Ready-made food counts as 2 stars. This raises today's shop prices (a gel is 120 g now).

### 2. Next workout, one meal and one gel

- Every gel and every meal boosts **the next workout you post** (the next session that earns XP, as gels work
  today). Nothing is on a clock of hours any more.
- You can have **one gel and one meal switched on** at a time. Both wait for the same workout and both apply to it.
- Once switched on, it waits as long as it takes for that workout. Made and **not** switched on, a meal spoils
  after **2 days**; a gel keeps 7 days.
- Each kind keeps its limit per rolling 7 days (`perWindow`) and how many you can hold (`maxHeld`).

### 3. Gels boost XP, meals boost coins

- **Gels** add XP to that workout, as today (in basis points, `boosts.js`).
- **Meals** add coins to that workout: the coins it earns × the boost, paid **on top of** the daily coin cap
  (120). The weekly limits keep this in check. This is new: today coins come only from base XP
  (`wallet.js`, and the server's `wallet_fold()`).
- Meals with protein also give stamina (for the base's drills) when you switch them on.

### 4. Stars

Each thing made by hand gets 1-3 stars from how well its steps went. The boost is multiplied by
**×0.7 / ×1.0 / ×1.15** for 1 / 2 / 3 stars.

### 5. Recipes (first list; boosts at 2 stars)

| Station | Recipe | Ingredients (cost) | Ready-made | Boost on the next workout |
|---|---|---|---|---|
| Gel stand | Gel | maltodextrin, fructose, salt (50 g) | 250 g | +30% XP |
| Gel stand | Caffeine gel | the same plus caffeine (80 g) | 400 g | +40% XP |
| Gel stand | Race gel (opens after 3 stars on both above) | maltodextrin, fructose, salt, caffeine, honey (95 g) | none | +50% XP |
| Kitchen | Oat bar | oats, honey, dates (40 g) | 200 g | +20% coins |
| Kitchen | Overnight oats | oats, yoghurt, berries, honey (55 g) | 275 g | +20% coins |
| Kitchen | Rice bowl | rice, sweet potato, salt (40 g) | 200 g | +30% coins |
| Kitchen | Pasta | pasta, salt, honey (40 g) | 200 g | +30% coins |
| Kitchen | Smoothie | banana, berries, yoghurt (40 g) | 200 g | +15% coins, +15 stamina |
| Kitchen | Recovery shake | protein powder, milk, banana (50 g) | 250 g | +40% coins, +20 stamina |

### 6. Coffee

- Made at the coffee machine and drunk straight away: it takes time off the builder's job that's running.
- **Once a day.** The cut grows with the machine's level: **30 min / 1 h / 1 h 30 / 2 h** at levels 1-4.
- Stars don't change it (the coffee game is for fun and the daily habit).

### 7. Builders

**Gels no longer finish a builder's job** (too strong). Remove `skipKinds` in `js/core/workshop.js`; coffee is
the only way food helps builders.

### 8. Kitchen customers

Clubmates come to the window and order. Serving them pays carbs back (about the ingredients' cost) plus a tip in
coins, **at most 30 coins a day** from tips, so cooking never overtakes training.

### 9. Battles (later, once PVE and the arena exist)

A race belt: 1 meal before the battle and 2 gels to use during it. In the arena 1v1 both players have the same
belt and everything counts as 2 stars, so it stays fair; stars matter in PVE.

## What changes in today's code

- `FUEL_ITEMS` (`gear.js`): every food becomes next-workout (`nextWorkout: true`, no `hours`); food gets a coin
  boost instead of an XP one; one gel and one meal at a time instead of one fuel; prices ×5 of the recipe.
- `boosts.js`: the gel's XP boost only; a new coin boost from the meal.
- `wallet.js` and `wallet_fold()`: the meal's bonus coins on top of the cap; ingredients bought with carbs.
- `workshop.js`: no gel skips; a coffee cut once a day by machine level.
- Server: a migration (ingredients held, things made with their stars, switched-on gel and meal, the coffee of the
  day). **Needs the user's OK.**
- Food already held when this ships: becomes the same item at 2 stars, next-workout.

## Open questions

- Does an app-logged gym session count as the "next workout", or only one posted on Strava?
- Exact prices and boosts are a first guess, to be tuned.
- The kitchen's screens and gameplay: next.
