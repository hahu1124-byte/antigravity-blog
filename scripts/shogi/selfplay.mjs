// 対局 CPU の強さの段階を、CPU 同士の自動対戦で測る
// 使い方: node scripts/shogi/selfplay.mjs <段階A> <段階B> [序盤の数=10]
//   序盤の決まった手順を 1 つずつ、先手・後手を入れ替えて 2 局ずつ指す（同じ手順を繰り返さないため）
//   出力: 1 局ごとの結果と、A から見た勝ち・負け・引き分け、かかった時間
import fs from "node:fs/promises";

const game = new URL("../../src/game/shogi/", import.meta.url);
const lab = new URL("../../src/lab/shogi/js/", import.meta.url);
const { Position, legalMoves, moveFromUsi, moveToUsi } = await import(
  new URL("core.js", lab).href
);
const { LEVELS } = await import(new URL("js/levels.js", game).href);
const { openEngine, engineHolder, thinkSafely } = await import(
  new URL("js/cpu.js", game).href
);

const [a, b, n = "10"] = process.argv.slice(2);
// 段階は levels.js の番号か、「局面数:候補数:点差」で直接書く（段階を決める前の試し用）
const levelOf = (arg) => {
  if (!arg?.includes(":")) return LEVELS.find((l) => l.id === Number(arg));
  const [nodes, multiPv, margin] = arg.split(":").map(Number);
  return {
    id: arg,
    name: `局面${nodes}・候補${multiPv}・幅${margin}`,
    nodes,
    multiPv,
    margin,
    byoyomi: 3000,
  };
};
const levelA = levelOf(a);
const levelB = levelOf(b);
if (!levelA || !levelB) {
  console.log(
    "使い方: node scripts/shogi/selfplay.mjs <段階A> <段階B> [序盤の数]",
  );
  process.exit(1);
}

const START = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
// 序盤の決まった手順（よく指される形。ここから先を CPU に任せる）
const OPENINGS = [
  "7g7f 3c3d 2g2f 4c4d",
  "2g2f 8c8d 2f2e 8d8e",
  "7g7f 8c8d 2g2f 8d8e",
  "7g7f 3c3d 6g6f 8c8d",
  "2g2f 3c3d 7g7f 4c4d",
  "7g7f 3c3d 2g2f 4a3b",
  "5g5f 3c3d 7g7f 8c8d",
  "7g7f 3c3d 8h2b+ 3a2b",
  "2g2f 8c8d 7g7f 8d8e",
  "7g7f 4c4d 2g2f 4a3b",
].slice(0, Number(n));
const MAX_PLIES = 320;

const files = {
  wasmBinary: await fs.readFile(new URL("engine/yaneuraou.wasm", game)),
  evalBin: (await fs.readFile(new URL("engine/nn.bin", game))).buffer,
};
const open = () => openEngine({ ...files, evalBin: files.evalBin.slice(0) });
const engines = [engineHolder(open), engineHolder(open)];
let restarts = 0;

// 1 局指す。levels[0] が先手。結果 { winner: 0 | 1 | null, reason, plies }
async function playGame(opening, levels) {
  const pos = Position.fromSfen(START);
  const usi = [];
  const seen = new Map();
  const play = (u) => {
    const m = moveFromUsi(pos, u);
    if (m === null) return false;
    pos.doMove(m);
    usi.push(moveToUsi(m));
    const k = pos.key();
    seen.set(k, (seen.get(k) ?? 0) + 1);
    return true;
  };
  for (const u of opening.split(" "))
    if (!play(u)) throw new Error(`序盤の手順が指せない: ${opening} の ${u}`);
  while (usi.length < MAX_PLIES) {
    const side = usi.length % 2;
    const position = `${START} moves ${usi.join(" ")}`;
    let r;
    try {
      r = await thinkSafely(engines[side], position, levels[side]);
    } catch (e) {
      // 開き直しても落ちたときは、局面と段階を残して止める（原因を調べるため）
      console.log(`エンジンが落ちた: ${e.message}`);
      console.log(`  段階 ${JSON.stringify(levels[side])}`);
      console.log(`  局面 position sfen ${position}`);
      throw e;
    }
    if (r.restarted) {
      restarts++;
      console.log(`  （エンジンを開き直した: ${usi.length} 手目）`);
    }
    if (r.move === "resign")
      return { winner: side ^ 1, reason: "投了", plies: usi.length };
    if (r.move === "win")
      return { winner: side, reason: "入玉宣言", plies: usi.length };
    if (!play(r.move))
      return { winner: side ^ 1, reason: `反則 ${r.move}`, plies: usi.length };
    if (legalMoves(pos).length === 0)
      return { winner: side, reason: "詰み", plies: usi.length };
    if (seen.get(pos.key()) >= 4)
      return { winner: null, reason: "千日手", plies: usi.length };
  }
  return { winner: null, reason: "手数の上限", plies: usi.length };
}

const t0 = performance.now();
const score = { win: 0, lose: 0, draw: 0 };
for (const opening of OPENINGS) {
  for (const aFirst of [true, false]) {
    const levels = aFirst ? [levelA, levelB] : [levelB, levelA];
    const st = performance.now();
    const r = await playGame(opening, levels);
    const aSide = aFirst ? 0 : 1;
    const res =
      r.winner === null ? "draw" : r.winner === aSide ? "win" : "lose";
    score[res]++;
    console.log(
      `${opening} ${aFirst ? "A先手" : "A後手"}: ${{ win: "A勝ち", lose: "A負け", draw: "引き分け" }[res]}（${r.reason}・${r.plies}手・${Math.round((performance.now() - st) / 1000)}秒）`,
    );
  }
}
const total = score.win + score.lose + score.draw;
console.log(
  `${levelA.name}(${levelA.id}) 対 ${levelB.name}(${levelB.id}): ${score.win}勝 ${score.lose}敗 ${score.draw}分（${total}局・A の勝率 ${Math.round(((score.win + score.draw / 2) / total) * 100)}%）・${Math.round((performance.now() - t0) / 1000)}秒・エンジンの開き直し ${restarts} 回`,
);
for (const e of engines) e.reset();
