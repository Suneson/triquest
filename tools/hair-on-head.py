# hair-on-head.py: the hair of one Tripo model (a bald game character given a hairstyle, from
# PromptQueue Prompts/hair-on-head.csv), cut off and lined up with the plain body's head.
#
#   ARGS="<plain body>.glb|<tripo>.glb|<out>.glb|<preview>.png" blender -b --python tools/hair-on-head.py
#
# The plain body must be decoded first (node tools/decode-glb.mjs): models/chars/male.glb or female.glb.
# 1. The hair is the grey, unsaturated part of the texture, joined to grey above the neck (Tripo
#    may make a whole body: trousers and the rest are dropped).
# 2. The Tripo head (its skin above the neck) is lined up with the game head by ICP: a move, a
#    turn and one size. Tripo's model faces sideways; both quarter turns are tried, the best kept.
# 3. The hair is written in head-box units, glTF axes: (0,0,0)..(1,1,1) is the box of the skin
#    weighted to the Head bone, the box js/app/gear3d.js measures on whichever outfit is worn.
#    The preview shows it on the body from the front and the back.
# Then tools/build-accessories.mjs (items with head: true) makes the game files.
import bpy, bmesh, os, math, json
import numpy as np
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree

body_path, src, out_glb, out_png = os.environ['ARGS'].split('|')
bpy.ops.wm.read_factory_settings(use_empty=True)

def imp(p):
    before = set(bpy.data.objects)
    d, n = os.path.split(p)
    bpy.ops.import_scene.gltf(filepath=p, directory=d + '/', files=[{'name': n}])
    return [o for o in bpy.data.objects if o not in before]

# ---- game body: all verts, and the head box by the app's rule
bobjs = imp(body_path)
bmeshobj = next(o for o in bobjs if o.type == 'MESH' and o.vertex_groups and len(o.data.vertices) > 1000)
bw = bmeshobj.matrix_world
dg = bpy.context.evaluated_depsgraph_get()
ev = bmeshobj.evaluated_get(dg).to_mesh()
BV = np.array([tuple(bw @ v.co) for v in ev.vertices])
assert len(ev.vertices) == len(bmeshobj.data.vertices)
head_groups = {g.index for g in bmeshobj.vertex_groups if g.name.endswith('Head') and 'Top' not in g.name}
hw = np.zeros(len(BV))
for v in bmeshobj.data.vertices:
    for g in v.groups:
        if g.group in head_groups: hw[v.index] += g.weight
HB = BV[hw >= 0.5]
box_min, box_max = HB.min(0), HB.max(0)   # Blender axes

def neck_z(P, z0, z1, xi=0):
    # the narrowest slice (left-right) between z0 and z1
    best, bz = 1e9, None
    for z in np.linspace(z0, z1, 40):
        s = P[np.abs(P[:, 2] - z) < (z1 - z0) / 40]
        if len(s) < 10: continue
        w = s[:, xi].max() - s[:, xi].min()
        if w < best: best, bz = w, z
    return bz

bh = BV[:, 2].max() - BV[:, 2].min()
# game head: everything above the neck
gnz = neck_z(BV[np.abs(BV[:, 0]) < 0.25], box_min[2] - 0.02 * bh, box_min[2] + 0.4 * (box_max[2] - box_min[2]))
print('GAME box', box_min.round(3), box_max.round(3), 'neck', gnz, 'n', len(HB))
G = BV[(BV[:, 2] > gnz) & (np.abs(BV[:, 0]) < 0.3)]

