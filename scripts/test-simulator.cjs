const fs = require("fs");
const vm = require("vm");

const elements = new Map();
function createElement() {
  return {
    classList: { add() {}, remove() {}, toggle() {} },
    style: {},
    innerText: "",
    innerHTML: "",
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
  setTimeout(callback) {
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
    mode = "通常"; lcdCount = 88; totalBall = 0; currentRot = 88;
    const values = [0.1, 0.9]; Math.random = () => values.shift() ?? 0.9;
    await M.resolveHit({ eff: { isRight: false, saibare: true }, hitDigit: 5 });
    if (mode !== "ST" || rRem !== 145 || currentRot !== 0 || totalBall !== 3000) throw new Error("ReZero normal hit failed");

    mode = "ST"; lcdCount = 30; totalBall = 0; currentRot = 30; rushStyle = "強欲RUSH";
    Math.random = () => 0.5;
    await M.resolveHit({ eff: { isRight: true, saibare: false }, hitDigit: 3 });
    if (mode !== "ST" || rRem !== 145 || currentRot !== 0 || totalBall !== 1500) throw new Error("ReZero RUSH hit failed");
  `);

  console.log(
    JSON.stringify(
      {
        baseOdds: simulation.spins / simulation.hitsSeen,
        trust: measuredTrust,
        saibareTrust,
        hitPaths: 4,
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
