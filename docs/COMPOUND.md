# The unified compound and item placement

Status: **built (2026-10-27)**, `0024_placements.sql` live.

The Profile tab now opens on **your base**: one painted isometric room per discipline you train, plus the locker room, locked together on black. You pan it by dragging, and zoom with a pinch, the mouse wheel or the + / − / fit buttons. Items stand on the rooms' floor tiles and move the way a base-building game moves them.

The pixel-art dioramas are retired from the Profile tab. They still back the level-up sheet, the levels carousel and other athletes' public profiles until those get the new rooms.

## Rooms and art

The rooms are cut from the green-screen renders on the `art-raw` branch (`art-raw/BACKGROUNDS/`) by `tools/cut-rooms.py`:
- It keys out the green and trims each room to its outline.
- It writes WebP into `icons/Pixelart/NEW/` (7 MB in total):

| Path | What |
| --- | --- |
| `BIKE/level-N.webp`, `GYM/…`, `POOL/…`, `RUN/…` | square rooms, levels 1–10 |
| `LOCKER/square-N.webp` | square locker, 1–10 |
| `LOCKER/landscape-N.webp` | 2×1 locker, 4–10 |
| `ITEMS/coffee-machine.webp` | the gift item |

- **Wide locker:** levels 1–3 show `landscape-4` until their art lands (`roomArt()` clamps with `Math.max(4, level)`).
- **Missing gym level:** the gym has no level 7 yet, so it shows level 6.
- **Room levels:** a sport room shows your level in that sport (the highest you've reached, so a prestige reset keeps it). The locker shows your account level.
- **Characters:** only the bike room has one, the animated rider (see Items). The run, gym and pool rooms are empty.

## One building (`js/core/compound-geometry.js`)

The rooms aren't placed on a screen grid. They are blocks of one isometric building:
- block (cu, cv) sits cu steps along the building's right-hand axis U and cv steps along its left-hand axis V, from the back corner;
- U = (511, 284) and V = (−511, 284) world px (`ISO_METRICS`).

```
            back corner
               GYM            (0,0)
          BIKE      POOL      (0,1)  (1,0)
               RUN            (1,1)
          LOCKER (2 wide)     (0,2)–(1,2)
            front corner
```

| Disciplines | Blocks |
| --- | --- |
| 1 | the sport (0,0), the square locker (0,1) |
| 2 | (0,0) and (1,0), the wide locker (0,1)–(1,1) |
| 3 | (0,0), (1,0), (0,1), the square locker (1,1) |
| 4 | as drawn above |

**Mapping the art.** An affine map takes each room's three measured floor corners exactly onto its block's corners, so neighbouring floors share their edges to the pixel:
- the room is drawn with that CSS `matrix()`;
- the art's long wall runs along its own V, so the wide locker is mirrored to put that wall along the building's U.

**Walls.** Rooms are drawn back to front. A back wall standing on an edge shared with a room behind it is an interior wall: it's cut down to a low curb (`STUB`, 3% of the art's height) with a `clip-path`, so the room behind stays in view and the building reads as one cutaway. Outer walls keep their full height.

**Layers.** Items, labels and the drag glow never take space among the rooms:
- items stand upright in their own layer, positioned by mapping their footprint into the world;
- labels sit in a layer under the items, at each floor's middle; zoomed out they show just the room's name, and they hide while you carry or pick something up;
- the floor glow and the arrows are drawn in each room's own (mapped) floor.

Your disciplines come from the setting `disciplines`, which is chosen at onboarding and editable in Settings and with the base's Rooms button (at least one stays on). Until it's set, it's the sports you've trained, or all four.

## The floor grid

Each room's floor is a parallelogram measured on its art as three corners (back, right, left, in % of the image) and cut into tiles:
- tile (u, v) runs from the back corner, with u towards the right corner and v towards the left;
- the map to the art is affine, and `pctToTile()` inverts it.

| Room | Tiles (u × v) | Blocked |
| --- | --- | --- |
| Gym, bike, run, square locker | 8 × 8 | none |
| Pool | 8 × 8 | the water: u 4–7, v 1–6 |
| Wide locker | 8 × 16 | none |

Once mapped into the building, tiles are the same size in every room (8 per block side). Walls and the outside are simply off the grid, so the bounds check refuses them.

`canPlace()` says why a spot is refused:
- `bounds`: a wall or the edge;
- `blocked`: the water;
- `occupied`: another item's footprint.

## Items

| Item | Footprint | Who has it | Home room |
| --- | --- | --- | --- |
| Coffee machine | 1×1 | everyone (gift) | locker |
| Your bike: the animated cyclist for your bike level | 1×2 along v (the way it faces) | everyone with a bike room | bike |
| Smart trainer (`bike-power-t3` art) | 2×1 | owners of the top power tier | bike |

- **Positions:** stored in `user_placements` (`0024_placements.sql`, own rows only) and cached on the device (`js/app/placement-state.js`).
- **Repairs:** a saved spot that no longer fits (its room is hidden, or the art changed) is drawn at a free tile in the home room or the locker. Nothing is rewritten until you move it.

## Interaction (`js/app/compound-view.js`)

| Do | Get |
| --- | --- |
| Tap an item | it bounces (scale 1 → 1.15 → 1), a tick buzzes, four blue arrows show on the floor round its base, and it zooms in if you were zoomed out |
| Drag the picked-up item | it lifts 8 px with a deeper shadow and follows the finger tile by tile, across rooms; the view scrolls when you near the edge |
| …over a free spot | green tiles under it |
| …over a wall, the water or another item | red tiles, and the item tints red |
| Let go on green | it lands with a thud and a clink, is saved, and stays picked up |
| Let go on red | it springs back to where it was, with a short buzz and the reason |
| Tap an arrow, or press an arrow key | moves it one tile that way (refused the same way) |
| Tap the floor, or press Escape | puts it down |

Under reduced motion nothing bounces, lifts, springs or eases.
