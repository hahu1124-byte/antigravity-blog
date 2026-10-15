// CPU の強さの段階（cpu.js の think が使う）
//   nodes: 1 手に読む局面数の上限（0 は上限なし＝byoyomi まで読む）
//   multiPv: 候補手をいくつ出させるか
//   margin: 最善との点差（評価値）がこの幅に入る候補から選ぶ（0 は常に最善）
//   byoyomi: 1 手の考える時間の上限（ms）
// 段階の差は CPU 同士の自動対戦で測って決めた（scripts/shogi/selfplay.mjs・2026-10-15）。
// 読む量 3000 で幅だけを 400→200→100→50 と半分にすると、弱い側の勝率は 30・30・20%。
// 上の 2 段は読む量で差をつける
export const LEVELS = [
  { id: 1, name: "入門", nodes: 3000, multiPv: 8, margin: 600, byoyomi: 3000 },
  { id: 2, name: "初級", nodes: 3000, multiPv: 6, margin: 300, byoyomi: 3000 },
  { id: 3, name: "中級", nodes: 3000, multiPv: 6, margin: 150, byoyomi: 3000 },
  { id: 4, name: "上級", nodes: 8000, multiPv: 4, margin: 40, byoyomi: 3000 },
  { id: 5, name: "最強", nodes: 0, multiPv: 1, margin: 0, byoyomi: 2000 },
];
