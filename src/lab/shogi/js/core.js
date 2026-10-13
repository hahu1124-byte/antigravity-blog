// 将棋の局面・指し手（詰将棋ソルバー用）
// 盤は 81 マスの Int8Array。添字は SFEN の並び（一段目の 9 筋 → 1 筋、二段目 …）。
// 駒は先手が正・後手が負。成り駒は元の駒 + 8。持ち駒は hand[手番][駒] の枚数。
// 指し手は整数: from（0〜80、打つ手は 81 + 駒）| to << 7 | 成り << 14。

export const FU = 1,
  KY = 2,
  KE = 3,
  GI = 4,
  KI = 5,
  KA = 6,
  HI = 7,
  OU = 8,
  TO = 9,
  NY = 10,
  NK = 11,
  NG = 12,
  UM = 14,
  RY = 15;
export const BLACK = 0,
  WHITE = 1;
export const HAND_TYPES = [HI, KA, KI, GI, KE, KY, FU];
export const PIECE_TOTAL = [0, 18, 4, 4, 4, 4, 2, 2, 2];

const PROMOTABLE = [false, true, true, true, true, false, true, true];

// 先手から見た動き（行は上が -1）
const GOLD = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, 0],
];
const KING8 = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];
const DIAG = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const ORTH = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const STEPS = [];
const SLIDES = [];
for (let p = 0; p < 16; p++) {
  STEPS[p] = [];
  SLIDES[p] = [];
}
STEPS[FU] = [[-1, 0]];
STEPS[KE] = [
  [-2, -1],
  [-2, 1],
];
STEPS[GI] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [1, -1],
  [1, 1],
];
STEPS[KI] = STEPS[TO] = STEPS[NY] = STEPS[NK] = STEPS[NG] = GOLD;
STEPS[OU] = KING8;
STEPS[UM] = ORTH;
STEPS[RY] = DIAG;
SLIDES[KY] = [[-1, 0]];
SLIDES[KA] = SLIDES[UM] = DIAG;
SLIDES[HI] = SLIDES[RY] = ORTH;

// 利きの逆引き用: CAN_STEP[駒][(dr+2)*5+(dc+2)]、CAN_SLIDE[駒][(dr+1)*3+(dc+1)]
const CAN_STEP = [];
const CAN_SLIDE = [];
for (let p = 0; p < 16; p++) {
  CAN_STEP[p] = new Uint8Array(25);
  CAN_SLIDE[p] = new Uint8Array(9);
  for (const [dr, dc] of STEPS[p]) CAN_STEP[p][(dr + 2) * 5 + dc + 2] = 1;
  for (const [dr, dc] of SLIDES[p]) CAN_SLIDE[p][(dr + 1) * 3 + dc + 1] = 1;
}
const STEP_VECS = [...KING8, [-2, -1], [-2, 1], [2, -1], [2, 1]];

// Zobrist ハッシュ（32bit × 2、毎回同じ乱数）
let seed = 0x2545f491;
function rnd() {
  seed ^= seed << 13;
  seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  seed >>>= 0;
  return seed;
}
const ZB1 = new Uint32Array(81 * 32),
  ZB2 = new Uint32Array(81 * 32);
const ZH1 = new Uint32Array(2 * 8 * 20),
  ZH2 = new Uint32Array(2 * 8 * 20);
for (let i = 0; i < ZB1.length; i++) {
  ZB1[i] = rnd();
  ZB2[i] = rnd();
}
for (let i = 0; i < ZH1.length; i++) {
  ZH1[i] = rnd();
  ZH2[i] = rnd();
}
const ZS1 = rnd(),
  ZS2 = rnd();
const zb = (sq, p) => sq * 32 + p + 16;
const zh = (c, pt, n) => (c * 8 + pt) * 20 + n;

export const sqOf = (row, col) => row * 9 + col;
export const fileOf = (sq) => 9 - (sq % 9);
export const rankOf = (sq) => ((sq / 9) | 0) + 1;
const inZone = (c, row) => (c === BLACK ? row <= 2 : row >= 6);
const unpromote = (a) => (a > 8 ? a - 8 : a);

