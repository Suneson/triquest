"""cut-ui-plates.py — fit the generated button plates and the sheet handle into the app.

    python tools/cut-ui-plates.py <gen dir>

  close-plate.png, close-plate-down.png, gold-plate.png -> icons/Pixelart/NEW/UI/*.webp  (480 px wide)
  sheet-handle.png                                      -> icons/Pixelart/NEW/UI/sheet-handle.webp (240 px wide)
  clock-plate.png, talk-plate.png, talk-plate-down.png  -> icons/Pixelart/NEW/UI/*.webp  (600 px wide, the stadium)

The plates carry no lettering: the app writes the label over them, so it can be translated.
Build-time only (Pillow, numpy).
"""
import os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))


def key_green(rgb):
    """Flat #00FF00 out: alpha from how much greener a pixel is than it is red or blue, spill pulled back."""
    f = rgb.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    other = np.maximum(r, b)
    alpha = 1 - np.clip((g - other - 40) / 110, 0, 1)
    out = f.copy()
    out[..., 1] = np.where(g > other, other + (g - other) * alpha * 0.25, g)   # no green fringe
    return out, alpha


OUT = os.path.join(os.path.dirname(HERE), 'icons', 'Pixelart', 'NEW', 'UI')
WIDTH = {'close-plate': 480, 'close-plate-down': 480, 'gold-plate': 480, 'sheet-handle': 240,
         # the stadium screen's countdown plate and Talk button (tools/gen-stadium-ui.mjs)
         'clock-plate': 600, 'talk-plate': 600, 'talk-plate-down': 600}


def main():
    src = sys.argv[1]
    for name, w in WIDTH.items():
        f = os.path.join(src, name + '.png')
        if not os.path.exists(f):
            continue
        rgb = np.asarray(Image.open(f).convert('RGB'))
        img, alpha = key_green(rgb)
        a = (alpha * 255).clip(0, 255).astype(np.uint8)
        a[a < 24] = 0   # the faint green haze the model leaves under a button is not part of it
        im = Image.fromarray(np.dstack([img.clip(0, 255).astype(np.uint8), a]), 'RGBA')
        im = im.crop(im.getbbox())
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        out = os.path.join(OUT, name + '.webp')
        im.save(out, 'WEBP', quality=90, method=6)
        print(out, im.size, os.path.getsize(out))


if __name__ == '__main__':
    main()
