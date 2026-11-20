"""cut-coffee.py: the coffee shop's art (coffee-shop.csv and coffee-shop-v2.csv, on flat green) cut into the game's
pictures.

    python tools/cut-coffee.py <gen dir>

<gen dir>  Grounds/coffee/gen (MOSKE APP/Characters/Photos/Robots/Robots/...)

- The sheets: each piece keyed off its green, found by its outline (falling back to an even grid), trimmed and
  saved under its name in icons/Coffee/.
- The building: six levels, both facings in each picture, into icons/Items/coffee-shop-t<n>-<a|b>.webp. The
  user's picks (20 Nov) are in LEVELS. Run tools/measure-items.py afterwards for their fit.
- The three screens' backgrounds into icons/Coffee/bg-counter|bar|finish.webp, and the fridge's closed door as a
  patch cut from the closed twin (only the pixels that differ inside the fridge's box); its box in % is printed.
- The red builder ring came with a brown centre: it gets the blue ring's navy one.
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from importlib import import_module
cg = import_module('cut-gels')   # key(), pieces(), cells(), trimmed()

OUT = os.path.join(HERE, '..', 'icons', 'Coffee')
ITEMS = os.path.join(HERE, '..', 'icons', 'Items')

SHEETS = {   # sheet: (columns, rows, names in reading order, height to store)
    'coffee-cups': (4, 2, ['cup-espresso', 'cup-cappuccino', 'glass-latte', 'glass-iced', 'glass-coupe', 'mug',
                           'cup-takeaway', 'lid-takeaway'], 320),
    'coffee-tools': (4, 2, ['pf-empty', 'pf-heaped', 'pf-tamped', 'tamper', 'pitcher', 'pitcher-steamed', 'ice-scoop',
                            'bar-spoon'], 320),
    'coffee-pantry': (4, 3, ['beans-bag', 'beans', 'grounds', 'milk', 'oat-milk', 'ice', 'ice-cream', 'cream-can',
                             'cocoa', 'cinnamon', 'honey', 'protein'], 280),
    'coffee-syrups': (6, 1, ['syrup-vanilla', 'syrup-caramel', 'syrup-hazelnut', 'syrup-chocolate', 'syrup-berry',
                             'syrup-maple'], 360),
    'coffee-streams': (8, 1, ['str-espresso', 'str-double', 'str-milk', 'str-steamed', 'str-water', 'str-syrup',
                              'str-chocolate', 'str-cocoa'], 512),
    'coffee-fx': (4, 2, ['fx-steam', 'fx-billow', 'fx-grounds', 'fx-splash', 'fx-ice', 'fx-sparkle', 'fx-cocoa',
                         'fx-ring'], 240),
    'coffee-tops': (4, 2, ['top-espresso', 'top-foam', 'top-heart', 'top-tulip', 'top-rosetta', 'top-cocoa',
                           'top-cream', 'top-iced'], 320),
    'coffee-drinks-a': (4, 2, ['drink-espresso', 'drink-americano', 'drink-latte', 'drink-cappuccino',
                               'drink-iced-latte', 'drink-mocha', 'drink-flat-white', 'drink-caramel-macchiato'], 360),
    'coffee-drinks-b': (4, 2, ['drink-affogato', 'drink-cold-brew', 'drink-protein-mocha', 'drink-honey-oat-latte',
                               'drink-hazelnut-latte', 'drink-berry-iced-latte', 'drink-cinnamon-cappuccino',
                               'drink-maple-americano'], 360),
    'coffee-steps': (4, 3, ['step-grind', 'step-tamp', 'step-lock', 'step-brew', 'step-milk', 'step-steam', 'step-ice',
                            'step-syrup', 'step-cream', 'step-dust', 'step-art', 'step-serve'], 160),
    'coffee-ui': (4, 3, ['sign-open', 'sign-closed', 'bubble', 'ticket', 'quality-bar', 'ring-blue', 'ring-red',
                         'ring-green', 'ring-gold', 'badge-48h', 'tip-jar', 'done'], 240),
}

# level -> the picked picture (some takes swapped levels: t5-a reads as level 3, t4-a as level 5)
LEVELS = {1: 'coffee-shop-t1-b-fix-a', 2: 'coffee-shop-t2-b', 3: 'coffee-shop-t5-a', 4: 'coffee-shop-t4-b-fix-b',
          5: 'coffee-shop-t4-a', 6: 'coffee-shop-t6-a'}

BGS = {'bg-counter': 'coffee-counter-bg-c', 'bg-bar': 'coffee-bar-bg-d-open-a', 'bg-finish': 'coffee-finish-bg-d-fix-b'}
FRIDGE = ('patch-fridge-closed', 'coffee-bar-bg-d-closed-a', (0, 1960, 790, 2730))   # its box in px of 1536 x 2730
BG_SIZE = (900, 1600)


def load(gen, name):
    for ext in ('.png', '.jpg', '.webp'):
        p = os.path.join(gen, name + ext)
        if os.path.exists(p): return Image.open(p)
    raise FileNotFoundError(name)


def split(im, cols, rows, n, grow=30, raw=None):
    """The sheet's pieces by outline; an even grid if the outlines don't give exactly n."""
    try:
        return cg.pieces(im, n, grow=grow, min_area=2500, raw=raw)
    except AssertionError as e:
        print('   grid instead of outlines:', e)
        return list(cg.cells(im, cols, rows))


def despill(im):
    """No green left at all: thin dust and steam painted over the green came out olive. Where green still beats red
    and blue the pixel fades out, and what stays loses the green cast."""
    a = np.asarray(im.convert('RGBA')).astype(float)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    top = np.maximum(r, b)
    al = al * np.clip(1 - (g - top) / 25, 0, 1)
    g = np.minimum(g, top)
    return Image.fromarray(np.dstack([r, g, b, al]).clip(0, 255).astype(np.uint8), 'RGBA')


DUST = {'fx-cocoa', 'fx-grounds', 'str-cocoa'}   # brown dust: red always beats green, olive is the screen showing


def dust(im):
    a = np.asarray(im.convert('RGBA')).astype(float)
    a[..., 3] *= np.clip(1 - (a[..., 1] - 0.8 * a[..., 0]) / 20, 0, 1)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def light_only(im):
    """The open sign: despilled all over (its chains caught green) except its one green light."""
    from scipy import ndimage
    a = np.asarray(im.convert('RGBA')).astype(int)
    lab, k = ndimage.label((a[..., 1] - np.maximum(a[..., 0], a[..., 2]) > 60) & (a[..., 3] > 200))
    sizes = ndimage.sum(np.ones(lab.shape), lab, range(1, k + 1))
    dot = ndimage.binary_dilation(lab == 1 + int(np.argmax(sizes)), iterations=3)
    clean = np.asarray(despill(im)).copy()
    clean[dot] = a[dot]
    return Image.fromarray(clean.astype(np.uint8), 'RGBA')


def save(im, path, height, keep_green=False):
    name = os.path.basename(path)[:-5]
    im = light_only(im) if keep_green else despill(im)
    if name in DUST: im = dust(im)
    if name in ('fx-steam', 'fx-billow', 'str-water'):   # see-through white over green: made plain white-grey
        rgb, al = im.convert('RGB'), im.getchannel('A')
        im = Image.merge('RGB', [rgb.convert('L')] * 3).convert('RGBA'); im.putalpha(al)
    im = cg.trimmed(im)
    if im.height > height: im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    im.save(path, quality=88, method=6)
    print(os.path.relpath(path, os.path.join(HERE, '..')), im.size)


def green_ring(blue_path, green_path):
    """The green ring came out keyed away with the green screen: it's the blue ring with its ring turned green."""
    blue = Image.open(blue_path).convert('RGBA')
    a = np.asarray(blue).astype(int)
    cy, cx = blue.height // 2, blue.width // 2
    r_in = next(x - cx for x in range(cx, blue.width) if a[cy, x, 2] > 150 and a[cy, x, 0] < 120)
    turned = cg.hue_shift(blue, -95)
    m = Image.new('L', blue.size, 255)
    ImageDraw.Draw(m).ellipse((cx - r_in + 2, cy - r_in + 2, cx + r_in - 2, cy + r_in - 2), fill=0)
    out = blue.copy(); out.paste(turned, (0, 0), m.filter(ImageFilter.GaussianBlur(1.5)))
    out.save(green_path, quality=88, method=6)
    print('ring-green: the blue ring turned green, inner radius', r_in)