export const moveFrom = (m) => m & 127;
export const moveTo = (m) => (m >> 7) & 127;
export const movePromote = (m) => (m >> 14) & 1;
export const isDrop = (m) => (m & 127) >= 81;
export const dropType = (m) => (m & 127) - 81;
export const makeMove = (from, to, promote) =>
  from | (to << 7) | (promote ? 1 << 14 : 0);

export class Position {
  constructor() {
    this.board = new Int8Array(81);
    this.hand = [new Int8Array(8), new Int8Array(8)];
    this.side = BLACK;
    this.king = [-1, -1];
    this.h1 = 0;
    this.h2 = 0;
    this.caps = [];
  }

  clone() {
    const p = new Position();
    p.board.set(this.board);
    p.hand[0].set(this.hand[0]);
    p.hand[1].set(this.hand[1]);
    p.side = this.side;
    p.king = [...this.king];
    p.h1 = this.h1;
    p.h2 = this.h2;
    return p;
  }

  // 盤や持ち駒を直接書き換えた後に、玉の位置とハッシュを作り直す
  rehash() {
    let h1 = 0,
      h2 = 0;
    this.king = [-1, -1];
    for (let sq = 0; sq < 81; sq++) {
      const p = this.board[sq];
      if (!p) continue;
      h1 ^= ZB1[zb(sq, p)];
      h2 ^= ZB2[zb(sq, p)];
      if (p === OU) this.king[BLACK] = sq;
      if (p === -OU) this.king[WHITE] = sq;
    }
    for (let c = 0; c < 2; c++)
      for (let pt = 1; pt <= 7; pt++) {
        h1 ^= ZH1[zh(c, pt, this.hand[c][pt])];
        h2 ^= ZH2[zh(c, pt, this.hand[c][pt])];
      }
    if (this.side === WHITE) {
      h1 ^= ZS1;
      h2 ^= ZS2;
    }
    this.h1 = h1 >>> 0;
    this.h2 = h2 >>> 0;
  }

  // 置換表のキー（53bit に収まる整数）
  key() {
    return this.h1 * 0x200000 + (this.h2 >>> 11);
  }

  setHand(c, pt, n) {
    const old = this.hand[c][pt];
    this.h1 = (this.h1 ^ ZH1[zh(c, pt, old)] ^ ZH1[zh(c, pt, n)]) >>> 0;
    this.h2 = (this.h2 ^ ZH2[zh(c, pt, old)] ^ ZH2[zh(c, pt, n)]) >>> 0;
    this.hand[c][pt] = n;
  }

  setSquare(sq, p) {
    const old = this.board[sq];
    let h1 = this.h1,
      h2 = this.h2;
    if (old) {
      h1 ^= ZB1[zb(sq, old)];
      h2 ^= ZB2[zb(sq, old)];
    }
    if (p) {
      h1 ^= ZB1[zb(sq, p)];
      h2 ^= ZB2[zb(sq, p)];
    }
    this.h1 = h1 >>> 0;
    this.h2 = h2 >>> 0;
    this.board[sq] = p;
    if (old === OU) this.king[BLACK] = -1;
    if (old === -OU) this.king[WHITE] = -1;
    if (p === OU) this.king[BLACK] = sq;
    if (p === -OU) this.king[WHITE] = sq;
  }

  doMove(m) {
    const c = this.side;
    const from = m & 127,
      to = (m >> 7) & 127;
    const cap = this.board[to];
    if (from >= 81) {
      const pt = from - 81;
      this.setHand(c, pt, this.hand[c][pt] - 1);
      this.setSquare(to, c === BLACK ? pt : -pt);
    } else {
      const p = this.board[from];
      this.setSquare(from, 0);
      if (cap) {
        const base = unpromote(Math.abs(cap));
        this.setHand(c, base, this.hand[c][base] + 1);
      }
      const np = (m >> 14) & 1 ? (p > 0 ? p + 8 : p - 8) : p;
      this.setSquare(to, np);
    }
    this.caps.push(cap);
    this.side ^= 1;
    this.h1 = (this.h1 ^ ZS1) >>> 0;
    this.h2 = (this.h2 ^ ZS2) >>> 0;
  }

