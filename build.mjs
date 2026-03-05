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

// blog-data.json（メタデータのみ版）をdistに出力（Vercel側からfetch用）
const metaOnly = posts.map(({ slug, title, date, excerpt, tags }) => ({ slug, title, date, excerpt, tags }));
writeFileSync(join(OUTPUT_DIR, 'blog-data.json'), JSON.stringify(metaOnly), 'utf-8');
console.log('📦 blog-data.json (メタデータ版) 出力完了');

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

// 静的ツールをコピー（convergence, simulator, machine-db等）
const staticTools = ['convergence', 'simulator', 'machine-db', 'data'];
for (const tool of staticTools) {
    const toolSrc = join(__dirname, 'src', tool);
    const toolDst = join(OUTPUT_DIR, tool);
    if (existsSync(toolSrc)) {
        mkdirSync(toolDst, { recursive: true });
        cpSync(toolSrc, toolDst, { recursive: true });
        console.log(`🔧 ${tool} コピー完了`);
    }
}

// ==========================================
// 共通HTMLテンプレート
// ==========================================

function htmlHead(title, description, cssRelPath = 'styles.css') {
    const cacheBust = Date.now();
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} | Gravity Portal</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="stylesheet" href="${cssRelPath}?v=${cacheBust}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <script>
        (function(){try{var t=localStorage.getItem('gp-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()
    </script>
</head>
<body>
    <!-- テーマ切替ボタン（Gravity Portal本体と同期） -->
    <button class="blog-theme-toggle" id="themeToggle" aria-label="テーマ切替">🌙</button>
    <script>
        (function(){
            var btn=document.getElementById('themeToggle');
            function update(){var t=document.documentElement.getAttribute('data-theme');btn.textContent=t==='light'?'🌙':'☀️'}
            update();
            btn.addEventListener('click',function(){
                var cur=document.documentElement.getAttribute('data-theme');
                var next=cur==='light'?'dark':'light';
                document.documentElement.setAttribute('data-theme',next);
                try{localStorage.setItem('gp-theme',next)}catch(e){}
                update();
            });
        })()
    </script>`;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ==========================================
// Amazon アフィリエイト広告（記事末尾挿入）
// ==========================================

const AMAZON_TAG = 'gravity063-22';

/** Uber配達で使うもの一覧（記事1-2・週報向け） */
const UBER_GEAR_ADS = [
    { title: 'モバイルバッテリー', search: 'モバイルバッテリー 大容量 急速充電', emoji: '🔋' },
    { title: 'スマホホルダー（車用）', search: 'スマホホルダー 車 エアコン吹き出し口', emoji: '📱' },
    { title: '保温・保冷バッグ', search: 'デリバリー 保温バッグ 配達', emoji: '🧊' },
    { title: 'USB充電ケーブル', search: 'USB-C 充電ケーブル 車用 急速', emoji: '🔌' },
    { title: '腰痛対策クッション', search: '車用 腰痛 クッション シートクッション', emoji: '💺' },
    { title: '飲み物ホルダー（保温）', search: 'タンブラー 保温 ドリンクホルダー 車', emoji: '☕' },
];

/** Uber日報向け（コンパクト版） */
const UBER_DAILY_ADS = [
    { title: 'モバイルバッテリー', search: 'モバイルバッテリー 大容量', emoji: '🔋' },
    { title: 'スマホホルダー', search: 'スマホホルダー 車用', emoji: '📱' },
    { title: '保温バッグ', search: 'デリバリー 保温バッグ', emoji: '🧊' },
];

/** パチンコ記事向け */
const PACHINKO_ADS = [
    { title: 'パチンコ攻略マガジン', search: 'パチンコ攻略マガジン', emoji: '📖' },
    { title: 'パチンコ攻略年鑑 2026', search: 'パチンコ必勝ガイド 攻略年鑑 2026', emoji: '📕' },
    { title: '確率論入門', search: '確率論 入門 数学', emoji: '📐' },
];

function amazonSearchUrl(keyword) {
    return `https://www.amazon.co.jp/s?k=${encodeURIComponent(keyword)}&tag=${AMAZON_TAG}`;
}

function getAmazonAdsHtml(post) {
    const tags = post.tags || [];
    const isWeekly = tags.includes('週報');
    const isUber = tags.includes('Uber');
    const isPachinko = tags.includes('パチンコ');

    // 広告商品を選択
    let items;
    let sectionTitle;
    if (isWeekly || (isUber && isPachinko)) {
        items = UBER_GEAR_ADS;
        sectionTitle = '🚗 Uber配達で使うもの一覧';
    } else if (isUber) {
        items = UBER_DAILY_ADS;
        sectionTitle = '🚗 配達に役立つアイテム';
    } else if (isPachinko) {
        items = PACHINKO_ADS;
        sectionTitle = '📚 パチンコ攻略に役立つ本';
    } else {
        items = UBER_DAILY_ADS;
        sectionTitle = '📦 おすすめアイテム';
    }

    const itemCards = items.map(item => `
        <a href="${amazonSearchUrl(item.search)}" target="_blank" rel="noopener noreferrer" class="amazon-ad-card">
            <span class="amazon-ad-emoji">${item.emoji}</span>
            <span class="amazon-ad-title">${escapeHtml(item.title)}</span>
            <span class="amazon-ad-badge">Amazonで見る</span>
        </a>`).join('\n');

    return `
        <div class="amazon-ads-section">
            <h3 class="amazon-ads-heading">${sectionTitle}</h3>
            <div class="amazon-ads-grid">
                ${itemCards}
            </div>
            <div class="amazon-search-box">
                <p class="amazon-search-label">🔍 Amazonで探す</p>
                <form onsubmit="window.open('https://www.amazon.co.jp/s?k='+encodeURIComponent(this.q.value)+'&tag=${AMAZON_TAG}','_blank');return false;" class="amazon-search-form">
                    <input type="text" name="q" placeholder="キーワードを入力..." class="amazon-search-input" />
                    <button type="submit" class="amazon-search-btn">検索</button>
                </form>
            </div>
            <p class="amazon-ads-note">※ 上記リンクはAmazonアソシエイトリンクです</p>
        </div>`;
}

// ==========================================
// 記事一覧ページ生成 (/blog/index.html)
// ==========================================

function buildIndexPage() {
    const cards = posts.map(post => `
        <a href="${post.slug}/" class="article-card">
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

        // 相対パスのベースを計算（slugの階層分だけ../を重ねる）
        const depth = post.slug.split('/').length;
        const toRoot = '../'.repeat(depth);  // blog/ ルートへの相対パス

        // 前後記事の相対リンクを計算
        const prevNav = next ? `
            <a href="${toRoot}${next.slug}/" class="post-nav-link">
                <span class="post-nav-label">← 前の記事</span>
                <span class="post-nav-title">${escapeHtml(next.title)}</span>
            </a>` : '';

        const nextNav = prev ? `
            <a href="${toRoot}${prev.slug}/" class="post-nav-link">
                <span class="post-nav-label">次の記事 →</span>
                <span class="post-nav-title">${escapeHtml(prev.title)}</span>
            </a>` : '';

        const cssRelPath = toRoot + 'styles.css';

        // 記事content内の絶対画像パスを相対パスに変換
        const content = post.content.replace(/src="\/blog\/images\//g, `src="${toRoot}images/`);

        const html = `${htmlHead(post.title, post.excerpt, cssRelPath)}
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
                    <time class="date">${post.date}</time>
                    <div class="tags">
                        ${post.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                    </div>
                </div>
                <h1 class="title">${escapeHtml(post.title)}</h1>
            </header>

            <div class="content">
                ${content}
            </div>

            ${getAmazonAdsHtml(post)}
        </article>

        <nav class="post-nav">
            <div class="post-nav-prev">${prevNav}</div>
            <div class="post-nav-next">${nextNav}</div>
        </nav>

        <nav class="back-nav">
            <a href="https://antigravity-portal.com/" class="back-link">🏠 TOPに戻る</a>
            <a href="${toRoot}" class="back-link">← 記事一覧に戻る</a>
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
