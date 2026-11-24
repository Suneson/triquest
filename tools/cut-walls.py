"""cut-walls.py: the base's walls for each level of the hall, from the theme's wall kit (MOSKE APP/Island/THEMES.md).

    python tools/cut-walls.py <themes dir> [<map v5.png>]

  <themes dir>  MOSKE APP/Characters/Photos/Robots/Robots/Base/themes (<nn>-<slug>/walls-*.jpg)
  <map v5.png>  optional: also writes a preview of every level's walls on the map to MOSKE APP/Island/walls-preview.jpg

A kit is two wall runs and a pillar on flat green. Its runs are told apart by their slope (one goes up to the right,
the other down), not by where they are in the picture. Each run is copied end to end along a side of the lawn, its
end pillar on the next one's first, stretched a little so a whole number of runs fills the side. The walls stand on
the grass ring round the track, as on map v4: on its outer edge in front, just past the track at the back, with gaps
for the road (front left), the jetty (front right) and the two paths from the plazas (the back corner is open).
Each side is its own picture with a soft contact shadow: the back two go behind the room, the front ones over it
(js/core/diorama.js plotEnv rail). Writes icons/Plot/walls-<slug>-<side>-t1.webp and js/core/plot-walls.js.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, 'icons', 'Plot')
TAG = 't1'
# level -> (theme dir, kit picture); levels with none take the one below (diorama.js wallsFor)
LEVELS = {1: ('01-scrap-yard', 'walls-2.jpg'), 2: ('02-painted-block', 'walls-2_v2.jpg'), 3: ('03-steel-yard', 'walls-1.jpg'),
          4: ('05-navy-club', 'walls-1.jpg'), 5: ('06-coastal-marble', 'walls-2.jpg'), 7: ('07-pro-arena', 'walls-1.jpg'),
          8: ('08-glacier', 'walls-1_v2.jpg'), 9: ('09-sapphire-citadel', 'walls-2.jpg'), 10: ('10-legend', 'walls-1_v2.jpg')}

# the lawn (plot-art.js), and a tile (u to the right corner, v to the left one)
B = np.array([5239.9, 5627.0]); R = np.array([7701.3, 6855.3]); L = np.array([2795.8, 6852.7])
EU, EV = (R - B) / 48, (L - B) / 48
P = lambda u, v: B + u * EU + v * EV
BACK, FRONT = -5.3, 48 + 11.4      # the walls' foot line: just past the track at the back, the grass's edge in front
# each side's runs, end to end between its corners and gaps (u, v, left end first), whether it goes behind the room,
# and which end is a corner (its end pillar is centred on it, so the two sides share one)
SIDES = [
    ('bl', 'back', (BACK, FRONT), (BACK, 27.0), 'a'),        # left corner to the left plaza's path
    ('br', 'back', (27.0, BACK), (FRONT, BACK), 'c'),        # the right plaza's path to the right corner
    ('fl1', 'front', (BACK, FRONT), (23.3, FRONT), 'a'),     # left corner to the road
    ('fl2', 'front', (26.6, FRONT), (FRONT, FRONT), 'c'),    # the road to the front corner
    ('fr1', 'front', (FRONT, FRONT), (FRONT, 27.8), 'a'),    # front corner to the jetty
    ('fr2', 'front', (FRONT, 20.3), (FRONT, BACK), 'c'),     # the jetty to the right corner
]
PILLAR = 390      # world px from a pillar's cap to its foot, as on map v4
STORE = 0.75      # the pictures are stored at 3/4 of their size in the world


def key(rgb):
    """RGBA off the green (bright or shaded): what's well greener than it is red or blue goes."""
    a = rgb.astype(float); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    d = g - np.maximum(r, b)
    alpha = np.clip((80 - d) / 50, 0, 1)
    # no hole filling: the green seen through a mesh fence goes too
    alpha = nd.gaussian_filter(alpha, 0.6)
    g2 = np.where(alpha < 0.98, np.minimum(g, np.maximum(r, b) + 8), g)
    return np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8)


