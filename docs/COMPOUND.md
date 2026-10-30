# The Profile stage: one room, its floor grid, and placing items

Status: **built (2026-10-27)**. This replaces the multi-room compound. `0024_placements.sql` is live.

The Home tab (the middle of the dock, docs/JOURNAL.md; once Profile, then GYM) is a diorama: one painted isometric room at a time, standing in its plot on a generated terrain (sky, grass, the dirt cutaway). It sits under a game HUD:

| Where | What |
| --- | --- |
| Top left | your badge: avatar, name, account level |
| Top right | three glossy capsule gauges: coins, carbs and **stamina** |
| Under the HUD | the room's plate: name and build level (opens its levels), trophies (opens the case), and a countdown if something for it is in the workshop |
| Bottom | four square sport buttons (Cycling, Swim, Run, Gym), and the Locker Room & Recovery button full width underneath; the room you pick is remembered |
| Corners | inventory and "what's next" on the left, the shop on the right |

## The world (`js/core/diorama.js`)

**The terrain:** `icons/Pixelart/NEW/env-ground-sky.webp`, 848×1264. It was generated with `tools/gen-env.mjs`, using the room art as the angle reference, and fitted by `tools/cut-env.py`.

**Placing the room:** its art is scaled uniformly (86% of the terrain's width), never skewed, and its floor is centred on the plot.

**Zoom and pan:**
- The smallest zoom covers the viewport, so nothing outside the terrain ever shows.
- The largest is 2.5× that.
- Panning keeps the terrain's edges outside the viewport.
- Picking an item up from far out zooms in on it.

**Room art:** `icons/Pixelart/NEW/<ROOM>/level-N.webp`, at the room's level:
- each sport room uses your level in that sport (the highest reached, so a prestige reset keeps it);
- the locker uses your account level;
- the gym has no level-7 art yet and shows level 6.

## Stamina (`js/core/stamina.js`)

**How it fills:**
- It runs from 0 to 100, gaining 1 point every minute.
- It's worked out from a timestamp anchor kept in your settings (`stamina: { value, at }`), so it catches up whenever the app opens again.
- It never goes over the cap, and a clock running backwards never drains it.

**Spending:** nothing spends it yet. When something does, it will move the anchor.

**The icon:** `icons/Pixelart/NEW/stamina-bolt.png`, generated and keyed by the same tools.

## The floor grid (`js/core/placement.js`)

Each room's floor is an 8 × 8 grid of tiles (u, v):
- u runs from the back corner towards the right, v towards the left;
- the grid is measured on the art as three floor corners, and the mapping is affine both ways;
- walls are off the grid;
- the pool's water (u 4–7, v 1–6) is blocked.

`canPlace()` gives the reason for a refusal: `bounds` (a wall), `blocked` (the water) or `occupied` (another item).

## Items

| Item | Tiles | Who has it | Where it starts |
| --- | --- | --- | --- |
| Coffee machine | 1×1 | everyone (gift) | the locker room, tile (3, 3) |
| Your bike: the animated cyclist for your bike level | 2 tiles, along the way it faces | everyone | the bike room |
| Smart trainer (`bike-power-t3` art) | 2×1 | owners of the top power tier | the bike room |

The run, gym and pool rooms have no characters.

Positions are kept in `user_placements` (own rows only) and on the device. A saved spot that no longer fits is drawn at a free tile without being rewritten.

## Placing, the base-building way

| Do | Get |
| --- | --- |
| Tap an item | a squash-and-bounce (1 → 1.18 → 1), a 10 ms buzz, its footprint on the floor in MOSKE blue (`rgba(12, 76, 174, .45)`, `#6EA8FF` outline), and four chunky arrows flat on the floor (NE, SE, SW, NW) |
| Drag it | it lifts and snaps tile by tile; the footprint goes red (`rgba(217, 68, 59, .6)`, `#D9443B`) over a wall, the water or another item, and the item tints red; the view scrolls at the edges |
| Let go on blue | it lands with a thud and a clink, is saved, and stays picked up |
| Let go on red | it springs back with `cubic-bezier(.175, .885, .32, 1.275)` and the reason shows |
| Tap an arrow, or press an arrow key | moves it one tile |
| Tap the floor, or press Escape | puts it down |

Under reduced motion nothing bounces, lifts, springs or eases.

## Type

The whole app uses one heavy game face: `'Franklin Gothic Heavy', 'Arial Black', Impact, sans-serif`. Headings, buttons, labels and numbers get a `0 2px 4px rgba(0, 0, 0, .6)` shadow. The pixel font (Silkscreen) is no longer loaded.

## Items stand inside their footprint (2026-10-28)

Each item's picture is set down concentric with its blue footprint: the object's base covers `fit` of
it (0.8 unless the item says otherwise), its foot on the front corner of that smaller diamond, with a
soft floor shadow the size of the base. How wide the object is inside its file, and how much empty
space is under it, is measured once by `tools/measure-items.py` into `js/core/item-fit.js` (re-run it
when art changes). So a new picture fits without hand-tuned numbers.

## Type

The house type is Franklin Gothic Heavy where it's installed, else Libre Franklin (OFL) served from
`fonts/`, with its weight axis held at heavy, so iPhones get the same bold letters as desktops.

## The room buttons and the tab bar

- **Tab bar:** the dock: Journal, Shop, **Home** (this view, in the middle), Chat, Ranks (docs/JOURNAL.md). The view's key is still `progress`, so saved tabs and links keep working.
- **Room buttons:** the four sports and the locker room use the shop's own tab plate (`.game-tab` in `css/tabs.css`, shared with the gear shop and inventory tabs). They're beige, and the open room's is seafoam, on a bottle-green band.
- **Icons** (`icons/UI/sports/`, cut by `python3 tools/cut-shop-ui.py icons/UI/sports/src`):

| Button | Icon |
| --- | --- |
| Cycling | The bike photo, keyed |
| Swim | The cap photo, keyed |
| Run | The T3 running shoe |
| Gym | A dumbbell from `tools/gen-shop-ui.mjs`, styled like the shop tab icons |
| Locker | The backpack, cut from the old locker tile |
