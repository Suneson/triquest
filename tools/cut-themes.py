"""cut-themes.py: the base's level themes (MOSKE APP/Island/THEMES.md): one platform per level of the hall
(the locker room), each a repaint of platform-navy_V4 on green, fitted onto the same floor as the one in
plot-art.js (its guide line's corners on the floor's tiles, raised by the same lift), so every item keeps its
place whatever the level.

    python tools/cut-themes.py <themes dir>

  <themes dir>  MOSKE APP/Characters/Photos/Robots/Robots/Base/themes (<lv>-<slug>/platform-<k>.jpg)

Writes icons/Plot/platform-17-<slug>-<tag>.webp and js/core/plot-themes.js. Run tools/cut-plot.py first (it
writes the lawn and the level-4 platform this one copies its lift from).
"""
import importlib.util, json, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('cutplot', os.path.join(HERE, 'cut-plot.py'))
cp = importlib.util.module_from_spec(spec); spec.loader.exec_module(cp)

TAG = 't1'   # change it whenever a theme's platform is repainted
# level -> (slug, the picture picked from its folder); None = the platform plot-art.js already has (Navy Club)
LEVELS = {
    1: ('scrap-yard', '01-scrap-yard/platform-1.jpg'),
    2: ('painted-block', '02-painted-block/platform-1.jpg'),
    3: ('steel-yard', '03-steel-yard/platform-1.jpg'),
    4: ('navy-club', None),
    5: ('coastal-marble', '06-coastal-marble/platform-1.jpg'),
    # 6: the new theme (base-themes-2.csv), till then level 5's
    7: ('pro-arena', '07-pro-arena/platform-1.jpg'),
    8: ('glacier', '08-glacier/platform-2.jpg'),
    9: ('sapphire-citadel', '09-sapphire-citadel/platform-1.jpg'),
    10: ('legend', '10-legend/platform-1.jpg'),
}


def read_art():
    s = open(cp.ART_JS, encoding='utf-8').read()
    return json.loads(s[s.index('{'):s.rindex('}') + 1])


def fit(path, world, lift, slug):
    rgb = np.asarray(Image.open(path).convert('RGB'))
    h, w = rgb.shape[:2]
    # the guide line's rough corners, from V4's (2304 x 1840) scaled to this picture
    sx, sy = w / 2304, h / 1840
    cp.GUIDE_ROUGH = [(x * sx, y * sy) for x, y in [(1196, 640), (2070, 1070), (1224, 1490), (350, 1054)]]
    rgba = cp.key_green(rgb)
    top, right, bot, left = cp.guide_corners(rgb, rgba[..., 3])
    P, F = cp.P, cp.FLOOR
    src = np.float64([top, right, bot, left])
    dst = np.float64([np.array(world(u, v)) - [0, lift] for u, v in ((P, P), (P + F, P), (P + F, P + F), (P, P + F))])
    S3 = np.c_[src, np.ones(4)]
    (a, b, c), *_ = np.linalg.lstsq(S3, dst[:, 0], rcond=None)
    (d, e, f), *_ = np.linalg.lstsq(S3, dst[:, 1], rcond=None)
    M = np.array([[a, b, c], [d, e, f], [0, 0, 1]])
    off = np.abs((S3 @ M[:2].T) - dst).max() / cp.TILE_W
    X, Y = (np.c_[[0, w, w, 0], [0, 0, h, h], np.ones(4)] @ M[:2].T).T
    x0, y0, x1, y1 = X.min(), Y.min(), X.max(), Y.max()
    k = cp.STORE_K; W, H = math.ceil((x1 - x0) * k), math.ceil((y1 - y0) * k)
    inv = np.linalg.inv(M) @ np.array([[1 / k, 0, x0], [0, 1 / k, y0], [0, 0, 1]])
    im = Image.fromarray(rgba, 'RGBA').convert('RGBa')
    im = im.transform((W, H), Image.AFFINE, tuple(inv[:2].ravel()), resample=Image.BICUBIC).convert('RGBA')
    name = f'platform-{F}-{slug}-{TAG}.webp'
    im.save(os.path.join(cp.OUT, name), quality=86, method=6)
    print(slug, 'walls lean', round(math.degrees(math.atan2(b, e)), 2), 'deg; worst corner', round(off, 3), 'tiles off')
    return {'src': f'icons/Plot/{name}', 'x': round(float(x0), 1), 'y': round(float(y0), 1),
            'w': round(float(x1 - x0), 1), 'h': round(float(y1 - y0), 1)}


def main():
    themes = sys.argv[1]
    art = read_art()
    lawn = art['lawn']
    B, Rr, L = np.array(lawn['back']), np.array(lawn['right']), np.array(lawn['left'])
    world = lambda u, v: tuple(B + (Rr - B) * u / cp.N + (L - B) * v / cp.N)
    cp.TILE_W = (Rr[0] - L[0]) / cp.N
    base = art['platform']
    for f in os.listdir(cp.OUT):
        if f.startswith(f'platform-{cp.FLOOR}-') and f != os.path.basename(base['src']): os.remove(os.path.join(cp.OUT, f))
    out = {}
    for lv, (slug, pic) in sorted(LEVELS.items()):
        p = {k: base[k] for k in ('src', 'x', 'y', 'w', 'h')} if pic is None else fit(os.path.join(themes, pic), world, base['lift'], slug)
        out[lv] = {'theme': slug, **p}
    with open(os.path.join(cp.REPO, 'js', 'core', 'plot-themes.js'), 'w', encoding='utf-8') as f:
        f.write('// plot-themes.js: the base\'s platform for each level of the hall (MOSKE APP/Island/THEMES.md), on the\n'
                '// same floor as plot-art.js\'s. Written by tools/cut-themes.py. Don\'t edit by hand.\n')
        f.write('export const PLOT_THEMES = ' + json.dumps(out, indent=1) + ';\n')


if __name__ == '__main__':
    main()
