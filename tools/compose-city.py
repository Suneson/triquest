"""compose-city.py — the city plate: the street floor in the middle, a street grid round it and
the plot pictures standing on its blocks (docs/CITY.md, "The layered city").

    python3 tools/compose-city.py <in dir> <out.png> [scale] [nosky]

`nosky` leaves the sky transparent: the app draws the sky and the clouds behind the city.

<in dir> holds
  plate.png        the street floor, at the slope (tools/cut-tower.py), its sky still green
  plate-top.jpg    optional: the plate with a band of towers and sky painted on above it (any size;
                   only the band above the plate is used)
  sky.png          the sky
  <plot>.png       each plot (green screen, or already keyed), one city block on its own

Everything is drawn back to front on a canvas of CANVAS px (times `scale`, 0.5 for a quick look):
the sky, the street grid, what stands behind the tower's block in the plate, the plots behind,
the tower's block itself (lobby, slab and the crossroads in front), then the plots in front. The
tower's storeys go on top in the app (tower.json).

The street grid is one lattice of square blocks seen at SLOPE: block centres at
C0 + i·P·e1 + j·P·e2, with e1 = (1, SLOPE) and e2 = (−1, SLOPE). Its first two roads are the ones
that leave the plate on the left and the right (measured on its lane dashes), so the grid carries
them on; the plate's own crossroads stays as painted. Every plot is squashed to the slope and
scaled so its base is exactly one block wide.

Build-time only (Pillow, numpy, scipy; the green key is cut-art.py's).
"""
import os, sys, importlib.util
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('cut_art', os.path.join(HERE, 'cut-art.py'))
cut_art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cut_art)

SLOPE = 0.489
CANVAS = (10752, 9960)            # one row of blocks more below the street floor: scroll down to it
PLATE_AT = (3584, 4072)          # the plate's top-left corner on the canvas (bottom centre)
# on the plate (px of plate.png): a point on each of the two roads that leave it, measured on
# their lane dashes, and where the tower's block's front corner is
ROAD_LEFT = (360, 3075)          # the road along e1, in front of the tower's left face
ROAD_RIGHT = (3300, 3045)        # the road along e2, in front of its right face
TOWER_FRONT = (1830, 3470)       # the tower block's front corner (its kerb)
BLOCK = 2150                     # a block's half-diagonal across (px): its base is 2 * BLOCK wide
# the slab's outline on the plate: the tower's block is everything under it (lobby, shops, street)
SLAB = {'top': (1690, 800), 'left': (0, 1467), 'right': (3582, 1475)}
# small fixes painted in by Gemini (a 1400 px crop with the strip in magenta), each pasted at
# (x, y) on the full canvas with its left and right 50 px faded in: the kiosks cut where the
# street floor ended
PATCHES = [('kiosk-left.webp', 3154, 5600), ('kiosk-right.webp', 6978, 5600)]
ROAD_RGB = None                  # sampled from the plate's crossroads when None
FEATHER = 90                     # px: the plate's left and right edges fade into the grid
KEEP_PLATE_BEHIND = False        # the plate's own towers behind the tower's block (they end at its top)

# the blocks round the tower's and what stands on each: (i, j) in the lattice
PLOTS = [
    ((-1, -1), 'apartments'),     # straight behind the tower
    ((-1, 0), 'apartments'),      # behind, left
    ((0, -1), 'stadium'),         # behind, right
    ((-1, 1), 'apartments'),      # level with the tower, far left
    ((1, -1), 'apartments'),      # level with the tower, far right
    ((0, 1), 'market'),           # in front, left
    ((1, 0), 'pool'),             # in front, right
    # the row below the crossroads
    ((1, 1), 'apartments-green'), # straight below
    ((0, 2), 'apartments-small'), # below, far left
    ((2, 0), 'apartments'),       # below, far right
    # the row under that: only its tops show at the bottom edge, so low plots
    ((1, 2), 'market'),
    ((2, 1), 'pool'),
]


