# Art brief: missing MOSKE scenes

What the Profile tab still needs, written so each piece can be generated to
match the scenes that already exist. Code never needs to change for new art:
drop the file in place, then point its entry in `js/core/scenes.js` at it (one
line per level).

## What exists today

| Sport | Real levels | Files |
|---|---|---|
| Cycling | 1–10 (layered: background, platform, animated character) | `icons/Pixelart/BIKE/…` |
| Running | 1–10 | `icons/Pixelart/RUN/RUNGENERAL_LVL1.png`, `RUNLVL2.png` … `RUNLVL10.png` |
| Gym | 1–9 | `icons/Pixelart/GYM/GYM_LVL1.png` … `GYM_LVL9.png` |
| Swimming | 1 | `icons/Pixelart/SWIM/SWIM_LVL1.png` (512×454, see "One canvas") |
| Trainer | portrait + full figure | `icons/trainer/portrait.png` (96×96), `full.png` (109×189) |

Levels above the last real image show that last image; the level number in the
HUD is always the athlete's true level.

`GYM/templvl10.png` is still in the folder. It looks finished (it has a
"LEVEL 10" label like the others), but it hasn't been approved, so the app caps
Gym at level 9. If it's good, rename it to `GYM_LVL10.png` and add the entry.

## Still needed

| Piece | Save as |
|---|---|
| Swim levels 2–10 (9 images) | `icons/Pixelart/SWIM/SWIM_LVL2.png` … `SWIM_LVL10.png` |
| Gym level 10 (if `templvl10` is rejected) | `icons/Pixelart/GYM/GYM_LVL10.png` |
| Trainer frames: blink, talk, cheer | `icons/trainer/` (see the trainer section) |
| Optional: athlete-free plates + animated athletes | next to each still (see "Animated versions") |

## Rules for every new image

These hold for every file below. A file that breaks one goes back.

### One canvas

All stills are **512×512**. Swim level 1 is the exception at 512×454; it stays
as it is (decided in pass 2), and its overlay positions are recorded for that
level only in `js/core/scenes.js`. Every new Swim level is 512×512 with the
island in the same place, so it uses the pool coordinates given in the Swim
section (already converted to the 512×512 canvas).

### Safe zone

The app now crops the sides of the stills on narrow phones (the stage is full
width and up to 116% of the width tall; the art keeps its aspect ratio). Keep
**the athlete, the coach and the LED level sign inside the central 80% of the
width** (x from 51 px to 461 px on the 512 canvas). The island's left and right
tips may run outside it.

### Flat background colour

The island sits on a flat colour, and the app paints the screen around the art
with that same colour, so it has to match exactly. Use these hex values (they
are the `backdrop` values in `js/core/scenes.js`):

| Sport | Level | Background |
|---|---|---|
| Gym | 1–9 | `#353c43`, `#383c42`, `#343a3e`, `#353a3e`, `#32393c`, `#2f373a`, `#2f3739`, `#2d3637`, `#2b3335` |
| Gym | 10 | `#2b3335` (continue level 9) |
| Swim | 1 | top `#0f1626`, bottom `#111727` |
| Swim | 2–10 | `#0f1626` flat |
| Run | 1–10 | sky / ground gradients, sampled per level into 24 bands (`RUN_BANDS`); new Run art isn't needed |
| Cycling | — | layered scene, no backdrop |

