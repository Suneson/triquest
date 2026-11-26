# export-bike.py: a Tripo bike (Items/levels/BIKE/Bike-lvl<N>.glb) -> models/bikes/bike-lv<N>.glb for
# the bike fit editor (js/app/bike-fit.js) and the 3D rider.
#
#   "D:\Program Files\blender.exe" -b --python tools/export-bike.py -- 9 10
#
# Tripo fuses the whole bike into one mesh, but its parts are loose pieces, so:
#  - the cranks and pedals are cut out, and the drive-side crank and pedal are kept and copied to
#    the other side (Tripo often gets that side wrong, or adds a third pedal);
#  - the chain set Tripo copied onto the side the art shows without one is dropped;
#  - the bike is turned to face +Z in three.js (Blender -Y) with the chain on the rider's right,
#    sized so the saddle sits as far from the pedal axle as on lv9 (one riding pose fits every
#    bike), its wheels on y = 0;
#  - the pieces that move are their own nodes: `crank` (at the pedal axle, turns round X) holds
#    the two arms and the empties `pedalR` / `pedalL` (each holds its pedal, turned back so it
#    stays level). The empties `saddle`, `hoodL`, `hoodR` mark where the rider sits and holds on.
import bpy, bmesh, math, os, sys
import numpy as np
from mathutils import Matrix, Vector

SRC = 'D:/00_CLAUDE/00_Mokse Sports APP/MOSKE APP/Characters/Photos/Robots/Robots/Items/levels/BIKE'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models', 'bikes')
# lv9's saddle-to-axle distance (0.811 in Tripo units) sized x0.805 for the 1.8 tall athletes
SADDLE_TO_AXLE = 0.805 * 0.811
TRIS = 40000
TEX = 1024

def wv(p):
    m = np.array(p.matrix_world); v = np.empty(len(p.data.vertices) * 3); p.data.vertices.foreach_get('co', v)
    return v.reshape(-1, 3) @ m[:3, :3].T + m[:3, 3]

def join(objs, name):
    for o in bpy.data.objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); objs[0].name = name; objs[0].data.name = name
    return objs[0]

def bake(o, M):
    """Bake o's world matrix then M into its mesh (flipping faces when M mirrors), o at identity."""
    o.data.transform(M @ o.matrix_world)
    if M.determinant() < 0:
        bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(o.data); bm.free()
    o.parent = None; o.matrix_world = Matrix.Identity(4)

def empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(e)
    e.empty_display_size = 0.03
    e.parent = parent
    e.location = Vector(loc) - (parent.matrix_world.translation if parent else Vector())
    bpy.context.view_layer.update()
    return e

def hang(o, pivot):
    """o (baked, at identity) under pivot, its mesh moved so the pivot is its origin."""
    o.data.transform(Matrix.Translation(-pivot.matrix_world.translation))
    o.parent = pivot; o.matrix_parent_inverse = Matrix.Identity(4); o.location = (0, 0, 0)

