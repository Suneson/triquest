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