  undoMove(m) {
    this.side ^= 1;
    this.h1 = (this.h1 ^ ZS1) >>> 0;
    this.h2 = (this.h2 ^ ZS2) >>> 0;
    const c = this.side;
    const from = m & 127,
      to = (m >> 7) & 127;
    const cap = this.caps.pop();
    if (from >= 81) {
      const pt = from - 81;
      this.setSquare(to, 0);
      this.setHand(c, pt, this.hand[c][pt] + 1);
    } else {
      const np = this.board[to];
      const p = (m >> 14) & 1 ? (np > 0 ? np - 8 : np + 8) : np;
      this.setSquare(to, cap);
      if (cap) {
        const base = unpromote(Math.abs(cap));
        this.setHand(c, base, this.hand[c][base] - 1);
      }
      this.setSquare(from, p);
    }
  }

  // sq に手番 by の駒が利いているか
  isAttacked(sq, by) {
    const b = this.board;
    const r = (sq / 9) | 0,
      col = sq % 9;
    const sgn = by === BLACK ? 1 : -1;
    for (const [dr, dc] of STEP_VECS) {
      const ar = r - sgn * dr,
        ac = col - sgn * dc;
      if (ar < 0 || ar > 8 || ac < 0 || ac > 8) continue;
      const p = b[ar * 9 + ac];
      if (!p || p > 0 !== (by === BLACK)) continue;
      if (CAN_STEP[Math.abs(p)][(dr + 2) * 5 + dc + 2]) return true;
    }
    for (const [dr, dc] of KING8) {
      let ar = r - sgn * dr,
        ac = col - sgn * dc;
      while (ar >= 0 && ar <= 8 && ac >= 0 && ac <= 8) {
        const p = b[ar * 9 + ac];
        if (p) {
          if (
            p > 0 === (by === BLACK) &&
            CAN_SLIDE[Math.abs(p)][(dr + 1) * 3 + dc + 1]
          )
            return true;
          break;
        }
        ar -= sgn * dr;
        ac -= sgn * dc;
      }
    }
    return false;
  }

  // sq に利いている手番 by の駒の升を全部返す（王手している駒を探す用）
  attackersOf(sq, by) {
    const b = this.board;
    const out = [];
    const r = (sq / 9) | 0,
      col = sq % 9;
    const sgn = by === BLACK ? 1 : -1;
    for (const [dr, dc] of STEP_VECS) {
      const ar = r - sgn * dr,
        ac = col - sgn * dc;
      if (ar < 0 || ar > 8 || ac < 0 || ac > 8) continue;
      const p = b[ar * 9 + ac];
      if (!p || p > 0 !== (by === BLACK)) continue;
      if (CAN_STEP[Math.abs(p)][(dr + 2) * 5 + dc + 2]) out.push(ar * 9 + ac);
    }
    for (const [dr, dc] of KING8) {
      let ar = r - sgn * dr,
        ac = col - sgn * dc;
      while (ar >= 0 && ar <= 8 && ac >= 0 && ac <= 8) {
        const p = b[ar * 9 + ac];
        if (p) {
          if (
            p > 0 === (by === BLACK) &&
            CAN_SLIDE[Math.abs(p)][(dr + 1) * 3 + dc + 1] &&
            !out.includes(ar * 9 + ac)
          )
            out.push(ar * 9 + ac);
          break;
        }
        ar -= sgn * dr;
        ac -= sgn * dc;
      }
    }
    return out;
  }

  inCheck(c = this.side) {
    return this.king[c] >= 0 && this.isAttacked(this.king[c], c ^ 1);
  }

  // 置いた駒 p（手番 c）が from から target に利くか（打つ手の王手の判定用）
  pieceAttacks(p, c, from, target) {
    const a = Math.abs(p);
    const sgn = c === BLACK ? 1 : -1;
    const dr = (((target / 9) | 0) - ((from / 9) | 0)) * sgn;
    const dc = ((target % 9) - (from % 9)) * sgn;
    if (dr >= -2 && dr <= 2 && dc >= -2 && dc <= 2) {
      if (CAN_STEP[a][(dr + 2) * 5 + dc + 2]) return true;
    }
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return false;
    const ur = Math.sign(dr),
      uc = Math.sign(dc);
    if (!CAN_SLIDE[a][(ur + 1) * 3 + uc + 1]) return false;
    let r = ((from / 9) | 0) + ur * sgn,
      col = (from % 9) + uc * sgn;
    const tr = (target / 9) | 0,
      tc = target % 9;
    while (r !== tr || col !== tc) {
      if (this.board[r * 9 + col]) return false;
      r += ur * sgn;
      col += uc * sgn;
    }
    return true;
  }

