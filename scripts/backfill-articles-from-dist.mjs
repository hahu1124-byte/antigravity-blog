#!/usr/bin/env node
/**
 * dist/ に直書きされた完成HTMLから本文フラグメントを抽出し、
 * src/articles/<slug>.html へバックフィルする一度きりの移行ツール。
 *
 * 対象は「blog-data.json にエントリがあり、dist/blog/<slug>/index.html が存在し、
 * src/articles/<slug>.html がまだ無い」記事すべて（自動検出、件数のハードコードなし）。
 *
 * 使い方:
 *   node scripts/backfill-articles-from-dist.mjs --dry-run   対象一覧と検証結果だけ表示
 *   node scripts/backfill-articles-from-dist.mjs             実際に書き込む（既存はスキップ）
 *   node scripts/backfill-articles-from-dist.mjs --force     既存フラグメントも上書き
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = dirname(__dirname);
const BLOG_DATA_PATH = join(PROJECT_DIR, "src", "blog-data.json");
const DIST_DIR = join(PROJECT_DIR, "dist", "blog");
const ARTICLES_DIR = join(PROJECT_DIR, "src", "articles");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");

/** '<div class="content">' の開始タグ直後〜対応する終了タグ直前を、深さカウンタでバランス抽出する */
function extractBalanced(html, markerEndPos) {
  let depth = 1;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = markerEndPos;
  let m;
  while ((m = re.exec(html))) {
    if (m[0] === "</div>") {
      depth--;
      if (depth === 0) return { text: html.slice(markerEndPos, m.index), endIndex: m.index + m[0].length };
    } else {
      depth++;
    }
  }
  return null;
}

function extractContent(html) {
  const MARK = '<div class="content">';
  const i = html.indexOf(MARK);
  if (i < 0) return null;
  const result = extractBalanced(html, i + MARK.length);
  return result ? result.text : null;
}

/** content内の ninja-ad-slot ブロックを除去する。
 *  直前に既存の <hr> があれば単純削除、無ければ <hr> に置換する
 *  （置換により、build.mjs 側の「最初の<hr>直後に中間広告を挿入」の位置情報を保存する）。
 */
function stripAdSlots(content) {
  let result = content;
  let searchFrom = 0;
  let removed = 0;

  while (true) {
    const classIdx = result.indexOf('class="ninja-ad-slot"', searchFrom);
    if (classIdx < 0) break;
    const divStart = result.lastIndexOf("<div", classIdx);
    if (divStart < 0) throw new Error("ninja-ad-slot の開始 <div が見つかりません");
    const openTagEnd = result.indexOf(">", classIdx) + 1;
    const balanced = extractBalanced(result, openTagEnd);
    if (!balanced) throw new Error("ninja-ad-slot の div が閉じていません（バランス不整合）");
    const blockEnd = balanced.endIndex;

    const before = result.slice(0, divStart);
    const hasHrBefore = /<hr\s*\/?>\s*$/.test(before);

    const replacement = hasHrBefore ? "" : "<hr>";
    result = before + replacement + result.slice(blockEnd);
    searchFrom = divStart + replacement.length;
    removed++;
  }

  return { content: result, removed };
}

/** 共通インデントを検出して除去し、CRLF→LF正規化、前後trimして末尾改行を1つ付与する */
function dedent(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim() === "") continue;
    const m = line.match(/^ */);
    minIndent = Math.min(minIndent, m[0].length);
  }
  if (!isFinite(minIndent)) minIndent = 0;
  return lines
    .map((l) => (l.trim() === "" ? "" : l.slice(minIndent)))
    .join("\n")
    .trim() + "\n";
}

function validate(fragment, slug) {
  const errors = [];
  if (!fragment || fragment.trim().length === 0) errors.push("抽出結果が空");

  const forbidden = ["<!DOCTYPE", "<head", "<style", "amazon-ads-section", "breadcrumb", "ninja-ad-slot"];
  for (const f of forbidden) {
    if (fragment.includes(f)) errors.push(`禁止要素を含む: ${f}`);
  }

  const openDiv = (fragment.match(/<div\b/g) || []).length;
  const closeDiv = (fragment.match(/<\/div>/g) || []).length;
  if (openDiv !== closeDiv) errors.push(`div不均衡: open=${openDiv} close=${closeDiv}`);

  // uber_daily系のみ追加チェック
  if (fragment.includes('class="uber-section"')) {
    const commentCount = (fragment.match(/class="daily-comment"/g) || []).length;
    const sectionCount = (fragment.match(/class="uber-section"/g) || []).length;
    if (commentCount !== 1) errors.push(`daily-comment個数異常: ${commentCount}`);
    if (sectionCount < 8 || sectionCount > 9) errors.push(`uber-section個数異常: ${sectionCount}`);
    if (fragment.length < 3000 || fragment.length > 8000) {
      errors.push(`出力長異常: ${fragment.length}`);
    }
  }

  return errors;
}

function findTargets() {
  const blogData = JSON.parse(readFileSync(BLOG_DATA_PATH, "utf-8"));
  const targets = [];
  for (const post of blogData) {
    const distPath = join(DIST_DIR, ...post.slug.split("/"), "index.html");
    const srcPath = join(ARTICLES_DIR, `${post.slug}.html`);
    if (!existsSync(distPath)) continue;
    if (existsSync(srcPath) && !FORCE) continue;
    targets.push({ slug: post.slug, distPath, srcPath });
  }
  return targets;
}

function main() {
  const targets = findTargets();
  console.log(`対象: ${targets.length}件${FORCE ? "（--force: 既存も上書き）" : ""}`);

  let ok = 0;
  let failed = 0;
  const failures = [];

  for (const t of targets) {
    const html = readFileSync(t.distPath, "utf-8");
    const raw = extractContent(html);
    if (!raw) {
      failed++;
      failures.push({ slug: t.slug, reason: "content div が見つからない" });
      continue;
    }

    const { content: stripped } = stripAdSlots(raw);
    const fragment = dedent(stripped);
    const errors = validate(fragment, t.slug);

    if (errors.length > 0) {
      failed++;
      failures.push({ slug: t.slug, reason: errors.join(" / ") });
      continue;
    }

    ok++;
    if (!DRY_RUN) {
      mkdirSync(dirname(t.srcPath), { recursive: true });
      writeFileSync(t.srcPath, fragment, "utf-8");
    }
  }

  console.log(`検証OK: ${ok}件 / 失敗: ${failed}件`);
  if (failures.length > 0) {
    console.log("--- 失敗一覧 ---");
    for (const f of failures) console.log(`  ${f.slug}: ${f.reason}`);
  }

  if (DRY_RUN) {
    console.log(failed > 0 ? "❌ dry-run: 失敗あり" : "✅ dry-run: 全件成功見込み");
  } else {
    console.log(failed > 0 ? "❌ 一部失敗（書き込みはOK分のみ実施済み）" : "✅ 全件書き込み完了");
  }

  if (failed > 0) process.exitCode = 1;
}

main();
