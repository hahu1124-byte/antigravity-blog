// 対局 CPU: やねうら王（WASM・単一スレッド）を開いて、局面に対して 1 手を返す
// ブラウザの Worker（cpu-worker.js）と node の自動対戦（scripts/shogi/selfplay.mjs）の両方から使う
// エンジン本体（../engine/）は GPLv3。ここからは USI の文字列でやり取りするだけ
//
// 強さの調整: この版のやねうら王（TOURNAMENT ビルド）には SkillLevel が無いので、
// 上位の候補手を複数出させ（MultiPV）、最善との点差が段階ごとの幅（margin）に入る手から選ぶ
// 序盤: 定跡（book.js）にある局面ではエンジンに聞かずに定跡から選び、外れた後は戦型の骨格の手を
// エンジンの点数で悪くならない範囲で指す
import factory from "../engine/yaneuraou.js";
import { parsePosition, bookMove, skeletonMove } from "./book.js";

const MATE = 30000; // 詰みの評価値を点数に直すときの大きさ
const READY_TIMEOUT = 30000;
// 骨格の手は、最善との点差がこの幅に入るときだけ指す
export const SKELETON_MARGIN = 150;
// 骨格の手が候補に無いとき、その手の点数を測る読みの量（局面数の上限が無い段で使う）
const SKELETON_NODES = 200000;

// エンジンを開く。wasmBinary・evalBin は呼ぶ側で読み込んで渡す（ブラウザは fetch、node は fs）
export async function openEngine({ wasmBinary, evalBin }) {
  const inst = await factory({ wasmBinary });
  const lines = [];
  inst.addMessageListener((l) => lines.push(l));
  inst.FS.mkdirTree("/eval");
  inst.FS.writeFile("/eval/nn.bin", new Uint8Array(evalBin));
  const send = (cmd) => inst.postMessage(cmd);
  const until = async (pred, ms, what) => {
    const t0 = Date.now();
    while (!pred()) {
      if (Date.now() - t0 > ms) throw new Error(`${what} の返事がない`);
      await new Promise((r) => setTimeout(r, 1));
    }
  };
  send("usi");
  await until(() => lines.includes("usiok"), 10000, "usi");
  send("setoption name Threads value 1");
  send("setoption name USI_Hash value 16");
  send("setoption name EvalDir value /eval");
  // 通信の遅れの見込みを 0 にする（既定だと持ち時間 0・秒読み 2 秒で 0.9 秒しか考えない）
  send("setoption name NetworkDelay value 0");
  send("setoption name NetworkDelay2 value 0");
  const ready = async () => {
    lines.length = 0;
    send("isready");
    await until(() => lines.includes("readyok"), READY_TIMEOUT, "isready");
  };
  await ready();
  return {
    lines,
    send,
    until,
    ready,
    dispose: () => inst.terminate(),
  };
}

// position: 「初期局面の SFEN moves 指し手 …」（千日手をエンジンが分かるように手順ごと渡す）
// level: { nodes, multiPv, margin, byoyomi, time, remain, book, bookPlies, style, skeleton }（levels.js・game.js）
//   time: { main, byoyomi } がある段は持ち時間で考える（remain は残りの持ち時間 ms。配分はエンジンに任せる）
// book: buildBook の結果（無ければ定跡も骨格も使わない）
// 結果 { move: USI の手 | "resign" | "win", score, nodes, candidates, ms（考えた時間）, book（定跡の手なら true） }
export async function think(engine, position, level, book = null) {
  const t0 = Date.now();
  const at = book && level.book ? parsePosition(position) : null;
  const fromBook = at && bookMove(book, at, level);
  if (fromBook)
    return {
      move: fromBook,
      score: null,
      nodes: null,
      candidates: [],
      ms: 0,
      book: true,
    };
  const { best, candidates } = await search(engine, position, level);
  let move = pick(best, candidates, level);
  const skel = at && skeletonMove(book, at, level);
  const over = best === "resign" || best === "win";
  if (skel && move !== skel && candidates.length && !over) {
    const top = candidates[0].score;
    const s = await scoreOf(engine, position, skel, candidates, level);
    if (top < MATE - 1000 && s !== null && top - s <= SKELETON_MARGIN)
      move = skel;
  }
  return {
    move,
    score: candidates[0]?.score ?? null,
    nodes: candidates[0]?.nodes ?? null,
    candidates,
    ms: Date.now() - t0,
  };
}

