"""render-levels.py: the levelled base items (MOSKE APP/Island/ITEM-LEVELS.md), squared to the floor grid, at the four
grid turns, lit by the map's sun; the two that show each item's front are picked in VIEWS (by eye) for the sheets.

    node tools/decode-glb.mjs "<MOSKE APP>/Items/z_GLB MODELS/levels" <dec>
    GPU=1 ARGS="tools/render-items/rig.py|<dec>|<out>" blender -b --python tools/render-items/render-levels.py
    python tools/render-items/sheets2.py <out> <sheets dir>

Each model is first levelled (its base plane tilted flat, when Tripo left it a few degrees off) and squared (turned so
its footprint's sides run along the grid). Then <item>-lv1-t0/t90/t180/t270.png, and for the items in VIEWS the
chosen two copied to <item>-lv1-a.png (as its concept) and -b.png (a quarter turn, the front still showing).
Run by MOSKE APP/Island/run-item-renders.ps1.
"""
import os, math, shutil
import numpy as np
from mathutils import Vector, Matrix, Quaternion
A = os.environ["ARGS"].split("|"); exec(open(A[0]).read())
DEC, OUT = A[1], A[2]
PPM = 420
# name: (size in metres, along: 'z' height or 'h' longest across, unused)
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

# the two turns (degrees) that show each item's front: (as its concept, a quarter turn from it). Picked by eye from
# the four t* renders; an item missing here gets only those.
# the two turns that show each front (t180 is the concept view; the other is the turn that brings the
# front round to the other side), picked by eye
VIEWS = {
    'agility-ladder': (180, 270),
    'antigrav-treadmill': (180, 270),
    'boots': (180, 270),
    'buoy-bin': (180, 270),
    'cone-stack': (180, 270),
    'contrast-plunge': (180, 90),
    'cryo': (180, 90),
    'diving-board': (180, 270),
    'finish-arch': (180, 90),
    'fins-rack': (180, 270),
    'float-pod': (180, 270),
    'hot-tub': (180, 270),
    'hurdles': (180, 90),
    'hydration-table': (180, 270),
    'hydro-treadmill': (180, 90),
    'hyperbaric': (180, 270),
    'ice-bath': (180, 90),
    'kickboards': (180, 90),
    'legend-statue': (180, 270),
    'massage-gun': (180, 270),
    'massage-table': (180, 90),
    'podium': (180, 90),
    'pool': (180, 270),
    'pool-bench': (180, 270),
    'pool-pace-clock': (180, 90),
    'pool-shower': (180, 90),
    'pool-start-block': (180, 90),
    'run-pace-clock': (180, 90),
    'sauna': (180, 270),
    'shoe-wall': (180, 90),
    'start-blocks': (180, 270),
    'towel-cart': (180, 90),
    'treadmill': (180, 270),
    'watch-dock': (180, 90),
    'water-fountain': (180, 270),
}
# pitch/roll (degrees) by hand where the floor check gets it wrong; others are levelled by contact()
LEVEL = {'agility-ladder': (2.75, -4.25)}   # flat rungs: too thin for contact() to read

def world_verts(ms):
    bpy.context.view_layer.update()
    out = []
    for o in ms:
        m = np.array(o.matrix_world)
        v = np.empty(len(o.data.vertices) * 3); o.data.vertices.foreach_get('co', v); v = v.reshape(-1, 3)
        out.append(v @ m[:3, :3].T + m[:3, 3])
    return np.concatenate(out)

def hull(p):
    p = np.unique(np.round(p, 4), axis=0); p = p[np.lexsort((p[:, 1], p[:, 0]))]
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for q in p:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], q) <= 0: lo.pop()
        lo.append(q)
    for q in p[::-1]:
        while len(up) >= 2 and cross(up[-2], up[-1], q) <= 0: up.pop()
        up.append(q)
    return np.array(lo[:-1] + up[:-1])

def area_at(h, a):
    c, s = math.cos(a), math.sin(a); r = h @ np.array([[c, -s], [s, c]])
    return np.ptp(r[:, 0]) * np.ptp(r[:, 1])

def rotm(pitch, roll):
    cx, sx, cy, sy = math.cos(pitch), math.sin(pitch), math.cos(roll), math.sin(roll)
    return np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]]) @ np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])

