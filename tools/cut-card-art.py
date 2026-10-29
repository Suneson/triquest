"""cut-card-art.py — fit the shop's card plates and (i) buttons into the app.

    python3 tools/cut-card-art.py

Reads the painted sources in icons/UI/cards/src/ (green screen) and writes:
  card-plate-{blue,green}.webp   the whole card, trimmed, 360 px wide
  info-{blue,green}.webp         the square (i) button, trimmed, 96 px

Only the screen that touches the border is keyed: the green plate is
seafoam, and a global key (cut-art.py) would eat into it. The soft edge is a
thin band around that screen, with the green spill pulled back.
Build-time only (Pillow, numpy, scipy).
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
CARDS = os.path.join(os.path.dirname(HERE), 'icons', 'UI', 'cards')
SRC = os.path.join(CARDS, 'src')
JOBS = {
    'card-plate-blue': 360, 'card-plate-green': 360,  # width
    'info-blue': 96, 'info-green': 96,                # square
}


def cut(path):
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    greenness = g - np.maximum(r, b)
    labels, _ = ndimage.label(greenness > 120)
    edge_ids = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    screen = np.isin(labels, edge_ids[edge_ids > 0])
    band = ndimage.binary_dilation(screen, iterations=4) & ~screen
    alpha = np.ones(screen.shape, np.float32)
    alpha[screen] = 0
    # on the band, how green a pixel still is says how much screen it holds
    alpha[band] = np.clip((200 - greenness[band]) / 150, 0, 1)
    out = rgb.copy()
    out[..., 1] = np.where(band, np.minimum(g, np.maximum(r, b) * 1.02 + 4), g)
    a = (alpha * 255).astype(np.uint8)
    im = Image.fromarray(np.dstack([out.clip(0, 255).astype(np.uint8), a]), 'RGBA')
    return im.crop(Image.fromarray(a).point(lambda v: 255 if v > 8 else 0).getbbox())


def main():
    for name, size in JOBS.items():
        im = cut(os.path.join(SRC, name + '.jpg'))
        if name.startswith('info-'):
            s = max(im.size)
            sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
            sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2), im)
            im = sq.resize((size, size), Image.LANCZOS)
        else:
            im = im.resize((size, round(im.height * size / im.width)), Image.LANCZOS)
        out = os.path.join(CARDS, name + '.webp')
        im.save(out, 'WEBP', quality=90, method=6)
        print(out, im.size, os.path.getsize(out))


if __name__ == '__main__':
    main()
