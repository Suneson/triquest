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
    'legend-statue': (180, 'm180'),   # the runner stands turned on his plinth: a quarter turn shows his side, so the mirror
    'massage-gun': (180, 270),
    'massage-table': (180, 90),
    'podium': (180, 90),
    'pool': (180, 270),
    'pool-bench': (180, 270),
    'pool-pace-clock': (180, 90),
    'pool-shower': (180, 90),
    'pool-start-block': (180, 90, 0, 270),   # all four sides: it can stand on any side of a pool (c, d: second sheet)
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

def wall_angle(ms, R):
    """The yaw of the model's side walls: the near-vertical faces' normals, folded into 90 degrees and weighted by
    area; the strongest direction is a wall. Turning by minus this lines the walls up with the grid. Parts that
    stick out (a cord, steps, an open door) barely move it, unlike a rectangle round the whole outline."""
    bpy.context.view_layer.update()
    ang, wt = [], []
    for o in ms:
        me = o.data; n = len(me.polygons)
        if not n: continue
        nr = np.empty(n * 3); me.polygons.foreach_get('normal', nr); ar = np.empty(n); me.polygons.foreach_get('area', ar)
        m = np.array(o.matrix_world)[:3, :3]
        nw = nr.reshape(-1, 3) @ np.linalg.inv(m) @ R.T     # normals go by the inverse transpose
        nw /= np.linalg.norm(nw, axis=1, keepdims=True) + 1e-12
        side = np.abs(nw[:, 2]) < 0.25
        ang.append(np.degrees(np.arctan2(nw[side, 1], nw[side, 0])) % 90); wt.append(ar[side] * abs(np.linalg.det(m)) ** (2 / 3))
    ang = np.concatenate(ang); wt = np.concatenate(wt)
    h = np.zeros(360)
    np.add.at(h, (ang * 4).astype(int) % 360, wt)
    k = np.exp(-0.5 * (np.arange(-8, 9) / 3.0) ** 2)
    hs = np.array([np.dot(np.take(h, np.arange(i - 8, i + 9), mode='wrap'), k) for i in range(360)])
    a = (np.argmax(hs) + 0.5) / 4
    return a - 90 if a > 45 else a, hs.max() / (hs.mean() + 1e-12)

def wall_hist(ms, fold):
    """Area-weighted histogram (quarter degrees) of the near-vertical faces' normal directions, folded by `fold`."""
    bpy.context.view_layer.update()
    ang, wt = [], []
    for o in ms:
        me = o.data; n = len(me.polygons)
        if not n: continue
        nr = np.empty(n * 3); me.polygons.foreach_get('normal', nr); ar = np.empty(n); me.polygons.foreach_get('area', ar)
        nw = nr.reshape(-1, 3) @ np.linalg.inv(np.array(o.matrix_world)[:3, :3])
        nw /= np.linalg.norm(nw, axis=1, keepdims=True) + 1e-12
        side = np.abs(nw[:, 2]) < 0.25
        ang.append(np.degrees(np.arctan2(nw[side, 1], nw[side, 0])) % fold); wt.append(ar[side])
    ang = np.concatenate(ang); wt = np.concatenate(wt); nb = fold * 4
    h = np.zeros(nb); np.add.at(h, (ang * 4).astype(int) % nb, wt)
    k = np.exp(-0.5 * (np.arange(-8, 9) / 3.0) ** 2)
    return np.array([np.dot(np.take(h, np.arange(i - 8, i + 9), mode='wrap'), k) for i in range(nb)])

# models Tripo built with crooked walls that are straightened (unskew); others measured a little crooked too
# (hydration table, start blocks) but look right, so they're left as they are
UNSKEW = {'hot-tub', 'massage-gun', 'kickboards', 'hydro-treadmill', 'hurdles', 'boots', 'agility-ladder', 'watch-dock'}

# Tripo stood these on corner feet with the rest held off the floor; the concept lies flat (flatten)
FLATTEN = {'agility-ladder'}

def flatten(ms, name):
    """Lower the model by the gap under its middle (the lowest point of its central 60% along the long side) and press
    everything below the floor flat onto it: the rails then lie on the ground and the corner feet lose only their foot."""
    w = world_verts(ms); ext = np.ptp(w[:, :2], axis=0); ax = int(np.argmax(ext)); c = w[:, ax].mean()
    mid = np.abs(w[:, ax] - c) < 0.3 * ext[ax]; g = w[mid, 2].min() - w[:, 2].min()
    if g <= 0: return
    z0 = w[:, 2].min()
    for o in ms:
        mw = np.array(o.matrix_world); inv = np.linalg.inv(mw); me = o.data
        v = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', v); v = v.reshape(-1, 3)
        ww = v @ mw[:3, :3].T + mw[:3, 3]; ww[:, 2] = np.maximum(z0, ww[:, 2] - g)
        me.vertices.foreach_set('co', (ww @ inv[:3, :3].T + inv[:3, 3]).ravel()); me.update()
    bpy.context.view_layer.update()
    print(f'flatten {name}: lowered {g * 100:.1f} cm onto the floor', flush=True)

def apply_m(ms, M):
    for o in ms:
        mw = o.matrix_world.copy(); o.data.transform(mw.inverted() @ M @ mw)
        if M.determinant() < 0: o.data.flip_normals()   # a mirror turns the faces inside out
        o.data.update()
    bpy.context.view_layer.update()