def contact(v, R):
    """How much of the footprint rests on the floor: the hull of the points within 1.5% of the bottom over the
    whole footprint's hull. A level table or box is near 1; one stood over on an edge is near 0."""
    w = v @ R.T; z = w[:, 2]; low = w[z < z.min() + 0.015 * np.ptp(z), :2]
    if len(low) < 3: return 0.0
    def ar(h): return 0.5 * abs(np.dot(h[:, 0], np.roll(h[:, 1], 1)) - np.dot(h[:, 1], np.roll(h[:, 0], 1)))
    try: return ar(hull(low)) / ar(hull(w[:, :2]))
    except Exception: return 0.0

def straighten(root, ms, name):
    """Level the model (Tripo sometimes stands a piece a few degrees over, on one edge) and square its footprint to
    the grid; returns the rotation. Level: the tilt that sets the most of its footprint down on the floor (contact),
    taken when it rests clearly better than as it came. Square: the yaw that fits the footprint in the smallest
    grid rectangle."""
    v = world_verts(ms); v = v[::max(1, len(v) // 1500)]; v = v - v.mean(0)
    c0 = contact(v, np.eye(3)); bc = (c0, 0.0, 0.0)
    for step, span, c in ((1, 25, (0, 0)), (0.25, 1, None)):
        c = c or (bc[1], bc[2])
        for p in np.arange(c[0] - span, c[0] + span + 1e-6, step):
            for r in np.arange(c[1] - span, c[1] + span + 1e-6, step):
                k = contact(v, rotm(math.radians(p), math.radians(r)))
                if k > bc[0] + 1e-6: bc = (k, p, r)
    print(f'floor {name}: rests {c0:.2f} as it came; best {bc[0]:.2f} at pitch {bc[1]:.2f}, roll {bc[2]:.2f}', flush=True)
    if os.environ.get('DIAG'): return None
    rot = Quaternion()
    p_, r_ = LEVEL.get(name[:-4], (bc[1], bc[2]) if bc[0] > c0 + 0.15 else (0, 0))
    if p_ or r_:
        rot = Matrix(rotm(math.radians(p_), math.radians(r_)).tolist()).to_quaternion()
        print(f'level {name}: pitch {p_}, roll {r_}', flush=True)
    R = np.array(rot.to_matrix()); w = world_verts(ms) @ R.T
    hp = hull(w[::max(1, len(w) // 40000), :2])
    sq = min((area_at(hp, math.radians(d / 4)), d / 4) for d in range(-180, 181))
    if sq[0] < 0.97 * area_at(hp, 0) and abs(sq[1]) > 0.5:
        rot = Quaternion((0, 0, 1), -math.radians(sq[1])) @ rot   # area_at turns the hull by -a, so undo +a
        print(f'square {name}: {sq[1]:.1f} deg', flush=True)
    return rot

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
for name, (size, axis, _) in ITEMS.items():
    if only and name[:-4] not in only.split(','): continue
    src = f'{DEC}/{name}.glb'
    if not os.path.exists(src): continue
    fix = None
    for turn in (0, 90, 180, 270):
        out = f'{OUT}/{name}-t{turn}.png'
        if os.path.exists(out): continue
        reset(); root, ms = load(src)
        root.rotation_mode = 'QUATERNION'
        if fix is None: fix = straighten(root, ms, name)
        if fix is None: break
        root.rotation_quaternion = Quaternion((0, 0, 1), math.radians(turn)) @ fix
        bpy.context.view_layer.update()
        lo, hi = bounds(ms); ext = hi - lo
        s = size / (ext.z if axis == 'z' else max(ext.x, ext.y))
        root.scale = (s, s, s); bpy.context.view_layer.update(); ground(root, ms)
        setup(ms, px_per_unit=PPM, samples=64, map_sun=True)
        if os.environ.get('GPU'): use_gpu()
        render(out)
        print('rendered', name, turn, flush=True)
    if name[:-4] in VIEWS:
        for face, turn in zip('ab', VIEWS[name[:-4]]):
            shutil.copy(f'{OUT}/{name}-t{turn}.png', f'{OUT}/{name}-{face}.png')
