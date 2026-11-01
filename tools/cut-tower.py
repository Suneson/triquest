"""cut-tower.py — the layered city (docs/CITY.md): the plate and the tower's pieces.

    python3 tools/cut-tower.py <tower.png> <floor-0.png> <sky.png> <out dir>

  tower.png    the MOSKE tower on its own on green (gen-city.mjs `tower`)
  floor-0.png  the street floor on green (the plate: the city, with the street floor's lobby)

writes, all at the plate's full size and slope:
  plate.png          the street floor, its slope brought to SLOPE (sky still green)
  plate-sky.png      the same over the sky, for expanding in Photoshop
  tower-cap.png      the roof slab and the top storey under it (transparent round it)
  tower-storey.png   one office storey, which stacks on itself with no seam
  tower.json         where they go: the stack stands on the plate's lobby, one storey every `step` px
  preview-N.jpg      floors 0 to 4 put together, as the app will show them

Floor N stands N storeys tall: the cap with N - 1 storeys under it, on the plate's lobby (the
street floor, N = 0, is the plate as it is). In an orthographic picture a taller tower only ever
covers more of the city behind it, so nothing in the plate needs taking away.

Every layer is brought to one slope (SLOPE: the ground's edges fall SLOPE px per px across), the
room pictures' slope. The plate is squashed a little; the tower's right face is evened up with
its left (Gemini drew its storeys 339 px apart on the left and 350 on the right), then stretched.

Measured on the pictures made on 2026-11-01 (MEASURE below): if the pictures change, measure
again. Build-time only (Pillow, numpy, scipy; the green key is cut-art.py's).
"""
import json, os, sys, importlib.util
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('cut_art', os.path.join(HERE, 'cut-art.py'))
cut_art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cut_art)

SLOPE = 0.489  # the room pictures' ground slope (px down per px across)

MEASURE = {
    # the tower picture: its front corner's x, the faces' slopes, the storey step on each face, a
    # line along the bottom of a white ledge (at the corner), and the slab's corners
    'tower': {'cx': 1890, 'slope_l': 0.4748, 'slope_r': 0.4822, 'step_l': 339, 'step_r': 350,
              'ledge': 2345, 'slab': {'top': (1862, 509), 'right': (3304, 1126), 'bottom': (1881, 1799), 'left': (508, 1117)}},
    # the street floor: its tower's front corner, the bottom of the white ledge over its lobby there,
    # the slope of its ground, and its slab's height (top to front corner) for the scale
    'plate': {'cx': 1840, 'ledge': 2595, 'slope': 0.5184, 'slab_h': 1659},
}
# a patch of bare slab concrete in each picture (x, y): the tower's colours are matched to the plate's on it
CONCRETE = {'tower': (1870, 1150), 'plate': (1790, 1670)}


def rgba(path):
    arr = np.asarray(Image.open(path).convert('RGB'))
    img, alpha = cut_art.key_green(arr)
    return np.dstack([img.clip(0, 255), (alpha * 255).clip(0, 255)]).astype(np.float32)


def warp_columns(a, y_of):
    """Resample every column: the output pixel (x, y) takes the input at (x, y_of(x, y))."""
    h, w, c = a.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    src_y = y_of(xx, yy)
    return np.dstack([map_coordinates(a[..., i], [src_y, xx], order=1, mode='constant', cval=0) for i in range(c)])


def even_up_tower(a, m):
    """The right face's storeys brought to the left's spacing and slope, about the ledge line."""
    cx, ref = m['cx'], m['ledge']
    k = m['step_l'] / m['step_r']
    # after squashing by k, the right face's lines fall k * slope_r; shear them to slope_l
    shear = m['slope_l'] - k * m['slope_r']

    def y_of(x, y):
        right = x > cx
        # out = ref + k * (in - ref) - shear * (x - cx)  =>  in = ref + (out - ref + shear * (x - cx)) / k
        src = ref + (y - ref + shear * (x - cx)) / k
        return np.where(right, src, y)
    return warp_columns(a, y_of)


def scale(a, sx, sy):
    h, w, _ = a.shape
    im = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA' if a.shape[2] == 4 else 'RGB')
    return np.asarray(im.resize((round(w * sx), round(h * sy)), Image.LANCZOS)).astype(np.float32)


