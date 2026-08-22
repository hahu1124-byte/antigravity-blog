import { BUILD_STAMP, posts } from "./context.mjs";
import { gpHeaderBlock } from "./gp-header.mjs";

// ==========================================
// 忍者AdMax 設定
// ==========================================

const NINJA_AD_ID = "06dfeeba49e20207a86cd5f651221d50";
const ADMAX_SCRIPT_URL = "https://adm.shinobi.jp/st/t.js";

// ==========================================
// Google AdSense 設定（blog配下のみ・machine-db等には出さない）
// ==========================================

const ADSENSE_CLIENT_ID = "ca-pub-7805361658365027";

// ==========================================
// 共通HTMLテンプレート
// ==========================================

export const SITE_URL = "https://www.antigravity-portal.com";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/blog/images/ai_dev_day1.webp`;

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
export function htmlHead(
  title,
  description,
  cssRelPath = "styles.css",
  ogp = {},
) {
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
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}" crossorigin="anonymous"></script>
    <script defer src="${cssRelPath.replace("styles.css", "scripts/hero-bg.js")}?v=${cacheBust}"></script>
    <script>
        (function(){try{var t=localStorage.getItem('gp-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()
    </script>
</head>
<body>
    <div id="gp-hero-bg"></div>
    ${gpHeaderBlock()}`;
}

export function escapeHtml(text) {
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
export function formatDateTime(dateStr) {
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
export function getDateModifiedBadge(post) {
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
export function getDateModifiedText(post) {
  if (!post.dateModified || post.dateModified === post.date) return "";
  return `<time class="date-modified">最終更新: ${formatDateTime(post.dateModified)}</time>`;
}

/** タグ収集ユーティリティ */
export function collectTags(postList) {
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
export function getNinjaAdHtml() {
  return `
        <div class="ninja-ad-slot">
            <span class="ninja-ad-label">PR</span>
            <div class="admax-switch" data-admax-id="${NINJA_AD_ID}" style="display:inline-block;"></div>
        </div>`;
}

/** スライドイン広告（左から出現、×で閉じる）— 広告未返却時は表示しない */
export function getSlideInAdHtml() {
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
export function getAdVisibilityScript() {
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

export function amazonSearchUrl(keyword) {
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(keyword)}&tag=${AMAZON_TAG}`;
}

export function getAmazonAdsHtml(post) {
  const tags = post.tags || [];
  const isWeekly = tags.includes("週報");
  const isUber = tags.includes("Uber");
  const isDelivery = tags.includes("フードデリバリー");
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
  } else if (isWeekly || ((isUber || isDelivery) && isPachinko)) {
    items = UBER_GEAR_ADS;
    sectionTitle = "🚗 デリバリーで使うもの一覧";
  } else if (isUber || isDelivery) {
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
export function getNoteBannerHtml(post) {
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
