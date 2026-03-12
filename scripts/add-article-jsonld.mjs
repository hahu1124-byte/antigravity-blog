/**
 * ブログ記事にArticle JSON-LD構造化データを一括追加するスクリプト
 * 既にJSON-LDが含まれる記事はスキップ
 *
 * 使い方: node scripts/add-article-jsonld.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BLOG_DIR = join(ROOT, "dist", "blog");
const BLOG_DATA = join(ROOT, "dist", "blog-data.json");
const SITE_URL = "https://www.antigravity-portal.com";

// blog-data.json読み込み（タイトル・日付・タグ取得用）
const posts = JSON.parse(readFileSync(BLOG_DATA, "utf-8"));
const postMap = new Map(posts.map((p) => [p.slug, p]));

function escapeJsonString(str) {
    return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function generateArticleJsonLd(post, url) {
    return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${escapeJsonString(post.title)}",
  "description": "${escapeJsonString(post.excerpt)}",
  "datePublished": "${post.date}T00:00:00+09:00",
  "dateModified": "${post.date}T00:00:00+09:00",
  "author": {
    "@type": "Person",
    "name": "AH",
    "url": "${SITE_URL}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Gravity Portal",
    "logo": {
      "@type": "ImageObject",
      "url": "${SITE_URL}/og-image.png"
    }
  },
  "mainEntityOfPage": "${url}",
  "inLanguage": "ja"
}
</script>`;
}

// ブログディレクトリ内の全index.htmlを走査
let added = 0;
let skipped = 0;

function processDir(dir, slugPrefix) {
    const entries = readdirSync(dir);
    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            // 月別ディレクトリ（202602, 202603等）か記事ディレクトリか判定
            if (/^\d{6}$/.test(entry)) {
                processDir(fullPath, entry);
            } else if (slugPrefix) {
                const slug = `${slugPrefix}/${entry}`;
                const indexPath = join(fullPath, "index.html");
                try {
                    let html = readFileSync(indexPath, "utf-8");
                    // 既にJSON-LDがある場合はスキップ
                    if (html.includes("application/ld+json")) {
                        skipped++;
                        continue;
                    }
                    const post = postMap.get(slug);
                    if (!post) {
                        console.log(`⚠️ blog-data.jsonにない記事: ${slug}`);
                        continue;
                    }
                    const url = `${SITE_URL}/blog/${slug}/`;
                    const jsonLd = generateArticleJsonLd(post, url);
                    // </head>の直前に挿入
                    html = html.replace("</head>", `    ${jsonLd}\n</head>`);
                    writeFileSync(indexPath, html, "utf-8");
                    added++;
                    console.log(`✅ 追加: ${slug}`);
                } catch {
                    // index.htmlが存在しない記事ディレクトリはスキップ
                }
            }
        }
    }
}

processDir(BLOG_DIR, "");
console.log(`\n完了: ${added}件追加、${skipped}件スキップ（既にJSON-LD含む）`);
