"""cut-wardrobe-btn.py: the wardrobe button (MOSKE APP/Icons/gen-wardrobe.py) keyed off its green.

    python tools/cut-wardrobe-btn.py <picture on green>

Writes icons/Pixelart/GEAR/btn-wardrobe.png: 256 px square, standing 10 px from the top and
bottom like btn-shop.png and btn-inventory.png beside it.
"""
import os, sys
import cv2
import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main(src):
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    s = g - np.maximum(r, b)
    alpha = 1 - np.clip((s - 90) / 60, 0, 1)
    # only the wardrobe: specks of darker green near the edge would count as solid
    n, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > .5).astype(np.uint8), connectivity=8)
    keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    alpha = np.where(cv2.dilate((labels == keep).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0, alpha, 0)
    # no green light left on the outline (the painting has no green of its own)
    g = np.where(s > 0, np.maximum(r, b), g)
    im = Image.fromarray(np.dstack([r, g, b, alpha * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    im = im.crop(im.getbbox())
    k = 236 / im.height
    im = im.resize((round(im.width * k), 236), Image.LANCZOS)
    out = Image.new('RGBA', (256, 256))
    out.alpha_composite(im, ((256 - im.width) // 2, 10))
    out.save(os.path.join(REPO, 'icons', 'Pixelart', 'GEAR', 'btn-wardrobe.png'), optimize=True)
    print(out.size, im.size)


main(sys.argv[1])
