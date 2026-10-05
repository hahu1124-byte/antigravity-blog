"""audio.js の phrase/tone と同じ式で効果音を合成し、参考音と見比べる（使い捨て）

使い方: python synth.py [old|new]
  old = 今の audio.js の式、new = 直した式
出力: <名前>-lever.wav / <名前>-replay.wav / compare-<名前>.png
"""

import sys
import wave

import numpy as np
from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8")
SR = 48000
DIR = "h:/gravity/archive/scratch/meoshi/synth/"
MASTER = 0.35

# ---- 参考音 ----
w = wave.open("h:/gravity/archive/scratch/meoshi/ref-full.wav")
assert w.getframerate() == SR
ch = w.getnchannels()
raw = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)
REF = raw.reshape(-1, ch).mean(axis=1) / 32768


def ref_seg(t0, t1):
    return REF[int(t0 * SR) : int(t1 * SR)]


# ---- WebAudio の矩形波（帯域制限: 奇数倍音 4/(pi k)）----
def square(freq, n, phase0=0.0):
    t = np.arange(n) / SR
    out = np.zeros(n)
    k = 1
    while k * freq < SR / 2:
        out += 4 / (np.pi * k) * np.sin(2 * np.pi * k * freq * t + phase0)
        k += 2
    return out


def gain_env(n_total, t, dur, vol, end, release):
    """setValueAtTime(vol,t) -> exponentialRamp(end, t+dur) -> (release>0 なら) linearRamp(0, t+dur+release)"""
    g = np.zeros(n_total)
    i0 = int(t * SR)
    n = int(dur * SR)
    k = np.arange(n) / n
    g[i0 : i0 + n] = vol * (end / vol) ** k
    if release > 0:
        nr = int(release * SR)
        g[i0 + n : i0 + n + nr] = end * (1 - np.arange(nr) / nr)
        stop = i0 + n + nr
    else:
        # 今の式: ramp 後は end のまま、stop は t+dur+0.02
        nr = int(0.02 * SR)
        g[i0 + n : i0 + n + nr] = end
        stop = i0 + n + nr
    return g, i0, stop


def render(events, total):
    """events: [(freq, at, dur, vol, end, release, type)]"""
    n_total = int(total * SR)
    out = np.zeros(n_total)
    for freq, at, dur, vol, end, release, typ in events:
        g, i0, stop = gain_env(n_total, at, dur, vol, end, release)
        if typ == "square":
            wav = square(freq, stop - i0)
        else:  # 低い「カチ」: 三角波で近似
            ph = (np.arange(stop - i0) / SR * freq) % 1
            wav = 4 * np.abs(ph - 0.5) - 1
        out[i0:stop] += wav * g[i0:stop]
    return out * MASTER


# ---- 今の式（old）----
def phrase_old(notes, vol):
    ev, at = [], 0.0
    for f1, f2, dur in notes:
        ev.append((f1, at, dur, vol, 0.001, 0, "square"))
        ev.append((f2, at, dur, vol * 0.9, 0.001, 0, "square"))
        at += dur
    return ev


LEVER = [[523, 784, 0.1], [659, 988, 0.1], [587, 784, 0.1], [659, 880, 0.7]]
REPLAY = [
    [880, 1175, 0.1],
    [988, 1319, 0.1],
    [1047, 1397, 0.1],
    [1175, 1568, 0.1],
    [988, 1319, 0.4],
]


# ---- 直した式（new）: audio.js の shapeSteps / tone / phrase を 1 行ずつ写したもの ----
class Param:
    """WebAudio の AudioParam の自動変化（setValueAtTime / linearRamp / exponentialRamp）"""

    def __init__(self):
        self.ev = []

    def setValueAtTime(self, v, t):
        self.ev.append(("set", v, t))

    def linearRampToValueAtTime(self, v, t):
        self.ev.append(("lin", v, t))

    def exponentialRampToValueAtTime(self, v, t):
        self.ev.append(("exp", v, t))

    def render(self, n):
        out = np.zeros(n)
        tt = np.arange(n) / SR
        pv, pt = 0.0, 0.0
        for kind, v, t in self.ev:  # 時刻順に積まれている前提（tone はそう積む）
            if kind == "set":
                out[tt >= t] = v
            else:
                m = (tt >= pt) & (tt < t)
                r = (tt[m] - pt) / (t - pt) if t > pt else 1
                out[m] = pv + (v - pv) * r if kind == "lin" else pv * (v / pv) ** r
                out[tt >= t] = v
            pv, pt = v, t
        return out


STEP_GAP = 0.005


