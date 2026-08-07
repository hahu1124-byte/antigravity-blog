#!/usr/bin/env node
/**
 * blog-data.json → 静的HTML生成スクリプト
 * GitHub Pages用のブログサイトを生成する
 */
import { writeFileSync } from "fs";
import {
  BUILD_STATS_PATH,
  OUTPUT_DIR,
  curStats,
} from "./scripts/build/context.mjs";
import {
  buildArticlePages,
  buildIndexPage,
  buildRssFeed,
  buildTagPages,
} from "./scripts/build/blog-pages.mjs";
import { buildMachinePages } from "./scripts/build/machine-pages.mjs";
import {
  buildNovelsPages,
  buildSettingsPages,
} from "./scripts/build/novels-pages.mjs";
import { buildBlogNovelPages } from "./scripts/build/blog-novels.mjs";
import { minifyAssets } from "./scripts/build/minify.mjs";
import { checkInternalLinks } from "./scripts/build/check-links.mjs";

// ブログ・カテゴリ・記事・RSS・機種ページ
buildIndexPage();
buildTagPages();
buildArticlePages();
buildRssFeed();
buildMachinePages();

// LAB小説・設定ページ
await buildNovelsPages();
await buildSettingsPages();

// 小説本文ページ（/blog/novels/）
await buildBlogNovelPages();

// ビルド後処理
await minifyAssets();
checkInternalLinks();

// 今回のビルド統計を保存（次回差分表示用）
writeFileSync(BUILD_STATS_PATH, JSON.stringify(curStats), "utf-8");

const outputLabel =
  OUTPUT_DIR.endsWith("\\dist") || OUTPUT_DIR.endsWith("/dist")
    ? "dist/"
    : OUTPUT_DIR;
console.log(`✅ ビルド完了！ ${outputLabel} に出力されました`);
