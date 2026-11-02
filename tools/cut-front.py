"""cut-front.py — the van's front pieces (docs/CITY.md, "The front layer").

    python3 tools/cut-front.py <front tiles dir> <out dir>

When the van drives off it goes down the road between the tower's block and the plots on its
right, and those plots stand in front of it. compose-city.py's `front` pass writes those plots
alone (front-<row>-<col>.webp, the city's tile grid); the app draws them over the van, inside the
3D layer, only while it drives off (city3d.js).

Most of those tiles is far from the road, so this keeps only what can ever cover the van: every
pixel within REACH px (of the city picture) of its road out, and crops each tile to that. It
prints the pieces as the JS list for js/core/diorama.js (VAN_FRONT).

Build-time only (Pillow, numpy).
"""
import json, os, sys, glob
import numpy as np
from PIL import Image

# the city picture's tiles (diorama.js TILE) and the van's road out (city3d.js ROUTE_OUT)
TILE = (1344, 1245)
C0, P, SLOPE = (2691.5, 3245.5), 1391, 0.489
lat = lambda a, b: (C0[0] + (a - b) * P, C0[1] + (a + b) * SLOPE * P)
ROAD = (lat(0.45, 0.24), lat(0.45, 2.3))
REACH = 300   # the van is 250 px long and about 160 tall on screen: this covers it, with room


def main():
    src, out = sys.argv[1:3]
    os.makedirs(out, exist_ok=True)
    (ax, ay), (bx, by) = ROAD
    dx, dy = bx - ax, by - ay
    pieces = []
    for f in sorted(glob.glob(os.path.join(src, 'front-*.webp'))):
        r, c = map(int, os.path.basename(f)[6:-5].split('-'))
        im = Image.open(f).convert('RGBA')
        a = np.asarray(im).copy()
        k = TILE[0] / im.width                      # the tile's px are this many of the picture's
        yy, xx = np.mgrid[0:im.height, 0:im.width].astype(np.float32)
        wx = c * TILE[0] + (xx + 0.5) * k; wy = r * TILE[1] + (yy + 0.5) * k
        t = (((wx - ax) * dx + (wy - ay) * dy) / (dx * dx + dy * dy)).clip(0, 1)
        near = np.hypot(wx - (ax + t * dx), wy - (ay + t * dy)) <= REACH
        a[..., 3] = np.where(near, a[..., 3], 0)
        ys, xs = np.where(a[..., 3] > 8)
        if not len(xs):
            continue
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        name = f'van-front-{r}-{c}.webp'
        Image.fromarray(a[y0:y1, x0:x1], 'RGBA').save(os.path.join(out, name), quality=88, method=6)
        pieces.append({'src': f'icons/City/layers/front/{name}', 'x': round(c * TILE[0] + x0 * k, 1), 'y': round(r * TILE[1] + y0 * k, 1),
                       'w': round((x1 - x0) * k, 1), 'h': round((y1 - y0) * k, 1)})
    print(json.dumps(pieces))


if __name__ == '__main__':
    main()