def rgba(path):
    im = Image.open(path)
    if im.mode == 'RGBA' and np.asarray(im)[..., 3].min() < 250:
        return im
    arr = np.asarray(im.convert('RGB'))
    img, alpha = cut_art.key_green(arr)
    return Image.fromarray(np.dstack([img.clip(0, 255), (alpha * 255).clip(0, 255)]).astype(np.uint8), 'RGBA')


def paste(canvas, im, x, y):
    """alpha_composite that allows the picture to hang off any edge of the canvas."""
    x, y = int(round(x)), int(round(y))
    l, t = max(0, -x), max(0, -y)
    r, b = min(im.width, canvas.width - x), min(im.height, canvas.height - y)
    if r <= l or b <= t:
        return
    canvas.alpha_composite(im.crop((l, t, r, b)), (x + l, y + t))


def lattice():
    """The grid's first crossroads (where the two plate roads meet) and its pitch, on the canvas."""
    s = SLOPE
    ax, ay = ROAD_LEFT[0] + PLATE_AT[0], ROAD_LEFT[1] + PLATE_AT[1]
    bx, by = ROAD_RIGHT[0] + PLATE_AT[0], ROAD_RIGHT[1] + PLATE_AT[1]
    # y = ay + s (x - ax)  and  y = by - s (x - bx)
    x = (by + s * bx - ay + s * ax) / (2 * s)
    ix, iy = x, ay + s * (x - ax)
    tfy = TOWER_FRONT[1] + PLATE_AT[1]
    road = 2 * (iy - tfy) / (2 * s)          # the tower's front corner sits half a road up from it
    pitch = BLOCK + road                     # a block's side (BLOCK across) and one road
    c0 = (ix, iy - s * pitch)                # the tower's block's centre
    return c0, pitch, road


def block_centre(c0, pitch, i, j):
    s = SLOPE
    return (c0[0] + (i - j) * pitch, c0[1] + (i + j) * s * pitch)


def ground(size, c0, pitch, road, k, plate_rgb):
    """The street grid: asphalt, lane dashes down the middle of every road, pavement on the blocks."""
    W, H = size
    s = SLOPE
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    X = xx / k - c0[0]; Y = yy / k - c0[1]
    a = (X / pitch + Y / (s * pitch)) / 2      # lattice coordinates: block centres at integers
    b = (Y / (s * pitch) - X / pitch) / 2
    fa = a - np.round(a); fb = b - np.round(b)
    hb = BLOCK / (2 * pitch)                 # a block spans |f| < hb on both axes
    on_block = (np.abs(fa) < hb) & (np.abs(fb) < hb)
    out = np.empty((H, W, 3), np.float32)
    out[:] = plate_rgb['road']
    out[on_block] = plate_rgb['pavement']
    # lane dashes: down the middle of each road (|f| = 0.5), every 210 px along it, not in crossings
    line_w = 9 / pitch
    mid_a = (np.abs(np.abs(fa) - 0.5) < line_w) & (np.abs(fb) < hb)
    mid_b = (np.abs(np.abs(fb) - 0.5) < line_w) & (np.abs(fa) < hb)
    dash_b = ((b * pitch / 210) % 1) < 0.45
    dash_a = ((a * pitch / 210) % 1) < 0.45
    out[(mid_a & dash_b) | (mid_b & dash_a)] = plate_rgb['line']
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGB')


