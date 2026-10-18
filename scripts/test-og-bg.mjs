// 自動投稿のアイキャッチの背景の選び方（lib/og-bg.mjs）の確認。
// 架空の日々を流して、30 日以内に同じ絵が出ないか・借りる群・同じ日のやり直しで同じ絵になるかを見る。
// 使い方: node scripts/test-og-bg.mjs（記録は一時フォルダに書き、src/og-bg-history.json は触らない）
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  bgGroups,
  loadBgIndex,
  pickBackground,
  recordBackground,
} from "./lib/og-bg.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(ROOT, "assets", "og-bg");
const historyPath = path.join(os.tmpdir(), "og-bg-history.test.json");
const index = loadBgIndex(assetsDir);
let failed = 0;

function run(label, days, weatherOf) {
  fs.writeFileSync(historyPath, "[]");
  let history = [];
  const used = [];
  const borrowed = {};
  let dup = 0;
  const start = Date.UTC(2026, 9, 1); // 10/01
  for (let i = 0; i < days; i++) {
    const d = new Date(start + i * 86400000);
    const date = d.toISOString().slice(0, 10);
    const w = weatherOf(i);
    const groups = bgGroups({
      weatherType: w.type,
      telop: w.telop || "",
      rainMax: w.rainMax || 0,
      month: d.getUTCMonth() + 1,
    });
    const slug = `${date.replace(/-/g, "")}_uber_daily`;
    const bg = pickBackground({
      assetsDir,
      index,
      history,
      slug,
      date,
      groups,
    });
    history = recordBackground(historyPath, history, {
      date,
      slug,
      key: bg.key,
    });
    const again = pickBackground({
      assetsDir,
      index,
      history,
      slug,
      date,
      groups,
    });
    if (again.key !== bg.key) {
      console.log(`  ✗ ${date} やり直しで別の絵 ${bg.key} → ${again.key}`);
      failed++;
    }
    const last = used.findLast((u) => u.key === bg.key);
    if (last && i - last.day < 30) dup++;
    if (bg.borrowed) borrowed[bg.group] = (borrowed[bg.group] || 0) + 1;
    used.push({ day: i, key: bg.key });
  }
  if (dup) failed++;
  console.log(
    `${dup ? "✗" : "✓"} ${label}: ${days} 日・30 日以内の重複 ${dup}・借用 ${JSON.stringify(borrowed)}`,
  );
}

run("晴れが 60 日続く（10〜11 月）", 60, () => ({ type: "sunny" }));
run("雨・曇り・晴れが交互 60 日", 60, (i) => ({
  type: ["rainy", "cloudy", "sunny"][i % 3],
}));
run("台風が 20 日続く", 20, () => ({ type: "storm", telop: "暴風雨" }));
run("大雨が 40 日続く", 40, () => ({ type: "rainy", rainMax: 90 }));

// 週刊: tech 12 枚・直近 8 回を避ける
fs.writeFileSync(historyPath, "[]");
let h = [];
const keys = [];
for (let w = 0; w < 20; w++) {
  const date = new Date(Date.UTC(2026, 9, 4 + w * 7))
    .toISOString()
    .slice(0, 10);
  const slug = `weekly_${w}`;
  const bg = pickBackground({
    assetsDir,
    index,
    history: h,
    slug,
    date,
    groups: bgGroups({ kind: "tech" }),
  });
  h = recordBackground(historyPath, h, { date, slug, key: bg.key });
  keys.push(bg.key);
}
const near = keys.filter((k, i) =>
  keys.slice(Math.max(0, i - 8), i).includes(k),
).length;
if (near) failed++;
console.log(`${near ? "✗" : "✓"} 週刊 20 週: 直近 8 回以内の重複 ${near}`);

fs.rmSync(historyPath, { force: true });
process.exitCode = failed ? 1 : 0;
