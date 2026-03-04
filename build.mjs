#!/usr/bin/env node
/**
 * blog-data.json → 静的HTML生成スクリプト
 * GitHub Pages用のブログサイトを生成する
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ソースパス
const BLOG_DATA_PATH = join(__dirname, 'src', 'blog-data.json');
const OUTPUT_DIR = join(__dirname, 'dist');

// blog-data.json 読み込み
const posts = JSON.parse(readFileSync(BLOG_DATA_PATH, 'utf-8'));

console.log(`📝 ${posts.length} 記事を処理中...`);

// 出力ディレクトリ作成
mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(join(OUTPUT_DIR, 'blog'), { recursive: true });

// 画像をコピー
const imgSrc = join(__dirname, 'src', 'images');
const imgDst = join(OUTPUT_DIR, 'blog', 'images');
if (existsSync(imgSrc)) {
    mkdirSync(imgDst, { recursive: true });
    cpSync(imgSrc, imgDst, { recursive: true });
    console.log('🖼️  画像コピー完了');
}

// CSSをコピー
const cssSrc = join(__dirname, 'src', 'styles.css');
const cssDst = join(OUTPUT_DIR, 'blog', 'styles.css');
if (existsSync(cssSrc)) {
    cpSync(cssSrc, cssDst);
    console.log('🎨 CSSコピー完了');
}

// ==========================================
// 共通HTMLテンプレート
// ==========================================

function htmlHead(title, description) {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} | Gravity Portal</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="stylesheet" href="/blog/styles.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body>`;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ==========================================
// 記事一覧ページ生成 (/blog/index.html)
// ==========================================

function buildIndexPage() {
    const cards = posts.map(post => `
        <a href="/blog/${post.slug}" class="article-card">
            <div class="card-header">
                <time class="date">${post.date}</time>
                <div class="tags">
                    ${post.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            </div>
            <h2 class="card-title">${escapeHtml(post.title)}</h2>
            <p class="card-excerpt">${escapeHtml(post.excerpt)}</p>
        </a>`).join('\n');

    const html = `${htmlHead('ブログ', '日記・レポート・技術記事の一覧')}
    <div class="blog-page">
        <header class="header">
            <a href="https://antigravity-portal.com/" class="back-link">← トップに戻る</a>
            <h1 class="page-title">ブログ</h1>
            <p class="page-desc">日記・レポート・技術記事</p>
        </header>

        <div class="tag-filter">
            <span class="tag tag-active">すべて</span>
            <span class="tag">Uber</span>
            <span class="tag">日報</span>
            <span class="tag">週報</span>
            <span class="tag">パチンコ</span>
        </div>

        <section class="article-grid">
            ${cards}
        </section>
    </div>
</body>
</html>`;

    writeFileSync(join(OUTPUT_DIR, 'blog', 'index.html'), html, 'utf-8');
    console.log('📄 一覧ページ生成完了');
}

// ==========================================
// 個別記事ページ生成 (/blog/<slug>/index.html)
// ==========================================

function buildArticlePages() {
    posts.forEach((post, index) => {
        // 前後の記事（postsは新しい順）
        const prev = index > 0 ? posts[index - 1] : null;
        const next = index < posts.length - 1 ? posts[index + 1] : null;

        const prevNav = next ? `
            <a href="/blog/${next.slug}" class="post-nav-link">
                <span class="post-nav-label">← 前の記事</span>
                <span class="post-nav-title">${escapeHtml(next.title)}</span>
            </a>` : '';

        const nextNav = prev ? `
            <a href="/blog/${prev.slug}" class="post-nav-link">
                <span class="post-nav-label">次の記事 →</span>
                <span class="post-nav-title">${escapeHtml(prev.title)}</span>
            </a>` : '';

        const html = `${htmlHead(post.title, post.excerpt)}
    <div class="article-page">
        <nav class="breadcrumb">
            <a href="https://antigravity-portal.com/">トップ</a>
            <span class="separator">/</span>
            <a href="/blog">ブログ</a>
            <span class="separator">/</span>
            <span class="current">${escapeHtml(post.title)}</span>
        </nav>

        <article class="article">
            <header class="article-header">
                <div class="meta">
                    <time class="date">${post.date}</time>
                    <div class="tags">
                        ${post.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                    </div>
                </div>
                <h1 class="title">${escapeHtml(post.title)}</h1>
            </header>

            <div class="content">
                ${post.content}
            </div>
        </article>

        <nav class="post-nav">
            <div class="post-nav-prev">${prevNav}</div>
            <div class="post-nav-next">${nextNav}</div>
        </nav>

        <nav class="back-nav">
            <a href="https://antigravity-portal.com/" class="back-link">🏠 TOPに戻る</a>
            <a href="/blog" class="back-link">← 記事一覧に戻る</a>
        </nav>
    </div>
</body>
</html>`;

        // slug にはパス区切りがある (例: 202602/20260210_uber_first_day)
        const articleDir = join(OUTPUT_DIR, 'blog', post.slug);
        mkdirSync(articleDir, { recursive: true });
        writeFileSync(join(articleDir, 'index.html'), html, 'utf-8');
    });

    console.log(`📄 ${posts.length} 記事ページ生成完了`);
}

// ==========================================
// 実行
// ==========================================

buildIndexPage();
buildArticlePages();

console.log('✅ ビルド完了！ dist/ に出力されました');
