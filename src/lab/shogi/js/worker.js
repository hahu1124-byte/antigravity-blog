// 詰将棋ソルバーを画面と別のスレッドで回す
// 受け取る: { sfen, timeLimitMs }
// 返す: { type: "progress", nodes, ms } / { type: "result", ...結果 } / { type: "explain", plies, partial, ms } / { type: "error", message }
// 詰んだら、解を返した後に同じソルバーで解説（紛れ・変化）を作って 2 通目で送る
import { Position } from "./core.js";
import { Solver } from "./solver.js";

const EXPLAIN_MS = 5000;

self.onmessage = (ev) => {
  const { sfen, timeLimitMs } = ev.data;
  const t0 = performance.now();
  try {
    const pos = Position.fromSfen(sfen);
    const solver = new Solver({
      timeLimitMs,
      onProgress: ({ nodes }) =>
        self.postMessage({
          type: "progress",
          nodes,
          ms: Math.round(performance.now() - t0),
        }),
    });
    const r = solver.solve(pos);
    self.postMessage({ type: "result", ...r });
    if (r.status !== "mate" || r.approx) return;
    solver.onProgress = null;
    const t1 = performance.now();
    const ex = solver.explain(pos, r.moves, EXPLAIN_MS);
    self.postMessage({
      type: "explain",
      ...ex,
      ms: Math.round(performance.now() - t1),
    });
  } catch (e) {
    self.postMessage({ type: "error", message: e.message });
  }
};