def shapeSteps(p, t, dur, vol, steps, fall, attack):
    ln = dur / len(steps)
    for i, s in enumerate(steps):
        t0 = t + i * ln
        v = vol * s
        if attack > 0:
            p.setValueAtTime(v * 0.3, t0)
            p.linearRampToValueAtTime(v, t0 + attack)
        else:
            p.setValueAtTime(v, t0)
        p.exponentialRampToValueAtTime(v * fall, t0 + ln - STEP_GAP)
        p.linearRampToValueAtTime(0 if i == len(steps) - 1 else v * fall * 0.1, t0 + ln)


def osc_wave(freq, n, typ):
    if typ == "square":
        return square(freq, n)
    # WebAudio の triangle（帯域制限: 奇数倍音 8/(pi^2 k^2)、符号交互、sin 基準）
    t = np.arange(n) / SR
    out = np.zeros(n)
    k, sgn = 1, 1
    while k * freq < SR / 2:
        out += sgn * 8 / (np.pi**2 * k**2) * np.sin(2 * np.pi * k * freq * t)
        k += 2
        sgn = -sgn
    return out


class Ctx:
    def __init__(self, total):
        self.n = int(total * SR)
        self.out = np.zeros(self.n)

    def tone(self, freq, dur, type="square", vol=0.5, at=0, steps=None, fall=1, attack=0):
        t = at
        p = Param()
        if steps:
            shapeSteps(p, t, dur, vol, steps, fall, attack)
        else:
            p.setValueAtTime(vol, t)
            p.exponentialRampToValueAtTime(0.001, t + dur)
        g = p.render(self.n)
        i0, i1 = int(t * SR), min(self.n, int((t + dur + 0.02) * SR))
        self.out[i0:i1] += osc_wave(freq, i1 - i0, type) * g[i0:i1]

    def phrase(self, notes, vol, fall=1, last=(1,), lastFall=1, attack=0, click=0):
        at = 0.0
        for i, (f1, f2, dur) in enumerate(notes):
            isLast = i == len(notes) - 1
            steps = list(last) if isLast else [1]
            shape = dict(at=at, steps=steps, fall=lastFall if isLast else fall, attack=attack)
            self.tone(f1, dur, type="square", vol=vol, **shape)
            self.tone(f2, dur, type="square", vol=vol, **shape)
            if click:
                for k, s in enumerate(steps):
                    self.tone(190, 0.02, type="triangle", vol=click * s, at=at + k * dur / len(steps))
            at += dur
        return self.out * MASTER


def lever_new_fn():
    return Ctx(1.2).phrase(
        LEVER,
        0.1,
        fall=0.75,
        last=[1, 0.54, 0.29, 0.16, 0.085, 0.046, 0.025],
        lastFall=0.8,
        click=0.3,
    )


def replay_new():
    return Ctx(1.0).phrase(REPLAY, 0.1, fall=0.45, last=[1, 0.75, 0.28, 0.1], lastFall=0.6, attack=0.012)


def write_wav(path, x):
    y = np.clip(x, -1, 1)
    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((y * 32767).astype(np.int16).tobytes())


# ---- 解析 ----
def rms_db(x, step=0.005):
    n = int(step * SR)
    m = len(x) // n
    seg = x[: m * n].reshape(m, n)
    return 20 * np.log10(np.sqrt((seg**2).mean(axis=1)) + 1e-9)


def onset(x, thr_db=-45):
    e = rms_db(x, 0.002)
    idx = np.argmax(e > thr_db)
    return idx * int(0.002 * SR)


def tone_level(x, t0, t1, f):
    seg = x[int(t0 * SR) : int(t1 * SR)]
    if len(seg) < 64:
        return -99
    win = np.hanning(len(seg))
    spec = np.abs(np.fft.rfft(seg * win, 8192)) / (win.sum() / 2)
    freqs = np.fft.rfftfreq(8192, 1 / SR)
    m = (freqs > f * 0.96) & (freqs < f * 1.04)
    return 20 * np.log10(spec[m].max() + 1e-9)


def peaks(x, t0, t1, n=4):
    seg = x[int(t0 * SR) : int(t1 * SR)]
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), 16384))
    freqs = np.fft.rfftfreq(16384, 1 / SR)
    m = (freqs > 300) & (freqs < 2500)
    spec, freqs = spec[m], freqs[m]
    out = []
    for i in np.argsort(spec)[::-1]:
        if all(abs(freqs[i] - g) > 40 for g, _ in out):
            out.append((freqs[i], spec[i]))
        if len(out) >= n:
            break
    top = out[0][1]
    return " ".join(f"{f:.0f}({20 * np.log10(a / top):.0f})" for f, a in sorted(out))


