import os, math
A = os.environ["ARGS"].split("|"); exec(open(A[0]).read())
RAW, OUT = A[1], A[2]
PPM = 420
# name: (model, size in metres, along: 'z' height or 'h' longest across, facing yaws a, b)
ITEMS = {
    'locker-row': ('blue-locker-base', 1.9, 'z', (0, 90)),
    'drinks-fridge': ('blue-mini-fridge', 0.9, 'z', (0, 90)),
    'dumbbell-rack': ('dumbbell-rack-3d-model', 0.9, 'z', (0, 90)),
    'ice-bath': ('ice-tub-barrel', 1.0, 'z', (0, 90)),
    'kettlebell-set': ('kettlebell-base', 0.6, 'z', (0, 90)),
    'massage-table': ('massage-table', 0.95, 'z', (0, 90)),
    'bike-workstand': ('mechanic-bike-stand', 1.6, 'z', (0, 90)),
    'recovery-chair': ('modern-chair-3d-model', 0.95, 'z', (0, 90)),
    'race-podium': ('podium-moske', 0.9, 'z', (0, 90)),
    'punching-bag': ('punching-bag', 2.0, 'z', (0, 90)),
    'rowing-machine': ('rowing-machine-base', 2.2, 'h', (0, 90)),
    'shoe-display': ('shoe-stand', 1.3, 'z', (0, 90)),
    'treadmill-t1': ('treadmill-t1', 1.9, 'h', (270, 0)),
    'treadmill-t2': ('treadmill-t2', 1.9, 'h', (270, 0)),
    'treadmill-t3': ('treadmill-t3', 1.9, 'h', (270, 0)),
    'trophy-cabinet-t2': ('trophy-cabinet-medium-blue-and-white', 1.9, 'z', (0, 90)),
    'trophy-cabinet-t1': ('trophy-cabinet-navy-small', 1.5, 'z', (0, 90)),
}
only = os.environ.get('ONLY')
for name, (model, size, axis, yaws) in ITEMS.items():
    if only and name not in only.split(','): continue
    for face, yaw in zip('ab', yaws):
        reset(); root, ms = load(f'{RAW}/{model}.glb')
        lo, hi = bounds(ms); ext = hi - lo
        s = size / (ext.z if axis == 'z' else max(ext.x, ext.y))
        root.scale = (s, s, s); bpy.context.view_layer.update()
        root.rotation_euler[2] = math.radians(yaw); ground(root, ms)
        setup(ms, px_per_unit=PPM, samples=64)
        render(f'{OUT}/{name}-{face}.png')
