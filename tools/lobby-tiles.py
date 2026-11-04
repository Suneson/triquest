"""lobby-tiles.py — put an edited lobby picture back into the city tiles (docs/CITY.md, "Editing the lobby").

    python3 tools/lobby-tiles.py <lobby-edited.png>

The lobby picture is the four city tiles city-1-1, city-1-2, city-2-1 and city-2-2
(icons/City/layers/tiles/, 1008 x 934 px each as stored) side by side: 2016 x 1868 px.
This cuts it back into those four and writes them over the old ones. Pillow only.
"""
import sys
from PIL import Image

W, H = 1008, 934
im = Image.open(sys.argv[1]).convert('RGBA')
if im.size != (2 * W, 2 * H):
    sys.exit(f'expected {2 * W} x {2 * H} px, got {im.size[0]} x {im.size[1]}: keep the lobby picture's size')
for r in (1, 2):
    for c in (1, 2):
        x, y = (c - 1) * W, (r - 1) * H
        im.crop((x, y, x + W, y + H)).save(f'icons/City/layers/tiles/city-{r}-{c}.webp', quality=90, method=6)
        print(f'wrote city-{r}-{c}.webp')
