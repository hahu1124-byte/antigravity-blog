// EVA15風シミュの抽選の表（案 B：当否が先・当り用とハズレ用の表）の確かめ。表から直接数える＋短い乱数の確かめ（数秒）。
// 表の警告（同じ層の合計が 100% 超え）・縮めた所・信頼度からずれる演出・リーチ・まとまりの当りのうちを出す。
// 使い方（ブログのリポジトリで）：node scripts/eva-tools/check-b.cjs [乱数の回転数（既定 200000）]
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const jsDir = path.join(__dirname, "../../src/simulator/js");
const N = Number(process.argv[2] || 200000);
const ctx = vm.createContext({ console, Math, currentRot: 0 });
const t0 = Date.now();
for (const f of ["eva-effects.js", "eva-voice.js", "eva-engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(jsDir, f), "utf8"), ctx, {
    filename: f,
  });
}
console.log(`読み込み（表づくり 4 組）${Date.now() - t0}ms`);
ctx.N = N;
const res = vm.runInContext(
  `(() => {
    const out = {};
    for (const [name, T] of [["通常(400以下)", EVA_T_N_LOW], ["通常(401以上)", EVA_T_N_HIGH], ["時短", EVA_T_J], ["ST", EVA_T_S], ["ST高速", EVA_T_S_FAST]]) {
      const P = T.pHit;
      const off = evaStateFreqs(T).filter((r) => r.freq > 0)
        .map((r) => ({ name: r.state.name, trust: r.state.trust, real: (P * r.hit) / r.freq * 100 }))
        .filter((r) => Math.abs(r.real - Math.min(100, r.trust)) > 0.5);
      out[name] = { warn: T.warn, info: T.info, off, k3Rate: T.k3Rate, sudden: T.reach.hit[T.reach.hit.length - 1] };
    }
    const T = EVA_T_N_LOW;
    const P = T.pHit;
    const rows = evaStateFreqs(T);
    out.reach = rows.filter((r) => r.layer.isReach).map((r) => ({ name: r.state.name, trust: r.state.trust,
      hit: r.hit * 100, every: 1 / r.freq, real: (P * r.hit) / r.freq * 100 }));
    // まとまりごとの当りのうち（%）
    const g = new Map();
    for (const r of rows) {
      if (r.layer.isReach) continue;
      const k = evaGroupKey(r.layer, r.state);
      g.set(k, (g.get(k) || 0) + r.hit * 100);
    }
    out.groups = [...g];
    // 出た回の当りやすさと信頼度のずれが大きい演出（表から）
    out.off = rows.filter((r) => !r.layer.isReach && r.freq > 0)
      .map((r) => ({ name: r.state.name, trust: r.state.trust, real: (P * r.hit) / r.freq * 100 }))
      .filter((r) => Math.abs(r.real - Math.min(100, r.trust)) > 0.5);
    // 乱数で確かめ（通常 400 回転以下）
    let hits = 0, noReachHits = 0, revive = 0;
    const bands = {};
    const byReach = {};
    for (let i = 0; i < N; i++) {
      const j = createEvaJob(false, "n");
      if (j.isHit) { hits++; if (j.reachId === "none") noReachHits++; }
      const b = Math.min(Math.floor(j.trust / 10) * 10, 100);
      const row = bands[b] || (bands[b] = { n: 0, hit: 0, sum: 0 });
      row.n++; row.sum += j.trust; if (j.isHit) row.hit++;
      const rr = byReach[j.reachId] || (byReach[j.reachId] = { n: 0, hit: 0 });
      rr.n++; if (j.isHit) rr.hit++;
    }
    out.mc = { hits, noReachHits, bands, byReach };
    return out;
  })()`,
  ctx,
);
console.log(`乱数 ${N.toLocaleString()} 回転まで ${Date.now() - t0}ms`);
for (const name of ["通常(400以下)", "通常(401以上)", "時短", "ST", "ST高速"]) {
  const r = res[name];
  console.log(
    `[${name}] 突発当り=当りの ${(r.sudden * 100).toFixed(2)}%・3R確変の比 ${r.k3Rate.toFixed(3)}・警告 ${r.warn.length} 件・縮めた所 ${r.info.length} 件・信頼度からずれる演出 ${r.off.length} 件`,
  );
  for (const w of r.warn) console.log("   " + w);
  for (const w of r.info) console.log("   （縮めた）" + w);
  if (name === "ST")
    for (const o of r.off)
      console.log(`   ずれ ${o.name} ${o.trust}% → ${o.real.toFixed(1)}%`);
}
console.log("\n## リーチ（表から）");
for (const r of res.reach) {
  console.log(
    `  ${r.name}\t資料 ${r.trust}%\t出た回 ${r.real.toFixed(1)}%\t当りのうち ${r.hit.toFixed(2)}%\t1/${Math.round(r.every).toLocaleString()}`,
  );
}
console.log("\n## まとまりの当りのうち（表から）");
for (const [k, v] of res.groups) console.log(`  ${k}\t${v.toFixed(1)}%`);
console.log(
  `\n## 出た回の当りやすさが信頼度から 0.5pt 以上ずれる演出：${res.off.length} 件`,
);
for (const r of res.off.slice(0, 30))
  console.log(`  ${r.name}\t信頼度 ${r.trust}%\t出た回 ${r.real.toFixed(1)}%`);
const mc = res.mc;
console.log(`\n## 乱数（${N.toLocaleString()} 回転）`);
console.log(
  `  当り 1/${(N / mc.hits).toFixed(1)}（仕様 1/319.7）・リーチなしの当り ${mc.noReachHits} 件（当りの ${((mc.noReachHits / mc.hits) * 100).toFixed(1)}%）`,
);
console.log("  表示の帯\t回転数\t表示の平均\t実測");
for (const [b, r] of Object.entries(mc.bands)) {
  console.log(
    `  ${b}%\t${r.n}\t${(r.sum / r.n).toFixed(1)}%\t${((r.hit / r.n) * 100).toFixed(1)}%`,
  );
}
console.log("  リーチ\t回転数\t実測");
for (const [id, r] of Object.entries(mc.byReach))
  console.log(`  ${id}\t${r.n}\t${((r.hit / r.n) * 100).toFixed(1)}%`);
