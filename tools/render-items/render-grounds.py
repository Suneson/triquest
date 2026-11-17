"""render-grounds.py: the club grounds' models (map assets and crates), from the base's locked camera.

    node tools/decode-glb.mjs "<MOSKE APP>/Items/z_GLB MODELS/map assets" <dec>/map
    node tools/decode-glb.mjs "<MOSKE APP>/Items/z_GLB MODELS/crates" <dec>/crates
    GPU=1 ARGS="tools/render-items/rig.py|<dec>|<out>|<samples>" blender -b --python tools/render-items/render-grounds.py

Writes <out>/<name>-a.png and -b.png (facing a: the model's front towards the bottom left, b a
quarter turn on). Set ONLY=<name>,<name> for some, YAWS=1 to render every model at 0/90/180/270
(<name>-y0.png ..) to find its front. Renders already in <out> are kept.
"""
import os, math
A = os.environ["ARGS"].split("|"); exec(open(A[0]).read())
DEC, OUT, SAMPLES = A[1], A[2], int(A[3])
PPM = int(os.environ.get("PPM", 420))
# name: (folder/file, size in metres, along: 'z' height or 'h' longest across, yaw for facing a)
ITEMS = {
    'clubhouse-L4': ('map/clubhouse-L4', 6.0, 'z', 180),
    'shop-kiosk-L1': ('map/shop-kiosk-L1', 3.0, 'z', 180),
    'delivery-boat': ('map/delivery-boat', 6.0, 'h', 90),
    'delivery-motorbike': ('map/delivery-motorbike', 2.0, 'h', 180),
    'room-pantry': ('map/room-pantry', 2.1, 'z', 180),
    'room-smoothie-bar': ('map/room-smoothie-bar', 1.6, 'z', 180),
    'crate-z1-recovery': ('crates/crate-z1-recovery', 0.7, 'h', 90),
    'crate-z2-endurance': ('crates/crate-z2-endurance', 0.75, 'h', 90),
    'crate-z3-tempo': ('crates/crate-z3-tempo', 0.8, 'h', 90),
    'crate-z4-threshold': ('crates/crate-z4-threshold', 0.85, 'h', 90),
    'crate-z5-max': ('crates/crate-z5-max', 0.9, 'h', 90),
    'crate-item-delivery': ('crates/crate-item-delivery', 0.8, 'h', 0),
    'box-clothes-delivery': ('crates/box-clothes-delivery', 0.8, 'h', 0),
}
FACES = {k: int(v) for k, v in (x.split(':') for x in os.environ.get('FACE', '').split(',') if x)}


def use_gpu():
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for kind in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = kind
        except TypeError:
            continue
        prefs.get_devices()
        devs = [d for d in prefs.devices if d.type == kind]
        if devs:
            for d in prefs.devices: d.use = d.type == kind
            bpy.context.scene.cycles.device = 'GPU'
            return kind
    return None


only = [x for x in os.environ.get('ONLY', '').split(',') if x]
os.makedirs(OUT, exist_ok=True)
for name, (src, size, axis, yaw_a) in ITEMS.items():
    if only and name not in only: continue
    yaw_a = FACES.get(name, yaw_a)
    views = [(f'y{y}', y) for y in (0, 90, 180, 270)] if os.environ.get('YAWS') else [('a', yaw_a), ('b', yaw_a + 90)]
    for face, yaw in views:
        out = f'{OUT}/{name}-{face}.png'
        if os.path.exists(out): continue
        reset(); root, ms = load(f'{DEC}/{src}.glb')
        lo, hi = bounds(ms); ext = hi - lo
        s = size / (ext.z if axis == 'z' else max(ext.x, ext.y))
        root.scale = (s, s, s); bpy.context.view_layer.update()
        root.rotation_euler[2] = math.radians(yaw); ground(root, ms)
        setup(ms, px_per_unit=PPM, samples=SAMPLES)
        if os.environ.get('GPU'): use_gpu()
        render(out)
        print('rendered', name, face, flush=True)
