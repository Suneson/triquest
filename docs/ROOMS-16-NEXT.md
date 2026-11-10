# The 16 × 16 rooms: what to make next

Every room becomes one 16 × 16 picture. Before it's expanded, only the 8 × 8 in the room's **back corner** can be used, with the rest of the floor dimmed behind tape, so you can see how much bigger it gets. Expanding takes the tape away.

## Where it stands

- **All five rooms, all ten levels:** the 32 × 32 pictures are in the app (`icons/Pixelart/NEW/<ROOM>/big-N.webp`, half-size `mid-N.webp`). The old painted 8 × 8 rooms are deleted.
- **One frame per room:** `tools/cut-rooms-32.py` lays every level onto level 10 by the three lower corners of its base slab, so one floor grid serves all ten. Walls differ in height and thickness between levels, which is why the outline can't be used.
- **The tape:** every room that hasn't been expanded shows its big picture taped off to the back 8 × 8 (`TAPED_ROOMS` in `js/core/expansions.js`).
- **Buying:** players can only buy the locker room's expansion until `supabase/migrations/0034_expansions_all_rooms.sql` is applied to the live database. Then add the other rooms to `ON_SALE`.
- **Known:** on gym and run levels 7 and 8 the art has a wide white kerb, so the outermost row of tiles lies on it.

The rest of this page is how the pictures were made.

## What to make

14 models, then 14 repaints. Do them in this order, so a problem shows up early:

| Order | Room | Version | Levels | File name |
| --- | --- | --- | --- | --- |
| 1 | Gym | Finished | 7–10 | `gym-finished` |
| 2 | Bike room | Finished | 7–10 | `bike-finished` |
| 3 | Run room | Finished | 7–10 | `run-finished` |
| 4 | Pool | Finished | 7–10 | `pool-finished` |
| 5–8 | Gym, bike, run, pool | Repaired | 4–6 | `<room>-repaired` |
| 9–12 | Gym, bike, run, pool | Broken | 1–3 | `<room>-broken` |
| 13–14 | Locker room | Repaired, broken | 4–6, 1–3 | `locker-repaired`, `locker-broken` |

Send me the first one (`gym-finished`) on its own, so I can check it before you make the rest.

## Step 1: the concept (Gemini)

Attach the finished locker room (`icons/Pixelart/NEW/LOCKER/model-10.webp`) so the shape carries over, and the MOSKE logo. Paste this, with one room block and one version block filled in:

```
A single empty game room for a premium mobile strategy game, in the style of
Supercell's Clash of Clans, made to be turned into a 3D model. Use the attached
room as the exact reference for the shape: the same square floor, the same two
walls at the back and the same wall height and thickness, with the two front
sides fully open and a low kerb round the floor.

View: isometric three-quarter view from the front corner, seen from about 30
degrees above, the whole room in frame, centred, nothing cropped.

Flat, even studio light, plain light grey background, no cast shadows. The floor
is completely flat and EMPTY: no furniture, equipment, machines, benches or loose
objects on it, because items are placed on it in the game. Anything fitted must
be on the walls and sit flat against them.

Modern, clean and premium, like a sports brand's flagship training centre.
Palette: MOSKE blue #0C4CAE, navy #16264D, white, warm grey, small gold accents.
No wood anywhere: no planks, no wood grain. No text except the attached logo,
once, on the back-left wall.

ROOM: <room block>
VERSION: <version block>
```

### Room blocks

- **Gym:** `A strength gym. Walls of navy panels with a blue light strip and a wall of mirrors. Floor of black rubber tiles with blue inlaid squares.`
- **Bike room:** `An indoor cycling studio. Walls of navy panels with a large window strip and a fitted rail for hanging wheels. Floor of smooth grey sports vinyl with a blue racing line curving across it.`
- **Run room:** `An indoor running studio. Walls of white and navy panels with blue speed stripes. Floor of blue running-track rubber with white lane lines.`
- **Pool:** `An indoor swimming hall. Walls of white and blue tiles with tall windows. A long rectangular lap pool is sunk into the floor, with its water level with the deck. It runs along the back-right wall: it starts a quarter of the way along that wall from the back corner and carries on to the open front edge, one narrow walkway away from the wall, and it covers about three-quarters of that wall's length and a little under half the room's depth. The rest of the floor is pale non-slip tile.`
- **Locker room:** `A locker room. Walls and glass panels exactly as in the attached room. Floor of white and blue rubber tiles exactly as in the attached room.`

### Version blocks

- **Finished:** `The finished room: everything new, spotless and polished, with lights on and the gold accents gleaming.`
- **Repaired:** `The room half-way through being done up: clean and working, walls freshly painted and plain, a few unfinished panels and bare fittings, one strip of work lights, no gold, no broken parts.`
- **Broken:** `The room before anyone has fixed it: the same walls and floor shape, but scuffed concrete walls with cracks and missing panels, exposed cables, and a worn, stained floor. Run-down but not dirty or scary, and still empty: no rubble, debris or fallen pieces on the floor. Keep the outline of the walls exactly the same.`

## Step 2: the model (Tripo)

Use the settings in `docs/ITEMS-3D.md` (HD Model, V3.1, PBR on, 2K texture), with these changes for rooms:

- **Polygons:** about 300,000.
- **AI Complete: off,** so it doesn't add parts behind the walls.
- **Check before exporting:** the floor is flat and square, the two front sides are open, and nothing stands on the floor. If the floor isn't flat, regenerate. It can't be fixed later.
- **Export:** a GLB, named as in the table (`gym-finished.glb`).

Put them in `MOSKE APP/Rooms/models/`, and tell me.

## Step 3: my render

I render each model from the same camera as the items (45° round, slope 0.489) and give you `<name>-16-grey.jpg`. I also measure its floor's corners on the model, so items line up.

## Step 4: the repaint (Gemini)

Use the **Rooms** prompt in `tools/render-items/RETEXTURE-PROMPT.md`, with the render and the logo attached. Fill in `Walls:` and `Floor:` from the room block above, and ask for the flat `#00FF00` background.

For a repaired or broken room, attach the same room's finished repaint as well, and add:

```
Use the attached finished room as the reference for the colours, logo position and
painting style. Keep everything in this render's own condition: it's the same room
at an earlier stage.
```

Send it back if the walls or floor outline moved, or if anything was added to the floor.

## Step 5: hand them over

Put the repaints in `MOSKE APP/Rooms/<date>_Greenscreen batch/`, named as in the table. I then:

1. Cut them with `tools/cut-room.py`.
2. Add each room's floor to `ROOM_GEOMETRY` and its picture to the rules.
3. For the pool, block its water from drawn items (`[[4, 1, 16, 7]]` on the 16 × 16 floor, so its 8 × 8 keeps the same water as today).
4. Switch the rooms to their level bands.
5. Add all five rooms to `TAPED_ROOMS` in `js/core/expansions.js`, and to `ready` in both rule sets, which puts the tape in front of every player.

## Optional: a hand-painted tape

The tape is drawn by a script, because the Gemini key isn't on this PC. If you'd like it painted, generate this, save it over `icons/UI/tape.webp` at 256 × 48, and nothing else needs to change:

```
A seamless horizontal strip of barrier tape, flat on, filling the whole image edge
to edge, no background: repeating diagonal stripes of gold #F2C14E and navy #16264D,
satin plastic with a soft highlight along the top edge, clean and modern. It must
tile perfectly left to right. No text, no shadow.
```
