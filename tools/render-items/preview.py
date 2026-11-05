import sys, math, glob, os

A = os.environ["ARGS"].split("|"); exec(open(A[0]).read())
out = A[2]
for f in sorted(glob.glob(A[1] + '/*.glb')):
    n = os.path.splitext(os.path.basename(f))[0]
    for k, yaw in enumerate((0, 90, 180, 270)):
        reset(); root, ms = load(f); root.rotation_euler[2] = math.radians(yaw); ground(root, ms)
        setup(ms, px_per_unit=260, samples=12)
        render(f'{out}/{n}-{yaw}.png')