def report(name, x, notes):
    print(f"-- {name}")
    at = 0.0
    for f1, f2, dur in notes:
        print(f"  {at:.1f}s 強い周波数: {peaks(x, at + 0.01, at + 0.09)}")
        at += dur
    f1 = notes[0][0] * (0.993 if "ref" in name else 1)
    h = [tone_level(x, 0.01, 0.09, f1 * k) for k in range(1, 6)]
    print("  1 音目の倍音 1-5 (dB, 基音比):", " ".join(f"{v - h[0]:+.0f}" for v in h))
    at = 0.0
    for f1, f2, dur in notes:
        a = [tone_level(x, at + 0.003, at + 0.023, f) for f in (f1, f2)]
        b = [tone_level(x, at + dur - 0.023, at + dur - 0.003, f) for f in (f1, f2)]
        print(
            f"  {f1}+{f2} 頭 {a[0]:6.1f}/{a[1]:6.1f}  終わり {b[0]:6.1f}/{b[1]:6.1f}"
            f"  (2音目-1音目 {a[1] - a[0]:+.1f}dB, 減衰 {b[0] - a[0]:+.1f}dB)"
        )
        at += dur
    # 低い帯域（カチ）
    lo = []
    for i in range(int(sum(n[2] for n in notes) / 0.01)):
        seg = x[int(i * 0.01 * SR) : int((i + 1) * 0.01 * SR)]
        spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
        freqs = np.fft.rfftfreq(len(seg), 1 / SR)
        m = (freqs > 120) & (freqs < 300)
        lo.append(20 * np.log10(spec[m].max() / (len(seg) / 4) + 1e-9))
    print("  120-300Hz 10ms毎:", " ".join(f"{v:.0f}" for v in lo))
    # 0.1 秒ごとの段: 1 音目の高さの成分の 頭(10-30ms)/終わり(70-95ms)
    total = sum(n[2] for n in notes)
    fl = []
    at = 0.0
    for f1, f2, dur in notes:
        k = 0.0
        while k < dur - 1e-6:
            fl.append((at + k, f1, f2))
            k += 0.1
        at += dur
    row = []
    for s, f1, f2 in fl:
        a = tone_level(x, s + 0.01, s + 0.03, f1)
        b = tone_level(x, s + 0.07, s + 0.095, f1)
        a2 = tone_level(x, s + 0.01, s + 0.03, f2)
        row.append(f"{s:.1f}:{a:.0f}>{b:.0f}({a2 - a:+.0f})")
    print("  段ごと 1音目 頭>終わり (2音目差):", " ".join(row))
    print("  5ms RMS:", " ".join(f"{v:.0f}" for v in rms_db(x[: int((total + 0.1) * SR)])))


# ---- 画像 ----
W_PX_PER_S = 900
H_SPEC = 160
F_MAX = 6000


