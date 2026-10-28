"""cut-loop5.py — fit the generated mission, season, stall and club art
(tools/gen-loop5.mjs) into the app.

    python3 tools/cut-loop5.py <gen dir>

  decor-*.png, mission-board.png -> icons/Pixelart/NEW/ITEMS/<name>.webp   keyed, trimmed, 384 px wide at most
  crest-*.png                    -> icons/Pixelart/NEW/CLUBS/<name>.png     keyed, trimmed, 256 px square
  season-*.png                   -> icons/Pixelart/NEW/SEASONS/<name>.png   keyed, trimmed, 256 px square
  relay-gran-canaria.png         -> icons/Pixelart/NEW/CLUBS/relay-gran-canaria.webp  768 px, as it is

Build-time only (Pillow, numpy, scipy; the key is cut-art.py's).
"""
import os
import sys
import importlib.util
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('cut_art', os.path.join(HERE, 'cut-art.py'))
cut_art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cut_art)
NEW = os.path.join(os.path.dirname(HERE), 'icons', 'Pixelart', 'NEW')


def keyed(path):
    rgb = np.asarray(Image.open(path).convert('RGB'))
    img, alpha = cut_art.key_green(rgb)
    a = (alpha * 255).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(np.dstack([img.clip(0, 255).astype(np.uint8), a]), 'RGBA')
    return im.crop(im.getbbox())


def square(im, side=256):
    s = int(max(im.size) * 1.06)
    sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2), im)
    return sq.resize((side, side), Image.LANCZOS)


def main():
    src = sys.argv[1]
    for d in ('ITEMS', 'CLUBS', 'SEASONS'):
        os.makedirs(os.path.join(NEW, d), exist_ok=True)
    for f in sorted(os.listdir(src)):
        name, ext = os.path.splitext(f)
        if ext != '.png':
            continue
        path = os.path.join(src, f)
        if name.startswith('decor-') or name == 'mission-board':
            im = keyed(path)
            w = min(384, im.width)
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
            out = os.path.join(NEW, 'ITEMS', name + '.webp')
            im.save(out, 'WEBP', quality=86, method=6)
        elif name.startswith('crest-'):
            out = os.path.join(NEW, 'CLUBS', name + '.png')
            square(keyed(path)).save(out, optimize=True)
        elif name.startswith('season-'):
            out = os.path.join(NEW, 'SEASONS', name + '.png')
            square(keyed(path)).save(out, optimize=True)
        elif name == 'relay-gran-canaria':
            out = os.path.join(NEW, 'CLUBS', name + '.webp')
            Image.open(path).convert('RGB').resize((768, 768), Image.LANCZOS).save(out, 'WEBP', quality=84, method=6)
        else:
            continue
        print(out, os.path.getsize(out))


if __name__ == '__main__':
    main()
