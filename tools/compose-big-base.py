"""compose-big-base.py — the city with the MOSKE base taking up 2 x 2 blocks (docs/CITY.md).

    python3 tools/compose-big-base.py <out dir> <old city.png> [preview]

The base stays exactly where it was and the same size in px of the city picture (so the slab, the
tower, the railing, the markets and the sign keep their numbers); the street grid round it is drawn
again at BLOCK_K of its old size, so the base's block is two blocks and the road between them
across. The slab holds a 32 x 32 floor, which is the same sum: two 16 x 16 blocks across.

<old city.png> is the old city (5376 x 4980, its tiles put together): the base is cut out of it, so
the retouched lobby is kept. Its detail comes from plate.webp, the street floor at twice the size,
wherever the two agree (not where the kiosks were painted out).

Writes base.webp (the base at BASE_K px per px of the city), city.png and front.png (the whole new
city and the plots in front of the van's road), then cut-big-city.py makes the app's tiles from
them. Build-time only (Pillow, numpy).
"""
import json, os, random, sys, importlib.util
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
try:
    import scipy  # only compose-city's green key needs it, and the plots here are already keyed
except ImportError:
    import types
    sys.modules['scipy'] = types.ModuleType('scipy'); sys.modules['scipy'].ndimage = None
spec = importlib.util.spec_from_file_location('compose_city', os.path.join(HERE, 'compose-city.py'))
cc = importlib.util.module_from_spec(spec); spec.loader.exec_module(cc)
CITY = os.path.join(HERE, '..', 'icons', 'City')

S = 0.489
C0, P_OLD = (2691.5, 3245.5), 1391.0     # city2d.js GRID: the base's block centre and the old pitch
OLD_BLOCK, OLD_ROAD = 1075.0, 316.0      # the old block and road, px of the city picture
BLOCK_K = OLD_BLOCK / (2 * OLD_BLOCK + OLD_ROAD)   # two new blocks and a road make one old block
BLOCK, ROAD = OLD_BLOCK * BLOCK_K, OLD_ROAD * BLOCK_K
P = BLOCK + ROAD
# the new world, in px of the old picture's frame (it starts at less than 0)
X0, Y0, W, H = -800, -2300, 7000, 8600
GROUND_TOP = -1400                       # the street grid stops here; above it is sky
BASE_K = 1.5                             # the base's own picture: px per px of the city
LOW = ['market', 'pool', 'market', 'pool']
TALL = ['apartments'] * 5 + ['apartments-green'] * 5 + ['apartments-small'] * 5 + ['market', 'pool']
BASE_CELLS = {(-1, -1), (-1, 0), (0, -1), (0, 0)}
STADIUM_CELLS = {(-1, -3), (-1, -2), (0, -3), (0, -2)}
BOX = (1500, 2410, 3880, 3880)           # the base's picture, in px of the city


def world_of(a, b):
    """Grid position in old-lattice units (the base's centre at 0, 0) to px of the city."""
    return C0[0] + (a - b) * P_OLD, C0[1] + (a + b) * S * P_OLD


def cells():
    """The grid's cells (m, n): centres at a, b = (m + 1/2, n + 1/2) * P / P_OLD."""
    p = P / P_OLD
    out = []
    for m in range(-34, 34):
        for n in range(-34, 34):
            a, b = (m + .5) * p, (n + .5) * p
            x, y = world_of(a, b)
            if X0 - BLOCK * 1.2 < x < X0 + W + BLOCK * 1.2 and GROUND_TOP < y < Y0 + H + 700:
                out.append((m, n, a, b, x, y))
    return out


CHOSEN = {}


def pick(m, n):
    """A plot for a cell: low ones where they stand in front of the base, mostly flats elsewhere, never the same as the cell beside it."""
    if (m, n) in CHOSEN:
        return CHOSEN[(m, n)]
    touching = (m in (-2, -1, 0, 1) and n == 1) or (n in (-2, -1, 0, 1) and m == 1)
    rnd = random.Random(m * 100003 + n * 1009 + 7)
    pool = list(LOW if touching else TALL)
    rnd.shuffle(pool)
    near = {CHOSEN.get((m - 1, n), (None,))[0], CHOSEN.get((m, n - 1), (None,))[0], CHOSEN.get((m - 1, n - 1), (None,))[0], CHOSEN.get((m + 1, n - 1), (None,))[0]}
    name = next((p for p in pool if p not in near), pool[0])
    CHOSEN[(m, n)] = (name, not touching and rnd.random() < .3)
    return CHOSEN[(m, n)]


