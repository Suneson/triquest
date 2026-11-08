"""cut-big-city.py — the app's pictures of the city from compose-big-base.py's output.

    python3 tools/cut-big-city.py <dir with city.png, front.png> <repo icons/City/layers>

Tiles of 1344 x 1245 px of the city: sharper near the base (INNER_K px per px) than far from it
(OUTER_K), so the whole city costs about what the old, smaller one did. All-sky tiles are left out.
The van's front pieces are what can cover it on its road (city3d.js ROUTES). Prints the JS numbers.
"""
import glob, json, os, sys
import numpy as np
from PIL import Image

X0, Y0 = -800, -2300
TILE = (1344, 1245)
BASE = (2691.5, 3245.5)
INNER_K, OUTER_K, INNER_R = 0.7, 0.36, 2400
C0, P, SLOPE = (2691.5, 3245.5), 1391, 0.489
lat = lambda a, b: (C0[0] + (a - b) * P, C0[1] + (a + b) * SLOPE * P)
ROADS = [(lat(1.6, -0.45), lat(0.45, -0.45)), (lat(0.45, -0.45), lat(0.45, 0.24)), (lat(0.45, 0.24), lat(0.45, 2.3))]
REACH = 190


def main():
    src, out = sys.argv[1:3]
    city = Image.open(os.path.join(src, 'city.png')).convert('RGBA')
    front = Image.open(os.path.join(src, 'front.png')).convert('RGBA')
    tiles, fr = os.path.join(out, 'tiles'), os.path.join(out, 'front')
    for f in glob.glob(os.path.join(tiles, 'city-*.webp')) + glob.glob(os.path.join(fr, 'van-front-*.webp')):
        os.remove(f)
    W, H = city.size
    cols, rows = -(-W // TILE[0]), -(-H // TILE[1])
    sky, total = [], 0
    for r in range(rows):
        for c in range(cols):
            box = (c * TILE[0], r * TILE[1], min(W, (c + 1) * TILE[0]), min(H, (r + 1) * TILE[1]))
            t = city.crop(box)
            if t.getchannel('A').getextrema()[1] < 8:
                sky.append(f'{r}-{c}'); continue
            cx, cy = (box[0] + box[2]) / 2 + X0, (box[1] + box[3]) / 2 + Y0
            k = INNER_K if np.hypot(cx - BASE[0], cy - BASE[1]) < INNER_R else OUTER_K
            size = (round(t.width * k), round(t.height * k))
            total += size[0] * size[1]
            t.resize(size, Image.LANCZOS).save(os.path.join(tiles, f'city-{r}-{c}.webp'), quality=84, method=6)
    # the front pieces
    a = np.asarray(front).copy()
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    wx, wy = xx + X0 + .5, yy + Y0 + .5
    near = np.zeros((H, W), bool)
    for (ax, ay), (bx, by) in ROADS:
        dx, dy = bx - ax, by - ay
        t = (((wx - ax) * dx + (wy - ay) * dy) / (dx * dx + dy * dy)).clip(0, 1)
        near |= np.hypot(wx - (ax + t * dx), wy - (ay + t * dy)) <= REACH
    a[..., 3] = np.where(near, a[..., 3], 0)
    pieces = []
    for r in range(rows):
        for c in range(cols):
            x0, y0 = c * TILE[0], r * TILE[1]
            p = a[y0:y0 + TILE[1], x0:x0 + TILE[0]]
            ys, xs = np.where(p[..., 3] > 8)
            if not len(xs):
                continue
            l, rr, t, b = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            name = f'van-front-{r}-{c}.webp'
            im = Image.fromarray(p[t:b, l:rr], 'RGBA')
            im.resize((max(1, round(im.width * .75)), max(1, round(im.height * .75))), Image.LANCZOS).save(os.path.join(fr, name), quality=86, method=6)
            pieces.append({'src': f'icons/City/layers/front/{name}', 'x': float(x0 + l + X0), 'y': float(y0 + t + Y0), 'w': float(rr - l), 'h': float(b - t)})
    print(json.dumps({'cols': cols, 'rows': rows, 'sky': sky, 'tile_mpx': round(total / 1e6, 1)}))
    print(json.dumps(pieces))


if __name__ == '__main__':
    main()
