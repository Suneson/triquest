"""cut-shop-ui.py — fit the generated shop art (tools/gen-shop-ui.mjs) into the app.

    python3 tools/cut-shop-ui.py <gen dir>

  tab-*.png        -> icons/UI/tabs/<name>.webp    green keyed out, trimmed, 128 px square

(The card plates and (i) buttons are painted art: tools/cut-card-art.py.)

Build-time only (Pillow, numpy, scipy; the key is cut-art.py's).
"""
import os, sys, importlib.util
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('cut_art', os.path.join(HERE, 'cut-art.py'))
cut_art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cut_art)
UI = os.path.join(os.path.dirname(HERE), 'icons', 'UI')


def main():
    src = sys.argv[1]
    os.makedirs(os.path.join(UI, 'tabs'), exist_ok=True)
    for f in sorted(os.listdir(src)):
        name, ext = os.path.splitext(f)
        if ext != '.png':
            continue
        path = os.path.join(src, f)
        if name.startswith('tab-'):
            rgb = np.asarray(Image.open(path).convert('RGB'))
            img, alpha = cut_art.key_green(rgb)
            a = (alpha * 255).clip(0, 255).astype(np.uint8)
            im = Image.fromarray(np.dstack([img.clip(0, 255).astype(np.uint8), a]), 'RGBA')
            im = im.crop(im.getbbox())
            s = int(max(im.size) * 1.06)
            sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
            sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2), im)
            out = os.path.join(UI, 'tabs', name + '.webp')
            sq.resize((128, 128), Image.LANCZOS).save(out, 'WEBP', quality=90, method=6)
        else:
            continue
        print(out, os.path.getsize(out))


if __name__ == '__main__':
    main()
