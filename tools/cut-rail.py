"""cut-rail.py — the railing round each floor's roof slab (docs/CITY.md, "The railing").

    python3 tools/cut-rail.py <rail.png> <out dir>

  rail.png   the railing on its own, a navy kerb with gold rails round a square, keyed (RGBA)

The railing is warped onto each kind of slab (the street floor's, and the cap's that every floor
above stands on) so its kerb's outer top corners land on the slab's corners, then cut in two along
the line between its left and right corners: the back half (the two far sides) goes behind the
room, the front half (the two near sides, rails and all) over it, so the room stands inside it.
Writes <out>/{street,roof}-{back,front}.webp and prints where each goes for js/core/diorama.js
(RAIL), in px of the city picture for floor 0 (street) and floor 1 (roof; it moves up with the
floor). Build-time only (Pillow, numpy).
"""
import json, os, sys
import numpy as np
from PIL import Image

# the kerb's outer top corners in the railing picture (measured on it: see the docstring)
RAIL = {'top': (1000, 33), 'right': (1957, 510), 'bottom': (990, 1004), 'left': (33, 522)}
# the slabs, in px of the street floor (js/core/diorama.js CITY.slab0 / slab1), and how that maps
# to the city picture: (x + PLATE_AT) * K
SLABS = {
    'street': {'top': (1690, 800), 'right': (3582, 1475), 'bottom': (1814, 2358), 'left': (0, 1468)},
    'roof': {'top': (1804, 16), 'right': (3658, 833), 'bottom': (1829, 1725), 'left': (63, 821)},
}
PLATE_AT, K = (3584, 4072), 0.5
STORE = 0.75     # the pictures are stored at 3/4 of their size in the city picture (like its tiles)
LIFT = 46        # px of the railing picture: the cut runs this far above the left-right line, so the
                 # front rails (which rise above the kerb) stay with the front half


def homography(src, dst):
    """The 3 × 3 projective map taking the four src points to the four dst points."""
    A = []
    for (x, y), (u, v) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.array(A, float))
    H = vt[-1].reshape(3, 3)
    return H / H[2, 2]


def main():
    src, out = sys.argv[1:3]
    os.makedirs(out, exist_ok=True)
    rail = Image.open(src).convert('RGBA')
    names = ['top', 'right', 'bottom', 'left']
    rp = [RAIL[n] for n in names]
    info = {}
    for kind, slab in SLABS.items():
        world = [((x + PLATE_AT[0]) * K, (y + PLATE_AT[1]) * K) for x, y in (slab[n] for n in names)]
        H = homography(rp, world)
        # where the whole picture lands, to size the output
        w, h = rail.size
        corners = np.array([[0, 0, 1], [w, 0, 1], [w, h, 1], [0, h, 1]], float) @ H.T
        corners = corners[:, :2] / corners[:, 2:]
        x0, y0 = np.floor(corners.min(0)).astype(int)
        x1, y1 = np.ceil(corners.max(0)).astype(int)
        W, Hh = round((x1 - x0) * STORE), round((y1 - y0) * STORE)
        # output px (stored) -> world -> railing picture: PIL wants that inverse map's coefficients
        S = np.array([[1 / STORE, 0, x0], [0, 1 / STORE, y0], [0, 0, 1]], float)
        inv = np.linalg.inv(H @ np.eye(3)) @ S
        inv = inv / inv[2, 2]
        warped = rail.transform((W, Hh), Image.PERSPECTIVE, inv.flatten()[:8].tolist(), Image.BICUBIC)
        a = np.asarray(warped).copy()
        # the cut: the line through the left and right corners, LIFT px of the railing picture higher
        lift = LIFT * (world[2][1] - world[0][1]) / (RAIL['bottom'][1] - RAIL['top'][1])
        (lx, ly), (rx, ry) = world[3], world[1]
        yy, xx = np.mgrid[0:Hh, 0:W].astype(float)
        wx, wy = x0 + xx / STORE, y0 + yy / STORE
        line = ly + (wx - lx) * (ry - ly) / (rx - lx) - lift
        for part, keep in (('back', wy < line), ('front', wy >= line)):
            p = a.copy(); p[..., 3] = np.where(keep, p[..., 3], 0)
            ys, xs = np.where(p[..., 3] > 4)
            bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            name = f'{kind}-{part}.webp'
            Image.fromarray(p[by0:by1, bx0:bx1], 'RGBA').save(os.path.join(out, name), quality=88, method=6)
            info[f'{kind}-{part}'] = {'x': round(x0 + bx0 / STORE, 1), 'y': round(y0 + by0 / STORE, 1),
                                      'w': round((bx1 - bx0) / STORE, 1), 'h': round((by1 - by0) / STORE, 1)}
    print(json.dumps(info))


if __name__ == '__main__':
    main()
