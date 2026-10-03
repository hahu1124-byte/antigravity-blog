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
});

// index.html と同じ順（EVA の演出データ → 抽選エンジン → 本体）で読み込む
for (const file of ["eva-effects.js", "eva-engine.js", "script.js"]) {
  const source = fs.readFileSync(`src/simulator/js/${file}`, "utf8");
  vm.runInContext(source, context, { filename: file });
}

async function run(code) {
  return vm.runInContext(`(async () => { ${code} })()`, context);
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
  // EVA機：当否と当り種別 → リーチ → 予告の層（層内排他）の抽選と、事後確率による信頼度表示
  // ============================================================
  const evaStartedAt = Date.now();
  console.log(`[EVA] 開始 ${new Date(evaStartedAt).toISOString()}`);

  // 決定論の検算：本数の合計が 2^20・当り本数と厳密に一致すること
  const evaIntegrity = await run(`
    const problems = [];
    function checkTables(label, T, expectHit) {
      const bit = T.classTotals.reduce((s, x) => s + x, 0);
      if (bit !== 1048576) problems.push(label + ": Σ本数 " + bit);
      const hit = T.classes.filter((c) => c.hit).reduce((s, c) => s + c.n, 0);
      if (hit !== expectHit) problems.push(label + ": 当り本数 " + hit);
      for (const L of T.free) {
        for (const c of T.classes) {
          const row = L.counts[c.id];
          const sum = row.reduce((a, b) => a + b, 0);
          if (sum !== c.n) problems.push(label + " " + L.label + " " + c.id + ": " + sum + " !== " + c.n);
          if (row.some((x) => x < 0)) problems.push(label + " " + L.label + " " + c.id + ": 負の本数");
        }
      }
      const reach = T.free.find((l) => l.key === T.reachKey);
      for (const L of T.linked) {
        for (const c of T.classes) {
          L.counts[c.id].forEach((row, r) => {
            const sum = row.reduce((a, b) => a + b, 0);
            if (sum !== reach.counts[c.id][r]) problems.push(label + " " + L.label + " " + c.id + " " + reach.states[r].name + ": " + sum);
            if (row.some((x) => x < 0)) problems.push(label + " " + L.label + ": 負の本数");
          });
        }
      }
    }
    checkTables("通常(400以下)", EVA_T_N_LOW, 3280);
    checkTables("通常(401以上)", EVA_T_N_HIGH, 3280);
    checkTables("ST", EVA_T_S, 10544);
    return problems;
  `);
  if (evaIntegrity.length)
    throw new Error("EVA テーブル: " + evaIntegrity.join(" / "));

  // 決定論の検算：整数テーブルから出る各演出の信頼度が宣言値（実機値）どおりか。
  // あわせて「ハズレで何回転に1回出るか」の一覧を出す（出現頻度の推定値を調整するときの目安）
  const evaDeclared = await run(`
    const rows = [];
    function walk(label, T) {
      const missId = T.classes.find((c) => !c.hit).id;
      const hitIds = T.classes.filter((c) => c.hit).map((c) => c.id);
      const layers = [...T.free.map((L) => ({ L, linked: false })), ...T.linked.map((L) => ({ L, linked: true }))];
      for (const { L, linked } of layers) {
        L.states.forEach((s, i) => {
          if (s.id === "none") return;
          const sumOf = (cid) => linked ? L.counts[cid].reduce((a, row) => a + row[i], 0) : L.counts[cid][i];
          const hit = hitIds.reduce((a, cid) => a + sumOf(cid), 0);
          const miss = sumOf(missId);
          rows.push({
            table: label, layer: L.label, name: s.name,
            declaredTrust: s.trust, declaredHit: s.hit, declaredMiss: s.miss,
            hit, miss, trust: hit + miss ? (hit / (hit + miss)) * 100 : 0,
            missEvery: miss ? Math.round(1048576 / miss) : null,
            hitShare: (hit / T.classes.filter((c) => c.hit).reduce((a, c) => a + c.n, 0)) * 100,
          });
        });
      }
    }
    walk("通常(401以上)", EVA_T_N_HIGH);
    walk("ST", EVA_T_S);
    return rows;
  `);
  for (const row of evaDeclared) {
    const label = `EVA ${row.table} ${row.name}`;
    if (row.hit === 0) throw new Error(`${label}: 当り本数が 0`);
    if (row.declaredTrust !== undefined) {
      if (row.declaredTrust >= 100) {
        if (row.miss !== 0)
          throw new Error(`${label}: 濃厚なのにハズレが ${row.miss} 本`);
      } else {
        const tolerance = Math.max(0.2, row.declaredTrust * 0.02);
        assertClose(
          `${label} 信頼度(テーブル)`,
          row.trust,
          row.declaredTrust,
          tolerance,
        );
      }
    } else if (row.hit !== row.declaredHit || row.miss !== row.declaredMiss) {
      throw new Error(
        `${label}: 本数 ${row.hit}/${row.miss} が宣言 ${row.declaredHit}/${row.declaredMiss} と違う`,
      );
    }
  }
  console.log(
    "[EVA] 演出ごとの信頼度と出現頻度（通常は 401 回転以上のテーブル）",
  );
  for (const row of evaDeclared) {
    console.log(
      `  ${row.table} ${row.layer} ${row.name}: 信頼度 ${row.trust.toFixed(1)}%` +
        `（宣言 ${row.declaredTrust !== undefined ? row.declaredTrust + "%" : "本数指定"}）` +
        ` 当りの ${row.hitShare.toFixed(1)}% / ハズレ ${row.missEvery ? "1/" + row.missEvery + " 回転" : "なし"}`,
    );
  }

  // 決定論の検算：当り種別の比率と、全回転リーチ＝10R確変
  const evaKinds = await run(`
    const T = EVA_T_N_LOW;
    const n = Object.fromEntries(T.classes.map((c) => [c.id, c.n]));
    const reach = T.free.find((l) => l.key === T.reachKey);
    const zi = reach.states.findIndex((s) => s.id === "zenkaiten");
    return {
      r10: n.r10 / 3280, k3: n.k3 / 3280, t3: n.t3 / 3280,
      zenkaitenR10: reach.counts.r10[zi], zenkaitenOther: reach.counts.k3[zi] + reach.counts.t3[zi] + reach.counts.miss[zi],
      r10Other: reach.counts.r10.reduce((a, b) => a + b, 0) - reach.counts.r10[zi],
    };
  `);
  assertClose("EVA 10R確変 比率", evaKinds.r10, 0.03, 0.001);
  assertClose("EVA 3R確変 比率", evaKinds.k3, 0.56, 0.001);
  assertClose("EVA 3R通常 比率", evaKinds.t3, 0.41, 0.001);
  if (
    evaKinds.zenkaitenR10 !== 98 ||
    evaKinds.zenkaitenOther !== 0 ||
    evaKinds.r10Other !== 0
  ) {
    throw new Error(
      `EVA 全回転リーチと 10R確変が一致しない: ${JSON.stringify(evaKinds)}`,
    );
  }

  // モンテカルロ：通常時（400 回転以下・401 回転以上）
  const evaMc = await run(`
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs; mode = "通常";
    const out = {};
    for (const [label, rot, spins, seed] of [["low", 0, 6000000, 20261003], ["high", 500, 6000000, 20261004]]) {
      currentRot = rot;
      Math.random = makeRandom(seed);
      const r = { spins, hits: 0, kinds: { r10: 0, k3: 0, t3: 0 }, bands: {}, alone: {}, names: {},
        leverHits: 0, leverMismatch: 0, vibeMismatch: 0, zenkaitenNotR10: 0, shownMismatch: 0 };
      for (let i = 0; i < spins; i++) {
        const job = createJob(false);
        if (job.isHit) { r.hits++; r.kinds[job.kind]++; }
        const hasLever = job.name.includes("白レバブル") || job.name.includes("赤レバブル") || job.name.includes("虹レバブル");
        if (hasLever && job.isHit) r.leverHits++;
        if (job.vibe !== hasLever) r.vibeMismatch++;
        const leverHold = job.name.includes("レバブル保留");
        const colorHold = ["red", "green", "blue"].includes(job.holdType);
        if (leverHold !== (hasLever && !colorHold)) r.leverMismatch++;
        if (job.reachId === "zenkaiten" && job.kind !== "r10") r.zenkaitenNotR10++;
        for (const nm of job.name) {
          const row = r.names[nm] || (r.names[nm] = { n: 0, hit: 0 });
          row.n++; if (job.isHit) row.hit++;
        }
        // 抽選の中身の整合：その回転の本当の当りやすさ（事後確率）が実測と一致する
        if (job.name.length) {
          const b = Math.min(Math.floor(job.posterior / 10) * 10, 100);
          const row = r.bands[b] || (r.bands[b] = { n: 0, hit: 0, sum: 0 });
          row.n++; row.sum += job.posterior; if (job.isHit) row.hit++;
        }
        // 表示は出た演出の宣言値の最大（最終号機リーチだけなら 70.5%）
        if (job.name.length === 1 && job.name[0] === "最終号機リーチ" && job.trust !== 70.5) r.shownMismatch++;
        if (job.name.length && job.sure && job.trust !== 100) r.shownMismatch++;
        // 当該レバブル以外の予告が何も付かない SP リーチ（レバブルは問わない）
        const others = job.name.filter((nm) => !/レバブル/.test(nm));
        if (others.length === 1 && job.tenpai && job.reachId !== "normal") {
          const row = r.alone[job.reachId] || (r.alone[job.reachId] = { n: 0, hit: 0, noLeverN: 0, noLeverHit: 0 });
          row.n++; if (job.isHit) row.hit++;
          if (!hasLever) { row.noLeverN++; if (job.isHit) row.noLeverHit++; }
        }
      }
      out[label] = r;
    }
    return out;
  `);
  const reachTrust = {
    final: 70.5,
    sahaquiel: 65.2,
    armisael: 56.8,
    sho: 34.8,
    zero: 10.2,
    ni: 7.2,
    synchro: 3.1,
  };
  for (const [label, r] of Object.entries(evaMc)) {
    assertClose(`EVA ${label} base odds`, r.spins / r.hits, 1048576 / 3280, 6);
    if (r.vibeMismatch)
      throw new Error(
        `EVA ${label}: 揺れとレバブルが食い違う ${r.vibeMismatch} 件`,
      );
    if (r.leverMismatch)
      throw new Error(
        `EVA ${label}: レバブル保留の表示が食い違う ${r.leverMismatch} 件`,
      );
    if (r.zenkaitenNotR10)
      throw new Error(
        `EVA ${label}: 10R でない全回転リーチ ${r.zenkaitenNotR10} 件`,
      );
    assertClose(
      `EVA ${label} 3R確変 比率(実測)`,
      r.kinds.k3 / r.hits,
      0.56,
      0.02,
    );
    assertClose(
      `EVA ${label} 3R通常 比率(実測)`,
      r.kinds.t3 / r.hits,
      0.41,
      0.02,
    );
    // 当該レバブル（シミュ専用）は旧来どおり：全大当りの約66.7%に絡み、出現数は白＞赤＞虹
    assertClose(
      `EVA ${label} レバブル 大当り絡み率`,
      r.leverHits / r.hits,
      0.667,
      0.02,
    );
    const order = ["白レバブル", "赤レバブル", "虹レバブル"].map(
      (nm) => r.names[nm].n,
    );
    if (!(order[0] > order[1] && order[1] > order[2])) {
      throw new Error(
        `EVA ${label} レバブル出現順が白>赤>虹になっていない: ${order}`,
      );
    }
    // 表示信頼度（事後確率）と実測当選率が帯ごとに一致する
    console.log(`[EVA] ${label}: 表示の帯ごとの実測`);
    // 40〜89% の帯は 1 つずつだとサンプルが少ないので、まとめても判定する
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
        assertClose(`EVA ${label} 帯${band}% 表示と実測`, actual, shown, 3);
      if (band >= 40 && band < 90) {
        mid.n += row.n;
        mid.hit += row.hit;
        mid.sum += row.sum;
      }
    }
    if (mid.n < 1000)
      throw new Error(`EVA ${label}: 40〜89% 帯のサンプル不足 ${mid.n}`);
    console.log(
      `  帯 40〜89% まとめ n=${mid.n} 表示平均 ${(mid.sum / mid.n).toFixed(2)}% → 実測 ${((mid.hit / mid.n) * 100).toFixed(2)}%`,
    );
    assertClose(
      `EVA ${label} 帯40〜89% 表示と実測`,
      (mid.hit / mid.n) * 100,
      mid.sum / mid.n,
      3,
    );
    // 単独 SP リーチが公表値の 6 割以上（旧方式は アルミサエル 9% / 56.8% だった）。
    // 「予告が付かない」こと自体の倍率はどのリーチでも同じ（約0.55）なので、
    // 体感に効く公表 30% 以上のリーチだけを基準にし、低いリーチは値を出すだけにする
    console.log(
      `[EVA] ${label}: 他の予告が付かない SP リーチ（レバブルは問わない／レバブルも無し）`,
    );
    for (const [id, row] of Object.entries(r.alone)) {
      const actual = (row.hit / row.n) * 100;
      const noLever = row.noLeverN
        ? (row.noLeverHit / row.noLeverN) * 100
        : NaN;
      console.log(
        `  ${id} n=${row.n} 実測 ${actual.toFixed(1)}%（公表 ${reachTrust[id] ?? "-"}%）／レバブル無し ${noLever.toFixed(1)}%`,
      );
      if (
        reachTrust[id] >= 30 &&
        row.n >= 500 &&
        actual < reachTrust[id] * 0.6
      ) {
        throw new Error(
          `EVA ${label} ${id} 単独の実測 ${actual.toFixed(1)}% が公表値 ${reachTrust[id]}% の 6 割未満`,
        );
      }
    }
  }
  for (const [label, r] of Object.entries(evaMc)) {
    if (r.shownMismatch)
      throw new Error(
        `EVA ${label}: 表示の信頼度が宣言値の最大と違う ${r.shownMismatch} 件`,
      );
  }

  // ST（IMPACT MODE シンジモード）：当り確率
  const evaSt = await run(`
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs; mode = "ST"; currentRot = 0;
    Math.random = makeRandom(20261006);
    const spins = 3000000;
    let hits = 0, sure = 0, sureMiss = 0, leverHits = 0, leverMiss = 0;
    for (let i = 0; i < spins; i++) {
      const job = createJob(true);
      if (job.isHit) hits++;
      if (job.sure) { sure++; if (!job.isHit) sureMiss++; }
      if (job.vibe) { if (job.isHit) leverHits++; else leverMiss++; }
    }
    return { spins, hits, sure, sureMiss, leverHits, leverMiss };
  `);
  assertClose("EVA ST odds", evaSt.spins / evaSt.hits, 1048576 / 10544, 2);
  if (evaSt.sureMiss)
    throw new Error(`EVA ST: 濃厚なのにハズレ ${evaSt.sureMiss} 件`);
  // ST 中の当該レバブルはどれも当り確定で、出るのは当りの約2割
  if (evaSt.leverMiss)
    throw new Error(`EVA ST: 当該レバブルでハズレ ${evaSt.leverMiss} 件`);
  assertClose(
    "EVA ST レバブル 当り絡み率",
    evaSt.leverHits / evaSt.hits,
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

  // ST 中に入賞した保留を通常時に消化するときは通常の確率で抽選し直す（残保留の引き戻し 約1.25%）
  await run(`
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs; currentRot = 0;
    Math.random = makeRandom(20261005);
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
