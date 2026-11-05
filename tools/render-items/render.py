import os, math
A = os.environ["ARGS"].split("|"); exec(open(A[0]).read())
RAW, OUT = A[1], A[2]
PPM = 420   # px per metre, the same for every item
# name: (models, size in metres along the axis given, axis, facing yaws (a = front down-left, b = down-right))
ITEMS = {
    'coffee-machine-t1': ('coffee_machine_t1', 1.45, 'z', (0, 90)),
    'coffee-machine-t2': ('coffee_machine_t2', 1.45, 'z', (0, 90)),
    'coffee-machine-t3': ('coffee_machine_t3', 1.45, 'z', (0, 90)),
    'treadmill-t1': ('treadmill_t1', 1.9, 'y', (180, 90)),
    'treadmill-t2': ('treadmill_t2', 1.9, 'y', (180, 90)),
    'road-bike-t1': ('road_bike_t1', 1.75, 'y', (-90, 0)),
    'road-bike-rollers-t1': ('rollers', 1.75, 'y', (-90, 0)),
    'road-bike-stand': ('bike_stand_pedestal', 2.0, 'y', (0, 90)),
    'trophy-gold-mountain': ('gold_mountain_trophy', 1.0, 'z', (0, 90)),
}
def build(model):
    if model != 'rollers':
        root, ms = load(f'{RAW}/{model.replace("_", "-")}.glb'); return root, ms
    # the road bike on balance rollers: front wheel on the single drum, back wheel between the pair
    bike, bm = load(f'{RAW}/road_bike_t1.glb'); ground(bike, bm)
    tr, tm = load(f'{RAW}/bike_trainer.glb'); ground(tr, tm)
    k = 0.772
    tr.rotation_euler[2] = math.pi; tr.scale = (k, k, k)
    bike.location.y += 0.042; bike.location.z += 0.094
    root = bpy.data.objects.new('item', None); bpy.context.scene.collection.objects.link(root)
    bike.parent = root; tr.parent = root
    return root, bm + tm
for name, (model, size, axis, yaws) in ITEMS.items():
    for face, yaw in zip('ab', yaws):
        reset(); root, ms = build(model)
        lo, hi = bounds(ms); s = size / (hi - lo)['xyz'.index(axis)]
        root.scale = (s, s, s); bpy.context.view_layer.update()
        root.rotation_euler[2] = math.radians(yaw); ground(root, ms)
        setup(ms, px_per_unit=PPM, samples=96)
        render(f'{OUT}/{name}-{face}.png')
