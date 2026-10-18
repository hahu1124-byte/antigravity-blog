// out/ の abort 記録（*-abortN.json）の要点を 1 行ずつ出す
// 使い方: node summarize.mjs [名前の頭=b]
import fs from "node:fs";
import path from "node:path";
const dir = path.join(import.meta.dirname, "out");
const head = process.argv[2] ?? "b";
for (const f of fs.readdirSync(dir).filter((f) => f.startsWith(head)).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const fail = j.grow.filter((g) => !g.ok);
  const lastCmd = j.cmds.at(-1);
  const moves = j.position.split(" moves ")[1]?.split(" ").length ?? 0;
  const frames = (j.abortStack ?? "")
    .split("\n")
    .filter((l) => l.includes("wasm-function"))
    .map((l) => l.match(/wasm-function\[(\d+)\]/)[1])
    .join(">");
  console.log(
    `${f}: 局${j.game} ${j.ply}手目 エンジン${j.engineId}の${j.thinksOnEngine}回目 手順${moves}手 最後のコマンド「${lastCmd.slice(0, 30)}」 広げる要求の失敗 ${fail.map((g) => `+${((g.req - g.before) / 1024).toFixed(0)}KB`).join(",")} 呼び出し元 ${frames}`,
  );
}
