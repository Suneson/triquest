"""make-builders.py: each builder's hut standing on its pad, as one item picture per facing
(icons/Items/builder-<who>-2-<a|b>.webp; the 2 changes whenever they're redone), so the plot base can place, move and turn them like any item.

    python tools/render-items/make-builders.py <cut dir>

<cut dir>  Base/repaint/cut: pad-navy-<who>-<a|b>.png/.json and hut-navy-<who>-<a|b>.png/.json
           (cut-base-repaints.py; the renders' frames, PPU 100, the json's ox/oy the footprint's middle)

The hut nearly fills its pad (HUT of the pad's side, a thin edge of the pad showing all round), its middle on
the pad's middle. The item's footprint is the pad's.
"""
import json, os, sys
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'icons', 'Items')
HUT = {'blue': 0.9, 'red': 0.9, 'green': 0.9, 'gold': 0.9}   # the hut's longest side, as a share of the pad's
LIFT = 15        # px of the pad's render: the hut stands on the pad's top, not the ground under it
HEIGHT = 720     # the stored picture's height, as the other items


def main():
    cut = sys.argv[1]
    for who, k in HUT.items():
        for face in 'ab':
            pm = json.load(open(os.path.join(cut, f'pad-navy-{who}-{face}.json')))
            hm = json.load(open(os.path.join(cut, f'hut-navy-{who}-{face}.json')))
            pad = Image.open(os.path.join(cut, f'pad-navy-{who}-{face}.png')).convert('RGBA')
            hut = Image.open(os.path.join(cut, f'hut-navy-{who}-{face}.png')).convert('RGBA')
            s = k * pm['tiles'] / hm['tiles']
            hut = hut.resize((round(hut.width * s), round(hut.height * s)), Image.LANCZOS)
            hx, hy = pm['ox'] - hm['ox'] * s, pm['oy'] - LIFT - hm['oy'] * s
            x0, y0 = min(0, hx), min(0, hy)
            x1, y1 = max(pad.width, hx + hut.width), max(pad.height, hy + hut.height)
            c = Image.new('RGBA', (round(x1 - x0), round(y1 - y0)), (0, 0, 0, 0))
            c.alpha_composite(pad, (round(-x0), round(-y0)))
            c.alpha_composite(hut, (round(hx - x0), round(hy - y0)))
            c = c.crop(c.getchannel('A').point(lambda v: 255 if v > 3 else 0).getbbox())
            c = c.resize((round(c.width * HEIGHT / c.height), HEIGHT), Image.LANCZOS)
            c.save(os.path.join(OUT, f'builder-{who}-2-{face}.webp'), quality=88, method=6)
            print(f'builder-{who}-2-{face}', c.size)


if __name__ == '__main__':
    main()
