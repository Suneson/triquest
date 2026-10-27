"""cut-rooms.py — the painted isometric rooms (docs/COMPOUND.md) as app art.

Takes the green-screen room renders from the `art-raw` branch
(art-raw/BACKGROUNDS/...) and the coffee machine (art-raw/_extra/), keys the
green out with a soft edge (cut-art.py's key), trims each to its own outline
and writes WebP into icons/Pixelart/NEW/:

    BIKE|GYM|POOL|RUN/level-N.webp      square rooms, 1100 px wide
    LOCKER/square-N.webp                square locker
    LOCKER/landscape-N.webp             2x1 locker (levels 4-10 for now), 2200 px wide
    ITEMS/coffee-machine.webp           a placeable item, 384 px

    python3 tools/cut-rooms.py <art-raw checkout dir>

Build-time only (Pillow, numpy, scipy).
"""
import os
import re
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location('cut_art', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cut-art.py'))
cut_art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cut_art)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'icons', 'Pixelart', 'NEW')

SOURCES = [
    ('BIKE', 'BIKE', 'level'), ('GYM', 'GYM', 'level'), ('POOL', 'POOL', 'level'), ('RUN', 'RUN', 'level'),
    ('LOCKER/SQUARE', 'LOCKER', 'square'), ('LOCKER/RECTANGLE', 'LOCKER', 'landscape'),
]


def keyed(path):
    rgb = np.asarray(Image.open(path).convert('RGB'))
    img, alpha = cut_art.key_green(rgb)
    a = (alpha * 255).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(np.dstack([img.clip(0, 255).astype(np.uint8), a]), 'RGBA')
    ys, xs = np.nonzero(a > 8)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def save(im, path, width, quality=80):
    h = round(im.height * width / im.width)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.resize((width, h), Image.LANCZOS).save(path, 'WEBP', quality=quality, method=6)
    return (width, h)


def main():
    raw = sys.argv[1]
    sizes = {}
    for src, dest, prefix in SOURCES:
        d = os.path.join(raw, 'BACKGROUNDS', src)
        for f in sorted(os.listdir(d)):
            m = re.search(r'_(\d+)\.(jpe?g|png)$', f)
            if not m:
                continue
            n = int(m.group(1))
            width = 2200 if prefix == 'landscape' else 1100
            out = os.path.join(OUT, dest, f'{prefix}-{n}.webp')
            sizes[os.path.relpath(out, ROOT)] = save(keyed(os.path.join(d, f)), out, width)
            print(out, sizes[os.path.relpath(out, ROOT)])
    coffee = os.path.join(raw, '_extra', 'Coffee machine.jpg')
    out = os.path.join(OUT, 'ITEMS', 'coffee-machine.webp')
    print(out, save(keyed(coffee), out, 384, 85))


if __name__ == '__main__':
    main()