  static fromSfen(sfen) {
    const pos = new Position();
    const parts = sfen.trim().split(/\s+/);
    if (parts[0] === "sfen") parts.shift();
    const rows = parts[0].split("/");
    if (rows.length !== 9) throw new Error("SFEN の段が 9 つありません");
    for (let r = 0; r < 9; r++) {
      let col = 0,
        promoted = false;
      for (const ch of rows[r]) {
        if (ch >= "1" && ch <= "9") {
          col += Number(ch);
          continue;
        }
        if (ch === "+") {
          promoted = true;
          continue;
        }
        const pt = LETTER_TO_TYPE[ch.toUpperCase()];
        if (!pt || col > 8) throw new Error(`SFEN の駒が読めません: ${ch}`);
        const a = promoted ? pt + 8 : pt;
        pos.board[r * 9 + col] = ch === ch.toUpperCase() ? a : -a;
        col++;
        promoted = false;
      }
      if (col !== 9)
        throw new Error(`SFEN の ${r + 1} 段目が 9 マスになりません`);
    }
    pos.side = parts[1] === "w" ? WHITE : BLACK;
    const hand = parts[2] || "-";
    if (hand !== "-") {
      let n = 0;
      for (const ch of hand) {
        if (ch >= "0" && ch <= "9") {
          n = n * 10 + Number(ch);
          continue;
        }
        const pt = LETTER_TO_TYPE[ch.toUpperCase()];
        if (!pt || pt === OU)
          throw new Error(`SFEN の持ち駒が読めません: ${ch}`);
        pos.hand[ch === ch.toUpperCase() ? BLACK : WHITE][pt] += n || 1;
        n = 0;
      }
    }
    pos.rehash();
    return pos;
  }

  toSfen() {
    const rows = [];
    for (let r = 0; r < 9; r++) {
      let s = "",
        empty = 0;
      for (let col = 0; col < 9; col++) {
        const p = this.board[r * 9 + col];
        if (!p) {
          empty++;
          continue;
        }
        if (empty) s += empty;
        empty = 0;
        const a = Math.abs(p);
        const ch = TYPE_TO_LETTER[unpromote(a)];
        s += (a > 8 ? "+" : "") + (p > 0 ? ch : ch.toLowerCase());
      }
      if (empty) s += empty;
      rows.push(s);
    }
    let hand = "";
    for (const c of [BLACK, WHITE])
      for (const pt of HAND_TYPES) {
        const n = this.hand[c][pt];
        if (!n) continue;
        const ch = TYPE_TO_LETTER[pt];
        hand += (n > 1 ? n : "") + (c === BLACK ? ch : ch.toLowerCase());
      }
    return `${rows.join("/")} ${this.side === BLACK ? "b" : "w"} ${hand || "-"} 1`;
  }
}

const LETTER_TO_TYPE = {
  P: FU,
  L: KY,
  N: KE,
  S: GI,
  G: KI,
  B: KA,
  R: HI,
  K: OU,
};
const TYPE_TO_LETTER = ["", "P", "L", "N", "S", "G", "B", "R", "K"];

// 盤上の駒と攻め方の持ち駒を除いた残り全部を、受け方の持ち駒にする（詰将棋の決まり）
export function fillDefenderHand(pos, defender = WHITE) {
  const used = new Int8Array(9);
  for (let sq = 0; sq < 81; sq++)
    if (pos.board[sq]) used[unpromote(Math.abs(pos.board[sq]))]++;
  for (let pt = 1; pt <= 7; pt++) {
    const rest = PIECE_TOTAL[pt] - used[pt] - pos.hand[defender ^ 1][pt];
    pos.setHand(defender, pt, Math.max(0, rest));
  }
}