def navy_centre(red_path, blue_path):
    """The red ring's brown centre swapped for the blue ring's navy one (same size, soft round edge)."""
    red = Image.open(red_path).convert('RGBA'); blue = Image.open(blue_path).convert('RGBA').resize(red.size, Image.LANCZOS)
    a = np.asarray(red).astype(int)
    cy, cx = red.height // 2, red.width // 2
    # walk right from the centre to the first strongly red pixel: the ring's inner edge
    r_in = next(x - cx for x in range(cx, red.width) if a[cy, x, 0] > 150 and a[cy, x, 1] < 90)
    m = Image.new('L', red.size, 0)
    ImageDraw.Draw(m).ellipse((cx - r_in + 2, cy - r_in + 2, cx + r_in - 2, cy + r_in - 2), fill=255)
    red.paste(blue, (0, 0), m.filter(ImageFilter.GaussianBlur(1.5)))
    red.save(red_path, quality=88, method=6)
    print('ring-red: navy centre, inner radius', r_in)


def fridge_patch(gen, bar):
    from scipy import ndimage
    name, src, (x0, y0, x1, y1) = FRIDGE
    closed = load(gen, src).convert('RGB')
    assert closed.size == bar.size, (closed.size, bar.size)
    d = np.abs(np.asarray(bar).astype(float) - np.asarray(closed).astype(float)).sum(axis=2) > 60
    m = np.zeros(d.shape, bool); m[y0:y1, x0:x1] = d[y0:y1, x0:x1]
    m = ndimage.binary_opening(m, iterations=2)          # no specks from the take's own noise
    m = ndimage.binary_closing(m, iterations=8)
    m = ndimage.binary_fill_holes(m)
    m = ndimage.binary_dilation(m, iterations=6)
    m[:y0] = False; m[y1:] = False; m[:, :x0] = False; m[:, x1:] = False
    alpha = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
    ys, xs = np.nonzero(m)
    bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    p = closed.convert('RGBA'); p.putalpha(alpha); p = p.crop((bx0, by0, bx1, by1))
    k = BG_SIZE[0] / bar.width
    p = p.resize((round(p.width * k), round(p.height * k)), Image.LANCZOS)
    p.save(os.path.join(OUT, f'{name}.webp'), quality=88, method=6)
    W, H = bar.size
    print(f'{name}: left {bx0 / W * 100:.2f}% top {by0 / H * 100:.2f}% width {(bx1 - bx0) / W * 100:.2f}% '
          f'height {(by1 - by0) / H * 100:.2f}%')


