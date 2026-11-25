"""cut-coffee-v3.py: the coffee bar's round 3 art (coffee-shop-v3.csv) cut into the game's pictures.

    python tools/cut-coffee-v3.py <gen dir>      (Grounds/coffee/gen)

- pf-locked.webp: the portafilter locked into the group head, cut from coffee-bar-locked-a where it differs from
  the bar (bg-bar's source, coffee-bar-bg-d-open-a), with its box in % printed for coffee-view.js.
- patch-fridge-milks.webp: the shut fridge with the two milks seen through its glass (coffee-bar-fridge-closed-milks-a).
- carton-milk.webp, carton-oat.webp: the two cartons as painted on the open fridge's upper shelf
  (coffee-bar-fridge-open-milks-a), each with its box in %, so the game stands them exactly there and they can be
  picked up.
- lens-ring, lens-basket, lens-mound, btn-brew: the grind check's lens and the machine's green button (coffee-grind-a).
New names, not the old ones, so phones don't keep the old pictures (sw.js keeps icons across versions).
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from importlib import import_module
cg = import_module('cut-gels')
cc = import_module('cut-coffee')

OUT = os.path.join(HERE, '..', 'icons', 'Coffee')
BAR = 'coffee-bar-bg-d-open-a'
K = 900 / 1536   # the bar's pictures are stored 900 wide


def mask_of(a, b, box, thresh=60):
    x0, y0, x1, y1 = box
    d = np.abs(np.asarray(a).astype(float) - np.asarray(b).astype(float)).sum(axis=2) > thresh
    m = np.zeros(d.shape, bool); m[y0:y1, x0:x1] = d[y0:y1, x0:x1]
    m = ndimage.binary_opening(m, iterations=2)
    m = ndimage.binary_closing(m, iterations=6)
    m = ndimage.binary_fill_holes(m)
    return m


def cut(img, m, name, feather=2.5, grow=4):
    m = ndimage.binary_dilation(m, iterations=grow)
    alpha = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(feather))
    ys, xs = np.nonzero(m)
    bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    p = img.convert('RGBA'); p.putalpha(alpha); p = p.crop((bx0, by0, bx1, by1))
    p = p.resize((round(p.width * K), round(p.height * K)), Image.LANCZOS)
    p.save(os.path.join(OUT, f'{name}.webp'), quality=88, method=6)
    W, H = img.size
    print(f'{name}: left {bx0 / W * 100:.2f}% top {by0 / H * 100:.2f}% width {(bx1 - bx0) / W * 100:.2f}% '
          f'height {(by1 - by0) / H * 100:.2f}%  (bottom {by1 / H * 100:.2f}%, middle x {(bx0 + bx1) / 2 / W * 100:.2f}%)')


def hull(m):
    """A carton's outline: the convex hull of its mask (the take's shadows and reflections left ragged bits)."""
    from scipy.spatial import ConvexHull
    from PIL import ImageDraw
    ys, xs = np.nonzero(m)
    pts = np.stack([xs, ys], 1)
    h = ConvexHull(pts)
    im = Image.new('L', (m.shape[1], m.shape[0]), 0)
    ImageDraw.Draw(im).polygon([tuple(map(float, pts[i])) for i in h.vertices], fill=255)
    return np.asarray(im) > 0


def main():
    gen = sys.argv[1]
    bar = cc.load(gen, BAR).convert('RGB')
    # the locked portafilter: round the group head
    locked = cc.load(gen, 'coffee-bar-locked-a').convert('RGB')
    assert locked.size == bar.size
    m = mask_of(locked, bar, (600, 900, 1400, 1400))
    lab, n = ndimage.label(ndimage.binary_dilation(m, iterations=3))   # the take moved a few specks: keep the biggest
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    cut(locked, m & (lab == int(np.argmax(sizes)) + 1), 'pf-locked')
    # the shut fridge with its milks: the whole fridge's box, like patch-fridge-closed
    shut = cc.load(gen, 'coffee-bar-fridge-closed-milks-a').convert('RGB')
    m = mask_of(shut, bar, (0, 1960, 790, 2730)); m = ndimage.binary_closing(m, iterations=8); m = ndimage.binary_fill_holes(m)
    cut(shut, m, 'patch-fridge-milks', feather=3, grow=6)
    # the two cartons on the open fridge's shelf
    opn = cc.load(gen, 'coffee-bar-fridge-open-milks-a').convert('RGB')
    m = mask_of(opn, bar, (230, 2050, 720, 2450), thresh=90)
    lab, n = ndimage.label(m)
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    big = sorted(np.argsort(sizes)[-2:] + 1, key=lambda l: np.nonzero(lab == l)[1].mean())
    for l, name in zip(big, ['carton-milk', 'carton-oat']):
        cut(opn, hull(ndimage.binary_opening(lab == l, iterations=6)), name, feather=1.2, grow=1)
    # the grind sheet
    sheet = cg.key(cc.load(gen, 'coffee-grind-a'))
    for piece, name in zip(cc.split(sheet, 2, 2, 4), ['lens-ring', 'lens-basket', 'lens-mound', 'btn-brew']):
        cc.save(piece, os.path.join(OUT, f'{name}.webp'), 360)


if __name__ == '__main__':
    main()
