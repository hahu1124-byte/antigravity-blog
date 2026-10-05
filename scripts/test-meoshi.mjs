// 目押しチャレンジの停止制御の総当たり試験（全フラグ × 押し順 6 × 押し位置 21³、数秒）
// 使い方: node scripts/test-meoshi.mjs（NG が 1 件でもあれば終了コード 1）
const base = new URL("../src/game/meoshi/", import.meta.url).href;
const { REELS, FRAMES, ROLES } = await import(base + "reel-data.js");
const { decideStop, judge, symAt, pushOffsetMs, pushedFrame } = await import(
  base + "stop-control.js"
);

const t0 = performance.now();
let fail = 0;
const ng = (msg) => {
  fail++;
  if (fail <= 20) console.log("NG", msg);
};

// 1. 配列の検算
for (let r = 0; r < 3; r++)
  if (REELS[r].length !== FRAMES) ng(`リール${r} の長さ ${REELS[r].length}`);
if (REELS[0][18] !== "D" || REELS[0][17] === "D" || REELS[0][19] === "D")
  ng("左 19 番が単独の女の子（元のドン）でない");
// 取りこぼしのない役は各リールで図柄の間隔が 5 コマ以内（すべり 4 で中段に届く）
const gapCheck = (name, sets) => {
  for (let r = 0; r < 3; r++) {
    const pos = [...REELS[r]]
      .map((s, i) => (sets[r].includes(s) ? i : -1))
      .filter((i) => i >= 0);
    let maxGap = 0;
    for (let i = 0; i < pos.length; i++) {
      const next = i + 1 < pos.length ? pos[i + 1] : pos[0] + FRAMES;
      maxGap = Math.max(maxGap, next - pos[i]);
    }
    console.log(`  ${name} リール${r}: ${pos.length} 個・最大間隔 ${maxGap}`);
  }
};
gapCheck("リプレイ", ROLES.replay.reels);
gapCheck("風鈴", ROLES.fuurin.reels);

// 2. ずれの定義
const w = pushOffsetMs(9.5, 10);
if (Math.abs(w) > 1e-6) ng(`窓の真ん中のずれが 0 でない: ${w}`);
if (pushedFrame(9.0) !== 9 || pushedFrame(9.01) !== 10) ng("押したコマの計算");

// 3. 全フラグ × 押し順 × 押し位置
const ORDERS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];
const CASES = [
  { allowed: [], mode: "normal" },
  { allowed: ["replay"], mode: "normal", must: true },
  { allowed: ["fuurin"], mode: "normal", must: true },
  { allowed: ["kori"], mode: "normal" },
  { allowed: ["cherry"], mode: "normal" },
  { allowed: ["big"], mode: "normal", bonus: true },
  { allowed: ["reg"], mode: "normal", bonus: true },
  { allowed: ["big", "replay"], mode: "normal", must: true },
  { allowed: ["big", "fuurin"], mode: "normal", must: true },
  { allowed: ["big", "kori"], mode: "normal" },
  { allowed: ["big", "cherry"], mode: "normal" },
  { allowed: ["reg", "replay"], mode: "normal", must: true },
  { allowed: ["reg", "fuurin"], mode: "normal", must: true },
  { allowed: ["reg", "kori"], mode: "normal" },
  { allowed: ["reg", "cherry"], mode: "normal" },
  { allowed: ["bonusFuurin"], mode: "bonus", must: true },
  { allowed: [], mode: "bonus" },
];
for (const c of CASES) {
  let total = 0;
  let hit = 0;
  let bonusHit = 0;
  let maxSlip = 0;
  let altHit = 0;
  const byOrder = [];
  for (const order of ORDERS) {
    let oTotal = 0;
    let oHit = 0;
    for (let a = 0; a < FRAMES; a++)
      for (let b = 0; b < FRAMES; b++)
        for (let d = 0; d < FRAMES; d++) {
          const push = [a, b, d];
          const stops = [null, null, null];
          for (const r of order) {
            const res = decideStop(stops, r, push[r], c.allowed, c.mode);
            if (res.slip > 4 || res.slip < 0) ng(`すべり ${res.slip}`);
            maxSlip = Math.max(maxSlip, res.slip);
            stops[r] = res.mid;
          }
          const wins = judge(stops, c.mode);
          total++;
          for (const wn of wins) {
            if (!c.allowed.includes(ROLES[wn.role].flag)) {
              ng(
                `${c.allowed.join("+") || "ハズレ"}(${c.mode}) で ${wn.role} が揃った 押し${push} 順${order} 停止${stops}`,
              );
            }
          }
          const bonusWin = wins.some((x) => ROLES[x.role].kind === "bonus");
          const smallWin = wins.some((x) => ROLES[x.role].kind !== "bonus");
          if (bonusWin && smallWin) ng(`ボーナスと小役が同時に揃った ${stops}`);
          if (bonusWin) bonusHit++;
          if (smallWin) hit++;
          oTotal++;
          if (smallWin) oHit++;
          if (wins.some((x) => ROLES[x.role].alt)) altHit++;
          // リプレイと風鈴はどの押し順でも取りこぼさない（左の小ドンが風鈴の代わり）
          if (c.must && !smallWin)
            ng(
              `${c.allowed.join("+")} を取りこぼした 押し${push} 順${order} 停止${stops} 窓${stops.map((m, r) => symAt(r, m - 1) + symAt(r, m) + symAt(r, m + 1))}`,
            );
        }
    byOrder.push(`${order.join("")}:${((oHit / oTotal) * 100).toFixed(0)}`);
  }
  console.log(
    `${(c.allowed.join("+") || "ハズレ").padEnd(14)} ${c.mode.padEnd(6)} 小役揃い ${((hit / total) * 100).toFixed(1)}%  ボーナス揃い ${((bonusHit / total) * 100).toFixed(1)}%  最大すべり ${maxSlip}  小ドン代わり ${((altHit / total) * 100).toFixed(2)}%  押し順別 ${byOrder.join(" ")}`,
  );
  if (c.bonus && bonusHit === 0)
    ng(`${c.allowed} のボーナスを揃えられる押し方がない`);
}
console.log(
  `NG ${fail} 件・${((performance.now() - t0) / 1000).toFixed(1)} 秒`,
);
if (fail) process.exitCode = 1;
