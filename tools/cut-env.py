"""cut-env.py — fit the generated base art (tools/gen-env.mjs) into the app.

    python3 tools/cut-env.py <gen dir>

  bolt.png -> icons/Pixelart/NEW/stamina-bolt.png   green keyed out, trimmed, 256 px
  env.png  -> icons/Pixelart/NEW/env-ground-sky.webp  the terrain the room stands on

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
OUT = os.path.join(os.path.dirname(HERE), 'icons', 'Pixelart', 'NEW')


def main():
    src = sys.argv[1]
    rgb = np.asarray(Image.open(os.path.join(src, 'bolt.png')).convert('RGB'))
    img, alpha = cut_art.key_green(rgb)
    a = (alpha * 255).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(np.dstack([img.clip(0, 255).astype(np.uint8), a]), 'RGBA')
    im = im.crop(im.getbbox())
    side = int(max(im.size) * 1.08)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    sq.resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, 'stamina-bolt.png'), optimize=True)
    env = Image.open(os.path.join(src, 'env.png')).convert('RGB')
    env.save(os.path.join(OUT, 'env-ground-sky.webp'), 'WEBP', quality=82, method=6)
    print('stamina-bolt.png, env-ground-sky.webp', env.size)


if __name__ == '__main__':
    main()
