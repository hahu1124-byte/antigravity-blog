# セリフの音の高さ（基本周波数）と大きさを 10ms ごとに測る（YIN 法の簡易版）。
# 使い方：python pitch.py <16kHz モノラル wav> [開始秒の補正]
import sys
import wave

import numpy as np

path = sys.argv[1]
offset = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
# 有声とみなす確からしさのしきい値（小さいほど厳しい。曲が少ない音声なら 0.45 くらいまで緩めてよい）
thr = float(sys.argv[3]) if len(sys.argv) > 3 else 0.25
with wave.open(path, "rb") as w:
    sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64)
x /= 32768.0

hop = int(sr * 0.01)
win = int(sr * 0.04)
fmin, fmax = 150.0, 700.0
tmin, tmax = int(sr / fmax), int(sr / fmin)


def yin(frame):
    n = len(frame) - tmax
    d = np.zeros(tmax + 1)
    for tau in range(1, tmax + 1):
        diff = frame[:n] - frame[tau : tau + n]
        d[tau] = np.dot(diff, diff)
    cmnd = np.ones(tmax + 1)
    run = np.cumsum(d[1:])
    cmnd[1:] = d[1:] * np.arange(1, tmax + 1) / np.maximum(run, 1e-12)
    for tau in range(tmin, tmax):
        if cmnd[tau] < 0.18:
            while tau + 1 < tmax and cmnd[tau + 1] < cmnd[tau]:
                tau += 1
            return sr / tau, cmnd[tau]
    tau = int(np.argmin(cmnd[tmin:tmax])) + tmin
    return sr / tau, cmnd[tau]


print("秒\tHz\t確からしさ\t大きさdB")
for i in range(0, len(x) - win - tmax, hop):
    frame = x[i : i + win + tmax]
    rms = np.sqrt(np.mean(frame[:win] ** 2))
    db = 20 * np.log10(max(rms, 1e-9))
    f0, ap = yin(frame)
    t = offset + i / sr
    voiced = ap < thr
    print(f"{t:.2f}\t{f0 if voiced else 0:.0f}\t{1 - ap:.2f}\t{db:.0f}")
