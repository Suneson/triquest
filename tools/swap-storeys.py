"""
The storeys repainted from their fitted pictures (repaint-building-v3.csv: building-storey-N-v3,
no railing on the roof) and each storey's front railing (building-parapet-N), put in the game.

Each repaint was made over Items/11-17_Greenscreen building/storey-N-fitted.png, which is the
game's own icons/Island/storey-N.webp on green with PAD px round it. So it maps straight back:
keyed, scaled to that picture's size, the pad cut off. The railing comes out in the storey's own
frame (same box), and diorama.js lays it over the room standing on that storey's roof.

  python tools/swap-storeys.py "<Repaint/building>" "<Items/11-17_Greenscreen building>"
"""
import importlib.util
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, 'icons', 'Island')
ART_JS = os.path.join(REPO, 'js', 'core', 'island-art.js')
PAD = 60
V = 'v4'          # the pictures' version, in their names

spec = importlib.util.spec_from_file_location('key_paint', os.path.join(REPO, 'tools', 'key-paint.py'))
kp = importlib.util.module_from_spec(spec); spec.loader.exec_module(kp)


def back_to_frame(path, fitted, size):
    """The repaint keyed and put back in the storey picture's frame."""
    a = Image.fromarray(kp.keyed(path), 'RGBA')
    a = np.asarray(a.resize(fitted.size, Image.LANCZOS)).copy()
    # nothing on the building is green: any left on an edge is the screen's
    a[..., 1] = np.minimum(a[..., 1], np.maximum(a[..., 0], a[..., 2]).astype(np.int16) + 8).astype(np.uint8)
    return Image.fromarray(a, 'RGBA').crop((PAD, PAD, PAD + size[0], PAD + size[1]))


def front_only(im):
    """A railing: only its two front runs (the left and right corners, down to the front one);
    anything standing behind the line between the left and right corners goes."""
    a = np.asarray(im).copy()
    on = a[..., 3] > 40
    lab, n = ndi.label(on)
    if n > 1:   # specks of green spill away from the railing
        sizes = ndi.sum(on, lab, range(1, n + 1))
        on = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > sizes.max() * 0.01])
    cols = np.where(on.any(0))[0]
    yl = np.where(on[:, cols[0]])[0].max(); yr = np.where(on[:, cols[-1]])[0].max()
    h = np.ptp(np.where(on.any(1))[0])
    # the runs' feet slope down to the front; a back run rises from a corner instead
    x = np.arange(a.shape[1])
    xl, xr = cols[0], cols[-1]; xf = int(np.where(on[np.where(on.any(1))[0].max()])[0].mean())
    foot = np.where(x <= xf, yl + (x - xl) * (np.where(on.any(1))[0].max() - yl) / max(1, xf - xl),
                    yr + (xr - x) * (np.where(on.any(1))[0].max() - yr) / max(1, xr - xf))
    post = 0.18 * h   # how high a post stands over its run's foot
    keep = np.arange(a.shape[0])[:, None] >= (foot[None, :] - post)
    a[..., 3] = np.where(on & keep, a[..., 3], 0)
    return Image.fromarray(a, 'RGBA')


RAIL_DROP = 31   # px the railing's foot stands below the roof's front corner (as on the bike floor, which looks right)


def align_rail(im, st):
    """The railing moved so its front foot stands on the storey's roof edge (the repaint drew some at
    the cornice, a storey's band lower: they hung under the room's floor)."""
    a = np.asarray(im)
    on = a[..., 3] > 128
    ys, xs = np.where(on)
    fy = ys.max(); fx = xs[ys >= fy - 2].mean()
    dx, dy = round(st['ax'] - fx), round(st['ay'] - st['wall'] + RAIL_DROP - fy)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (dx, dy))
    return out


def solid_rail(im):
    """The railing as a solid wall: the gaps between its balusters filled with its own stone in shade,
    so the room behind doesn't show through (its floor doesn't line up with the storey's roof)."""
    a = np.asarray(im).copy()
    on = a[..., 3] > 40
    holes = ndi.binary_fill_holes(on) & ~on
    shade = (np.median(a[on][:, :3], axis=0) * 0.58).astype(np.uint8)
    a[holes, :3] = shade; a[holes, 3] = 255
    return Image.fromarray(a, 'RGBA')


def main(rep, green):
    with open(ART_JS, encoding='utf-8') as f:
        t = f.read()
    head, data, tail = t[:t.index('{')], json.loads(t[t.index('{'):t.rindex('}') + 1]), t[t.rindex('}') + 1:]
    for i, st in enumerate(data['storeys'], 1):
        fitted = Image.open(os.path.join(green, f'storey-{i}-fitted.png'))
        cur = Image.open(os.path.join(REPO, st['src']))
        im = back_to_frame(os.path.join(rep, f'building-storey-{i}-v3.jpg'), fitted, cur.size)
        # new names each time they change: a phone keeps pictures across versions (sw.js), and an old
        # storey under a new railing doesn't line up
        im.save(os.path.join(OUT, f'storey-{i}-{V}.webp'), quality=84, alpha_quality=90, method=6)
        st['src'] = f'icons/Island/storey-{i}-{V}.webp'
        rail = align_rail(solid_rail(front_only(back_to_frame(os.path.join(rep, f'building-parapet-{i}.jpg'), fitted, cur.size))), st)
        rail.save(os.path.join(OUT, f'parapet-{i}-{V}.webp'), quality=84, alpha_quality=90, method=6)
        st['parapet'] = f'icons/Island/parapet-{i}-{V}.webp'
        print(i, im.size)
    with open(ART_JS, 'w', encoding='utf-8', newline='\n') as f:
        f.write(head + json.dumps(data, indent=1) + tail)


if __name__ == '__main__':
    main(*sys.argv[1:3])