def ground(colours):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    X = xx + X0 - C0[0]; Y = yy + Y0 - C0[1]
    a = (X / P + Y / (S * P)) / 2 + .5; b = (Y / (S * P) - X / P) / 2 + .5   # cell centres at whole numbers
    fa = a - np.round(a); fb = b - np.round(b)
    hb = BLOCK / (2 * P)
    on = (np.abs(fa) < hb) & (np.abs(fb) < hb)
    out = np.empty((H, W, 3), np.float32); out[:] = colours['road']; out[on] = colours['pavement']
    lw = 2.2 / P
    ma = (np.abs(np.abs(fa) - .5) < lw) & (np.abs(fb) < hb); mb = (np.abs(np.abs(fb) - .5) < lw) & (np.abs(fa) < hb)
    da = ((a * P / 60) % 1) < .45; db = ((b * P / 60) % 1) < .45
    out[(ma & db) | (mb & da)] = colours['line']
    g = Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    r = P
    for (_, _, _, _, x, y) in cells():
        x -= X0; y -= Y0
        d.polygon([(x, y - S * r), (x + r, y), (x, y + S * r), (x - r, y)], fill=255)
    g.putalpha(m)
    return g


def base_mask(size, offset, k):
    """Where the base is, on a picture of `size` px whose (0, 0) is world `offset`, `k` px per px."""
    v = lambda x, y: (1400 + x * 2, 2200 + y * 2)     # traced on a view of the old picture at half size
    # the slab's back, the right wing, the front edges just past the kerb, the left wing (the app stands
    # the tree and the lamp on those wings itself: market-view.js DRESSING)
    e = OLD_BLOCK / 2 / P_OLD + 0.048
    front_r, front, front_l = world_of(e, -e), world_of(e, e), world_of(-e, e)
    pts = [v(618, 116), v(1112, 304), v(1106, 442), v(1240, 512),
           front_r, front, front_l, v(58, 505), v(194, 428), v(183, 305)]
    m = Image.new('L', (size[0] * 2, size[1] * 2), 0)
    ImageDraw.Draw(m).polygon([((x - offset[0]) * k * 2, (y - offset[1]) * k * 2) for x, y in pts], fill=255)
    return m.resize(size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.5))


