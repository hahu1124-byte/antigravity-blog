#!/usr/bin/env node
/**
 * blog-data.json → 静的HTML生成スクリプト
 * GitHub Pages用のブログサイトを生成する
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  cpSync,
  existsSync,
  readdirSync,
  statSync,
} from "fs";
import { join, dirname, extname, relative } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import { transform } from "esbuild";
import dotenv from "dotenv";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

// ビルド日付スタンプ（YYYYMMDD）— キャッシュバスターに使用。同日複数回ビルドでもHTMLが変わらない
const BUILD_STAMP = new Date().toISOString().split("T")[0].replace(/-/g, "");

// ソースパス
const BLOG_DATA_PATH = join(__dirname, "src", "blog-data.json");
const ARTICLES_DIR = join(__dirname, "src", "articles");
const OUTPUT_DIR = join(__dirname, "dist");

// 前回ビルドの統計情報（差分表示用）
const BUILD_STATS_PATH = join(OUTPUT_DIR, ".build-stats.json");
function loadBuildStats() {
  if (existsSync(BUILD_STATS_PATH)) {
    try {
      return JSON.parse(readFileSync(BUILD_STATS_PATH, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}
const prevStats = loadBuildStats();
const curStats = {};

// blog-data.json 読み込み（メタデータ）+ 個別HTMLファイルからcontent結合
const posts = JSON.parse(readFileSync(BLOG_DATA_PATH, "utf-8")).map((post) => {
  const articlePath = join(ARTICLES_DIR, `${post.slug}.html`);
  if (existsSync(articlePath)) {
    post.content = readFileSync(articlePath, "utf-8");
  }
  return post;
});

const contentCount = posts.filter((p) => p.content).length;
curStats.articleCount = contentCount;
if (prevStats.articleCount !== contentCount) {
  const diff =
    prevStats.articleCount != null
      ? ` (${contentCount > prevStats.articleCount ? "+" : ""}${contentCount - prevStats.articleCount})`
      : "";
  console.log(`📝 記事 ${contentCount}件${diff}`);
}

// 出力ディレクトリ作成
mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(join(OUTPUT_DIR, "blog"), { recursive: true });

// .nojekyll — GitHub PagesのJekyll処理を無効化
writeFileSync(join(OUTPUT_DIR, ".nojekyll"), "", "utf-8");

// blog-data.json（メタデータのみ版）をdistに出力（Vercel側からfetch用）
const metaOnly = posts.map(({ slug, title, date, excerpt, tags }) => ({
  slug,
  title,
  date,
  excerpt,
  tags,
}));
writeFileSync(
  join(OUTPUT_DIR, "blog-data.json"),
  JSON.stringify(metaOnly),
  "utf-8",
);

// 画像をコピー
const imgSrc = join(__dirname, "src", "images");
const imgDst = join(OUTPUT_DIR, "blog", "images");
if (existsSync(imgSrc)) {
  mkdirSync(imgDst, { recursive: true });
  cpSync(imgSrc, imgDst, { recursive: true });
}

// CSSをコピー
const cssSrc = join(__dirname, "src", "styles.css");
const cssDst = join(OUTPUT_DIR, "blog", "styles.css");
if (existsSync(cssSrc)) {
  cpSync(cssSrc, cssDst);
}

// 静的ツールをコピー（convergence, simulator, machine-db等）
const staticTools = [
  "convergence",
  "simulator",
  "machine-db",
  "data",
  "idle-game",
  "quiz",
  "general-quiz",
  "lab",
  "bgm-maker",
  "static-pages",
  "pachinko-sim",
  "slot-hyena",
  "password-generator",
  "image-tools",
  "pdf-tools",
  "qr-tools",
];
const missingTools = [];
for (const tool of staticTools) {
  const toolSrc = join(__dirname, "src", tool);
  const toolDst = join(OUTPUT_DIR, tool);
  if (existsSync(toolSrc)) {
    mkdirSync(toolDst, { recursive: true });
    cpSync(toolSrc, toolDst, { recursive: true });
  } else {
    missingTools.push(tool);
  }
}
const toolCount = staticTools.length - missingTools.length;
curStats.toolCount = toolCount;
if (prevStats.toolCount !== toolCount) {
  const diff =
    prevStats.toolCount != null
      ? ` (${toolCount > prevStats.toolCount ? "+" : ""}${toolCount - prevStats.toolCount})`
      : "";
  console.log(`🔧 静的ツール ${toolCount}件${diff}`);
}
if (missingTools.length)
  console.warn(`⚠️  見つからずスキップ: ${missingTools.join(", ")}`);

// machine-db/index.html の CSS/JS バージョン番号をBUILD_STAMPで更新
{
  const machineDbHtml = join(OUTPUT_DIR, "machine-db", "index.html");
  if (existsSync(machineDbHtml)) {
    let html = readFileSync(machineDbHtml, "utf-8");
    html = html.replace(/(\?v=)\d+/g, `$1${BUILD_STAMP}`);
    writeFileSync(machineDbHtml, html, "utf-8");
  }
}

// machine-db.js の Supabase 設定をビルド時に埋め込み（キーをソースコードから除外）
{
  const machineDbJsPath = join(OUTPUT_DIR, "machine-db", "machine-db.js");
  if (existsSync(machineDbJsPath)) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ .env に SUPABASE_URL / SUPABASE_ANON_KEY が未設定です");
      process.exit(1);
    }
    let js = readFileSync(machineDbJsPath, "utf-8");
    js = js.replace("__SUPABASE_URL__", supabaseUrl);
    js = js.replace("__SUPABASE_ANON_KEY__", supabaseKey);
    writeFileSync(machineDbJsPath, js, "utf-8");
  }
}

// スクリプトをコピー
const scriptsSrc = join(__dirname, "src", "scripts");
const scriptsDst = join(OUTPUT_DIR, "blog", "scripts");
if (existsSync(scriptsSrc)) {
  mkdirSync(scriptsDst, { recursive: true });
  cpSync(scriptsSrc, scriptsDst, { recursive: true });
}

// ==========================================
// 忍者AdMax 設定
// ==========================================

const NINJA_AD_ID = "06dfeeba49e20207a86cd5f651221d50";
const ADMAX_SCRIPT_URL = "https://adm.shinobi.jp/st/t.js";

// ==========================================
// 共通HTMLテンプレート
// ==========================================

const SITE_URL = "https://www.antigravity-portal.com";
const DEFAULT_OG_IMAGE = `${SITE_URL}/blog/images/ai_dev_day1.webp`;

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
function htmlHead(title, description, cssRelPath = "styles.css", ogp = {}) {
  const cacheBust = BUILD_STAMP;
  const ogTitle = escapeHtml(title);
  const ogDesc = escapeHtml(description);
  const ogUrl = ogp.url || SITE_URL;
  const ogImage = ogp.image || DEFAULT_OG_IMAGE;
  const ogType = ogp.type || "website";
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
    <script defer src="${cssRelPath.replace("styles.css", "scripts/hero-bg.js")}?v=${cacheBust}"></script>
    <script>
        (function(){try{var t=localStorage.getItem('gp-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()
    </script>
</head>
<body>
    <div id="gp-hero-bg"></div>
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ==========================================
// 更新日表示ヘルパー
// ==========================================

const BUILD_DATE = new Date();

/** 日付/日時文字列をフォーマット（時間があれば表示） */
function formatDateTime(dateStr) {
  if (!dateStr) return "";
  // "YYYY-MM-DD HH:MM" 形式
  if (dateStr.length > 10) {
    const [datePart, timePart] = dateStr.split(" ");
    return `${datePart} ${timePart}`;
  }
  // "YYYY-MM-DD" 形式
  return dateStr;
}

