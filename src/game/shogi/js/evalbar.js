// 評価値の表示: 先手から見た評価値への直し方・文言・棒の割合・推移のグラフ
// 評価値は cpu.js の think が返す score（手番側から見た値。詰みは ±30000 から手数を引いた値）
import { BLACK } from "../../../lab/shogi/js/core.js";

export const MATE = 30000;
const CLAMP = 2000; // グラフの上下の端

// 手番側から見た評価値 → 先手から見た評価値
export const toBlack = (score, sideToMove) =>
  sideToMove === BLACK ? score : -score;

const isMate = (s) => Math.abs(s) >= MATE - 1000;

// 「+350 先手有利」「互角」「先手の勝ち（詰み 5 手）」
export function evalText(s) {
  if (s === null || s === undefined) return "評価中…";
  const side = s > 0 ? "先手" : "後手";
  if (isMate(s)) return `${side}の勝ち（詰み ${MATE - Math.abs(s)} 手）`;
  const a = Math.abs(s);
  const sign = s > 0 ? "+" : s < 0 ? "−" : "±";
  const word =
    a < 200
      ? "互角"
      : a < 800
        ? `${side}有利`
        : a < 2000
          ? `${side}優勢`
          : `${side}勝勢`;
  return `${sign}${a}　${word}`;
}

// 棒の先手側の割合（0〜1）。互角で半分、±600 でおよそ 3/4
export function barRatio(s) {
  if (s === null || s === undefined) return 0.5;
  if (isMate(s)) return s > 0 ? 1 : 0;
  return 1 / (1 + Math.exp(-s / 600));
}

// 手数ごとの評価値（先手から見た値。まだ無い手は null）の推移を SVG の折れ線に
export function graphSvg(scores, width = 300, height = 90) {
  const n = Math.max(scores.length - 1, 10);
  const y = (s) =>
    height / 2 -
    (Math.max(-CLAMP, Math.min(CLAMP, s)) / CLAMP) * (height / 2 - 2);
  const pts = scores
    .map((s, i) =>
      s === null || s === undefined
        ? null
        : `${((i / n) * width).toFixed(1)},${y(s).toFixed(1)}`,
    )
    .filter(Boolean)
    .join(" ");
  return (
    `<svg viewBox="0 0 ${width} ${height}" class="gs-graph" role="img" aria-label="評価値の推移">` +
    `<line x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}" class="gs-graph-axis"/>` +
    (pts ? `<polyline points="${pts}" class="gs-graph-line"/>` : "") +
    `</svg>`
  );
}
