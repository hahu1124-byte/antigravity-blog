import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  OUTPUT_DIR,
  curStats,
  metaOnly,
  posts,
  prevStats,
} from "./context.mjs";
import {
  DEFAULT_OG_IMAGE,
  SITE_URL,
  collectTags,
  escapeHtml,
  formatDateTime,
  getAdVisibilityScript,
  getAmazonAdsHtml,
  getDateModifiedBadge,
  getDateModifiedText,
  getNinjaAdHtml,
  getNoteBannerHtml,
  htmlHead,
} from "./html.mjs";
import { findRelated, getRelatedPostsHtml } from "../lib/related.mjs";

// ==========================================
// 記事一覧ページ生成 (/blog/index.html)
// ==========================================

export function buildArticleListHtml(
  postList,
  title,
  description,
  cssRelPath,
  baseUrl,
  ogType,
  breadcrumbHtml,
  activeTag,
) {
  const tagEntries = collectTags(posts); // 全記事からタグ収集（全体カウント表示用）

  const cards = postList
    .map(
      (post, i) => `
        <a href="${activeTag ? `../../${post.slug}/` : `${post.slug}/`}" class="article-card" data-tags="${post.tags.map((t) => escapeHtml(t)).join(",")}" data-index="${i}">
            <div class="card-header">
                <time class="date">${formatDateTime(post.date)}</time>
                ${getDateModifiedBadge(post)}
                <div class="tags">
                    ${post.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
                </div>
            </div>
            <h2 class="card-title">${escapeHtml(post.title)}</h2>
            <p class="card-excerpt">${escapeHtml(post.excerpt)}</p>
        </a>`,
    )
    .join("\n");

  const tagLinks = tagEntries
    .map(([tag, count]) => {
      const isActive = tag === activeTag;
      const href = activeTag
        ? `../${encodeURIComponent(tag)}/`
        : `tag/${encodeURIComponent(tag)}/`;
      return `<a href="${href}" class="tag${isActive ? " tag-active" : ""}">${escapeHtml(tag)} (${count})</a>`;
    })
    .join("\n            ");

  const allHref = activeTag ? "../../" : "./";
  const isAll = !activeTag;

  return `${htmlHead(title, description, cssRelPath, {
    url: baseUrl,
    image: DEFAULT_OG_IMAGE,
    type: ogType,
  })}
    <div class="blog-page">
        ${breadcrumbHtml}
        <header class="header">
            <a href="https://antigravity-portal.com/" class="back-link">← トップに戻る</a>
            <h1 class="page-title">${escapeHtml(title)}</h1>
            <p class="page-desc">${escapeHtml(description)}</p>
        </header>

        <div class="tag-filter">
            <a href="${allHref}" class="tag${isAll ? " tag-active" : ""}">すべて (${posts.length})</a>
            ${tagLinks}
        </div>

        <section class="article-grid">
            ${cards}
        </section>

        <div class="pagination" id="pagination"></div>
    </div>
    <script>
    (function() {
        var PER_PAGE = 10;
        var STORAGE_KEY = 'blog-page:' + location.pathname;
        var storedPage = parseInt(sessionStorage.getItem(STORAGE_KEY), 10);
        var currentPage = storedPage > 0 ? storedPage : 1;
        var cards = Array.from(document.querySelectorAll('.article-card'));
        var pagination = document.getElementById('pagination');

        function render(scrollTop) {
            var totalPages = Math.ceil(cards.length / PER_PAGE);
            if (totalPages <= 0) totalPages = 1;
            if (currentPage > totalPages) currentPage = totalPages;
            sessionStorage.setItem(STORAGE_KEY, String(currentPage));
            var start = (currentPage - 1) * PER_PAGE;
            var end = start + PER_PAGE;

            cards.forEach(function(c, i) {
                c.style.display = (i >= start && i < end) ? '' : 'none';
            });

            if (scrollTop) window.scrollTo({ top: 0, behavior: 'smooth' });

            if (totalPages <= 1) {
                pagination.innerHTML = '';
                return;
            }

            var opts = '';
            for (var p = 1; p <= totalPages; p++) {
                opts += '<option value="' + p + '"' + (p === currentPage ? ' selected' : '') + '>' + p + ' / ' + totalPages + '</option>';
            }
            pagination.innerHTML =
                '<button class="page-btn page-arrow" id="pg-prev" ' + (currentPage <= 1 ? 'disabled' : '') + '>&#8249;</button>' +
                '<select class="page-select" id="pg-select">' + opts + '</select>' +
                '<button class="page-btn page-arrow" id="pg-next" ' + (currentPage >= totalPages ? 'disabled' : '') + '>&#8250;</button>';

            document.getElementById('pg-prev').addEventListener('click', function() {
                if (currentPage > 1) { currentPage--; render(true); }
            });
            document.getElementById('pg-next').addEventListener('click', function() {
                if (currentPage < totalPages) { currentPage++; render(true); }
            });
            document.getElementById('pg-select').addEventListener('change', function() {
                currentPage = parseInt(this.value);
                render(true);
            });
        }

        render(false);
    })();
    </script>
</body>
</html>`;
}

