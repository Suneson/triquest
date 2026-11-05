# Retexture prompt (Gemini / Nano Banana)

Attach two images:
1. One render (`<item>-<a|b>-grey.jpg`).
2. The MOSKE logo, only if the item should carry it.

Then paste:

```
Repaint the attached 3D render as a finished game item for a premium mobile
strategy game, in the style of Supercell's Clash of Clans buildings.

Keep exactly the same object: the same silhouette, the same outline, the same
size and position in the frame, the same camera angle and perspective, and the
same contact shadow on the ground. Do not move, add or remove any part. Do not
crop or zoom. The result must line up pixel for pixel with the original.

Change only the surfaces: hand-painted texture over the 3D form, clean and
modern, rich but not neon colours, smooth gradients, crisp bevel highlights on
the edges, soft ambient occlusion in the creases, a warm key light from the
upper left and a cool soft rim light on the right, as in the render.

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

Background: keep the same flat mid-grey #8A8A8A, with no gradient and nothing
else on it.
```

Add one line per item:

| Item | Line to add |
|---|---|
| coffee machines | `Tier <1/2/3>: keep its colours (black and silver / MOSKE blue and steel / carbon fibre and gold).` |
| treadmills | `The belt is dark grey rubber, the console screen dark glass.` |
| road bike, rollers | `The frame is glossy white with a navy and gold detail; the rollers are matte black with white drums.` |
| bike stand | `The frame is orange carbon fibre; the stand is MOSKE blue with a gold edge.` |
| gold trophy | `Gold mountain with navy enamel rock faces; the flag is MOSKE blue with the logo.` |

## Rules

- **One render per chat.** Do facing **a** first. Then do facing **b** with that first result attached too, and add: `Match the attached finished item's colours and materials exactly; it's the same object seen from the other side.`
- **Send it back if** the outline moved, a part was added, or the shadow changed. Ask again with: `Keep the outline exactly as in the render.`
- **Send me back** the finished images, named like the render (`treadmill-t1-a.png`). I'll cut them out with the render's own exact outline and put them in the app.
