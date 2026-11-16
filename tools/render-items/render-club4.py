"""render-club4.py: every club room item from all four sides, for items that turn four ways.

    node tools/decode-glb.mjs "<MOSKE APP>/Items/z_GLB MODELS/club" <dec>      # Tripo's meshopt GLBs
    GPU=1 ARGS="tools/render-items/rig.py|<dec>|<out>" blender -b --python tools/render-items/render-club4.py
    python tools/render-items/sheets4.py <out> <sheets dir>

Writes <out>/<name>-a.png .. -d.png. Facing a has the item's front towards the bottom left, b is a
quarter turn from it, c the back of a (half a turn) and d the back of b. a and b are rendered
exactly as render-batch3.py did, so earlier renders of them can be dropped in <out> and are kept.
Names carry clan- as their concept art does (Characters/Photos/Robots/Robots/Items/Clan).
"""
import os, math, glob
A = os.environ["ARGS"].split("|"); exec(open(A[0]).read())
DEC, OUT = A[1], A[2]
PPM = 420
# name: (file id start, size in metres, along: 'z' height or 'h' longest across, yaw for facing a)
ITEMS = {
        'clan-coffee-cart': ('1678b84e', 1.7, 'h', 90),
        'clan-bar-counter-corner': ('24402d39', 1.1, 'z', 90),
        'clan-high-table': ('2693d4ca', 1.05, 'z', 0),
        'clan-grandfather-clock': ('38efcb13', 2.1, 'z', 90),
        'clan-bookcase': ('397a645d', 2.2, 'z', 90),
        'clan-jukebox': ('5032503d', 1.6, 'z', 0),
        'clan-champagne-bucket': ('63e6ed83', 0.45, 'z', 0),
        'clan-decanters': ('71a05468', 0.4, 'z', 0),
        'clan-globe-bar': ('7cb983ae', 1.0, 'z', 0),
        'clan-coffee-table': ('8093fecc', 1.4, 'h', 0),
        'clan-bar-stool': ('8104b93f', 0.85, 'z', 0),
        'clan-leather-bench': ('821d4488', 1.7, 'h', 0),
        'clan-cake-stand': ('8a8c5941', 0.45, 'z', 90),
        'clan-espresso-machine-vintage': ('8d6a99ee', 0.55, 'z', 90),
        'clan-brass-till': ('927dd7f2', 0.45, 'z', 90),
        'clan-corner-sofa': ('9e3efea7', 2.8, 'h', 0),
        'clan-fireplace': ('a4289008', 1.8, 'h', 90),
        'clan-chess-table': ('b04db159', 0.95, 'h', 90),
        'clan-floor-lamp': ('b61c5961', 1.7, 'z', 0),
        'clan-cocktail-station': ('c07fb677', 0.5, 'z', 0),
        'clan-card-table': ('c27ed928', 1.6, 'h', 0),
        'clan-bar-counter-long': ('c2846f6c', 3.6, 'h', 0),
        'clan-chesterfield-sofa': ('c2983e6b', 2.4, 'h', 0),
        'clan-cue-rack': ('dd004635', 1.7, 'z', 0),
        'clan-arcade-cabinet': ('e30d93f3', 1.8, 'z', 90),
        'clan-beer-tap': ('e376739c', 0.55, 'z', 0),
        'clan-darts-board': ('ed029b99', 1.9, 'z', 90),
        'clan-gramophone': ('ef7056bd', 1.1, 'z', 90),
        'clan-chesterfield-armchair': ('fc1c36d1', 0.85, 'z', 90),
        'clan-back-bar-shelves': ('fd4f902d', 2.2, 'z', 0),
        'clan-trophy-cabinet': ('009f24bb', 2.0, 'z', 0),
        'clan-persian-rug': ('0e4c262b', 2.6, 'h', 0),
        'clan-side-table': ('10156793', 0.75, 'z', 0),
        'clan-upright-piano': ('19662843', 1.35, 'z', 90),
        'clan-potted-palm': ('1d126956', 1.7, 'z', 0),
        'clan-pinball-machine': ('4d11428f', 1.8, 'z', 0),
        'clan-tartan-rug': ('59a40c3a', 2.4, 'h', 0),
        'clan-phone-box': ('6cbc8b7c', 2.4, 'z', 0),
        'clan-penny-farthing': ('8f4d6c15', 1.6, 'z', 0),
        'clan-ottoman': ('9248032f', 0.5, 'z', 0),
        'clan-wingback-chair': ('93a674d0', 1.15, 'z', 0),
        'clan-table-football': ('bd770495', 1.4, 'h', 0),
        'clan-shuffleboard': ('c0295b50', 3.0, 'h', 0),
        'clan-pool-table': ('d92e3281', 2.6, 'h', 0),
}
def use_gpu():
    # GPU=1: Cycles on the graphics card (OptiX, else CUDA), several times faster than the CPU
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

only = os.environ.get('ONLY')
os.makedirs(OUT, exist_ok=True)
for name, (fid, size, axis, yaw_a) in ITEMS.items():
    if only and name not in only.split(','): continue
    src = glob.glob(f'{DEC}/*{fid}*.glb')
    assert len(src) == 1, (name, src)
    for face, turn in (('a', 0), ('b', 90), ('c', 180), ('d', 270)):
        if os.path.exists(f'{OUT}/{name}-{face}.png'): continue
        reset(); root, ms = load(src[0])
        lo, hi = bounds(ms); ext = hi - lo
        s = size / (ext.z if axis == 'z' else max(ext.x, ext.y))
        root.scale = (s, s, s); bpy.context.view_layer.update()
        root.rotation_euler[2] = math.radians(yaw_a + turn); ground(root, ms)
        setup(ms, px_per_unit=PPM, samples=64)
        if os.environ.get('GPU'): use_gpu()
        render(f'{OUT}/{name}-{face}.png')
        print('rendered', name, face, flush=True)