// 王手されているとき、玉以外の駒が行ってよい升（王手の駒の升と、間の升）。王手でなければ null
function evasionMask(pos) {
  const c = pos.side;
  const k = pos.king[c];
  if (k < 0) return null;
  const checkers = pos.attackersOf(k, c ^ 1);
  if (checkers.length === 0) return null;
  const mask = new Uint8Array(81);
  if (checkers.length >= 2) return mask; // 両王手は玉が動くしかない
  const ch = checkers[0];
  mask[ch] = 1;
  const kr = (k / 9) | 0,
    kc = k % 9,
    cr = (ch / 9) | 0,
    cc = ch % 9;
  const dr = Math.sign(cr - kr),
    dc = Math.sign(cc - kc);
  if (
    cr - kr === 0 ||
    cc - kc === 0 ||
    Math.abs(cr - kr) === Math.abs(cc - kc)
  ) {
    for (
      let r = kr + dr, col = kc + dc;
      r !== cr || col !== cc;
      r += dr, col += dc
    )
      mask[r * 9 + col] = 1;
  }
  return mask;
}

// 手番側の指し手（王手放置などを除く前）を out に積む
// 王手されているときは、玉以外の駒の行き先と駒打ちを「王手の駒の升と間の升」に絞る
function pseudoMoves(pos, out) {
  const c = pos.side;
  const b = pos.board;
  const sgn = c === BLACK ? 1 : -1;
  const lastRow = c === BLACK ? 0 : 8;
  const mask = evasionMask(pos);
  const add = (from, to, a, fromRow, toRow) => {
    if (mask && a !== OU && !mask[to]) return;
    if (PROMOTABLE[a] && (inZone(c, fromRow) || inZone(c, toRow))) {
      out.push(makeMove(from, to, true));
      const must =
        ((a === FU || a === KY) && toRow === lastRow) ||
        (a === KE && (c === BLACK ? toRow <= 1 : toRow >= 7));
      if (!must) out.push(makeMove(from, to, false));
    } else out.push(makeMove(from, to, false));
  };
  for (let sq = 0; sq < 81; sq++) {
    const p = b[sq];
    if (!p || p > 0 !== (c === BLACK)) continue;
    const a = Math.abs(p);
    const r = (sq / 9) | 0,
      col = sq % 9;
    for (const [dr, dc] of STEPS[a]) {
      const tr = r + sgn * dr,
        tc = col + sgn * dc;
      if (tr < 0 || tr > 8 || tc < 0 || tc > 8) continue;
      const t = b[tr * 9 + tc];
      if (t && t > 0 === (c === BLACK)) continue;
      add(sq, tr * 9 + tc, a, r, tr);
    }
    for (const [dr, dc] of SLIDES[a]) {
      let tr = r + sgn * dr,
        tc = col + sgn * dc;
      while (tr >= 0 && tr <= 8 && tc >= 0 && tc <= 8) {
        const t = b[tr * 9 + tc];
        if (t && t > 0 === (c === BLACK)) break;
        add(sq, tr * 9 + tc, a, r, tr);
        if (t) break;
        tr += sgn * dr;
        tc += sgn * dc;
      }
    }
  }
  const hand = pos.hand[c];
  let pawnFiles = 0;
  if (hand[FU])
    for (let sq = 0; sq < 81; sq++)
      if (b[sq] === (c === BLACK ? FU : -FU)) pawnFiles |= 1 << (sq % 9);
  for (const pt of HAND_TYPES) {
    if (!hand[pt]) continue;
    for (let sq = 0; sq < 81; sq++) {
      if (b[sq] || (mask && !mask[sq])) continue;
      const r = (sq / 9) | 0;
      if ((pt === FU || pt === KY) && r === lastRow) continue;
      if (pt === KE && (c === BLACK ? r <= 1 : r >= 7)) continue;
      if (pt === FU && pawnFiles & (1 << (sq % 9))) continue;
      out.push(makeMove(81 + pt, sq, false));
    }
  }
  return out;
}

function isPawnDropMate(pos, m) {
  // 歩を打った後（手番は相手）に、相手が王手を受けていて指す手が無ければ打ち歩詰め
  if (!pos.inCheck()) return false;
  return !hasLegalMove(pos, true);
}