# ---- Tripo model
tobjs = imp(src)
t = next(o for o in tobjs if o.type == 'MESH')
me = t.data
TW = np.array([tuple(t.matrix_world @ v.co) for v in me.vertices])
# colour per face from the texture at the face's UVs
img = next(n.image for n in me.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE')
W, H = img.size
px = np.empty(W * H * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)
uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers.active.data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
ls = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get('loop_start', ls)
lt = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get('loop_total', lt)
fc = np.zeros((len(me.polygons), 3))
for k in range(3):
    li = ls + k % lt
    u = np.clip((uv[li, 0] % 1) * W, 0, W - 1).astype(int); v = np.clip((uv[li, 1] % 1) * H, 0, H - 1).astype(int)
    fc += px[v, u, :3]
fc /= 3
mx, mn = fc.max(1), fc.min(1)
sat = (mx - mn) / np.maximum(mx, 1e-4)
grey = (sat < 0.13) & (mx > 0.18)
skin = (sat > 0.2) & (mx > 0.35) & (fc[:, 0] > fc[:, 2])
fverts = [list(p.vertices) for p in me.polygons]
fcent = np.array([TW[f].mean(0) for f in fverts])

# facing: the body is narrow in x or y; turn so it is wide in x (left-right), then try both fronts
ext = TW.max(0) - TW.min(0)
tz0, tz1 = TW[:, 2].min(), TW[:, 2].max()
th = tz1 - tz0

def rotz(deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

def umeyama(A, B):
    ma, mb = A.mean(0), B.mean(0); a, b = A - ma, B - mb
    U, S, Vt = np.linalg.svd(b.T @ a / len(A))
    D = np.eye(3); D[2, 2] = np.sign(np.linalg.det(U @ Vt))
    R = U @ D @ Vt
    s = (S * np.diag(D)).sum() / (a ** 2).sum() * len(A)
    return s, R, mb - s * R @ ma

kd = KDTree(len(G))
for i, p in enumerate(G): kd.insert(p, i)
kd.balance()

skin_v = np.unique(np.concatenate([fverts[i] for i in np.where(skin)[0]]))
best = None
for yaw in ((0, 180) if ext[0] > ext[1] else (90, -90)):
    R0 = rotz(yaw)
    P = TW @ R0.T
    S = P[skin_v]
    # Tripo neck: narrowest skin slice in the top third
    nz = neck_z(S[np.abs(S[:, 0] - np.median(S[:, 0])) < 0.15 * th], tz0 + 0.62 * th, tz0 + 0.86 * th)
    print('T', tz0, tz1, 'skin', len(S), 'grey', int(grey.sum()), 'nz', nz)
    src_pts = S[S[:, 2] > nz]
    # start: match the widths and the necks
    gw = G[:, 0].max() - G[:, 0].min(); sw_ = src_pts[:, 0].max() - src_pts[:, 0].min()
    s = gw / sw_ if sw_ > 0 else 1
    c_src = np.array([np.median(src_pts[:, 0]), np.median(src_pts[:, 1]), nz])
    c_g = np.array([np.median(G[:, 0]), np.median(G[:, 1]), gnz])
    sc, R, tr = s, np.eye(3), c_g - s * c_src
    sub = src_pts[np.random.default_rng(0).choice(len(src_pts), min(3000, len(src_pts)), replace=False)]
    for it in range(60):
        X = sc * sub @ R.T + tr
        nn = np.array([kd.find(x) for x in X], dtype=object)
        Y = np.array([n[0] for n in nn]); d = np.array([n[2] for n in nn])
        keep = d < np.quantile(d, 0.8)
        sc2, R2, t2 = umeyama(X[keep], Y[keep])
        sc, R, tr = sc2 * sc, R2 @ R, sc2 * R2 @ tr + t2
    X = sc * sub @ R.T + tr
    err = np.median([kd.find(x)[2] for x in X]) / gw
    # which way the face looks: the nose is the skin point furthest forward (-Y in Blender)
    print('YAW', yaw, 'err', round(err, 4), 'scale', round(sc, 3))
    # a fit that shrank the head to nothing (it found a small patch that matches) is no fit
    if sc < 0.6 * gw / sw_: continue
    if best is None or err < best[0]: best = (err, yaw, R0, sc, R, tr, nz)
err, yaw, R0, sc, R, tr, nz = best
M = lambda Q: sc * (Q @ R0.T) @ R.T + tr

# ---- the hair: grey faces joined to grey faces above the Tripo neck
P0 = TW @ R0.T
seed = grey & (fcent @ R0.T)[:, 2].__gt__(nz - 0.01 * th)
# face adjacency through shared verts
v2f = {}
for i, f in enumerate(fverts):
    if grey[i]:
        for v in f: v2f.setdefault(v, []).append(i)
take = np.zeros(len(fverts), bool); stack = list(np.where(seed)[0]); take[stack] = True
while stack:
    i = stack.pop()
    for v in fverts[i]:
        for j in v2f.get(v, ()):
            if not take[j]: take[j] = True; stack.append(j)
# drop small islands far below the head (trousers that touched by chance): keep faces above the hips
take &= (fcent @ R0.T)[:, 2] > tz0 + 0.55 * th
print('HAIR faces', int(take.sum()), 'of', len(fverts), 'yaw', yaw, 'err', round(err, 4))

# delete the rest, move the hair onto the game head, write in head-box units (glTF axes)
bm = bmesh.new(); bm.from_mesh(me)
bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.faces[i] for i in range(len(bm.faces)) if not take[i]], context='FACES')
loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context='VERTS')
bm.to_mesh(me); bm.free()
t.matrix_world = Matrix.Identity(4)
V = np.array([tuple(v.co) for v in me.vertices])
# (Tripo's own matrix was applied when reading TW; the mesh data is in local space)
V = np.array([tuple(t.matrix_world @ v.co) for v in me.vertices])
Vg = M(V)
# keep a copy in body space for the preview
size = box_max - box_min
for v, p in zip(me.vertices, Vg): v.co = Vector(p)
me.update()

