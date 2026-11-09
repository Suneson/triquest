# render-island.py: the market stand and the three recovery items, from the base's locked camera.
# Run with Blender itself (bpy isn't needed in Python):
#   ARGS="tools/render-items/rig.py|<decoded glb dir>|<out dir>|<samples>" blender -b -P tools/render-items/render-island.py
# Then tools/render-items/sheets.py puts each pair on a green sheet for repainting.
import os, math
A = os.environ["ARGS"].split("|"); exec(open(A[0]).read())
RAW, OUT, SAMPLES = A[1], A[2], int(A[3])
ONLY = [x for x in os.environ.get("ONLY", "").split(",") if x]
PPM = 620     # px per unit: every model is scaled so its longest side is 2 units
# name: (file, facing yaws: a = front down-left, b = down-right)
ITEMS = {
    'market-stand': ('market stand', (90, 0)),
    'sauna': ('Sauna', (90, 0)),
    'compression-boots': ('compression boots', (90, 0)),
    'massage-gun': ('massage gun 3d model', (90, 0)),
}
for name, (model, yaws) in ITEMS.items():
    if ONLY and name not in ONLY: continue
    for face, yaw in zip('ab', yaws):
        reset(); root, ms = load(f'{RAW}/{model}.glb')
        lo, hi = bounds(ms); s = 2 / max(hi - lo)
        root.scale = (s, s, s); bpy.context.view_layer.update()
        root.rotation_euler[2] = math.radians(yaw); ground(root, ms)
        setup(ms, px_per_unit=PPM, samples=SAMPLES)
        render(f'{OUT}/{name}-{face}.png')
