"""cut-island.py: the island's pictures for the app (docs/CITY.md), and js/core/island-art.js, where they stand.

    python tools/cut-island.py <island picture, 5504 x 3072> <upscaled art dir>

The ground is one Gemini picture, cut in tiles: full size round the city, half size over open sea.
Each plot's building is on flat green and is keyed out, then fitted to its plot by the plot's own
corners (the paintings don't all sit at exactly the same size). The stadium and the construction
box are tools/island-extras.py's: they're kept as they are.
"""
import json, os, sys
import cv2
import numpy as np
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS = None

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, 'icons', 'Island')
SLOPE = 0.489
UNIT = 537                      # world px per ground unit: a 2 x 2 plot is 2148 px across
ART_CX, ART_CY, ART_K = 2752, 1520, 228     # the island picture's camera
W = UNIT / ART_K
WORLD = (round(5504 * W), round(3072 * W))
L = 2.59                        # one plot to the next, in ground units
KERB = 21.5                     # the kerb's height under a plot's front corner
CX, CY = ART_CX * W, ART_CY * W
FOOT = (-0.86, 0.70)            # the base's footprint on its plot
GROUND_FLOOR = 190.4            # the base's ground floor, in world px

PLOTS = {'park': (-1, -1), 'stadium': (0, -1), 'club': (-1, 0), 'base': (0, 0), 'pool': (0, 1),
         'mall': (1, 0), 'arena': (1, -1), 'hall': (-1, 1), 'market': (1, 1)}
ART = {  # key: (plot, file, stored px per world px)
    'park': ('park', 'park-upscale-2x.jpg', .6),
    'arena': ('arena', '1v1 Arena-upscale-2x.jpg', .6),
    'hall': ('hall', 'hall of fame-upscale-2x.jpg', .6),
    'mall': ('mall', 'Moske Mall-upscale-2x.jpg', .6),
    'base': ('base', 'base-c-upscale-2x.png', 1.25),
    'club-ruin': ('club', 'Club Base level 1-upscale-2x.jpg', .6),
    'club': ('club', 'Club Base stage 3 post construction-upscale-2x.jpg', .6),
    'pool-ruin': ('pool', 'Moske Pool derrelict - before fix-upscale-2x.jpg', .6),
    'pool': ('pool', 'Moske Pool-upscale-2x.jpg', .6),
    'market-ruin': ('market', 'Market Abandoned-upscale-2x.jpg', .6),
    'market': ('market', 'Market Empty-upscale-2x.jpg', .6),
}


RETINT = {'hall': (360, 210, 460, 410)}             # x0, y0, x1, y1 in the stored picture


def centre(plot):
    i, j = PLOTS[plot]
    a, b = i * L, j * L
    return CX + (a - b) * UNIT, CY + (a + b) * SLOPE * UNIT


def key(path):
    """RGBA from a picture on green. Only pure, bright green goes: grass and leaves stay."""
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    s = g - np.maximum(r, b)
    alpha = 1 - np.clip((s - 125) / 70, 0, 1)
    soft = alpha < 0.995
    g2 = np.where(soft, np.minimum(g, np.maximum(r, b) + 6), g)
    return despill(Image.fromarray(np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8), 'RGBA'))


