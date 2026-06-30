const fs = require("fs");
const vm = require("vm");

const elements = new Map();
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
  const simulation = await run(`
    currentMachine = "rezero";
    M = MACHINES.rezero;
    SPECS = M.specs;
    mode = "通常";
    optSaibare = false;
    Math.random = nativeRandom;
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
    349.9,
    9,
  );
  if (simulation.coloredHolds !== 0) {
    throw new Error(`ReZero colored holds remained: ${simulation.coloredHolds}`);
  }

  const expectedTrust = {
    ベアトリスランプ: 0.92,
    強欲SP: 0.78,
    死に戻りSP: 0.52,
    俺を選べSP: 0.26,
    氷結の絆SP: 0.18,
    スバルATTACK: 0.1,
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
    Math.random = nativeRandom;
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

  const rushDistribution = await run(`
    mode = "ST";
    rushStyle = "強欲RUSH";
    Math.random = nativeRandom;
    const counts = { 300: 0, 1500: 0, 3000: 0 };
    const spins = 1000000;
    for (let i = 0; i < spins; i++) {
      const effect = M.createJobHits(mode);
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
    const strong3000 = M.createJobHits("ST");
    if (strong3000.bonusType !== 3000 || !strong3000.name.includes("超強欲3000BONUS")) throw new Error("Strong RUSH 3000 mapping failed");
    Math.random = () => 0.5;
    const strong1500 = M.createJobHits("ST");
    if (strong1500.bonusType !== 1500 || !strong1500.name.includes("Re:ゼロBONUS")) throw new Error("Strong RUSH 1500 mapping failed");
    Math.random = () => 0.9;
    const strong300 = M.createJobHits("ST");
    if (strong300.bonusType !== 300 || !strong300.name.includes("BONUS")) throw new Error("Strong RUSH 300 mapping failed");

    rushStyle = "ドキドキRUSH";
    Math.random = () => 0.1;
    const doki3000 = M.createJobHits("ST");
    if (doki3000.bonusType !== 3000 || !doki3000.name.includes("ドナぷる")) throw new Error("Doki RUSH 3000 mapping failed");
    Math.random = () => 0.5;
    const doki1500 = M.createJobHits("ST");
    if (doki1500.bonusType !== 1500 || !doki1500.name.includes("落ちブル")) throw new Error("Doki RUSH 1500 mapping failed");
    Math.random = () => 0.9;
    const doki300 = M.createJobHits("ST");
    if (doki300.bonusType !== 300 || !doki300.name.includes("エミリア告知")) throw new Error("Doki RUSH 300 mapping failed");
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
    if (historyData.length !== 1 || historyData[0] !== 40 || historyLabels[0] !== "1回目(通常)") throw new Error("ReZero normal history failed");

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
