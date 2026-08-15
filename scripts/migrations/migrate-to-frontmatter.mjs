import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseFrontmatter, stringifyFrontmatter } from "../lib/frontmatter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const BLOG_DATA_PATH = join(ROOT, "src", "blog-data.json");
const ARTICLES_DIR = join(ROOT, "src", "articles");

console.log("🚀 Frontmatter マイグレーション開始...");

const blogData = JSON.parse(readFileSync(BLOG_DATA_PATH, "utf-8"));
console.log(`📋 対象記事数: ${blogData.length}件`);

let migratedCount = 0;

for (const post of blogData) {
  const articlePath = join(ARTICLES_DIR, `${post.slug}.html`);
  if (!existsSync(articlePath)) {
    console.error(`❌ ファイルが存在しません: ${articlePath}`);
    process.exit(1);
  }

  const rawHtml = readFileSync(articlePath, "utf-8");
  const { content } = parseFrontmatter(rawHtml);

  const metadata = {
    title: post.title,
    date: post.date,
    excerpt: post.excerpt,
    tags: post.tags,
    ...(post.ogImage ? { ogImage: post.ogImage } : {}),
    ...(post.dateModified ? { dateModified: post.dateModified } : {}),
  };

  const newHtml = stringifyFrontmatter(metadata, content.trimStart());
  writeFileSync(articlePath, newHtml, "utf-8");
  migratedCount++;
}

console.log(`✅ ${migratedCount}件の記事HTMLにFrontmatterを注入完了`);

// ===== 整合性検証テスト =====
console.log("🔍 整合性テストを実行中...");
let errors = 0;

for (const post of blogData) {
  const articlePath = join(ARTICLES_DIR, `${post.slug}.html`);
  const rawHtml = readFileSync(articlePath, "utf-8");
  const { metadata } = parseFrontmatter(rawHtml);

  if (metadata.title !== post.title) {
    console.error(`❌ タイトル不一致 [${post.slug}]: expected "${post.title}", got "${metadata.title}"`);
    errors++;
  }
  if (metadata.date !== post.date) {
    console.error(`❌ 日付不一致 [${post.slug}]: expected "${post.date}", got "${metadata.date}"`);
    errors++;
  }
  if (metadata.excerpt !== post.excerpt) {
    console.error(`❌ 抜粋不一致 [${post.slug}]`);
    errors++;
  }
  if (JSON.stringify(metadata.tags || []) !== JSON.stringify(post.tags || [])) {
    console.error(`❌ タグ不一致 [${post.slug}]`);
    errors++;
  }
  if ((post.ogImage || "") !== (metadata.ogImage || "")) {
    console.error(`❌ ogImage不一致 [${post.slug}]`);
    errors++;
  }
}

if (errors === 0) {
  console.log(`🎉 整合性検証クリア！全${blogData.length}件のメタデータが完全一致しました。`);
} else {
  console.error(`❌ ${errors}件のエラーが検出されました。`);
  process.exit(1);
}
