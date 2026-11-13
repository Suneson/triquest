"""cut-stock-icons.py: the island's market warnings, keyed off their green screen.

    python tools/cut-stock-icons.py

  icons/Market/stock/src/restock.jpg       -> icons/Market/stock/restock.webp       (shelves running low)
  icons/Market/stock/src/out-of-stock.jpg  -> icons/Market/stock/out-of-stock.webp  (every shelf empty)

Trimmed to the art and padded square, 256 px. Build-time only (Pillow, numpy).
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))


def dilate(m, n=2):
    """Grow a mask by n px (a plain-numpy stand-in for scipy's binary_dilation)."""
    for _ in range(n):
        g = m.copy()
        g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
        m = g
    return m


def key_green(rgb):
    """cut-art.py's key: alpha from how much greener than red and blue a pixel is, and the green
    spill taken out of the soft edge."""
    r, g, b = (rgb[..., i].astype(np.float32) for i in range(3))
    alpha = np.clip((100 - (g - np.maximum(r, b))) / 70, 0, 1)
    edge = dilate(alpha < 1)
    out = rgb.astype(np.float32).copy()
    out[..., 1] = np.where(edge, np.minimum(g, np.maximum(r, b) * 1.02 + 4), g)
    return out, alpha


DIR = os.path.join(os.path.dirname(HERE), 'icons', 'Market', 'stock')

for name in ('restock', 'out-of-stock'):
    rgb = np.asarray(Image.open(os.path.join(DIR, 'src', f'{name}.jpg')).convert('RGB'))
    out, alpha = key_green(rgb)
    ys, xs = np.nonzero(alpha > 0.05)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = np.dstack([out[y0:y1, x0:x1], alpha[y0:y1, x0:x1] * 255]).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(crop, 'RGBA')
    side = int(max(im.size) * 1.04)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    sq.resize((256, 256), Image.LANCZOS).save(os.path.join(DIR, f'{name}.webp'), quality=90, method=6)
    print(name, im.size)
