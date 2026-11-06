# Handoff: the base items and rooms (Nov 5, 2026)

This picks up the work of a cloud Claude session in a new one. Read `CLAUDE.md`, `docs/ART-DIRECTION.md` and `docs/ITEMS-3D.md` first.

## Where things stand

- **Repo:** `Suneson/triquest` (MOSKE, a vanilla JS app with no build step).
- **Merged:** everything up to and including #60: the batch-2 items, the stash, the item menu, the trophy cabinets, and the repainted 16 × 16 locker room with its taped preview.
- **Live on Supabase:** `0031_base_items.sql`. `albertosuneson` has a row in `user_base_items` for each of the 22 new items, for testing. Nobody else has any yet.
- **Not decided yet:** how players get the new items. They aren't in a shop or a reward.

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

## In the app (batch 2)

- **New items:** `stashed()` in `js/core/placement.js`. They start in the stash, owned through `user_base_items`. Items cut with `tools/render-items/cutout-green.py`.
- **The menu:** `[data-dg-menu]` in `js/app/diorama-view.js`, shown for the picked-up item: Rotate, Stash, and Display or Mission board where it opens something.
- **The stash:** the Stash tab in `openInventory` (`js/app/gear-view.js`). `user_placements.stashed` keeps an item out of the room. Place sets it down in the room on the stage.
- **Trophy cabinets:** `js/app/trophy-display-view.js`. Tier 1 shows 5, tier 2 shows 10, and the best cabinet standing counts. The choice is `settings.trophyDisplay`, ready for when other people's bases can be opened. Admins and the demo can pick any trophy.
- **Treadmill:** 4 tiers (run room levels 1, 4, 7, 10), console towards the camera. One runner at a time: on the treadmill you've picked up, else the first in the room.

## Next steps

1. **Rooms:** `docs/ROOMS-16-NEXT.md` has the prompts and the order. The taped room is admin-only until all five rooms have their pictures.
2. **Fix the clipped shadows on the first batch** (`setup()` in `rig.py` frames the object's box only). The cut-out fades shadows out with distance, which hides it in batch 2.
3. **Decide how players get the new items.** A shop tab or rewards, then grants through `user_base_items`.
4. **Base visits:** when they come, read another player's `settings.trophyDisplay`. That needs its own read policy; `profiles.settings` shouldn't be opened up whole.
5. **Later:** bake the railing in place of the old painted one (optional).

## Notes

- The Gemini key is never in the repo (`CLAUDE.md`).
- The user has a local Claude Code with the Photoshop MCP (`claude remote-control` in `C:\Users\alber\triquest`).
