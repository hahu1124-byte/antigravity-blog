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
const staticTools = ['convergence', 'simulator', 'machine-db', 'data', 'idle-game', 'quiz', 'general-quiz', 'lab', 'bgm-maker', 'static-pages'];
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
// 更新日表示ヘルパー
// ==========================================

const BUILD_DATE = new Date();

/** 日付/日時文字列をフォーマット（時間があれば表示） */
function formatDateTime(dateStr) {
    if (!dateStr) return '';
    // "YYYY-MM-DD HH:MM" 形式
    if (dateStr.length > 10) {
        const [datePart, timePart] = dateStr.split(' ');
        return `${datePart} ${timePart}`;
    }
    // "YYYY-MM-DD" 形式
    return dateStr;
}

/** dateModified > date の場合、更新バッジHTMLを返す */
function getDateModifiedBadge(post) {
    if (!post.dateModified || post.dateModified === post.date) return '';
    const modStr = post.dateModified.length > 10 ? post.dateModified.slice(0, 10) : post.dateModified;
    const mod = new Date(modStr + 'T00:00:00+09:00');
    const diffMs = BUILD_DATE - mod;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    let label;
    if (diffDays <= 0) label = '今日更新';
    else if (diffDays === 1) label = '昨日更新';
    else if (diffDays <= 7) label = `${diffDays}日前に更新`;
    else if (diffDays <= 30) label = `${Math.floor(diffDays / 7)}週間前に更新`;
    else return '';
    return `<span class="date-modified-badge">🔄 ${label}</span>`;
}

/** 記事詳細ヘッダー用: 最終更新日テキスト */
function getDateModifiedText(post) {
    if (!post.dateModified || post.dateModified === post.date) return '';
    return `<time class="date-modified">最終更新: ${formatDateTime(post.dateModified)}</time>`;
}

/** タグ収集ユーティリティ */
function collectTags(postList) {
    const tagCounts = {};
    postList.forEach(post => {
        post.tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });
    return Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1]);
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
                <p class="amazon-search-label">🔍 <span class="amazon-logo-text">Amazon</span>で探す</p>
                <form onsubmit="window.open('https://www.amazon.co.jp/s?k='+encodeURIComponent(this.q.value)+'&tag=${AMAZON_TAG}','_blank');return false;" class="amazon-search-form">
                    <input type="text" name="q" placeholder="キーワードを入力..." class="amazon-search-input" />
                    <button type="submit" class="amazon-search-btn">検索</button>
                </form>
            </div>
            <p class="amazon-ads-note">※ 上記リンクはAmazonアソシエイトリンクです</p>
            <p class="amazon-ads-note">Amazonのアソシエイトとして、Gravity Portalは適格販売により収入を得ています。</p>
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