def base_picture(old):
    x0, y0, x1, y1 = BOX
    size = (round((x1 - x0) * BASE_K), round((y1 - y0) * BASE_K))
    lo = np.asarray(old.crop(BOX).resize(size, Image.BICUBIC)).astype(np.float32)
    # the street floor at twice the size, on the same frame (city px = (plate px + (3584, 4072)) / 2)
    plate = Image.open(os.path.join(CITY, 'layers', 'plate.webp')).convert('RGB')
    box = (x0 * 2 - 3584, y0 * 2 - 4072, x1 * 2 - 3584, y1 * 2 - 4072)
    canvas = Image.new('RGB', (box[2] - box[0], box[3] - box[1]))
    canvas.paste(plate, (-box[0], -box[1]))
    hi = np.asarray(canvas.resize(size, Image.LANCZOS)).astype(np.float32)
    # the plate's detail only where it says the same as the old picture (its soft version)
    def soft(a):
        return np.asarray(Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32)
    diff = np.abs(soft(lo[..., :3]) - soft(hi)).max(axis=2)
    agree = Image.fromarray(((diff < 14) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(5))
    t = np.asarray(agree).astype(np.float32)[..., None] / 255
    # the block's front corner: in the old picture a building stood over it, the plate has it bare
    fx0, fy0 = round((2380 - x0) * BASE_K), round((3560 - y0) * BASE_K)
    fx1, fy1 = round((3120 - x0) * BASE_K), round((3880 - y0) * BASE_K)
    t[fy0:fy1, fx0:fx1] = 1
    rgb = lo[..., :3] * (1 - t) + hi * t
    print('plate detail used on %.0f%% of the base box' % (t.mean() * 100))
    mask = np.asarray(base_mask(size, (x0, y0), BASE_K)).astype(np.float32)
    return Image.fromarray(np.dstack([rgb, mask]).clip(0, 255).astype(np.uint8), 'RGBA')


SPRITES = {}


def sprite(name, block, flip=False):
    key = (name, round(block), flip)
    if key in SPRITES:
        return SPRITES[key]
    cc.BLOCK = block * 2                      # compose-city works in px of the full-size master
    path = next(os.path.join(CITY, 'plots', f'{name}.{e}') for e in ('webp', 'png') if os.path.exists(os.path.join(CITY, 'plots', f'{name}.{e}')))
    spr, (fx, fy) = cc.plot_sprite(path, .5)
    if flip:
        spr = spr.transpose(Image.FLIP_LEFT_RIGHT); fx = spr.width - fx
    SPRITES[key] = (spr, fx, fy)
    return SPRITES[key]


def in_front(m, n):
    """Does this cell stand in front of the base (drawn after it)?"""
    return (m >= 1 and n >= -2) or (n >= 1 and m >= -2)


def main():
    out, old_path = sys.argv[1:3]
    os.makedirs(out, exist_ok=True)
    old = Image.open(old_path).convert('RGBA')
    oa = np.asarray(old)
    def sample(x, y, r=14):
        return oa[y - r:y + r, x - r:x + r, :3].reshape(-1, 3).mean(0)
    colours = {'road': sample(2300, 3620), 'pavement': sample(1900, 3240), 'line': np.array([238, 236, 240.])}
    print('colours', {k: v.round().tolist() for k, v in colours.items()})
    canvas = Image.new('RGBA', (W, H)); canvas.alpha_composite(ground(colours))
    front = Image.new('RGBA', (W, H))        # the plots in front of the van's road
    cs = cells(); cs.sort(key=lambda c: c[2] + c[3])
    base = base_picture(old)
    x0, y0, x1, y1 = BOX

    def draw(name, block, cx, cy, flip, targets):
        spr, fx, fy = sprite(name, block, flip)
        cc.BLOCK = block * 2
        corner = (cx - X0, cy - Y0 + S * block)
        ox, oy = round(corner[0] - fx), round(corner[1] - fy)
        spr = cc.clip_to_block(spr, ox, oy, (cx - X0) * 2, (cy - Y0) * 2, .5)
        for t in targets:
            cc.paste(t, spr, ox, oy)

    st_done = False
    for m, n, a, b, x, y in [c for c in cs if not in_front(c[0], c[1]) and (c[0], c[1]) not in BASE_CELLS]:
        if (m, n) in STADIUM_CELLS:
            if not st_done:
                draw('stadium', OLD_BLOCK, *world_of(0.0, -2 * P / P_OLD), False, [canvas]); st_done = True
            continue
        name, flip = pick(m, n); draw(name, BLOCK, x, y, flip, [canvas])
    canvas.alpha_composite(base.resize((x1 - x0, y1 - y0), Image.LANCZOS), (x0 - X0, y0 - Y0))
    over = Image.new('RGBA', (W, H))         # what stands in front of the base
    road_a, road_b = P / P_OLD, -P / P_OLD
    for m, n, a, b, x, y in [c for c in cs if in_front(c[0], c[1])]:
        name, flip = pick(m, n)
        targets = [canvas, over]
        if a > road_a and b > road_b:
            targets.append(front)
        draw(name, BLOCK, x, y, flip, targets)
    if 'preview' in sys.argv[3:]:
        canvas.resize((W // 4, H // 4), Image.LANCZOS).convert('RGB').save(os.path.join(out, 'preview.jpg'), quality=86)
        canvas.crop((1600, 4000, 5400, 6700)).resize((1520, 1080), Image.LANCZOS).convert('RGB').save(os.path.join(out, 'preview-mid.jpg'), quality=88)
    # the base's picture goes over the tiles, so nothing that stands in front of it may be in it
    b = np.asarray(base).copy()
    o = np.asarray(over.crop((x0 - X0, y0 - Y0, x1 - X0, y1 - Y0)).resize((base.width, base.height), Image.LANCZOS))
    b[..., 3] = (b[..., 3].astype(np.float32) * (1 - o[..., 3] / 255.)).astype(np.uint8)
    Image.fromarray(b, 'RGBA').save(os.path.join(out, 'base.webp'), quality=90, method=6)
    canvas.save(os.path.join(out, 'city.png'))
    front.save(os.path.join(out, 'front.png'))
    print(json.dumps({'BLOCK': BLOCK, 'ROAD': ROAD, 'P': P, 'cells': len(cs)}))


if __name__ == '__main__':
    main()
