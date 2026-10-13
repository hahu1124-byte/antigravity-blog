// 詰将棋ソルバーを画面と別のスレッドで回す
// 受け取る: { sfen, timeLimitMs }　返す: { type: "progress", nodes, ms } / { type: "result", ...結果 } / { type: "error", message }
import { Position } from "./core.js";
import { Solver } from "./solver.js";

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
  } catch (e) {
    self.postMessage({ type: "error", message: e.message });
  }
};
