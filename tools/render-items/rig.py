# The base's locked camera rig (docs/ITEMS-3D.md): orthographic, from the floor's front corner,
# 45 degrees round, tilted so a floor edge rises 0.489 px per px across (the 16 x 16 rooms).
import bpy, math, os
from mathutils import Vector

SLOPE = 0.489
TILT = math.asin(SLOPE)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def load(path):
    before = set(bpy.context.scene.objects)
    d, n = os.path.split(path)     # Blender 5.2 wants the folder and the file named separately too
    bpy.ops.import_scene.gltf(filepath=path, directory=d + '/', files=[{'name': n}])
    new = [o for o in bpy.context.scene.objects if o not in before]
    root = bpy.data.objects.new('item', None); bpy.context.scene.collection.objects.link(root)
    for o in new:
        if o.parent is None: o.parent = root
    return root, [o for o in new if o.type == 'MESH']

def bounds(meshes):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector((min(p[i] for p in pts) for i in range(3))); hi = Vector((max(p[i] for p in pts) for i in range(3)))
    return lo, hi

def ground(root, meshes):
    """Stand the item on z = 0, centred on x, y = 0."""
    lo, hi = bounds(meshes)
    root.location -= Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    bpy.context.view_layer.update()

def camera_dir():
    # the camera sits off the floor's front corner: +x, +y, up
    c = math.cos(TILT)
    return Vector((c * math.sqrt(0.5), c * math.sqrt(0.5), math.sin(TILT)))

def setup(meshes, px_per_unit=600, margin=0.06, samples=64, shadow=True):
    sc = bpy.context.scene
    lo, hi = bounds(meshes)
    d = camera_dir()
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    centre = (lo + hi) / 2
    cam.location = centre + d * 20
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    cam.data.clip_end = 100
    sc.camera = cam
    bpy.context.view_layer.update()
    # frame: project the bounding box (and its shadow's reach) into the camera
    inv = cam.matrix_world.inverted()
    corners = [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
    cs = [inv @ p for p in corners]
    xs = [p.x for p in cs]; ys = [p.y for p in cs]
    w = max(xs) - min(xs); h = max(ys) - min(ys)
    m = margin * max(w, h)
    w += 2 * m; h += 2 * m
    cam.data.ortho_scale = max(w, h)
    cam.data.shift_x = ((max(xs) + min(xs)) / 2) / max(w, h)
    cam.data.shift_y = ((max(ys) + min(ys)) / 2) / max(w, h)
    sc.render.resolution_x = round(w * px_per_unit); sc.render.resolution_y = round(h * px_per_unit)
    sc.render.resolution_percentage = 100
    # render
    sc.render.engine = 'CYCLES'; sc.cycles.samples = samples; sc.cycles.use_denoising = True
    sc.cycles.device = 'CPU'
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    # world: soft lavender-blue sky light, like the base's ambient
    world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
    bg = world.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.9, 0.9, 0.9, 1); bg.inputs[1].default_value = 1.05
    # key: warm sun from the top left (the room's left, behind the camera's left shoulder)
    key = bpy.data.objects.new('key', bpy.data.lights.new('key', 'SUN')); sc.collection.objects.link(key)
    key.data.energy = 3.8; key.data.color = (1.0, 1.0, 1.0); key.data.angle = math.radians(8)
    key.rotation_euler = (Vector((-0.2, 1.0, 1.25))).normalized().to_track_quat('Z', 'Y').to_euler()
    # rim: cool, from behind on the right
    rim = bpy.data.objects.new('rim', bpy.data.lights.new('rim', 'SUN')); sc.collection.objects.link(rim)
    rim.data.energy = 1.4; rim.data.color = (1.0, 1.0, 1.0); rim.data.angle = math.radians(15)
    rim.rotation_euler = (Vector((-1.0, -0.6, 0.8))).normalized().to_track_quat('Z', 'Y').to_euler()
    if shadow:
        bpy.ops.mesh.primitive_plane_add(size=50, location=(0, 0, 0))
        p = bpy.context.object; p.name = 'floor'; p.is_shadow_catcher = True
    return cam

def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