def spec_img(x, dur):
    n = 1024
    hop = int(SR / W_PX_PER_S)
    cols = int(dur * W_PX_PER_S)
    xx = np.concatenate([np.zeros(n // 2), x, np.zeros(n)])
    win = np.hanning(n)
    nb = int(F_MAX / (SR / n))
    img = np.zeros((nb, cols))
    for c in range(cols):
        s = xx[c * hop : c * hop + n]
        if len(s) < n:
            break
        img[:, c] = np.abs(np.fft.rfft(s * win))[:nb]
    db = 20 * np.log10(img / (win.sum() / 2) + 1e-9)
    v = np.clip((db + 80) / 70, 0, 1)[::-1]
    rgb = np.stack([v**0.7 * 255, v**1.5 * 230, (1 - v) * v * 4 * 120], axis=-1).astype(np.uint8)
    return Image.fromarray(rgb).resize((cols, H_SPEC))


def panel(title, ref, olds, news, dur):
    """ref/olds/news: 波形（頭を揃えたもの）"""
    cols = int(dur * W_PX_PER_S)
    H_ENV = 220
    rows = [("ref", ref)] + [(k, v) for k, v in (("old", olds), ("new", news)) if v is not None]
    H = 24 + len(rows) * (H_SPEC + 18) + H_ENV + 30
    im = Image.new("RGB", (cols + 60, H), (255, 255, 255))
    d = ImageDraw.Draw(im)
    d.text((5, 5), title, fill=(0, 0, 0))
    y = 24
    for name, x in rows:
        d.text((5, y), name, fill=(0, 0, 0))
        im.paste(spec_img(x, dur), (50, y + 14))
        y += H_SPEC + 18
    # 音量の時間変化（5ms RMS, dB）。-60..-5 dB
    top = y + 10
    d.rectangle((50, top, 50 + cols, top + H_ENV), outline=(0, 0, 0))
    for db in range(-60, 0, 10):
        yy = top + int((-5 - db) / 55 * H_ENV)
        d.line((50, yy, 50 + cols, yy), fill=(220, 220, 220))
        d.text((10, yy - 6), f"{db}", fill=(0, 0, 0))
    for t in np.arange(0, dur, 0.1):
        xx = 50 + int(t * W_PX_PER_S)
        d.line((xx, top, xx, top + H_ENV), fill=(235, 235, 235))
    colors = {"ref": (0, 0, 0), "old": (200, 60, 60), "new": (40, 110, 220)}
    for name, x in rows:
        e = rms_db(x, 0.005)
        pts = []
        for i, v in enumerate(e):
            t = i * 0.005
            if t > dur:
                break
            pts.append((50 + int(t * W_PX_PER_S), top + int((-5 - min(max(v, -60), -5)) / 55 * H_ENV)))
        d.line(pts, fill=colors[name], width=2)
    d.text((55, top + H_ENV + 6), "RMS 5ms dB  black=ref  red=old  blue=new  (synth level shifted so 30-90ms matches ref)", fill=(0, 0, 0))
    return im


def body_db(x):
    """1 音目の 30-90ms の RMS（頭のカチを避ける）"""
    return 20 * np.log10(np.sqrt((x[int(0.03 * SR) : int(0.09 * SR)] ** 2).mean()) + 1e-9)


def align(x, ref_head_db):
    """1 音目の 30-90ms の RMS を ref に合わせる倍率を掛ける"""
    o = onset(x)
    x = x[o:]
    head = body_db(x)
    return x * 10 ** ((ref_head_db - head) / 20), ref_head_db - head


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "old"
    lever_ref = ref_seg(19.90, 21.10)
    lever_ref = lever_ref[onset(lever_ref) :]
    rep_ref = ref_seg(18.33, 19.35)
    rep_ref = rep_ref[onset(rep_ref) :]

    lever_old = render(phrase_old(LEVER, 0.11), 1.2)
    rep_old = render(phrase_old(REPLAY, 0.1), 1.0)
    write_wav(DIR + "old-lever.wav", lever_old)
    write_wav(DIR + "old-replay.wav", rep_old)
    lever_new = rep_new = None
    if mode == "new":
        lever_new = lever_new_fn()
        rep_new = replay_new()
        write_wav(DIR + "new-lever.wav", lever_new)
        write_wav(DIR + "new-replay.wav", rep_new)

    for name, ref, notes, old, new in (
        ("lever", lever_ref, LEVER, lever_old, lever_new),
        ("replay", rep_ref, REPLAY, rep_old, rep_new),
    ):
        report(f"{name} ref", ref, notes)
        report(f"{name} old(絶対)", old, notes)
        if new is not None:
            report(f"{name} new(絶対)", new, notes)
            pk = 20 * np.log10(np.abs(new).max())
            rmsall = 20 * np.log10(np.sqrt((new[: int(sum(n[2] for n in notes) * SR)] ** 2).mean()))
            print(f"  new ピーク {pk:.1f}dBFS 全体RMS {rmsall:.1f}dB")
        pk = 20 * np.log10(np.abs(old).max())
        rmsall = 20 * np.log10(np.sqrt((old[: int(sum(n[2] for n in notes) * SR)] ** 2).mean()))
        print(f"  old ピーク {pk:.1f}dBFS 全体RMS {rmsall:.1f}dB")

    imgs = []
    for name, ref, old, new, dur in (
        ("lever (reel start)", lever_ref, lever_old, lever_new, 1.1),
        ("replay", rep_ref, rep_old, rep_new, 0.9),
    ):
        head = body_db(ref)
        o2, g1 = align(old, head)
        n2 = None
        if new is not None:
            n2, g2 = align(new, head)
            print(f"{name}: new を ref に合わせる差 {g2:+.1f}dB")
        print(f"{name}: old を ref に合わせる差 {g1:+.1f}dB")
        imgs.append(panel(name, ref, o2, n2, dur))
    W = max(i.width for i in imgs)
    out = Image.new("RGB", (W, sum(i.height for i in imgs)), (255, 255, 255))
    y = 0
    for i in imgs:
        out.paste(i, (0, y))
        y += i.height
    out.save(DIR + ("compare.png" if mode == "new" else "compare-old.png"))


main()
