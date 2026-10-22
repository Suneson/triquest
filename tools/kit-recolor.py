"""kit-recolor.py — a first try at kit colours on the animated cyclist.

Recolours the blue kit (jersey, shorts, helmet) of one character sprite to a
kit's colourway by hue: every opaque pixel whose hue is in the kit-blue band
and is saturated enough takes the kit's hue and saturation, keeping its own
brightness, so the shading survives. Frame count and timing are kept.

This is the shortcut version of Phase 5b (no tagged palette yet): it works
when the base kit is one hue that nothing else on the character uses. On the
level-6 rider that holds; the shoes and the bike stay as they are.

    python3 tools/kit-recolor.py <sprite.webp> <kit-id> <hue°> <sat 0-1> [<value gain>]

writes <sprite>--<kit-id>.webp next to it. Build-time only (Pillow).
"""
import sys
from PIL import Image, ImageChops, ImageSequence

BLUE_LO, BLUE_HI = 195, 252   # degrees: the base kit's blue band
MIN_SAT = 0.25

def recolour(frame, hue, sat, gain):
    rgba = frame.convert('RGBA')
    alpha = rgba.getchannel('A')
    h, s, v = rgba.convert('RGB').convert('HSV').split()
    lo, hi = int(BLUE_LO / 360 * 255), int(BLUE_HI / 360 * 255)
    in_band = h.point(lambda x: 255 if lo <= x <= hi else 0)
    saturated = s.point(lambda x: 255 if x >= MIN_SAT * 255 else 0)
    opaque = alpha.point(lambda x: 255 if x > 0 else 0)
    mask = ImageChops.multiply(ImageChops.multiply(in_band, saturated), opaque)
    new_h = Image.new('L', h.size, int(hue / 360 * 255))
    new_s = s.point(lambda x: min(255, int(sat * 255 * (0.6 + 0.4 * x / 255))))
    new_v = v.point(lambda x: min(255, int(x * gain)))
    tinted = Image.merge('HSV', (new_h, new_s, new_v)).convert('RGB').convert('RGBA')
    tinted.putalpha(alpha)
    return Image.composite(tinted, rgba, mask)

def main():
    src, kit, hue, sat = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
    gain = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
    im = Image.open(src)
    frames, durations = [], []
    for f in ImageSequence.Iterator(im):
        frames.append(recolour(f, hue, sat, gain))
        durations.append(f.info.get('duration', im.info.get('duration', 83)))
    out = src.replace('.webp', f'--{kit}.webp')
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=durations, loop=0, lossless=False, quality=90, method=6)
    print(f'wrote {out}: {len(frames)} frames, {durations[0]} ms')

if __name__ == '__main__':
    main()
