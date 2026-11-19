"""cut-plot.py: the single-plot base (docs/PLOT.md): the Navy Club map, its 48 x 48 lawn, the platform the
locker room stands on, and the builders' pads and huts.

    python tools/cut-plot.py <map 3x png> <platform repaint> <renders dir>

  <map 3x png>        MOSKE APP/Characters/Photos/Robots/Robots/World map/map-navy-navy-upscale-3x_v2.png (no flags)
  <platform repaint>  MOSKE APP/Characters/Photos/Robots/Robots/Base/final/platform-navy.jpg (on green)
  <renders dir>       tools/render-items/render-base-assets.py's renders: <name>-a.png + <name>-a.json

Writes icons/Plot/ (the map in tiles, each with a small copy; the platform; the pads and huts) and
js/core/plot-art.js. World px are the 3x map's own px: one lawn tile is 102 px across, as in the 32 x 32 rooms.

The lawn: its four straight edges are fitted (its painted corners are rounded by the track) and met, which
gives the grid's back, right, front and left corners. Tiles (u, v) run from the back corner, u down-right, v
down-left, 0 to 48. The platform's floor (inside its painted guide line) is the tiles [P, P + 32) each way,
raised by `lift` world px; the platform's body round it is blocked to anything on the lawn.
"""
import json, math, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
Image.MAX_IMAGE_PIXELS = None

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, 'icons', 'Plot')
ART_JS = os.path.join(REPO, 'js', 'core', 'plot-art.js')
N = 48            # the lawn, tiles each way
P = 3             # the platform's floor starts this many tiles in from the lawn's back corner
FLOOR = 32        # the platform's floor, tiles each way
TILE = 1280       # map px per stored tile
STORE_K = 0.75    # stored px per map px
SMALL = 0.25      # a tile's small copy, as a share of its stored size
MAP_TAG = 'v2'    # in the tiles' names: change it whenever the map is repainted (sw.js keeps old pictures)
RENDER_TILE = 100 * math.sqrt(2)   # a tile's width in render-base-assets.py's pictures (PPU 100, 45 degrees)
# builders, in pad order along the platform's front-right side (back first): pad tiles (square), hut tiles
# (its footprint's longest side; a person is about 1 tile wide and 3.5 tall, so the arch fits one standing)
BUILDERS = [('blue', 5, 4.4), ('red', 5, 4.4), ('green', 5, 4.4), ('gold', 4.5, 3.6)]
PAD_STEP = 7      # tiles from one pad to the next


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
    """RGBA from a repaint on flat green: green out, its spill pulled back to grey."""
    a = rgb.astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    green = g - np.maximum(r, b)
    alpha = np.clip(1 - (green - 40) / 60, 0, 1)
    alpha = nd.gaussian_filter(alpha, 0.7)
    g2 = np.minimum(g, np.maximum(r, b) + 6)
    out = np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    return out


