// EVA15風シミュ：当りのうち各演出（と各層）が何%に出ているかを乱数で数える（段2の校正用）。
// 使い方（ブログのリポジトリで）：node scripts/eva-tools/hitshare.cjs src/simulator/js [回数]
// 1 回転の組合せを引き、その組合せの当りやすさ f で重みを付けて足す（E[出た × f] / 当り確率）
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const [jsDir, nArg] = process.argv.slice(2);
const N = Number(nArg || 2000000);
const ctx = vm.createContext({ console, Math, currentRot: 0 });
for (const f of ["eva-effects.js", "eva-voice.js", "eva-engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(jsDir, f), "utf8"), ctx, {
    filename: f,
  });
}
ctx.N = N;
const out = vm.runInContext(
  `(() => {
    const res = {};
    for (const [name, T] of [["low", EVA_T_N_LOW], ["st", EVA_T_S]]) {
      const byState = new Map();
      const byLayer = new Map();
      let hits = 0;
      for (let i = 0; i < N; i++) {
        const d = evaDrawEffects(T);
        hits += d.f;
        const seen = new Set();
        for (const { layer, state } of d.shown) {
          const k = layer.label + "|" + state.name + "|" + state.trust;
          byState.set(k, (byState.get(k) || 0) + d.f);
          if (!seen.has(layer.label)) {
            seen.add(layer.label);
            byLayer.set(layer.label, (byLayer.get(layer.label) || 0) + d.f);
          }
        }
      }
      res[name] = {
        alpha: T.alpha,
        hitRate: hits / N,
        pHit: T.pHit,
        layers: [...byLayer].map(([k, v]) => [k, (v / hits) * 100]),
        states: [...byState].map(([k, v]) => [k, (v / hits) * 100]),
      };
    }
    return res;
  })()`,
  ctx,
);
for (const [name, r] of Object.entries(out)) {
  console.log(
    `## ${name} alpha=${r.alpha.toFixed(3)} 当り 1/${(1 / r.hitRate).toFixed(1)}（仕様 1/${(1 / r.pHit).toFixed(1)}）`,
  );
  console.log("### 層（当りのうち出た%）");
  for (const [k, v] of r.layers.sort((a, b) => b[1] - a[1]))
    console.log(`  ${k}\t${v.toFixed(1)}%`);
  console.log("### 演出（当りのうち出た%）");
  for (const [k, v] of r.states.sort((a, b) => b[1] - a[1]))
    console.log(`  ${k}\t${v.toFixed(2)}%`);
}
