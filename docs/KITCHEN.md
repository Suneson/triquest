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

- **Every station works the same way:** tap it, pick a **final recipe** from its menu, then make it in the
  station's prep view. The menu grows as the station is upgraded (like a barracks unlocking new units): a level
  opens new recipes.
- **Ingredients are restocked on the spot:** the prep view shows each ingredient's stock, and a + on it buys more
  with carbs without leaving.
- **Who it's for:**
  - **Gel stand:** for you only. No customers.
  - **Coffee machine:** for your builders only.
  - **Kitchen:** two modes. **Cook for me** (pick a meal, make it, it goes to your bag) and **Service**:
    customers come for meals. The customers are the game's characters, including the future bosses
    (Blomvelt turning up hungry). About 5-10 customers a day, worth about 100 coins a day in all.
- **Balance rule:** training must stay the big earner. Workouts give about **75% of all coins**; playing without
  training earns something, but training with food on top is where the strong rewards are. Exact numbers come
  after the beta, from real data.

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
**×0.6 / ×1.0 / ×1.4** for 1 / 2 / 3 stars.

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

### 8. Kitchen customers (Service mode)

Characters come to the window and order, 5-10 a day. Serving them pays carbs back (about the ingredients' cost)
plus coins, about 100 coins a day in all, kept below a quarter of what training pays (to be tuned after the beta).

### 9. Battles (later, once PVE and the arena exist)

A race belt: 1 meal before the battle and 2 gels to use during it. In the arena 1v1 both players have the same
belt and everything counts as 2 stars, so it stays fair; stars matter in PVE.

## The gel stand (built first)

The rules are `js/core/gel-stand.js`, the screens `js/app/gel-stand-view.js` (preview: `?gels=1`, `&lvl=1-6`).
The art is queued in `MOSKE APP/PromptQueue Prompts/gel-stand.csv` (`MOSKE APP/Island/make-gels-csv.py`).

**Recipes, by stand level** (the stand has 6 levels, `icons/Items/gel-stand-t1..t6`; each level opens better
gels; boosts at 2 stars, on the next workout's XP):

| Level | Gel | Ingredients | Boost |
|---|---|---|---|
| 1 | Classic gel | maltodextrin, fructose, water, salt | +30% |
| 1 | Honey gel | honey, water, salt | +25% |
| 2 | Maple gel | maple syrup, water, salt | +35% |
| 2 | Hydro gel | maltodextrin, water (a lot), salt (a lot) | +35%, +50% on a ride |
| 3 | Caffeine gel | maltodextrin, fructose, water, salt, caffeine | +40% |
| 3 | Beet gel | beetroot juice, maltodextrin, fructose, salt | +40%, +55% on a run |
| 4 | Race gel | maltodextrin, fructose, honey, water, salt, caffeine | +50% |
| 5-6 | still to come (new gels and their art: ideas are a double-carb gel and an electrolyte race gel) | | |

**On the base:** the stand is an item on everyone's single-plot base (`gel-stand` in `placement.js`), on the lawn by
the builder's hut. Its picture is its level's.

**Upgrading** costs coins at once, then a builder's time; the stand keeps working at its old level meanwhile, and
its clock shows over it on the base (`UPGRADES` in `gel-stand.js`, a first guess):

| To level | Coins | Build |
|---|---|---|
| 2 | 400 | 2 h |
| 3 | 900 | 6 h |
| 4 | 1,800 | 12 h |
| 5 | 3,500 | 24 h |
| 6 | 6,000 | 36 h |

In the preview the coins are the stand's own (2,000 to start) and a "Finish now" button ends the build. With the
server: the wallet's coins, the build as a builder's job (coffee cuts it), and a migration (**needs the user's OK**).

The art is cut from the CSV's sheets by `tools/cut-gels.py` into `icons/Gels/` (gels, ingredients, tools, pouch,
interface, effects, the prep view's background) and `icons/Items/gel-stand-t<n>-<a|b>.webp` (the stand).

**The prep view, every tool on show** (fifth layout; background `gel-prep-bg-v5-b.jpg` made with Gemini from the
third layout's art, and the same picture painted empty, `gel-prep-bg-v5-b-empty.jpg`; `tools/cut-gels.py --v5` cuts
the background and, from the empty one, a patch for each tray place and the open bin). Top to bottom: the recipe
and what to do now on the white wall screen at the very top; a shelf of tap jars (water, honey, maple, beet); the
counter with the measuring glass, the jug and its meter, the pouch's place, and a bin built flush into it (its lid
opens when the glass or the jug is brought to it); the counter's navy front with the tools on hooks (sealer,
whisk, dropper, scissors, and a scoop for show); the tray unit painted into the picture: maltodextrin (white),
fructose (sky blue), salt (pink), the caffeine vials, an orange electrolyte (for gels still to come), the box of
empty pouches, and a stone pad. A tray place that runs out shows its empty picture. The buttons (Start, Back to
the gels, Make another) float over the bottom of the tray only when there's one to press; none while making. The
marble carries on below the scene on tall phones. The wall screen shows the recipe as a row of little pictures (a drop for a liquid, a pile for a powder, the
tool for an action; `gel-stand-screen.csv`, cut with `tools/cut-gels.py --screen` into `icons/Gels/scr-*.webp`):
done ones ticked, the one now ringed, and the one now big beside its instruction. Everything is dragged, and letting go ends a step (judged
"Exact!" / "Good" / "Over-poured!" / "Too little", then the next):
- **Liquids:** hold the measuring glass under the jar's tap and it fills to the top (no line on it). Tip it over
  the jug and it pours in slowly (0.5 glass a second); the meter beside the jug shows the line and its green sweet
  spot, and letting go over the jug judges it (what's left in the glass is poured away). Over the bin it's tipped
  out to fill again (no cost). A full glass is 0.75 of the jug.
- **Powders and salt:** drag a scoop from its tray over the jug: held there it always trickles in slowly (a thin
  stream), shaken side to side it pours faster (a heavy pour over it). The meter shows the level (or the salt) and
  its sweet spot. Art: `trickle-*` and `shake-*` (`gel-stand-v8.csv`, cut with
  `tools/cut-gels.py --streams`).
- **Stock shown while making:** what's taken at Start still shows in its tray or jar until its step is done, so a
  tray with its last bar only shows empty once that step's used it.
- **Caffeine:** take the dropper off its hook (or drag from the vials) and hold it over the jug: a drop every 0.4 s.
- **Stir:** the whisk comes off its hook, round and round the jug, a ring fills.
- **Fill:** take an empty pouch from the box and put it on the counter, then drag the jug over it and hold; let go
  at the red line. **Seal:** take the sealer off its hook and swipe it across the pouch's top.
- **The bin:** drag the jug to it to tip it away and start again (the ingredients are lost). Its lid only opens
  over a small spot low on the lid (76-97% across, 46-53% down), and the pouch is checked first. The jug's turned
  round as it tips, so its spout leads.
- **Restocking**, before you start: tap a jar or the caffeine vials for one more bar (each bar the same price); a
  short one shows a +. A powder comes in a bag in its own colour: tap its tray and the bag comes up big in the
  middle of the screen; take the scissors off their hook and cut along its dashed line (snip, snip). It then
  shrinks, flies to its tray, tips and pours itself in (`pour-*`, `puff-*`), filling the bar as far as the carbs
  pay for, up to all 4 (`fill()`), all paid at the cut. Art: `gel-stand-bags.csv`, `tools/cut-gels.py --bags`.
- **Carbs** are the player's own (the wallet in the top bar, whose icon is now the stand's carb bag). What the
  stand spends is kept on this device (`settings.gelStand.spent`) and taken off the wallet until the server side
  (a migration) records it; signed out, `?gels=1` keeps its own 600.
- **Stars** multiply the boost by ×0.6 / ×1.0 / ×1.4 (a honey gel: +15% / +25% / +35% XP). XP only, as all gels.
- Citrus, berry and lime jars (and their streams) are painted for the gels still to come.

**The screens (first version):**

1. **Menu:** every gel as a card (picture, name, boost, what its ingredients cost). Locked ones show the level
   that opens them. Pick one.
2. **Prep view, top half:** the chosen gel's recipe card (its picture, boost, and its steps as a list that ticks
   off) and the ingredient shelf: 8 ingredients, each with its stock and a + that buys one with carbs.
3. **Prep view, bottom half:** the step being done, one at a time:
   - **Pour:** hold to pour an ingredient into the mixing jug, let go at the line on its side.
   - **Salt:** turn a dial to the mark.
   - **Caffeine:** tap the dropper the right number of times.
   - **Stir:** stir in circles round the jug.
   - **Fill:** hold to fill the pouch to its line.
   - **Seal:** swipe across the pouch's top.
4. **Result:** 1-3 stars (from how close each step was), and the gel goes into your bag.

The ingredients are taken from stock when you start making it. Every step answers straight away: a light
vibration as things land, the liquid rising under your finger, the steps ticking off on the card.

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