def pieces(path):
    """The kit's two runs, by slope ('up' rises to the right, 'down' falls), each with its baseline and end pillar."""
    rgba = key(np.asarray(Image.open(path).convert('RGB')))
    m = nd.binary_closing(rgba[..., 3] > 128, iterations=3)
    lab, n = nd.label(m, structure=np.ones((3, 3)))
    sizes = nd.sum(m, lab, range(1, n + 1))
    big = [i + 1 for i in np.argsort(sizes)[::-1][:3]]
    boxes = {i: nd.find_objects((lab == i).astype(int))[0] for i in big}
    pillar = min(big, key=lambda i: boxes[i][1].stop - boxes[i][1].start)
    runs = {}
    for i in big:
        if i == pillar: continue
        ys, xs = boxes[i]
        sub = lab[ys, xs] == i
        cols = np.where(sub.any(0))[0]
        bot = np.array([np.where(sub[:, c])[0].max() for c in cols], float) + ys.start
        top = np.array([np.where(sub[:, c])[0].min() for c in cols], float) + ys.start
        xc = cols + xs.start
        w = len(cols); mid = slice(int(w * 0.25), int(w * 0.75))
        mk, ck = np.polyfit(xc[mid], bot[mid], 1)
        # the end pillars: where the top drops sharply from the pillar's cap to the wall's top (and climbs back at the end)
        mt = np.polyfit(xc[mid], top[mid], 1)[0]
        dt = np.diff(top) - mt
        k3 = w // 3
        pl = int(np.argmax(dt[:k3])) + 1
        pr = w - (2 * k3 + int(np.argmin(dt[2 * k3:])) + 1)
        pw = (pl + pr) / 2
        hgt = bot - top
        ph = np.percentile(np.r_[hgt[:pl], hgt[w - pr:]], 90)
        img = Image.fromarray(rgba[ys, xs] * (lab[ys, xs] == i)[..., None].astype(np.uint8))
        runs['up' if mk < 0 else 'down'] = dict(img=img, ox=xs.start, oy=ys.start, x0=float(xc[0]), x1=float(xc[-1]),
                                                 m=mk, c=ck, pw=float(pw), ph=float(ph))
    # a kit with both runs the same way: the other is the mirror of one
    for want, have in (('up', 'down'), ('down', 'up')):
        if want not in runs and have in runs:
            h = runs[have]; W = h['img'].width
            runs[want] = dict(h, img=h['img'].transpose(Image.FLIP_LEFT_RIGHT), m=-h['m'],
                              x0=h['ox'] + W - 1 - (h['x1'] - h['ox']), x1=h['ox'] + W - 1 - (h['x0'] - h['ox']),
                              c=h['c'] + h['m'] * (2 * h['ox'] + W - 1))
    return runs


def side(run, A, C, s, corner=''):
    """One side's runs between A and C (world px, A the left end), and its contact shadow: (picture, x, y)."""
    me = (C[1] - A[1]) / (C[0] - A[0])
    half = s * run['pw'] / 2
    if 'a' in corner: A = A - np.array([half, me * half])
    if 'c' in corner: C = C + np.array([half, me * half])
    Wr = run['x1'] - run['x0']; pw = run['pw']
    n = max(1, round(((C[0] - A[0]) / s - pw) / (Wr - pw)))
    a = (C[0] - A[0]) / (n * (Wr - pw) + pw)          # world px per kit px along the side (s, give or take)
    y0 = run['m'] * run['x0'] + run['c']
    copies = []
    for i in range(n):
        X0 = A[0] + i * a * (Wr - pw); Y0 = A[1] + me * (X0 - A[0])
        copies.append((X0, Y0))
    # the bounds, in world px
    img = run['img']; ox, oy = run['ox'], run['oy']
    def fwd(X0, Y0, x, y):
        dx = x - run['x0']
        return X0 + a * dx, Y0 + (me * a - s * run['m']) * dx + s * (y - y0)
    pts = [fwd(X0, Y0, x, y) for X0, Y0 in copies for x in (ox, ox + img.width) for y in (oy, oy + img.height)]
    pad = 60
    x_lo = min(p[0] for p in pts) - pad; y_lo = min(p[1] for p in pts) - pad
    x_hi = max(p[0] for p in pts) + pad; y_hi = max(p[1] for p in pts) + pad
    W, H = round((x_hi - x_lo) * STORE), round((y_hi - y_lo) * STORE)
    # the shadow: a soft band along the foot, thrown a little to the lower right (light from the upper left)
    sh = Image.new('L', (W, H)); d = ImageDraw.Draw(sh)
    to = lambda X, Y: ((X - x_lo) * STORE, (Y - y_lo) * STORE)
    t = 0.55 * np.hypot(*EU)                               # the wall's depth, about half a tile
    d.polygon([to(A[0] - 10, A[1] - 6), to(C[0] + 10, C[1] - 6), to(C[0] + 36, C[1] + t * 0.5 + 18), to(A[0] + 36, A[1] + t * 0.5 + 18)], fill=120)
    sh = sh.filter(ImageFilter.GaussianBlur(16 * STORE))
    canvas = Image.new('RGBA', (W, H), (20, 30, 20, 0)); canvas.putalpha(sh)
    # the runs, the far ones first
    order = range(n - 1, -1, -1) if me < 0 else range(n)
    for i in order:
        X0, Y0 = copies[i]
        # output (store px) -> kit px: the inverse of fwd
        A11 = 1 / (a * STORE); bx = run['x0'] + (x_lo - X0) / a
        k = (me * a - s * run['m'])
        # y = y0 + (Y - Y0 - k*dx)/s, with X = x_lo + px/STORE, Y = y_lo + py/STORE, dx = (X - X0)/a
        c1 = -k / (s * a * STORE); c2 = 1 / (s * STORE); c0 = y0 + (y_lo - Y0 - k * (x_lo - X0) / a) / s
        warped = img.transform((W, H), Image.AFFINE, (A11, 0, bx - ox, c1, c2, c0 - oy), resample=Image.BICUBIC)
        canvas = Image.alpha_composite(canvas, warped)
    return canvas, x_lo, y_lo, n