def unskew(ms, name):
    """Tripo builds some boxes from the iso concept with walls that don't meet square (77-82 degrees), so the
    two turns can't mirror each other. Find the two wall directions and shear the mesh so they meet at 90."""
    hs = wall_hist(ms, 180)
    i1 = int(np.argmax(hs)); d = np.minimum(abs(np.arange(720) - i1), 720 - abs(np.arange(720) - i1))
    hs2 = np.where(d >= 160, hs, 0); i2 = int(np.argmax(hs2))
    if hs2[i2] < 0.15 * hs[i1]: return None
    a1, a2 = sorted(((i1 + 0.5) / 4, (i2 + 0.5) / 4)); sep = a2 - a1
    print(f'walls {name}: {a1:.1f} and {a2:.1f}, {sep:.1f} apart', flush=True)
    if abs(sep - 90) < 1.5 or abs(sep - 90) > 25: return None
    # wall runs (perpendicular to the normals) -> two runs 90 apart about the same middle, lengths kept
    r1, r2 = math.radians(a1 + 90), math.radians(a2 + 90); mid = (r1 + r2) / 2
    D = np.array([[math.cos(r1), math.cos(r2)], [math.sin(r1), math.sin(r2)]])
    t1, t2 = mid - math.pi / 4, mid + math.pi / 4
    T = np.array([[math.cos(t1), math.cos(t2)], [math.sin(t1), math.sin(t2)]])
    M2 = T @ np.linalg.inv(D); M = Matrix.Identity(4)
    for i in range(2):
        for j in range(2): M[i][j] = M2[i, j]
    print(f'unskew {name}: walls set square ({sep:.1f} -> 90)', flush=True)
    return M

def straighten(root, ms, name):
    """Level the model (Tripo sometimes stands a piece a few degrees over, on one edge) and square its footprint to
    the grid; returns the rotation. Level: the tilt that sets the most of its footprint down on the floor (contact),
    taken when it rests clearly better than as it came. Square: turn the side walls onto the grid (wall_angle)."""
    v = world_verts(ms); v = v[::max(1, len(v) // 1500)]; v = v - v.mean(0)
    c0 = contact(v, np.eye(3)); bc = (c0, 0.0, 0.0)
    for step, span, c in ((1, 25, (0, 0)), (0.25, 1, None)):
        c = c or (bc[1], bc[2])
        for p in np.arange(c[0] - span, c[0] + span + 1e-6, step):
            for r in np.arange(c[1] - span, c[1] + span + 1e-6, step):
                k = contact(v, rotm(math.radians(p), math.radians(r)))
                if k > bc[0] + 1e-6: bc = (k, p, r)
    print(f'floor {name}: rests {c0:.2f} as it came; best {bc[0]:.2f} at pitch {bc[1]:.2f}, roll {bc[2]:.2f}', flush=True)
    rot = Quaternion()
    p_, r_ = LEVEL.get(name[:-4], (bc[1], bc[2]) if bc[0] > c0 + 0.15 else (0, 0))
    if p_ or r_:
        rot = Matrix(rotm(math.radians(p_), math.radians(r_)).tolist()).to_quaternion()
        print(f'level {name}: pitch {p_}, roll {r_}', flush=True)
    R = np.array(rot.to_matrix())
    yaw, peak = wall_angle(ms, R)
    print(f'square {name}: walls at {yaw:.1f} deg (peak {peak:.1f})', flush=True)
    if abs(yaw) > 0.5 and peak > 3:
        rot = Quaternion((0, 0, 1), -math.radians(yaw)) @ rot
    if os.environ.get('DIAG'): return None
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
    fix = None; skew = False
    for turn in [0, 90, 180, 270] + [t for t in VIEWS.get(name[:-4], ()) if isinstance(t, str)]:
        out = f'{OUT}/{name}-t{turn}.png'
        if os.path.exists(out): continue
        reset(); root, ms = load(src)
        root.rotation_mode = 'QUATERNION'
        if skew is False: skew = unskew(ms, name) if name[:-4] in UNSKEW else None
        if skew is not None: apply_m(ms, skew)
        if fix is None: fix = straighten(root, ms, name)
        if fix is None: break
        mirror = isinstance(turn, str)
        root.rotation_quaternion = Quaternion((0, 0, 1), math.radians(int(str(turn).lstrip('m')))) @ fix
        bpy.context.view_layer.update()
        if mirror:   # mirror the model itself across the camera's upright plane (x <-> y), so the light stays the map's
            apply_m(ms, Matrix(((0, 1, 0, 0), (1, 0, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1))))
        lo, hi = bounds(ms); ext = hi - lo
        s = size / (ext.z if axis == 'z' else max(ext.x, ext.y))
        root.scale = (s, s, s); bpy.context.view_layer.update(); ground(root, ms)
        if name[:-4] in FLATTEN: flatten(ms, name); ground(root, ms)
        if os.environ.get('CHECK'):
            print(f'check {name} t{turn}: walls at {wall_angle(ms, np.eye(3))[0]:.1f} deg', flush=True); continue
        setup(ms, px_per_unit=PPM, samples=64, map_sun=True)
        if os.environ.get('GRID'):   # debug: a 0.25 m floor grid under the item
            bpy.ops.mesh.primitive_grid_add(x_subdivisions=17, y_subdivisions=17, size=4, location=(0, 0, 0.002))
            g = bpy.context.active_object; g.modifiers.new('w', 'WIREFRAME').thickness = 0.01
            mt = bpy.data.materials.new('g'); mt.diffuse_color = (1, 0, 0, 1); g.data.materials.append(mt)
        if os.environ.get('GPU'): use_gpu()
        render(out)
        print('rendered', name, turn, flush=True)
    if name[:-4] in VIEWS and not os.environ.get('DIAG'):
        for face, turn in zip('abcd', VIEWS[name[:-4]]):
            shutil.copy(f'{OUT}/{name}-t{turn}.png', f'{OUT}/{name}-{face}.png')
