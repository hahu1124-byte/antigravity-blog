const fs = require("fs");
const vm = require("vm");

const elements = new Map();
function makeRandom(initialSeed) {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// EVA は 1 回転で乱数を十数回続けて引くため、線形合同法だと連続した値の相関で当りが約2%ずれる。
// EVA の試験は mulberry32 を使う（リゼロの試験は従来の makeRandom のまま）
function makeRandomStrong(initialSeed) {
  let a = initialSeed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createElement() {
  return {
    classList: { add() {}, remove() {}, toggle() {} },
    style: {},
    innerText: "",
    innerHTML: "",
    offsetWidth: 0,
    getContext() {
      return {};
    },
  };
}

const context = vm.createContext({
  console,
  document: {
    body: createElement(),
    documentElement: createElement(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    querySelectorAll() {
      return [];
    },
  },
  window: {},
  Chart: class {
    update() {}
    destroy() {}
  },
  getComputedStyle() {
    return { getPropertyValue: () => "#1e6fff" };
  },
  confirm: () => true,
  setInterval: () => 1,
  clearInterval() {},
  timeoutCalls: [],
  setTimeout(callback, delay) {
    context.timeoutCalls.push(delay);
    callback();
    return 1;
  },
  Math: Object.create(Math),
  nativeRandom: Math.random,
  makeRandom,
  makeRandomStrong,
});

// index.html と同じ順（EVA の演出データ → 抽選エンジン → 本体）で読み込む
for (const file of [
  "eva-effects.js",
  "eva-engine.js",
  "eva-reel.js",
  "script.js",
]) {
  const source = fs.readFileSync(`src/simulator/js/${file}`, "utf8");
  vm.runInContext(source, context, { filename: file });
}

async function run(code) {
  return vm.runInContext(`(async () => { ${code} })()`, context);
}

// 実測の割合（%）を見るときの許容幅：標準誤差の 3.5 倍（最低 2pt）
function statTol(pct, n) {
  const p = Math.min(Math.max(pct / 100, 0.01), 0.99);
  return Math.max(2, 3.5 * Math.sqrt((p * (1 - p)) / n) * 100);
}

function assertClose(label, actual, expected, tolerance) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(
      `${label}: expected ${expected}, got ${actual.toFixed(4)} (tolerance ${tolerance})`,
    );
  }
}

(async () => {
  // 信頼度帯テーブルの厳密整合性チェック（Monte Carloではなく決定論的検算）
  // Σ(hit+miss) が機種のbit幅と厳密一致し、Σhitが目標当り本数と厳密一致することを保証する。
  const bandIntegrity = await run(`
    function checkBands(label, bands, expectedTotal, expectedHit) {
      const hitSum = bands.reduce((s, b) => s + b.hit, 0);
      const grandSum = bands.reduce((s, b) => s + b.hit + b.miss, 0);
      if (grandSum !== expectedTotal) {
        throw new Error(\`\${label}: Σ(hit+miss)=\${grandSum} !== \${expectedTotal}\`);
      }
      if (hitSum !== expectedHit) {
        throw new Error(\`\${label}: Σhit=\${hitSum} !== \${expectedHit}\`);
      }
    }
    checkBands("Rezero 通常", REZERO_BANDS_N, 1048576, 2997);
    checkBands("Rezero ST", REZERO_BANDS_S, 1048576, 10496);
    return "ok";
  `);
  if (bandIntegrity !== "ok") throw new Error("band integrity check failed");

  const simulation = await run(`
    currentMachine = "rezero";
    M = MACHINES.rezero;
    SPECS = M.specs;
    mode = "通常";
    optSaibare = false;
    Math.random = makeRandom(20260701);
    const counts = {};
    let hitsSeen = 0;
    let coloredHolds = 0;
    const spins = 5000000;
    for (let i = 0; i < spins; i++) {
      const job = createJob(false);
      if (job.isHit) hitsSeen++;
      if (job.holdType !== "none" || job.currentView !== "none") coloredHolds++;
      if (job.displayName !== "通常") {
        const row = counts[job.displayName] || (counts[job.displayName] = { hits: 0, total: 0 });
        row.total++;
        if (job.isHit) row.hits++;
      }
    }
    return { spins, hitsSeen, coloredHolds, counts };
  `);

  assertClose(
    "ReZero base odds",
    simulation.spins / simulation.hitsSeen,
    1048576 / 2997, // 帯テーブル(REZERO_BANDS_N)から導出される厳密値 ≈ 349.8752
    9,
  );
  if (simulation.coloredHolds !== 0) {
    throw new Error(
      `ReZero colored holds remained: ${simulation.coloredHolds}`,
    );
  }

  // 帯テーブル(REZERO_BANDS_N)の hit/(hit+miss) から導出される厳密値
  const expectedTrust = {
    ベアトリスランプ: 450 / 489,
    強欲SP: 300 / 385,
    死に戻りSP: 450 / 865,
    俺を選べSP: 539 / 2073,
    氷結の絆SP: 599 / 3328,
    スバルATTACK: 659 / 6590,
  };
  const measuredTrust = {};
  for (const [name, expected] of Object.entries(expectedTrust)) {
    const row = simulation.counts[name];
    if (!row) throw new Error(`${name}: no samples`);
    measuredTrust[name] = row.hits / row.total;
    assertClose(`${name} trust`, measuredTrust[name], expected, 0.025);
  }

  const saibare = await run(`
    optSaibare = true;
    Math.random = makeRandom(20260702);
    let hitsSeen = 0;
    let totalSeen = 0;
    for (let i = 0; i < 3000000; i++) {
      const job = createJob(false);
      if (job.saibare) {
        totalSeen++;
        if (job.isHit) hitsSeen++;
      }
    }
    return { hitsSeen, totalSeen };
  `);
  const saibareTrust = saibare.hitsSeen / saibare.totalSeen;
  assertClose("先バレ trust", saibareTrust, 0.4, 0.025);

  // ============================================================
  // EVA機：出た演出を先に決め、その組合せの信頼度 f で当否を引く
  //   f = 出た演出の信頼度の最大／数える演出が 2 つで最低 80%／3 つ以上で 100%
  // ============================================================
  const evaStartedAt = Date.now();
  console.log(`[EVA] 開始 ${new Date(evaStartedAt).toISOString()}`);

  // 校正の結果（縮めた係数・無演出当りの割合）と、各演出の出現頻度の一覧
  const evaCal = await run(`
    const rows = [];
    for (const [label, T] of [["通常(401以上)", EVA_T_N_HIGH], ["ST", EVA_T_S]]) {
      for (const { layer, state: s, freq: p } of evaStateFreqs(T)) {
        rows.push({ table: label, layer: layer.label, name: s.name, trust: s.trust, every: Math.round(1 / p), soloShare: (p * s.trust / 100) / T.pHit * 100 });
      }
      for (const L of T.free) {
        const sum = L.probs.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 1) > 1e-9) throw new Error(label + " " + L.label + ": 出現率の合計 " + sum);
      }
      for (const L of T.linked) {
        L.probsByReach.forEach((probs) => {
          const sum = probs.reduce((a, b) => a + b, 0);
          if (Math.abs(sum - 1) > 1e-9) throw new Error(label + " " + L.label + ": 出現率の合計 " + sum);
        });
      }
    }
    const summary = [["通常(400以下)", EVA_T_N_LOW], ["通常(401以上)", EVA_T_N_HIGH], ["ST", EVA_T_S]].map(([label, T]) => ({
      label, alpha: T.alpha, base0Share: (T.base0 * T.expect.none) / T.pHit, k3Rate: T.k3Rate,
      spEvery: 1 / T.reach.states.reduce((sum, rs, i) => (T.spec.spReaches.includes(rs.id) ? sum + T.reach.probs[i] : sum), 0),
    }));
    return { rows, summary };
  `);
  for (const s of evaCal.summary) {
    console.log(
      `[EVA] ${s.label}: 出現率の係数 alpha=${s.alpha.toFixed(3)} 無演出当り=当りの ${(s.base0Share * 100).toFixed(1)}% 3R確変の比=${s.k3Rate.toFixed(3)} SPリーチ=1/${Math.round(s.spEvery)} 回転`,
    );
    if (!(s.alpha > 0 && s.alpha <= 4))
      throw new Error(`EVA ${s.label}: alpha が範囲外`);
  }
  console.log(
    "[EVA] 演出ごとの信頼度と出現頻度（単独で出たときの当りの占める割合）",
  );
  for (const r of evaCal.rows) {
    console.log(
      `  ${r.table} ${r.layer} ${r.name}: 信頼度 ${r.trust}% 1/${r.every} 回転 単独なら当りの ${r.soloShare.toFixed(2)}%`,
    );
  }

  // モンテカルロ：通常時（400 回転以下・401 回転以上）と ST
  const evaMc = await run(`
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs;
    const out = {};
    for (const [label, md, rot, spins, seed] of [
      ["low", "通常", 0, 6000000, 20261003],
      ["high", "通常", 500, 6000000, 20261004],
      ["st", "ST", 0, 3000000, 20261006],
    ]) {
      mode = md; currentRot = rot;
      Math.random = makeRandomStrong(seed);
      const r = { spins, hits: 0, kinds: { r10: 0, k3: 0, t3: 0 }, bands: {}, solo: {}, names: {},
        combo2: { n: 0, hit: 0, low: 0 }, combo3: { n: 0, hit: 0 }, sure: { n: 0, hit: 0 },
        leverHits: 0, leverMiss: 0, leverMismatch: 0, vibeMismatch: 0, r10NotZenkaiten: 0, zenkaitenNotR10: 0,
        hangar4: 0, hangar4Bad: 0 };
      for (let i = 0; i < spins; i++) {
        const job = createJob(md !== "通常");
        if (job.isHit) { r.hits++; r.kinds[job.kind]++; }
        const hasLever = job.name.includes("白レバブル") || job.name.includes("赤レバブル") || job.name.includes("虹レバブル");
        if (hasLever) { if (job.isHit) r.leverHits++; else r.leverMiss++; }
        if (job.vibe !== hasLever) r.vibeMismatch++;
        const colorHold = job.effects.some((e) => /保留|シフト変化/.test(e.name));
        if (job.name.includes("レバブル保留") !== (hasLever && !colorHold)) r.leverMismatch++;
        if (job.name.includes("格納庫背景(四号機)")) {
          r.hangar4++;
          if (!job.isHit || job.kind !== "r10" || job.reachId !== "zenkaiten") r.hangar4Bad++;
        }
        if (job.isHit && job.kind === "r10" && md === "通常" && job.reachId !== "zenkaiten") r.r10NotZenkaiten++;
        if (job.isHit && md === "通常" && job.reachId === "zenkaiten" && job.kind !== "r10") r.zenkaitenNotR10++;
        for (const nm of job.name) {
          const row = r.names[nm] || (r.names[nm] = { n: 0, hit: 0 });
          row.n++; if (job.isHit) row.hit++;
        }
        if (job.effects.length) {
          // 表示の信頼度と実測の一致（帯ごと）
          const b = Math.min(Math.floor(job.trust / 10) * 10, 100);
          const row = r.bands[b] || (r.bands[b] = { n: 0, hit: 0, sum: 0 });
          row.n++; row.sum += job.trust; if (job.isHit) row.hit++;
        }
        // 演出が 1 つだけ出た回転：その演出の信頼度どおりに当たる
        if (job.effects.length === 1) {
          const e = job.effects[0];
          const row = r.solo[e.name] || (r.solo[e.name] = { n: 0, hit: 0, trust: e.trust });
          row.n++; if (job.isHit) row.hit++;
        }
        const counted = job.effects.filter((e) => e.counted).length;
        if (job.sure) { r.sure.n++; if (job.isHit) r.sure.hit++; }
        else if (counted === 2) { r.combo2.n++; if (job.isHit) r.combo2.hit++; if (job.trust < 80) r.combo2.low++; }
        if (counted >= 3) { r.combo3.n++; if (job.isHit) r.combo3.hit++; }
      }
      out[label] = r;
    }
    return out;
  `);
  const oddsOf = {
    low: 1048576 / 3280,
    high: 1048576 / 3280,
    st: 1048576 / 10544,
  };
  for (const [label, r] of Object.entries(evaMc)) {
    assertClose(
      `EVA ${label} odds`,
      r.spins / r.hits,
      oddsOf[label],
      label === "st" ? 2 : 6,
    );
    if (r.vibeMismatch)
      throw new Error(
        `EVA ${label}: 揺れとレバブルが食い違う ${r.vibeMismatch} 件`,
      );
    if (r.leverMismatch)
      throw new Error(
        `EVA ${label}: レバブル保留の表示が食い違う ${r.leverMismatch} 件`,
      );
    if (r.hangar4Bad)
      throw new Error(
        `EVA ${label}: 格納庫背景(四号機)が全回転の 10R 以外で出た ${r.hangar4Bad} 件`,
      );
    if (label !== "st" && !r.hangar4)
      throw new Error(`EVA ${label}: 格納庫背景(四号機)が一度も出ない`);
    if (label === "st" && r.hangar4)
      throw new Error("EVA st: 格納庫背景(四号機)が ST 中に出た");
    if (r.sure.hit !== r.sure.n)
      throw new Error(
        `EVA ${label}: 濃厚なのにハズレ ${r.sure.n - r.sure.hit} 件`,
      );
    if (r.combo3.hit !== r.combo3.n)
      throw new Error(
        `EVA ${label}: 3 つ以上の複合でハズレ ${r.combo3.n - r.combo3.hit} 件`,
      );
    if (r.combo2.low)
      throw new Error(
        `EVA ${label}: 2 つの複合で表示 80% 未満 ${r.combo2.low} 件`,
      );
    if (r.combo2.n >= 300 && r.combo2.hit / r.combo2.n < 0.75) {
      throw new Error(`EVA ${label}: 2 つの複合の実測が 80% を大きく下回る`);
    }
    console.log(
      `[EVA] ${label}: 2つの複合 n=${r.combo2.n} 実測 ${((r.combo2.hit / Math.max(1, r.combo2.n)) * 100).toFixed(1)}% ／ 3つ以上 n=${r.combo3.n} ／ 濃厚 n=${r.sure.n}`,
    );
    console.log(`[EVA] ${label}: 表示の帯ごとの実測`);
    const mid = { n: 0, hit: 0, sum: 0 };
    for (const [band, row] of Object.entries(r.bands).sort(
      (a, b) => a[0] - b[0],
    )) {
      const shown = row.sum / row.n;
      const actual = (row.hit / row.n) * 100;
      console.log(
        `  帯 ${band}% n=${row.n} 表示平均 ${shown.toFixed(2)}% → 実測 ${actual.toFixed(2)}%`,
      );
      if (row.n >= 1000)
        assertClose(
          `EVA ${label} 帯${band}% 表示と実測`,
          actual,
          shown,
          statTol(shown, row.n),
        );
      if (band >= 40 && band < 90) {
        mid.n += row.n;
        mid.hit += row.hit;
        mid.sum += row.sum;
      }
    }
    if (mid.n >= 500) {
      assertClose(
        `EVA ${label} 帯40〜89% 表示と実測`,
        (mid.hit / mid.n) * 100,
        mid.sum / mid.n,
        4,
      );
    }
    console.log(
      `[EVA] ${label}: 演出が 1 つだけ出た回転の実測（n≥2000 は標準誤差の3.5倍で判定）`,
    );
    for (const [nm, row] of Object.entries(r.solo).sort(
      (a, b) => b[1].n - a[1].n,
    )) {
      const actual = (row.hit / row.n) * 100;
      if (row.n >= 300)
        console.log(
          `  ${nm} n=${row.n} 信頼度 ${row.trust}% → 実測 ${actual.toFixed(1)}%`,
        );
      if (row.n >= 2000)
        assertClose(
          `EVA ${label} ${nm} 単独`,
          actual,
          row.trust,
          statTol(row.trust, row.n),
        );
    }
  }
  // 当り種別（通常時）：10R 3%（すべて全回転リーチ）・3R確変 56%・3R通常 41%
  for (const label of ["low", "high"]) {
    const r = evaMc[label];
    assertClose(`EVA ${label} 10R 比率`, r.kinds.r10 / r.hits, 0.03, 0.006);
    assertClose(`EVA ${label} 3R確変 比率`, r.kinds.k3 / r.hits, 0.56, 0.02);
    assertClose(`EVA ${label} 3R通常 比率`, r.kinds.t3 / r.hits, 0.41, 0.02);
    if (r.r10NotZenkaiten || r.zenkaitenNotR10)
      throw new Error(`EVA ${label}: 全回転リーチと 10R が一致しない`);
    console.log(
      `[EVA] ${label}: 当該レバブルは当りの ${((r.leverHits / r.hits) * 100).toFixed(1)}%`,
    );
    // 通常時の当該レバブルは当りの約3割（他の演出と重なってよい）
    assertClose(
      `EVA ${label} レバブル 当り絡み率`,
      r.leverHits / r.hits,
      0.3,
      0.02,
    );
  }
  // ST 中の当該レバブルはどれも当り確定で、出るのは当りの約2割
  if (evaMc.st.leverMiss)
    throw new Error(`EVA ST: 当該レバブルでハズレ ${evaMc.st.leverMiss} 件`);
  assertClose(
    "EVA ST レバブル 当り絡み率",
    evaMc.st.leverHits / evaMc.st.hits,
    0.2,
    0.01,
  );

  if (evaMc.low.names["群予告(レイ)"] || evaMc.low.names["群予告(シンジ)"]) {
    throw new Error("群予告 appeared while currentRot<=400 (gating broken)");
  }
  if (!evaMc.high.names["群予告(シンジ)"])
    throw new Error("群予告 did not appear when currentRot>400");

  // holdType/currentView が保留の層の結果とそのまま一致すること
  await run(`
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs; mode = "通常"; currentRot = 0;
    Math.random = () => 0.0001;
    const job = createJob(false);
    if (!job.name.includes("赤保留") || job.holdType !== "red" || job.currentView !== "red") {
      throw new Error("EVA hold currentView mismatch: " + job.name.join("+"));
    }
  `);

  // ST 中のシフト変化：保留にいる間は無地、当該になってから色が付く
  await run(`
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs; mode = "ST"; currentRot = 0;
    Math.random = makeRandomStrong(20261006);
    let shifts = 0;
    for (let i = 0; i < 200000; i++) {
      const job = createJob(true);
      if (!job.name.some((n) => n.startsWith("シフト変化"))) continue;
      shifts++;
      if (job.currentView !== "none" || job.holdType === "none") {
        throw new Error("EVA shift hold shown before activation: " + job.name.join("+"));
      }
    }
    if (shifts === 0) throw new Error("EVA shift hold never appeared in ST");
  `);

  // ST 中に入賞した保留を通常時に消化するときは通常の確率で抽選し直す（残保留の引き戻し 約1.25%）
  await run(`
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs; currentRot = 0;
    Math.random = makeRandomStrong(20261005);
    mode = "ST";
    const stJob = createJob(true);
    if (stJob.regime !== "s") throw new Error("ST 中の保留の確率状態が s でない");
    mode = "通常";
    const refreshed = refreshStaleJob(stJob);
    if (refreshed === stJob || refreshed.regime !== "n" || !refreshed.isRight) {
      throw new Error("ST 後の残保留が通常の確率で抽選し直されていない");
    }
    mode = "時短";
    const jitanJob = createJob(true);
    mode = "通常";
    if (refreshStaleJob(jitanJob) !== jitanJob) throw new Error("時短の保留を不要に作り直した");
  `);

  // ST 中のヘソ保留（特図1）の当りはヘソの振り分け、残保留は次のモードの確率で判定し直す、
  // 電サポ中のヘソ通常当りは時短 500 回で連チャンは続く
  const hesoSt = await run(`
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs; currentRot = 0;
    Math.random = makeRandomStrong(20261008);
    mode = "ST";
    const kinds = { r10: 0, k3: 0, t3: 0 };
    let hits = 0;
    for (let i = 0; i < 1500000; i++) {
      const job = createJob(false);
      if (!job.isHit) continue;
      hits++;
      kinds[job.kind]++;
      if (job.upgrade) throw new Error("ST 中のヘソ当りで昇格演出");
    }
    // 判定し直し
    mode = "通常";
    leftStock = [createJob(false), createJob(false)];
    rightStock = [createJob(true)];
    rejudgeStocks("s");
    if (![...leftStock, ...rightStock].every((j) => j.regime === "s")) throw new Error("残保留が ST の確率で判定し直されていない");
    return { hits, kinds };
  `);
  assertClose(
    "EVA ST中ヘソ 10R 比率",
    hesoSt.kinds.r10 / hesoSt.hits,
    0.03,
    0.01,
  );
  assertClose(
    "EVA ST中ヘソ 3R確変 比率",
    hesoSt.kinds.k3 / hesoSt.hits,
    0.56,
    0.03,
  );
  assertClose(
    "EVA ST中ヘソ 3R通常 比率",
    hesoSt.kinds.t3 / hesoSt.hits,
    0.41,
    0.03,
  );
  await run(`
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs;
    leftStock = []; rightStock = [];
    mode = "ST"; rushCount = 3; currentRushHits = 3; lcdCount = 20; totalBall = 0; currentRot = 20;
    await M.resolveHit({ eff: { isRight: false, kind: "t3", upgrade: false }, hitDigit: 4 });
    if (mode !== "時短" || rRem !== 500 || rushCount !== 4 || totalBall !== 420) throw new Error("電サポ中のヘソ通常当りが時短500回になっていない: " + mode + " " + rRem + " " + rushCount);
    mode = "時短"; rushCount = 4; totalBall = 0;
    await M.resolveHit({ eff: { isRight: false, kind: "k3", upgrade: false }, hitDigit: 3 });
    if (mode !== "ST" || rRem !== 163 || rushCount !== 5) throw new Error("電サポ中のヘソ確変当りが ST になっていない");
  `);

  // ハズレ図柄：リーチは左右が揃い中は 1 コマ先（ズレ目）、リーチなしは左右が揃わない
  await run(`
    Math.random = makeRandomStrong(20261007);
    for (let i = 0; i < 2000; i++) {
      const [a, b, c] = evaMissDigits(true);
      if (a !== c || b !== evaReelNext(a)) throw new Error("リーチのズレ目が違う: " + [a, b, c]);
      const [x, , z] = evaMissDigits(false);
      if (x === z) throw new Error("リーチなしで左右が揃った: " + [x, z]);
    }
    if (evaReelNext(9) !== 1 || evaReelPrev(1) !== 9) throw new Error("図柄の並びの折り返しが違う");
    // 3×3 の盤面（通常時・時短中）：リールは左が上から 1→9、中と右が 9→1（数字の間にブランク）。
    // ラインは上段・中段・下段。ハズレで揃う段も暴走図柄（1・3・5）も無く、
    // 上段 4・下段 2 のリーチ（大当り濃厚）はハズレでは出ない
    const lines = { top: 0, mid: 0, bot: 0 };
    let sureHits = 0;
    const isFallback = (g) => g.reach.length === 0 && evaRowsOf(g.grid).mid.join() === "3,5,7";
    for (let i = 0; i < 5000; i++) {
      const none = evaBuildGrid({ tenpai: false, isHit: false });
      if (evaReachLines(none.grid).length || evaWinRows(none.grid).length) throw new Error("リーチなしの盤面が違う: " + JSON.stringify(none.grid));
      const miss = evaBuildGrid({ tenpai: true, isHit: false });
      if (isFallback(miss)) throw new Error("リーチのハズレが作れなかった");
      if (evaReachLines(miss.grid).join() !== miss.reach.join() || miss.reach.length !== 1 || evaWinRows(miss.grid).length) throw new Error("リーチのハズレが違う: " + JSON.stringify(miss));
      lines[miss.reach[0]]++;
      const rows = evaRowsOf(miss.grid);
      if ((miss.reach[0] === "top" && rows.top[0] === 4) || (miss.reach[0] === "bot" && rows.bot[0] === 2)) throw new Error("大当り濃厚のリーチがハズレで出た: " + JSON.stringify(miss));
      const dbl = evaBuildGrid({ tenpai: true, isHit: false, double: true });
      if (evaReachLines(dbl.grid).join() !== "top,bot" || evaWinRows(dbl.grid).length) throw new Error("ダブルラインのハズレが違う: " + JSON.stringify(dbl));
      const dr = evaRowsOf(dbl.grid);
      if (dr.top[0] === 4 || dr.bot[0] === 2) throw new Error("ダブルラインのハズレに大当り濃厚の段: " + JSON.stringify(dbl));
      const d = 1 + (i % 9);
      for (const double of [false, true]) {
        const hit = evaBuildGrid({ tenpai: true, isHit: true, hitDigit: d, double });
        if (isFallback(hit)) throw new Error("当りの盤面が作れなかった: " + d);
        if (hit.win.length !== 1) throw new Error("当りの段が 1 つでない: " + JSON.stringify(hit));
        const hr = evaRowsOf(hit.grid)[hit.win[0]];
        if (!evaRowHit(hr) || hr[0] !== d || evaWinRows(hit.grid).join() !== hit.win.join()) throw new Error("当りの盤面が違う: " + JSON.stringify(hit));
        if ((hit.win[0] === "top" && d === 4) || (hit.win[0] === "bot" && d === 2)) sureHits++;
      }
      for (const line of ["top", "bot"]) {
        const boso = evaBuildGrid({ tenpai: true, isHit: true, hitDigit: 3, boso: true, line });
        if (!boso.boso || boso.win.length !== 1 || !evaIsBoso(evaRowsOf(boso.grid)[boso.win[0]]) || evaReachLines(boso.grid).join() !== boso.reach.join()) throw new Error("暴走図柄の当りが違う: " + JSON.stringify(boso));
        const br = evaRowsOf(boso.grid);
        if (line === "top" ? br.top[0] !== 4 : br.bot[0] !== 2) throw new Error("暴走図柄が上段4・下段2のリーチから出ていない");
      }
    }
    if (!lines.top || !lines.mid || !lines.bot) throw new Error("上段・中段・下段のリーチが全部出ない: " + JSON.stringify(lines));
    if (!sureHits) throw new Error("上段4・下段2 の当りが出ない");
    // リールの並び：左は 1 の下が 2、中と右は 1 の下が 9（逆回転）
    if (evaWindow(0, evaPosOf(0, 1, 0)).join() !== "1,,2" || evaWindow(1, evaPosOf(1, 1, 0)).join() !== "1,,9" || evaWindow(2, evaPosOf(2, 1, 0)).join() !== "1,,9") throw new Error("リールの並びが違う");
    // 暴走図柄で見せるのは確変の当りだけ（通常時の 3R通常・昇格の当りでは出さない）
    mode = "通常"; currentRot = 0;
    for (let i = 0; i < 300; i++) {
      for (const kind of ["t3", "k3"]) {
        const eff = { isHit: true, isRight: false, tenpai: true, kind, hitDigit: kind === "t3" ? 2 : 3, upgrade: false, reachId: "synchro", steps: [] };
        await evaRunDisplay(eff, { instant: true });
        if (kind === "t3" && eff.bosoShown) throw new Error("3R通常の当りが暴走図柄で出た");
        if (kind === "k3" && !eff.bosoShown) throw new Error("シンクロ経由の3R確変が暴走図柄で出ない");
      }
    }
    // 液晶に出す段：多いときは最大段数にまとめる
    const chunked = evaChunkSteps(["a", "b", "c", "d", "e", "f"], 4);
    if (chunked.length > 4 || chunked.flat().join("") !== "abcdef") throw new Error("段のまとめ方が違う");
    if (evaChunkSteps(["a", "b"], 4).length !== 2) throw new Error("少ない段をまとめてしまう");
    // 文字の色：演出名の色（強い色を優先）
    if (evaColorOf({ name: "エヴァチャンス文字(CHANCE緑)" }) !== "green") throw new Error("CHANCE緑の色が違う");
    if (evaColorOf({ name: "パネル予告(左選択・左赤右金)" }) !== "gold") throw new Error("金と赤の優先が違う");
    if (evaColorOf({ name: "ドデカ図柄" }) !== null) throw new Error("色の無い演出に色が付いた");
    if (evaColorOf({ name: "x", color: "white" }) !== "white") throw new Error("color 指定が効かない");
    // SP リーチの回転はリーチ名を reach の段に持つ
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs; mode = "通常"; currentRot = 0;
    let checked = 0;
    for (let i = 0; i < 400000 && checked < 50; i++) {
      const job = createJob(false);
      if (job.reachId !== "final") continue;
      if (!job.steps.some((s) => s.phase === "reach" && s.text === "最終号機リーチ")) throw new Error("リーチ名の段が無い");
      checked++;
    }
    if (!checked) throw new Error("最終号機リーチのサンプルが得られなかった");
  `);

  console.log(
    `[EVA] 終了 ${new Date().toISOString()}（${((Date.now() - evaStartedAt) / 1000).toFixed(1)} 秒）`,
  );

  const rushDistribution = await run(`
    currentMachine = "rezero";
    M = MACHINES.rezero;
    SPECS = M.specs;
    mode = "ST";
    rushStyle = "強欲RUSH";
    Math.random = makeRandom(20260703);
    const counts = { 300: 0, 1500: 0, 3000: 0 };
    const spins = 1000000;
    for (let i = 0; i < spins; i++) {
      const effect = M.pickRushBonus();
      counts[effect.bonusType]++;
    }
    return { spins, counts };
  `);
  assertClose(
    "RUSH 3000 distribution",
    rushDistribution.counts[3000] / rushDistribution.spins,
    0.25,
    0.003,
  );
  assertClose(
    "RUSH 1500 distribution",
    rushDistribution.counts[1500] / rushDistribution.spins,
    0.55,
    0.003,
  );
  assertClose(
    "RUSH 300 distribution",
    rushDistribution.counts[300] / rushDistribution.spins,
    0.2,
    0.003,
  );

  await run(`
    rushStyle = "強欲RUSH";
    Math.random = () => 0.1;
    const strong3000 = M.pickRushBonus();
    if (strong3000.bonusType !== 3000 || strong3000.name !== "超強欲3000BONUS") throw new Error("Strong RUSH 3000 mapping failed");
    Math.random = () => 0.5;
    const strong1500 = M.pickRushBonus();
    if (strong1500.bonusType !== 1500 || strong1500.name !== "Re:ゼロBONUS") throw new Error("Strong RUSH 1500 mapping failed");
    Math.random = () => 0.9;
    const strong300 = M.pickRushBonus();
    if (strong300.bonusType !== 300 || strong300.name !== "BONUS") throw new Error("Strong RUSH 300 mapping failed");

    rushStyle = "ドキドキRUSH";
    Math.random = () => 0.1;
    const doki3000 = M.pickRushBonus();
    if (doki3000.bonusType !== 3000 || doki3000.name !== "ドナぷる") throw new Error("Doki RUSH 3000 mapping failed");
    Math.random = () => 0.5;
    const doki1500 = M.pickRushBonus();
    if (doki1500.bonusType !== 1500 || doki1500.name !== "落ちブル") throw new Error("Doki RUSH 1500 mapping failed");
    Math.random = () => 0.9;
    const doki300 = M.pickRushBonus();
    if (doki300.bonusType !== 300 || doki300.name !== "エミリア告知") throw new Error("Doki RUSH 300 mapping failed");
  `);

  await run(`
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs;
    mode = "通常"; lcdCount = 25; totalBall = 0; currentRot = 25;
    Math.random = () => 0.9;
    await M.resolveHit({ eff: { isRight: false, kind: "t3", upgrade: false }, hitDigit: 2 });
    if (currentRot !== 0 || totalBall !== 420 || mode !== "時短" || rRem !== 100) throw new Error("Eva normal hit failed");

    mode = "通常"; lcdCount = 30; totalBall = 0; currentRot = 30;
    await M.resolveHit({ eff: { isRight: false, kind: "k3", upgrade: true, reachId: "synchro" }, hitDigit: 4 });
    if (totalBall !== 420 || mode !== "ST" || rRem !== 163) throw new Error("Eva 3R kakuhen hit failed");

    mode = "通常"; lcdCount = 40; totalBall = 0; currentRot = 40;
    await M.resolveHit({ eff: { isRight: false, kind: "r10", upgrade: false, reachId: "zenkaiten" }, hitDigit: 7 });
    if (totalBall !== 1400 || mode !== "ST" || rRem !== 163) throw new Error("Eva 10R hit failed");

    mode = "ST"; lcdCount = 12; totalBall = 0; currentRot = 12;
    await M.resolveHit({ eff: { isRight: true, isRushSure: false }, hitDigit: 3 });
    if (mode !== "ST" || rRem !== 163 || totalBall !== 1400) throw new Error("Eva ST hit failed");

    currentMachine = "rezero"; M = MACHINES.rezero; SPECS = M.specs;
    hChart = new Chart(); historyData = []; historyLabels = [];
    mode = "通常"; lcdCount = 40; totalBall = 0; currentRot = 40;
    initialHitCount = 1; activeInitialHitNumber = 1; firstHitRot = 40;
    Math.random = () => 0.9;
    await M.resolveHit({ eff: { isRight: false, saibare: false }, hitDigit: 2 });
    if (historyData.length !== 1 || historyData[0] !== 40 || historyLabels[0] !== "1 - 40回転（通常）") throw new Error("ReZero normal history failed");

    currentMachine = "rezero"; M = MACHINES.rezero; SPECS = M.specs; currentRot = 145;
    if (normalRotationAfterModeEnd("ST") !== 0) throw new Error("ReZero RUSH rotation correction failed");
    currentRot = 190;
    if (normalRotationAfterModeEnd("ST") !== 45) throw new Error("ReZero RUSH overflow rotation correction failed");

    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs; currentRot = 163;
    if (normalRotationAfterModeEnd("ST") !== 0) throw new Error("Eva ST rotation correction failed");
    currentRot = 100;
    if (normalRotationAfterModeEnd("時短") !== 100) throw new Error("Eva time-short rotation correction failed");

    currentMachine = "rezero"; M = MACHINES.rezero; SPECS = M.specs;

    mode = "通常"; lcdCount = 88; totalBall = 0; currentRot = 88;
    initialHitCount = 2; activeInitialHitNumber = 2; firstHitRot = 88;
    const values = [0.1, 0.9]; Math.random = () => values.shift() ?? 0.9;
    await M.resolveHit({ eff: { isRight: false, saibare: true }, hitDigit: 5 });
    if (mode !== "ST" || rRem !== 145 || currentRot !== 0 || totalBall !== 3000) throw new Error("ReZero normal hit failed");

    mode = "ST"; lcdCount = 30; totalBall = 0; currentRot = 30; rushStyle = "強欲RUSH";
    Math.random = () => 0.5;
    await M.resolveHit({ eff: { isRight: true, saibare: false, bonusType: 1500, displayName: "Re:ゼロBONUS", trust: 100 }, hitDigit: 3 });
    if (mode !== "ST" || rRem !== 145 || currentRot !== 0 || totalBall !== 1500) throw new Error("ReZero RUSH hit failed");

    mode = "ST"; lcdCount = 8; totalBall = 0; currentRot = 8; rushStyle = "強欲RUSH";
    timeoutCalls.length = 0;
    const freezeValues = [0.1, 0.1, 0.9]; Math.random = () => freezeValues.shift() ?? 0.9;
    await M.resolveHit({ eff: { isRight: true, saibare: false, bonusType: 3000, displayName: "超強欲3000BONUS", trust: 100 }, hitDigit: 7 });
    if (totalBall !== 6000) throw new Error("ReZero freeze bonus total failed");
    const freezeLogs = document.getElementById("log").innerHTML.split("超強欲フリーズ！！ +1500上乗せ！").length - 1;
    if (freezeLogs !== 2) throw new Error("ReZero freeze bonus log count failed");
    const animationWaits = timeoutCalls.filter((delay) => delay === FREEZE_BONUS_ANIMATION_MS).length;
    if (animationWaits !== 3) throw new Error("ReZero bonus and freeze wait count failed");
    if (!timeoutCalls.includes(POST_BONUS_HOLD_MS)) throw new Error("Post bonus hold missing");
  `);

  console.log(
    JSON.stringify(
      {
        baseOdds: simulation.spins / simulation.hitsSeen,
        trust: measuredTrust,
        saibareTrust,
        hitPaths: 4,
        rushDistribution,
        freezeLoops: 2,
        postBonusHoldMs: 500,
        coloredHolds: simulation.coloredHolds,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
