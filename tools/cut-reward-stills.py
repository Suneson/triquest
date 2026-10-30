"""cut-reward-stills.py — the chest stills (icons/AnimatedRewards/still/<Tier>.webp).

    python3 tools/cut-reward-stills.py            key the painted JPGs in icons/AnimatedRewards/JPG/
    python3 tools/cut-reward-stills.py --frames   fit the clip frames reward-stills.mjs read (already clear)

The JPGs are on a flat screen: green for most, pink #FF017E for one. The screen
colour is read from the image's border, so either works without saying which.
Only screen connected to the border is keyed (a green or pink detail inside the
object stays), with a soft edge and the screen's spill pulled back on it.
Output keeps the source's framing (padded to a square, never trimmed), 512 px:
the still replaces the clip's last frame in place, so it must line up with it.
Build-time only (Pillow, numpy, scipy).
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, 'icons', 'AnimatedRewards')
OUT = os.path.join(BASE, 'still')
SIZE = 512


def screen_colour(rgb):
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3), rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
    return np.median(border, axis=0)


def key(rgb):
    """Alpha for a flat-screen image: distance from the screen colour, in chroma."""
    img = rgb.astype(np.float32)
    scr = screen_colour(img)
    # chroma distance (brightness-independent, so shading on the screen still keys)
    def chroma(a):
        s = a.sum(-1, keepdims=True) + 1e-3
        return a / s
    d = np.linalg.norm(chroma(img) - chroma(scr[None, None, :]), axis=-1) * 255
    near = d < 40
    labels, _ = ndimage.label(near)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    screen = np.isin(labels, edge[edge > 0])
    band = ndimage.binary_dilation(screen, iterations=4) & ~screen
    alpha = np.ones(screen.shape, np.float32)
    alpha[screen] = 0
    alpha[band] = np.clip((d[band] - 20) / 60, 0, 1)
    # spill: on the band, pull the screen's strongest channel back toward the others
    out = img.copy()
    k = int(np.argmax(scr))
    others = [i for i in range(3) if i != k]
    cap = np.max(img[..., others], axis=-1) * 1.02 + 4
    out[..., k] = np.where(band, np.minimum(img[..., k], cap), img[..., k])
    return out, alpha


def fit(im):
    w, h = im.size
    s = max(w, h)
    sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    sq.paste(im, ((s - w) // 2, (s - h) // 2), im)
    return sq.resize((SIZE, SIZE), Image.LANCZOS)


def save(im, name):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name + '.webp')
    fit(im).save(path, 'WEBP', quality=88, method=6)
    print(path, os.path.getsize(path))


def main():
    if '--frames' in sys.argv:
        for f in sorted(os.listdir(OUT)):
            if f.endswith('.png'):
                p = os.path.join(OUT, f)
                save(Image.open(p).convert('RGBA'), f[:-4])
                os.remove(p)
        return
    src = os.path.join(BASE, 'JPG')
    for f in sorted(os.listdir(src)):
        name, ext = os.path.splitext(f)
        if ext.lower() not in ('.jpg', '.jpeg', '.png'):
            continue
        rgb = np.asarray(Image.open(os.path.join(src, f)).convert('RGB'))
        img, alpha = key(rgb)
        im = Image.fromarray(np.dstack([img.clip(0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)]), 'RGBA')
        save(im, name[:1].upper() + name[1:].lower())


if __name__ == '__main__':
    main()