/** dateModified > date の場合、更新バッジHTMLを返す */
function getDateModifiedBadge(post) {
  if (!post.dateModified || post.dateModified === post.date) return "";
  const modStr =
    post.dateModified.length > 10
      ? post.dateModified.slice(0, 10)
      : post.dateModified;
  const mod = new Date(modStr + "T00:00:00+09:00");
  const diffMs = BUILD_DATE - mod;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  let label;
  if (diffDays <= 0) label = "今日更新";
  else if (diffDays === 1) label = "昨日更新";
  else if (diffDays <= 7) label = `${diffDays}日前に更新`;
  else if (diffDays <= 30) label = `${Math.floor(diffDays / 7)}週間前に更新`;
  else return "";
  return `<span class="date-modified-badge">🔄 ${label}</span>`;
}

/** 記事詳細ヘッダー用: 最終更新日テキスト */
function getDateModifiedText(post) {
  if (!post.dateModified || post.dateModified === post.date) return "";
  return `<time class="date-modified">最終更新: ${formatDateTime(post.dateModified)}</time>`;
}

/** タグ収集ユーティリティ */
function collectTags(postList) {
  const tagCounts = {};
  postList.forEach((post) => {
    post.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  return Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
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

const AMAZON_TAG = "gravity063-22";

/** Uber配達で使うもの一覧（記事1-2・週報向け） */
const UBER_GEAR_ADS = [
  {
    title: "モバイルバッテリー",
    search: "モバイルバッテリー 大容量 急速充電",
    emoji: "🔋",
  },
  {
    title: "スマホホルダー（車用）",
    search: "スマホホルダー 車 エアコン吹き出し口",
    emoji: "📱",
  },
  {
    title: "保温・保冷バッグ",
    search: "デリバリー 保温バッグ 配達",
    emoji: "🧊",
  },
  {
    title: "USB充電ケーブル",
    search: "USB-C 充電ケーブル 車用 急速",
    emoji: "🔌",
  },
  {
    title: "腰痛対策クッション",
    search: "車用 腰痛 クッション シートクッション",
    emoji: "💺",
  },
  {
    title: "飲み物ホルダー（保温）",
    search: "タンブラー 保温 ドリンクホルダー 車",
    emoji: "☕",
  },
];

/** Uber日報向け（コンパクト版） */
const UBER_DAILY_ADS = [
  {
    title: "モバイルバッテリー",
    search: "モバイルバッテリー 大容量",
    emoji: "🔋",
  },
  { title: "スマホホルダー", search: "スマホホルダー 車用", emoji: "📱" },
  { title: "保温バッグ", search: "デリバリー 保温バッグ", emoji: "🧊" },
];

/** パチンコ記事向け */
const PACHINKO_ADS = [
  {
    title: "パチンコ攻略マガジン",
    search: "パチンコ攻略マガジン",
    emoji: "📖",
  },
  {
    title: "パチンコ攻略年鑑 2026",
    search: "パチンコ必勝ガイド 攻略年鑑 2026",
    emoji: "📕",
  },
  { title: "確率論入門", search: "確率論 入門 数学", emoji: "📐" },
];

/** AI/開発記事向け */
const AI_DEV_ADS = [
  {
    title: "AIプログラミング入門",
    search: "AI プログラミング 入門 Python",
    emoji: "🤖",
  },
  {
    title: "Next.js実践ガイド",
    search: "Next.js React TypeScript 入門",
    emoji: "📘",
  },
  {
    title: "Webアプリ開発入門",
    search: "Webアプリケーション 開発 入門",
    emoji: "💻",
  },
];

function amazonSearchUrl(keyword) {
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(keyword)}&tag=${AMAZON_TAG}`;
}

function getAmazonAdsHtml(post) {
  const tags = post.tags || [];
  const isWeekly = tags.includes("週報");
  const isUber = tags.includes("Uber");
  const isPachinko = tags.includes("パチンコ");
  const isAI = tags.includes("AI");
  const isDev = tags.includes("開発");
  const isTech = tags.includes("技術") || tags.includes("PWA");

  // 広告商品を選択（記事のタグに基づく）
  let items;
  let sectionTitle;
  if (isAI || isDev || isTech) {
    items = AI_DEV_ADS;
    sectionTitle = "💻 技術書・開発に役立つ本";
  } else if (isWeekly || (isUber && isPachinko)) {
    items = UBER_GEAR_ADS;
    sectionTitle = "🚗 Uber配達で使うもの一覧";
  } else if (isUber) {
    items = UBER_DAILY_ADS;
    sectionTitle = "🚗 配達に役立つアイテム";
  } else if (isPachinko) {
    items = PACHINKO_ADS;
    sectionTitle = "📚 パチンコ攻略に役立つ本";
  } else {
    items = UBER_DAILY_ADS;
    sectionTitle = "📦 おすすめアイテム";
  }

  const itemCards = items
    .map(
      (item) => `
        <a href="${amazonSearchUrl(item.search)}" target="_blank" rel="noopener noreferrer" class="amazon-ad-card">
            <span class="amazon-ad-emoji">${item.emoji}</span>
            <span class="amazon-ad-title">${escapeHtml(item.title)}</span>
            <span class="amazon-ad-badge">Amazonで見る</span>
        </a>`,
    )
    .join("\n");

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

const NOTE_ARTICLE_URL = "https://note.com/hahu1124/n/n499b03461f85";

/** AI開発シリーズ記事にNote導線バナーを挿入 */
function getNoteBannerHtml(post) {
  // タイトルに「AIと1週間で」を含む記事のみ
  if (!post.title.includes("AIと1週間で")) return "";
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

function buildArticleListHtml(
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
        var currentPage = 1;
        var cards = Array.from(document.querySelectorAll('.article-card'));
        var pagination = document.getElementById('pagination');

        function render() {
            var totalPages = Math.ceil(cards.length / PER_PAGE);
            if (totalPages <= 0) totalPages = 1;
            if (currentPage > totalPages) currentPage = totalPages;
            var start = (currentPage - 1) * PER_PAGE;
            var end = start + PER_PAGE;

            cards.forEach(function(c, i) {
                c.style.display = (i >= start && i < end) ? '' : 'none';
            });

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
                if (currentPage > 1) { currentPage--; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
            });
            document.getElementById('pg-next').addEventListener('click', function() {
                if (currentPage < totalPages) { currentPage++; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
            });
            document.getElementById('pg-select').addEventListener('change', function() {
                currentPage = parseInt(this.value);
                render();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        render();
    })();
    </script>
</body>
</html>`;
}

function buildIndexPage() {
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

function buildArticlePages() {
  const contentPosts = posts.filter((p) => p.content);
  contentPosts.forEach((post, index) => {
    // 前後の記事（contentありのもの同士でナビゲーション）
    const prev = index > 0 ? contentPosts[index - 1] : null;
    const next =
      index < contentPosts.length - 1 ? contentPosts[index + 1] : null;

    // 相対パスのベースを計算（slugの階層分だけ../を重ねる）
    const depth = post.slug.split("/").length;
    const toRoot = "../".repeat(depth); // blog/ ルートへの相対パス

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

function buildTagPages() {
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

function buildRssFeed() {
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

// ==========================================
// 機種SEO個別ページ生成 (/machine-db/[slug]/index.html)
// ==========================================

function buildMachinePages() {
  const MACHINES_PATH = join(__dirname, "src", "data", "machines.json");
  if (!existsSync(MACHINES_PATH)) {
    console.log("⏭️  machines.json なし — 機種ページ生成スキップ");
    return;
  }

  const mData = JSON.parse(readFileSync(MACHINES_PATH, "utf-8"));
  const machines = (mData.machines || []).filter((m) => m.prob > 0 && m.name);

  function toSlug(name) {
    return name
      .replace(/[【】「」『』（）()〈〉《》<>]/g, "")
      .replace(/[～〜]/g, "-")
      .replace(/[！!？?・：:＆&＋+／/＊*＃#|"]/g, "")
      .replace(/[\s　]+/g, "-")
      .replace(/[\\]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  }

  function mTypeBadge(type) {
    const map = {
      ハイミドル: ["highmid", "ハイミドル"],
      ミドル: ["mid", "ミドル"],
      ライトミドル: ["lightmid", "ライトミドル"],
      "ライト(甘デジ)": ["ama", "甘デジ"],
    };
    const [cls, lbl] = map[type] || ["other", type || "不明"];
    return `<span class="type-badge type-${cls}">${lbl}</span>`;
  }

  function bdrClass(v) {
    return v <= 17 ? "clr-easy" : v <= 20 ? "clr-normal" : "clr-hard";
  }

  function fmtYt(m) {
    if (!m.yutimeTrigger) return '<span class="dim">なし</span>';
    let s = `${m.yutimeTrigger}回転 → ${m.yutimeSpins || 0}回転`;
    if (m.holdOver > 0) s += `+${m.holdOver}`;
    return `<span class="accent">${s}</span>`;
  }

  function machineJsonLd(m, border, slug) {
    return JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `${m.name}のボーダー・期待値・トータル確率完全解析`,
      description: `${m.name}の等価ボーダー${border}回転/千円、トータル確率1/${m.prob}を徹底解析。`,
      url: `${SITE_URL}/machine-db/${slug}/`,
      publisher: {
        "@type": "Organization",
        name: "Gravity Portal",
        url: SITE_URL,
      },
      datePublished: m.releaseDate || undefined,
      dateModified: BUILD_STAMP.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
    });
  }

  function machinePageHtml(m, slug) {
    const border = m.borderEquiv || 0,
      prob = m.prob || 0,
      base = m.baseProbability || 0;
    const chain = m.avgChainCalc || m.avgChain || 0,
      cont = m.realContRate || 0,
      entry = m.entryRate || 0;
    const rush = m.rushRate || 0,
      rb = m.rb || 0,
      avg = m.avgAcquired || 0;
    const incomplete = rb === 0; // ボーダー等の詳細データが未取得
    const title = incomplete
      ? `${m.name}のスペック情報`
      : `${m.name}のボーダー・期待値・トータル確率完全解析`;
    const desc = incomplete
      ? `${m.name}（${m.maker || ""}）のスペック情報ページ。トータル確率1/${prob}。詳細データは未取得のため、データ元リンクをご確認ください。`
      : `${m.name}の等価ボーダー${border}回転/千円、トータル確率1/${prob}。スペック・遊タイム情報と期待値計算ツールへのリンクあり。`;

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
.notice{background:rgba(234,179,8,.08);border:1px solid rgba(234,179,8,.25);border-radius:10px;padding:.85rem 1rem;margin-bottom:1.5rem;font-size:.85rem;color:#fbbf24;line-height:1.6}
.notice a{color:#fde68a;text-decoration:underline}
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
.accent{color:#a78bfa;font-weight:600}.dim{color:#3a3d4e}.na{color:#4a4d5e;font-style:italic}
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
<h1>${escapeHtml(title)}</h1>
<div class="meta">${mTypeBadge(m.type)}${m.maker ? ` <span class="maker">${escapeHtml(m.maker)}</span>` : ""}${m.releaseDate ? ` <span class="rel">導入日: ${m.releaseDate}</span>` : ""}</div>
</header>
${incomplete ? `<div class="notice">⚠️ この機種はボーダー・出玉データが未取得のため、一部情報が表示できません。${m.sourceUrl ? `<br>詳細スペックは <a href="${m.sourceUrl}" target="_blank" rel="noopener">データ元サイト</a> でご確認ください。` : ""}</div>` : ""}
<section class="hero"><div class="hero-grid">
${!incomplete ? `<div class="hero-item"><div class="hero-lbl">等価ボーダー</div><div class="hero-val ${bdrClass(border)}">${border}<span class="hero-unit"> 回転/千円</span></div></div>` : ""}
<div class="hero-item"><div class="hero-lbl">トータル確率</div><div class="hero-val clr-prob">1/<span>${prob}</span></div></div>
${!incomplete ? `<div class="hero-item"><div class="hero-lbl">平均連荘</div><div class="hero-val clr-chain">${Math.round(chain * 100) / 100}<span class="hero-unit"> 連</span></div></div>` : ""}
${entry > 0 ? `<div class="hero-item"><div class="hero-lbl">RUSH突入率</div><div class="hero-val clr-entry">${entry}<span class="hero-unit"> %</span></div></div>` : ""}
</div></section>
${
  !incomplete
    ? `<a href="/tools/ev-calculator/" class="cta-primary">📊 この機種の正確な期待値を計算する</a>
<p class="cta-sub">店舗の換金率・実出玉に合わせた正確な期待値を算出できます</p>`
    : ""
}
<section class="sec"><h2>📋 基本スペック</h2><div class="t-card"><table class="spec">
${base > 0 ? `<tr><th>大当り確率（通常時）</th><td>1/${base}</td></tr>` : ""}
<tr><th>トータル確率</th><td>1/${prob}</td></tr>
<tr><th>等価ボーダー</th><td>${border > 0 ? border + " 回転/千円" : '<span class="na">データなし</span>'}</td></tr>
<tr><th>想定1R出玉</th><td>${rb > 0 ? rb + " 玉" : '<span class="na">データなし</span>'}</td></tr>
${avg > 0 ? `<tr><th>平均獲得出玉</th><td>${avg} 玉</td></tr>` : ""}
${!incomplete ? `<tr><th>平均連荘</th><td>${Math.round(chain * 100) / 100} 連</td></tr>` : ""}
${cont > 0 ? `<tr><th>実質継続率</th><td>${cont}%</td></tr>` : ""}
${entry > 0 ? `<tr><th>RUSH突入率</th><td>${entry}%</td></tr>` : ""}
${rush > 0 ? `<tr><th>RUSH発生率</th><td>${rush}%${m.rushType ? ` (${m.rushType})` : ""}</td></tr>` : ""}
${m.maker ? `<tr><th>メーカー</th><td>${escapeHtml(m.maker)}</td></tr>` : ""}
${m.releaseDate ? `<tr><th>導入日</th><td>${m.releaseDate}</td></tr>` : ""}
</table></div></section>
${
  !incomplete
    ? `<section class="sec"><h2>⏱ 遊タイム</h2><div class="t-card"><table class="spec">
<tr><th>遊タイム</th><td>${fmtYt(m)}</td></tr>
${m.yutimeTrigger > 0 ? `<tr><th>発動回転数</th><td>${m.yutimeTrigger} 回転</td></tr><tr><th>時短回転数</th><td>${m.yutimeSpins || 0} 回転</td></tr>${m.holdOver > 0 ? `<tr><th>残保留</th><td>${m.holdOver} 個</td></tr>` : ""}` : ""}
</table></div></section>
<a href="/tools/ev-calculator/" class="cta-secondary">🔧 EV計算ツールで ${escapeHtml(m.name)} を分析する →</a>`
    : ""
}
<section class="sec"><h2>🔗 関連ツール</h2><div class="link-grid">
<a href="/machine-db/?q=${encodeURIComponent(m.name)}" class="link-card">🔍 機種DBで ${escapeHtml(m.name)} を検索</a>
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

  // 既存の machine-db ページスラッグを事前収集（差分表示用）
  const machineDbDistDir = join(OUTPUT_DIR, "machine-db");
  const existingMachineSlugs = new Set(
    existsSync(machineDbDistDir)
      ? readdirSync(machineDbDistDir, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
      : [],
  );

  // 生成
  const slugMap = new Map();
  let generated = 0,
    dupes = 0;
  for (const m of machines) {
    let slug = toSlug(m.name) || `machine-${generated}`;
    if (slugMap.has(slug)) {
      dupes++;
      slug = `${slug}-${dupes}`;
    }
    slugMap.set(slug, m.name);
    m.slug = slug; // 機種データにスラッグを直接追加
    const dir = join(OUTPUT_DIR, "machine-db", slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), machinePageHtml(m, slug), "utf-8");
    generated++;
  }

  // machines.json にスラッグ付きで書き戻し（machine-db.js が m.slug を参照）
  const mDataWithSlugs = JSON.parse(readFileSync(MACHINES_PATH, "utf-8"));
  const slugLookup = new Map(machines.map((m) => [m.name, m.slug]));
  for (const m of mDataWithSlugs.machines || []) {
    if (slugLookup.has(m.name)) m.slug = slugLookup.get(m.name);
  }
  writeFileSync(
    join(OUTPUT_DIR, "data", "machines.json"),
    JSON.stringify(mDataWithSlugs),
    "utf-8",
  );

  // サイトマップ
  const urls = [...slugMap.keys()].map((s) => `${SITE_URL}/machine-db/${s}/`);
  writeFileSync(
    join(OUTPUT_DIR, "machine-db", "sitemap-machines.txt"),
    urls.join("\n"),
    "utf-8",
  );

  // スラッグマップ（機種名 → スラッグ）をJSONで出力（サイトマップ用）
  const nameToSlug = {};
  for (const [slug, name] of slugMap) {
    nameToSlug[name] = slug;
  }
  writeFileSync(
    join(OUTPUT_DIR, "machine-db", "slug-map.json"),
    JSON.stringify(nameToSlug),
    "utf-8",
  );

  // stats.json — GP等が各種カウントを動的取得するための軽量ファイル
  // toolCount/gameCount/labCount はGPサイトのカード数（Vercelデプロイなしで更新するためここで管理）
  const stats = {
    machineCount: generated,
    toolCount: 9,
    gameCount: 2,
    labCount: 4,
    builtAt: BUILD_STAMP,
  };
  writeFileSync(
    join(OUTPUT_DIR, "data", "stats.json"),
    JSON.stringify(stats),
    "utf-8",
  );

  // machine-db.js の allSlugs プレースホルダーにスラッグ一覧を埋め込み
  const machineDbJsPath = join(OUTPUT_DIR, "machine-db", "machine-db.js");
  if (existsSync(machineDbJsPath)) {
    let jsContent = readFileSync(machineDbJsPath, "utf-8");
    const slugArray = JSON.stringify([...slugMap.keys()]);
    jsContent = jsContent.replace(
      /const allSlugs = \[\];\s*\/\*\s*__ALL_SLUGS_PLACEHOLDER__\s*\*\//,
      `const allSlugs = ${slugArray}`,
    );
    writeFileSync(machineDbJsPath, jsContent, "utf-8");
  }

  // 新規追加・削除スラッグを計算して差分のみ表示
  const newSlugs = [...slugMap.keys()].filter(
    (s) => !existingMachineSlugs.has(s),
  );
  const removedSlugs = [...existingMachineSlugs].filter(
    (s) => !slugMap.has(s) && s !== "sitemap-machines.txt",
  );
  if (newSlugs.length > 0 || removedSlugs.length > 0) {
    const preview = (arr) =>
      arr.length <= 3
        ? arr.join(", ")
        : `${arr.slice(0, 3).join(", ")} ...他${arr.length - 3}件`;
    if (newSlugs.length > 0)
      console.log(
        `🎰 +${newSlugs.length}件追加: ${preview(newSlugs)}${dupes ? ` (重複回避: ${dupes})` : ""}`,
      );
    if (removedSlugs.length > 0)
      console.log(
        `🗑️  -${removedSlugs.length}件削除: ${preview(removedSlugs)}`,
      );
  } else {
    console.log(`🎰 機種ページ: 変化なし (計${generated}件)`);
  }
}

// ==========================================
// 実行
// ==========================================

buildIndexPage();
buildTagPages();
buildArticlePages();
buildRssFeed();
buildMachinePages();

// ==========================================
// LAB novels ページ生成（Markdown → HTML）
// ==========================================

const LAB_CSS_URL =
  "https://hahu1124-byte.github.io/antigravity-blog/lab/styles.css";
const NOVELS_SRC_DIR = join(__dirname, "src", "lab", "novels");

/** Markdown ファイルを読んで HTML 文字列に変換 */
async function mdToHtml(filePath) {
  const src = readFileSync(filePath, "utf-8");
  const { content } = matter(src);
  const result = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(content);
  return result.toString();
}

/** LAB 共通ページラッパー（既存 ai-tools/index.html の構造を踏襲） */
function labWrap({
  title,
  description,
  cssDepth,
  backHref,
  backLabel,
  titleIcon,
  titleText,
  bodyHtml,
}) {
  const cssPath = cssDepth === 0 ? `./styles.css` : LAB_CSS_URL;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${SITE_URL}/lab/novels/">
    <meta property="og:type" content="article">
    <link rel="stylesheet" href="${LAB_CSS_URL}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script>
        (function(){try{var t=localStorage.getItem('gp-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()
    </script>
</head>
<body>
    <button class="theme-toggle" id="themeToggle" aria-label="テーマ切替">🌙</button>
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
    </script>

    <header class="lab-header">
        <a href="${backHref}" class="lab-back">← ${backLabel}</a>
        <span class="lab-title">${titleIcon} ${titleText}</span>
    </header>

    <main class="lab-content novels-content">
        ${bodyHtml}
    </main>
</body>
</html>`;
}

/** timeline.md を ## 見出しで週ごとに分割してタブUIのHTMLを生成 */
async function buildTimelineTabsHtml(filePath) {
  const src = readFileSync(filePath, "utf-8");
  const { content } = matter(src);

  // ## で始まるセクションに分割
  const parts = content.split(/(?=\n## )/);
  const preamble = parts[0]; // ## より前の部分（注記・区切り線など）
  const sections = parts.slice(1);

  // 週セクションが1つ以下ならそのままHTML変換して返す
  if (sections.length <= 1) {
    const result = await remark()
      .use(remarkGfm)
      .use(remarkHtml, { sanitize: false })
      .process(content);
    return result.toString();
  }

  // preamble をHTML変換
  const preambleHtml = preamble.trim()
    ? (await remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).process(preamble)).toString()
    : "";

  // 各セクションのタイトルとHTMLを収集
  const weekData = [];
  for (const section of sections) {
    const titleMatch = section.match(/^## (.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : "不明";
    const result = await remark()
      .use(remarkGfm)
      .use(remarkHtml, { sanitize: false })
      .process(section);
    weekData.push({ title, html: result.toString() });
  }

  // 日付セクション（年で始まるもの）を逆順にし、その他（メモ等）は末尾に残す
  const dateWeeks = weekData.filter(w => /^\d{4}年/.test(w.title));
  const otherWeeks = weekData.filter(w => !/^\d{4}年/.test(w.title));
  weekData.length = 0;
  dateWeeks.reverse().forEach(w => weekData.push(w));
  otherWeeks.forEach(w => weekData.push(w));

  const tabButtons = weekData
    .map((w, i) => `<button class="tl-tab${i === 0 ? " tl-tab-active" : ""}" data-week="${i}">${escapeHtml(w.title)}</button>`)
    .join("");

  const tabContents = weekData
    .map((w, i) => `<div class="tl-content${i === 0 ? " tl-content-active" : ""}" data-week="${i}">${w.html}</div>`)
    .join("");

  return `
<style>
.tl-tabs{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1.5rem}
.tl-tab{padding:.45rem 1rem;background:var(--lab-bg-card,rgba(30,32,48,.8));border:1px solid var(--lab-border,rgba(99,102,241,.2));border-radius:8px;color:var(--lab-text-muted,#8b8fa0);font-size:.85rem;font-weight:600;cursor:pointer;transition:all .2s}
.tl-tab:hover{border-color:var(--lab-accent,#58a6ff);color:var(--lab-text,#e0e0e8)}
.tl-tab-active{background:rgba(88,166,255,.15);border-color:var(--lab-accent,#58a6ff);color:var(--lab-text,#e0e0e8)}
.tl-content{display:none}.tl-content-active{display:block}
</style>
${preambleHtml}
<div class="tl-tabs">${tabButtons}</div>
<div class="tl-contents">
${tabContents}
</div>
<script>
(function(){
  var tabs=document.querySelectorAll('.tl-tab');
  tabs.forEach(function(tab){
    tab.addEventListener('click',function(){
      var w=this.dataset.week;
      tabs.forEach(function(t){t.classList.remove('tl-tab-active');});
      document.querySelectorAll('.tl-content').forEach(function(c){c.classList.remove('tl-content-active');});
      this.classList.add('tl-tab-active');
      document.querySelector('.tl-content[data-week="'+w+'"]').classList.add('tl-content-active');
    });
  });
})();
</script>`;
}

async function buildNovelsPages() {
  if (!existsSync(NOVELS_SRC_DIR)) {
    console.log("⏭️  src/lab/novels/ なし — novelsページ生成スキップ");
    return;
  }

  const introHtml = await mdToHtml(join(NOVELS_SRC_DIR, "intro.md"));
  const structureHtml = await mdToHtml(join(NOVELS_SRC_DIR, "structure.md"));
  const timelineTabsHtml = await buildTimelineTabsHtml(join(NOVELS_SRC_DIR, "timeline.md"));

  // --- novels/index.html ---
  const novelsDir = join(OUTPUT_DIR, "lab", "novels");
  mkdirSync(novelsDir, { recursive: true });

  const novelsBody = `
        <nav class="novels-breadcrumb">
            <a href="/">トップ</a>
            <span class="novels-sep">›</span>
            <a href="/lab/">LAB</a>
            <span class="novels-sep">›</span>
            <span class="novels-current">AI小説</span>
        </nav>

        <div class="novels-hero">
            <div class="novels-hero-meta">
                <span class="novels-badge">📖 カクヨム連載中</span>
            </div>
            <h1 class="novels-hero-title">廃城の王</h1>
            <p class="novels-hero-sub">ふたつのAIが同じ話を書き、人間が統合する。</p>
            <a href="https://kakuyomu.jp/works/2912051602055329793" target="_blank" rel="noopener noreferrer" class="novels-cta">カクヨムで読む →</a>
        </div>

        <p class="novels-behind-note">執筆裏話をここに記載していきます。</p>

        <section class="novels-section novels-markdown">
            ${introHtml}
        </section>

        <hr class="novels-divider">

        <section class="novels-section novels-markdown">
            ${structureHtml}
        </section>

        <hr class="novels-divider">

        <section class="novels-section">
            <h2 class="novels-section-title">制作タイムライン</h2>
            <p class="novels-timeline-desc">いつ・どの話を書き・何を修正したか。週ごとにまとめた制作記録です。</p>
            <a href="/lab/novels/timeline/" class="novels-timeline-link">
                <span class="novels-timeline-icon">📅</span>
                <div>
                    <div class="novels-timeline-link-title">制作タイムラインを見る</div>
                    <div class="novels-timeline-link-sub">週ごとの執筆・修正ログ</div>
                </div>
                <span class="novels-timeline-arrow">→</span>
            </a>
        </section>

        <div class="novels-footer">
            <a href="/lab/" class="novels-back-link">← LAB に戻る</a>
        </div>`;

  writeFileSync(
    join(novelsDir, "index.html"),
    labWrap({
      title: "AI小説 — 廃城の王 | LAB | Gravity Portal",
      description:
        "2つのAIが同じ話を書き、人間が統合する。カクヨム連載中「廃城の王」の制作プロセスと修正履歴を公開。",
      backHref: "/lab/",
      backLabel: "LABに戻る",
      titleIcon: "📖",
      titleText: "AI小説",
      bodyHtml: novelsBody,
    }),
    "utf-8",
  );

  // --- novels/timeline/index.html ---
  const timelineDir = join(novelsDir, "timeline");
  mkdirSync(timelineDir, { recursive: true });

  const timelineBody = `
        <nav class="novels-breadcrumb">
            <a href="/">トップ</a>
            <span class="novels-sep">›</span>
            <a href="/lab/">LAB</a>
            <span class="novels-sep">›</span>
            <a href="/lab/novels/">AI小説</a>
            <span class="novels-sep">›</span>
            <span class="novels-current">制作タイムライン</span>
        </nav>

        <section class="novels-section novels-markdown novels-timeline-body">
            ${timelineTabsHtml}
        </section>

        <div class="novels-footer">
            <a href="/lab/novels/" class="novels-back-link">← AI小説に戻る</a>
        </div>`;

  writeFileSync(
    join(timelineDir, "index.html"),
    labWrap({
      title: "制作タイムライン — 廃城の王 | AI小説 | Gravity Portal",
      description:
        "「廃城の王」制作タイムライン。いつ・どの話を書き・何を修正したか、週ごとにまとめた制作記録。",
      backHref: "/lab/novels/",
      backLabel: "AI小説に戻る",
      titleIcon: "📅",
      titleText: "制作タイムライン",
      bodyHtml: timelineBody,
    }),
    "utf-8",
  );

  console.log(
    "📖 novelsページ生成完了 (novels/index.html + novels/timeline/index.html)",
  );
}

await buildNovelsPages();

// ==========================================
// CSS / JS / HTML Minify（ビルド後処理）
// ==========================================

const MINIFY_CACHE_PATH = join(OUTPUT_DIR, ".minify-cache.json");

function sha(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function loadMinifyCache() {
  if (existsSync(MINIFY_CACHE_PATH)) {
    try {
      return JSON.parse(readFileSync(MINIFY_CACHE_PATH, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

/** dist内の全ファイルを再帰的に取得 */
function collectFiles(dir, exts) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, exts));
    } else if (exts.includes(extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * HTMLのインラインCSS/JSをesbuildでminify、タグ間余分空白を削除
 * <pre>タグは壊さないよう、src属性付き<script>はスキップ
 */
async function minifyHtmlContent(html) {
  // <style>ブロックをesbuildでminify
  const styleMatches = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)];
  for (const m of styleMatches) {
    if (!m[1].trim()) continue;
    try {
      const r = await transform(m[1], { loader: "css", minify: true });
      html = html.replace(m[0], `<style>${r.code}</style>`);
    } catch {
      /* 元のまま維持 */
    }
  }

  // src属性なしの<script>ブロックをesbuildでminify
  const scriptMatches = [
    ...html.matchAll(/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/g),
  ];
  for (const m of scriptMatches) {
    if (!m[1].trim()) continue;
    try {
      const r = await transform(m[1], { loader: "js", minify: true });
      html = html.replace(m[0], m[0].replace(m[1], r.code));
    } catch {
      /* 元のまま維持 */
    }
  }

  // HTMLコメント削除（条件付きコメント <!--[if は除外）
  html = html.replace(/<!--(?!\[if)[\s\S]*?-->/g, "");

  return html;
}

async function minifyAssets() {
  const cache = loadMinifyCache();
  const newCache = {};

  const cssFiles = collectFiles(OUTPUT_DIR, [".css"]);
  const jsFiles = collectFiles(OUTPUT_DIR, [".js"]);
  const htmlFiles = collectFiles(OUTPUT_DIR, [".html"]);

  let totalSaved = 0,
    minified = 0,
    skipped = 0,
    errors = 0;
  const minifiedFiles = [];

  // CSS / JS
  for (const file of [...cssFiles, ...jsFiles]) {
    const ext = extname(file).toLowerCase();
    const original = readFileSync(file, "utf-8");
    const hash = sha(original);

    if (cache[file] === hash) {
      newCache[file] = hash;
      skipped++;
      continue;
    }

    const originalSize = Buffer.byteLength(original, "utf-8");
    try {
      const result = await transform(original, {
        loader: ext === ".css" ? "css" : "js",
        minify: true,
      });
      const newSize = Buffer.byteLength(result.code, "utf-8");
      if (newSize < originalSize) {
        writeFileSync(file, result.code);
        totalSaved += originalSize - newSize;
        minified++;
        minifiedFiles.push(relative(OUTPUT_DIR, file));
        newCache[file] = hash; // minify前のハッシュで保存（次回ビルドで元HTML上書き後も一致）
      } else {
        newCache[file] = hash;
      }
    } catch (e) {
      console.warn(
        `⚠️  minify失敗 [${ext}] ${relative(OUTPUT_DIR, file)}: ${e.message}`,
      );
      errors++;
      newCache[file] = hash;
    }
  }

  // HTML（インラインCSS/JS圧縮 + タグ間空白削減）
  for (const file of htmlFiles) {
    const original = readFileSync(file, "utf-8");
    const hash = sha(original);

    if (cache[file] === hash) {
      newCache[file] = hash;
      skipped++;
      continue;
    }

    const originalSize = Buffer.byteLength(original, "utf-8");
    try {
      const minifiedHtml = await minifyHtmlContent(original);
      const newSize = Buffer.byteLength(minifiedHtml, "utf-8");
      if (newSize < originalSize) {
        writeFileSync(file, minifiedHtml);
        totalSaved += originalSize - newSize;
        minified++;
        minifiedFiles.push(relative(OUTPUT_DIR, file));
        newCache[file] = hash; // minify前のハッシュで保存
      } else {
        newCache[file] = hash;
      }
    } catch (e) {
      console.warn(
        `⚠️  minify失敗 [html] ${relative(OUTPUT_DIR, file)}: ${e.message}`,
      );
      errors++;
      newCache[file] = hash;
    }
  }

  writeFileSync(MINIFY_CACHE_PATH, JSON.stringify(newCache), "utf-8");

  const total = cssFiles.length + jsFiles.length + htmlFiles.length;
  const errMsg = errors > 0 ? ` ⚠️ ${errors}件失敗` : "";
  if (minified === 0) {
    console.log(`🗜️  変更なし (${skipped}件キャッシュ済${errMsg})`);
  } else {
    const MAX_SHOW = 5;
    const preview =
      minifiedFiles.length <= MAX_SHOW
        ? minifiedFiles.join(", ")
        : `${minifiedFiles.slice(0, MAX_SHOW).join(", ")} ...他${minifiedFiles.length - MAX_SHOW}件`;
    console.log(
      `🗜️  +${minified}件 minify (${(totalSaved / 1024).toFixed(1)}KB削減): ${preview}${errMsg}`,
    );
  }
}

await minifyAssets();

// 今回のビルド統計を保存（次回差分表示用）
writeFileSync(BUILD_STATS_PATH, JSON.stringify(curStats), "utf-8");

console.log("✅ ビルド完了！ dist/ に出力されました");
