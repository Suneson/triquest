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


def base_lines(solid):
    """A building's base, from its outline's bottom: the line along its left face and along its right
    face (y = m x + c each, px of `solid`), fitted where no pot or bush stands in front of the wall
    (by the door, on the left face), points well below the line (a pot) left out."""
    cols = np.where(solid.any(0))[0]
    x0, x1 = cols[0], cols[-1]; W = x1 - x0
    bot = np.full(solid.shape[1], -1.0)
    bot[cols] = [np.where(solid[:, c])[0].max() for c in cols]

    def fit(spans):
        xs = np.concatenate([np.arange(int(x0 + a * W), int(x0 + b * W)) for a, b in spans])
        ys = bot[xs]; keep = ys >= 0
        for _ in range(4):
            m, c = np.polyfit(xs[keep], ys[keep], 1)
            r = ys - (m * xs + c); keep = keep & (r < max(4, 2 * np.median(np.abs(r[keep]))))
        return m, c
    left = fit([(0.12, 0.24), (0.42, 0.52)])
    right = fit([(0.66, 0.95)])
    xf = (right[1] - left[1]) / (left[0] - right[0])
    return x0, xf, x1, left, right


def fit_base(img, solid, target):
    """`img` (and its outline `solid`) moved column by column so its base lies on `target`'s: the
    left edge, front corner and right edge matched (a stretch each side of the front corner) and
    each column shifted up or down so the base lines meet. Walls stay upright."""
    px0, pxf, px1, pl, pr = base_lines(solid)
    tx0, txf, tx1, tl, tr = base_lines(target)
    H, W = solid.shape
    X = np.arange(W, dtype=np.float64)
    sx = np.interp(X, [tx0, txf, tx1], [px0, pxf, px1])            # the painting's column for each
    base = lambda x, l, r, f: np.where(x <= f, l[0] * x + l[1], r[0] * x + r[1])
    dy = base(sx, pl, pr, pxf) - base(X, tl, tr, txf)                 # painting row - target row
    sxi = np.clip(np.rint(sx).astype(int), 0, W - 1)
    rows = np.arange(H)[:, None] + np.rint(dy).astype(int)[None, :]
    ok = (rows >= 0) & (rows < H)
    rows = np.clip(rows, 0, H - 1)
    outimg = img[rows, sxi[None, :]]
    outimg[~ok] = 0
    print('base fit: front corner %.0f -> %.0f, shift %.0f..%.0f px' % (pxf, txf, dy.min(), dy.max()))
    return outimg


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
    # the painting's base onto the render's, so the building stands square on the map's paving
    both = fit_base(np.dstack([p, raw]), p[..., 3] > 200, rs[ry0:ry1, rx0:rx1])
    p, raw = np.ascontiguousarray(both[..., :4]), np.ascontiguousarray(both[..., 4:])
    ps = p[..., 3] > 200
    res = np.zeros_like(r)
    res[..., 3] = np.where(rs, 0, r[..., 3])            # the render's shadow, black
    sub = res[ry0:ry1, rx0:rx1]
    # the model's own outline is solid: the painting's colour there, keyed or not (the bushes by
    # the door are green, so the key takes them out)
    rr, gg, bb = (raw[..., i].astype(np.int32) for i in range(3))
    # the green backdrop and its darker green shadow, not a bush (which has some red and blue in it)
    screen = ((gg > 150) & (gg > 1.5 * np.maximum(rr, bb))) | ((gg > 50) & (np.maximum(rr, bb) < 45) & (gg > 2 * np.maximum(rr, bb)))
    # only a bush or a pot's dark navy: anything pale there is the painting's ground, not the model
    # (it showed as a light halo by the pots)
    # (a bush is a big blob of green; a thin green strip along the base is the screen's shadow)
    bush = ndi.binary_opening((gg > rr + 6) & (gg > bb + 6) & ~screen, iterations=6)
    lab, n = ndi.label(bush)
    for i, sl in enumerate(ndi.find_objects(lab), 1):   # a bush is round; a wide flat strip is not
        if (sl[0].stop - sl[0].start) < 0.5 * (sl[1].stop - sl[1].start): bush[lab == i] = False
    plant = bush | ((bb >= gg) & (np.maximum(np.maximum(rr, gg), bb) < 140))
    model = rs[ry0:ry1, rx0:rx1] & ~ps & ~screen & plant
    sub[model, :3] = raw[model]; sub[model, 3] = 255
    # where the render's model stood but the painting has none, the shadow carries on under it
    # (only near the ground: higher up, where the render's roof stands past the painting's, it's air),
    # as dark as the shadow just round it
    gap = rs[ry0:ry1, rx0:rx1] & ~ps & ~model
    rc = rs[ry0:ry1, rx0:rx1]
    yy = np.arange(rc.shape[0])[:, None]
    top = np.where(rc.any(0), rc.argmax(0), rc.shape[0])
    low = np.where(rc.any(0), rc.shape[0] - 1 - rc[::-1].argmax(0), 0)
    gap &= yy >= (top + low)[None, :] / 2
    _, (iy, ix) = ndi.distance_transform_edt(rs, return_indices=True)   # the nearest shadow pixel
    shade = ndi.gaussian_filter(r[..., 3][iy, ix].astype(np.float32), 12)[ry0:ry1, rx0:rx1] * 0.7
    shade = shade.astype(np.uint8)
    sub[gap, :3] = 0; sub[gap, 3] = shade[gap]
    sub[ps] = p[ps]
    sub[ps, 3] = 255
    Image.fromarray(res, 'RGBA').save(out)
    print(out, res.shape[1], res.shape[0])


if __name__ == '__main__':
    if len(sys.argv) > 3:
        on_render(*sys.argv[1:4])
    else:
        main(*sys.argv[1:3])
