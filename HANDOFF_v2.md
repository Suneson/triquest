# Handoff: the base items and rooms (Nov 5, 2026)

This picks up the work of a cloud Claude session in a new one. Read `CLAUDE.md`, `docs/ART-DIRECTION.md` and `docs/ITEMS-3D.md` first.

## Where things stand

- **Repo:** `Suneson/triquest` (MOSKE, a vanilla JS app with no build step). The user merges PRs only when they say "merge".
- **Merged:**
  - **#55:** the original painted trees and lamps round the markets.
  - **#56:** the iPhone crash fix: no city-sized layers over a 3D canvas, and `webglOk()` caches its answer.
  - **#57:** the lobby seams cleaned up in Photoshop.
  - **#58:** `docs/ITEMS-3D.md`.
  - **#59:** the first 9 base items in the app, with two facings and a rotate button.
- **Open: PR #60** (`feature/items-batch2`), green but not merged. The user wants everything below added before it's merged. It has:
  - bigger footprints: treadmill 3×2 (it starts facing b, 2×3), rollers bike 2×3, coffee machine 2×2;
  - the runner scaling with the treadmill;
  - the 15 new models in `art/items/glb/`;
  - neutral render light;
  - the green-screen repaint prompt;
  - this note.

## The pipeline (the decisions made)

1. **Concept:** the user makes a concept image in Gemini (prompts in `docs/ITEMS-3D.md`).
2. **Model:** the user turns it into a model in Tripo (HD Model, V3.1, PBR on, 2K texture, about 200k polygons) and exports a GLB.
3. **Render (Claude):** in Blender, with `tools/render-items/`.
   - Locked orthographic camera, 45° round, slope 0.489 (the 16×16 rooms). 420 px per metre, real-world sizes, neutral white light, a shadow catcher.
   - Two facings: a (front down-left) and b (turned 90°, front down-right). No back views: never 4 angles.
4. **Sheet (Claude):** one sheet per item, a | b side by side on green, 2048×1024 (`sheets.py`).
5. **Repaint:** the user repaints the sheet in Gemini with `tools/render-items/RETEXTURE-PROMPT.md`.
6. **Cut out (Claude):**
   - Green: `key_green` in `tools/cut-art.py`. Grey: `cutout-grey.py`, from the first batch.
   - Split each sheet into a and b, then export `icons/Items/<item>-<a|b>.webp` (720 px max, webp q88).
   - Run `tools/measure-items.py`, which measures alpha above 200 for `icons/Items`.

### Blender setup

- Install: `pip install bpy==5.0.1` into a Python 3.11 venv.
- Tripo GLBs are meshopt-compressed. Decode each once: `npx -p @gltf-transform/cli gltf-transform copy in.glb out.glb`.
- bpy reads `sys.argv` as its own arguments, so pass paths in the `ARGS` environment variable:
  `ARGS="tools/render-items/rig.py|<decoded dir>|<out>" python -c "import sys,os; sys.argv=['x']; exec(open('tools/render-items/render-batch2.py').read())"`
- Each model's facing yaws are in the `ITEMS` table of `render.py` and `render-batch2.py`. The treadmills are now (270, 0), console towards the camera, so the runner faces the camera.

## In the app

- **Items:** `PLACEABLES` in `js/core/placement.js`.
  - `faces: true`, plus a default `face`. `w × h` is the footprint for facing a; `orient(item, face)` swaps it for b. `tierFor(level, bands)` picks the tier.
  - Coffee machine: t1–t3 by the locker room's level (t2 from 4, t3 from 7). Treadmill: t1–t2 by the run room's level (t2 from 5; t3 is now modelled).
- **Rotate button:** `[data-dg-rot]` in `js/app/diorama-view.js`, with `icons/UI/rotate.webp` from Gemini.
- **Saving the facing:** in `user_placements.face` (`0030_placement_face.sql`, applied live to the Supabase project `vopzemijzoxezathmrai`).
- **Runner:** `mountRunner(…, { spot, foot })` in `js/app/runner3d.js`, using each item's `runner` per facing (u, v, yaw, y, scale).

## Next steps

1. **Fix the clipped shadows.** `setup()` in `rig.py` frames the camera on the object's box only, so the shadow (falling left) gets cut off.
   - Widen the frame to the shadow's reach.
   - Re-render each item's shadow on its own (shadow catcher only).
   - From the user's repaint keep only the object (drop the painted shadow), align it to the render (scale and offset to the render's object box; this matched 93–99% before), and put the render's shadow under it.
2. **When the repainted sheets come back (17):** cut out, split into a and b, and add to `icons/Items/` and `PLACEABLES`.
   - **Locker room:** locker row, drinks fridge, massage table, recovery chair, ice bath, trophy cabinets t1 and t2.
   - **Gym:** dumbbell rack, kettlebell set, punching bag, rowing machine.
   - **Run room:** race podium, shoe display.
   - **Bike room:** bike workstand.
   - **Treadmills t1–t3:** these replace the current treadmill pictures. Set their runner `yaw` to face the camera; they were made for a console at the back.
   - Give each item a footprint (clickable, upgradable ones 2×2, big machines 2×3) and names in both locales (`cp.item.*`).
   - Bump `sw.js` and update the tests and docs. Then the user says merge.
3. **Rooms:**
   - The user is repainting the 16×16 locker room (`icons/Pixelart/NEW/LOCKER/model-10.webp`, 2200×1610). The prompt asks for a rubber-tile floor instead of the wooden one.
   - If it's good, the proposal is to drop the 8×8 rooms and make every room 16×16:
     - 3 versions per room (broken for levels 1–3, repaired 4–6, finished 7–10): 15 models and 15 repaints in all;
     - the floor taped off outside the middle 8×8 until Expand is bought;
     - one camera for every room.
4. **Later:** bake the railing in place of the old painted one (optional).

## Notes

- The Gemini key is never in the repo (`CLAUDE.md`).
- The user has a local Claude Code with the Photoshop MCP (`claude remote-control` in `C:\Users\alber\triquest`).