function buildArticleListHtml(postList, title, description, cssRelPath, baseUrl, ogType, breadcrumbHtml, activeTag) {
    const tagEntries = collectTags(posts);  // 全記事からタグ収集（全体カウント表示用）

    const cards = postList.map((post, i) => `
        <a href="${activeTag ? `../../${post.slug}/` : `${post.slug}/`}" class="article-card" data-tags="${post.tags.map(t => escapeHtml(t)).join(',')}" data-index="${i}">
            <div class="card-header">
                <time class="date">${formatDateTime(post.date)}</time>
                ${getDateModifiedBadge(post)}
                <div class="tags">
                    ${post.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            </div>
            <h2 class="card-title">${escapeHtml(post.title)}</h2>
            <p class="card-excerpt">${escapeHtml(post.excerpt)}</p>
        </a>`).join('\n');

    const tagLinks = tagEntries.map(([tag, count]) => {
        const isActive = tag === activeTag;
        const href = activeTag ? `../${encodeURIComponent(tag)}/` : `tag/${encodeURIComponent(tag)}/`;
        return `<a href="${href}" class="tag${isActive ? ' tag-active' : ''}">${escapeHtml(tag)} (${count})</a>`;
    }).join('\n            ');

    const allHref = activeTag ? '../../' : './';
    const isAll = !activeTag;

    return `${htmlHead(title, description, cssRelPath, {
        url: baseUrl,
        image: DEFAULT_OG_IMAGE,
        type: ogType
    })}
    <div class="blog-page">
        ${breadcrumbHtml}
        <header class="header">
            <a href="https://antigravity-portal.com/" class="back-link">← トップに戻る</a>
            <h1 class="page-title">${escapeHtml(title)}</h1>
            <p class="page-desc">${escapeHtml(description)}</p>
        </header>

        <div class="tag-filter">
            <a href="${allHref}" class="tag${isAll ? ' tag-active' : ''}">すべて (${posts.length})</a>
            ${tagLinks}
        </div>

        <section class="article-grid">
            ${cards}
        </section>

        <nav class="pagination" id="pagination"></nav>
    </div>
    <script>
    (function() {
        var PER_PAGE = 10;
        var currentPage = 1;
        var cards = Array.from(document.querySelectorAll('.article-card'));
        var pagination = document.getElementById('pagination');

        function render() {
            var totalPages = Math.ceil(cards.length / PER_PAGE);
            if (currentPage > totalPages) currentPage = totalPages || 1;
            var start = (currentPage - 1) * PER_PAGE;
            var end = start + PER_PAGE;

            cards.forEach(function(c, i) {
                c.style.display = (i >= start && i < end) ? '' : 'none';
            });

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
}

function buildIndexPage() {
    const html = buildArticleListHtml(
        posts,
        'ブログ',
        '日記・レポート・技術記事の一覧',
        'styles.css',
        `${SITE_URL}/blog/`,
        'website',
        '',
        null
    );
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
                    <time class="date">${formatDateTime(post.date)}</time>
                    ${getDateModifiedText(post)}
                    <div class="tags">
                        ${post.tags.map(tag => `<a href="${toRoot}tag/${encodeURIComponent(tag)}/" class="tag">${escapeHtml(tag)}</a>`).join('')}
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
// カテゴリ（タグ別）一覧ページ生成
// ==========================================

function buildTagPages() {
    const tagEntries = collectTags(posts);
    mkdirSync(join(OUTPUT_DIR, 'blog', 'tag'), { recursive: true });

    for (const [tag, count] of tagEntries) {
        const tagPosts = posts.filter(p => p.tags.includes(tag));
        const tagDir = join(OUTPUT_DIR, 'blog', 'tag', tag);
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
            '../../styles.css',
            `${SITE_URL}/blog/tag/${encodeURIComponent(tag)}/`,
            'website',
            breadcrumbHtml,
            tag
        );
        writeFileSync(join(tagDir, 'index.html'), html, 'utf-8');
    }
    console.log(`🏷️  ${tagEntries.length} カテゴリページ生成完了`);
}

// ==========================================
// RSSフィード生成 (dist/blog/feed.xml)
// ==========================================

function buildRssFeed() {
    const FEED_TITLE = 'Gravity Portal ブログ';
    const FEED_DESC = 'パチンコ分析・AI開発・Uber配達の個人開発ポータル Gravity Portal の最新記事';

    function escapeXml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function toRfc822(dateStr) {
        const d = new Date(`${dateStr}T00:00:00+09:00`);
        return d.toUTCString();
    }

    const feedPosts = metaOnly.slice(0, 20);
    const lastBuildDate = feedPosts.length > 0 ? toRfc822(feedPosts[0].date) : new Date().toUTCString();

    const items = feedPosts.map(post => {
        const url = `${SITE_URL}/blog/${post.slug}/`;
        const categories = (post.tags || [])
            .map(tag => `        <category>${escapeXml(tag)}</category>`)
            .join('\n');
        return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${toRfc822(post.date)}</pubDate>
      <description>${escapeXml(post.excerpt)}</description>
${categories}
    </item>`;
    }).join('\n');

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

    const feedPath = join(OUTPUT_DIR, 'blog', 'feed.xml');
    writeFileSync(feedPath, xml, 'utf-8');
    console.log(`📡 RSSフィード生成完了: ${feedPosts.length}件`);
}

// ==========================================
// 機種SEO個別ページ生成 (/machine-db/[slug]/index.html)
// ==========================================

