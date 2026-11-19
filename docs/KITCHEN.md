# The club kitchen (plan)

A small outdoor restaurant on the base, with its own cooking game. It plays like an order-and-assemble cooking
game (the genre of Good Pizza, Great Pizza), but with our own setting, food, art and rules. Athletes from your
club come to the serving window and order sports food. You make it, they pay, and some of what you make goes into
your bag as food that gives boosts.

Nothing here is built yet. The art is queued in `MOSKE APP/PromptQueue Prompts/kitchen-restaurant.csv`, which
`MOSKE APP/Island/make-kitchen-csv.py` writes. The pictures already made are in
`Characters/Photos/Robots/Robots/Grounds/kitchen/`: the counter, ingredients, products and tools.

## On the base

- `kitchen-restaurant` is a placeable item on the lawn, plot only, 4 x 4 like a builder's hut, with faces a and b.
  A builder builds it (a build job, like any item). Tapping it opens the kitchen.
- `kitchen-patio` is a 2 x 2 table set, placed round it. It's decoration; later, each set could seat one more
  waiting customer.

## The game: two screens, portrait

1. **Order view** (`kitchen-pov-order`): you look out of the serving window. An athlete walks up (our 3D
   characters, drawn in the empty middle) and orders in a speech bubble (`kitchen-ui`). The order is either a
   picture of the product or a riddle ("something for a long ride"). The ticket goes on the rail.
2. **Prep view** (`kitchen-pov-prep`): the worktop. Pick the container (`kitchen-serve`), tap or drag ingredients
   in from the eight bins (`kitchen-bins`), use a tool (blender, hob: `kitchen-tools`), then serve.
3. **Serve**: back at the window. The athlete reacts, pays coins and maybe tips (the tip jar), and you get 0–3
   stars. The match between the order and what you made sets the stars.

## Recipes (first list, from the product sheet)

| Product | Container | Ingredients | Tool |
|---|---|---|---|
| Energy gel (4 strengths) | pouch | honey or maple syrup, dates, salt | blender |
| Oat bar | wrapper | oats, honey, dates | none (press) |
| Smoothie | cup | banana, berries, yoghurt | blender |
| Recovery shake | shaker | protein powder, milk, banana | shaker |
| Rice bowl | bowl | rice, sweet potato, ginger | hob |
| Overnight oats | jar | oats, yoghurt, berries, honey | none |

## What the food is for (to decide)

- **Boosts** (`kitchen-buffs`): energy, endurance, strength, recovery, hydration and focus. Food made in the kitchen
  goes to the bag, and using it gives a short boost. Options for the boost: more XP from the next logged workout,
  the club robot's km in the stadium race, or faster builder jobs.
- **Real life**: a logged workout brings a matching customer. A long ride brings an athlete who orders a
  recovery shake, and serving them well rewards that workout. A suggestion of what to eat after a workout is the
  real-life side. It's a nudge, not nutrition advice.
- **Ingredients**: bought with coins, or a daily delivery that grows with training, like the markets' stock.
  The markets' passive income is to be reworked separately, and the two may share it.

## Open questions

- Server side: orders, stars and rewards need a table and RPCs (a migration, with the user's OK).
- How many customers a day, and whether you can miss them.
- Whether the kitchen levels up (a bigger menu) through the builders.
