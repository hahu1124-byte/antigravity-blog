// 完全オートの 1 ゲームあたりの計算時間（planAuto の bestScoreFrom と、各リールの "best" 探索）を測る
const base = "file:///h:/gravity/projects/antigravity-blog/src/game/meoshi/";
const { FRAMES, ROLES, payOf } = await import(base + "reel-data.js");
const { decideStop, judge, prepare, mod } = await import(base + "stop-control.js");

const cases = [
  [["replay"], "normal", 3],
  [["fuurin"], "normal", 3],
  [["kori"], "normal", 3],
  [[], "normal", 3],
  [["bigDon", "pull"], "normal", 1],
];
const HASAMI = [0, 2, 1];

for (const [allowed, m, bet] of cases) prepare(allowed, m, bet);

function score(stops, m, bet) {
  let v = 0;
  for (const w of judge(stops, m, bet)) {
    const role = ROLES[w.role];
    v += role.kind === "bonus" ? 100000 : role.kind === "replay" ? 300 : payOf(w.role, bet) * 100;
  }
  return v;
}
function bestFrom(stops, order, allowed, m, bet) {
  const rest = order.filter((r) => stops[r] === null);
  if (!rest.length) return score(stops, m, bet);
  const r = rest[0];
  let best = -Infinity;
  for (let p = 0; p < FRAMES; p++) {
    const next = stops.slice();
    next[r] = decideStop(stops, r, p, allowed, m, bet).mid;
    best = Math.max(best, bestFrom(next, order, allowed, m, bet));
  }
  return best;
}
function oneGame(allowed, m, bet) {
  const best = bestFrom([null, null, null], HASAMI, allowed, m, bet);
  let stops = [null, null, null];
  for (const r of HASAMI) {
    const p0 = Math.floor(Math.random() * FRAMES);
    let chosen = p0;
    for (let d = 0; d < FRAMES; d++) {
      const next = stops.slice();
      next[r] = decideStop(stops, r, mod(p0 + d), allowed, m, bet).mid;
      if (bestFrom(next, HASAMI, allowed, m, bet) >= best) {
        chosen = p0 + d;
        break;
      }
    }
    stops[r] = decideStop(stops, r, mod(chosen), allowed, m, bet).mid;
  }
}
for (const [allowed, m, bet] of cases) {
  for (let i = 0; i < 20; i++) oneGame(allowed, m, bet); // 温め
  const n = 300;
  const t0 = performance.now();
  for (let i = 0; i < n; i++) oneGame(allowed, m, bet);
  const ms = (performance.now() - t0) / n;
  console.log(`${JSON.stringify(allowed)} bet${bet}: 1 ゲーム ${ms.toFixed(2)}ms`);
}
