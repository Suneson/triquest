"""renders-to-webp.py: render-grounds.py's renders, as the game's pictures (no repaint yet).

    python tools/render-items/renders-to-webp.py <renders dir>

Base items go to icons/Items/<name>-<a|b>.webp, the crates to icons/Crates/. (The delivery bike
and boat are cut by tools/cut-grounds.py.) The render's floor shadow is kept, faded out close to the model (the sun's long
shadow runs off the render's edge, and the shadow catcher leaves a faint veil over its floor).
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WHERE = {
    'room-pantry': ('icons/Items', 720), 'room-smoothie-bar': ('icons/Items', 720),
    **{n: ('icons/Crates', 512) for n in ('crate-z1-recovery', 'crate-z2-endurance', 'crate-z3-tempo', 'crate-z4-threshold',
                                          'crate-z5-max', 'crate-item-delivery', 'box-clothes-delivery')},
}


def clean(im):
    a = np.asarray(im.convert('RGBA')).copy()
    solid = a[..., 3] > 250
    ys, xs = np.where(solid)
    reach = 0.12 * max(np.ptp(ys), np.ptp(xs))
    fade = np.clip(1 - ndi.distance_transform_edt(~solid) / reach, 0, 1) ** 1.2
    sh = np.clip((a[..., 3].astype(np.float32) - 14) / (241 - 14), 0, 1) * fade * 0.8 * 255
    a[..., 3] = np.where(solid, a[..., 3], sh.astype(np.uint8))
    out = Image.fromarray(a, 'RGBA')
    return out.crop(out.getchannel('A').point(lambda v: 255 if v > 3 else 0).getbbox())


def main():
    src = sys.argv[1]
    for name, (folder, side) in WHERE.items():
        os.makedirs(os.path.join(ROOT, folder), exist_ok=True)
        for face in 'ab':
            p = os.path.join(src, f'{name}-{face}.png')
            if not os.path.exists(p): continue
            im = clean(Image.open(p))
            im.thumbnail((side, side), Image.LANCZOS)
            im.save(os.path.join(ROOT, folder, f'{name}-{face}.webp'), quality=88, method=6)
            print(folder, name, face, im.size)


if __name__ == '__main__':
    main()
