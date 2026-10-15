// CPU の強さの段階。読む量（局面数）の上限と、やねうら王の SkillLevel（0〜20。低いほど候補の中から悪い手も選ぶ）の組み合わせ
// 段階の差は CPU 同士の自動対戦で測って決めた（scripts/shogi/selfplay.mjs）
// byoyomi は 1 手の考える時間の上限（ms）。局面数の上限が先に効く
export const LEVELS = [
  { id: 1, name: "入門", skill: 0, nodes: 200, byoyomi: 3000 },
  { id: 2, name: "初級", skill: 4, nodes: 2000, byoyomi: 3000 },
  { id: 3, name: "中級", skill: 10, nodes: 20000, byoyomi: 3000 },
  { id: 4, name: "上級", skill: 20, nodes: 200000, byoyomi: 3000 },
  { id: 5, name: "最強", skill: 20, nodes: 0, byoyomi: 2000 },
];
