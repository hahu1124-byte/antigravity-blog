// ソルバーの速さの目安: 乱数の局面を解かせ、長めの詰み（9 手以上）の時間を集める
// 使い方: node scripts/shogi/bench.mjs [秒]（乱数の種は固定なので、直す前後で同じ局面を比べられる）
const base = new URL("../../src/lab/shogi/js/", import.meta.url).href;
const { Position, fillDefenderHand } = await import(base + "core.js");
const { Solver } = await import(base + "solver.js");
const seconds = Number(process.argv[2] || 120);

let s = 12345;
const rnd = (n) => {
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  return ((s >>> 0) % n) | 0;
};
function randomPos() {
  const pos = new Position();
  const kr = rnd(3),
    kc = 3 + rnd(6);
  pos.board[kr * 9 + kc] = -8;
  const near = () => {
    const r = Math.min(8, Math.max(0, kr + rnd(6) - 1));
    const c = Math.min(8, Math.max(0, kc + rnd(7) - 3));
    return r * 9 + c;
  };
  for (let i = 0, n = 2 + rnd(4); i < n; i++) {
    const sq = near();
    if (!pos.board[sq])
      pos.board[sq] = [1, 2, 3, 4, 5, 6, 7, 9, 14, 15][rnd(10)];
  }
  for (let i = 0, n = 1 + rnd(4); i < n; i++) {
    const sq = near();
    if (!pos.board[sq]) pos.board[sq] = -[1, 2, 3, 4, 5, 6, 7, 9][rnd(8)];
  }
  for (let i = 0, n = 1 + rnd(3); i < n; i++) pos.hand[0][1 + rnd(7)]++;
  for (let sq = 0; sq < 81; sq++) {
    const p = pos.board[sq],
      r = (sq / 9) | 0;
    if ((p === 1 || p === 2) && r === 0) return null;
    if (p === 3 && r <= 1) return null;
    if ((p === -1 || p === -2) && r === 8) return null;
    if (p === -3 && r >= 7) return null;
  }
  for (const c of [1, -1])
    for (let col = 0; col < 9; col++) {
      let n = 0;
      for (let r = 0; r < 9; r++) if (pos.board[r * 9 + col] === c) n++;
      if (n > 1) return null;
    }
  pos.rehash();
  fillDefenderHand(pos);
  if (pos.inCheck(1)) return null;
  return pos;
}

const t0 = Date.now();
const stat = { mate: 0, nomate: 0, timeout: 0 };
const long = [];
let maxNomate = 0;
while (Date.now() - t0 < seconds * 1000) {
  const pos = randomPos();
  if (!pos) continue;
  const r = new Solver({ timeLimitMs: 10000 }).solve(pos);
  stat[r.status]++;
  if (r.status === "nomate") maxNomate = Math.max(maxNomate, r.ms);
  if (r.status === "timeout") console.log("timeout", pos.toSfen());
  if (r.status === "mate" && r.len >= 9) {
    long.push(r);
    console.log(
      `${r.len}手 ${r.ms}ms ${r.nodes}局面${r.approx ? " approx" : ""}${r.futile ? " futile" : ""} ${pos.toSfen()}`,
    );
  }
}
console.log(
  JSON.stringify(stat),
  `不詰の最長 ${maxNomate}ms`,
  `${Math.round((Date.now() - t0) / 1000)}秒`,
);
