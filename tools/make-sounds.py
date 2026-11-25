"""make-sounds.py: the chest, base and coffee sounds (PromptQueue's ElevenLabs tab: chest-base-sounds.csv and
coffee-sounds.csv) made ready for the web, the same way tools/make-gel-sounds.py does the gel stand's.

    python tools/make-sounds.py [<PromptQueue audio dir>]   (default: ~/Music/PromptQueue)

Every sound came in four takes (<id>.wav, <id>_2.wav ...). The take is picked by measuring them (PICKS can pin
one): a hit by a sharp early attack and a length near its target; a loop by its steadiest stretch; the riser by
how steadily it climbs to its end. Then trimmed, faded, peak-normalised (hits) or cut into a seamless loop
(loops), and saved as audio/<dir>/<name>.mp3 (mono, 44.1 kHz). The coffee song goes to audio/coffee/coffee-theme.mp3.
Needs: pip install miniaudio lameenc
"""
import os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from importlib import import_module
gs = import_module('make-gel-sounds')   # load_wav, env_db, hit, seamless, save_mp3, SR, PAD

ROOT = os.path.join(HERE, '..', 'audio')
SR = gs.SR

# name: (folder, kind, max seconds, target seconds)   kind: hit | loop | riser
SOUNDS = {
    # the chest screen (js/app/chest-view.js)
    'chest-land': ('chests', 'hit', 0.9, 0.6), 'chest-wiggle': ('chests', 'hit', 0.8, 0.6),
    'chest-spin': ('chests', 'hit', 0.9, 0.7), 'chest-spinup': ('chests', 'riser', 3.2, 3.0),
    'chest-burst': ('chests', 'hit', 1.8, 1.3), 'chest-burst-big': ('chests', 'hit', 2.6, 2.0),
    'reward-coins': ('chests', 'hit', 1.4, 1.1), 'reward-carbs': ('chests', 'hit', 1.2, 0.9),
    'reward-bottles': ('chests', 'hit', 1.2, 0.9), 'reward-collect': ('chests', 'hit', 0.9, 0.6),
    # moving things round the base (js/app/diorama-view.js)
    'item-lift': ('base', 'hit', 0.6, 0.4), 'item-drop': ('base', 'hit', 0.8, 0.5),
    'item-drop-small': ('base', 'hit', 0.6, 0.4), 'item-turn': ('base', 'hit', 0.6, 0.4),
    'item-refuse': ('base', 'hit', 0.6, 0.4),
    # the coffee shop (js/app/coffee-view.js)
    'grinder-whirr': ('coffee', 'loop', 3, 3), 'grinder-start': ('coffee', 'hit', 1.0, 0.7),
    'pf-knock': ('coffee', 'hit', 0.6, 0.35), 'tamp-press': ('coffee', 'hit', 0.9, 0.6),
    'pf-lock': ('coffee', 'hit', 0.9, 0.6), 'brew-button': ('coffee', 'hit', 1.0, 0.6),
    'espresso-pour': ('coffee', 'loop', 4, 4), 'brew-stop': ('coffee', 'hit', 1.4, 1.0),
    'hot-water': ('coffee', 'loop', 4, 4), 'fridge-open': ('coffee', 'hit', 1.2, 0.8),
    'fridge-close': ('coffee', 'hit', 0.8, 0.5), 'milk-pour': ('coffee', 'loop', 4, 4),
    'steam-wand': ('coffee', 'loop', 4, 4), 'latte-pour': ('coffee', 'loop', 4, 4),
    'cup-down': ('coffee', 'hit', 0.5, 0.3), 'ice-drop': ('coffee', 'hit', 0.9, 0.6),
    'syrup-pump': ('coffee', 'hit', 0.6, 0.4), 'cream-whip': ('coffee', 'hit', 0.9, 0.6),
    'cocoa-dust': ('coffee', 'hit', 0.9, 0.6), 'serve-hatch': ('coffee', 'hit', 1.4, 1.0),
    'cafe-bell': ('coffee', 'hit', 1.4, 1.0),
}
PICKS = {}   # name: take, to pin a take after listening


def takes(src, folder, name):
    out = []
    for k in range(1, 5):
        p = os.path.join(src, 'SFX', folder, f'{name}{"" if k == 1 else f"_{k}"}.wav')
        if os.path.exists(p): out.append((k, gs.load_wav(p)))
    return out


def score(kind, a, target):
    db, w = gs.env_db(a, 0.02)
    if kind == 'loop':
        return -float(np.std(db[db > db.max() - 30]))   # steadiest
    if kind == 'riser':
        seg = riser_cut(a, target)
        d2, _ = gs.env_db(seg, 0.1)
        return float(np.corrcoef(np.arange(len(d2)), d2)[0, 1])   # climbs steadily to its peak
    cut = gs.hit(a, target * 1.6)
    l = len(cut) / SR
    dbc, wc = gs.env_db(cut, 0.005)
    attack = np.argmax(dbc) / max(1, len(dbc))   # where its loudest moment is: early is punchy
    return -abs(l - target) - 0.8 * attack


def riser_cut(a, secs):
    """The `secs` seconds leading up to the take's loudest moment (the takes swell, then die away after it)."""
    db, w = gs.env_db(a, 0.1)
    end = (int(np.argmax(db)) + 1) * w
    return a[max(0, end - int(SR * secs)):end].copy()


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.expanduser('~'), 'Music', 'PromptQueue')
    picked = {}
    for name, (folder, kind, max_s, target) in SOUNDS.items():
        tk = takes(src, folder, name)
        if not tk: print('missing', name); continue
        k, a = next(((k, a) for k, a in tk if k == PICKS[name]), None) if name in PICKS else max(tk, key=lambda x: score(kind, x[1], target))
        picked[name] = k
        if kind == 'loop': out = gs.seamless(a, max_s)
        elif kind == 'riser':
            out = riser_cut(a, max_s)
            fi = int(SR * 0.25); out[:fi] *= np.linspace(0, 1, fi) ** 2
            fo = int(SR * 0.01); out[-fo:] *= np.linspace(1, 0, fo)
            out = out / (np.abs(out).max() + 1e-9) * 0.89
        else: out = gs.hit(a, max_s)
        d = os.path.join(ROOT, folder); os.makedirs(d, exist_ok=True)
        gs.save_mp3(out, os.path.join(d, f'{name}.mp3'))
    print('takes:', picked)
    # the coffee song: the first take, cut and crossfaded into its start like the gel stand's
    song = os.path.join(src, 'MUSIC', 'coffee-theme.mp3')
    if os.path.exists(song):
        gs.OUT = os.path.join(ROOT, 'coffee')
        music_to(song, os.path.join(ROOT, 'coffee', 'coffee-theme.mp3'))


def music_to(src, dst):
    import miniaudio
    d = miniaudio.decode_file(src, nchannels=2, sample_rate=SR)
    a = np.frombuffer(d.samples, np.int16).astype(np.float32).reshape(-1, 2) / 32768
    db, w = gs.env_db(a.mean(axis=1), 0.5)
    body = np.median(db)
    end = (np.nonzero(db > body - 6)[0][-1] + 1) * w
    x = int(SR * 2.0)
    a = a[:end]
    t = np.linspace(0, np.pi / 2, x)[:, None]
    head = a[:x] * np.sin(t) + a[-x:] * np.cos(t)
    out = np.concatenate([head, a[x:-x]])
    p = int(SR * gs.PAD)
    out = np.concatenate([out[-p:], out, out[:p]])
    gs.save_mp3(out.reshape(-1), dst, channels=2, kbps=96)


if __name__ == '__main__':
    main()