def main():
    gen = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    for sheet, (cols, rows, names, height) in SHEETS.items():
        print(sheet)
        raw = load(gen, sheet)
        im = cg.key(raw)
        # the open sign's green light: its inside as painted, not keyed (the key only bites at the outline)
        for piece, name in zip(split(im, cols, rows, len(names), raw=raw if sheet == 'coffee-ui' else None), names):
            save(piece, os.path.join(OUT, f'{name}.webp'), height, keep_green=name == 'sign-open')
    green_ring(os.path.join(OUT, 'ring-blue.webp'), os.path.join(OUT, 'ring-green.webp'))
    navy_centre(os.path.join(OUT, 'ring-red.webp'), os.path.join(OUT, 'ring-blue.webp'))
    for n, src in LEVELS.items():
        im = cg.key(load(gen, src))
        for piece, face in zip(split(im, 2, 1, 2, grow=40), 'ab'):
            save(piece, os.path.join(ITEMS, f'coffee-shop-t{n}-{face}.webp'), 720)
    for out, src in BGS.items():
        bg = load(gen, src).convert('RGB')
        if out == 'bg-bar': fridge_patch(gen, bg)
        bg.resize(BG_SIZE, Image.LANCZOS).save(os.path.join(OUT, f'{out}.webp'), quality=82, method=6)
        print(f'icons/Coffee/{out}.webp from {src}', bg.size)


if __name__ == '__main__':
    main()
