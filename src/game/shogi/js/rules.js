// 対局の決まり: 終局の判定（詰み・千日手・連続王手の千日手）と KIF の書き出し
// 指し手の生成・合法手は LAB の core.js を使う（二歩・打ち歩詰め・王手放置・行き所のない駒は core.js が見る）
import {
  legalMoves,
  moveTo,
  moveFrom,
  movePromote,
  isDrop,
  dropType,
  fileOf,
  rankOf,
  KIF_NAME,
  BLACK,
} from "../../../lab/shogi/js/core.js";

export const START =
  "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
const ZEN = "０１２３４５６７８９";
const KAN = "〇一二三四五六七八九";
const PROMOTABLE = [false, true, true, true, true, false, true, true];

// 1 手指した後の記録。history は { key, check, side } の配列（指した手ごと。side は指した側）
// 千日手は最初の局面も 1 回目に数えるので、history の先頭には initialRecord を入れておく
export function record(pos, side) {
  return { key: pos.key(), check: pos.inCheck(), side };
}

export function initialRecord(pos) {
  return { key: pos.key(), check: false, side: null };
}

// 指した直後の局面（手番は相手）の終局判定。終わっていなければ null
// 結果 { kind: "mate" | "sennichite" | "perpetual", winner: BLACK | WHITE | null }
export function judge(pos, history) {
  if (legalMoves(pos).length === 0)
    return { kind: "mate", winner: pos.side ^ 1 };
  const last = history[history.length - 1];
  const same = history.filter((h) => h.key === last.key);
  if (same.length < 4) return null;
  // 同じ局面が 4 回: 最初に出てから今までの間、片方が王手を続けていたら、その側の負け
  const first = history.findIndex((h) => h.key === last.key);
  const span = history.slice(first + 1);
  for (const side of [BLACK, BLACK ^ 1]) {
    const mine = span.filter((h) => h.side === side);
    if (mine.length > 0 && mine.every((h) => h.check))
      return { kind: "perpetual", winner: side ^ 1 };
  }
  return { kind: "sennichite", winner: null };
}

// KIF の 1 手の表記（「７六歩(77)」「同　銀(23)」「５五角打」「２二角成(88)」）
export function kifMove(pos, m, prevTo = -1) {
  const to = moveTo(m);
  const dest = to === prevTo ? "同　" : ZEN[fileOf(to)] + KAN[rankOf(to)];
  if (isDrop(m)) return `${dest}${KIF_NAME[dropType(m)]}打`;
  const from = moveFrom(m);
  const a = Math.abs(pos.board[from]);
  let suffix = "";
  if (movePromote(m)) suffix = "成";
  else if (PROMOTABLE[a] && canPromote(pos, from, to)) suffix = "不成";
  return `${dest}${KIF_NAME[a]}${suffix}(${fileOf(from)}${rankOf(from)})`;
}

function canPromote(pos, from, to) {
  const zone = (sq) => {
    const r = (sq / 9) | 0;
    return pos.side === BLACK ? r <= 2 : r >= 6;
  };
  return zone(from) || zone(to);
}

// KIF 形式の棋譜（平手）。endText は「投了」「詰み」など
export function toKif(start, moves, { black, white, endText }) {
  const pos = start.clone();
  const lines = [
    "# KIF 形式棋譜ファイル",
    "手合割：平手",
    `先手：${black}`,
    `後手：${white}`,
    "手数----指手---------消費時間--",
  ];
  let prevTo = -1;
  moves.forEach((m, i) => {
    lines.push(`${String(i + 1).padStart(4)} ${kifMove(pos, m, prevTo)}`);
    prevTo = moveTo(m);
    pos.doMove(m);
  });
  if (endText) lines.push(`${String(moves.length + 1).padStart(4)} ${endText}`);
  return lines.join("\n") + "\n";
}