export function buildIndexPage() {
  const html = buildArticleListHtml(
    posts,
    "ブログ",
    "日記・レポート・技術記事の一覧",
    "styles.css",
    `${SITE_URL}/blog/`,
    "website",
    "",
    null,
  );
  writeFileSync(join(OUTPUT_DIR, "blog", "index.html"), html, "utf-8");
}

// ==========================================
// 個別記事ページ生成 (/blog/<slug>/index.html)
// ==========================================

export function buildArticlePages() {
  const contentPosts = posts.filter((p) => p.content);
  contentPosts.forEach((post, index) => {
    // 前後の記事（contentありのもの同士でナビゲーション）
    const prev = index > 0 ? contentPosts[index - 1] : null;
    const next =
      index < contentPosts.length - 1 ? contentPosts[index + 1] : null;

    // 相対パスのベースを計算（slugの階層分だけ../を重ねる）
    const depth = post.slug.split("/").length;
    const toRoot = "../".repeat(depth); // blog/ ルートへの相対パス

    // 関連記事（候補プールは全記事、前後ナビに出る2件は除外）
    const excludeSlugs = [prev?.slug, next?.slug].filter(Boolean);
    const related = findRelated(post, posts, { excludeSlugs });

    // 前後記事の相対リンクを計算
    const prevNav = next
      ? `
            <a href="${toRoot}${next.slug}/" class="post-nav-link">
                <span class="post-nav-label">← 前の記事</span>
                <span class="post-nav-title">${escapeHtml(next.title)}</span>
            </a>`
      : "";

    const nextNav = prev
      ? `
            <a href="${toRoot}${prev.slug}/" class="post-nav-link">
                <span class="post-nav-label">次の記事 →</span>
                <span class="post-nav-title">${escapeHtml(prev.title)}</span>
            </a>`
      : "";

    const cssRelPath = toRoot + "styles.css";

    // OGP用: 記事のヒーロー画像をcontentから抽出
    const heroMatch = post.content.match(/src="\/blog\/images\/([^"]+)"/);
    let ogImageFile = heroMatch ? heroMatch[1] : null;
    // .png → .webp に変換（OGP画像もWebP統一）
    if (ogImageFile)
      ogImageFile = ogImageFile
        .replace(/\.png$/i, ".webp")
        .replace(/\.jpe?g$/i, ".webp");
    const ogImage = ogImageFile
      ? `${SITE_URL}/blog/images/${ogImageFile}`
      : post.ogImage
        ? `${SITE_URL}/blog/images/${post.ogImage}`
        : DEFAULT_OG_IMAGE;
    const ogUrl = `${SITE_URL}/blog/${post.slug}/`;

    // 記事content内の絶対画像パスを相対パスに変換
    let content = post.content.replace(
      /src="\/blog\/images\//g,
      `src="${toRoot}images/`,
    );

    // 画像拡張子を .webp に自動変換（PNG/JPG → WebP）
    content = content.replace(
      /(src="[^"]*\/images\/[^"]+)\.(png|jpe?g)"/gi,
      '$1.webp"',
    );

    // テーブルをスクロール可能なラッパーで囲む（スマホ対応）
    content = content.replace(/<table/g, '<div class="table-scroll"><table');
    content = content.replace(/<\/table>/g, "</table></div>");

    // 記事中間に忍者AdMax挿入（最初の<hr>の後）
    const hrIndex = content.indexOf("<hr>");
    if (hrIndex !== -1) {
      const insertPos = hrIndex + "<hr>".length;
      content =
        content.slice(0, insertPos) +
        getNinjaAdHtml() +
        content.slice(insertPos);
    }

    const html = `${htmlHead(post.title, post.excerpt, cssRelPath, {
      url: ogUrl,
      image: ogImage,
      type: "article",
    })}
    <div class="article-page">
        <nav class="breadcrumb">
            <a href="https://antigravity-portal.com/">トップ</a>
            <span class="separator">/</span>
            <a href="${toRoot}">ブログ</a>
            <span class="separator">/</span>
            <span class="current">${escapeHtml(post.title)}</span>
        </nav>

        <article class="article">
            <header class="article-header">
                <div class="meta">
                    <time class="date">${formatDateTime(post.date)}</time>
                    ${getDateModifiedText(post)}
                    <div class="tags">
                        ${post.tags.map((tag) => `<a href="${toRoot}tag/${encodeURIComponent(tag)}/" class="tag">${escapeHtml(tag)}</a>`).join("")}
                    </div>
                </div>
                <h1 class="title">${escapeHtml(post.title)}</h1>
            </header>

            <div class="content">
                ${content}
            </div>

            ${getNoteBannerHtml(post)}
            ${getNinjaAdHtml()}
            ${getAmazonAdsHtml(post)}
        </article>
        ${getRelatedPostsHtml(related, toRoot)}

        <nav class="post-nav">
            <div class="post-nav-prev">${prevNav}</div>
            <div class="post-nav-next">${nextNav}</div>
        </nav>

        <nav class="back-nav">
            <a href="https://antigravity-portal.com/" class="back-link">🏠 TOPに戻る</a>
            <a href="${toRoot}" class="back-link">← 記事一覧に戻る</a>
        </nav>
    </div>
    ${getAdVisibilityScript()}
</body>
</html>`;

    // slug にはパス区切りがある (例: 202602/20260210_uber_first_day)
    const articleDir = join(OUTPUT_DIR, "blog", post.slug);
    mkdirSync(articleDir, { recursive: true });
    writeFileSync(join(articleDir, "index.html"), html, "utf-8");
  });
}

