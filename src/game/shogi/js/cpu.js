// 対局 CPU: やねうら王（WASM・単一スレッド）を開いて、局面に対して 1 手を返す
// ブラウザの Worker（cpu-worker.js）と node の自動対戦（scripts/shogi/selfplay.mjs）の両方から使う
// エンジン本体（../engine/）は GPLv3。ここからは USI の文字列でやり取りするだけ
//
// 強さの調整: この版のやねうら王（TOURNAMENT ビルド）には SkillLevel が無いので、
// 上位の候補手を複数出させ（MultiPV）、最善との点差が段階ごとの幅（margin）に入る手から選ぶ
import factory from "../engine/yaneuraou.js";

const MATE = 30000; // 詰みの評価値を点数に直すときの大きさ
const READY_TIMEOUT = 30000;

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
// level: { nodes, multiPv, margin, byoyomi }（levels.js）
// 結果 { move: USI の手 | "resign" | "win", score, nodes, candidates }
export async function think(engine, position, level) {
  const { lines, send, until, ready } = engine;
  send(`setoption name MultiPV value ${level.multiPv ?? 1}`);
  send(`setoption name NodesLimit value ${level.nodes ?? 0}`);
  await ready();
  send(`position sfen ${position}`);
  const movetime = level.byoyomi ?? 3000;
  send(`go movetime ${movetime}`);
  await until(
    () => lines.some((l) => l.startsWith("bestmove")),
    movetime + 20000,
    "go",
  );
  const best = lines.find((l) => l.startsWith("bestmove")).split(/\s+/)[1];
  const candidates = parseCandidates(lines);
  return {
    move: pick(best, candidates, level),
    score: candidates[0]?.score ?? null,
    nodes: candidates[0]?.nodes ?? null,
    candidates,
  };
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
  // 自分が詰ます手があるときは、それを選ぶ（逃すと弱すぎて不自然なため）
  if (top >= MATE - 1000 || margin <= 0) return candidates[0].move;
  const pool = candidates.filter(
    (c) => c.score >= top - margin && c.score > -MATE + 1000,
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

// エンジンは長く使い回すと、まれに内部で止まる（WASM の abort。2026-10-15 の自動対戦で数百手に 1 回）。
// そのときは開き直して、同じ局面を 1 回だけ考え直す。結果に restarted: true を付ける
export async function thinkSafely(holder, position, level) {
  try {
    return await think(await holder.get(), position, level);
  } catch {
    holder.reset();
    const r = await think(await holder.get(), position, level);
    return { ...r, restarted: true };
  }
}