function legalAfter(pos, m, c, skipPawnDrop) {
  pos.doMove(m);
  let ok = !(pos.king[c] >= 0 && pos.isAttacked(pos.king[c], c ^ 1));
  if (ok && !skipPawnDrop && (m & 127) === 81 + FU && isPawnDropMate(pos, m))
    ok = false;
  pos.undoMove(m);
  return ok;
}

export function hasLegalMove(pos, skipPawnDrop = false) {
  const c = pos.side;
  for (const m of pseudoMoves(pos, []))
    if (legalAfter(pos, m, c, skipPawnDrop)) return true;
  return false;
}

export function legalMoves(pos) {
  const c = pos.side;
  return pseudoMoves(pos, []).filter((m) => legalAfter(pos, m, c, false));
}

// 王手になる合法手だけ
export function checkMoves(pos) {
  const c = pos.side;
  const ek = pos.king[c ^ 1];
  if (ek < 0) return [];
  const out = [];
  for (const m of pseudoMoves(pos, [])) {
    const from = m & 127,
      to = (m >> 7) & 127;
    if (from >= 81) {
      const pt = from - 81;
      if (!pos.pieceAttacks(c === BLACK ? pt : -pt, c, to, ek)) continue;
      if (legalAfter(pos, m, c, false)) out.push(m);
      continue;
    }
    pos.doMove(m);
    const ok =
      !(pos.king[c] >= 0 && pos.isAttacked(pos.king[c], c ^ 1)) &&
      pos.isAttacked(ek, c);
    pos.undoMove(m);
    if (ok) out.push(m);
  }
  return out;
}

export function perft(pos, depth) {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) {
    pos.doMove(m);
    n += perft(pos, depth - 1);
    pos.undoMove(m);
  }
  return n;
}

// ---- 表記 ----
const ZEN = "０１２３４５６７８９";
const KAN = "〇一二三四五六七八九";
export const KIF_NAME = [
  "",
  "歩",
  "香",
  "桂",
  "銀",
  "金",
  "角",
  "飛",
  "玉",
  "と",
  "成香",
  "成桂",
  "成銀",
  "",
  "馬",
  "龍",
];
export const BOARD_CHAR = [
  "",
  "歩",
  "香",
  "桂",
  "銀",
  "金",
  "角",
  "飛",
  "玉",
  "と",
  "杏",
  "圭",
  "全",
  "",
  "馬",
  "龍",
];

export const squareName = (sq) => ZEN[fileOf(sq)] + KAN[rankOf(sq)];

export function moveToUsi(m) {
  const from = m & 127,
    to = (m >> 7) & 127;
  const s = (sq) => `${fileOf(sq)}${"abcdefghi"[rankOf(sq) - 1]}`;
  if (from >= 81) return `${TYPE_TO_LETTER[from - 81]}*${s(to)}`;
  return `${s(from)}${s(to)}${(m >> 14) & 1 ? "+" : ""}`;
}

export function moveFromUsi(pos, usi) {
  return legalMoves(pos).find((m) => moveToUsi(m) === usi) ?? null;
}

// 「▲２三銀打」の形。prevTo は直前の手の行き先（「同」に使う）
export function moveToKif(pos, m, prevTo = -1) {
  const c = pos.side;
  const from = m & 127,
    to = (m >> 7) & 127;
  const mark = c === BLACK ? "▲" : "△";
  const dest = to === prevTo ? "同" : squareName(to);
  if (from >= 81) return `${mark}${dest}${KIF_NAME[from - 81]}打`;
  const a = Math.abs(pos.board[from]);
  let suffix = "";
  if ((m >> 14) & 1) suffix = "成";
  else if (
    PROMOTABLE[a] &&
    (inZone(c, (from / 9) | 0) || inZone(c, (to / 9) | 0))
  )
    suffix = "不成";
  // 同じ種類の駒が同じ升へ行けるときは元の升を添える
  const twin = legalMoves(pos).some(
    (o) =>
      (o & 127) < 81 &&
      (o & 127) !== from &&
      ((o >> 7) & 127) === to &&
      Math.abs(pos.board[o & 127]) === a,
  );
  const origin = twin ? `(${fileOf(from)}${rankOf(from)})` : "";
  return `${mark}${dest}${KIF_NAME[a]}${suffix}${origin}`;
}
