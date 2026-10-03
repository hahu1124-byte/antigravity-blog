# 真ん中（左右の和＝声と曲）と左右の差（曲だけ）の大きさを 50ms ごとに並べ、声がどこにあるかを見る。
# 使い方：python midside.py <2ch wav（c0＝和・c1＝差）> [開始秒の補正]
import sys
import wave

import numpy as np

path = sys.argv[1]
offset = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
with wave.open(path, "rb") as w:
    sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64)
x = x.reshape(-1, 2) / 32768.0
hop = int(sr * 0.05)
print("秒\t和dB\t差dB\t和-差")
for i in range(0, len(x) - hop, hop):
    m = np.sqrt(np.mean(x[i : i + hop, 0] ** 2))
    s = np.sqrt(np.mean(x[i : i + hop, 1] ** 2))
    md = 20 * np.log10(max(m, 1e-9))
    sd = 20 * np.log10(max(s, 1e-9))
    bar = "#" * max(0, int(md - sd))
    print(f"{offset + i / sr:.2f}\t{md:.0f}\t{sd:.0f}\t{md - sd:.0f}\t{bar}")
