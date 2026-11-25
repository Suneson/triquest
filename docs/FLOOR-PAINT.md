# Floor painting

You paint floor squares onto the lawn of your plot, and onto the club room floor. This is step 1 of `MOSKE APP/CLUB-ROOM-PLAN.md`.

## How it works

1. Tap the **Floor** button above the bottom-right corner of the base. The tray opens, and the other buttons hide while you paint.
2. Pick a material.
3. Pick a tool:
   - **Paint** marks each tile your finger drags over.
   - **Square** fills the rectangle between where you press and where you let go.
   - **Erase** turns tiles back to the plain floor.
4. **Undo** takes back the last stroke (up to 20). **Done** closes the tray.

Two fingers still pan and zoom. If a second finger comes down during a stroke, that stroke is taken back.

Some tiles can't be painted:

- the platform, which has its own floor
- blocked tiles, such as the platform's body and the huts' pads

## Data

- Paint is saved in settings as `floorPaint: { [geom]: { 'u,v': material } }`. Settings sync with the account, so no migration was needed.
- `plot-48` is the lawn and `club-32` is the club room.
- `js/core/floor-paint.js` holds the materials for each floor, the stroke maths and the shapes. It has tests.
- `clean()` drops unknown materials and tiles that can't be painted.

## Drawing

- **SVG layer.** `js/app/floor-paint-view.js` draws one SVG inside `.dg-room-art`. It uses the floor's tile-to-picture matrix, so each tile is a 1 × 1 square. Each material is a pattern `REPEAT` (4) tiles wide, so its texture runs on across neighbouring tiles. A dark line marks where a patch meets a different floor, and a grid shows while you paint.
- **Three.js (the default renderer).** `base-gl.js` reads that SVG in `buildFloor()`, the same way it reads the tape. It builds one mesh per material with a repeating texture, plus the edge lines and the grid.

## Textures

- `tools/cut-floor-tiles.py` turns the PromptQueue takes into textures.
  - Plain surfaces have their slow light falloff divided away.
  - Organic surfaces are blended with a half-shifted copy, so the edges tile.
  - Geometric patterns and lines are left as they were drawn.
- The output is `icons/Tiles/<id>.webp` (512 px) and `<id>-s.webp` (112 px, for the tray).
- The marble check is not in use, because its take doesn't tile.

## Not done yet

- **Cost:** every material is free while only the admin tests.
- **Soft blends:** the edge where two materials meet is a dark line, not a soft blend.
