"""cut-city.py — key the city pictures from tools/gen-city.mjs out of their green sky (docs/CITY.md).

    python3 tools/cut-city.py <gen dir> <out dir>
    python3 tools/cut-city.py align <floor.png> <floor-0.png>     (in place, keeps <floor>-raw.png)

  floor-N.png   -> <out>/floor-N.webp          its sky keyed out (transparent)
                -> <out>/floor-N-preview.jpg   the whole picture over the sky, and beside it the
                                               middle 9:16 a phone shows before you swipe sideways
  sky.png       -> <out>/sky.webp
  clouds-*.png  -> <out>/clouds-*.webp         keyed out

`align` scales and shifts a floor so its roof slab lands exactly on floor 0's: Gemini frames
each new floor a little wider or higher. The slab is found as the flat concrete round the
picture's middle.

Build-time only (Pillow, numpy, scipy; the green key is cut-art.py's).
"""
import os, sys, importlib.util
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('cut_art', os.path.join(HERE, 'cut-art.py'))
cut_art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cut_art)


def keyed(path):
    arr = np.asarray(Image.open(path).convert('RGB'))
    img, alpha = cut_art.key_green(arr)
    return Image.fromarray(np.dstack([img.clip(0, 255), (alpha * 255).clip(0, 255)]).astype(np.uint8), 'RGBA')


def slab(path):
    """The roof slab's top, bottom and centre x, in px."""
    from scipy import ndimage
    a = np.asarray(Image.open(path).convert('RGB')).astype(int)
    h, w, _ = a.shape
    # the concrete: start from the lightest flat patch near the middle of the picture
    best = None
    for fy in (0.30, 0.34, 0.38, 0.42):
        for fx in (0.45, 0.5, 0.55):
            y, x = int(h * fy), int(w * fx)
            patch = a[y - 20:y + 20, x - 20:x + 20].reshape(-1, 3)
            score = patch.std(0).sum() - patch.mean() / 4
            if best is None or score < best[0]:
                best = (score, x, y)
    _, x, y = best
    m = np.abs(a - a[y, x]).sum(2) < 45
    lab, _ = ndimage.label(m)
    m = ndimage.binary_opening(lab == lab[y, x], iterations=4)
    ys, xs = np.where(m)
    top, bottom = ys.min(), ys.max()
    return top, bottom, (xs[ys == top].mean() + xs[ys == bottom].mean()) / 2


def align(path, ref):
    t0, b0, x0 = slab(ref)
    t1, b1, x1 = slab(path)
    k = max((b0 - t0) / (b1 - t1), 1.0)
    src = Image.open(path).convert('RGB')
    base, _ = os.path.splitext(path)
    if not os.path.exists(base + '-raw.png'):
        src.save(base + '-raw.png')
    big = src.resize((round(src.width * k), round(src.height * k)), Image.LANCZOS)
    W, H = Image.open(ref).size
    # the shift that lands the slab, held so the picture still covers the frame (a few px off at worst)
    ox = min(max(0, round(x1 * k - x0)), big.width - W)
    oy = min(max(0, round(t1 * k - t0)), big.height - H)
    out = big.crop((ox, oy, ox + W, oy + H))
    out.save(path)
    print(f'{os.path.basename(path)}: ×{k:.3f}, shifted {ox}, {oy}')


def over_sky(im, sky):
    """The floor over the sky, the sky scaled to cover it."""
    k = max(im.width / sky.width, im.height / sky.height)
    bg = sky.resize((round(sky.width * k), round(sky.height * k)), Image.LANCZOS)
    canvas = Image.new('RGBA', im.size)
    canvas.paste(bg, ((im.width - bg.width) // 2, 0))
    canvas.alpha_composite(im)
    return canvas.convert('RGB')


def main():
    if sys.argv[1] == 'align':
        return align(sys.argv[2], sys.argv[3])
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    sky = None
    if os.path.exists(os.path.join(src, 'sky.png')):
        sky = Image.open(os.path.join(src, 'sky.png')).convert('RGB')
        sky.save(os.path.join(dst, 'sky.webp'), 'WEBP', quality=82, method=6)
    for f in sorted(os.listdir(src)):
        if f.startswith('clouds-') and f.endswith('.png'):
            keyed(os.path.join(src, f)).save(os.path.join(dst, f[:-4] + '.webp'), 'WEBP', quality=85, method=6)
    for f in sorted(os.listdir(src)):
        if not (f.startswith('floor-') and f[6:-4].isdigit() and f.endswith('.png')):
            continue
        name = f[:-4]
        im = keyed(os.path.join(src, f))
        im.save(os.path.join(dst, f'{name}.webp'), 'WEBP', quality=84, method=6)
        if sky is not None:
            full = over_sky(im, sky)
            w9 = round(im.height * 9 / 16)
            x9 = (im.width - w9) // 2
            phone = full.crop((x9, 0, x9 + w9, im.height))
            # the whole picture with the phone's frame drawn on, and the phone's view beside it
            framed = full.copy()
            ImageDraw.Draw(framed).rectangle((x9, 0, x9 + w9 - 1, im.height - 1), outline=(255, 255, 255), width=max(6, im.width // 300))
            gap = im.width // 30
            sheet = Image.new('RGB', (framed.width + gap + phone.width, im.height), (16, 52, 30))
            sheet.paste(framed, (0, 0)); sheet.paste(phone, (framed.width + gap, 0))
            sheet.thumbnail((2400, 2400))
            sheet.save(os.path.join(dst, f'{name}-preview.jpg'), quality=86)
        print(name, im.size)


if __name__ == '__main__':
    main()