// ==========================================
// カテゴリ（タグ別）一覧ページ生成
// ==========================================

export function buildTagPages() {
  const tagEntries = collectTags(posts);
  mkdirSync(join(OUTPUT_DIR, "blog", "tag"), { recursive: true });

  for (const [tag, count] of tagEntries) {
    const tagPosts = posts.filter((p) => p.tags.includes(tag));
    const tagDir = join(OUTPUT_DIR, "blog", "tag", tag);
    mkdirSync(tagDir, { recursive: true });

    const breadcrumbHtml = `
        <nav class="breadcrumb">
            <a href="https://antigravity-portal.com/">トップ</a>
            <span class="separator">/</span>
            <a href="../../">ブログ</a>
            <span class="separator">/</span>
            <span class="current">${escapeHtml(tag)}</span>
        </nav>`;

    const html = buildArticleListHtml(
      tagPosts,
      `${tag} の記事一覧`,
      `「${tag}」タグが付いた記事 ${count}件`,
      "../../styles.css",
      `${SITE_URL}/blog/tag/${encodeURIComponent(tag)}/`,
      "website",
      breadcrumbHtml,
      tag,
    );
    writeFileSync(join(tagDir, "index.html"), html, "utf-8");
  }
  curStats.tagCount = tagEntries.length;
  if (prevStats.tagCount !== tagEntries.length) {
    const diff =
      prevStats.tagCount != null
        ? ` (${tagEntries.length > prevStats.tagCount ? "+" : ""}${tagEntries.length - prevStats.tagCount})`
        : "";
    console.log(`🏷️  カテゴリ ${tagEntries.length}件${diff}`);
  }
}

// ==========================================
// RSSフィード生成 (dist/blog/feed.xml)
// ==========================================

export function buildRssFeed() {
  const FEED_TITLE = "Gravity Portal ブログ";
  const FEED_DESC =
    "パチンコ分析・AI開発・Uber配達の個人開発ポータル Gravity Portal の最新記事";

  function escapeXml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function toRfc822(dateStr) {
    const d = new Date(`${dateStr}T00:00:00+09:00`);
    return d.toUTCString();
  }

  const feedPosts = metaOnly.slice(0, 20);
  const lastBuildDate =
    feedPosts.length > 0
      ? toRfc822(feedPosts[0].date)
      : new Date().toUTCString();

  const items = feedPosts
    .map((post) => {
      const url = `${SITE_URL}/blog/${post.slug}/`;
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
    <link>${SITE_URL}/blog</link>
    <description>${escapeXml(FEED_DESC)}</description>
    <language>ja</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <managingEditor>hahu1124 (Gravity Portal)</managingEditor>
    <atom:link href="${SITE_URL}/blog/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  const feedPath = join(OUTPUT_DIR, "blog", "feed.xml");
  writeFileSync(feedPath, xml, "utf-8");
}
