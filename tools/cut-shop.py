"""cut-shop.py - the market's pictures, cut off their green (docs/MARKETS.md).

    python tools/cut-shop.py "<MOSKE APP>/Characters/Photos/Robots/Robots"

Market Items/items-NN.jpg: sheets of six item icons, 3 across and 2 down, in the order of
"MOSKE APP/PromptQueue Prompts/market-items-list.csv" -> icons/Market/items/<item>.webp (256 square).
Market/marketN.jpg: the eight market levels -> icons/Market/market-N.webp (720 wide).
"""
import csv, os, sys
import numpy as np
from PIL import Image

SRC = sys.argv[1]
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, 'icons', 'Market')
LIST = os.path.join(SRC, '..', '..', '..', '..', 'PromptQueue Prompts', 'market-items-list.csv')


def key(im):
    """RGBA with the green keyed out: soft edge, and the green spill taken off what's left."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = g - np.maximum(r, b)                     # how much greener than anything else
    alpha = np.clip(1 - (spill - 40) / 90, 0, 1)     # > 130 green: gone; < 40: kept
    g2 = np.where(spill > 0, np.maximum(r, b) + np.minimum(spill, 10), g)   # despill
    out = np.dstack([r, g2, b, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def trim(im, pad):
    box = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    im = im.crop(box)
    w, h = im.size
    return im, w, h


def main():
    items = list(csv.DictReader(open(LIST, encoding='utf-8-sig')))
    os.makedirs(os.path.join(OUT, 'items'), exist_ok=True)
    for it in items:
        sheet = Image.open(os.path.join(SRC, 'Market Items', it['sheet'] + '.jpg'))
        W, H = sheet.size
        c = int(it['cell']) - 1
        col, row = c % 3, c // 3
        cell = sheet.crop((col * W // 3, row * H // 2, (col + 1) * W // 3, (row + 1) * H // 2))
        im, w, h = trim(key(cell), 0)
        side = int(max(w, h) * 1.08)
        sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        sq.paste(im, ((side - w) // 2, (side - h) // 2), im)
        sq.resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, 'items', it['item'] + '.webp'), quality=88)
    for n in range(1, 9):
        im, w, h = trim(key(Image.open(os.path.join(SRC, 'Market', f'market{n}.jpg'))), 0)
        im.resize((720, round(720 * h / w)), Image.LANCZOS).save(os.path.join(OUT, f'market-{n}.webp'), quality=88)
    print(len(items), 'items, 8 markets')


if __name__ == '__main__':
    main()
