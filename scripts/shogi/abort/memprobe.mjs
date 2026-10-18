// エンジンを開いて、どの時点でメモリが広がるか（emscripten_resize_heap の要求）を見る
// 使い方: node memprobe.mjs [hash=16]
import fs from "node:fs";
const BLOG = "H:/gravity/projects/antigravity-blog/src/";
const game = new URL(`file:///${BLOG}game/shogi/`);
const factory = (await import(new URL("engine/yaneuraou.js", game).href))
  .default;
const hash = process.argv[2] ?? "16";
const wasmBinary = fs.readFileSync(new URL("engine/yaneuraou.wasm", game));
const evalBin = fs.readFileSync(new URL("engine/nn.bin", game));
const mod = new WebAssembly.Module(wasmBinary);
console.log(
  "imports memory:",
  WebAssembly.Module.imports(mod).filter((i) => i.kind === "memory"),
  "exports memory:",
  WebAssembly.Module.exports(mod).filter((e) => e.kind === "memory"),
);
let memory;
let phase = "起動";
const inst = await factory({
  instantiateWasm(imports, done) {
    const orig = imports.env.emscripten_resize_heap;
    imports.env.emscripten_resize_heap = (req) => {
      const before = memory.buffer.byteLength;
      const ok = orig(req);
      console.log(
        `  [${phase}] resize_heap 要求 ${(req >>> 0) / 1048576}MB: ${before / 1048576}MB → ${memory.buffer.byteLength / 1048576}MB ok=${!!ok}`,
      );
      return ok;
    };
    WebAssembly.instantiate(mod, imports).then((i) => {
      memory = i.exports.memory;
      console.log(`  初めのメモリ ${memory.buffer.byteLength / 1048576}MB`);
      done(i, mod);
    });
    return {};
  },
});
const lines = [];
inst.addMessageListener((l) => lines.push(l));
inst.FS.mkdirTree("/eval");
inst.FS.writeFile("/eval/nn.bin", new Uint8Array(evalBin));
const wait = async (p) => {
  while (!p()) await new Promise((r) => setTimeout(r, 1));
};
const step = async (name, cmds, until) => {
  phase = name;
  lines.length = 0;
  for (const c of cmds) inst.postMessage(c);
  if (until) await wait(() => lines.some(until));
  console.log(`${name} の後: ${memory.buffer.byteLength / 1048576}MB`);
};
await step("usi", ["usi"], (l) => l === "usiok");
console.log(lines.filter((l) => l.startsWith("option") || l.startsWith("id")).join("\n"));
await step(
  "isready",
  [
    "setoption name Threads value 1",
    `setoption name USI_Hash value ${hash}`,
    "setoption name EvalDir value /eval",
    "isready",
  ],
  (l) => l === "readyok",
);
await step(
  "go 1",
  [
    "setoption name MultiPV value 8",
    "setoption name NodesLimit value 3000",
    "isready",
    "position startpos",
    "go movetime 3000",
  ],
  (l) => l.startsWith("bestmove"),
);
await step(
  "go 2",
  ["isready", "position startpos moves 7g7f", "go movetime 3000"],
  (l) => l.startsWith("bestmove"),
);
process.exit(0);
