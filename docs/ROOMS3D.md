# Expanding rooms to 16 × 16

Every room starts as its painted 8 × 8 room, standing in the middle of its floor's roof and taking half its width. Expanding a room swaps it for a 16 × 16 room made from a 3D model, which fills the whole roof up to the railing. It's bought once per room, for good.

| | |
| --- | --- |
| Price | 1,000 coins a room |
| Ready | The locker room (`LOCKER_LVL10.glb`, from Meshy) |
| Coming soon | Gym, bike room, run room, pool: no 16 × 16 model yet |
| Levels | One 16 × 16 locker room for everyone, whatever its level |

The rules live in `js/core/expansions.js` (`EXPANSION_RULES`) and in `expansion_rules()` in `supabase/migrations/0029_expansions.sql`. `tests/expansions-sql.test.js` fails if the two disagree, and checks that the 16 × 16 room fills the roof.

**Update: there are now three sizes, 8 × 8, 16 × 16 and 32 × 32** (1,000 then 5,000 coins, `0032_expansions_32.sql`). The big picture is always 32 × 32 and fills the roof: at 16 × 16 the hazard tape marks the back quarter you own, and at 32 × 32 the tape goes. Tiles count from the back corner, so nothing moves when you expand.

The 32 × 32 picture is made from the 16 × 16 one by `tools/room-32.py`, not by stretching it: tiles keep their size and walls their height, the floor pattern folds, wall panels and window bays repeat, and the logo and plaque appear once. Each room shape needs its own panel numbers in that tool. Where this page says 16 × 16 picture below, read it as the source for that step.

## Buying

- **The Expand button** sits in the row under your name, right of the trophy. It shows the 16 × 16 room with a "16²" tag. In the locker room, the trophy shows the feats for all three sports together.
- **The Expand window** (`expansion-view.js`) lists the five rooms: Expand with its price for a ready room, Expanded once it's bought, and Coming soon for the rest.
- **Buying** charges the coins (`buy_expansion(room)`: `gear:coming_soon`, `gear:owned`, `gear:insufficient`) and takes you straight to the room, now 16 × 16.
- **On the server:** `user_expansions` holds what you've bought. `wallet_fold()` counts a room expanded as rank 10, paid out, and `js/core/wallet.js` does the same offline.
- **Before 0029 is live**, Expand is greyed out.

## The 16 × 16 room's picture

- **Rendering:** the picture (`icons/Pixelart/NEW/LOCKER/model-10.webp`, 2200 × 1586) is the model rendered from the city's own camera: orthographic, at the room pictures' slope (0.489), from its front corner, then repainted in Gemini with a rubber-tile floor and cut with `tools/cut-room.py`. It's a still, made once; a live model would cost the phone a second WebGL scene for a room that doesn't move.
- **Its floor:** the corners were measured on the repaint where the floor meets the walls (`ROOM_GEOMETRY['locker-16']` in `js/core/placement.js`). It's a 16 × 16 grid, so a tile is the same size as in an 8 × 8 room and an expanded room holds four times as much. Things already placed keep their spots.
- **Its size:** its floor takes `share` 0.818 of the slab's width. That puts the outside of its walls (96.6% of the picture's width, to the floor's 91.1%) just under the railing's inner edge (86.1% of the slab). The railing's front half, with its gold rails, stands in front of it.

## Next rooms

`docs/ROOMS-16-NEXT.md` has the plan: all five rooms as 16 × 16 pictures, taped off to the back 8 × 8 until they're expanded.

Each room needs its own 16 × 16 model, rendered the same way, then its name added to `ready` in both rule sets. A room's levels can come later, from three models per room:
- broken, for levels 1–3;
- repaired, for 4–6;
- finished, for 7–10.

Textures and props vary within each band.
