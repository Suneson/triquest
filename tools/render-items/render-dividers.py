"""render-dividers.py: the club room's dividers (CLUB-ROOM-PLAN.md step 2) from all four sides, as render-club4.py.

    node tools/decode-glb.mjs "<MOSKE APP>/Items/z_GLB MODELS/club" <dec>
    GPU=1 ARGS="tools/render-items/rig.py|<dec>|<out>" blender -b --python tools/render-items/render-dividers.py
    python tools/render-items/sheets4.py <out> <sheets dir>

The models are named as their concept art (Characters/Photos/Robots/Robots/Items/club/<name>.png).
"""
import os, math
A = os.environ["ARGS"].split("|"); exec(open(A[0]).read())
DEC, OUT = A[1], A[2]
PPM = 420
# name: (size in metres, along: 'z' height or 'h' longest across, yaw for facing a)
ITEMS = {
    'club-half-wall': (1.1, 'z', 0),
    'club-half-wall-corner': (1.1, 'z', 0),
    'club-arch-wall': (2.6, 'z', 0),
    'club-doorway-wall': (2.6, 'z', 0),
    'club-pillar': (2.6, 'z', 0),
    'club-bookcase-divider': (2.1, 'z', 0),
    'club-planter-divider': (1.3, 'z', 0),
    'club-folding-screen': (1.8, 'z', 0),
    'club-rope-posts': (1.0, 'z', 0),
    'club-dais': (2.4, 'h', 0),
}
def use_gpu():
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for kind in ('OPTIX', 'CUDA'):
        try: prefs.compute_device_type = kind
        except TypeError: continue
        prefs.get_devices()
        if [d for d in prefs.devices if d.type == kind]:
            for d in prefs.devices: d.use = d.type == kind
            bpy.context.scene.cycles.device = 'GPU'
            return kind
only = os.environ.get('ONLY')
os.makedirs(OUT, exist_ok=True)
for name, (size, axis, yaw_a) in ITEMS.items():
    if only and name not in only.split(','): continue
    src = f'{DEC}/{name}.glb'
    for face, turn in (('a', 0), ('b', 90), ('c', 180), ('d', 270)):
        if os.path.exists(f'{OUT}/{name}-{face}.png'): continue
        reset(); root, ms = load(src)
        lo, hi = bounds(ms); ext = hi - lo
        s = size / (ext.z if axis == 'z' else max(ext.x, ext.y))
        root.scale = (s, s, s); bpy.context.view_layer.update()
        root.rotation_euler[2] = math.radians(yaw_a + turn); ground(root, ms)
        setup(ms, px_per_unit=PPM, samples=64)
        if os.environ.get('GPU'): use_gpu()
        render(f'{OUT}/{name}-{face}.png')
        print('rendered', name, face, flush=True)
