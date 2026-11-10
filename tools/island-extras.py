"""island-extras.py: the two island pictures that don't come from cut-island.py's Gemini set.

    python tools/island-extras.py stadium              the whole stadium, from icons/City/plots/
    python tools/island-extras.py box <picture>        the construction box, on flat green
    python tools/island-extras.py level                every plot's kerbs onto the ground's slope
    python tools/island-extras.py despill              green screen left in the pieces cut before

Both update js/core/island-art.js in place. The stadium's plot picture had its grass keyed out with
the green screen, so its holes are filled from the old city's stadium while that is still on disk.
"""
import importlib.util, json, os, sys
import cv2
import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART_JS = os.path.join(REPO, 'js', 'core', 'island-art.js')
spec = importlib.util.spec_from_file_location('cut_island', os.path.join(REPO, 'tools', 'cut-island.py'))
cut = importlib.util.module_from_spec(spec); spec.loader.exec_module(cut)


def read_art():
    s = open(ART_JS, encoding='utf-8').read()
    return s[:s.index('export const')], json.loads(s[s.index('{'):s.rindex('}') + 1])


def write_art(head, data):
    with open(ART_JS, 'w', encoding='utf-8', newline='\n') as f:
        f.write(head + 'export const ISLAND_ART = ' + json.dumps(data, indent=1) + ';\n')


def fill_grass(src, old):
    """Put the old stadium's pixels under the plot picture's see-through parts."""
    a = np.asarray(src).astype(np.float32); b = np.asarray(old).astype(np.uint8)
    orb = cv2.ORB_create(6000)
    k1, d1 = orb.detectAndCompute(cv2.cvtColor(a[..., :3].astype(np.uint8), cv2.COLOR_RGB2GRAY), None)
    k2, d2 = orb.detectAndCompute(cv2.cvtColor(b[..., :3], cv2.COLOR_RGB2GRAY), None)
    pairs = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True).match(d2, d1)
    p2 = np.float32([k2[m.queryIdx].pt for m in pairs]); p1 = np.float32([k1[m.trainIdx].pt for m in pairs])
    M, keep = cv2.estimateAffinePartial2D(p2, p1, ransacReprojThreshold=3)
    print('matched', int(keep.sum()), 'of', len(pairs))
    w = cv2.warpAffine(b, M, src.size, flags=cv2.INTER_LINEAR).astype(np.float32)
    alpha = a[..., 3:] / 255
    under = w[..., 3:] / 255
    # only the holes: what's outside the plot's own outline stays empty
    outside = (a[..., 3] < 128).astype(np.uint8)
    cv2.floodFill(outside, None, (0, 0), 2)
    inside = (outside != 2)[..., None]
    rgb = a[..., :3] * alpha + w[..., :3] * (1 - alpha) * ((under > .8) & inside)
    out_a = np.maximum(alpha, ((under > .8) & inside).astype(np.float32))
    # undo the darkening where neither picture has anything
    rgb = np.where(out_a > 0, rgb / np.maximum(out_a, 1e-3), a[..., :3])
    return Image.fromarray(np.dstack([rgb, out_a * 255]).clip(0, 255).astype(np.uint8), 'RGBA')


def stadium(data):
    src = Image.open(os.path.join(REPO, 'icons', 'City', 'plots', 'stadium.webp')).convert('RGBA')
    old = Image.open(os.path.join(cut.OUT, 'stadium.webp')).convert('RGBA')
    im = fill_grass(src, old.resize((data['pieces']['stadium']['w'], data['pieces']['stadium']['h']), Image.LANCZOS))
    a = np.asarray(im.getchannel('A')) > 200
    low = a[a.shape[0] // 2:]
    xs = np.where(low.sum(0) >= 3)[0]; ys = np.where(a.sum(1) >= 3)[0]
    x0, x1, top, bottom = int(xs[0]), int(xs[-1]) + 1, int(ys[0]), int(ys[-1]) + 1
    k = 4 * cut.UNIT / (x1 - x0)
    px, py = cut.centre('stadium')
    box = (x0 - 4, top - 4, x1 + 4, bottom + 4)
    c = im.crop(box)
    w, h = c.width * k, c.height * k
    cut.save(c.resize((round(w * .7), round(h * .7)), Image.LANCZOS), 'stadium')
    left = px - (x0 + x1) / 2 * k; up = py + 2 * cut.SLOPE * cut.UNIT + cut.KERB - bottom * k
    data['pieces']['stadium'] = {'src': 'icons/Island/stadium.webp', 'x': round(left + box[0] * k, 1), 'y': round(up + box[1] * k, 1), 'w': round(w, 1), 'h': round(h, 1)}
    data['pieces']['stadium'] = cut.level(data['pieces']['stadium'], 'stadium')
    print(data['pieces']['stadium'])


def clean_edge(path):
    """Take the green tint out of the outermost pixels: the picture has no green of its own."""
    a = np.array(Image.open(path).convert('RGBA'))
    solid = (a[..., 3] > 128).astype(np.uint8)
    rim = solid - cv2.erode(solid, np.ones((7, 7), np.uint8))
    tinted = (rim > 0) & (a[..., 1] > np.maximum(a[..., 0], a[..., 2]))
    a[..., 1][tinted] = np.maximum(a[..., 0], a[..., 2])[tinted]
    # and one pixel in from the very edge, where the tint is strongest
    a[..., 3] = np.minimum(a[..., 3], cv2.erode(a[..., 3], np.ones((3, 3), np.uint8)))
    Image.fromarray(a, 'RGBA').save(path, quality=82, alpha_quality=88, method=6)


def box(data, path):
    """One picture for every plot: stored by its offset from the plot's centre."""
    p = cut.fit_plot('box', 'market', path, .6)
    clean_edge(os.path.join(cut.OUT, 'box.webp'))
    p = cut.level({'src': 'icons/Island/box.webp', **p}, 'market')
    cx, cy = cut.centre('market')
    data['pieces']['box'] = {'src': 'icons/Island/box.webp', 'dx': round(p['x'] - cx, 1), 'dy': round(p['y'] - cy, 1), 'w': p['w'], 'h': p['h']}
    print(data['pieces']['box'])


def main():
    head, data = read_art()
    if sys.argv[1] == 'stadium':
        stadium(data)
    elif sys.argv[1] == 'box':
        box(data, sys.argv[2])
    elif sys.argv[1] == 'level':
        # every plot's front kerbs onto the ground's
        for name, piece in data['pieces'].items():
            if name == 'box':
                cx, cy = cut.centre('market')
                p = cut.level({**piece, 'x': cx + piece['dx'], 'y': cy + piece['dy']}, 'market')
                data['pieces']['box'] = {**piece, 'dy': round(p['y'] - cy, 1), 'h': p['h']}
            else:
                plot = 'stadium' if name == 'stadium' else cut.ART[name][0]
                data['pieces'][name] = cut.level(piece, plot)
            print(name, {k: v for k, v in data['pieces'][name].items() if k != 'src'})
    elif sys.argv[1] == 'despill':
        # the pieces cut before cut-island.py's despill(): clean them in place
        srcs = [p['src'] for p in data['pieces'].values()] + ['icons/Island/storey.webp']
        for src in srcs:
            path = os.path.join(REPO, src)
            cut.despill(Image.open(path).convert('RGBA')).save(path, quality=82, alpha_quality=88, method=6)
            print('cleaned', src)
    write_art(head, data)


main()
