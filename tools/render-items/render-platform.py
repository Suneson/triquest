"""render-platform.py: the base's raised platform (the locker room's stage), from the base's locked camera.

    ARGS="tools/render-items/rig.py|<decoded glb>|<out dir>|<samples>" [YAW=<deg>] [YAWS=1] \
        blender -b --python tools/render-items/render-platform.py

The model is scaled so its footprint's longest side is 34 units (the 32 x 32 floor plus its rim), so
one unit = one floor tile. YAWS=1 renders 0/90/180/270 to find the turn that puts the stairs on the
front-left face; YAW renders that one at full size, on transparent and on flat grey (for the repaint).
"""
import os, math, bpy
A = os.environ["ARGS"].split("|"); exec(open(A[0]).read())
# the new base map (map-navy) is drawn at an exact 2:1 angle, a touch steeper than the rooms' 0.489
SLOPE = float(os.environ.get("SLOPE", 0.5)); TILT = math.asin(SLOPE)
GLB, OUT, SAMPLES = A[1], A[2], int(A[3])
os.makedirs(OUT, exist_ok=True)
yaws = (0, 90, 180, 270) if os.environ.get('YAWS') else (int(os.environ.get('YAW', 0)),)
ppu = 30 if os.environ.get('YAWS') else int(os.environ.get('PPU', 100))
for yaw in yaws:
    reset(); root, ms = load(GLB)
    lo, hi = bounds(ms); ext = hi - lo
    s = 34 / max(ext.x, ext.y); root.scale = (s, s, s); bpy.context.view_layer.update()
    root.rotation_euler[2] = math.radians(yaw); ground(root, ms)
    lo, hi = bounds(ms); print('size', [round(v, 2) for v in (hi - lo)], flush=True)
    setup(ms, px_per_unit=ppu, samples=SAMPLES, margin=0.03)
    render(f'{OUT}/platform-y{yaw}.png')
    if not os.environ.get('YAWS'):
        sc = bpy.context.scene; sc.render.film_transparent = False
        sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.62, 0.62, 0.62, 1)
        render(f'{OUT}/platform-y{yaw}-grey.png')
