// EVA15風シミュの演出ごとの出現頻度を 3 つの抽選表（通常 400 回転以下・401 回転以上・ST）から書き出す。
// 使い方（ブログのリポジトリで）：node scripts/eva-tools/freq.cjs src/simulator/js <出力 .md>
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const [jsDir, outFile] = process.argv.slice(2);
const ctx = vm.createContext({ console, Math });
for (const f of ["eva-effects.js", "eva-voice.js", "eva-engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(jsDir, f), "utf8"), ctx, {
    filename: f,
  });
}

const rows = vm.runInContext(
  `(() => {
    const out = [];
    for (const [table, T] of [["low", EVA_T_N_LOW], ["high", EVA_T_N_HIGH], ["st", EVA_T_S]]) {
      for (const { layer, state: s, freq: p } of evaStateFreqs(T)) {
        out.push({ table, layer: layer.label, name: s.name, trust: s.trust, p,
          solo: (p * s.trust / 100) / T.pHit * 100 });
      }
    }
    return out;
  })()`,
  ctx,
);

const every = (p) => (p > 0 ? `1/${Math.round(1 / p).toLocaleString()}` : "出ない");
const trust = (t) => (t >= 100 ? "濃厚" : `${t}%`);

// 通常時：400 回転以下と 401 回転以上を横に並べる（同じ層・同じ名前で突き合わせ）
const normal = new Map();
for (const r of rows.filter((r) => r.table !== "st")) {
  const key = r.layer + "\u0000" + r.name;
  const row = normal.get(key) || { layer: r.layer, name: r.name, trust: r.trust };
  row[r.table] = r;
  normal.set(key, row);
}

const lines = [];
lines.push("# EVA15風シミュ 演出の出現頻度一覧");
lines.push("");
lines.push(
  "- 「出現頻度」は 1 回転あたりに出る割合（1/N 回転に 1 回）。「単独なら」は、その演出だけが出た回転が当り全体の何%を占めるか（出しやすさの重み）",
);
lines.push("- 信頼度は資料の値（その演出が出たときの当りやすさ）。濃厚は 100%");
lines.push("");
lines.push("## 通常時（ヘソ）");
lines.push("");
lines.push("| 層 | 演出 | 信頼度 | 400回転以下 | 401回転以上 | 単独なら当りの |");
lines.push("| --- | --- | --- | --- | --- | --- |");
for (const r of normal.values()) {
  const solo = (r.high || r.low).solo;
  lines.push(
    `| ${r.layer} | ${r.name} | ${trust(r.trust)} | ${r.low ? every(r.low.p) : "出ない"} | ${r.high ? every(r.high.p) : "出ない"} | ${solo.toFixed(2)}% |`,
  );
}
lines.push("");
lines.push("## ST 中（IMPACT MODE）");
lines.push("");
lines.push("| 層 | 演出 | 信頼度 | 出現頻度 | 単独なら当りの |");
lines.push("| --- | --- | --- | --- | --- |");
for (const r of rows.filter((r) => r.table === "st")) {
  lines.push(
    `| ${r.layer} | ${r.name} | ${trust(r.trust)} | ${every(r.p)} | ${r.solo.toFixed(2)}% |`,
  );
}
fs.writeFileSync(outFile, lines.join("\n") + "\n", "utf8");
console.log(`書き出し ${rows.length} 行 → ${outFile}`);
