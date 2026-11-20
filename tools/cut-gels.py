"""cut-gels.py: the gel stand's sheets (gel-stand.csv, on flat green) cut into the game's pictures.

    python tools/cut-gels.py <gen dir> [--v2]

--v2: only the thumb redesign's sheets (gel-hand, gel-streams) and its background (gel-prep-bg-screen-b).
--screen: the wall screen's little pictures (gel-stand-screen.csv): a drop for each liquid, a pile for each
      powder, an icon for each action step, into icons/Gels/scr-*.webp.
--v5: the fifth layout's background (gel-prep-bg-v5-b.jpg, trays and pouch box painted in) and its patches,
      cut from gel-prep-bg-v5-b-empty.jpg (the same picture with every tray empty and the bin open): only the
      pixels that differ, inside each place's box. Prints each patch's box in % of the scene for css/gels.css.
--v3: only the third layout's sheets (gel-stand-v3.csv: jars, tools, wells, streams) and its background
      (gel-prep-bg-v3.jpg: take b with the screen and rail moved up a brick period, made in Python).

<gen dir>  Grounds/gel-stand/gen (MOSKE APP/Characters/Photos/Robots/Robots/...)

Each sheet is an even grid (4 x 2, the stands 2 x 1): every cell is keyed off its green, trimmed to what's
left and saved under its name. Gels, ingredients, tools, pouches, interface and effects go to icons/Gels/,
the stand's six levels to icons/Items/gel-stand-t<n>-<a|b>.webp (both facings), the prep view's background
to icons/Gels/prep-bg.webp. Run tools/measure-items.py afterwards for the stands' fit.
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

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


# the third layout (gel-stand-v3.csv): cut by outline, not grid (some sheets don't sit on an even grid).
# sheet: (pieces expected in reading order, height to store)
SHEETS_V3 = {
    'gel-jars': (['jar-water', 'jar-honey', 'jar-maple', 'jar-beet', 'jar-citrus', 'jar-berry', 'jar-lime', 'jar-empty'], 420),
    'gel-tools-v3': (['tool-glass', 'tool-scoop', 'scissors-open', 'scissors-closed', 'bin-closed', 'bin-open', 'pouch-box',
                      'sachet', 'sachet-cut', 'sachet-strip', 'vial-caffeine', 'fx-glass-splash'], 360),
    'gel-wells': (['well-malto', 'well-fructose', 'well-salt', 'well-caffeine', 'scoop-malto', 'scoop-fructose', 'scoop-salt',
                   'well-low'], 360),
    'gel-streams-v3': (['stream-citrus', 'stream-berry', 'stream-lime', 'stream-mix'], 512),
}


def pieces(im, n, grow=45, min_area=6000, raw=None):
    """The sheet's `n` biggest separate pictures (a piece's bits within `grow` px count as one), in reading order."""
    from scipy import ndimage
    al = np.asarray(im.getchannel('A')) > 24
    lab, k = ndimage.label(ndimage.binary_dilation(al, iterations=grow))
    boxes = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        area = int((al[sl] & (lab[sl] == i)).sum())
        if area >= min_area: boxes.append((area, sl, i))
    boxes = sorted(boxes, key=lambda b: -b[0])[:n]
    assert len(boxes) == n, f'found {len(boxes)} pieces, not {n}'
    rows = []
    for b in sorted(boxes, key=lambda b: b[1][0].start):   # rows: tops within a fifth of the sheet's height
        if rows and b[1][0].start - rows[-1][0][1][0].start < im.height / 5: rows[-1].append(b)
        else: rows.append([b])
    out = []
    for r in rows:
        for _, sl, i in sorted(r, key=lambda b: b[1][1].start):
            a = np.asarray(im).copy()
            a[..., 3] = np.where(lab == i, a[..., 3], 0)       # only this piece, not a neighbour's bits
            if raw is not None:
                # green things (the lime juice): the key only bites at the outline, the inside stays as painted
                inner = ndimage.binary_erosion(ndimage.binary_fill_holes(a[..., 3] > 24), iterations=8)
                r = np.asarray(raw.convert('RGB'))
                a[..., :3] = np.where(inner[..., None], r, a[..., :3])
                a[..., 3] = np.where(inner, 255, a[..., 3])
            out.append(Image.fromarray(a[sl]))
    return out


def hue_shift(im, deg):
    """Turn an RGBA picture's hue by `deg` (the lime stream came out yellow)."""
    a = im.getchannel('A')
    h, s_, v = im.convert('RGB').convert('HSV').split()
    h = h.point(lambda x: (x + round(deg * 255 / 360)) % 256)
    out = Image.merge('HSV', (h, s_, v)).convert('RGB').convert('RGBA')
    out.putalpha(a)
    return out


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


# the fifth layout's patches: (name, box in px of the 1536 x 2752 picture, boxes left out)
PATCHES_V5 = [
    ('patch-malto', (24, 1947, 397, 2176), []),
    ('patch-fructose', (400, 1947, 733, 2176), []),
    ('patch-salt', (771, 1947, 1091, 2176), [(763, 2127, 1147, 2487)]),   # the pouch box stands over its foot
    ('patch-caffeine', (0, 2200, 349, 2487), []),
    ('patch-bin-open', (1060, 880, 1536, 1430), []),
]


