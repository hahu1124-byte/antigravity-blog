import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { extname, join } from "path";
import { BUILD_STAMP, OUTPUT_DIR } from "./context.mjs";
import { gpHeaderBlock } from "./gp-header.mjs";

const LEGACY_HEADER_OPEN = '<header class="gp-blog-header">';
const CANONICAL_HEADER_MARKER = "data-gp-canonical-header";
const HERO_SCRIPT_PATH = "/blog/scripts/hero-bg.js";

function listHtmlFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listHtmlFiles(path));
    else if (extname(entry.name).toLowerCase() === ".html") files.push(path);
  }
  return files;
}

function skipWhitespace(html, start) {
  let cursor = start;
  while (/\s/.test(html[cursor] || "")) cursor += 1;
  return cursor;
}

function consumeLegacyCompanion(html, start, tagName, requiredText) {
  const cursor = skipWhitespace(html, start);
  if (!html.startsWith(`<${tagName}`, cursor)) return start;
  const close = `</${tagName}>`;
  const end = html.indexOf(close, cursor);
  if (end === -1) return start;
  const blockEnd = end + close.length;
  const block = html.slice(cursor, blockEnd);
  return block.includes(requiredText) ? blockEnd : start;
}

function replaceLegacyHeader(html) {
  const start = html.indexOf(LEGACY_HEADER_OPEN);
  if (start === -1) return { html, replaced: false };
  const headerEnd = html.indexOf("</header>", start);
  if (headerEnd === -1) {
    throw new Error("共通ヘッダーの終了タグが見つかりません");
  }

  let end = headerEnd + "</header>".length;
  end = consumeLegacyCompanion(html, end, "style", ".gp-bh-inner");
  end = consumeLegacyCompanion(html, end, "script", "gpBhThemeToggle");
  return {
    html: html.slice(0, start) + gpHeaderBlock() + html.slice(end),
    replaced: true,
  };
}

function ensureBackground(html) {
  let output = html;
  if (!output.includes('id="gp-hero-bg"')) {
    const headerStart = output.indexOf("<!-- gp-canonical-header:start -->");
    if (headerStart === -1) throw new Error("背景の注入先が見つかりません");
    output =
      output.slice(0, headerStart) +
      '<div id="gp-hero-bg"></div>\n' +
      output.slice(headerStart);
  }
  if (!output.includes(HERO_SCRIPT_PATH)) {
    const headEnd = output.indexOf("</head>");
    if (headEnd === -1) throw new Error("背景スクリプトの注入先が見つかりません");
    output =
      output.slice(0, headEnd) +
      `  <script defer src="${HERO_SCRIPT_PATH}?v=${BUILD_STAMP}"></script>\n` +
      output.slice(headEnd);
  }
  return output;
}

function countMatches(text, search) {
  return text.split(search).length - 1;
}

function verifyEnhancedHtml(html, path) {
  const errors = [];
  if (countMatches(html, CANONICAL_HEADER_MARKER) !== 1) {
    errors.push("正本ヘッダーが1件ではありません");
  }
  if (countMatches(html, 'class="gp-blog-header"') !== 1) {
    errors.push("共通ヘッダーが重複しています");
  }
  if (countMatches(html, 'id="gp-hero-bg"') !== 1) {
    errors.push("背景コンテナが重複または欠落しています");
  }
  if (countMatches(html, HERO_SCRIPT_PATH) !== 1) {
    errors.push("背景スクリプトが重複または欠落しています");
  }
  if (countMatches(html, "gpBhThemeToggle") !== 2) {
    errors.push("旧テーマ切替スクリプトが残っている可能性があります");
  }
  if (html.includes(LEGACY_HEADER_OPEN)) {
    errors.push("旧共通ヘッダーが未置換です");
  }
  if (errors.length) throw new Error(`${path}: ${errors.join(" / ")}`);
}

/**
 * src内に残るヘッダー複製は直接編集せず、公開成果物だけを正本へ統一する。
 * ヘッダーがないゲーム画面は意図的な全画面表示として対象外にする。
 */
export function enhanceStaticShellPages() {
  const roots = [join(OUTPUT_DIR, "game"), join(OUTPUT_DIR, "lab")];
  const htmlFiles = roots.flatMap(listHtmlFiles);
  let eligibleCount = 0;
  let sourceLegacyCount = 0;
  let replacedCount = 0;

  for (const path of htmlFiles) {
    const source = readFileSync(path, "utf-8");
    const hasCanonical = source.includes(CANONICAL_HEADER_MARKER);
    const hasLegacy = source.includes(LEGACY_HEADER_OPEN);
    if (!hasCanonical && !hasLegacy) continue;
    eligibleCount += 1;
    if (hasLegacy) sourceLegacyCount += 1;

    const replaced = hasLegacy
      ? replaceLegacyHeader(source)
      : { html: source, replaced: false };
    let output = ensureBackground(replaced.html);
    verifyEnhancedHtml(output, path);
    writeFileSync(path, output, "utf-8");
    if (replaced.replaced) replacedCount += 1;
  }

  const remainingLegacyCount = htmlFiles.filter((path) =>
    readFileSync(path, "utf-8").includes(LEGACY_HEADER_OPEN),
  ).length;
  if (replacedCount !== sourceLegacyCount || remainingLegacyCount !== 0) {
    throw new Error(
      `旧共通ヘッダーの置換不整合: 対象${sourceLegacyCount} / 置換${replacedCount} / 残存${remainingLegacyCount}`,
    );
  }
  console.log(
    `🧭 共通シェル ${eligibleCount}ページ（旧ヘッダー置換 ${replacedCount}件）`,
  );
}