# preview: the game body + the hair, three-quarter, close on the head
for o in bobjs:
    if o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
sc_ = bpy.context.scene
hc = (box_min + box_max) / 2; hh = size[2]
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc_.collection.objects.link(cam)
def shot(path, deg):
    a = math.radians(deg)
    dv = Vector((-math.sin(a), -math.cos(a), 0.12)).normalized()
    cam.data.lens = 85
    cam.location = Vector(hc) + Vector((0, 0, hh * 0.15)) + dv * hh * 8
    cam.rotation_euler = (-dv).to_track_quat('-Z', 'Y').to_euler()
    sc_.render.filepath = path
    bpy.ops.render.render(write_still=True)
sc_.camera = cam
sc_.render.resolution_x = sc_.render.resolution_y = 420
sc_.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc_.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('w'); sc_.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.3, 0.3, 0.32, 1)
key = bpy.data.objects.new('key', bpy.data.lights.new('key', 'SUN')); sc_.collection.objects.link(key)
key.data.energy = 3.5; key.rotation_euler = (0.9, 0.2, -0.6)
base, ext_ = os.path.splitext(out_png)
shot(base + '-a.png', 35); shot(base + '-b.png', 160)

# write in head-box units, glTF axes: glTF (x, y, z) = Blender (x, z, -y); export_yup does that swap
gmin = np.array([box_min[0], box_min[2], -box_max[1]]); gsize = np.array([size[0], size[2], size[1]])
Gp = np.stack([Vg[:, 0], Vg[:, 2], -Vg[:, 1]], 1)
U = (Gp - gmin) / gsize
for v, p in zip(me.vertices, U): v.co = Vector((p[0], -p[2], p[1]))
me.update()
for o in list(bpy.data.objects):
    if o != t: bpy.data.objects.remove(o)
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', use_selection=False, export_yup=True, export_apply=False)
print('DONE', json.dumps({'yaw': yaw, 'err': err, 'faces': int(take.sum()), 'umin': U.min(0).round(2).tolist(), 'umax': U.max(0).round(2).tolist()}))
