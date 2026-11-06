"""cutout-green.py — cut a batch of repainted item sheets (a | b on a green screen) into
icons/Items/<item>-<a|b>.webp, each with its painted shadow as a soft black shadow.

    python tools/render-items/cutout-green.py "<batch folder>" [--preview out.png]

Each sheet holds two objects side by side: left is facing a (front down-left), right is
facing b (front down-right). The screen is a Gemini repaint: green with a slight vignette,
and the painted shadow is the same green, darker. So three things are told apart:
  - the object: its pixels aren't mostly green;
  - its shadow: green, darker than the screen around it, near the object. It fades out with
    distance, which also hides a shadow the repaint clipped at the edge of its frame;
  - the screen: everything else.
Build-time only (Pillow, numpy, scipy).
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'icons', 'Items')

# file in the batch -> the item's name in icons/Items
BATCH = {
    '001_drinks-fridge.jpg': 'drinks-fridge',
    '003_ice-bath.jpg': 'ice-bath',
    '004_kettlebell-set.jpg': 'kettlebell-set',
    '006_massage-table.jpg': 'massage-table',
    '008_race-podium.jpg': 'race-podium',
    '010_rowing-machine.jpg': 'rowing-machine',
    '012_trophy-cabinet-t1.jpg': 'trophy-cabinet-t1',
    '013_trophy-cabinet-t2.jpg': 'trophy-cabinet-t2',
    'lockers_1.jpg': 'lockers-t1',
    'Lockers_2.jpg': 'lockers-t2',
    'bike stand.JPG': 'bike-workstand',
    'pool jumper.jpg': 'start-block',
    'punching bag.jpg': 'punching-bag',
    'shoe rack.jpg': 'shoe-rack',
    'treadmill t1.JPG': 'treadmill-t1',
    'treadmill t2.jpg': 'treadmill-t2',
    'treadmill t3.JPG': 'treadmill-t3',
    'treadmill t4.JPG': 'treadmill-t4',
    'weight rack.jpg': 'dumbbell-rack',
}
MAX_SIDE = 720
SHADOW_MAX = 0.62    # the shadow's darkest; under measure-items.py's 200/255, so it isn't measured as object
SHADOW_REACH = 0.16  # how far a shadow may reach from its object, as a share of the object's size


def screen_level(g, is_screen):
    """The screen's brightness everywhere: the vignette, from the plain screen pixels."""
    k = 1 / 8
    small_g = ndi.zoom(g, k, order=1)
    small_m = ndi.zoom(is_screen.astype(np.float32), k, order=1)
    blur_m = ndi.gaussian_filter(small_m, 30)
    level = ndi.gaussian_filter(small_g * small_m, 30) / np.maximum(blur_m, 1e-3)
    level = ndi.zoom(level, (g.shape[0] / level.shape[0], g.shape[1] / level.shape[1]), order=1)
    return np.maximum(level, 180)


def key(rgb):
    r, g, b = (rgb[..., i].astype(np.float32) for i in range(3))
    top = np.maximum(r, b)
    green = g - top
    frac = green / np.maximum(g, 1)
    # the object: not mostly green. Soft across the edge, where it blends into the screen.
    obj = np.clip((0.62 - frac) / 0.34, 0, 1)
    # a dark object's edge is mostly green by fraction but not by amount: the screen is 230+ of it
    level = screen_level(g, (frac > 0.85) & (g > 190))
    amount = np.clip(1 - green / (level * 0.62), 0, 1)
    obj = np.where(g > level * 0.55, np.maximum(obj, amount * (frac < 0.82)), obj)
    core = ndi.binary_opening(obj > 0.9, iterations=2)
    # drop specks; keep what's big enough to be part of an object
    lab, n = ndi.label(ndi.binary_dilation(core, iterations=3))
    sizes = ndi.sum(core, lab, range(1, n + 1))
    big = np.isin(lab, [i + 1 for i, z in enumerate(sizes) if z > core.sum() * 0.0015])
    core &= big
    obj = np.where(ndi.binary_dilation(core, iterations=4), obj, 0)
    # the shadow: how much darker than the screen the green is, fading with distance from the object
    dark = np.clip(1 - g / level, 0, 1) * (frac > 0.6)
    return obj, core, np.where(dark > 0.05, dark, 0)


def split_at(core):
    """The empty column between the two objects (the widest gap near the middle)."""
    cols = core.any(0)
    W = len(cols)
    best, at = -1, W // 2
    x = 0
    while x < W:
        if cols[x]:
            x += 1
            continue
        s = x
        while x < W and not cols[x]:
            x += 1
        if s > 0 and x < W and x - s > best and W * 0.2 < (s + x) / 2 < W * 0.8:
            best, at = x - s, (s + x) // 2
    if best < 2:
        raise SystemExit('no gap between the two objects')
    return at


def one(rgb, obj, core, dark):
    H, W = core.shape
    ys, xs = np.nonzero(core)
    size = max(ys.max() - ys.min(), xs.max() - xs.min())
    dist = ndi.distance_transform_edt(~core)
    reach = max(12, size * SHADOW_REACH)
    fade = np.clip(1 - dist / reach, 0, 1) ** 0.8
    shadow = ndi.gaussian_filter(dark * fade * 1.15, 1.5)
    shadow = np.clip(shadow, 0, SHADOW_MAX)
    alpha = np.maximum(obj, shadow * (1 - obj))
    # colour: the object's, with no green left on it; the shadow is black
    out = rgb.astype(np.float32).copy()
    top = np.maximum(out[..., 0], out[..., 2])
    edge = ndi.binary_dilation(obj < 0.98, iterations=2)
    out[..., 1] = np.where(edge, np.minimum(out[..., 1], top * 1.02 + 4), out[..., 1])
    w = (obj / np.maximum(alpha, 1e-4))[..., None]
    out = out * w
    rgba = np.dstack([np.clip(out, 0, 255), alpha * 255]).astype(np.uint8)
    keep = alpha > 0.02
    ys, xs = np.nonzero(keep)
    pad = 2
    y0, y1, x0, x1 = max(0, ys.min() - pad), min(H, ys.max() + pad + 1), max(0, xs.min() - pad), min(W, xs.max() + pad + 1)
    im = Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA')
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    return im


def main():
    batch = sys.argv[1]
    pv = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    done = []
    for f, name in BATCH.items():
        rgb = np.asarray(Image.open(os.path.join(batch, f)).convert('RGB'))
        obj, core, dark = key(rgb)
        x = split_at(core)
        for side, sl in (('a', slice(0, x)), ('b', slice(x, None))):
            im = one(rgb[:, sl], obj[:, sl], core[:, sl], dark[:, sl])
            im.save(os.path.join(OUT, f'{name}-{side}.webp'), quality=88, method=6)
            done.append((f'{name}-{side}', im))
            print(f'{name}-{side}', im.size)
    if pv:
        cols = 8
        tile = 250
        rows = (len(done) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * tile, rows * tile), (150, 165, 190))
        for c in range(0, cols * tile, 25):
            for r in range(0, rows * tile, 25):
                if (c // 25 + r // 25) % 2:
                    sheet.paste((170, 185, 210), (c, r, c + 25, r + 25))
        for i, (_, im) in enumerate(done):
            t = im.copy()
            t.thumbnail((tile - 8, tile - 8), Image.LANCZOS)
            sheet.paste(t, (i % cols * tile + 4, i // cols * tile + 4), t)
        sheet.save(pv)


if __name__ == '__main__':
    main()
