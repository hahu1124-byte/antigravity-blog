#!/usr/bin/env node
import { createHash } from "crypto";
import { readFileSync, readdirSync } from "fs";
import { join, relative } from "path";

const [baselineDir, candidateDir, ...cliExcludes] = process.argv.slice(2);
if (!baselineDir || !candidateDir) {
  console.error(
    "使い方: node scripts/build/verify-output-equivalence.mjs <基準出力> <比較出力>",
  );
  process.exit(2);
}

const excludedSuffixes = new Set([
  ".minify-cache.json",
  ...cliExcludes,
  ...(process.env.BLOG_BUILD_COMPARE_EXCLUDE || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
]);

function isExcluded(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  return [...excludedSuffixes].some(
    (suffix) => normalized === suffix || normalized.endsWith(`/${suffix}`),
  );
}

function collectHashes(rootDir, currentDir = rootDir, hashes = new Map()) {
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectHashes(rootDir, fullPath, hashes);
      continue;
    }

    const relativePath = relative(rootDir, fullPath);
    if (isExcluded(relativePath)) continue;

    const hash = createHash("sha256")
      .update(readFileSync(fullPath))
      .digest("hex");
    hashes.set(relativePath, hash);
  }
  return hashes;
}

const baseline = collectHashes(baselineDir);
const candidate = collectHashes(candidateDir);
const paths = [...new Set([...baseline.keys(), ...candidate.keys()])].sort();
const differences = paths.filter(
  (relativePath) => baseline.get(relativePath) !== candidate.get(relativePath),
);

console.log(
  `基準: ${baseline.size}ファイル / 比較: ${candidate.size}ファイル / 差分: ${differences.length}件`,
);
for (const relativePath of differences.slice(0, 100)) {
  const kind = !baseline.has(relativePath)
    ? "比較側のみ"
    : !candidate.has(relativePath)
      ? "基準側のみ"
      : "内容差分";
  console.log(`  ${kind}: ${relativePath}`);
}
if (differences.length > 100) {
  console.log(`  ...他${differences.length - 100}件`);
}
if (differences.length > 0) process.exitCode = 1;
