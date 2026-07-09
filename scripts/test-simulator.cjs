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

const source = fs.readFileSync("src/simulator/js/script.js", "utf8");
vm.runInContext(source, context);

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
    checkBands("EVA 通常/時短 保留色軸", EVA_AXIS_HOLD_N, 65536, 205);
    checkBands("EVA 通常/時短 背景予告軸", EVA_AXIS_BG_N, 65536, 205);
    checkBands("EVA 通常/時短 先読み軸(<=400回転)", EVA_AXIS_PRECURSOR_N_LOW, 65536, 205);
    checkBands("EVA 通常/時短 先読み軸(>400回転)", EVA_AXIS_PRECURSOR_N_HIGH, 65536, 205);
    checkBands("EVA 通常/時短 レバブル軸", EVA_AXIS_LEVER_N, 65536, 205);
    checkBands("EVA 通常/時短 リーチ軸", EVA_AXIS_REACH_N, 65536, 205);
    checkBands("EVA ST 保留色軸", EVA_AXIS_HOLD_S, 65536, 659);
    checkBands("EVA ST 背景予告軸", EVA_AXIS_BG_S, 65536, 659);
    checkBands("EVA ST 先読み軸", EVA_AXIS_PRECURSOR_S, 65536, 659);
    checkBands("EVA ST レバブル軸", EVA_AXIS_LEVER_S, 65536, 659);
    checkBands("EVA ST リーチ軸", EVA_AXIS_REACH_S, 65536, 659);
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
    throw new Error(`ReZero colored holds remained: ${simulation.coloredHolds}`);
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

  // EVA機 通常時：軸独立抽選(5軸)のモンテカルロ検証（currentRot<=400固定＝群予告は出現しない領域）
  const evaSimulation = await run(`
    currentMachine = "eva";
    M = MACHINES.eva;
    SPECS = M.specs;
    mode = "通常";
    currentRot = 0;
    Math.random = makeRandom(20260704);
    let hitsSeen = 0;
    let leverHits = 0;
    const axisCounts = {};
    const spins = 6000000;
    for (let i = 0; i < spins; i++) {
      const job = createJob(false);
      if (job.isHit) hitsSeen++;
      const hasLever = job.name.includes("白レバブル") || job.name.includes("赤レバブル") || job.name.includes("虹レバブル");
      if (hasLever && job.isHit) leverHits++;
      for (const label of job.name) {
        const row = axisCounts[label] || (axisCounts[label] = { hits: 0, total: 0 });
        row.total++;
        if (job.isHit) row.hits++;
      }
    }
    return { spins, hitsSeen, axisCounts, leverHits };
  `);
  assertClose(
    "EVA 通常時 base odds",
    evaSimulation.spins / evaSimulation.hitsSeen,
    65536 / 205,
    5,
  );
  if (evaSimulation.axisCounts["群予告"]) {
    throw new Error("群予告 appeared while currentRot<=400 (gating broken)");
  }
  const evaExpectedTrust = {
    赤保留: 0.9,
    緑保留: 0.2,
    青保留: 0.05,
    レイ背景: 0.85,
    プレミア背景: 1.0,
    渚カヲル: 1.0,
    カウントダウン: 0.65,
    白レバブル: 0.9,
    赤レバブル: 0.98,
    虹レバブル: 1.0,
    全回転リーチ: 1.0,
    vsアルミサエル: 0.568,
    vsサハクィエル: 0.652,
    最終号機リーチ: 0.705,
  };
  // 「レバブル保留」は独立軸を持たず表示上の格上げのみのため、赤/緑/青保留・白/赤/虹レバブルは
  // 一切歪まず単独抽選時の理論値と厳密に一致するはず（許容誤差は他と同じ0.03のまま）
  for (const [name, expected] of Object.entries(evaExpectedTrust)) {
    const row = evaSimulation.axisCounts[name];
    if (!row) throw new Error(`EVA ${name}: no samples`);
    const measured = row.hits / row.total;
    assertClose(`EVA ${name} trust`, measured, expected, 0.03);
  }
  // レバブルは全大当りの約66.7%に絡む
  assertClose(
    "EVA レバブル 大当り絡み率",
    evaSimulation.leverHits / evaSimulation.hitsSeen,
    0.667,
    0.02,
  );
  // 出現数は白＞赤＞虹の順
  const leverOrder = [
    evaSimulation.axisCounts["白レバブル"].total,
    evaSimulation.axisCounts["赤レバブル"].total,
    evaSimulation.axisCounts["虹レバブル"].total,
  ];
  if (!(leverOrder[0] > leverOrder[1] && leverOrder[1] > leverOrder[2])) {
    throw new Error(`EVA レバブル出現順が白>赤>虹になっていない: ${leverOrder}`);
  }

  // 群予告はcurrentRot>400でのみ出現し、信頼度は約75%
  const evaGroupSimulation = await run(`
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs; mode = "通常";
    currentRot = 500;
    Math.random = makeRandom(20260705);
    let hits = 0, total = 0, hitsSeen = 0;
    const spins = 1000000;
    for (let i = 0; i < spins; i++) {
      const job = createJob(false);
      if (job.isHit) hitsSeen++;
      if (job.name.includes("群予告")) {
        total++;
        if (job.isHit) hits++;
      }
    }
    return { hits, total, hitsSeen };
  `);
  if (evaGroupSimulation.total === 0) throw new Error("群予告 did not appear when currentRot>400");
  assertClose(
    "EVA 群予告 trust",
    evaGroupSimulation.hits / evaGroupSimulation.total,
    0.75,
    0.03,
  );

  // holdType/currentViewが保留色軸の結果とそのまま一致することを確認
  await run(`
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs; mode = "通常"; currentRot = 0;
    Math.random = () => 0.0001; // 保留色軸の先頭(赤保留)を確実に引く
    for (let i = 0; i < 50; i++) {
      const job = createJob(false);
      if (job.name.includes("赤保留")) {
        if (job.holdType !== "red" || job.currentView !== "red") throw new Error("EVA hold currentView mismatch");
        break;
      }
    }
  `);

  // 「レバブル保留」が出た場合はレバブルが確定発生する
  await run(`
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs; mode = "通常"; currentRot = 0;
    Math.random = makeRandom(20260706);
    let checked = 0;
    for (let i = 0; i < 200000 && checked < 100; i++) {
      const job = createJob(false);
      if (job.name.includes("レバブル保留")) {
        const hasLever = job.name.includes("白レバブル") || job.name.includes("赤レバブル") || job.name.includes("虹レバブル");
        if (!hasLever) throw new Error("レバブル保留なのにレバブルが発生していない: " + job.name.join("+"));
        checked++;
      }
    }
    if (checked === 0) throw new Error("レバブル保留のサンプルが得られなかった");
  `);

  // 「レバブル保留」表示時の信頼度は常にレバブル自身の信頼度と一致する（独自の信頼度は持たない）
  await run(`
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs; mode = "通常"; currentRot = 0;
    Math.random = makeRandom(20260708);
    const leverTrust = { 白レバブル: 90 / (90 + 10) * 100, 赤レバブル: 40 / (40 + 1) * 100, 虹レバブル: 100 };
    let checked = 0;
    for (let i = 0; i < 400000 && checked < 100; i++) {
      const job = createJob(false);
      if (!job.name.includes("レバブル保留")) continue;
      // 他の軸(背景/先読み/リーチ)が同時発火していない、レバブル保留+レバブル色のみの純粋なケースだけを比較する
      if (job.name.length !== 2) continue;
      const leverName = Object.keys(leverTrust).find((n) => job.name.includes(n));
      if (!leverName) throw new Error("レバブル保留なのに対応するレバブル色が見つからない: " + job.name.join("+"));
      if (Math.abs(job.trust - leverTrust[leverName]) > 0.01) {
        throw new Error(\`レバブル保留の表示信頼度(\${job.trust})がレバブル自身の信頼度(\${leverTrust[leverName]})と不一致\`);
      }
      checked++;
    }
    if (checked === 0) throw new Error("レバブル保留のサンプルが得られなかった");
  `);

  // 液晶の揺れ(vibe)はレバブル発生時のみ
  await run(`
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs; mode = "通常"; currentRot = 0;
    Math.random = makeRandom(20260707);
    for (let i = 0; i < 200000; i++) {
      const job = createJob(false);
      const hasLever = job.name.includes("白レバブル") || job.name.includes("赤レバブル") || job.name.includes("虹レバブル");
      if (job.vibe && !hasLever) throw new Error("レバブル以外でvibeが発生: " + job.name.join("+"));
      if (!job.vibe && hasLever) throw new Error("レバブル発生時にvibeが立っていない: " + job.name.join("+"));
    }
    currentMachine = "rezero";
    M = MACHINES.rezero;
    SPECS = M.specs;
  `);

  // EVA通常時：プレミア演出(isRushSure、常にST420)も含めた全hitで
  // 全回転3%・ST突入56%・時短41%になっていることを検証する
  const evaOutcome = await run(`
    currentMachine = "eva"; M = MACHINES.eva; SPECS = M.specs; mode = "通常"; currentRot = 0;
    Math.random = makeRandom(20260709);
    const outcome = { zenkaiten: 0, st420: 0, jitan420: 0 };
    let hits = 0;
    for (let i = 0; i < 4000000; i++) {
      const job = createJob(false);
      if (!job.isHit) continue;
      hits++;
      if (job.isRushSure) { outcome.st420++; continue; }
      let rand = Math.random() * 100;
      let hitDigit;
      if (rand < 3.332) hitDigit = 7;
      else if (rand < 60.248) hitDigit = [2, 4, 6, 8][Math.floor(Math.random() * 4)];
      else hitDigit = [1, 3, 5, 9][Math.floor(Math.random() * 4)];
      if (hitDigit === 7) { outcome.zenkaiten++; continue; }
      if (hitDigit % 2 !== 0) { outcome.st420++; continue; }
      if (Math.random() < 0.2) outcome.st420++;
      else outcome.jitan420++;
    }
    return { hits, outcome };
  `);
  assertClose(
    "EVA 全回転 比率(プレミア込み全hit)",
    evaOutcome.outcome.zenkaiten / evaOutcome.hits,
    0.03,
    0.005,
  );
  assertClose(
    "EVA ST突入(420) 比率(プレミア込み全hit)",
    evaOutcome.outcome.st420 / evaOutcome.hits,
    0.56,
    0.01,
  );
  assertClose(
    "EVA 時短 比率(プレミア込み全hit)",
    evaOutcome.outcome.jitan420 / evaOutcome.hits,
    0.41,
    0.01,
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
    await M.resolveHit({ eff: { isRight: false, isRushSure: false }, hitDigit: 2 });
    if (currentRot !== 0 || totalBall !== 420) throw new Error("Eva normal hit failed");

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
