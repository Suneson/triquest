"""cut-city.py — key the city pictures from tools/gen-city.mjs out of their green sky (docs/CITY.md).

    python3 tools/cut-city.py <gen dir> <out dir>

  floor-N.png   -> <out>/floor-N.webp          its sky keyed out (transparent)
                -> <out>/floor-N-preview.jpg   the whole picture over the sky, and beside it the
                                               middle 9:16 a phone shows before you swipe sideways
  sky.png       -> <out>/sky.webp
  clouds-*.png  -> <out>/clouds-*.webp         keyed out

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


def over_sky(im, sky):
    """The floor over the sky, the sky scaled to cover it."""
    k = max(im.width / sky.width, im.height / sky.height)
    bg = sky.resize((round(sky.width * k), round(sky.height * k)), Image.LANCZOS)
    canvas = Image.new('RGBA', im.size)
    canvas.paste(bg, ((im.width - bg.width) // 2, 0))
    canvas.alpha_composite(im)
    return canvas.convert('RGB')


def main():
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
