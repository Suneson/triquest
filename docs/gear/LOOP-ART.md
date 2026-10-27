# Long-loop art: a list to batch

Every static image the long loop needs, with its file path, the exact prompt
and what it's for. This is a list for you to run in batches, not a script that
spends credits. Until an image exists, the app draws a stand-in at the same
path (`tools/draw-props.mjs`), so dropping the real file in is the whole change.

**Style for every prompt (prepend it):**

> Isometric pixel art game asset, single object, 3/4 isometric view matching a
> 2:1 isometric diorama, crisp 1px dark navy outline (#0B1222), limited palette:
> navy #16264D, deep blue #0C4CAE, blue #2F6FD6, steel #8FA6C9, white #F2F5FC,
> gold #F2C14E with dark gold #B8892A, small touches of red #D9443B. Soft
> top-left light, flat shading in 2–3 steps, no gradients, no anti-aliasing,
> no text, no letters, no numbers, no logos, transparent background, centred,
> fills about 80% of a square canvas, 512×512.

Export as PNG with transparency, then scale to 128×128 nearest-neighbour.

## Scene props (Phase 2)

Each prop is drawn into its sport's diorama at the anchor in `js/core/scenes.js`.
Keep the base of the object at the bottom of the canvas so it stands on the ground.

| File | Prompt (after the style line) | Purpose |
| --- | --- | --- |
| `icons/Pixelart/PROPS/bike-rack.png` | a low steel bicycle parking rack with four hoops, two road bikes slotted in, one red frame | Cycling yard: somewhere for the bikes |
| `icons/Pixelart/PROPS/bike-stand.png` | a bicycle repair workstand on a tripod, clamp holding a red road bike frame, a small tool tray | Cycling yard: next to the mechanic |
| `icons/Pixelart/PROPS/bike-tent.png` | a square pop-up team tent, blue and white striped valance, folding table underneath with bidons and a gold cup | Cycling yard: race-day feel |
| `icons/Pixelart/PROPS/bike-lights.png` | a tall steel floodlight pole with a rectangular lamp head of four bulbs, warm gold glass | Cycling yard: glows at dusk and night |
| `icons/Pixelart/PROPS/run-water.png` | a race-day water station: a wooden trestle table with a row of paper cups and a blue water cooler at one end | Track: by the lane starts |
| `icons/Pixelart/PROPS/run-gate.png` | a finish-line timing gate: two navy posts and a navy banner across the top with a small black digital clock panel, gold feet | Track: across the lane |
| `icons/Pixelart/PROPS/run-stand.png` | a small three-row metal spectator stand with navy bench seats and three tiny seated spectators | Track: by the bench |
| `icons/Pixelart/PROPS/run-lights.png` | a tall steel stadium light pole with a wide lamp head of six bulbs, warm gold glass | Track: glows at dusk and night |
| `icons/Pixelart/PROPS/swim-reel.png` | a lane-rope storage reel on a steel frame, wound with blue, white and red lane rope | Pool deck |
| `icons/Pixelart/PROPS/swim-clock.png` | a large round swimming pace clock with a white face, navy rim, red sweep hand, on a short post | Pool: on the back wall |
| `icons/Pixelart/PROPS/swim-stand.png` | a small two-row poolside spectator bench in blue with two tiny seated spectators | Pool deck |
| `icons/Pixelart/PROPS/gym-chalk.png` | a steel chalk bowl on a pedestal, heaped with white lifting chalk | Gym floor |
| `icons/Pixelart/PROPS/gym-sound.png` | a pair of black PA speakers on a small amp, round grey speaker cones, one gold status light | Gym mezzanine |

## Later phases

Mission boards, club crests, season plates, collection frames, climb plaques and
race medals are added here as their phases are built.