def main():
    tower_p, plate_p, sky_p, out = sys.argv[1:5]
    os.makedirs(out, exist_ok=True)
    mt, mp = MEASURE['tower'], MEASURE['plate']

    # ---- the plate: squashed to the slope
    plate = np.asarray(Image.open(plate_p).convert('RGB')).astype(np.float32)
    py = SLOPE / mp['slope']
    plate = scale(plate, 1, py)
    P = {'cx': mp['cx'], 'ledge': mp['ledge'] * py}
    Image.fromarray(plate.astype(np.uint8)).save(os.path.join(out, 'plate.png'))

    # ---- the tower: right face evened up, then scaled to the plate's tower and stretched to the slope
    t = even_up_tower(rgba(tower_p), mt)
    # the same concrete reads the same in both: Gemini drew the tower a touch pinker than the city
    def patch(a, xy, r=60):
        x, y = xy
        return a[y - r:y + r, x - r:x + r, :3].reshape(-1, 3).mean(0)
    plate_src = np.asarray(Image.open(plate_p).convert('RGB')).astype(np.float32)
    gain = patch(plate_src, CONCRETE['plate']) / patch(t, CONCRETE['tower'])
    t[..., :3] = (t[..., :3] * gain).clip(0, 255)
    s = mt['slab']
    k = mp['slab_h'] / (s['bottom'][1] - s['top'][1])            # the plate's tower is this much bigger
    ty = SLOPE / mt['slope_l']                                   # and its slope becomes SLOPE
    t = scale(t, k, k * ty)
    T = {'cx': mt['cx'] * k, 'ledge': mt['ledge'] * k * ty, 'step': mt['step_l'] * k * ty,
         'slab': {n: (p[0] * k, p[1] * k * ty) for n, p in s.items()}}
    h, w, _ = t.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # the ledge line through the tower picture, and the line one storey under it
    line = T['ledge'] - SLOPE * np.abs(xx - T['cx'])
    # the cap: above the ledge line, and inside the slab's outline (grown a little for its rim);
    # that keeps out the buildings Gemini drew behind the tower's top
    sl = T['slab']; grow = 0.06 * (sl['right'][0] - sl['left'][0])
    top = (sl['top'][0], sl['top'][1] - grow); left_x = sl['left'][0] - grow; right_x = sl['right'][0] + grow
    back_l = yy >= top[1] + (top[0] - xx) * ((sl['left'][1] - top[1]) / max(1, top[0] - left_x))
    back_r = yy >= top[1] + (xx - top[0]) * ((sl['right'][1] - top[1]) / max(1, right_x - top[0]))
    inside = (xx >= left_x) & (xx <= right_x) & back_l & back_r
    cap = t.copy(); cap[..., 3] *= ((yy < line) & inside)
    storey = t.copy(); storey[..., 3] *= ((yy >= line) & (yy < line + T['step']))

    # crop each piece to what it holds and keep where its corner line sits
    def crop(a):
        ys, xs = np.where(a[..., 3] > 0)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        return a[y0:y1, x0:x1], (int(x0), int(y0))
    cap_c, cap_o = crop(cap)
    st_c, st_o = crop(storey)
    Image.fromarray(cap_c.astype(np.uint8), 'RGBA').save(os.path.join(out, 'tower-cap.png'))
    Image.fromarray(st_c.astype(np.uint8), 'RGBA').save(os.path.join(out, 'tower-storey.png'))

    # where the pieces go on the plate: the ledge line's corner point lands on the plate's
    dx = P['cx'] - T['cx']; dy = P['ledge'] - T['ledge']
    info = {
        'slope': SLOPE, 'colour_gain': [round(float(g), 3) for g in gain], 'plate': list(plate.shape[1::-1]), 'step': round(T['step'], 2),
        # top-left corner of each piece on the plate for a one-storey tower (the cap alone);
        # for N storeys the cap moves up (N - 1) * step, and storey i (0 at the bottom, up to N - 2)
        # sits at storey moved up (i + 1) * step
        'cap': [round(cap_o[0] + dx, 1), round(cap_o[1] + dy, 1)],
        'storey': [round(st_o[0] + dx, 1), round(st_o[1] + dy, 1)],
    }
    json.dump(info, open(os.path.join(out, 'tower.json'), 'w'), indent=2)

    # ---- previews: the plate over the sky, with the tower stacked for each floor
    sky = Image.open(sky_p).convert('RGB')
    pk = max(plate.shape[1] / sky.width, plate.shape[0] / sky.height)
    sky = sky.resize((round(sky.width * pk), round(sky.height * pk)), Image.LANCZOS)
    img, alpha = cut_art.key_green(plate.astype(np.uint8))
    plate_rgba = Image.fromarray(np.dstack([img.clip(0, 255), (alpha * 255).clip(0, 255)]).astype(np.uint8), 'RGBA')
    base = Image.new('RGBA', plate_rgba.size); base.paste(sky, ((plate_rgba.width - sky.width) // 2, 0)); base.alpha_composite(plate_rgba)
    base.convert('RGB').save(os.path.join(out, 'plate-sky.png'))
    cap_im = Image.open(os.path.join(out, 'tower-cap.png')); st_im = Image.open(os.path.join(out, 'tower-storey.png'))
    for n in range(5):
        c = base.copy()
        if n > 0:
            for i in range(n - 1):  # storeys from the bottom up, the lowest one standing on the lobby
                c.alpha_composite(st_im, (round(info['storey'][0]), round(info['storey'][1] - (i + 1) * info['step'])))
            c.alpha_composite(cap_im, (round(info['cap'][0]), round(info['cap'][1] - (n - 1) * info['step'])))
        prev = c.convert('RGB'); prev.thumbnail((1200, 1600))
        prev.save(os.path.join(out, f'preview-{n}.jpg'), quality=85)
    print(json.dumps(info))


if __name__ == '__main__':
    main()
