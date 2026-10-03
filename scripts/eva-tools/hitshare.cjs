// EVA15風シミュ：当りのうち各演出（と各まとまり）が何%に出るかを、当り用の表から数え上げる（乱数なし）。
// 使い方（ブログのリポジトリで）：node scripts/eva-tools/hitshare.cjs src/simulator/js
// 案 B では当り用の表の出現率がそのまま「当りのうち何%」。表の警告（同じ層の合計が 100% を超えて縮めた所）も出す
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const [jsDir] = process.argv.slice(2);
const ctx = vm.createContext({ console, Math, currentRot: 0 });
for (const f of ["eva-effects.js", "eva-voice.js", "eva-engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(jsDir, f), "utf8"), ctx, {
    filename: f,
  });
}
const out = vm.runInContext(
  `(() => {
    const res = {};
    for (const [name, T] of [["通常(400以下)", EVA_T_N_LOW], ["時短", EVA_T_J], ["ST", EVA_T_S]]) {
      const rows = evaStateFreqs(T);
      const groups = new Map();
      for (const r of rows) {
        if (r.layer.isReach) continue;
        const k = evaGroupKey(r.layer, r.state);
        groups.set(k, (groups.get(k) || 0) + r.hit * 100);
      }
      res[name] = {
        warn: T.warn,
        groups: [...groups],
        states: rows.map((r) => [r.layer.label + "|" + r.state.name + "|" + r.state.trust, r.hit * 100]),
      };
    }
    return res;
  })()`,
  ctx,
);
for (const [name, r] of Object.entries(out)) {
  console.log(`## ${name}（表の警告 ${r.warn.length} 件）`);
  for (const w of r.warn) console.log(`  ${w}`);
  console.log("### まとまり（当りのうち出る%）");
  for (const [k, v] of r.groups) console.log(`  ${k}\t${v.toFixed(1)}%`);
  console.log("### 演出（当りのうち出る%）");
  for (const [k, v] of r.states.sort((a, b) => b[1] - a[1]))
    console.log(`  ${k}\t${v.toFixed(2)}%`);
}
