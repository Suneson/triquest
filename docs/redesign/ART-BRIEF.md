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
| Swimming | 1 | `icons/Pixelart/SWIM/SWIM_LVL1.png` |

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
| Trainer portrait + frames | `icons/trainer/` (see the trainer section) |

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
draws its motion effects at fixed positions). For Swim, the swimmer sits about
47% across and 57% down; the pool's water surface fills a diamond running from
about (9%, 55%) to (49%, 31%) to (92%, 54%) to (50%, 81%).

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

The app's dialogue boxes have a portrait slot that switches on as soon as art
exists (`COACH.portrait` in `js/core/scenes.js`). The coach on the bench in
every scene is the same man, so match him.

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

Make `blink`, `talk` and `cheer` from the same image (same framing, same pixel
grid) so they can be swapped frame for frame. With just `portrait.png`, the app
shows a still portrait with a 1-pixel idle bob. With `blink` and `talk` as
well, it can blink and "speak" while a line types out.

## Animated versions (any scene)

Any entry's `src` can point at an animated file instead of a PNG; nothing else
changes.

- **Format:** animated WebP (GIF also works but is larger and limited to 256
  colours).
- **Canvas:** exactly the same size as the still it replaces (512×512, or
  512×454 for the current Swim scene), the island in exactly the same place.
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