// エンジンに読ませて、bestmove と候補（点数の高い順）を返す
async function search(engine, position, level) {
  const { lines, send, until, ready } = engine;
  send(`setoption name MultiPV value ${level.multiPv ?? 1}`);
  send(`setoption name NodesLimit value ${level.nodes ?? 0}`);
  await ready();
  send(`position sfen ${position}`);
  let limit;
  if (level.time) {
    const remain = Math.max(0, Math.round(level.remain ?? level.time.main));
    send(`go btime ${remain} wtime ${remain} byoyomi ${level.time.byoyomi}`);
    limit = remain + level.time.byoyomi;
  } else {
    limit = level.byoyomi ?? 3000;
    send(`go movetime ${limit}`);
  }
  await until(
    () => lines.some((l) => l.startsWith("bestmove")),
    limit + 20000,
    "go",
  );
  const best = lines.find((l) => l.startsWith("bestmove")).split(/\s+/)[1];
  return { best, candidates: parseCandidates(lines) };
}

// 手 usi を指したときの点数（指す側から見て）。候補にあればその点数、無ければ指した後の局面を読ませる
async function scoreOf(engine, position, usi, candidates, level) {
  const c = candidates.find((x) => x.move === usi);
  if (c) return c.score;
  const after = position.includes(" moves ")
    ? `${position} ${usi}`
    : `${position} moves ${usi}`;
  const r = await search(engine, after, {
    nodes: level.nodes || SKELETON_NODES,
    multiPv: 1,
    byoyomi: 3000,
  });
  return r.candidates.length ? -r.candidates[0].score : null;
}

// info 行から、候補ごと（multipv の番号ごと）の最後の読みを取り出す。点数の高い順
export function parseCandidates(lines) {
  const byPv = new Map();
  for (const l of lines) {
    if (!l.startsWith("info") || !l.includes(" pv ")) continue;
    if (/\b(lowerbound|upperbound)\b/.test(l)) continue;
    const k = Number(l.match(/\bmultipv (\d+)/)?.[1] ?? 1);
    const s = l.match(/\bscore (cp|mate) (-?\d+)/);
    if (!s) continue;
    const v = Number(s[2]);
    const score =
      s[1] === "cp" ? v : v > 0 ? MATE - v : v < 0 ? -MATE - v : -MATE;
    byPv.set(k, {
      move: l.match(/\bpv (\S+)/)[1],
      score,
      nodes: Number(l.match(/\bnodes (\d+)/)?.[1] ?? 0),
    });
  }
  return [...byPv.values()].sort((a, b) => b.score - a.score);
}

// 最善との点差が margin 以内の候補から 1 つを選ぶ（重みは差が小さいほど大きい）
// 投了・宣言、候補が取れないときはエンジンの手をそのまま使う
export function pick(best, candidates, level, rnd = Math.random) {
  if (!candidates.length || best === "resign" || best === "win") return best;
  const margin = level.margin ?? 0;
  const top = candidates[0].score;
  // mateRule（既定 true）: 詰ます手があれば必ず選び、詰まされる手は選ばない。
  // いちばん弱い段階では false にして、詰みも見逃す・詰まされる手も指す
  const mateRule = level.mateRule ?? true;
  if (margin <= 0 || (mateRule && top >= MATE - 1000))
    return candidates[0].move;
  const pool = candidates.filter(
    (c) => c.score >= top - margin && (!mateRule || c.score > -MATE + 1000),
  );
  // どの手でも詰まされるときは、いちばん長く粘れる手
  if (!pool.length) return candidates[0].move;
  const weights = pool.map((c) => 1 + (margin - (top - c.score)) / margin);
  let r = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i].move;
  }
  return pool[0].move;
}

// エンジンの入れ物: 開くのは最初に使うとき。落ちたら捨てて、次に使うときに開き直す
export function engineHolder(open) {
  let p = null;
  return {
    get: () => (p ??= open()),
    reset() {
      if (p)
        p.then(
          (e) => {
            try {
              e.dispose();
            } catch {
              /* 落ちたエンジンは dispose でも投げることがある */
            }
          },
          () => {},
        );
      p = null;
    },
  };
}

// エンジンはまれに内部で止まる（WASM の abort。2026-10-15 の自動対戦で 20 局に 0〜17 回。原因は未調査）。
// そのときは開き直して同じ局面を考え直す（3 回まで）。結果に restarted: true を付ける
export async function thinkSafely(
  holder,
  position,
  level,
  book = null,
  tries = 3,
) {
  for (let i = 0; ; i++) {
    try {
      const r = await think(await holder.get(), position, level, book);
      return i ? { ...r, restarted: true } : r;
    } catch (e) {
      holder.reset();
      if (i >= tries) throw e;
    }
  }
}
