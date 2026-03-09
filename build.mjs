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
const ARTICLES_DIR = join(__dirname, 'src', 'articles');
const OUTPUT_DIR = join(__dirname, 'dist');

// blog-data.json 読み込み（メタデータ）+ 個別HTMLファイルからcontent結合
const posts = JSON.parse(readFileSync(BLOG_DATA_PATH, 'utf-8')).map(post => {
    const articlePath = join(ARTICLES_DIR, `${post.slug}.html`);
    if (existsSync(articlePath)) {
        post.content = readFileSync(articlePath, 'utf-8');
    }
    return post;
});

console.log(`📝 ${posts.length} 記事を処理中（content: ${posts.filter(p => p.content).length} 件）...`);

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
const staticTools = ['convergence', 'simulator', 'machine-db', 'data', 'idle-game', 'quiz', 'general-quiz', 'lab'];
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
// 忍者AdMax 設定
// ==========================================

const NINJA_AD_ID = '06dfeeba49e20207a86cd5f651221d50';
const ADMAX_SCRIPT_URL = 'https://adm.shinobi.jp/st/t.js';

// ==========================================
// 共通HTMLテンプレート
// ==========================================

const SITE_URL = 'https://www.antigravity-portal.com';
const DEFAULT_OG_IMAGE = `${SITE_URL}/blog/images/ai_dev_day1.png`;

/**
 * 共通HTMLヘッド生成
 * @param {string} title - ページタイトル
 * @param {string} description - ページ説明
 * @param {string} cssRelPath - CSSの相対パス
 * @param {Object} [ogp] - OGP/Twitter Card情報
 * @param {string} [ogp.url] - ページURL
 * @param {string} [ogp.image] - OG画像の絶対URL
 * @param {string} [ogp.type] - og:type ('article' or 'website')
 */
