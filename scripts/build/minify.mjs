import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { extname, join, relative } from "path";
import { createHash } from "crypto";
import { transform } from "esbuild";
import { OUTPUT_DIR } from "./context.mjs";

// ==========================================
// CSS / JS / HTML Minify（ビルド後処理）
// ==========================================

const MINIFY_CACHE_PATH = join(OUTPUT_DIR, ".minify-cache.json");

export function sha(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

export function loadMinifyCache() {
  if (existsSync(MINIFY_CACHE_PATH)) {
    try {
      return JSON.parse(readFileSync(MINIFY_CACHE_PATH, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

/** dist内の全ファイルを再帰的に取得 */
export function collectFiles(dir, exts) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, exts));
    } else if (exts.includes(extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * HTMLのインラインCSS/JSをesbuildでminify、タグ間余分空白を削除
 * <pre>タグは壊さないよう、src属性付き<script>はスキップ
 */
export async function minifyHtmlContent(html) {
  // <style>ブロックをesbuildでminify
  const styleMatches = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)];
  for (const m of styleMatches) {
    if (!m[1].trim()) continue;
    try {
      const r = await transform(m[1], { loader: "css", minify: true });
      html = html.replace(m[0], `<style>${r.code}</style>`);
    } catch {
      /* 元のまま維持 */
    }
  }

  // src属性なしの<script>ブロックをesbuildでminify
  const scriptMatches = [
    ...html.matchAll(/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/g),
  ];
  for (const m of scriptMatches) {
    if (!m[1].trim()) continue;
    try {
      const r = await transform(m[1], { loader: "js", minify: true });
      html = html.replace(m[0], m[0].replace(m[1], r.code));
    } catch {
      /* 元のまま維持 */
    }
  }

  // HTMLコメント削除（条件付きコメント <!--[if は除外）
  html = html.replace(/<!--(?!\[if)[\s\S]*?-->/g, "");

  return html;
}

export async function minifyAssets() {
  const cache = loadMinifyCache();
  const newCache = {};

  const cssFiles = collectFiles(OUTPUT_DIR, [".css"]);
  const jsFiles = collectFiles(OUTPUT_DIR, [".js"]);
  const htmlFiles = collectFiles(OUTPUT_DIR, [".html"]);

  let totalSaved = 0,
    minified = 0,
    skipped = 0,
    errors = 0;
  const minifiedFiles = [];

  // CSS / JS
  for (const file of [...cssFiles, ...jsFiles]) {
    const ext = extname(file).toLowerCase();
    const original = readFileSync(file, "utf-8");
    const hash = sha(original);

    if (cache[file] === hash) {
      newCache[file] = hash;
      skipped++;
      continue;
    }

    const originalSize = Buffer.byteLength(original, "utf-8");
    try {
      const result = await transform(original, {
        loader: ext === ".css" ? "css" : "js",
        minify: true,
      });
      const newSize = Buffer.byteLength(result.code, "utf-8");
      if (newSize < originalSize) {
        writeFileSync(file, result.code);
        totalSaved += originalSize - newSize;
        minified++;
        minifiedFiles.push(relative(OUTPUT_DIR, file));
        newCache[file] = hash; // minify前のハッシュで保存（次回ビルドで元HTML上書き後も一致）
      } else {
        newCache[file] = hash;
      }
    } catch (e) {
      console.warn(
        `⚠️  minify失敗 [${ext}] ${relative(OUTPUT_DIR, file)}: ${e.message}`,
      );
      errors++;
      newCache[file] = hash;
    }
  }

  // HTML（インラインCSS/JS圧縮 + タグ間空白削減）
  for (const file of htmlFiles) {
    const original = readFileSync(file, "utf-8");
    const hash = sha(original);

    if (cache[file] === hash) {
      newCache[file] = hash;
      skipped++;
      continue;
    }

    const originalSize = Buffer.byteLength(original, "utf-8");
    try {
      const minifiedHtml = await minifyHtmlContent(original);
      const newSize = Buffer.byteLength(minifiedHtml, "utf-8");
      if (newSize < originalSize) {
        writeFileSync(file, minifiedHtml);
        totalSaved += originalSize - newSize;
        minified++;
        minifiedFiles.push(relative(OUTPUT_DIR, file));
        newCache[file] = hash; // minify前のハッシュで保存
      } else {
        newCache[file] = hash;
      }
    } catch (e) {
      console.warn(
        `⚠️  minify失敗 [html] ${relative(OUTPUT_DIR, file)}: ${e.message}`,
      );
      errors++;
      newCache[file] = hash;
    }
  }

  writeFileSync(MINIFY_CACHE_PATH, JSON.stringify(newCache), "utf-8");

  const total = cssFiles.length + jsFiles.length + htmlFiles.length;
  const errMsg = errors > 0 ? ` ⚠️ ${errors}件失敗` : "";
  if (minified === 0) {
    console.log(`🗜️  変更なし (${skipped}件キャッシュ済${errMsg})`);
  } else {
    const MAX_SHOW = 5;
    const preview =
      minifiedFiles.length <= MAX_SHOW
        ? minifiedFiles.join(", ")
        : `${minifiedFiles.slice(0, MAX_SHOW).join(", ")} ...他${minifiedFiles.length - MAX_SHOW}件`;
    console.log(
      `🗜️  +${minified}件 minify (${(totalSaved / 1024).toFixed(1)}KB削減): ${preview}${errMsg}`,
    );
  }
}
