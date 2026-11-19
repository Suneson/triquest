"""preview-plot.py: the single-plot base as cut-plot.py laid it out: the map, the 48 x 48 grid, the platform with
its raised 32 x 32 floor grid, the blocked tiles, the pads and huts. For checking alignment by eye.

    python tools/preview-plot.py <out.jpg> [scale] [crop: x0,y0,x1,y1 in world px]
"""
import json, os, re, sys
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS = None
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(REPO, 'js', 'core', 'plot-art.js'), encoding='utf-8').read()
A = json.loads(src[src.index('{'):src.rindex('}') + 1])
out = sys.argv[1]; K = float(sys.argv[2]) if len(sys.argv) > 2 else 0.2
crop = [float(x) for x in sys.argv[3].split(',')] if len(sys.argv) > 3 else None
W, H = A['world']['w'], A['world']['h']
img = Image.new('RGB', (round(W * K), round(H * K)))
def put(p):
    im = Image.open(os.path.join(REPO, p['src'])).convert('RGBA').resize((max(1, round(p['w'] * K)), max(1, round(p['h'] * K))), Image.LANCZOS)
    img.paste(im, (round(p['x'] * K), round(p['y'] * K)), im)
for t in A['tiles']:
    im = Image.open(os.path.join(REPO, t['src'])).convert('RGB').resize((round(t['w'] * K) + 1, round(t['h'] * K) + 1), Image.LANCZOS)
    img.paste(im, (round(t['x'] * K), round(t['y'] * K)))
put(A['platform'])
for p in A['pads']: put(p['pad'])
for p in A['pads']: put(p['hut'])
d = ImageDraw.Draw(img, 'RGBA')
L = A['lawn']; N = A['grid']; pl = A['platform']
def w(u, v, up=0):
    x = L['back'][0] + (L['right'][0] - L['back'][0]) * u / N + (L['left'][0] - L['back'][0]) * v / N
    y = L['back'][1] + (L['right'][1] - L['back'][1]) * u / N + (L['left'][1] - L['back'][1]) * v / N - up
    return (x * K, y * K)
for i in range(N + 1):
    d.line([w(i, 0), w(i, N)], fill=(255, 255, 255, 70)); d.line([w(0, i), w(N, i)], fill=(255, 255, 255, 70))
a, s, up = pl['at'], pl['size'], pl['lift']
for i in range(s + 1):
    d.line([w(a + i, a, up), w(a + i, a + s, up)], fill=(255, 60, 60, 110)); d.line([w(a, a + i, up), w(a + s, a + i, up)], fill=(255, 60, 60, 110))
for u0, v0, u1, v1 in A['blocked']:
    d.polygon([w(u0, v0), w(u1, v0), w(u1, v1), w(u0, v1)], outline=(255, 200, 0, 200))
for u0, v0, u1, v1 in A.get('walk', []):
    d.polygon([w(u0, v0), w(u1, v0), w(u1, v1), w(u0, v1)], outline=(0, 230, 255, 255))
if crop: img = img.crop([round(c * K) for c in crop])
img.convert('RGB').save(out, quality=88)
print(img.size)
