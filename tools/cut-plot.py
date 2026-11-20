"""cut-plot.py: the single-plot base (docs/PLOT.md): the Navy Club map, its 48 x 48 lawn, the platform the
locker room stands on, the platform and the club's buildings (the builders' huts are items).

    python tools/cut-plot.py <map 3x png> <platform repaint> <renders dir>

  <map 3x png>        MOSKE APP/Characters/Photos/Robots/Robots/World map/map-navy-navy-upscale-3x_v2.png (no flags)
  <platform repaint>  MOSKE APP/Characters/Photos/Robots/Robots/Base/final/platform-navy.jpg (on green)
  <renders dir>       <name>-a.png + <name>-a.json: Base/repaint/cut (tools/render-items/cut-base-repaints.py),
                      or render-base-assets.py's plain renders

Writes icons/Plot/ (the map in tiles, each with a small copy; the platform; the club's buildings) and
js/core/plot-art.js. World px are the 3x map's own px: one lawn tile is 102 px across, as in the 32 x 32 rooms.

The lawn: its four straight edges are fitted (its painted corners are rounded by the track) and met, which
gives the grid's back, right, front and left corners. Tiles (u, v) run from the back corner, u down-right, v
down-left, 0 to 48. The platform's floor (inside its painted guide line) is the tiles [P, P + FLOOR) each way,
raised by `lift` world px (all scaled with FLOOR); the platform's body round it is blocked to anything on the lawn.
"""
import json, math, os, sys
import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as nd
Image.MAX_IMAGE_PIXELS = None

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, 'icons', 'Plot')
ART_JS = os.path.join(REPO, 'js', 'core', 'plot-art.js')
N = 48            # the lawn, tiles each way
P = 3             # the platform's floor starts this many tiles in from the lawn's back corner
FLOOR = 23        # the platform's floor, tiles each way: its body reaches the far side of the club's two exits
                  # in the fence (their pillars at u, v = 26.8 on map v4), so the paths to the club house and the
                  # stadium meet its sides
TILE = 1280       # map px per stored tile
STORE_K = 0.75    # stored px per map px
SMALL = 0.25      # a tile's small copy, as a share of its stored size
ART_TAG = 'r9'    # in the platform's and club buildings' names: change it whenever they're repainted
MAP_TAG = 'v4'    # in the tiles' names: change it whenever the map is repainted (sw.js keeps old pictures)
# the platform repaint's guide line, roughly (its px: back, right, front, left corners): platform() fits each
# side as a straight line through the line's own dark px near it and meets them, so these only say where to look
# (measured on Base/final/platform-navy_V4.png; set them again for a new repaint)
GUIDE_ROUGH = [(1196, 640), (2070, 1070), (1224, 1490), (350, 1054)]
RENDER_TILE = 100 * math.sqrt(2)   # a tile's width in render-base-assets.py's pictures (PPU 100, 45 degrees)
# builders, in pad order along the platform's front-right side (back first): pad tiles (square), hut tiles
# (its footprint's longest side; a person is about 1 tile wide and 3.5 tall, so the arch fits one standing)
# (the builders' huts on their pads are items now, set down and moved by the player: js/core/builders.js,
# tools/render-items/make-builders.py)
# the club's buildings on the paving behind the lawn, out of the platform walls' way (tiles past the lawn's edges:
# u < 0 is behind its back-left side, v < 0 behind its back-right), each facing the lawn:
# (who, render, facing, centre u, centre v, longest footprint side in tiles; the centre is its plaza's, measured on
# map-navy-navy-upscale-3x_v2: the paved rectangle's four corners, its entry notch left out)
CLUB = [('stadium', 'stadium-club', 'b', -22.2, 22.4, 16), ('clubhouse', 'clubhouse-modern', 'a', 22.5, -22.5, 13)]


