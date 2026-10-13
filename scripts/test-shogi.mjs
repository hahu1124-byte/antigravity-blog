// 詰将棋ソルバー（LAB /lab/shogi/）の試験。指し手生成の数・規則・サンプル問題の解を確かめる
// 使い方: node scripts/test-shogi.mjs（NG が 1 件でもあれば終了コード 1）
const base = new URL("../src/lab/shogi/js/", import.meta.url).href;
const core = await import(base + "core.js");
const { Position, perft, legalMoves, checkMoves, moveToUsi, fillDefenderHand } =
  core;

const t0 = performance.now();
let fail = 0;
const ng = (msg) => {
  fail++;
  console.log("NG", msg);
};
const eq = (name, got, want) => {
  if (got !== want) ng(`${name}: ${got}（期待 ${want}）`);
  else console.log("OK", name, got);
};
const usis = (pos, moves) => moves.map(moveToUsi).sort().join(" ");

// 1. 指し手の数（初期局面）
const START = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
{
  const pos = Position.fromSfen(START);
  eq("SFEN の往復", pos.toSfen(), START);
  const k0 = pos.key();
  eq("perft 1", perft(pos, 1), 30);
  eq("perft 2", perft(pos, 2), 900);
  eq("perft 3", perft(pos, 3), 25470);
  eq("perft 4", perft(pos, 4), 719731);
  eq("指した後にハッシュが戻る", pos.key(), k0);
}

// 2. 規則
{
  // 二歩: 5 筋に先手の歩があると 5 筋に歩を打てない
  const pos = Position.fromSfen("4k4/9/9/9/4P4/9/9/9/4K4 b P 1");
  const drops = legalMoves(pos).filter((m) => moveToUsi(m).startsWith("P*5"));
  eq("二歩は打てない", drops.length, 0);
}
{
  // 行き所のない駒: 一段目に歩・香、一・二段目に桂は打てない
  const pos = Position.fromSfen("8k/9/9/9/9/9/9/9/K8 b PLN 1");
  const bad = legalMoves(pos)
    .map(moveToUsi)
    .filter((u) => /^[PL]\*\da$/.test(u) || /^N\*\d[ab]$/.test(u));
  eq("行き所のない駒は打てない", bad.length, 0);
}
{
  // 王手放置: 飛車で王手されている玉は、受けない手を指せない
  const pos = Position.fromSfen("4k4/9/9/9/9/9/9/9/4K3r b G 1");
  const moves = legalMoves(pos);
  eq(
    "王手を受ける手だけ",
    usis(pos, moves),
    ["5i4h", "5i5h", "5i6h", "G*2i", "G*3i", "G*4i"].sort().join(" "),
  );
}
{
  // 打ち歩詰め: 1 一の玉に 1 二歩打は、2 三の金が歩と 2 二を押さえ、2 一は自分の桂で逃げ場が無いので打てない
  const pos = Position.fromSfen("7nk/9/7G1/9/9/9/9/9/9 b P 1");
  fillDefenderHand(pos);
  const pawnDrop = legalMoves(pos).filter((m) => moveToUsi(m) === "P*1b");
  eq("打ち歩詰めは打てない", pawnDrop.length, 0);
  const otherDrop = legalMoves(pos).filter((m) => moveToUsi(m) === "P*1c");
  eq("王手でない歩打ちは打てる", otherDrop.length, 1);
}
{
  // 突き歩詰めはよい: 1 三の歩を 1 二へ突いて詰ます手は指せる
  const pos = Position.fromSfen("7nk/9/7GP/9/9/9/9/9/9 b - 1");
  const push = checkMoves(pos).filter((m) => moveToUsi(m) === "1c1b");
  eq("突き歩詰めは指せる", push.length, 1);
}

// 3. サンプル問題: df-pn の答えを、素朴な全探索（独立した物差し）と突き合わせる
// 全探索は「攻め方は全部の王手、受け方は全部の合法手」を深さ制限つきで読むだけ（無駄合の扱いは無い）
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
// 攻め方の各手番で、残りの手数以内に詰ます王手がいくつあるか（1 なら余詰なし）
function mateCounts(pos, moves) {
  const counts = [];
  for (let i = 0; i < moves.length; i++) {
    if (i % 2 === 0) {
      let n = 0;
      for (const c of checkMoves(pos)) {
        pos.doMove(c);
        if (andMate(pos, moves.length - i - 1, new Map())) n++;
        pos.undoMove(c);
      }
      counts.push(n);
    }
    pos.doMove(moves[i]);
  }
  for (let i = moves.length - 1; i >= 0; i--) pos.undoMove(moves[i]);
  return counts;
}
{
  const { Solver } = await import(base + "solver.js");
  const { SAMPLES } = await import(base + "samples.js");
  const BRUTE_MAX = 7;
  for (const s of SAMPLES) {
    const pos = Position.fromSfen(s.sfen);
    const st = performance.now();
    const r = new Solver({ timeLimitMs: 20000 }).solve(pos);
    const ms = Math.round(performance.now() - st);
    const name = `${s.title}（${ms} ms・${r.nodes} 局面）`;
    if (!s.answer) {
      eq(`${name} 不詰`, r.status, "nomate");
      eq(
        `${name} 全探索でも ${BRUTE_MAX} 手以内に詰まない`,
        orMate(pos, BRUTE_MAX, new Map()),
        false,
      );
      continue;
    }
    eq(`${name} 手順`, r.moves.map(moveToUsi).join(" "), s.answer);
    if (s.forbidden) {
      const [ply, usi] = s.forbidden;
      const p = Position.fromSfen(s.sfen);
      for (const m of r.moves.slice(0, ply)) p.doMove(m);
      eq(
        `${name} ${usi} は指せない`,
        legalMoves(p).some((m) => moveToUsi(m) === usi),
        false,
      );
    }
    if (r.futile || r.approx) ng(`${name} 注記が付いた: ${JSON.stringify(r)}`);
    if (r.len <= BRUTE_MAX) {
      const memo = new Map();
      eq(
        `${name} 全探索でも ${r.len} 手で詰む`,
        orMate(pos, r.len, memo),
        true,
      );
      eq(
        `${name} 全探索で ${r.len - 2} 手以内には詰まない`,
        orMate(pos, r.len - 2, memo),
        false,
      );
      const counts = mateCounts(pos, r.moves);
      eq(
        `${name} 攻め方の各手で詰ます手は一つだけ`,
        counts.every((n) => n === 1),
        true,
      );
    }
  }
}

const ms = Math.round(performance.now() - t0);
console.log(fail ? `NG ${fail} 件（${ms} ms）` : `全部 OK（${ms} ms）`);
process.exit(fail ? 1 : 0);