function htmlHead(title, description, cssRelPath = 'styles.css', ogp = {}) {
    const cacheBust = Date.now();
    const ogTitle = escapeHtml(title);
    const ogDesc = escapeHtml(description);
    const ogUrl = ogp.url || SITE_URL;
    const ogImage = ogp.image || DEFAULT_OG_IMAGE;
    const ogType = ogp.type || 'website';
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${ogTitle} | Gravity Portal</title>
    <meta name="description" content="${ogDesc}">
    <!-- OGP -->
    <meta property="og:title" content="${ogTitle}">
    <meta property="og:description" content="${ogDesc}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:url" content="${ogUrl}">
    <meta property="og:type" content="${ogType}">
    <meta property="og:site_name" content="Gravity Portal">
    <meta property="og:locale" content="ja_JP">
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${ogTitle}">
    <meta name="twitter:description" content="${ogDesc}">
    <meta name="twitter:image" content="${ogImage}">
    <link rel="stylesheet" href="${cssRelPath}?v=${cacheBust}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="preconnect" href="https://adm.shinobi.jp">
    <link rel="preconnect" href="https://cnobi.jp">
    <link rel="dns-prefetch" href="https://adm.shinobi.jp">
    <link rel="dns-prefetch" href="https://cnobi.jp">
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
// 忍者AdMax 広告HTML生成
// ==========================================

/** 記事内インライン広告（中間・末尾用）— 広告未返却時は後から非表示 */
function getNinjaAdHtml() {
    return `
        <div class="ninja-ad-slot">
            <span class="ninja-ad-label">PR</span>
            <div class="admax-switch" data-admax-id="${NINJA_AD_ID}" style="display:inline-block;"></div>
        </div>`;
}

/** スライドイン広告（左から出現、×で閉じる）— 広告未返却時は表示しない */
function getSlideInAdHtml() {
    return `
    <div id="slideInAd" class="ninja-slide-ad" style="display:none;">
        <button id="slideInClose" class="ninja-slide-close" aria-label="閉じる">×</button>
        <span class="ninja-ad-label">PR</span>
        <div class="admax-switch" data-admax-id="${NINJA_AD_ID}" style="display:inline-block;"></div>
    </div>
    <script>
    (function(){
        if(sessionStorage.getItem('slideAdClosed')) return;
        // 広告が読み込まれたかチェックしてから表示
        function tryShow(){
            var ad=document.getElementById('slideInAd');
            if(!ad) return;
            var sw=ad.querySelector('.admax-switch');
            if(sw && sw.children.length > 0){
                ad.style.display='block';
            }
        }
        setTimeout(tryShow, 5000);
        setTimeout(tryShow, 8000);
        document.getElementById('slideInClose').addEventListener('click',function(){
            document.getElementById('slideInAd').style.display='none';
            sessionStorage.setItem('slideAdClosed','1');
        });
    })()
    </script>`;
}

/** 広告初期化スクリプト（課金チェック→未課金のみSDKロード） */
function getAdVisibilityScript() {
    return `
    <script>
    (function(){
        var AD_ID = '${NINJA_AD_ID}';
        var SDK_URL = '${ADMAX_SCRIPT_URL}';

        // 課金チェック → 課金済みなら広告を全て非表示にしてSDKも読み込まない
        function hideAllAds(){
            document.querySelectorAll('.ninja-ad-slot').forEach(function(slot){
                slot.style.display = 'none';
            });
        }

        function initAds(){
            // 1. admaxads配列にスロットを登録
            if(!window.admaxads) window.admaxads = [];
            document.querySelectorAll('.admax-switch[data-admax-id]').forEach(function(el){
                window.admaxads.push({ admax_id: el.getAttribute('data-admax-id'), type: 'switch' });
            });

            // 2. SDKをロード（body末尾で1回だけ実行）
            var s = document.createElement('script');
            s.type = 'text/javascript';
            s.charset = 'utf-8';
            s.src = SDK_URL;
            s.async = true;
            document.body.appendChild(s);

            // 3. 広告が返らなかったスロットを非表示に（遅延チェック）
            function checkAdSlots(){
                document.querySelectorAll('.ninja-ad-slot').forEach(function(slot){
                    var ad = slot.querySelector('.admax-switch');
                    if(ad && ad.children.length > 0){
                        slot.classList.add('ad-loaded');
                    } else {
                        slot.style.display = 'none';
                    }
                });
            }
            setTimeout(checkAdSlots, 5000);
            setTimeout(checkAdSlots, 10000);
        }

        // 課金状態をチェック（同一ドメインのAPI）
        fetch('/api/subscription-status')
            .then(function(res){ return res.json(); })
            .then(function(data){
                if(data && data.isPaid){
                    hideAllAds();
                } else {
                    initAds();
                }
            })
            .catch(function(){
                // エラー時は広告を表示（未課金扱い）
                initAds();
            });
    })()
    </script>`;
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

/** AI/開発記事向け */
const AI_DEV_ADS = [
    { title: 'AIプログラミング入門', search: 'AI プログラミング 入門 Python', emoji: '🤖' },
    { title: 'Next.js実践ガイド', search: 'Next.js React TypeScript 入門', emoji: '📘' },
    { title: 'Webアプリ開発入門', search: 'Webアプリケーション 開発 入門', emoji: '💻' },
];

function amazonSearchUrl(keyword) {
    return `https://www.amazon.co.jp/s?k=${encodeURIComponent(keyword)}&tag=${AMAZON_TAG}`;
}

function getAmazonAdsHtml(post) {
    const tags = post.tags || [];
    const isWeekly = tags.includes('週報');
    const isUber = tags.includes('Uber');
    const isPachinko = tags.includes('パチンコ');
    const isAI = tags.includes('AI');
    const isDev = tags.includes('開発');
    const isTech = tags.includes('技術') || tags.includes('PWA');

    // 広告商品を選択（記事のタグに基づく）
    let items;
    let sectionTitle;
    if (isAI || isDev || isTech) {
        items = AI_DEV_ADS;
        sectionTitle = '💻 技術書・開発に役立つ本';
    } else if (isWeekly || (isUber && isPachinko)) {
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
// Note有料記事 導線バナー（AI開発シリーズ専用）
// ==========================================

const NOTE_ARTICLE_URL = 'https://note.com/hahu1124/n/n499b03461f85';

/** AI開発シリーズ記事にNote導線バナーを挿入 */
function getNoteBannerHtml(post) {
    // タイトルに「AIと1週間で」を含む記事のみ
    if (!post.title.includes('AIと1週間で')) return '';
    return `
        <div class="note-banner">
            <div class="note-banner-icon">📖</div>
            <div class="note-banner-body">
                <p class="note-banner-title">この記事の<strong>完全版</strong>をNoteで公開中</p>
                <p class="note-banner-desc">ブログでは書けなかった裏話・具体的な設定値・失敗のリカバリー手順まで、全5章5,500文字超の詳細版です。</p>
                <a href="${NOTE_ARTICLE_URL}" target="_blank" rel="noopener noreferrer" class="note-banner-link">📝 Noteで完全版を読む（¥500）</a>
            </div>
        </div>`;
}

// ==========================================
// 記事一覧ページ生成 (/blog/index.html)
// ==========================================

function buildIndexPage() {
    // タグを動的に収集（重複なし、出現頻度順）
    const tagCounts = {};
    posts.forEach(post => {
        post.tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });
    const allTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([tag]) => tag);

    const cards = posts.map((post, i) => `
        <a href="${post.slug}/" class="article-card" data-tags="${post.tags.map(t => escapeHtml(t)).join(',')}" data-index="${i}">
            <div class="card-header">
                <time class="date">${post.date}</time>
                <div class="tags">
                    ${post.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            </div>
            <h2 class="card-title">${escapeHtml(post.title)}</h2>
            <p class="card-excerpt">${escapeHtml(post.excerpt)}</p>
        </a>`).join('\n');

    const tagButtons = allTags.map(tag =>
        `<button class="tag" data-filter="${escapeHtml(tag)}">${escapeHtml(tag)} (${tagCounts[tag]})</button>`
    ).join('\n            ');

    const html = `${htmlHead('ブログ', '日記・レポート・技術記事の一覧', 'styles.css', {
        url: `${SITE_URL}/blog/`,
        image: DEFAULT_OG_IMAGE,
        type: 'website'
    })}
    <div class="blog-page">
        <header class="header">
            <a href="https://antigravity-portal.com/" class="back-link">← トップに戻る</a>
            <h1 class="page-title">ブログ</h1>
            <p class="page-desc">日記・レポート・技術記事</p>
        </header>

        <div class="tag-filter">
            <button class="tag tag-active" data-filter="all">すべて (${posts.length})</button>
            ${tagButtons}
        </div>

        <section class="article-grid">
            ${cards}
        </section>

        <nav class="pagination" id="pagination"></nav>
    </div>
    <script>
    (function() {
        var PER_PAGE = 10;
        var currentTag = 'all';
        var currentPage = 1;
        var cards = Array.from(document.querySelectorAll('.article-card'));
        var pagination = document.getElementById('pagination');
        var tagBtns = document.querySelectorAll('.tag-filter .tag');

        function getFiltered() {
            if (currentTag === 'all') return cards;
            return cards.filter(function(c) {
                return c.dataset.tags.split(',').indexOf(currentTag) !== -1;
            });
        }

        function render() {
            var filtered = getFiltered();
            var totalPages = Math.ceil(filtered.length / PER_PAGE);
            if (currentPage > totalPages) currentPage = totalPages || 1;
            var start = (currentPage - 1) * PER_PAGE;
            var end = start + PER_PAGE;

            cards.forEach(function(c) { c.style.display = 'none'; });
            filtered.forEach(function(c, i) {
                c.style.display = (i >= start && i < end) ? '' : 'none';
            });

            // ページネーション描画
            var html = '';
            if (totalPages > 1) {
                if (currentPage > 1) {
                    html += '<button class="page-btn" data-page="' + (currentPage - 1) + '">← 前</button>';
                }
                for (var p = 1; p <= totalPages; p++) {
                    html += '<button class="page-btn' + (p === currentPage ? ' page-active' : '') + '" data-page="' + p + '">' + p + '</button>';
                }
                if (currentPage < totalPages) {
                    html += '<button class="page-btn" data-page="' + (currentPage + 1) + '">次 →</button>';
                }
            }
            pagination.innerHTML = html;
        }

        // タグフィルタ
        tagBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                tagBtns.forEach(function(b) { b.classList.remove('tag-active'); });
                btn.classList.add('tag-active');
                currentTag = btn.dataset.filter;
                currentPage = 1;
                render();
            });
        });

        // ページネーションクリック
        pagination.addEventListener('click', function(e) {
            if (e.target.dataset.page) {
                currentPage = parseInt(e.target.dataset.page);
                render();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        render();
    })();
    </script>
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
        // contentがない記事（メタデータのみ）はスキップ
        if (!post.content) {
            console.log(`⏭️  ${post.slug} — contentなし、スキップ`);
            return;
        }

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

        // OGP用: 記事のヒーロー画像をcontentから抽出
        const heroMatch = post.content.match(/src="\/blog\/images\/([^"]+)"/);
        const ogImage = heroMatch
            ? `${SITE_URL}/blog/images/${heroMatch[1]}`
            : DEFAULT_OG_IMAGE;
        const ogUrl = `${SITE_URL}/blog/${post.slug}/`;

        // 記事content内の絶対画像パスを相対パスに変換
        let content = post.content.replace(/src="\/blog\/images\//g, `src="${toRoot}images/`);

        // テーブルをスクロール可能なラッパーで囲む（スマホ対応）
        content = content.replace(/<table/g, '<div class="table-scroll"><table');
        content = content.replace(/<\/table>/g, '</table></div>');

        // 記事中間に忍者AdMax挿入（最初の<hr>の後）
        const hrIndex = content.indexOf('<hr>');
        if (hrIndex !== -1) {
            const insertPos = hrIndex + '<hr>'.length;
            content = content.slice(0, insertPos) + getNinjaAdHtml() + content.slice(insertPos);
        }

        const html = `${htmlHead(post.title, post.excerpt, cssRelPath, {
            url: ogUrl,
            image: ogImage,
            type: 'article'
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

            ${getNoteBannerHtml(post)}
            ${getNinjaAdHtml()}
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
    ${getAdVisibilityScript()}
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