function buildMachinePages() {
    const MACHINES_PATH = join(__dirname, 'src', 'data', 'machines.json');
    if (!existsSync(MACHINES_PATH)) {
        console.log('⏭️  machines.json なし — 機種ページ生成スキップ');
        return;
    }

    const mData = JSON.parse(readFileSync(MACHINES_PATH, 'utf-8'));
    const machines = (mData.machines || []).filter(m => m.prob > 0 && m.rb > 0 && m.name);

    function toSlug(name) {
        return name
            .replace(/[【】「」『』（）()〈〉《》<>]/g, '')
            .replace(/[～〜]/g, '-')
            .replace(/[！!？?・：:＆&＋+／/＊*＃#|"]/g, '')
            .replace(/[\s　]+/g, '-')
            .replace(/[\\]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase();
    }

    function mTypeBadge(type) {
        const map = { 'ハイミドル': ['highmid','ハイミドル'], 'ミドル': ['mid','ミドル'], 'ライトミドル': ['lightmid','ライトミドル'], 'ライト(甘デジ)': ['ama','甘デジ'] };
        const [cls, lbl] = map[type] || ['other', type || '不明'];
        return `<span class="type-badge type-${cls}">${lbl}</span>`;
    }

    function bdrClass(v) { return v <= 17 ? 'clr-easy' : v <= 20 ? 'clr-normal' : 'clr-hard'; }

    function fmtYt(m) {
        if (!m.yutimeTrigger) return '<span class="dim">なし</span>';
        let s = `${m.yutimeTrigger}回転 → ${m.yutimeSpins||0}回転`;
        if (m.holdOver > 0) s += `+${m.holdOver}`;
        return `<span class="accent">${s}</span>`;
    }

    function machineJsonLd(m, border, slug) {
        return JSON.stringify({
            "@context": "https://schema.org", "@type": "Article",
            headline: `${m.name}のボーダー・期待値・トータル確率完全解析`,
            description: `${m.name}の等価ボーダー${border}回転/千円、トータル確率1/${m.prob}を徹底解析。`,
            url: `${SITE_URL}/machine-db/${slug}/`,
            publisher: { "@type": "Organization", name: "Gravity Portal", url: SITE_URL },
            datePublished: m.releaseDate || undefined,
            dateModified: new Date().toISOString().split('T')[0],
        });
    }

    function machinePageHtml(m, slug) {
        const border = m.borderEquiv||0, prob = m.prob||0, base = m.baseProbability||0;
        const chain = m.avgChainCalc||m.avgChain||0, cont = m.realContRate||0, entry = m.entryRate||0;
        const rush = m.rushRate||0, rb = m.rb||0, avg = m.avgAcquired||0;
        const title = `${m.name}のボーダー・期待値・トータル確率完全解析`;
        const desc = `${m.name}の等価ボーダー${border}回転/千円、トータル確率1/${prob}。スペック・遊タイム情報と期待値計算ツールへのリンクあり。`;

        return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE_URL}/machine-db/${slug}/">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${SITE_URL}/machine-db/${slug}/">
<script type="application/ld+json">${machineJsonLd(m, border, slug)}</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0b10;color:#e0e0e8;min-height:100vh;line-height:1.7}
.wrap{max-width:820px;margin:0 auto;padding:1rem 1rem 2rem}
.bc{font-size:.78rem;color:#6b6f80;margin-bottom:1.2rem}.bc a{color:#7c7ff2;text-decoration:none}.bc a:hover{text-decoration:underline}
.hdr{margin-bottom:1.4rem}.hdr h1{font-size:1.45rem;font-weight:800;color:#f0f0f8;line-height:1.4;margin-bottom:.5rem}
.meta{display:flex;gap:.7rem;align-items:center;flex-wrap:wrap}
.type-badge{display:inline-block;padding:.18rem .6rem;border-radius:5px;font-size:.74rem;font-weight:700}
.type-highmid{background:rgba(239,68,68,.12);color:#f87171;border:1px solid rgba(239,68,68,.2)}
.type-mid{background:rgba(234,179,8,.12);color:#facc15;border:1px solid rgba(234,179,8,.2)}
.type-lightmid{background:rgba(34,197,94,.12);color:#4ade80;border:1px solid rgba(34,197,94,.2)}
.type-ama{background:rgba(96,165,250,.12);color:#93c5fd;border:1px solid rgba(96,165,250,.2)}
.type-other{background:rgba(148,163,184,.12);color:#94a3b8;border:1px solid rgba(148,163,184,.2)}
.maker{font-size:.8rem;color:#8b8fa0}.rel{font-size:.78rem;color:#6b6f80}
.hero{background:linear-gradient(135deg,rgba(30,32,48,.95),rgba(20,22,36,.95));border:1px solid rgba(99,102,241,.25);border-radius:16px;padding:1.5rem;margin-bottom:1.5rem}
.hero-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1.2rem}
.hero-item{text-align:center}.hero-lbl{font-size:.72rem;font-weight:700;color:#8b8fa0;text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem}
.hero-val{font-family:'SF Mono',Consolas,monospace;font-size:1.75rem;font-weight:800}.hero-unit{font-size:.8rem;color:#6b6f80;font-weight:400}
.clr-easy{color:#22c55e}.clr-normal{color:#eab308}.clr-hard{color:#ef4444}.clr-prob{color:#a78bfa}.clr-chain{color:#c084fc}.clr-entry{color:#facc15}
.cta-primary{display:block;text-align:center;padding:1rem 2rem;background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff;font-size:1rem;font-weight:700;border-radius:12px;text-decoration:none;transition:transform .2s,box-shadow .2s;box-shadow:0 4px 20px rgba(99,102,241,.3);margin-bottom:.4rem}
.cta-primary:hover{transform:translateY(-2px);box-shadow:0 6px 30px rgba(99,102,241,.45)}
.cta-sub{text-align:center;font-size:.78rem;color:#6b6f80;margin-bottom:1.8rem}
.cta-secondary{display:block;text-align:center;padding:.8rem 1.5rem;background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);color:#a78bfa;font-size:.9rem;font-weight:700;border-radius:10px;text-decoration:none;margin-bottom:1.8rem;transition:all .2s}
.cta-secondary:hover{background:rgba(99,102,241,.2);border-color:#7c7ff2}
.sec{margin-bottom:1.8rem}.sec h2{font-size:1.08rem;font-weight:700;color:#e0e0e8;margin-bottom:.7rem;padding-bottom:.4rem;border-bottom:1px solid rgba(99,102,241,.15)}
.t-card{background:rgba(18,19,26,.9);border:1px solid rgba(99,102,241,.12);border-radius:12px;overflow:hidden}
.spec{width:100%;border-collapse:collapse}
.spec th{text-align:left;padding:.65rem .8rem;font-size:.82rem;font-weight:600;color:#8b8fa0;background:rgba(30,32,48,.6);border-bottom:1px solid rgba(255,255,255,.05);width:40%;white-space:nowrap}
.spec td{padding:.65rem .8rem;font-size:.9rem;color:#e0e0e8;border-bottom:1px solid rgba(255,255,255,.04);font-family:'SF Mono',Consolas,monospace}
.accent{color:#a78bfa;font-weight:600}.dim{color:#3a3d4e}
.link-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.8rem}
.link-card{display:block;padding:.8rem 1rem;background:rgba(30,32,48,.6);border:1px solid rgba(99,102,241,.12);border-radius:10px;color:#a78bfa;text-decoration:none;font-size:.85rem;font-weight:600;transition:all .2s}
.link-card:hover{background:rgba(99,102,241,.1);border-color:rgba(99,102,241,.3)}
.ft{padding:2rem 0;border-top:1px solid rgba(255,255,255,.05);text-align:center;font-size:.75rem;color:#3a3d4e;margin-top:2rem}.ft a{color:#7c7ff2;text-decoration:none}
@media(max-width:600px){.hero-val{font-size:1.35rem}.hdr h1{font-size:1.15rem}.hero-grid{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<div class="wrap">
<nav class="bc"><a href="/">トップ</a> &gt; <a href="/machine-db/">機種データベース</a> &gt; ${escapeHtml(m.name)}</nav>
<header class="hdr">
<h1>${escapeHtml(m.name)}のボーダー・期待値・トータル確率完全解析</h1>
<div class="meta">${mTypeBadge(m.type)}${m.maker?` <span class="maker">${escapeHtml(m.maker)}</span>`:''}${m.releaseDate?` <span class="rel">導入日: ${m.releaseDate}</span>`:''}</div>
</header>
<section class="hero"><div class="hero-grid">
<div class="hero-item"><div class="hero-lbl">等価ボーダー</div><div class="hero-val ${bdrClass(border)}">${border}<span class="hero-unit"> 回転/千円</span></div></div>
<div class="hero-item"><div class="hero-lbl">トータル確率</div><div class="hero-val clr-prob">1/<span>${prob}</span></div></div>
<div class="hero-item"><div class="hero-lbl">平均連荘</div><div class="hero-val clr-chain">${Math.round(chain*100)/100}<span class="hero-unit"> 連</span></div></div>
${entry>0?`<div class="hero-item"><div class="hero-lbl">RUSH突入率</div><div class="hero-val clr-entry">${entry}<span class="hero-unit"> %</span></div></div>`:''}
</div></section>
<a href="/tools/ev-calculator/" class="cta-primary">📊 この機種の正確な期待値を計算する</a>
<p class="cta-sub">店舗の換金率・実出玉に合わせた正確な期待値を算出できます</p>
<section class="sec"><h2>📋 基本スペック</h2><div class="t-card"><table class="spec">
<tr><th>大当り確率（通常時）</th><td>1/${base}</td></tr>
<tr><th>トータル確率</th><td>1/${prob}</td></tr>
<tr><th>等価ボーダー</th><td>${border} 回転/千円</td></tr>
<tr><th>想定1R出玉</th><td>${rb} 玉</td></tr>
${avg>0?`<tr><th>平均獲得出玉</th><td>${avg} 玉</td></tr>`:''}
<tr><th>平均連荘</th><td>${Math.round(chain*100)/100} 連</td></tr>
${cont>0?`<tr><th>実質継続率</th><td>${cont}%</td></tr>`:''}
${entry>0?`<tr><th>RUSH突入率</th><td>${entry}%</td></tr>`:''}
${rush>0?`<tr><th>RUSH発生率</th><td>${rush}%${m.rushType?` (${m.rushType})`:''}</td></tr>`:''}
</table></div></section>
<section class="sec"><h2>⏱ 遊タイム</h2><div class="t-card"><table class="spec">
<tr><th>遊タイム</th><td>${fmtYt(m)}</td></tr>
${m.yutimeTrigger>0?`<tr><th>発動回転数</th><td>${m.yutimeTrigger} 回転</td></tr><tr><th>時短回転数</th><td>${m.yutimeSpins||0} 回転</td></tr>${m.holdOver>0?`<tr><th>残保留</th><td>${m.holdOver} 個</td></tr>`:''}`:''}
</table></div></section>
<a href="/tools/ev-calculator/" class="cta-secondary">🔧 EV計算ツールで ${escapeHtml(m.name)} を分析する →</a>
<section class="sec"><h2>🔗 関連ツール</h2><div class="link-grid">
<a href="/machine-db/" class="link-card">📖 機種データベース一覧</a>
<a href="/tools/ev-calculator/" class="link-card">📊 期待値計算ツール</a>
<a href="/tools/" class="link-card">🛠 ツール一覧</a>
<a href="/guide/" class="link-card">📚 パチンコ初心者ガイド</a>
</div></section>
<footer class="ft"><p>&copy; ${new Date().getFullYear()} <a href="/">Gravity Portal</a></p></footer>
</div>
</body>
</html>`;
    }

    // 生成
    const slugMap = new Map();
    let generated = 0, dupes = 0;
    for (const m of machines) {
        let slug = toSlug(m.name) || `machine-${generated}`;
        if (slugMap.has(slug)) { dupes++; slug = `${slug}-${dupes}`; }
        slugMap.set(slug, m.name);
        m.slug = slug;  // 機種データにスラッグを直接追加
        const dir = join(OUTPUT_DIR, 'machine-db', slug);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'index.html'), machinePageHtml(m, slug), 'utf-8');
        generated++;
    }

    // machines.json にスラッグ付きで書き戻し（machine-db.js が m.slug を参照）
    const mDataWithSlugs = JSON.parse(readFileSync(MACHINES_PATH, 'utf-8'));
    const slugLookup = new Map(machines.map(m => [m.name, m.slug]));
    for (const m of mDataWithSlugs.machines || []) {
        if (slugLookup.has(m.name)) m.slug = slugLookup.get(m.name);
    }
    writeFileSync(join(OUTPUT_DIR, 'data', 'machines.json'), JSON.stringify(mDataWithSlugs), 'utf-8');

    // サイトマップ
    const urls = [...slugMap.keys()].map(s => `${SITE_URL}/machine-db/${s}/`);
    writeFileSync(join(OUTPUT_DIR, 'machine-db', 'sitemap-machines.txt'), urls.join('\n'), 'utf-8');

    // スラッグマップ（機種名 → スラッグ）をJSONで出力（サイトマップ用）
    const nameToSlug = {};
    for (const [slug, name] of slugMap) { nameToSlug[name] = slug; }
    writeFileSync(join(OUTPUT_DIR, 'machine-db', 'slug-map.json'), JSON.stringify(nameToSlug), 'utf-8');


    console.log(`🎰 ${generated} 機種SEOページ生成完了${dupes ? ` (重複回避: ${dupes})` : ''}`);
}

// ==========================================
// 実行
// ==========================================

buildIndexPage();
buildTagPages();
buildArticlePages();
buildRssFeed();
buildMachinePages();

console.log('✅ ビルド完了！ dist/ に出力されました');
