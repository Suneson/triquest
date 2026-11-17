"""
A building's repaint (on flat green, from PromptQueue) made into a render-like PNG for
cut-grounds.py: the green keyed out, the model fully solid, and a soft contact shadow under it
(the repaint's own shadow is green too, so it's drawn anew: a blurred copy of the footprint,
nudged to the left as the map's sun throws it).

  python tools/key-paint.py "<repaint.jpg>" "<renders dir>/<name>.png" ["<the render it was painted over>.png"]

Given the render, its own floor shadow is used instead: the painted building is scaled and moved
onto the render's (by the outline of each), so it stands in the render's real contact shadow.
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


def on_render(src, out, render):
    a = keyed(src)
    solid = a[..., 3] > 200
    r = np.asarray(Image.open(render).convert('RGBA'))
    rs = r[..., 3] > 250
    ys, xs = np.where(solid); py0, py1, px0, px1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    ys, xs = np.where(rs); ry0, ry1, rx0, rx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    box, size = (px0, py0, px1, py1), (rx1 - rx0, ry1 - ry0)
    p = np.asarray(Image.fromarray(a, 'RGBA').crop(box).resize(size, Image.LANCZOS))
    raw = np.asarray(Image.open(src).convert('RGB').crop(box).resize(size, Image.LANCZOS))
    ps = p[..., 3] > 200
    res = np.zeros_like(r)
    res[..., 3] = np.where(rs, 0, r[..., 3])            # the render's shadow, black
    sub = res[ry0:ry1, rx0:rx1]
    # the model's own outline is solid: the painting's colour there, keyed or not (the bushes by
    # the door are green, so the key takes them out)
    rr, gg, bb = (raw[..., i].astype(np.int32) for i in range(3))
    # the green backdrop and its darker green shadow, not a bush (which has some red and blue in it)
    screen = ((gg > 150) & (gg > 1.5 * np.maximum(rr, bb))) | ((gg > 50) & (np.maximum(rr, bb) < 45) & (gg > 2 * np.maximum(rr, bb)))
    model = rs[ry0:ry1, rx0:rx1] & ~ps & ~screen
    sub[model, :3] = raw[model]; sub[model, 3] = 255
    # where the render's model stood but the painting has none, the shadow carries on under it
    ring = ndi.binary_dilation(rs, iterations=6) & ~rs
    gap = rs[ry0:ry1, rx0:rx1] & ~ps & ~model
    sub[gap, :3] = 0; sub[gap, 3] = int(np.median(r[ring, 3]))
    sub[ps] = p[ps]
    sub[ps, 3] = 255
    Image.fromarray(res, 'RGBA').save(out)
    print(out, res.shape[1], res.shape[0])


if __name__ == '__main__':
    if len(sys.argv) > 3:
        on_render(*sys.argv[1:4])
    else:
        main(*sys.argv[1:3])
