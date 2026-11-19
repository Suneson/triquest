"""make-builders.py: each builder's hut standing on its pad, as one item picture per facing
(icons/Items/builder-<who>-2-<a|b>.webp; the 2 changes whenever they're redone), so the plot base can place,
move and turn them like any item.

    python tools/render-items/make-builders.py <cut dir>

<cut dir>  Base/repaint/cut: pad-navy-<who>-<a|b>.png and hut-navy-<who>-<a|b>.png (cut-base-repaints.py)

The hut stands in the middle of its pad and nearly fills it: its base sits inside the pad's inner border line,
the same small gap all round (HUT: the base's width as a share of the border's). Both are measured on the
pictures themselves, not taken from the renders' numbers (the repaints moved things a little):
  - the pad: the pale field inside its inner border line (its four corners);
  - the hut: its navy plinth at the foot (its left and right ends, and its lowest point, the front corner).
    Where a door, a bench or a kettlebell hides or stretches the plinth, BASE sets the ends by hand (measured
    on the pictures, checked against the hut's other facing, which has the same width).
The item's footprint is the pad's.
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'icons', 'Items')
HUT = 0.92       # the hut's base width, as a share of the pad's inner border's
HEIGHT = 720     # the stored picture's height, as the other items
# hand-set plinth ends (px of the hut's picture): {'<who>-<face>': {'xl' | 'xr' | 'yf': px}}
BASE = {'blue-a': {'xl': 54}, 'red-a': {'xl': 50}, 'red-b': {'xr': 372}, 'gold-a': {'xl': 55}}


def pad_field(im):
    """The pale field inside a pad's inner border line: its corners (back, right, front, left)."""
    a = np.asarray(im).astype(float)
    al = a[..., 3]; lum = a[..., :3].mean(2)
    ys, xs = np.nonzero(al > 200)
    yb = ys.min(); xb = xs[ys == yb].mean(); W = xs.max() - xs.min()
    seed = (int(yb + W / 5), int(xb))   # on the pad's top, near its back
    lab, _ = nd.label((lum > lum[seed] - 28) & (al > 200))
    m = nd.binary_fill_holes(nd.binary_opening(lab == lab[seed], iterations=2))
    ys, xs = np.nonzero(m)
    return np.float64([(xs[np.argmin(ys)], ys.min()), (xs.max(), ys[np.argmax(xs)]), (xs[np.argmax(ys)], ys.max()), (xs.min(), ys[np.argmin(xs)])])


def plinth(im, fix):
    """A hut's navy plinth at its foot: its left and right ends and its lowest point."""
    a = np.asarray(im).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    lum = (r + g + b) / 3
    ys, xs = np.nonzero(al > 200); bot, top = ys.max(), ys.min()
    navy = (b > r + 18) & (b > g + 8) & (lum < 150) & (lum > 55) & (al > 200)
    navy[: int(bot - 0.3 * (bot - top))] = False
    navy = nd.binary_opening(navy, iterations=1)
    lab, n = nd.label(navy)
    sizes = nd.sum(navy, lab, range(1, n + 1))
    m = np.isin(lab, np.nonzero(sizes > 0.15 * sizes.max())[0] + 1)
    ys, xs = np.nonzero(m)
    return fix.get('xl', xs.min()), fix.get('xr', xs.max()), fix.get('yf', ys.max())


def main():
    cut = sys.argv[1]
    for who in ('blue', 'red', 'green', 'gold'):
        for face in 'ab':
            key = f'{who}-{face}'
            pad = Image.open(os.path.join(cut, f'pad-navy-{key}.png')).convert('RGBA')
            hut = Image.open(os.path.join(cut, f'hut-navy-{key}.png')).convert('RGBA')
            f = pad_field(pad)
            fx, fy = f.mean(0); fw = f[1, 0] - f[3, 0]
            xl, xr, yf = plinth(hut, BASE.get(key, {}))
            s = HUT * fw / (xr - xl)
            hut = hut.resize((round(hut.width * s), round(hut.height * s)), Image.LANCZOS)
            # the base's middle (2:1: a quarter of its width above its front corner) on the field's
            bx, by = (xl + xr) / 2 * s, (yf - (xr - xl) / 4) * s
            hx, hy = fx - bx, fy - by
            x0, y0 = min(0, hx), min(0, hy)
            x1, y1 = max(pad.width, hx + hut.width), max(pad.height, hy + hut.height)
            c = Image.new('RGBA', (round(x1 - x0), round(y1 - y0)), (0, 0, 0, 0))
            c.alpha_composite(pad, (round(-x0), round(-y0)))
            c.alpha_composite(hut, (round(hx - x0), round(hy - y0)))
            c = c.crop(c.getchannel('A').point(lambda v: 255 if v > 3 else 0).getbbox())
            c = c.resize((round(c.width * HEIGHT / c.height), HEIGHT), Image.LANCZOS)
            c.save(os.path.join(OUT, f'builder-{who}-2-{face}.webp'), quality=88, method=6)
            print(f'builder-{who}-2-{face}', c.size, 'hut scale', round(s, 3))


if __name__ == '__main__':
    main()
