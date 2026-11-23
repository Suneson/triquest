"""make-gel-sounds.py: the gel stand's sounds (PromptQueue's ElevenLabs tab, gel-sounds.csv) made ready for the web.

    python tools/make-gel-sounds.py [<PromptQueue audio dir>]   (default: ~/Music/PromptQueue)

Every sound came in four takes (<id>.wav, <id>_2.wav ...). PICKS names the take used for each, chosen by measuring
them: one-shots by the shortest, cleanest hit; loops by the steadiest level. Each one-shot is trimmed to its sound
(silence off both ends, a short fade out) and peak-normalised; each loop is cut from its steadiest stretch and
crossfaded end into start so it repeats without a seam, then levelled, with PAD s of its own end before
it and its own start after it (the game loops between PAD and duration - PAD). All go to audio/gels/<name>.mp3 (mono,
44.1 kHz). The music (MUSIC/gels-theme.mp3) is crossfaded into its own start the same way and saved in stereo.
js/app/gel-sounds.js plays them; the volumes per sound are set there.
Needs: pip install miniaudio lameenc
"""
import os, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'audio', 'gels')
SR = 44100

# name: (take, kind, max seconds)  kind: 'hit' = one-shot, 'loop' = seamless loop
PICKS = {
    'powder-trickle': (1, 'loop', 6),
    'powder-shake': (2, 'loop', 4),
    'salt-shake': (3, 'loop', 2.5),
    'glass-pour': (3, 'loop', 6),
    'whisk-stir': (1, 'loop', 6),
    'jug-pour': (2, 'loop', 6),
    'caffeine-drop': (1, 'hit', 0.6),
    'tap-fill': (3, 'hit', 1.0),
    'pick-up': (4, 'hit', 0.45),
    'put-down': (4, 'hit', 0.6),
    'pouch-pick': (1, 'hit', 0.9),
    'seal-press': (1, 'hit', 1.6),
    'scissors-snip': (3, 'hit', 0.5),
    'bin-lid': (2, 'hit', 0.8),
    'bin-dump': (4, 'hit', 1.6),
    'step-good': (3, 'hit', 1.2),
    'step-ok': (2, 'hit', 0.45),
    'refuse': (1, 'hit', 0.6),
    'star': (2, 'hit', 0.9),
    'gel-done': (4, 'hit', 1.6),
    'gel-record': (3, 'hit', 2.3),
    'restock': (3, 'hit', 1.2),
    'ui-tap': (1, 'hit', 0.25),
}


def load_wav(path):
    w = wave.open(path)
    n, ch, sw, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
    a = np.frombuffer(w.readframes(n), {2: np.int16, 4: np.int32}[sw]).astype(np.float32) / (2 ** (8 * sw - 1))
    a = a.reshape(-1, ch).mean(axis=1)
    if sr != SR: a = np.interp(np.arange(0, len(a), sr / SR), np.arange(len(a)), a).astype(np.float32)
    return a


def env_db(a, win=0.02):
    w = int(SR * win); k = len(a) // w
    return 20 * np.log10(np.sqrt((a[:k * w].reshape(k, w) ** 2).mean(axis=1)) + 1e-9), w


def hit(a, max_s):
    db, w = env_db(a, 0.005)
    idx = np.nonzero(db > db.max() - 45)[0]
    start = max(0, idx[0] * w - int(SR * 0.004))
    end = min(len(a), (idx[-1] + 1) * w + int(SR * 0.03), start + int(SR * max_s))
    a = a[start:end].copy()
    fi = int(SR * 0.003); fo = min(len(a) // 3, int(SR * 0.06))
    a[:fi] *= np.linspace(0, 1, fi); a[-fo:] *= np.linspace(1, 0, fo) ** 2
    return a / (np.abs(a).max() + 1e-9) * 0.89            # -1 dBFS


def seamless(a, length, xf=0.35, rms_to=-20.0):
    """The steadiest `length` seconds, its tail crossfaded into its head (equal power), levelled to `rms_to` dB."""
    n = int(SR * length); x = int(SR * xf)
    db, w = env_db(a, 0.1)
    span = (n + x) // w
    best = min(range(0, max(1, len(db) - span)), key=lambda i: np.std(db[i:i + span]) + 0.05 * abs(np.mean(db[i:i + span]) - db.max()))
    seg = a[best * w: best * w + n + x].copy()
    t = np.linspace(0, np.pi / 2, x)
    head = seg[:x] * np.sin(t) + seg[n:n + x] * np.cos(t)   # the tail fades out over the head fading in
    out = np.concatenate([head, seg[x:n]])
    rms = np.sqrt((out ** 2).mean())
    out = out * (10 ** (rms_to / 20) / (rms + 1e-9))
    peak = np.abs(out).max()
    if peak > 0.89: out = out / peak * 0.89
    return padded(out)


PAD = 0.1   # s of the loop's own end before it and its start after it: mp3's encoder delay can't open a gap (js: PAD)


def padded(out):
    p = int(SR * PAD)
    return np.concatenate([out[-p:], out, out[:p]])


def save_mp3(a, path, channels=1, kbps=80):
    import lameenc
    enc = lameenc.Encoder()
    enc.set_bit_rate(kbps); enc.set_in_sample_rate(SR); enc.set_channels(channels); enc.set_quality(2)
    pcm = (np.clip(a, -1, 1) * 32767).astype('<i2').tobytes()
    open(path, 'wb').write(enc.encode(pcm) + enc.flush())
    print(os.path.relpath(path, os.path.join(HERE, '..')), f'{len(a) / SR / channels:.2f}s', f'{os.path.getsize(path) // 1024} KB')


def music(src):
    import miniaudio
    d = miniaudio.decode_file(src, nchannels=2, sample_rate=SR)
    a = np.frombuffer(d.samples, np.int16).astype(np.float32).reshape(-1, 2) / 32768
    mono = a.mean(axis=1)
    db, w = env_db(mono, 0.5)
    body = np.median(db)
    # the end of the piece: cut where it has faded 6 dB under its body, then crossfade 2 s of tail into the start
    end = (np.nonzero(db > body - 6)[0][-1] + 1) * w
    x = int(SR * 2.0)
    a = a[:end]
    t = np.linspace(0, np.pi / 2, x)[:, None]
    head = a[:x] * np.sin(t) + a[-x:] * np.cos(t)
    out = np.concatenate([head, a[x:-x]])
    p = int(SR * PAD)
    out = np.concatenate([out[-p:], out, out[:p]])
    print(f'music: body {body:.1f} dB, cut at {end / SR:.1f}s of {len(mono) / SR:.1f}s')
    save_mp3(out.reshape(-1), os.path.join(OUT, 'gels-theme.mp3'), channels=2, kbps=96)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.expanduser('~'), 'Music', 'PromptQueue')
    os.makedirs(OUT, exist_ok=True)
    for name, (take, kind, secs) in PICKS.items():
        a = load_wav(os.path.join(src, 'SFX', 'gels', f'{name}{"" if take == 1 else f"_{take}"}.wav'))
        a = hit(a, secs) if kind == 'hit' else seamless(a, secs)
        save_mp3(a, os.path.join(OUT, f'{name}.mp3'))
    music(os.path.join(src, 'MUSIC', 'gels-theme.mp3'))


if __name__ == '__main__':
    main()
