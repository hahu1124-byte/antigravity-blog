# EVA15風シミュの調整用スクリプト

本番では使わない、調整・調査のための道具。

| ファイル | 何をするか |
| --- | --- |
| `hitshare.cjs` | 当りのうち各演出（と各層）が何%に出ているかを乱数で数える（頻度の調整＝段2で使う） |
| `freq.cjs` | 演出ごとの 1 回転あたりの出現頻度の一覧を Markdown に書き出す |
| `speakers.mjs` | VOICEVOX の全スタイルで同じセリフを読ませ、声の高さを比べる（VOICEVOX ENGINE を起動して） |
| `pitch.py` | 16kHz モノラル wav のセリフの高さを 10ms ごとに測る（YIN 法の簡易版） |
| `midside.py` | 和（L+R）と差（L−R）の大きさを 50ms ごとに並べ、曲の上のセリフの位置を探す |

ボイスの 1 音ずつの高さ・長さの指定（prosody）は `src/simulator/js/eva-voice.js`、作り直しは `scripts/gen-eva-voices.mjs --only <id>`。
