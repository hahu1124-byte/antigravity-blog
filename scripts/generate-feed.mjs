/**
 * RSSフィード生成スクリプト
 * blog-data.json → dist/blog/feed.xml
 *
 * 使い方: node scripts/generate-feed.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SITE_URL = "https://www.antigravity-portal.com";
const BLOG_URL = `${SITE_URL}/blog`;
const FEED_TITLE = "Gravity Portal ブログ";
const FEED_DESC =
    "パチンコ分析・AI開発・Uber配達の個人開発ポータル Gravity Portal の最新記事";
const FEED_LANG = "ja";
const FEED_AUTHOR = "Gravity Portal";

// blog-data.json 読み込み
const dataPath = join(ROOT, "dist", "blog-data.json");
const posts = JSON.parse(readFileSync(dataPath, "utf-8"));

// 最新20件に制限
const feedPosts = posts.slice(0, 20);

// XML特殊文字エスケープ
function escapeXml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

// RFC-822 日付フォーマット（RSS 2.0仕様）
function toRfc822(dateStr) {
    const d = new Date(`${dateStr}T00:00:00+09:00`);
    return d.toUTCString();
}

const lastBuildDate = feedPosts.length > 0 ? toRfc822(feedPosts[0].date) : new Date().toUTCString();

const items = feedPosts
    .map((post) => {
        const url = `${BLOG_URL}/${post.slug}/`;
        const categories = (post.tags || [])
            .map((tag) => `        <category>${escapeXml(tag)}</category>`)
            .join("\n");
        return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${toRfc822(post.date)}</pubDate>
      <description>${escapeXml(post.excerpt)}</description>
${categories}
    </item>`;
    })
    .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${BLOG_URL}</link>
    <description>${escapeXml(FEED_DESC)}</description>
    <language>${FEED_LANG}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <managingEditor>hahu1124 (${FEED_AUTHOR})</managingEditor>
    <atom:link href="${BLOG_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

const outPath = join(ROOT, "dist", "blog", "feed.xml");
writeFileSync(outPath, xml, "utf-8");
console.log(`✅ RSSフィード生成完了: ${outPath}`);
console.log(`   記事数: ${feedPosts.length}件`);