def platform(path, world):
    """The repainted platform, keyed, scaled and placed so its guide line sits on the floor's tiles, raised."""
    rgb = np.asarray(Image.open(path).convert('RGB'))
    rgba = key_green(rgb)
    h, w = rgb.shape[:2]
    lum = rgb.astype(int).sum(2) / 3
    pale = (lum > 150) & (rgba[..., 3] > 200)
    lab, _ = nd.label(pale)
    k = lab[int(h * 0.55), int(w * 0.5)]
    m = nd.binary_fill_holes(lab == k)
    ys, xs = np.nonzero(m)
    top = (xs[np.argmin(ys)], ys.min()); bot = (xs[np.argmax(ys)], ys.max())
    left = (xs.min(), ys[np.argmin(xs)]); right = (xs.max(), ys[np.argmax(xs)])
    # the floor's height: down the front corner's column, from the top's front edge (the first dark px past
    # the pale rim under the guide line) to the platform's foot (its last opaque px)
    col = int(bot[0]); y = int(bot[1]) + 4
    while y < h - 1 and lum[y, col] > 120: y += 1        # the guide line, then the pale rim
    while y < h - 1 and lum[y, col] < 120 and y < bot[1] + 40: y += 1
    while y < h - 1 and lum[y, col] > 120: y += 1        # the rim
    edge = y
    foot = max(np.nonzero(rgba[:, col, 3] > 128)[0])
    tgt = lambda u, v: world(u, v)
    s = (tgt(P + FLOOR, P)[0] - tgt(P, P + FLOOR)[0]) / (right[0] - left[0])
    lift = s * (foot - edge)
    rim = s * (edge - bot[1]) / ((tgt(1, 1)[1] - tgt(0, 0)[1]))    # tiles round the guide line, in the plan
    bx, by = tgt(P, P)
    x0 = bx - s * top[0]; y0 = by - lift - s * top[1]
    im = Image.fromarray(rgba)
    ow, oh = round(w * s * STORE_K), round(h * s * STORE_K)
    im.resize((ow, oh), Image.LANCZOS).save(os.path.join(OUT, 'platform.webp'), quality=88, method=6)
    print('platform scale', round(s, 4), 'lift', round(lift, 1), 'rim tiles', round(rim, 2))
    return {'src': 'icons/Plot/platform.webp', 'x': round(x0, 1), 'y': round(y0, 1), 'w': round(w * s, 1), 'h': round(h * s, 1),
            'at': P, 'size': FLOOR, 'lift': round(lift, 1), 'rim': round(rim, 2)}


def piece(renders, name, centre, store, tiles):
    """A render placed with its footprint's middle (the json's origin) on `centre` (world px), its footprint's
    longest side `tiles` tiles."""
    meta = json.load(open(os.path.join(renders, f'{name}-a.json')))
    im = Image.open(os.path.join(renders, f'{name}-a.png')).convert('RGBA')
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
        if f.startswith('ground-'): os.remove(os.path.join(OUT, f))
    lawn = lawn_corners(mp)
    print('lawn', lawn)
    B, Rr, L = np.array(lawn['back']), np.array(lawn['right']), np.array(lawn['left'])
    world = lambda u, v: tuple(B + (Rr - B) * u / N + (L - B) * v / N)
    TILE_W = (Rr[0] - L[0]) / N
    (W, H), tiles = cut_tiles(mp)
    plat = platform(rep, world)
    body = math.ceil(P + FLOOR + plat['rim'])         # the platform's body reaches this far, from the back
    # the stairs come down the front-left side, near its left end (measured on the repaint)
    stairs = [13, body, 21, body + 5]
    blocked = [[0, 0, body, P], [0, P, P, body], [P + FLOOR, P, body, body], [P, P + FLOOR, P + FLOOR, body], stairs]
    pads, u0 = [], body + 1
    for i, (who, size, hut) in enumerate(BUILDERS):
        v = P + 1 + i * PAD_STEP
        c = world(u0 + size / 2, v + size / 2)
        pads.append({'who': who, 'u': u0, 'v': v, 'size': size,
                     'pad': piece(renders, f'pad-navy-{who}', c, f'pad-{who}', size),
                     'hut': piece(renders, f'hut-navy-{who}', (c[0], c[1] - 0.12 * TILE_W), f'hut-{who}', hut)})
        blocked.append([u0, v, u0 + size, v + size])
    art = {'world': {'w': W, 'h': H}, 'tiles': tiles, 'grid': N, 'lawn': lawn, 'tileW': round(TILE_W, 3),
           'platform': plat, 'blocked': blocked, 'pads': pads}
    with open(ART_JS, 'w', encoding='utf-8') as f:
        f.write('// plot-art.js: the single-plot base\'s pictures and where they stand, in world px (the 3x map\'s px).\n'
                '// Written by tools/cut-plot.py. Don\'t edit by hand.\n')
        f.write('export const PLOT_ART = ' + json.dumps(art, indent=1) + ';\n')
    print(len(tiles), 'tiles', W, H)


if __name__ == '__main__':
    main()