# the wall screen's pictures: sheet -> names in reading order (4 x 2). The piles' top row has its names written
# under it (Gemini added them): those cells are cut off above the writing.
SHEETS_SCREEN = {
    'gel-screen-drops': ['scr-drop-water', 'scr-drop-honey', 'scr-drop-maple', 'scr-drop-beet', 'scr-drop-citrus',
                         'scr-drop-berry', 'scr-drop-lime', 'scr-drop-caffeine'],
    'gel-screen-piles': ['scr-pile-malto', 'scr-pile-fructose', 'scr-pile-salt', 'scr-pile-glucose', 'scr-pile-electro',
                         'scr-pile-beet', 'scr-pile-citrus', 'scr-pile-cocoa'],
    'gel-screen-steps': ['scr-step-measure', 'scr-step-scoop', 'scr-step-drops', 'scr-step-stir', 'scr-step-fill',
                         'scr-step-seal', 'scr-step-snip', 'scr-step-bin'],
}


def cut_screen(gen):
    for sheet, names in SHEETS_SCREEN.items():
        im = key(Image.open(os.path.join(gen, f'{sheet}.jpg')))
        for k, (cell, name) in enumerate(zip(cells(im, 4, 2), names)):
            if sheet == 'gel-screen-piles' and k < 4: cell = cell.crop((0, 0, cell.width, round(cell.height * 0.76)))
            save(cell, os.path.join(GELS, f'{name}.webp'), 160)


def cut_v5(gen):
    from scipy import ndimage
    full = Image.open(os.path.join(gen, 'gel-prep-bg-v5-b.jpg')).convert('RGB')
    empty = Image.open(os.path.join(gen, 'gel-prep-bg-v5-b-empty.jpg')).convert('RGB')
    assert full.size == empty.size == (1536, 2752)
    a = np.asarray(full).astype(float); b = np.asarray(empty).astype(float)
    diff = np.abs(a - b).sum(axis=2) > 36
    out = full.resize((900, 1612), Image.LANCZOS)
    out.save(os.path.join(GELS, 'prep-bg-v5.webp'), quality=84, method=6)
    print('icons/Gels/prep-bg-v5.webp', out.size)
    W, H = full.size
    for name, (x0, y0, x1, y1), leave in PATCHES_V5:
        m = np.zeros(diff.shape, bool)
        m[y0:y1, x0:x1] = diff[y0:y1, x0:x1]
        m = ndimage.binary_closing(m, iterations=6)
        m = ndimage.binary_fill_holes(m)
        m = ndimage.binary_dilation(m, iterations=5)
        for lx0, ly0, lx1, ly1 in leave: m[ly0:ly1, lx0:lx1] = False
        m[:y0] = False; m[y1:] = False; m[:, :x0] = False; m[:, x1:] = False
        alpha = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.5))
        ys, xs = np.nonzero(m)
        bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        p = empty.convert('RGBA'); p.putalpha(alpha)
        p = p.crop((bx0, by0, bx1, by1))
        k = 900 / 1536   # stored at the background's own scale
        p = p.resize((max(1, round(p.width * k)), max(1, round(p.height * k))), Image.LANCZOS)
        p.save(os.path.join(GELS, f'{name}.webp'), quality=88, method=6)
        print(f'{name}: left {bx0 / W * 100:.2f}% top {by0 / H * 100:.2f}% width {(bx1 - bx0) / W * 100:.2f}% height {(by1 - by0) / H * 100:.2f}%')


def save(im, path, height):
    im = trimmed(im)
    if im.height > height: im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    im.save(path, quality=88, method=6)
    print(os.path.relpath(path, os.path.join(HERE, '..')), im.size)


def main():
    gen = sys.argv[1]
    os.makedirs(GELS, exist_ok=True)
    if '--screen' in sys.argv:
        cut_screen(gen)
        return
    if '--v5' in sys.argv:
        cut_v5(gen)
        return
    if '--v3' in sys.argv:
        for sheet, (names, height) in SHEETS_V3.items():
            raw = Image.open(os.path.join(gen, f'{sheet}.jpg'))
            im = key(raw)
            whole = pieces(im, len(names), grow=18, raw=raw) if sheet == 'gel-jars' else None
            for k, (piece, name) in enumerate(zip(pieces(im, len(names), grow=18), names)):
                if name == 'jar-lime': piece = whole[k]
                if name == 'stream-lime': piece = hue_shift(piece, 22)
                save(piece, os.path.join(GELS, f'{name}.webp'), height)
        # a new name: sw.js would keep showing the old prep-bg.webp on the first launch
        bg = Image.open(os.path.join(gen, 'gel-prep-bg-v3.jpg')).convert('RGB')
        assert bg.size == (1536, 2752), f'gel-prep-bg-v3 is {bg.size}, not 1536 x 2752'
        bg = bg.resize((900, 1612), Image.LANCZOS)
        bg.save(os.path.join(GELS, 'prep-bg-v3.webp'), quality=82, method=6)
        print('icons/Gels/prep-bg-v3.webp', bg.size)
        return
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