def main():
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    data, previews = {}, {}
    for lv, (folder, f) in LEVELS.items():
        slug = folder.split('-', 1)[1]
        runs = pieces(os.path.join(src, folder, f))
        info = {'theme': slug, 'back': [], 'front': []}
        previews[lv] = []
        for sid, layer, a, c, corner in SIDES:
            A, C = P(*a), P(*c)
            dirn = 'up' if (C[1] - A[1]) * (C[0] - A[0]) < 0 else 'down'
            run = runs[dirn]
            s = PILLAR / run['ph']
            pic, x, y, n = side(run, A, C, s, corner)
            name = f'walls-{slug}-{sid}-{TAG}.webp'
            pic.save(os.path.join(OUT, name), quality=86, method=6)
            info[layer].append({'src': f'icons/Plot/{name}', 'x': round(x, 1), 'y': round(y, 1),
                                'w': round(pic.width / STORE, 1), 'h': round(pic.height / STORE, 1)})
            previews[lv].append((pic, x, y))
            print(lv, slug, sid, dirn, 'runs', n, 'scale %.2f' % s, pic.size)
        data[str(lv)] = info
    js = ('// plot-walls.js: the base\'s walls for each level of the hall (MOSKE APP/Island/THEMES.md), round the lawn of\n'
          '// plot-art.js: the back sides behind the room, the front ones over it. Written by tools/cut-walls.py. Don\'t edit by hand.\n'
          'export const PLOT_WALLS = ' + json.dumps(data, indent=1) + ';\n')
    open(os.path.join(REPO, 'js', 'core', 'plot-walls.js'), 'w', encoding='utf-8', newline='\n').write(js)
    if len(sys.argv) > 2:
        Image.MAX_IMAGE_PIXELS = None
        base = Image.open(sys.argv[2]).convert('RGBA')
        x0, y0, x1, y1 = 1500, 4700, 9200, 9400
        k = 0.2
        crop = base.crop((x0, y0, x1, y1)).resize((round((x1 - x0) * k), round((y1 - y0) * k)))
        tiles = []
        for lv, ps in previews.items():
            c = crop.copy()
            for pic, x, y in ps:
                c.alpha_composite(pic.resize((round(pic.width / STORE * k), round(pic.height / STORE * k))), (round((x - x0) * k), round((y - y0) * k)))
            tiles.append(c.convert('RGB'))
        tw, th = tiles[0].size
        sheet = Image.new('RGB', (tw * 3, th * 3), 'white')
        for i, t in enumerate(tiles): sheet.paste(t, ((i % 3) * tw, (i // 3) * th))
        sheet.save(os.path.join(src, '..', '..', '..', '..', '..', '..', 'Island', 'walls-preview.jpg'), quality=85)


if __name__ == '__main__':
    main()
