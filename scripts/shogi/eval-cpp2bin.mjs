// やねうら王の埋め込み用 C++（gEmbeddedNNUEData の文字列）を、元の nn.bin に戻す
// 評価関数（水匠ぺてぃと等）が mizar/YaneuraOu の release「resource」に .cpp.gz でしか無いため
// 使い方: node scripts/shogi/eval-cpp2bin.mjs <入力 .cpp（gz を解いたもの）> <出力 .bin>
//   例: 出力を src/game/shogi/engine/nn.bin にする（水匠ぺてぃとは 893,917 バイト）
import fs from "node:fs";

const [src, out] = process.argv.slice(2);
const text = fs.readFileSync(src, "latin1");
const start = text.indexOf("gEmbeddedNNUEData = ");
// 先頭の extern 宣言にも同じ名前があるので、データの始まりより後ろから探す
const end = text.indexOf("const std::size_t gEmbeddedNNUESize", start);
const size = Number(text.slice(end).match(/=\s*(\d+)/)[1]);
const body = text.slice(start, end);

const bytes = [];
// 文字列リテラルの中身だけを読む（"..." が複数つながっていてもよい）
let inStr = false;
for (let i = 0; i < body.length; i++) {
  const ch = body[i];
  if (!inStr) {
    if (ch === '"') inStr = true;
    continue;
  }
  if (ch === '"') {
    inStr = false;
    continue;
  }
  if (ch !== "\\") {
    bytes.push(ch.charCodeAt(0));
    continue;
  }
  const e = body[++i];
  if (e === "x") {
    let h = "";
    while (/[0-9a-fA-F]/.test(body[i + 1]) && h.length < 2) h += body[++i];
    bytes.push(parseInt(h, 16));
  } else if (/[0-7]/.test(e)) {
    let o = e;
    while (/[0-7]/.test(body[i + 1]) && o.length < 3) o += body[++i];
    bytes.push(parseInt(o, 8));
  } else {
    const map = {
      n: 10,
      t: 9,
      r: 13,
      0: 0,
      "\\": 92,
      '"': 34,
      "'": 39,
      "?": 63,
    };
    if (!(e in map)) throw new Error(`知らないエスケープ \\${e}`);
    bytes.push(map[e]);
  }
}
if (bytes.length !== size)
  throw new Error(`大きさが合わない: ${bytes.length}（期待 ${size}）`);
fs.writeFileSync(out, Buffer.from(bytes));
console.log(`OK ${out} ${bytes.length} バイト`);