def export(n):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f'{SRC}/Bike-lvl{n}.glb'); bpy.context.view_layer.update()
    o = [o for o in bpy.data.objects if o.type == 'MESH'][0]
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')
    # Tripo space: Z up, front wheel at -X, the chain side at -Y
    drop, arm, ped, other, keep = [], [], [], [], []
    for p in [o for o in bpy.data.objects if o.type == 'MESH']:
        v = wv(p); lo, hi = v.min(0), v.max(0); c = v.mean(0); d = hi - lo
        crank = lo[0] > -0.3 and hi[0] < 0.5 and lo[2] > -0.34 and hi[2] < -0.12 and lo[1] * hi[1] > 0 and max(abs(lo[1]), abs(hi[1])) > 0.1
        copied_chain = (c[1] > 0.035 and lo[0] > -0.05 and hi[0] < 0.8 and hi[2] < 0.0 and lo[1] > 0.02
                        and not (d[0] > 0.25 and d[1] > 0.04 and d[2] < 0.09) and not lo[1] > 0.11)
        if crank and hi[1] < 0:
            (keep if hi[0] > 0.45 else ped if lo[0] > 0.235 else arm).append(p)
        elif crank:
            if hi[1] > 0.2: other.append((p, c))
            drop.append(p)
        elif copied_chain: drop.append(p)
        else: keep.append(p)
    vv = np.vstack([wv(p) for p in ped]); vv = vv[vv[:, 1] < -0.15]; PR = (vv.min(0) + vv.max(0)) / 2
    front = [p for p, c in other if c[0] < PR[0] - 0.2]
    if front:
        fv_ = np.vstack([wv(p) for p in front]); PL = (fv_.min(0) + fv_.max(0)) / 2
        BB = np.array([(PR[0] + PL[0]) / 2, 0, (PR[2] + PL[2]) / 2])
    else:
        BB = np.array([PR[0] - 0.2, 0, PR[2]])
    for p in drop: bpy.data.objects.remove(p)
    frame = join(keep, 'frame'); arm = join(arm, 'armR'); ped = join(ped, 'pedR')
    fv = wv(frame)
    s_ = fv[(fv[:, 0] > 0.0) & (fv[:, 0] < 0.5) & (np.abs(fv[:, 1]) < 0.08)]; top = s_[:, 2].max()
    st = s_[s_[:, 2] > top - 0.06]; SAD = np.array([st[:, 0].mean() + 0.03, 0, top])
    h_ = fv[(fv[:, 0] < -0.4) & (fv[:, 1] < -0.15) & (fv[:, 2] > 0.25)]
    HOOD = np.array([np.median(h_[:, 0]), np.median(h_[:, 1]), np.percentile(h_[:, 2], 80)])
    # turned to face -Y with the chain on -X (the rider's right): swap x and y; sized; wheels on z = 0
    S = SADDLE_TO_AXLE / float(np.linalg.norm(SAD - BB))
    swap = Matrix(((0, 1, 0, 0), (1, 0, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1)))
    lift = -S * float(fv[:, 2].min())
    M = Matrix.Translation((0, 0, lift)) @ Matrix.Scale(S, 4) @ swap
    P = lambda p: M @ Vector(p)
    for o in (frame, arm, ped): bake(o, M)
    bb, pr = P(BB), P(PR)
    # the other side: the arm mirrored across the bike and turned half round the axle; the pedal
    # mirrored and moved to the far end
    mx = Matrix.Diagonal((-1, 1, 1, 1))
    half = Matrix.Translation(bb) @ Matrix.Rotation(math.pi, 4, 'X') @ Matrix.Translation(-bb)
    armL = arm.copy(); armL.data = arm.data.copy(); bpy.context.scene.collection.objects.link(armL); armL.name = 'armL'
    bake(armL, half @ mx)
    pl = Vector((-pr.x, 2 * bb.y - pr.y, 2 * bb.z - pr.z))
    pedL = ped.copy(); pedL.data = ped.data.copy(); bpy.context.scene.collection.objects.link(pedL); pedL.name = 'pedL'
    bake(pedL, Matrix.Translation(pl - Vector((-pr.x, pr.y, pr.z))) @ mx)
    # fewer triangles, a smaller texture
    for o in (frame, arm, armL, ped, pedL):
        tris = sum(len(f.vertices) - 2 for f in o.data.polygons)
        want = TRIS * (0.8 if o is frame else 0.05)
        if tris > want:
            m = o.modifiers.new('d', 'DECIMATE'); m.ratio = want / tris
            bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='d')
    for img in bpy.data.images:
        if img.size[0] > TEX: img.scale(TEX, TEX)
    # the moving parts
    crank = empty('crank', bb)
    hang(arm, crank); hang(armL, crank)
    pR = empty('pedalR', pr, crank); pL = empty('pedalL', pl, crank)
    hang(ped, pR); hang(pedL, pL)
    empty('saddle', P(SAD))
    hood = P(HOOD)
    empty('hoodR', hood); empty('hoodL', (-hood.x, hood.y, hood.z))
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, f'bike-lv{n}.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='WEBP', export_apply=True,
                              export_yup=True, export_animations=False)
    tris = sum(sum(len(f.vertices) - 2 for f in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print(f'BIKE lv{n}: {os.path.getsize(out) // 1024} KB, {tris} tris, size x{S:.3f}, axle {tuple(round(x, 3) for x in bb)}, '
          f'crank {np.hypot(*(pr - bb)[1:]):.3f}, saddle {tuple(round(x, 3) for x in P(SAD))}, hood {tuple(round(x, 3) for x in hood)}, dropped {len(drop)}')

for a in sys.argv[sys.argv.index('--') + 1:]:
    export(int(a))
