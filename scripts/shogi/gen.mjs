// 詰将棋サンプルの自作: 乱数で駒を置き、素朴な全探索で「手順中の攻め方の手がすべて一つだけ」の問題を探す
// 使い方: node scripts/shogi/gen.mjs <手数> <個数> [秒] [nonari | uchifu | uchifu2]
// 見つけた問題は JSON で 1 行ずつ出る。駒余り（使わない持ち駒）は見ていないので、samples.js に入れる前に持ち駒を減らして試験で確かめる
const base = new URL("../../src/lab/shogi/js/", import.meta.url).href;
const core = await import(base + "core.js");
const { Solver } = await import(base + "solver.js");
const {
  Position,
  legalMoves,
  checkMoves,
  fillDefenderHand,
  moveToKif,
  moveToUsi,
  makeMove,
  hasLegalMove,
} = core;

const want = Number(process.argv[2] || 3);
const count = Number(process.argv[3] || 3);
const seconds = Number(process.argv[4] || 60);
const filter = process.argv[5] || ""; // "nonari" | "uchifu"

// 攻め方の番で、玉の頭に歩を打つと打ち歩詰めになる形か
function uchifuHere(pos) {
  if (!pos.hand[0][1]) return false;
  const k = pos.king[1];
  const sq = k + 9;
  if (sq > 80 || pos.board[sq]) return false;
  for (let r = 0; r < 9; r++)
    if (pos.board[r * 9 + (sq % 9)] === 1) return false;
  const m = makeMove(81 + 1, sq, false);
  pos.doMove(m);
  const mate = pos.inCheck() && !hasLegalMove(pos, true);
  pos.undoMove(m);
  return mate;
}

let s = Date.now() & 0xffffffff;
const rnd = (n) => {
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  return ((s >>> 0) % n) | 0;
};

function orMate(pos, d, memo) {
  if (d <= 0) return false;
  const k = `${pos.key()}:${d}`;
  if (memo.has(k)) return memo.get(k);
  let r = false;
  for (const m of checkMoves(pos)) {
    pos.doMove(m);
    const ok = andMate(pos, d - 1, memo);
    pos.undoMove(m);
    if (ok) {
      r = true;
      break;
    }
  }
  memo.set(k, r);
  return r;
}
function andMate(pos, d, memo) {
  const moves = legalMoves(pos);
  if (moves.length === 0) return true;
  if (d <= 0) return false;
  const k = `${pos.key()}:${d}`;
  if (memo.has(k)) return memo.get(k);
  let r = true;
  for (const m of moves) {
    pos.doMove(m);
    const ok = orMate(pos, d - 1, memo);
    pos.undoMove(m);
    if (!ok) {
      r = false;
      break;
    }
  }
  memo.set(k, r);
  return r;
}

const ATT = [1, 2, 3, 4, 5, 6, 7, 9, 14, 15];
const HANDP = [1, 2, 3, 4, 5, 6, 7];
function randomPos() {
  const pos = new Position();
  const base = filter === "uchifu2";
  const kr = base ? 0 : rnd(2),
    kc = base ? 8 : 5 + rnd(4);
  pos.board[kr * 9 + kc] = -8;
  if (base) {
    // 1 二歩打が打ち歩詰めになる土台: 玉 1 一・桂 2 一・金 2 三
    pos.board[7] = -3;
    pos.board[2 * 9 + 7] = 5;
  }
  const near = () => {
    const r = Math.min(8, Math.max(0, kr + rnd(5) - 1));
    const c = Math.min(8, Math.max(0, kc + rnd(5) - 2));
    return r * 9 + c;
  };
  const nAtt = base ? rnd(3) : 1 + rnd(3),
    nDef = base ? rnd(2) : rnd(3),
    nHand = base ? rnd(2) : 1 + rnd(2);
  for (let i = 0; i < nAtt; i++) {
    const sq = near();
    if (!pos.board[sq]) pos.board[sq] = ATT[rnd(ATT.length)];
  }
  for (let i = 0; i < nDef; i++) {
    const sq = near();
    if (!pos.board[sq]) pos.board[sq] = -[1, 2, 3, 4, 5, 9][rnd(6)];
  }
  for (let i = 0; i < nHand; i++) pos.hand[0][HANDP[rnd(7)]]++;
  if (filter.startsWith("uchifu")) pos.hand[0][1] = 1;
  pos.rehash();
  // 行き所のない駒・二歩をはじく
  for (let sq = 0; sq < 81; sq++) {
    const p = pos.board[sq],
      r = (sq / 9) | 0;
    if (p === 1 || p === 2) if (r === 0) return null;
    if (p === 3 && r <= 1) return null;
    if (p === -1 || p === -2) if (r === 8) return null;
    if (p === -3 && r >= 7) return null;
  }
  for (const c of [1, -1])
    for (let col = 0; col < 9; col++) {
      let n = 0;
      for (let r = 0; r < 9; r++) if (pos.board[r * 9 + col] === c) n++;
      if (n > 1) return null;
    }
  fillDefenderHand(pos);
  if (pos.inCheck(1)) return null;
  return pos;
}

const found = [];
const t0 = Date.now();
while (found.length < count && Date.now() - t0 < seconds * 1000) {
  const pos = randomPos();
  if (!pos) continue;
  const memo = new Map();
  if (orMate(pos, want - 2, memo)) continue;
  if (!orMate(pos, want, memo)) continue;
  // 手順を df-pn で取り出し、各攻め方の手で「want の残り手数で詰む王手」が一つだけか
  const sol = new Solver({ timeLimitMs: 5000 }).solve(pos);
  if (sol.status !== "mate" || sol.len !== want || sol.futile || sol.approx)
    continue;
  let unique = true,
    uchifu = false;
  const kif = [];
  let prev = -1;
  for (let i = 0; i < sol.moves.length; i++) {
    const m = sol.moves[i];
    if (i % 2 === 0) {
      if (uchifuHere(pos)) uchifu = true;
      let n = 0;
      for (const c of checkMoves(pos)) {
        pos.doMove(c);
        if (andMate(pos, want - i - 1, new Map())) n++;
        pos.undoMove(c);
      }
      if (n !== 1) unique = false;
    }
    kif.push(moveToKif(pos, m, prev));
    prev = (m >> 7) & 127;
    pos.doMove(m);
  }
  for (let i = sol.moves.length - 1; i >= 0; i--) pos.undoMove(sol.moves[i]);
  if (!unique) continue;
  // 駒が余らない（最後に攻め方の持ち駒が 0）ものだけ
  const tags = [];
  if (kif.some((k) => k.includes("不成"))) tags.push("不成");
  if (uchifu) tags.push("打ち歩詰め回避");
  if (filter === "nonari" && !tags.includes("不成")) continue;
  if (filter.startsWith("uchifu") && !uchifu) continue;
  found.push({
    sfen: pos.toSfen(),
    kif: kif.join(" "),
    usi: sol.moves.map(moveToUsi).join(" "),
    tags,
  });
  console.log(JSON.stringify(found.at(-1)));
}
console.log(`${found.length} 問（${Math.round((Date.now() - t0) / 1000)} 秒）`);
