"""cut-shop-ui.py — fit the generated shop art (tools/gen-shop-ui.mjs) into the app.

    python3 tools/cut-shop-ui.py <gen dir>

  tab-*.png        -> icons/UI/tabs/<name>.webp    green keyed out, trimmed, 128 px square
  sport-*.png|jpg  -> icons/UI/sports/<name>.webp  the GYM tab's sport buttons, the same way
                      (sources in icons/UI/sports/src/; one that already has alpha,
                      the T3 shoe, is only trimmed)
  nav-*.png|jpg    -> icons/UI/nav/<name>.webp     the bottom dock's icons (sources in icons/UI/nav/src/)
  chat-*.png       -> icons/UI/chat/<name>.webp    the Chat tab's General and Club switches
  frame-*.png      -> icons/UI/frames/<name>.webp  a panel frame (magenta inside and out), kept to its shape, 640 px wide
  side-*.png       -> icons/UI/side/<name>.webp    the base's side buttons, 192 px: the green orb
                      (keyed from magenta) and the trophy and target icons

(The card plates and (i) buttons are painted art: tools/cut-card-art.py.)

Build-time only (Pillow, numpy, scipy; the key is cut-art.py's).
"""
import os, sys, importlib.util
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('cut_art', os.path.join(HERE, 'cut-art.py'))
cut_art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cut_art)
UI = os.path.join(os.path.dirname(HERE), 'icons', 'UI')


def magenta(rgb):
    """Is the screen colour (the image's border) magenta rather than green?"""
    edge = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]).astype(int)
    r, g, b = np.median(edge, axis=0)
    return r > 180 and b > 180 and g < 90


def key_magenta(rgb):
    """Key out a #FF00FF screen: alpha from how much magenta a pixel holds (red and blue both
    above green), and that magenta taken back out of the soft edge. Pixels with no magenta in
    them (blues, whites, greys) are left exactly as they are."""
    f = rgb.astype(float)
    excess = np.clip(np.minimum(f[..., 0], f[..., 2]) - f[..., 1], 0, None)  # the magenta in it
    spill = excess / 255
    alpha = np.clip((0.55 - spill) / 0.3, 0, 1)
    out = f.copy()
    out[..., 0] -= excess; out[..., 2] -= excess
    return Image.fromarray(np.dstack([out.clip(0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)]), 'RGBA')


def main():
    src = sys.argv[1]
    for f in sorted(os.listdir(src)):
        name, ext = os.path.splitext(f)
        if ext not in ('.png', '.jpg'):
            continue
        path = os.path.join(src, f)
        folder = {'tab': 'tabs', 'sport': 'sports', 'nav': 'nav', 'side': 'side', 'chat': 'chat', 'frame': 'frames'}.get(name.split('-')[0])
        if folder:
            os.makedirs(os.path.join(UI, folder), exist_ok=True)
            raw = Image.open(path)
            if raw.mode == 'RGBA' and np.asarray(raw)[..., 3].min() < 128:
                im = raw  # already cut out
            elif magenta(np.asarray(raw.convert('RGB'))):
                im = key_magenta(np.asarray(raw.convert('RGB')))  # the green orb is painted on magenta
            else:
                rgb = np.asarray(raw.convert('RGB'))
                img, alpha = cut_art.key_green(rgb)
                a = (alpha * 255).clip(0, 255).astype(np.uint8)
                im = Image.fromarray(np.dstack([img.clip(0, 255).astype(np.uint8), a]), 'RGBA')
            im = im.crop(im.getbbox())
            if folder == 'frames':
                # a panel frame keeps its shape (a 9-slice border image), 640 px wide
                out = os.path.join(UI, folder, name + '.webp')
                im.resize((640, round(640 * im.height / im.width)), Image.LANCZOS).save(out, 'WEBP', quality=92, method=6)
                print(out, os.path.getsize(out), im.size)
                continue
            s = int(max(im.size) * 1.06)
            sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
            sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2), im)
            out = os.path.join(UI, folder, name + '.webp')
            px = 192 if folder == 'side' else 128  # the base's side buttons show bigger
            sq.resize((px, px), Image.LANCZOS).save(out, 'WEBP', quality=90, method=6)
        else:
            continue
        print(out, os.path.getsize(out))


if __name__ == '__main__':
    main()