def lawn_corners(path):
    """The lawn's back, right, front and left corners in px of the 3x map (its four edges met)."""
    small = Image.open(path).convert('RGB')
    k = 3484 / small.width
    small = small.resize((3484, round(small.height * k)), Image.BILINEAR)
    a = np.asarray(small).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = (g > r + 25) & (g > b + 30) & (g > 80)
    lab, _ = nd.label(m)
    m = nd.binary_fill_holes(nd.binary_closing(lab == lab[a.shape[0] // 2, a.shape[1] // 2], iterations=6))
    ys, xs = np.nonzero(m)
    L, R, T, B = xs.min(), xs.max(), ys.min(), ys.max()
    bd = m & ~nd.binary_erosion(m)
    yy, xx = np.nonzero(bd)
    cx, cy = (L + R) / 2, (T + B) / 2
    fit = {}
    for nm, sel in [('tl', (xx < cx) & (yy < cy)), ('tr', (xx > cx) & (yy < cy)), ('bl', (xx < cx) & (yy > cy)), ('br', (xx > cx) & (yy > cy))]:
        x, y = xx[sel], yy[sel]
        q = (np.abs(x - cx) > 0.2 * (R - L) / 2) & (np.abs(x - cx) < 0.8 * (R - L) / 2)
        fit[nm] = np.polyfit(x[q], y[q], 1)
    s = 1 / k * (Image.open(path).width / Image.open(path).width)
    def meet(p, q):
        x = (q[1] - p[1]) / (p[0] - q[0]); y = p[0] * x + p[1]
        big = Image.open(path).width / 3484
        return [round(x * big, 1), round(y * big, 1)]
    return {'back': meet(fit['tl'], fit['tr']), 'right': meet(fit['tr'], fit['br']),
            'front': meet(fit['bl'], fit['br']), 'left': meet(fit['tl'], fit['bl'])}


def cut_tiles(path):
    im = Image.open(path).convert('RGB')
    W, H = im.size
    tiles = []
    for ty in range(0, H, TILE):
        for tx in range(0, W, TILE):
            w, h = min(TILE, W - tx), min(TILE, H - ty)
            t = im.crop((tx, ty, tx + w, ty + h))
            sw, sh = round(w * STORE_K), round(h * STORE_K)
            name = f'ground-{MAP_TAG}-{ty // TILE}-{tx // TILE}'
            t.resize((sw, sh), Image.LANCZOS).save(os.path.join(OUT, f'{name}.webp'), quality=82, method=6)
            t.resize((max(1, round(sw * SMALL)), max(1, round(sh * SMALL))), Image.LANCZOS).save(os.path.join(OUT, f'{name}-s.webp'), quality=78, method=6)
            tiles.append({'src': f'icons/Plot/{name}.webp', 'small': f'icons/Plot/{name}-s.webp', 'x': tx, 'y': ty, 'w': w, 'h': h})
    return (W, H), tiles


def key_green(rgb):
    """RGBA from a repaint on flat green: green out, its spill pulled back to grey. A shadow painted as darker
    green on the ground is kept, as soft black (how much darker than the background it is)."""
    a = rgb.astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    green = g - np.maximum(r, b)
    alpha = np.clip(1 - (green - 40) / 60, 0, 1)
    alpha = nd.gaussian_filter(alpha, 0.7)
    g2 = np.minimum(g, np.maximum(r, b) + 6)
    bg = np.median(g[green > 120]) if (green > 120).any() else 255
    shade = np.clip((bg - g) / bg * 1.3, 0, 0.75) * (1 - alpha)     # only where it's background
    shade = nd.gaussian_filter(shade, 2)
    a_out = alpha + shade * (1 - alpha)
    k = np.where(a_out > 1e-3, alpha / np.maximum(a_out, 1e-3), 1)    # the object's share of the colour
    out = np.dstack([r * k, g2 * k, b * k, a_out * 255]).clip(0, 255).astype(np.uint8)
    return out


def guide_corners(rgb, alpha):
    """The floor's guide line on the platform repaint: each side fitted as a straight line (least squares on the
    line's own dark px within reach of GUIDE_ROUGH's side, twice, the second time without stray px) and the four
    met. The corners (back, right, front, left) are on the line's middle."""
    lum = rgb.astype(float).mean(2)
    dark = (lum < 0.62 * nd.median_filter(lum, size=31)) & (alpha > 200)
    dy, dx = np.nonzero(dark)
    fits = []
    for i in range(4):
        (x0, y0), (x1, y1) = GUIDE_ROUGH[i], GUIDE_ROUGH[(i + 1) % 4]
        L = math.hypot(x1 - x0, y1 - y0); ux, uy = (x1 - x0) / L, (y1 - y0) / L
        t = (dx - x0) * ux + (dy - y0) * uy; d = -(dx - x0) * uy + (dy - y0) * ux
        sel = (t > 0.08 * L) & (t < 0.92 * L) & (np.abs(d) < 45)
        a, c = np.polyfit(dx[sel], dy[sel], 1)
        near = np.abs(dy[sel] - (a * dx[sel] + c)) / math.hypot(a, 1) < 6
        fits.append(np.polyfit(dx[sel][near], dy[sel][near], 1))
    out = []
    for i in range(4):
        (a1, c1), (a2, c2) = fits[(i - 1) % 4], fits[i]
        x = (c2 - c1) / (a1 - a2); out.append((x, a1 * x + c1))
    print('guide line slopes', [round(float(f[0]), 4) for f in fits])
    return out


def platform(path, world):
    """The repainted platform, keyed and placed so its guide line's corners sit on the floor's tiles, raised."""
    rgb = np.asarray(Image.open(path).convert('RGB'))
    rgba = key_green(rgb)
    h, w = rgb.shape[:2]
    top, right, bot, left = guide_corners(rgb, rgba[..., 3])
    # the floor's height: down the front corner's column, from the floor's front edge (the top of the navy band
    # under the rim) to the platform's foot (its last solid px)
    col = int(round(bot[0]))
    c = rgb[:, col].astype(int)
    edge = next(y for y in range(int(bot[1]) + 8, h) if c[y, 2] > c[y, 0] + 25 and c[y].mean() < 120)
    foot = max(np.nonzero(rgba[:, col, 3] > 200)[0])
    tgt = lambda u, v: world(u, v)
    s = (tgt(P + FLOOR, P)[0] - tgt(P, P + FLOOR)[0]) / (right[0] - left[0])
    lift = s * (foot - edge)
    rim = s * (edge - bot[1]) / ((tgt(1, 1)[1] - tgt(0, 0)[1]))    # tiles round the guide line, in the plan
    # the guide line's four corners onto the raised grid's with an affine map (least squares; four corners, six
    # numbers, so it lands them all within a hair): x = a x + b y + c, y = d x + e y + f. A repaint's slight skew
    # tilts its walls by about b (V4: 1.6 degrees), small enough not to show
    src = np.float64([top, right, bot, left])
    dst = np.float64([np.array(tgt(u, v)) - [0, lift] for u, v in ((P, P), (P + FLOOR, P), (P + FLOOR, P + FLOOR), (P, P + FLOOR))])
    S3 = np.c_[src, np.ones(4)]
    (a, b, c), *_ = np.linalg.lstsq(S3, dst[:, 0], rcond=None)
    (d, e, f), *_ = np.linalg.lstsq(S3, dst[:, 1], rcond=None)
    M = np.array([[a, b, c], [d, e, f], [0, 0, 1]])
    off = np.abs((S3 @ M[:2].T) - dst).max() / TILE_W
    # the picture's own corners, placed: its box in world px
    X, Y = (np.c_[[0, w, w, 0], [0, 0, h, h], np.ones(4)] @ M[:2].T).T
    x0, y0, x1, y1 = X.min(), Y.min(), X.max(), Y.max()
    k = STORE_K; W, H = math.ceil((x1 - x0) * k), math.ceil((y1 - y0) * k)
    # stored px (i, j) -> world (x0 + i / k, y0 + j / k) -> the repaint's px
    to_world = np.array([[1 / k, 0, x0], [0, 1 / k, y0], [0, 0, 1]])
    inv = np.linalg.inv(M) @ to_world
    im = Image.fromarray(rgba, 'RGBA').convert('RGBa')
    im = im.transform((W, H), Image.AFFINE, tuple(inv[:2].ravel()), resample=Image.BICUBIC).convert('RGBA')
    im.save(os.path.join(OUT, f'platform-{FLOOR}-{ART_TAG}.webp'), quality=88, method=6)
    print('platform fit', np.round(M[:2], 4).tolist(), 'walls lean', round(math.degrees(math.atan2(b, e)), 2), 'deg, worst corner', round(off, 4), 'tiles off')
    print('platform scale', round(s, 4), 'lift', round(lift, 1), 'rim tiles', round(rim, 2))
    return {'src': f'icons/Plot/platform-{FLOOR}-{ART_TAG}.webp', 'x': round(float(x0), 1), 'y': round(float(y0), 1), 'w': round(float(x1 - x0), 1),
            'h': round(float(y1 - y0), 1), 'at': P, 'size': FLOOR, 'lift': round(lift, 1), 'rim': round(rim, 2)}


def piece(renders, name, centre, store, tiles, face='a'):
    """A render placed with its footprint's middle (the json's origin) on `centre` (world px), its footprint's
    longest side `tiles` tiles."""
    meta = json.load(open(os.path.join(renders, f'{name}-{face}.json')))
    im = Image.open(os.path.join(renders, f'{name}-{face}.png')).convert('RGBA')
    s = TILE_W / RENDER_TILE * tiles / meta['tiles']
    bb = im.getchannel('A').point(lambda v: 255 if v > 3 else 0).getbbox()
    im = im.crop(bb); ox, oy = meta['ox'] - bb[0], meta['oy'] - bb[1]
    im.resize((round(im.width * s * STORE_K), round(im.height * s * STORE_K)), Image.LANCZOS).save(os.path.join(OUT, f'{store}.webp'), quality=88, method=6)
    return {'src': f'icons/Plot/{store}.webp', 'x': round(centre[0] - ox * s, 1), 'y': round(centre[1] - oy * s, 1),
            'w': round(im.width * s, 1), 'h': round(im.height * s, 1)}


def main():
    global TILE_W
    mp, rep, renders = sys.argv[1:4]
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.startswith(('ground-', 'pad-', 'hut-', 'platform-', 'club-')): os.remove(os.path.join(OUT, f))
    lawn = lawn_corners(mp)
    print('lawn', lawn)
    B, Rr, L = np.array(lawn['back']), np.array(lawn['right']), np.array(lawn['left'])
    world = lambda u, v: tuple(B + (Rr - B) * u / N + (L - B) * v / N)
    TILE_W = (Rr[0] - L[0]) / N
    (W, H), tiles = cut_tiles(mp)
    plat = platform(rep, world)
    body = math.ceil(P + FLOOR + plat['rim'])         # the platform's body reaches this far, from the back
    # the stairs come down the front-left side, their foot from 8/23 to 14/23 of the way along the floor from its
    # left end, 4 tiles out from the platform at FLOOR 23 (measured on platform-navy_V4 at FLOOR 23)
    k = FLOOR / 23
    stairs = [round(P + 8 * k), body, round(P + 14 * k), body + round(4 * k)]
    blocked = [[0, 0, body, P], [0, P, P, body], [P + FLOOR, P, body, body], [P, P + FLOOR, P + FLOOR, body], stairs]
    # the way up: the stairs' middle 3 tiles and the rim above them can be walked on (never built on); the
    # ground rises up the stairs from the lawn (v = stairs' foot) to the platform's top (v = body)
    mid = (stairs[0] + stairs[2]) // 2
    walk = [[mid - 1, P + FLOOR, mid + 2, stairs[3]]]
    plat['top'] = [P, P, body, body]
    plat['ramp'] = stairs
    club = [{'who': who, 'u': u, 'v': v, 'size': size, 'pic': piece(renders, name, world(u, v), f'club-{who}-{ART_TAG}', size, face)}
            for who, name, face, u, v, size in CLUB]
    art = {'world': {'w': W, 'h': H}, 'tiles': tiles, 'grid': N, 'lawn': lawn, 'tileW': round(TILE_W, 3),
           'platform': plat, 'blocked': blocked, 'walk': walk, 'club': club}
    with open(ART_JS, 'w', encoding='utf-8') as f:
        f.write('// plot-art.js: the single-plot base\'s pictures and where they stand, in world px (the 3x map\'s px).\n'
                '// Written by tools/cut-plot.py. Don\'t edit by hand.\n')
        f.write('export const PLOT_ART = ' + json.dumps(art, indent=1) + ';\n')
    print(len(tiles), 'tiles', W, H)


if __name__ == '__main__':
    main()
