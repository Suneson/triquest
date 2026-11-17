# Rendering the base items (docs/ITEMS-3D.md)

These scripts render the Tripo models in `art/items/glb/` from the base's locked camera, using Blender's Python module (`bpy`, Cycles on the CPU).

- **Camera:** orthographic, 45° round, tilted so a floor edge rises 0.489 px per px across. That's the 16 × 16 rooms' slope (`rig.py`).
- **Lights:** neutral white. A key sun from the top left, a soft fill from behind on the right, and a grey sky light. The first batch was rendered with a warm key and a cool rim.
- **Shadow:** a shadow-catcher floor gives each item a real contact shadow on a transparent background.
- **Scale:** every item is sized in metres (`ITEMS` in `render.py`) and rendered at the same 420 px per metre.
- **Facings:** two per item, turned 90°. Facing `a` has its front down-left, `b` down-right.
- **Rollers:** `road-bike-rollers-t1` is built from two models. The road bike stands on the balance rollers (turned 180° and scaled 0.772), with the front wheel on the single drum and the back wheel between the pair.

## Running it

```sh
pip install bpy==5.0.1                                   # Python 3.11
npx -p @gltf-transform/cli gltf-transform copy in.glb out.glb   # once per model: Blender can't read meshopt
ARGS="tools/render-items/rig.py|<decoded glb dir>|<out dir>" \
  python -c "import sys,os; sys.argv=['x']; exec(open('tools/render-items/render.py').read())"
```

- **Step 2 (decoding):** Tripo's GLBs are meshopt-compressed. The `copy` decodes them into plain glTF.
- **Step 3 (rendering):** bpy reads `sys.argv` as Blender's own arguments, so the paths go in `ARGS`.

## Retexturing

`RETEXTURE-PROMPT.md` is the Gemini prompt that repaints a grey-background render while keeping its exact outline. The repainted picture is then cut out with the render's own alpha.

## Batches

- **`render.py`:** the first nine models.
- **`render-batch2.py`:** the second batch.
  - It holds 15 new models and the treadmills (t1 to t3) again, now facing with their console towards the camera, so the runner faces it.
  - Set `ONLY=<name>,<name>` to render just some of them.
- **`render-batch3.py`:** the clan room's 30 items and 23 new base items (gym, smoothie bars, pool, trophies), from the 14 Nov Tripo GLBs.
  - Decode them first with `node tools/decode-glb.mjs <in.glb> <out.glb>` into `<dec>/club` and `<dec>/base`, then run Blender itself: `ARGS="tools/render-items/rig.py|<dec>|<out>" blender -b --python tools/render-items/render-batch3.py`.
  - Models are found by the start of Tripo's file id; names match the concept art they were made from, so each sheet goes to Gemini with its reference (`RETEXTURE-PROMPT.md`, "Items with a concept picture").
- **`render-club4.py`:** the club room's 44 items from all four sides, for items that turn four ways.
  - Facing `a` and `b` are as in batch 3; `c` is the back of `a`, `d` the back of `b`. Renders already in the out folder are kept, so batch 3's `a` and `b` can be dropped in.
  - `GPU=1` renders on the graphics card (OptiX), about 10 s a view instead of 30 s.
  - `sheets4.py <renders> <sheets>` puts the four on one 2048 × 2048 sheet, two by two (a b / c d), at one scale, with a `.json` of where each view sits for cutting the repaint back apart. The repaint prompt is `PromptQueue Prompts/repaint-club-4-sides.csv`, with each item's concept art.
- **`cutout-club4.py`:** cuts the repainted four-side sheets (`MOSKE APP/Characters/Photos/Robots/Robots/Repaint/club-4`) into `icons/Items/<item>-a.webp` .. `-d.webp`.
  - Where an item was repainted more than once (`_v2`, `_v3`), the latest is used.
  - The club items have `sides: 4` in `js/core/placement.js`: rotate goes a, b, c, d. Set an item's `sides` to 2 or 1 if its back views are wrong.
- **`render-grounds.py`:** the club grounds' models (`Items/z_GLB MODELS/map assets` and `crates`): the club house, kiosk, boat, motorbike, pantry, smoothie bar and the seven crates.
  - `YAWS=1` renders every model at four turns, to find its front.
  - `tools/cut-grounds.py cut <map> <renders>` puts the club house, kiosk and boat on the map; `renders-to-webp.py <renders>` makes the rest into pictures (`icons/Items`, `icons/Crates`, `icons/Island`), not repainted yet.
