"""render-levels.py: the levelled base items (MOSKE APP/Island/ITEM-LEVELS.md) from the two sides that show its front (the base turns items two ways, not four).

    node tools/decode-glb.mjs "<MOSKE APP>/Items/z_GLB MODELS/levels" <dec>
    GPU=1 ARGS="tools/render-items/rig.py|<dec>|<out>" blender -b --python tools/render-items/render-levels.py
    python tools/render-items/sheets2.py <out> <sheets dir>

Models are <item>-lv1.glb (MOSKE APP/Items/z_GLB MODELS/levels), renders <item>-lv1-a.png (the concept's angle) and -b.png (a quarter turn, the front still showing). Lit by the
map's sun, so the shadow falls as on the base. Run by MOSKE APP/Island/run-item-renders.ps1.
"""
import os, math
A = os.environ["ARGS"].split("|"); exec(open(A[0]).read())
DEC, OUT = A[1], A[2]
PPM = 420
# name: (size in metres, along: 'z' height or 'h' longest across, yaw for facing a)
ITEMS = {
    'treadmill-lv1': (1.9, 'h', 0),
    'pool-lv1': (4.0, 'h', 0),
    'ice-bath-lv1': (1.7, 'h', 0),
    'hot-tub-lv1': (2.2, 'h', 0),
    'massage-gun-lv1': (1.2, 'z', 0),
    'massage-table-lv1': (2.0, 'h', 0),
    'boots-lv1': (1.9, 'h', 0),
    'sauna-lv1': (2.3, 'z', 0),
    'float-pod-lv1': (2.5, 'h', 0),
    'contrast-plunge-lv1': (3.2, 'h', 0),
    'hydro-treadmill-lv1': (2.6, 'h', 0),
    'cryo-lv1': (2.3, 'z', 0),
    'hyperbaric-lv1': (3.0, 'h', 0),
    'antigrav-treadmill-lv1': (2.2, 'h', 0),
    'cone-stack-lv1': (0.9, 'z', 0),
    'agility-ladder-lv1': (3.0, 'h', 0),
    'kickboards-lv1': (0.9, 'z', 0),
    'hydration-table-lv1': (1.1, 'z', 0),
    'hurdles-lv1': (1.2, 'h', 0),
    'start-blocks-lv1': (0.9, 'h', 0),
    'pool-start-block-lv1': (0.8, 'z', 0),
    'buoy-bin-lv1': (0.9, 'z', 0),
    'shoe-wall-lv1': (2.0, 'z', 0),
    'towel-cart-lv1': (1.2, 'z', 0),
    'pool-bench-lv1': (1.6, 'h', 0),
    'fins-rack-lv1': (1.2, 'z', 0),
    'pool-shower-lv1': (2.3, 'z', 0),
    'diving-board-lv1': (2.8, 'h', 180),   # its concept is the other way round from the rest
    'pool-pace-clock-lv1': (1.8, 'z', 0),
    'watch-dock-lv1': (1.2, 'z', 0),
    'run-pace-clock-lv1': (2.0, 'z', 0),
    'finish-arch-lv1': (3.0, 'z', 0),
    'water-fountain-lv1': (1.1, 'z', 0),
    'podium-lv1': (2.2, 'h', 0),
    'legend-statue-lv1': (2.4, 'z', 0),
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
# items whose front is on the concept's other visible side: their second view turns the other way
OTHER_WAY = {'sauna', 'fins-rack', 'float-pod', 'hyperbaric', 'boots', 'diving-board'}
only = os.environ.get('ONLY')
os.makedirs(OUT, exist_ok=True)
for name, (size, axis, yaw_a) in ITEMS.items():
    if only and name not in only.split(','): continue
    src = f'{DEC}/{name}.glb'
    if not os.path.exists(src): continue
    # b turns whichever way keeps the item's front (door, shelves, clock face) in view
    for face, turn in (('a', 180), ('b', 270 if name[:-4] in OTHER_WAY else 90)):
        if os.path.exists(f'{OUT}/{name}-{face}.png'): continue
        reset(); root, ms = load(src)
        lo, hi = bounds(ms); ext = hi - lo
        s = size / (ext.z if axis == 'z' else max(ext.x, ext.y))
        root.scale = (s, s, s); bpy.context.view_layer.update()
        root.rotation_euler[2] = math.radians(yaw_a + turn); ground(root, ms)
        setup(ms, px_per_unit=PPM, samples=64, map_sun=True)
        if os.environ.get('GPU'): use_gpu()
        render(f'{OUT}/{name}-{face}.png')
        print('rendered', name, face, flush=True)
