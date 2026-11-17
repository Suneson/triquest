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

spec = importlib.util.spec_from_file_location('key_paint', os.path.join(REPO, 'tools', 'key-paint.py'))
kp = importlib.util.module_from_spec(spec); spec.loader.exec_module(kp)


def back_to_frame(path, fitted, size):
    """The repaint keyed and put back in the storey picture's frame."""
    a = Image.fromarray(kp.keyed(path), 'RGBA')
    a = a.resize(fitted.size, Image.LANCZOS)
    return a.crop((PAD, PAD, PAD + size[0], PAD + size[1]))


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


def main(rep, green):
    with open(ART_JS, encoding='utf-8') as f:
        t = f.read()
    head, data, tail = t[:t.index('{')], json.loads(t[t.index('{'):t.rindex('}') + 1]), t[t.rindex('}') + 1:]
    for i, st in enumerate(data['storeys'], 1):
        fitted = Image.open(os.path.join(green, f'storey-{i}-fitted.png'))
        cur = Image.open(os.path.join(REPO, st['src']))
        im = back_to_frame(os.path.join(rep, f'building-storey-{i}-v3.jpg'), fitted, cur.size)
        im.save(os.path.join(OUT, f'storey-{i}.webp'), quality=84, alpha_quality=90, method=6)
        rail = front_only(back_to_frame(os.path.join(rep, f'building-parapet-{i}.jpg'), fitted, cur.size))
        rail.save(os.path.join(OUT, f'parapet-{i}.webp'), quality=84, alpha_quality=90, method=6)
        st['parapet'] = f'icons/Island/parapet-{i}.webp'
        print(i, im.size)
    with open(ART_JS, 'w', encoding='utf-8', newline='\n') as f:
        f.write(head + json.dumps(data, indent=1) + tail)


if __name__ == '__main__':
    main(*sys.argv[1:3])
