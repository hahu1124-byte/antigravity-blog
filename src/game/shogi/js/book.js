// 定跡と戦型の骨格（cpu.js の think が使う。ブラウザの Worker と node の自動対戦の両方から）
//   定跡: book/book.json の手順を初形からたどり、「局面 → 次の手・その手を指す側の戦型・重み」の表にする。
//     手順の形で持つので core.js のハッシュの作り方が変わっても壊れず、手順前後で同じ局面になっても引ける
//   骨格: 定跡を外れた後も、選んだ戦型の駒組み（飛車を振る・美濃に囲う など）を続けるための自分の手の並び。
//     採るかどうかは cpu.js がエンジンの点数で決める（悪くなる手は指さない）
import { Position, moveFromUsi, moveFrom } from "../../../lab/shogi/js/core.js";
import { START } from "./rules.js";

// 骨格を使う手数の上限（これより後はエンジンに任せる）
export const SKELETON_PLIES = 30;
// 骨格の手の先頭の文字 → 駒の種類（core.js の FU=1 … OU=8）
const PIECE = { P: 1, L: 2, N: 3, S: 4, G: 5, B: 6, R: 7, K: 8 };

const keyOf = (pos) => `${pos.key()}:${pos.side}`;

// data は book.json の中身。指せない手があれば投げる（打ち間違いをエンジンへの回り道で隠さないため）
export function buildBook(data) {
  const table = new Map();
  for (const line of data.lines) {
    const pos = Position.fromSfen(START);
    for (const usi of line.moves.trim().split(/\s+/)) {
      const m = moveFromUsi(pos, usi);
      if (m === null)
        throw new Error(`定跡「${line.name}」の ${usi} が指せない`);
      const style = pos.side === 0 ? line.black : line.white;
      const k = keyOf(pos);
      const list = table.get(k) ?? [];
      const same = list.find((e) => e.usi === usi && e.style === style);
      if (same) same.weight += line.weight ?? 1;
      else list.push({ usi, style, weight: line.weight ?? 1 });
      table.set(k, list);
      pos.doMove(m);
    }
  }
  return { table, skeletons: data.skeletons ?? {} };
}

// 「SFEN moves 手 …」を局面に直す。指せない手があれば null
export function parsePosition(position) {
  const [sfen, rest = ""] = position.split(" moves ");
  const pos = Position.fromSfen(sfen);
  const moves = rest.trim() ? rest.trim().split(/\s+/) : [];
  for (const usi of moves) {
    const m = moveFromUsi(pos, usi);
    if (m === null) return null;
    pos.doMove(m);
  }
  return { pos, moves, fromStart: sfen.trim() === START };
}

// 定跡の手（無ければ null）。level.book が true で、手数が level.bookPlies より前のときだけ引く。
// level.style が ibisha / furibisha なら、その戦型で指す手だけから選ぶ（auto は全部）
export function bookMove(book, at, level, rnd = Math.random) {
  if (!book || !at?.fromStart || !level.book) return null;
  if (at.moves.length >= (level.bookPlies ?? 0)) return null;
  const style = level.style ?? "auto";
  const list = (book.table.get(keyOf(at.pos)) ?? []).filter(
    (e) =>
      (style === "auto" || e.style === style) &&
      moveFromUsi(at.pos, e.usi) !== null,
  );
  if (!list.length) return null;
  let r = rnd() * list.reduce((a, e) => a + e.weight, 0);
  for (const e of list) {
    r -= e.weight;
    if (r <= 0) return e.usi;
  }
  return list[0].usi;
}

// 骨格の次の手（無ければ null）: 自分がまだ指していない骨格の手のうち、決めた駒で今指せる最初の手
export function skeletonMove(book, at, level) {
  const list =
    book?.skeletons?.[level.skeleton]?.[at?.pos.side === 0 ? "black" : "white"];
  if (!list || !at.fromStart || !level.book) return null;
  if (at.moves.length >= SKELETON_PLIES) return null;
  const side = at.pos.side;
  const mine = new Set(at.moves.filter((_, i) => i % 2 === side));
  for (const s of list) {
    const usi = s.slice(1);
    if (mine.has(usi)) continue;
    const m = moveFromUsi(at.pos, usi);
    if (m === null) continue;
    if (Math.abs(at.pos.board[moveFrom(m)]) !== PIECE[s[0]]) continue;
    return usi;
  }
  return null;
}
