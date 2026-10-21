// 戦型（居飛車・振り飛車）の効きを確かめる: 戦型を決めた CPU と「おまかせ」の CPU を 40 手まで指させ、
// 戦型を決めた側の飛車の位置と、定跡の手を何手指したかを出す（定跡や骨格を書き足したら回す）
// 使い方: node scripts/shogi/style-check.mjs [段階の番号…=4 9]
import fs from "node:fs/promises";

const game = new URL("../../src/game/shogi/", import.meta.url);
const lab = new URL("../../src/lab/shogi/js/", import.meta.url);
const { Position, moveFromUsi, moveToUsi } = await import(
  new URL("core.js", lab).href
);
const { LEVELS } = await import(new URL("js/levels.js", game).href);
const { openEngine, think } = await import(new URL("js/cpu.js", game).href);
const { buildBook } = await import(new URL("js/book.js", game).href);
const { START } = await import(new URL("js/rules.js", game).href);

const ids = process.argv.slice(2).map(Number);
const book = buildBook(
  JSON.parse(await fs.readFile(new URL("book/book.json", game), "utf8")),
);
const engine = await openEngine({
  wasmBinary: await fs.readFile(new URL("engine/yaneuraou.wasm", game)),
  evalBin: (await fs.readFile(new URL("engine/nn.bin", game))).buffer,
});

// 盤の上の自分の飛車（竜も）の升（USI の筋段）
function rookAt(pos, side) {
  for (let sq = 0; sq < 81; sq++) {
    const p = pos.board[sq];
    if (!p || p > 0 !== (side === 0)) continue;
    const t = Math.abs(p);
    if (t === 7 || t === 15)
      return `${9 - (sq % 9)}${"abcdefghi"[(sq / 9) | 0]}`;
  }
  return "持ち駒";
}

const t0 = performance.now();
const cases = [];
for (const id of ids.length ? ids : [4, 9])
  for (const [style, skeleton] of [
    ["furibisha", "shiken"],
    ["furibisha", "sanken"],
    ["ibisha", "ibisha"],
  ])
    for (const side of [0, 1]) cases.push({ id, style, skeleton, side });

for (const c of cases) {
  const base = LEVELS.find((l) => l.id === c.id);
  const me = { ...base, book: true, style: c.style, skeleton: c.skeleton };
  const opp = { ...base, book: true, style: "auto", skeleton: null };
  const pos = Position.fromSfen(START);
  const usi = [];
  let bookCount = 0;
  for (let ply = 0; ply < 40; ply++) {
    const lv = pos.side === c.side ? me : opp;
    const r = await think(
      engine,
      usi.length ? `${START} moves ${usi.join(" ")}` : START,
      lv,
      book,
    );
    if (r.move === "resign" || r.move === "win") break;
    const m = moveFromUsi(pos, r.move);
    if (m === null) break;
    if (r.book && pos.side === c.side) bookCount++;
    pos.doMove(m);
    usi.push(moveToUsi(m));
  }
  console.log(
    `${base.name} ${c.side ? "後手" : "先手"} ${c.style}/${c.skeleton}: 飛車 ${rookAt(pos, c.side)}・定跡の手 ${bookCount}・${usi.slice(0, 16).join(" ")}`,
  );
}
console.log(`${Math.round((performance.now() - t0) / 1000)} 秒`);
engine.dispose();
