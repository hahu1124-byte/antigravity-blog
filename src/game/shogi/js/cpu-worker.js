// 対局 CPU を画面と別のスレッドで動かす（やねうら王は単一スレッドで、考えている間は止められないため）
// 受け取る: { type: "warm" }（先にエンジンを読み込む）/ { type: "think", id, position, level }
// 返す: { type: "ready" } / { type: "move", id, move, score, nodes, ms, book, restarted } / { type: "error", id, message }
import { openEngine, engineHolder, thinkSafely } from "./cpu.js";
import { buildBook } from "./book.js";

const base = new URL("../engine/", import.meta.url);
let files = null;
let book = null;

// 定跡は読めなくても対局は続ける（エンジンだけで指す）
function loadBook() {
  book ??= fetch(new URL("../book/book.json", import.meta.url))
    .then((r) => r.json())
    .then(buildBook)
    .catch((e) => {
      console.warn("定跡を読めませんでした:", e.message);
      return null;
    });
  return book;
}

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
      await Promise.all([holder.get(), loadBook()]);
      self.postMessage({ type: "ready" });
      return;
    }
    const r = await thinkSafely(
      holder,
      d.position,
      d.level,
      d.level.book ? await loadBook() : null,
    );
    // position も返す（評価値の表示で、待ったの後の古い返事を見分けるため）
    self.postMessage({ type: "move", id: d.id, position: d.position, ...r });
  } catch (e) {
    self.postMessage({ type: "error", id: d.id, message: e.message });
  }
};