def despill(im):
    """Take out the green screen that's left: a tint along the outline, and green seen through glass.
    Real grass and leaves are darker and more yellow, so they stay."""
    a = np.asarray(im).astype(np.float32)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    hsv = cv2.cvtColor(a[..., :3].clip(0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    hue, sat, val = hsv[..., 0] * 2, hsv[..., 1], hsv[..., 2]
    over = g - np.maximum(r, b)
    solid = (al > 128).astype(np.uint8)
    rim = (solid - cv2.erode(solid, np.ones((9, 9), np.uint8))) > 0
    edge = rim & (over > 12) & (hue >= 100)
    glass = (over >= 40) & (hue >= 114) & (sat > 90)
    # pale green: glass, banners and fences tinted by the screen behind them (grass is far stronger)
    tint = (over > 12) & (hue >= 95) & (sat < 160)
    spill = (edge | glass | tint) & (al > 0)
    g = np.where(spill, np.maximum(r, b) + np.minimum(over, 4), g)
    # the brightest of it was mostly screen: let what's behind show through
    see = glass & (val > 110) & (over > 55)
    al = np.where(see, al * .55, al)
    return Image.fromarray(np.dstack([r, g, b, al]).clip(0, 255).astype(np.uint8), 'RGBA')


def save(im, name, quality=82):
    im.save(os.path.join(OUT, f'{name}.webp'), quality=quality, alpha_quality=88, method=6)


def fit_plot(name, plot, src, stored):
    """Key a plot's picture and stand it on its plot. Returns its box in the world."""
    im = key(src)
    a = np.asarray(im.getchannel('A')) > 200
    # the plot's left and right corners are the widest points of its lower half
    low = a[a.shape[0] // 2:]
    xs = np.where(low.sum(0) >= 3)[0]
    ys = np.where(a.sum(1) >= 3)[0]
    x0, x1, bottom = xs[0], xs[-1] + 1, ys[-1] + 1
    k = 2 * 2 * UNIT / (x1 - x0)                    # world px per art px
    px, py = centre(plot)
    left = px - (x0 + x1) / 2 * k
    top = py + 2 * SLOPE * UNIT + KERB - bottom * k
    box = (int(x0) - 4, int(np.where(a.sum(1) >= 3)[0][0]) - 4, int(x1) + 4, int(bottom) + 4)
    c = im.crop(box)
    w, h = c.width * k, c.height * k
    c = c.resize((round(w * stored), round(h * stored)), Image.LANCZOS)
    if name in RETINT:                              # the green screen, reflected in a window
        p = np.asarray(c).astype(np.float32)
        x0, y0, x1, y1 = RETINT[name]
        z = p[y0:y1, x0:x1]
        tint = z[..., 1] > np.maximum(z[..., 0], z[..., 2]) + 10
        z[..., 1] = np.where(tint, (z[..., 0] + z[..., 2]) / 2 + 8, z[..., 1])
        c = Image.fromarray(p.clip(0, 255).astype(np.uint8), 'RGBA')
    save(c, name)
    return {'x': round(left + box[0] * k, 1), 'y': round(top + box[1] * k, 1), 'w': round(w, 1), 'h': round(h, 1)}


def level(piece, plot):
    """Some paintings' plots slope a little flatter or steeper than the ground's. Stretch the piece
    up or down so its two front kerbs lie on the ground's, front corner on front corner."""
    im = Image.open(os.path.join(REPO, piece['src'])).convert('RGBA')
    k, ky = im.width / piece['w'], im.height / piece['h']
    a = np.asarray(im.getchannel('A')) > 128
    px, py = centre(plot)
    hw = 2 * UNIT
    xs, ys = [], []
    for wx in np.linspace(px - .88 * hw, px + .88 * hw, 61):
        col = int(round((wx - piece['x']) * k))
        rows = np.where(a[:, col])[0] if 0 <= col < a.shape[1] else []
        if abs(wx - px) > .12 * hw and len(rows):
            xs.append(abs(wx - px)); ys.append(piece['y'] + rows[-1] / ky)
    slope, front = np.polyfit(xs, ys, 1)            # the kerb's foot: front + slope * distance from the centre
    want = py + 2 * SLOPE * UNIT + KERB
    e = SLOPE / -slope
    if abs(front - want) < 3 and abs(e - 1) < .005:
        return piece
    return {**piece, 'y': round(want + e * (piece['y'] - front), 1), 'h': round(piece['h'] * e, 1)}


def ground(src):
    im = Image.open(src).convert('RGB')
    xs = [0, 1376, 2752, 4128, 5504]
    ys = [0, 1024, 2048, 3072]
    tiles = []
    for r in range(3):
        for c in range(4):
            t = im.crop((xs[c], ys[r], xs[c + 1], ys[r + 1]))
            if c in (0, 3):
                t = t.resize((t.width // 2, t.height // 2), Image.LANCZOS)
            save(t, f'ground-{r}-{c}', 84)
            x, y = round(xs[c] * W), round(ys[r] * W)
            tiles.append({'src': f'icons/Island/ground-{r}-{c}.webp', 'x': x, 'y': y, 'w': round(xs[c + 1] * W) - x + 1, 'h': round(ys[r + 1] * W) - y + 1})
    return tiles


def storey(src):
    """One upper floor. Its front corner stands on the roof below; returns its box and its height."""
    im = key(src)
    a = np.asarray(im.getchannel('A')) > 200
    xs, ys = np.where(a.sum(0) >= 3)[0], np.where(a.sum(1) >= 3)[0]
    x0, x1, y0, y1 = xs[0], xs[-1] + 1, ys[0], ys[-1] + 1
    k = (FOOT[1] - FOOT[0]) * 2 * UNIT / (x1 - x0)
    c = im.crop((x0 - 4, y0 - 4, x1 + 4, y1 + 4))
    w, h = c.width * k, c.height * k
    c = c.resize((round(w), round(h)), Image.LANCZOS)
    save(c, 'storey')
    wall = (y1 - y0) * k - (x1 - x0) * k * SLOPE
    return {'w': round(w, 1), 'h': round(h, 1), 'wall': round(wall, 1), 'pad': round(4 * k, 1)}


def main():
    isle, up = sys.argv[1:3]
    with open(os.path.join(REPO, 'js', 'core', 'island-art.js'), encoding='utf-8') as f:
        kept = json.loads((t := f.read())[t.index('{'):t.rindex('}') + 1])['pieces']
    os.makedirs(OUT, exist_ok=True)
    pieces = {name: {'src': f'icons/Island/{name}.webp', **fit_plot(name, plot, os.path.join(up, f), s)} for name, (plot, f, s) in ART.items()}
    pieces = {name: level(p, ART[name][0]) for name, p in pieces.items()}
    pieces.update({k: kept[k] for k in ('stadium', 'box')})
    pl = {p: [round(v, 1) for v in centre(p)] for p in PLOTS}
    data = {'world': {'w': WORLD[0], 'h': WORLD[1]}, 'tiles': ground(isle), 'plots': pl, 'pieces': pieces,
            'storey': {'src': 'icons/Island/storey.webp', **storey(os.path.join(up, 'storey-d-upscale-2x.png'))}, 'unit': UNIT, 'slope': SLOPE,
            'foot': FOOT, 'groundFloor': GROUND_FLOOR}
    with open(os.path.join(REPO, 'js', 'core', 'island-art.js'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('// island-art.js: where the island\'s pictures stand, in world px. Written by tools/cut-island.py.\n')
        f.write('export const ISLAND_ART = ' + json.dumps(data, indent=1) + ';\n')
    for n, p in pieces.items():
        print(n, p)


if __name__ == '__main__':
    main()
