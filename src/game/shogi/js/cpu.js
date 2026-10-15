// 対局 CPU: やねうら王（WASM・単一スレッド）を開いて、局面に対して 1 手を返す
// ブラウザの Worker（cpu-worker.js）と node の自動対戦（scripts/shogi/selfplay.mjs）の両方から使う
// エンジン本体（../engine/）は GPLv3。ここからは USI の文字列でやり取りするだけ
import { createEngine } from "../engine/index.js";
import factory from "../engine/yaneuraou.js";

// wasmBinary・evalBin は呼ぶ側で読み込んで渡す（ブラウザは fetch、node は fs）
export function openEngine({ wasmBinary, evalBin }) {
  return createEngine({ factory, wasmBinary, evalBin, usiHash: 16 });
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

// position: 「初期局面の SFEN moves 指し手 …」（千日手をエンジンが分かるように手順ごと渡す）
// 結果 { move: USI の手 | "resign" | "win", score, nodes }
export async function think(engine, position, level) {
  const r = await engine.eval({
    sfen: position,
    byoyomi: level.byoyomi,
    skillLevel: level.skill,
    nodesLimit: level.nodes,
  });
  return { move: r.bestmove, score: r.score, nodes: r.nodes };
}
