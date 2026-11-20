"""cut-gels.py: the gel stand's sheets (gel-stand.csv, on flat green) cut into the game's pictures.

    python tools/cut-gels.py <gen dir> [--v2]

--v2: only the thumb redesign's sheets (gel-hand, gel-streams) and its background (gel-prep-bg-screen-b).

<gen dir>  Grounds/gel-stand/gen (MOSKE APP/Characters/Photos/Robots/Robots/...)

Each sheet is an even grid (4 x 2, the stands 2 x 1): every cell is keyed off its green, trimmed to what's
left and saved under its name. Gels, ingredients, tools, pouches, interface and effects go to icons/Gels/,
the stand's six levels to icons/Items/gel-stand-t<n>-<a|b>.webp (both facings), the prep view's background
to icons/Gels/prep-bg.webp. Run tools/measure-items.py afterwards for the stands' fit.
"""
import os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GELS = os.path.join(HERE, '..', 'icons', 'Gels')
ITEMS = os.path.join(HERE, '..', 'icons', 'Items')

SHEETS = {   # sheet: (columns, rows, names in reading order, height to store)
    'gel-finals': (4, 2, ['gel-classic', 'gel-honey', 'gel-caffeine', 'gel-maple', 'gel-beet', 'gel-hydro', 'gel-race', 'gel-blank'], 256),
    'gel-ingredients': (4, 2, ['ing-malto', 'ing-fructose', 'ing-honey', 'ing-maple', 'ing-beet', 'ing-salt', 'ing-caffeine', 'ing-water'], 256),
    'gel-tools': (4, 2, ['tool-jug', 'tool-jug-full', 'tool-whisk', 'tool-spoon', 'tool-dial', 'tool-dropper', 'tool-sealer', 'tool-funnel'], 320),
    'gel-pouch': (4, 2, ['pouch-0', 'pouch-25', 'pouch-50', 'pouch-75', 'pouch-full', 'pouch-sealed', 'pouch-label', 'pouch-torn'], 320),
    'gel-ui': (4, 2, ['ui-star', 'ui-star-empty', 'ui-lock', 'ui-plus', 'ui-check', 'ui-card', 'ui-carbs', 'ui-badge'], 160),
    'gel-fx': (4, 2, ['fx-splash', 'fx-drops', 'fx-puff', 'fx-salt', 'fx-swirl', 'fx-sparkle', 'fx-bubble', 'fx-ring'], 192),
}


# the thumb redesign (gel-stand-v2.csv): only these, with --v2
SHEETS_V2 = {
    'gel-hand': (4, 2, ['hand-salt', 'hand-malto', 'hand-fructose', 'hand-honey', 'sealer-open', 'sealer-closed', None, 'fx-drain'], 320),
    'gel-streams': (8, 1, ['stream-water', 'stream-honey', 'stream-maple', 'stream-beet', 'stream-gel', 'stream-powder', 'stream-salt', 'stream-drops'], 512),
}


def key(im):
    """Green off: alpha from how much greener than red and blue a pixel is, and the green spill pulled back."""
    a = np.asarray(im.convert('RGB')).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = g - np.maximum(r, b)
    alpha = np.clip(1 - (spill - 30) / 70, 0, 1)
    alpha[(g > 90) & (spill > 100)] = 0
    g2 = np.where(spill > 0, np.maximum(r, b) + np.minimum(spill, 0), g)   # no green tint left on the edges
    out = np.dstack([r, np.minimum(g, g2 + 4), b, alpha * 255]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def trimmed(im, pad=6):
    al = np.asarray(im.getchannel('A'))
    ys, xs = np.nonzero(al > 24)
    if not len(xs): return im
    return im.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(im.width, xs.max() + pad + 1), min(im.height, ys.max() + pad + 1)))


def cells(im, cols, rows):
    w, h = im.width / cols, im.height / rows
    for j in range(rows):
        for i in range(cols):
            yield im.crop((round(i * w), round(j * h), round((i + 1) * w), round((j + 1) * h)))


def save(im, path, height):
    im = trimmed(im)
    if im.height > height: im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    im.save(path, quality=88, method=6)
    print(os.path.relpath(path, os.path.join(HERE, '..')), im.size)


def main():
    gen = sys.argv[1]
    os.makedirs(GELS, exist_ok=True)
    if '--v2' in sys.argv:
        for sheet, (cols, rows, names, height) in SHEETS_V2.items():
            im = key(Image.open(os.path.join(gen, f'{sheet}.jpg')))
            for cell, name in zip(cells(im, cols, rows), names):
                if name: save(cell, os.path.join(GELS, f'{name}.webp'), height)   # None: not used
        # the background the user picked (gel-stand-bg.csv: screen-b), widened in Photoshop: 1920 x 2992, the
        # 1536 x 2752 scene with 192 px more each side and 240 px below (css/gels.css fills the phone with it)
        bg = Image.open(os.path.join(gen, 'gel-prep-bg-wide.jpg')).convert('RGB')
        assert bg.size == (1920, 2992), f'gel-prep-bg-wide is {bg.size}, not 1920 x 2992'
        bg = bg.resize((1125, 1753), Image.LANCZOS)
        bg.save(os.path.join(GELS, 'prep-bg.webp'), quality=82, method=6)
        print('icons/Gels/prep-bg.webp', bg.size)
        return
    for sheet, (cols, rows, names, height) in SHEETS.items():
        im = key(Image.open(os.path.join(gen, f'{sheet}.jpg')))
        for cell, name in zip(cells(im, cols, rows), names):
            save(cell, os.path.join(GELS, f'{name}.webp'), height)
    for n in range(1, 7):
        im = key(Image.open(os.path.join(gen, f'gel-stand-t{n}.jpg')))
        for cell, face in zip(cells(im, 2, 1), 'ab'):
            save(cell, os.path.join(ITEMS, f'gel-stand-t{n}-{face}.webp'), 720)
    bg = Image.open(os.path.join(gen, 'gel-prep-bg.jpg')).convert('RGB').resize((900, 1612), Image.LANCZOS)
    bg.save(os.path.join(GELS, 'prep-bg.webp'), quality=82, method=6)
    print('icons/Gels/prep-bg.webp', bg.size)


if __name__ == '__main__':
    main()
