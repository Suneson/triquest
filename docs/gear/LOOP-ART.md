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

## Rare pieces (Phase 4, built from blueprints)

Rarer than the props, so each should look a little grander, with more gold.

| File | Prompt (after the style line) | Purpose |
| --- | --- | --- |
| `icons/Pixelart/PROPS/bike-podium.png` | a three-step race podium, the top step gold with a small gold cup on it, second step silver, third bronze | Cycling yard: built from 24 fragments |
| `icons/Pixelart/PROPS/run-statue.png` | a gold statue of a runner mid-stride on a grey stone plinth | Track: by the cones |
| `icons/Pixelart/PROPS/swim-blocks.png` | a gold swimming starting block with a white number plate, standing on a blue tiled edge | Pool deck: by the pool edge |
| `icons/Pixelart/PROPS/gym-cabinet.png` | a wooden trophy cabinet with glass doors and three shelves of small gold cups | Gym mezzanine |

Collection frames and plaques are drawn in CSS from the gear art you already have, so they need nothing new.

## Missions, seasons, the stall and clubs (Phases 5–6)

These were generated with Gemini and are in the app: `tools/gen-loop5.mjs <dir> [name…]` (key from
`GEMINI_API_KEY` only), then `python3 tools/cut-loop5.py <dir>`. The exact prompts are in the
generator. Room items use the coffee machine as the style reference: painted, glossy, navy and gold,
in the rooms' isometric angle, on flat #00FF00 that the cut keys out.

| File | What | Purpose |
| --- | --- | --- |
| `icons/Pixelart/NEW/ITEMS/mission-board.webp` | a wooden notice board on legs, three pinned notes, a gold star | The weekly mission board in every room |
| `icons/Pixelart/NEW/ITEMS/decor-*.webp` | plant, water cooler, bench, foam roller rack, punch bag, trophy shelf, towel rack, bolt rug | The daily stall's items |
| `icons/Pixelart/NEW/SEASONS/season-*.png` | round medallions: almond blossom, trade-wind windsock, calima dunes, sea of clouds | Season emblems (board, recap) |
| `icons/Pixelart/NEW/CLUBS/crest-*.png` | six shields: wave, bolt, peak, sun, wheel, bird | Club crests |
| `icons/Pixelart/NEW/CLUBS/relay-gran-canaria.webp` | the island from above, navy sea | The club relay map |
| `icons/Pixelart/GEAR/kit-season-*.png` + `bikelvl6_char--kit-season-*.webp` | recolours of the navy kit (`tools/kit-recolor.py`) | Season kit colourways |

## Room buttons (the base's bottom bar)

`tools/gen-buttons.mjs <dir> <style-ref.png>` then `python3 tools/cut-buttons.py <dir>` →
`icons/Pixelart/NEW/UI/btn-{bike,swim,run,gym,locker}.webp`. Square game tiles: a chunky bevelled
sand-and-tan stone frame, a cream panel, a glossy 3D icon in the upper two thirds and the lower third
left plain, because the label is written by the app in its heavy type (so it translates). The style
reference was a screenshot, sent only to the model and never committed. The wide Locker Room bar is
the same frame drawn in CSS, with its tile as the icon.

## Later phases

Climb plaques and race medals are added here as their phases are built.
