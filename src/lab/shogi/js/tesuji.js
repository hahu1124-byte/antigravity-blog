// 手筋のラベル: 本筋の手順に、盤面から機械的に判定できるものだけを付ける
// 攻め方: 捨て駒／成り捨て・不成・開き王手／両王手・頭金・打ち歩詰め回避
// 受け方: 合駒／中合（遠くからの王手の間に入る手）
import {
  legalMoves,
  isDrop,
  dropType,
  moveTo,
  moveFrom,
  movePromote,
  makeMove,
  FU,
  KI,
  OU,
  BLACK,
} from "./core.js";

// 手順 moves の各手のラベル（文字列の配列）を返す
export function lineLabels(start, moves) {
  const pos = start.clone();
  const out = [];
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    out.push(
      i % 2 === 0
        ? attackLabels(pos, m, moves[i + 1], i === moves.length - 1)
        : defendLabels(pos, m),
    );
    pos.doMove(m);
  }
  return out;
}

// 玉の正面（攻め方から見て手前）の升。盤の外なら -1
function headOf(pos, attacker) {
  const k = pos.king[attacker ^ 1];
  if (k < 0) return -1;
  const h = k + (attacker === BLACK ? 9 : -9);
  return h >= 0 && h < 81 ? h : -1;
}

function attackLabels(pos, m, next, last) {
  const labels = [];
  const attacker = pos.side;
  const to = moveTo(m);
  if (pawnDropMateForbidden(pos)) labels.push("打ち歩詰め回避");
  if (last && isDrop(m) && dropType(m) === KI && to === headOf(pos, attacker))
    labels.push("頭金");
  if (
    !isDrop(m) &&
    !movePromote(m) &&
    legalMoves(pos).includes(makeMove(moveFrom(m), to, true))
  )
    labels.push("不成");
  pos.doMove(m);
  const checkers = pos.attackersOf(pos.king[attacker ^ 1], attacker);
  pos.undoMove(m);
  if (checkers.length >= 2) labels.push("両王手");
  else if (checkers.length === 1 && checkers[0] !== to) labels.push("開き王手");
  // 次の受け方の手がこの駒を取る
  if (next !== undefined && moveTo(next) === to)
    labels.push(movePromote(m) ? "成り捨て" : "捨て駒");
  return labels;
}

// 攻め方に歩があり、玉の正面への歩打ちが王手になるのに、打ち歩詰めで指せない
function pawnDropMateForbidden(pos) {
  const attacker = pos.side;
  if (!pos.hand[attacker][FU]) return false;
  const h = headOf(pos, attacker);
  if (h < 0 || pos.board[h]) return false;
  const pawn = attacker === BLACK ? FU : -FU;
  for (let r = 0; r < 9; r++)
    if (pos.board[r * 9 + (h % 9)] === pawn) return false;
  return !legalMoves(pos).includes(makeMove(81 + FU, h, false));
}

function defendLabels(pos, m) {
  const def = pos.side;
  const k = pos.king[def];
  if (k < 0 || (!isDrop(m) && Math.abs(pos.board[moveFrom(m)]) === OU))
    return [];
  const to = moveTo(m);
  for (const ch of pos.attackersOf(k, def ^ 1)) {
    if (between(k, ch, to)) return [chebyshev(k, to) === 1 ? "合駒" : "中合"];
  }
  return [];
}

// sq が a と b を結ぶ直線（縦・横・斜め）の間（両端を除く）にあるか
function between(a, b, sq) {
  const ar = (a / 9) | 0,
    ac = a % 9,
    br = (b / 9) | 0,
    bc = b % 9;
  const dr = Math.sign(br - ar),
    dc = Math.sign(bc - ac);
  if (br !== ar && bc !== ac && Math.abs(br - ar) !== Math.abs(bc - ac))
    return false;
  for (let r = ar + dr, c = ac + dc; r !== br || c !== bc; r += dr, c += dc)
    if (r * 9 + c === sq) return true;
  return false;
}

function chebyshev(a, b) {
  return Math.max(
    Math.abs(((a / 9) | 0) - ((b / 9) | 0)),
    Math.abs((a % 9) - (b % 9)),
  );
}