If a generator can't hold an exact colour, generate on pure `#00ff00` and the
background gets keyed out and refilled (that's how the trainer was made).

### Method: edit the previous level

Make each level by **editing the previous level's image**, not from the text
prompt alone: give the generator level N−1 as the input image and ask for the
changes in the level N prompt. That keeps the camera, the island's shape and
the athlete's spot identical, which the app's overlays (water shimmer, lamps,
clouds) depend on. Start Swim 2 from `SWIM_LVL1.png` padded to 512×512 with
`#0f1626` (29 px top and bottom).

### Size: generate large, bring it down with nearest-neighbour

Generate at 1024 or 2048 px on a clean pixel grid, then downscale with
nearest-neighbour, never smooth resampling:

```
node tools/optimize-pixelart.mjs icons/Pixelart/SWIM/SWIM_LVL2.png        # → 512, palette PNG
node tools/optimize-pixelart.mjs --max=96 icons/trainer/blink.png          # trainer frames → 96
```

### Acceptance checklist (per file)

- [ ] 512×512 (stills) or 96×96 (trainer frames), PNG or animated WebP
- [ ] Flat background is the exact hex from the table, edge to edge
- [ ] Same camera angle and island position as the previous level (overlay the two at 50%: the island edges line up)
- [ ] Athlete, coach and level sign inside the central 80% of the width
- [ ] The LED level sign shows the right number; no other text anywhere
- [ ] Nothing in the bottom corners: no label, watermark, signature or generator mark
- [ ] Hard pixels: zoom to 400% and no blurred edges or half-tone fringes
- [ ] Under 300 KB (stills) after `optimize-pixelart.mjs`
- [ ] Added to `js/core/scenes.js` and `npm test` passes (the test checks every listed file exists)

## Open decision: Gym level 10

`GYM/templvl10.png` is finished art that was never approved, so the app caps
Gym at level 9. Two options: approve it (rename to `GYM_LVL10.png`, check it
against the checklist above, add one line to the manifest), or generate a new
one from the prompt in the Gym section by editing `GYM_LVL9.png`.

## House style (all scenes)

Every prompt below starts with this block. It describes what the existing
scenes already share.

> Isometric pixel-art diorama, 512×512 PNG, a single floating square island
> seen from the same 2:1 isometric camera angle (30° down, rotated 45°), the
> island's corner pointing straight down at the bottom centre. Crisp hand-placed
> pixels, no anti-aliasing blur, no dithering noise, limited palette with soft
> cel shading and dark 1-pixel outlines. The island sits on a plain flat
> background colour with clear margin on all sides. Somewhere on the island: a
> wall sign or board with the blue MOSKE bird logo, a coach (short dark hair,
> navy MOSKE polo or gilet, tablet or clipboard) sitting on a wooden bench to
> the right, a small sports bag and water bottles by the bench, and a standing
> LED level sign showing the level number. The athlete is mid-action near the
> centre of the island. **No text anywhere except the number on the level sign.
> No watermark, no signature, no corner label, no logo mark in any corner.**

Keep the athlete in roughly the same spot on every level of a sport (the app
draws its motion effects at fixed positions). On the 512×512 canvas for Swim
levels 2–10, the swimmer sits about **47% across and 56% down**, and the pool's
water surface fills a diamond running from about **(9%, 54%) to (49%, 33%) to
(92%, 53%) to (50%, 78%)**. (Those are level 1's positions moved onto the
512×512 canvas: level 1 is 454 px tall, so add 29 px above and below.)

## Swim, levels 2–10

Progression: a tired municipal pool slowly becomes a world-class aquatics centre.
The swimmer gets fitter, the kit gets better, and the room gets fuller.

| Level | Prompt (after the house-style block) |
|---|---|
| 2 | Same indoor pool as level 1: cream and teal walls, white tiles, one lifeguard chair. A few more lane ropes, a bin of kickboards, a pace clock on the wall. The swimmer has a cap and goggles now. LED sign "LVL 2". |
| 3 | The pool gets proper lane ropes (blue and white), starting blocks on the far edge, a wall pace clock and a whiteboard of sets. The coach holds a stopwatch. LED sign "LVL 3". |
| 4 | A club pool: fresh paint, a team banner with the MOSKE bird, a rack of pull buoys and fins, the swimmer doing a smooth freestyle with a small bow wave. LED sign "LVL 4". |
| 5 | Competition lanes with numbered blocks, backstroke flags over the pool, a scoreboard on the back wall. A couple of teammates resting at the wall. LED sign "LVL 5". |
| 6 | A small spectator stand along one side with a few fans, warm evening light through tall windows, the swimmer turning at the wall. LED sign "LVL 6". |
| 7 | Bigger natatorium: glass roof panels, a timing touchpad on each lane, a starter podium. The crowd grows. LED sign "LVL 7". |
| 8 | Championship setup: an LED results board, camera on a rail beside the lane, flags of several nations, the swimmer powering a butterfly stroke. LED sign "LVL 8". |
| 9 | A packed arena, confetti on the deck, the coach standing and pointing, a drone camera overhead. LED sign "LVL 9". |
| 10 | Olympic-level aquatics centre: gold lane ropes, a podium beside the pool, fireworks of light on the water, the swimmer touching the wall with a splash. A gold LED sign "LVL 10". |

## Gym, level 10 (only if `templvl10.png` is rejected)

> Same two-storey gym interior as levels 1–9 (mezzanine with cardio machines,
> staircase, squat racks, the MOSKE bird painted on the back wall, reception
> desk at the left). It is now a premium performance centre: glass balustrade,
> cyan LED strips, polished concrete floor, a "PEAK PERFORMANCE" poster, plants.
> The lifter benches a heavily loaded bar on the central platform in the same
> spot as the other levels. LED sign "LVL 10".

## Trainer (the coach character)

The portrait and full figure exist (made from the green-screen source in
`icons/trainer/source/`) and are live: the portrait shows in training dialogue
boxes and quest toasts, the full figure on the welcome card. Still missing are
the `blink`, `talk` and `cheer` frames. The coach on the bench in every scene is
the same man, so match him.

| File | What | Size |
|---|---|---|
| `icons/trainer/portrait.png` | Head and shoulders, facing three-quarters right, neutral friendly look | 96×96, transparent |
| `icons/trainer/blink.png` | Same frame, eyes closed | 96×96, transparent |
| `icons/trainer/talk.png` | Same frame, mouth open mid-word | 96×96, transparent |
| `icons/trainer/cheer.png` | Fist raised, big smile (for level-ups) | 96×96, transparent |

Prompt:

> Pixel-art character portrait, 96×96 PNG on a fully transparent background.
> A fit male triathlon coach in his 30s: short dark brown hair, light stubble,
> navy MOSKE polo with a small blue bird logo on the chest, a whistle on a cord.
> Head and shoulders, three-quarter view facing right, friendly confident
> expression. Same pixel scale, outline weight and palette as an isometric
> pixel-art sports game; 1-pixel dark outline, soft cel shading, no
> anti-aliasing. No text, no background, no watermark.

Make `blink`, `talk` and `cheer` by editing `portrait.png` (same framing, same
pixel grid) so they can be swapped frame for frame. Generate them large (384 or
768 px) on `#00ff00`, key the green out, then bring them to 96 px with
`node tools/optimize-pixelart.mjs --max=96 icons/trainer`. With `blink` and
`talk` set in `COACH`, the portrait blinks and "speaks" while a line types out.

## Animated versions (any scene)

**Preferred route: plate + athlete.** For each level, two files on the same
512×512 canvas:

- `…_LVLn_plate.png`: the scene with the athlete removed (edit the still: paint
  the athlete out, keep everything else pixel-identical).
- `…_LVLn_char.webp`: a transparent animated WebP of only the athlete, in
  exactly the spot they occupy in the still.

Add both to the level's entry as `plate` and `char` in `js/core/scenes.js`
(keep `src` as the full still). Profile then draws the plate and plays the
athlete over it, while the share card, Home strip and level carousel keep using
the full still. The test suite checks both files exist and that they're set
together.

**Fallback: a full-scene animated WebP.** Any entry's `src` can point at an
animated file instead of a PNG; nothing else changes. Use this when a clean
plate isn't possible.

- **Format:** animated WebP (GIF also works but is larger and limited to 256
  colours).
- **Canvas:** exactly the same size as the still it replaces (512×512; Swim
  level 1 is 512×454), the island in exactly the same place.
- **Background:** transparent, or the same flat colour as the still. If
  transparent, the app's sampled backdrop shows through.
- **Loop:** seamless, 8–16 frames at 6–10 fps (pixel art reads better choppy),
  looping forever.
- **What moves:** only the athlete (and small things like water or flags). The
  island and camera stay locked, so the app's overlays stay registered.
- **Size budget:** aim for under 600 KB per file. For reference, the Cycling
  characters are 768×624 animated WebPs of roughly 280–880 KB each.
- **No baked text** apart from the level sign, and nothing in the bottom
  corners.

Name animated files like the stills with an `.webp` extension, e.g.
`GYM_LVL4.webp`, and change that level's `src` in `js/core/scenes.js`.
