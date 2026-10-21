// 定跡（src/game/shogi/book/book.json）の手を、エンジンで 1 手ずつ確かめる
// 使い方: node scripts/shogi/book-check.mjs [局面数=300000] [目安の点差=150] [名前の一部（その定跡だけ）]
//   各手について「その局面の最善の点数」と「定跡の手を指した点数」を比べ、差が目安を超えた手を ⚠ で出す
//   （定跡を書き足したら回す。指せない手は buildBook が止める）
import fs from "node:fs/promises";

const game = new URL("../../src/game/shogi/", import.meta.url);
const { openEngine, think } = await import(new URL("js/cpu.js", game).href);
const { buildBook } = await import(new URL("js/book.js", game).href);
const { START } = await import(new URL("js/rules.js", game).href);

const [nodes = "300000", warn = "150", only = ""] = process.argv.slice(2);
const data = JSON.parse(
  await fs.readFile(new URL("book/book.json", game), "utf8"),
);
buildBook(data);
data.lines = data.lines.filter((l) => l.name.includes(only));
const engine = await openEngine({
  wasmBinary: await fs.readFile(new URL("engine/yaneuraou.wasm", game)),
  evalBin: (await fs.readFile(new URL("engine/nn.bin", game))).buffer,
});
const level = { nodes: Number(nodes), multiPv: 1, margin: 0, byoyomi: 10000 };
const position = (list) =>
  list.length ? `${START} moves ${list.join(" ")}` : START;

const t0 = performance.now();
const total = data.lines.reduce(
  (a, l) => a + l.moves.trim().split(/\s+/).length,
  0,
);
let done = 0;
let bad = 0;
const seen = new Map(); // 同じ手順の先頭は何度も読まない
for (const line of data.lines) {
  console.log(`■ ${line.name}（先手 ${line.black}・後手 ${line.white}）`);
  const list = [];
  for (const usi of line.moves.trim().split(/\s+/)) {
    const key = `${list.join(" ")}|${usi}`;
    let r = seen.get(key);
    if (!r) {
      const top = (await think(engine, position(list), level)).score;
      const s = (await think(engine, position([...list, usi]), level)).score;
      r = { top, after: s === null ? null : -s };
      seen.set(key, r);
    }
    // 点数が取れない（エンジンが範囲つきの点数だけで読み終えた）ときは差を出さない
    const known = Number.isFinite(r.top) && Number.isFinite(r.after);
    const diff = known ? r.top - r.after : null;
    if (diff > Number(warn)) bad++;
    console.log(
      `  ${String(list.length + 1).padStart(2)} ${usi.padEnd(6)} 最善 ${String(r.top ?? "?").padStart(5)}  この手 ${String(r.after ?? "?").padStart(5)}  差 ${String(diff ?? "?").padStart(4)}${diff > Number(warn) ? " ⚠" : ""}`,
    );
    list.push(usi);
    done++;
  }
  const s = (performance.now() - t0) / 1000;
  process.stderr.write(
    `${done}/${total} 手・${Math.round(s)} 秒・残り約 ${Math.round((s / done) * (total - done))} 秒\n`,
  );
}
console.log(
  `目安（${warn}）を超えた手: ${bad}・${Math.round((performance.now() - t0) / 1000)} 秒`,
);
engine.dispose();
