# Repaint prompts (Gemini / Nano Banana)

## Items

Attach two images:
1. The item's sheet (`<item>.jpg`, from batch 2 on): facing a on the left, facing b on the right, on green.
2. The MOSKE logo, only if the item should carry it.

Then paste:

```
The attached sheet shows the same object twice, from two sides: paint both
identically, the same colours, materials and details on each, and keep the two
apart exactly where they are.

Repaint the attached 3D render as a finished game item for a premium mobile
strategy game, in the style of Supercell's Clash of Clans buildings.

Keep exactly the same object: the same silhouette, the same outline, the same
size and position in the frame, the same camera angle and perspective. Do not
move, add or remove any part. Do not crop or zoom. The result must line up
pixel for pixel with the original.

Change only the surfaces: hand-painted texture over the 3D form, clean and
modern, rich but not neon colours, smooth gradients, crisp bevel highlights on
the edges, soft ambient occlusion in the creases. Light it neutrally: soft
white light from the upper left, as in the render, with no warm or coloured
tint, and keep the soft contact shadow on the ground under it in the same
place.

Materials:
- metal panels are smooth, brushed or satin;
- rubber is matte black;
- screens are dark glass with a soft reflection;
- gold is warm and polished, never yellow plastic.
No wood anywhere.

Palette:
- MOSKE blue #0C4CAE with sky blue #6EA8FF details;
- navy #16264D;
- gold #F2C14E;
- white #F2F5FC.

Keep the MOSKE bird logo where it already is, small, flat and crisp. Never add
a second one, and never add any other text.

Background: keep one flat solid pure green #00FF00 everywhere
around the object, no gradient, no glow or green spill on the object, a hard
clean edge. The contact shadow is a darker green on the ground.
```

Add one line per item, if it needs one:

| Item | Line to add |
|---|---|
| tiers | `Tier <1/2/3>: keep its colours (black and silver / MOSKE blue and steel / carbon fibre and gold).` |
| treadmills | `The belt is dark grey rubber, the console screen dark glass.` |

## Rooms (the 16 × 16 rooms)

Attach the room's render (`<room>-16-grey.jpg`) and the logo, then paste:

```
Repaint the attached 3D render of an open-topped game room as finished art
for a premium mobile strategy game, in the style of Supercell's Clash of Clans.

Keep exactly the same room: the same walls, floor outline, corners, window and
door openings, the same size and position in the frame, the same camera angle.
It must line up pixel for pixel with the original. Do not add furniture or
objects on the floor: the floor stays empty, because items are placed on it in
the game.

Change only the surfaces: hand-painted texture, clean and modern, smooth
gradients, crisp edge highlights, soft ambient occlusion in the corners,
neutral soft white light from the upper left. Walls: <the room's wall>.
Floor: <the room's floor>. No wood anywhere: no planks, no wood grain.

Palette:
- MOSKE blue #0C4CAE;
- navy #16264D;
- gold #F2C14E accents;
- white #F2F5FC.

The MOSKE logo may appear once, small, on a wall. No other text.

Background: one flat solid pure green #00FF00 everywhere around the room, a
hard clean edge.
```

For the locker room, use:
- **Walls:** "navy wall panels with a MOSKE blue stripe and small round ceiling lights along the top; tall windows with navy frames on the right wall."
- **Floor:** "smooth grey rubber sports flooring in large square tiles, a slight sheen."

## Rules

- **One sheet per chat:** both facings are painted together. For the first batch's single renders, do facing **a** first. Then do facing **b** with that result attached, and add: `Match the attached finished item's colours and materials exactly; it's the same object seen from the other side.`
- **Send it back if** the outline moved, a part was added, or the shadow changed. Ask again with: `Keep the outline exactly as in the render.`
- **Send me back** the finished sheets, named like the sheet (`treadmill-t1.png`). I split them into the two facings.
