// 対局 CPU を画面と別のスレッドで動かす（やねうら王は単一スレッドで、考えている間は止められないため）
// 受け取る: { type: "warm" }（先にエンジンを読み込む）/ { type: "think", id, position, level }
// 返す: { type: "ready" } / { type: "move", id, move, score, nodes, restarted } / { type: "error", id, message }
import { openEngine, engineHolder, thinkSafely } from "./cpu.js";

const base = new URL("../engine/", import.meta.url);
let files = null;

async function loadFiles() {
  files ??= Promise.all([
    fetch(new URL("yaneuraou.wasm", base)).then((r) => r.arrayBuffer()),
    fetch(new URL("nn.bin", base)).then((r) => r.arrayBuffer()),
  ]);
  const [wasmBinary, evalBin] = await files;
  // evalBin はエンジンが MEMFS に写すので、開き直すときのために複製して渡す
  return openEngine({ wasmBinary, evalBin: evalBin.slice(0) });
}

const holder = engineHolder(loadFiles);

self.onmessage = async (ev) => {
  const d = ev.data;
  try {
    if (d.type === "warm") {
      await holder.get();
      self.postMessage({ type: "ready" });
      return;
    }
    const r = await thinkSafely(holder, d.position, d.level);
    self.postMessage({ type: "move", id: d.id, ...r });
  } catch (e) {
    self.postMessage({ type: "error", id: d.id, message: e.message });
  }
};
