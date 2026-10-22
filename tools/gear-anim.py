"""gear-anim.py — an animated item from a green-screen clip.

Takes a green-screen GIF (or a folder of PNG frames exported from an MP4),
keys the green out with a tolerance and spill suppression, trims every frame
to the sprite's shared bounding box, scales nearest-neighbour so the longest
side is --size, and writes an animated WebP that stays under 400 KB (quality
steps down until it fits). Warns loudly when keying leaves a green fringe:
pixel art shows it badly.

    python3 -I tools/gear-anim.py <in.gif | frames-dir> <out.webp> [--tolerance=90] [--size=256] [--fps=12]

An MP4 has to be turned into frames first (ffmpeg -i in.mp4 frames/%03d.png);
ffmpeg is build-time only and isn't needed for GIFs. Pillow, build-time only.
"""
import os, sys
from PIL import Image, ImageSequence

def opt(name, dflt):
    for a in sys.argv[1:]:
        if a.startswith(f'--{name}='):
            return type(dflt)(a.split('=', 1)[1])
    return dflt

def frames_of(src):
    if os.path.isdir(src):
        files = sorted(f for f in os.listdir(src) if f.lower().endswith('.png'))
        return [Image.open(os.path.join(src, f)).convert('RGBA') for f in files], None
    im = Image.open(src)
    return [f.convert('RGBA') for f in ImageSequence.Iterator(im)], im.info.get('duration')

def key(frame, tol):
    px = frame.load()
    w, h = frame.size
    fringe = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            greenness = g - max(r, b)
            if greenness > tol and g > 120:
                px[x, y] = (0, 0, 0, 0)
            elif greenness > 20 and a:
                px[x, y] = (r, max(r, b) + 8, b, 255)   # spill suppression
                fringe += 1
    return fringe

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 2:
        print(__doc__); sys.exit(1)
    src, out = args
    tol, size, fps = opt('tolerance', 90), opt('size', 256), opt('fps', 12)
    frames, dur = frames_of(src)
    fringe = sum(key(f, tol) for f in frames)
    total = sum(f.size[0] * f.size[1] for f in frames)
    box = None
    for f in frames:
        b = f.getbbox()
        if b:
            box = b if not box else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    frames = [f.crop(box) for f in frames]
    w, h = frames[0].size
    k = size / max(w, h)
    frames = [f.resize((max(1, round(w * k)), max(1, round(h * k))), Image.NEAREST) for f in frames]
    for f in frames:   # hard alpha
        a = f.getchannel('A').point(lambda v: 255 if v > 128 else 0)
        f.putalpha(a)
    duration = dur or round(1000 / fps)
    for q in (90, 80, 70, 60, 50, 40):
        frames[0].save(out, save_all=True, append_images=frames[1:], duration=duration, loop=0, quality=q, method=6)
        if os.path.getsize(out) <= 400 * 1024:
            break
    kb = os.path.getsize(out) / 1024
    print(f'wrote {out}: {len(frames)} frames, {frames[0].size[0]}×{frames[0].size[1]}, {duration} ms, {kb:.0f} KB')
    if kb > 400:
        print('WARNING: still over 400 KB at quality 40; use fewer frames or a smaller --size')
    if fringe / max(1, total) > 0.01:
        print(f'WARNING: green fringe on {100 * fringe / total:.1f}% of pixels after keying; check the edges (raise --tolerance or clean the clip)')

if __name__ == '__main__':
    main()
