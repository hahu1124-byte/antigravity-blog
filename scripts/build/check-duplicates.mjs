import { fileURLToPath } from "url";
import { posts } from "./context.mjs";
import { findDuplicates } from "../lib/related.mjs";

/**
 * 記事間の重複を検知し警告として出力する（書き手への示唆であり、
 * checkInternalLinks() と異なり CI を失敗させない = exitCode を変更しない）。
 */
export function checkDuplicateArticles(opts = {}) {
  const contentPosts = posts.filter((p) => p.content);
  const dupPairs = findDuplicates(contentPosts, opts);

  if (dupPairs.length === 0) {
    console.log("🔍 重複記事チェックOK（閾値超えのペアなし）");
    return dupPairs;
  }

  console.log(
    `::warning::重複の疑いがある記事ペアを${dupPairs.length}件検出しました`,
  );
  const top = opts.top ?? 10;
  for (const { a, b, score } of dupPairs.slice(0, top)) {
    console.log(`  ${score.toFixed(2)} — ${a.slug}  ⇔  ${b.slug}`);
  }
  if (dupPairs.length > top) console.log(`  ...他${dupPairs.length - top}件`);
  return dupPairs;
}

// CLI実行時（node scripts/build/check-duplicates.mjs --report --top 30）
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  const topIdx = args.indexOf("--top");
  const top = topIdx !== -1 ? parseInt(args[topIdx + 1], 10) : 10;
  checkDuplicateArticles({ top });
}
