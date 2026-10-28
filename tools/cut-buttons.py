"""cut-buttons.py — fit the generated room buttons (tools/gen-buttons.mjs) into the app.

    python3 tools/cut-buttons.py <gen dir>

  btn-*.png -> icons/Pixelart/NEW/UI/btn-*.webp   green keyed out, trimmed, 256 px square

Build-time only (Pillow, numpy, scipy; the key is cut-art.py's).
"""
import os, sys, importlib.util
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('cut_art', os.path.join(HERE, 'cut-art.py'))
cut_art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cut_art)
OUT = os.path.join(os.path.dirname(HERE), 'icons', 'Pixelart', 'NEW', 'UI')


def main():
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    for f in sorted(os.listdir(src)):
        if not (f.startswith('btn-') and f.endswith('.png')):
            continue
        rgb = np.asarray(Image.open(os.path.join(src, f)).convert('RGB'))
        img, alpha = cut_art.key_green(rgb)
        a = (alpha * 255).clip(0, 255).astype(np.uint8)
        im = Image.fromarray(np.dstack([img.clip(0, 255).astype(np.uint8), a]), 'RGBA')
        im = im.crop(im.getbbox()).resize((256, 256), Image.LANCZOS)
        out = os.path.join(OUT, f.replace('.png', '.webp'))
        im.save(out, 'WEBP', quality=88, method=6)
        print(out, os.path.getsize(out))


if __name__ == '__main__':
    main()