def plot_sprite(path, k):
    """A plot squashed to the slope and scaled one block wide; returns it and its base's front corner."""
    im = rgba(path)
    a = np.asarray(im)
    m = a[..., 3] > 128
    xs = np.arange(m.shape[1])
    low = np.array([np.where(m[:, i])[0].max() if m[:, i].any() else -1 for i in xs])
    ok = low > 0
    fx = int(xs[ok][np.argmax(low[ok])]); x0, x1 = xs[ok].min(), xs[ok].max()
    mg = max(8, round(0.05 * im.width))       # keep clear of the corners: 5% of the picture
    L = ok & (xs < fx - mg) & (xs > x0 + mg); R = ok & (xs > fx + mg) & (xs < x1 - mg)
    slope = (np.polyfit(xs[L], low[L], 1)[0] - np.polyfit(xs[R], low[R], 1)[0]) / 2
    sx = (2 * BLOCK * k) / (x1 - x0)
    sy = sx * SLOPE / slope
    out = im.resize((round(im.width * sx), round(im.height * sy)), Image.LANCZOS)
    return out, ((fx) * sx, (low[fx] + 1) * sy)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    k = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    W, H = round(CANVAS[0] * k), round(CANVAS[1] * k)
    c0, pitch, road = lattice()
    print(f'grid: tower block centre {c0[0]:.0f},{c0[1]:.0f}  pitch {pitch:.0f}  road {road:.0f}')

    plate_full = Image.open(os.path.join(src, 'plate.png')).convert('RGB')
    pa = np.asarray(plate_full).astype(np.float32)
    def sample(x, y, r=25):
        return pa[y - r:y + r, x - r:x + r].reshape(-1, 3).mean(0)
    ix = int(round((ROAD_LEFT[0] + ROAD_RIGHT[0]) / 2));
    colours = {'road': sample(TOWER_FRONT[0] - 40, TOWER_FRONT[1] + 320) if ROAD_RGB is None else np.array(ROAD_RGB),
               'pavement': sample(TOWER_FRONT[0], TOWER_FRONT[1] - 60), 'line': np.array([238, 236, 240.])}

    # ---- the sky, then the street grid on the ground
    sky = Image.open(os.path.join(src, 'sky.png')).convert('RGB')
    sk = max(W / sky.width, H / sky.height)
    canvas = sky.resize((round(sky.width * sk), round(sky.height * sk)), Image.LANCZOS).crop((0, 0, W, H)).convert('RGBA')
    if 'nosky' in sys.argv[4:]:
        canvas = Image.new('RGBA', (W, H))
    g = ground((W, H), c0, pitch, road, k, colours).convert('RGBA')
    # the ground is the tower's block, every plot's block and everything in front of the tower's
    # row, each with half a road round it; past that is sky
    gm = Image.new('L', (W, H), 0); d = ImageDraw.Draw(gm)
    cells = {(0, 0)} | {ij for ij, _ in PLOTS}
    cells |= {(i, j) for i in range(-4, 5) for j in range(-4, 5) if i + j >= 1}
    r = BLOCK / 2 + road / 2                  # a cell's half side, along each axis (x px)
    for (i, j) in cells:
        cx, cy = block_centre(c0, pitch, i, j)
        pts = [(cx, cy - 2 * SLOPE * r), (cx + 2 * r, cy), (cx, cy + 2 * SLOPE * r), (cx - 2 * r, cy)]
        d.polygon([(x * k, y * k) for x, y in pts], fill=255)
    g.putalpha(gm)
    canvas.alpha_composite(g)

    # ---- the plate, keyed, split into what stands behind the tower's block and the block itself
    plate = rgba(os.path.join(src, 'plate.png'))
    top_path = os.path.join(src, 'plate-top.jpg')
    if os.path.exists(top_path):
        # the band painted above the plate: scaled to the plate's width, its sky taken out
        band_src = Image.open(top_path).convert('RGB')
        bk = plate.width / band_src.width
        band = band_src.resize((plate.width, round(band_src.height * bk)), Image.LANCZOS)
        extra = band.height - plate.height
        ba = np.asarray(band).astype(np.int32)
        r_, g_, b_ = ba[..., 0], ba[..., 1], ba[..., 2]
        skyish = (b_ > r_ + 30) & (b_ > g_ + 8) & (b_ > 170)
        alpha = np.where(skyish, 0, 255).astype(np.uint8)
        band_rgba = Image.fromarray(np.dstack([ba.astype(np.uint8), alpha]), 'RGBA')
        tall = Image.new('RGBA', (plate.width, band.height))
        tall.alpha_composite(band_rgba.crop((0, 0, plate.width, extra + 60)), (0, 0))
        # the plate itself from the band's foot down, the seam faded over 60 px
        fade = np.ones((plate.height, plate.width), np.float32); fade[:60] = np.linspace(0, 1, 60)[:, None]
        pl = np.asarray(plate).astype(np.float32); pl[..., 3] *= fade
        tall.alpha_composite(Image.fromarray(pl.astype(np.uint8), 'RGBA'), (0, extra))
        plate, plate_y = tall, PLATE_AT[1] - extra
    else:
        plate_y = PLATE_AT[1]
        extra = 0
    # the plate's left and right edges fade into the grid
    pa = np.asarray(plate).astype(np.float32)
    ramp = np.ones(plate.width, np.float32); f = FEATHER
    ramp[:f] = np.linspace(0, 1, f); ramp[-f:] = np.linspace(1, 0, f)
    pa[..., 3] *= ramp[None, :]
    # the tower's block: under the slab's outline (the slab, the lobby, the shops and the street)
    fm = Image.new('L', plate.size, 0); d = ImageDraw.Draw(fm)
    t = (SLAB['top'][0], SLAB['top'][1] + extra); l = (SLAB['left'][0], SLAB['left'][1] + extra); r = (SLAB['right'][0], SLAB['right'][1] + extra)
    d.polygon([t, r, (plate.width, r[1]), (plate.width, plate.height), (0, plate.height), (0, l[1]), l], fill=255)
    fm = fm.filter(ImageFilter.GaussianBlur(3))
    fmask = np.asarray(fm).astype(np.float32) / 255
    behind = pa.copy(); behind[..., 3] *= (1 - fmask)
    front = pa.copy(); front[..., 3] *= fmask
    def place(arr):
        im = Image.fromarray(arr.clip(0, 255).astype(np.uint8), 'RGBA')
        if k != 1:
            im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        return im
    behind_im, front_im = place(behind), place(front)
    at = (round(PLATE_AT[0] * k), round(plate_y * k))

    # ---- back to front: what's behind the tower's block, the plots by their row, the block itself
    if KEEP_PLATE_BEHIND:
        paste(canvas, behind_im, *at)
    tower_row = 0
    order = sorted(PLOTS, key=lambda p: p[0][0] + p[0][1])
    drawn_front = False
    for (i, j), name in order:
        if i + j > tower_row and not drawn_front:
            paste(canvas, front_im, *at); drawn_front = True
        path = next((os.path.join(src, f'{name}.{e}') for e in ('png', 'webp', 'jpg') if os.path.exists(os.path.join(src, f'{name}.{e}'))), None)
        spr, (fx, fy) = plot_sprite(path, k)
        cx, cy = block_centre(c0, pitch, i, j)
        corner = (cx * k, (cy + SLOPE * BLOCK) * k)       # the block's front corner
        paste(canvas, spr, corner[0] - fx, corner[1] - fy)
    if not drawn_front:
        paste(canvas, front_im, *at)
    # the patches, faded in at their left and right edges
    for name, px, py in PATCHES:
        path = os.path.join(src, name)
        if not os.path.exists(path):
            continue
        pt = Image.open(path).convert('RGBA')
        a = np.asarray(pt).astype(np.float32)
        ramp = np.clip(np.minimum(np.arange(pt.width), pt.width - 1 - np.arange(pt.width)) / 50, 0, 1)
        a[..., 3] = 255 * ramp[None, :]
        pt = Image.fromarray(a.astype(np.uint8), 'RGBA')
        if k != 1:
            pt = pt.resize((round(pt.width * k), round(pt.height * k)), Image.LANCZOS)
        paste(canvas, pt, px * k, py * k)
    (canvas if 'nosky' in sys.argv[4:] else canvas.convert('RGB')).save(dst)
    print('wrote', dst, canvas.size)


if __name__ == '__main__':
    main()
