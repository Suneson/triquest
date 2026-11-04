# Handoff: fix the lobby seams with Photoshop's Generative Fill

You're picking this up from another Claude session that had the full history. Everything you need is here.

## Background

- MOSKE (this repo) is a fitness game for the phone. Its home screen is a painted isometric city around the MOSKE tower.
- The city picture is cut into tiles in `icons/City/layers/tiles/city-<row>-<col>.webp`. The tiles are 1008 × 934 px as stored, and the app draws them at 4/3 scale.
- The tower's lobby used to have four painted kiosks round it, two on each side. They were painted out with Gemini, leaving bare wall and pavement. The app now draws its own markets, trees and lamp posts over those spots (`js/app/market-view.js`, `docs/MARKETS.md`).
- **The problem:** the painted-out areas don't blend in. Each side has a rectangular patch whose wall and pavement are a slightly different tone, and its edges show as straight lines. There are also some cut-off fragments: half a planter, the stub of a post, a stray pole.

## Files

- `handoff/lobby.png` is the image to edit: 2016 × 1868 px, with transparency. It's four tiles side by side:

  |  | left | right |
  |---|---|---|
  | **top** | `city-1-1` | `city-1-2` |
  | **bottom** | `city-2-1` | `city-2-2` |

- `handoff/lobby-marked.jpg` is the same picture with the two areas to fix boxed in red:
  - **Box 1:** the lobby's left wall and pavement, about x 250–680, y 1150–1660.
  - **Box 2:** the right wall and pavement, about x 1370–1880, y 1240–1660.
- `tools/lobby-tiles.py` cuts the edited picture back into the four tiles.

## The job

1. **Open the file.** Open `handoff/lobby.png` in Photoshop using the Photoshop MCP. If it can't reach the open Photoshop, say so and stop. Don't fall back to another tool without asking.
2. **Fix box 1, then box 2, with Generative Fill.** Inside each box:
   - Select the mismatched patch and its straight seam edges, with a little overlap onto the good painting round it.
   - Run Generative Fill with a prompt like: *"clean smooth beige-grey building wall with a navy base stripe, matching the surrounding wall, isometric 3D render, soft daylight"* for the wall. For the pavement, use: *"clean light grey pavement matching the surrounding pavement, isometric 3D render"*.
   - Also remove the cut-off fragments in the boxes: the half planters, post stubs and stray poles. Leave the whole trees and the whole lamp post alone.
   - Keep the building's outline, the navy stripe and the kerb lines exactly where they are. Only the surfaces should change.
3. **Keep the art rules.** Read `docs/ART-DIRECTION.md`: modern, clean 3D, and **no wood anywhere**. Don't add anything new: no signs, people, kiosks or plants.
4. **Check everything else is unchanged.** Pixels outside the two boxes must not change, and the picture must stay 2016 × 1868 px with transparency kept. Flatten it and export it as `handoff/lobby-edited.png`. Don't overwrite `lobby.png`.
5. **Put it back into the tiles.**
   - If Python 3 with Pillow is available (`python -c "import PIL"`), run `python tools/lobby-tiles.py handoff/lobby-edited.png`. It writes the four tiles.
   - If not, skip this step; the other session will do it.
6. **Show the result.** Show before and after crops of both boxes.
7. **Commit and push** on this branch (`handoff/photoshop-lobby`) with `git push -u origin handoff/photoshop-lobby`. Don't push to `main`, and don't merge anything.

## Notes

- Ask before anything you're unsure about, rather than guessing.
- Optional, only if asked: the roof slab's railing. The app draws a new railing over each floor's slab (`icons/City/rail/`, "The railing" in `docs/CITY.md`). The old painted one under it is hidden by the new kerb, so it doesn't need touching now.
