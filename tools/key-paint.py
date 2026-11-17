"""
A building's repaint (on flat green, from PromptQueue) made into a render-like PNG for
cut-grounds.py: the green keyed out, the model fully solid, and a soft contact shadow under it
(the repaint's own shadow is green too, so it's drawn anew: a blurred copy of the footprint,
nudged to the left as the map's sun throws it).

  python tools/key-paint.py "<repaint.jpg>" "<renders dir>/<name>.png"
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi


def keyed(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    frac = (g - np.maximum(r, b)) / np.maximum(g, 1)
    alpha = np.clip((0.55 - frac) / 0.3, 0, 1)
    core = ndi.binary_opening(alpha > 0.9, iterations=2)
    lab, n = ndi.label(core)
    if n:
        sizes = ndi.sum(core, lab, range(1, n + 1))
        keep = [i + 1 for i, s in enumerate(sizes) if s > sizes.max() * 0.002]   # the model and its pots
        core = np.isin(lab, keep)
    core = ndi.binary_fill_holes(core)
    alpha = np.where(ndi.binary_dilation(core, iterations=3), alpha, 0)
    g2 = np.minimum(g, np.maximum(r, b) * 1.04 + 4)
    return np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8)


def main(src, out):
    a = keyed(src)
    solid = a[..., 3] > 200
    a[..., 3] = np.where(solid, 255, 0)              # cut-grounds reads alpha > 250 as the model
    ys, xs = np.where(solid)
    h = float(ys.max() - ys.min())
    # the shadow: the model's lower third, squashed onto the ground, blurred and moved left
    foot = np.zeros_like(solid)
    low = ys.max() - h * 0.33
    foot[int(low):] = solid[int(low):]
    sh = Image.fromarray((foot * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(h * 0.03))
    sh = np.roll(np.asarray(sh).astype(np.float32), (int(h * 0.01), -int(h * 0.04)), (0, 1))
    shadow = (sh / 255 * 200).astype(np.uint8)
    pad = int(h * 0.08)
    big = np.zeros((a.shape[0] + 2 * pad, a.shape[1] + 2 * pad, 4), np.uint8)
    big[pad:-pad, pad:-pad, 3] = np.where(solid, 0, shadow)
    big[pad:-pad, pad:-pad][solid] = a[solid]
    Image.fromarray(big, 'RGBA').save(out)
    print(out, big.shape[1], big.shape[0])


if __name__ == '__main__':
    main(*sys.argv[1:3])
