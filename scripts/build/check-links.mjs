import { existsSync, readFileSync, readdirSync } from "fs";
import { extname, join, relative } from "path";
import { OUTPUT_DIR } from "./context.mjs";
import { collectFiles } from "./minify.mjs";

/**
 * dist内の全HTMLから内部リンク(href="/...")を抽出し、リンク先ファイルの実在を検証する。
 * writeFileSync漏れ等でリンクだけ残り実体が無い状態(2026-07-22 timeline/index.html404)を
 * デプロイ前に検出するための安全網。リンク切れがあればビルドを失敗扱いにする。
 */
export function checkInternalLinks() {
  const htmlFiles = collectFiles(OUTPUT_DIR, [".html"]);
  // GP(gravity-portal)等、このビルドの管轄外パス(/tools/, /guide/, /favicon.ico等)を
  // 誤検知しないよう、dist直下に実在するトップレベルディレクトリのみ検証対象にする
  const managedRoots = readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const broken = [];

  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf-8");
    const hrefs = [...html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
    for (const href of hrefs) {
      if (href.startsWith("//")) continue; // プロトコル相対の外部リンク

      const cleanPath = href.split("?")[0].split("#")[0];
      if (!cleanPath || cleanPath === "/") continue;

      const firstSegment = cleanPath.split("/").filter(Boolean)[0];
      if (!managedRoots.includes(firstSegment)) continue; // 他プロジェクト管轄のパスはスキップ

      const targetPath = cleanPath.endsWith("/")
        ? join(OUTPUT_DIR, cleanPath, "index.html")
        : extname(cleanPath)
          ? join(OUTPUT_DIR, cleanPath)
          : join(OUTPUT_DIR, cleanPath, "index.html");

      if (!existsSync(targetPath)) {
        broken.push(`${relative(OUTPUT_DIR, file)} → ${href}`);
      }
    }
  }

  if (broken.length > 0) {
    const unique = [...new Set(broken)];
    console.error(
      `❌ 内部リンク切れを${unique.length}件検出（ビルド失敗扱い）:`,
    );
    for (const b of unique.slice(0, 30)) console.error(`   ${b}`);
    if (unique.length > 30) console.error(`   ...他${unique.length - 30}件`);
    process.exitCode = 1;
  } else {
    console.log(
      `🔗 内部リンクチェックOK（${htmlFiles.length}ファイル走査、リンク切れなし）`,
    );
  }
}
