"""render-base-assets.py: the single-plot base's models (huts, pads, pool, stadium, club house ...) from the new
base map's camera (an exact 2:1 angle, SLOPE 0.5; the item rig's is 0.489).

    node tools/decode-glb.mjs "<MOSKE APP>/Items/z_GLB MODELS/map assets/11-19" <dec>
    MSYS2_ENV_CONV_EXCL=ARGS GPU=1 ARGS="tools/render-items/rig.py|<dec>|<out>|<samples>" \
        blender -b --python tools/render-items/render-base-assets.py

One unit = one base tile (the map's lawn is 48 x 48 of them). Each model is scaled so its footprint's longest
side is the tiles below, then rendered facing a (its front down-left) and b (a quarter turn on) as
<name>-a.png / -b.png. YAWS=1 renders 0/90/180/270 small to find each front; ONLY=a,b for some.
"""
import os, math, bpy
A = os.environ["ARGS"].split("|"); exec(open(A[0]).read())
SLOPE = float(os.environ.get("SLOPE", 0.5)); TILT = math.asin(SLOPE)
DEC, OUT, SAMPLES = A[1], A[2], int(A[3])
PPU = int(os.environ.get('PPU', 100))
# name: (longest footprint side in tiles, yaw that puts the front down-left)
ITEMS = {
    'hut-navy-blue': (3.4, 180), 'hut-navy-red': (3.4, 180), 'hut-navy-green': (3.4, 180), 'hut-navy-gold': (2.9, 180),
    'pad-navy-blue': (4.0, 180), 'pad-navy-red': (4.0, 180), 'pad-navy-green': (4.0, 180), 'pad-navy-gold': (3.4, 180),
    'pool-navy': (18.0, 0), 'stadium-club': (20.0, 180), 'clubhouse-modern': (14.0, 180),
    'race-gantry': (5.0, 0), 'race-board': (3.0, 90), 'build-site': (4.0, 0),
    'delivery-van': (5.0, 180), 'jetty-boat': (8.0, 90),
}
FACES = {k: int(v) for k, v in (x.split(':') for x in os.environ.get('FACE', '').split(',') if x)}
only = [x for x in os.environ.get('ONLY', '').split(',') if x]
os.makedirs(OUT, exist_ok=True)


def use_gpu():
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for kind in ('OPTIX', 'CUDA'):
        try: prefs.compute_device_type = kind
        except TypeError: continue
        prefs.get_devices()
        if any(d.type == kind for d in prefs.devices):
            for d in prefs.devices: d.use = d.type == kind
            bpy.context.scene.cycles.device = 'GPU'; return


for name, (tiles, yaw_a) in ITEMS.items():
    if only and name not in only: continue
    yaw_a = FACES.get(name, yaw_a)
    views = [(f'y{y}', y) for y in (0, 90, 180, 270)] if os.environ.get('YAWS') else [('a', yaw_a), ('b', yaw_a + 90)]
    for face, yaw in views:
        out = f'{OUT}/{name}-{face}.png'
        if os.path.exists(out) and not os.environ.get('ANCHORS'): continue
        reset(); root, ms = load(f'{DEC}/{name}.glb')
        lo, hi = bounds(ms); ext = hi - lo
        s = tiles / max(ext.x, ext.y); root.scale = (s, s, s); bpy.context.view_layer.update()
        root.rotation_euler[2] = math.radians(yaw); ground(root, ms)
        cam = setup(ms, px_per_unit=30 if os.environ.get('YAWS') else PPU, samples=SAMPLES)
        # where the footprint's middle (the world's origin, on the ground) lands in the picture, in px
        from bpy_extras.object_utils import world_to_camera_view
        sc = bpy.context.scene; p = world_to_camera_view(sc, cam, Vector((0, 0, 0)))
        import json
        with open(out[:-4] + '.json', 'w') as f:
            json.dump({'w': sc.render.resolution_x, 'h': sc.render.resolution_y, 'ox': round(p.x * sc.render.resolution_x, 1),
                       'oy': round((1 - p.y) * sc.render.resolution_y, 1), 'tiles': tiles, 'ppu': PPU}, f)
        if os.environ.get('ANCHORS'): continue
        if os.environ.get('GPU'): use_gpu()
        render(out)
        print('rendered', name, face, flush=True)
