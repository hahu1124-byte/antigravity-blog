#!/usr/bin/env node
/**
 * フードデリバリーデイリーレポート自動生成スクリプト
 *
 * 毎朝 GitHub Actions (JST 6:00) で実行され、名古屋の配達関連情報
 * （Uber Eats・出前館・ロケットナウ・menu横断）を収集してブログ記事として自動生成する。
 *
 * Usage:
 *   node scripts/generate-uber-daily.mjs            # 通常実行
 *   node scripts/generate-uber-daily.mjs --dry-run   # ファイル出力なし
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { renderOgCard } from "./lib/og-image.mjs";
import { stringifyFrontmatter } from "./lib/frontmatter.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONFIG = JSON.parse(
  fs.readFileSync(path.join(__dirname, "uber-daily-config.json"), "utf8"),
);
const OG_CONFIG = JSON.parse(
  fs.readFileSync(path.join(__dirname, "og-image-config.json"), "utf8"),
);
const DRY_RUN = process.argv.includes("--dry-run");

// ===== ユーティリティ =====

// GitHub Actions は UTC で実行されるため、JST (+9h) に変換して日本時間基準にする
const now = new Date();
const today = new Date(now.getTime() + 9 * 60 * 60 * 1000);
const YYYY = today.getUTCFullYear();
const MM = String(today.getUTCMonth() + 1).padStart(2, "0");
const DD = String(today.getUTCDate()).padStart(2, "0");
const DATE_STR = `${YYYY}${MM}${DD}`;
const DATE_DISPLAY = `${YYYY}-${MM}-${DD}`;
const YYYYMM = `${YYYY}${MM}`;
const DAY_OF_WEEK = today.getUTCDay(); // 0=日, 1=月, ..., 6=土
const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

function log(msg) {
  console.log(`[uber-daily] ${msg}`);
}

async function fetchJson(url, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    log(`⚠️ fetchJson 失敗 (${url}): ${e.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    log(`⚠️ fetchText 失敗 (${url}): ${e.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ===== 1. 天気予報 =====

async function getWeather() {
  log("🌤️ 天気予報を取得中...");
  const data = await fetchJson(CONFIG.weather.apiUrl);
  if (!data || !data.forecasts) return null;

  return {
    description: data.description?.bodyText || "",
    forecasts: data.forecasts.map((f) => ({
      date: f.date,
      dateLabel: f.dateLabel,
      telop: f.telop,
      weather: f.detail?.weather || f.telop,
      wind: f.detail?.wind || "",
      tempMin: f.temperature?.min?.celsius,
      tempMax: f.temperature?.max?.celsius,
      chanceOfRain: f.chanceOfRain || {},
      imageUrl: f.image?.url || "",
    })),
  };
}

function getWeatherType(telop, tempMax) {
  const t = telop || "";
  if (t.includes("雪")) return "snow";
  if (t.includes("暴風") || t.includes("雷")) return "storm";
  if (t.includes("雨")) return "rainy";
  if (t.includes("曇")) return "cloudy";
  const max = parseInt(tempMax);
  if (!isNaN(max)) {
    if (max >= 33) return "hot";
    if (max <= 5) return "cold";
  }
  return "sunny";
}

function renderWeatherSection(weather) {
  if (!weather)
    return '<p>天気予報の取得に失敗しました。<a href="https://www.jma.go.jp/bosai/forecast/#area_type=offices&area_code=230000" target="_blank">気象庁ページ</a>をご確認ください。</p>';

  const todayFc = weather.forecasts[0];
  const tomorrowFc = weather.forecasts[1];
  const dayAfterFc = weather.forecasts[2];

  let html = "";

  // 当日（大きく）
  if (todayFc) {
    html += `<div class="weather-today">
  <div class="weather-main">
    <img src="${todayFc.imageUrl}" alt="${todayFc.telop}" class="weather-icon-large">
    <div class="weather-info">
      <span class="weather-telop-large">${todayFc.telop}</span>
      <span class="weather-temp-large">`;
    if (todayFc.tempMin) html += `${todayFc.tempMin}℃`;
    if (todayFc.tempMin && todayFc.tempMax) html += ` / `;
    if (todayFc.tempMax) html += `${todayFc.tempMax}℃`;
    html += `</span>
    </div>
  </div>
  <p class="weather-detail">${todayFc.weather}</p>
  <p class="weather-wind">🌬️ ${todayFc.wind}</p>
</div>`;

    // 時間帯別降水確率
    const rain = todayFc.chanceOfRain;
    if (rain && Object.keys(rain).length > 0) {
      html += `<table class="rain-table">
  <tr><th>時間帯</th><th>0-6時</th><th>6-12時</th><th>12-18時</th><th>18-24時</th></tr>
  <tr><td>☔ 降水確率</td><td>${rain.T00_06 || "--"}</td><td>${rain.T06_12 || "--"}</td><td>${rain.T12_18 || "--"}</td><td>${rain.T18_24 || "--"}</td></tr>
</table>`;
    }
  }

  // 翌日・翌々日（小さく）
  const nextDays = [tomorrowFc, dayAfterFc].filter(Boolean);
  if (nextDays.length > 0) {
    html += '<div class="weather-next-days">';
    for (const fc of nextDays) {
      html += `<div class="weather-next-day">
  <span class="weather-next-label">${fc.dateLabel}（${fc.date}）</span>
  <img src="${fc.imageUrl}" alt="${fc.telop}" class="weather-icon-small">
  <span class="weather-next-telop">${fc.telop}</span>
  <span class="weather-next-temp">`;
      if (fc.tempMin) html += `${fc.tempMin}℃`;
      if (fc.tempMin && fc.tempMax) html += `/`;
      if (fc.tempMax) html += `${fc.tempMax}℃`;
      html += `</span>
</div>`;
    }
    html += "</div>";
  }

  return html;
}

// ===== 2. ニュースRSS =====

function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title =
      (block.match(/<title><!\[CDATA\[(.*?)\]\]>/) ||
        block.match(/<title>(.*?)<\/title>/))?.[1] || "";
    const link = block.match(/<link>(.*?)<\/link>/)?.[1] || "";
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
    items.push({ title, link, pubDate });
  }
  return items;
}

function filterNewsByKeywords(items, keywords) {
  return items.filter((item) => {
    const text = item.title.toLowerCase();
    return keywords.some((kw) => text.includes(kw.toLowerCase()));
  });
}

async function getNews() {
  log("📰 ニュースRSSを取得中...");
  const allFiltered = [];

  for (const source of CONFIG.news.sources) {
    const xml = await fetchText(source.url);
    if (!xml) continue;

    const items = parseRssItems(xml);
    const filtered = filterNewsByKeywords(items, CONFIG.news.deliveryKeywords);
    const limited = filtered.slice(0, source.maxItems);
    allFiltered.push(
      ...limited.map((item) => ({ ...item, source: source.name })),
    );
  }

  return allFiltered;
}

function renderNewsSection(news) {
  if (!news || news.length === 0) {
    return '<p>特に無し</p><p class="section-note">配達に大きな影響がありそうなニュースは見つかりませんでした。</p>';
  }

  let html = '<ul class="news-list">';
  for (const item of news.slice(0, 8)) {
    html += `<li><a href="${item.link}" target="_blank" rel="noopener">${item.title}</a> <span class="news-source">(${item.source})</span></li>`;
  }
  html += "</ul>";
  return html;
}

// ===== 3. 道路交通情報 =====

function renderTrafficSection() {
  // 自動取得が不安定なため、安定するまではリンク案内のみ
  return `<p>特に無し</p>
<p class="section-note">名古屋市内の最新交通規制情報は <a href="https://www.jartic.or.jp/" target="_blank" rel="noopener">JARTIC</a> をご確認ください。</p>`;
}

// ===== 4. ガソリン価格 =====

// ガソリン価格は独立した週次ワークフロー (update-gas-price.yml) がキャッシュを更新する。
// このスクリプトはキャッシュを読むだけで、外部の経産省サイトへは一切アクセスしない。
function getGasPriceCache() {
  const cachePath = path.join(ROOT, CONFIG.gasoline.cacheFile);
  try {
    const data = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    const cacheDate = new Date(data.fetchDate);
    const diffDays = (today - cacheDate) / (1000 * 60 * 60 * 24);
    if (diffDays > 8) {
      log(
        "⛽ ガソリン価格キャッシュが古め（" +
          Math.floor(diffDays) +
          "日前）。経産省側の取得に失敗している可能性があります",
      );
    }
    return data;
  } catch {
    return null;
  }
}

async function getGasPrice() {
  return getGasPriceCache();
}

function renderGasSection(gas) {
  if (!gas) {
    return `<p>ガソリン価格情報を取得できませんでした。</p>
<p class="section-note"><a href="https://gogo.gs/" target="_blank" rel="noopener">gogo.gs</a> で最寄りのスタンドをチェック！</p>`;
  }

  return `<table class="gas-table">
  <tr><th>種別</th><th>価格（円/L）</th></tr>
  <tr><td>⛽ レギュラー</td><td><strong>${gas.regular || "---"}</strong></td></tr>
  <tr><td>⛽ ハイオク</td><td>${gas.premium || "---"}</td></tr>
  <tr><td>🛢️ 軽油</td><td>${gas.diesel || "---"}</td></tr>
  <tr><td>🔥 灯油（18L）</td><td>${gas.kerosene || "---"}</td></tr>
</table>
<p class="section-note">出典: 経済産業省 石油製品価格調査（${gas.region}地域平均・週次更新）<br>調査日: ${gas.fetchDate}</p>`;
}

// ===== 4b. プラットフォーム別の狙い目 =====

function renderPlatformsSection() {
  const platforms = CONFIG.platforms || [];
  if (platforms.length === 0) return "<p>特に無し</p>";

  let html = '<ul class="platform-list">';
  for (const p of platforms) {
    html += `<li>${p.emoji} <strong>${p.name}</strong> — ${p.note}</li>`;
  }
  html += "</ul>";
  html += `<p class="section-note">各社の詳しい比較は <a href="../../202608/20260808_delivery_platform_comparison_nagoya/">名古屋のフードデリバリー配達員 4社徹底比較</a> をチェック！</p>`;
  return html;
}

// ===== 5. ピーク予測 =====

function getPeakPredictions(weather) {
  const predictions = [];
  const todayFc = weather?.forecasts?.[0];
  const telop = todayFc?.telop || "";
  const maxTemp = parseInt(todayFc?.tempMax);

  // 雨チェック
  if (telop.includes("雨")) {
    predictions.push(CONFIG.peakRules.find((r) => r.condition === "rain"));
  }

  // 寒さ / 暑さ
  if (!isNaN(maxTemp)) {
    if (maxTemp <= 8)
      predictions.push(CONFIG.peakRules.find((r) => r.condition === "cold"));
    if (maxTemp >= 30)
      predictions.push(CONFIG.peakRules.find((r) => r.condition === "hot"));
  }

  // 金曜夜
  if (DAY_OF_WEEK === 5) {
    predictions.push(
      CONFIG.peakRules.find((r) => r.condition === "friday_evening"),
    );
  }

  // 週末ランチ
  if (DAY_OF_WEEK === 0 || DAY_OF_WEEK === 6) {
    predictions.push(
      CONFIG.peakRules.find((r) => r.condition === "weekend_lunch"),
    );
  }

  return predictions.filter(Boolean);
}

function renderPeakSection(predictions) {
  if (predictions.length === 0) {
    return "<p>📊 通常レベルの需要が予想されます。</p>";
  }

  let maxMultiplier = Math.max(...predictions.map((p) => p.multiplier));
  let level =
    maxMultiplier >= 1.4
      ? "🔥 高需要"
      : maxMultiplier >= 1.2
        ? "📈 やや高め"
        : "📊 通常";

  let html = `<p class="peak-level"><strong>${level}</strong></p><ul class="peak-list">`;
  for (const p of predictions) {
    html += `<li>${p.emoji} ${p.message}（需要 ×${p.multiplier}）</li>`;
  }
  html += "</ul>";
  return html;
}

// ===== 6. イベント情報 =====

async function getEvents() {
  log("📍 イベント情報を取得中...");
  // Walker Plus等のスクレイピングは不安定のため、初期はリンク案内
  return [];
}

function renderEventsSection(events) {
  if (!events || events.length === 0) {
    return `<p>特に無し</p>
<p class="section-note">名古屋のイベント情報は <a href="https://www.walkerplus.com/event_list/ar0623/" target="_blank" rel="noopener">Walker Plus</a> をチェック！<br>
バンテリンドーム・ガイシホール付近はイベント時に混雑します。</p>`;
  }

  let html = '<ul class="event-list">';
  for (const event of events) {
    html += `<li>${event.emoji || "📍"} ${event.name} — ${event.venue}</li>`;
  }
  html += "</ul>";
  return html;
}

// ===== 7. 体感指数・アドバイス =====

function getHeatAdvice(weather) {
  const todayFc = weather?.forecasts?.[0];
  const maxTemp = parseInt(todayFc?.tempMax);
  if (isNaN(maxTemp)) return null;

  for (const advice of CONFIG.heatAdvice) {
    if (maxTemp >= advice.minTemp) return { ...advice, temp: maxTemp };
  }
  return {
    emoji: "❄️",
    message: "極寒。路面凍結に最大限の注意を",
    temp: maxTemp,
  };
}

function renderHeatSection(advice) {
  if (!advice) return "<p>気温情報を取得できませんでした。</p>";

  return `<div class="heat-advice">
  <span class="heat-emoji">${advice.emoji}</span>
  <div class="heat-info">
    <span class="heat-temp">最高気温 ${advice.temp}℃</span>
    <span class="heat-message">${advice.message}</span>
  </div>
</div>`;
}

// ===== 8. 曜日別傾向 =====

function renderDayTipSection() {
  const tip = CONFIG.dayOfWeekTips[String(DAY_OF_WEEK)];
  if (!tip) return "";
  return `<div class="day-tip">
  <span class="day-tip-emoji">${tip.emoji}</span>
  <span class="day-tip-text"><strong>${DAY_NAMES[DAY_OF_WEEK]}曜日の傾向:</strong> ${tip.tip}</span>
</div>`;
}

// ===== 9. 一言コメント =====

function generateComment(weather, predictions) {
  const todayFc = weather?.forecasts?.[0];
  const telop = todayFc?.telop || "";
  const dayName = DAY_NAMES[DAY_OF_WEEK];

  if (telop.includes("雨") && DAY_OF_WEEK === 5) {
    return "🔥 雨×金曜のダブルブースト！今日は稼ぎ時です！";
  }
  if (telop.includes("雨")) {
    return "🌧️ 雨の日は注文数UP！レインウェアを装備して出発しよう！";
  }
  if (DAY_OF_WEEK === 5) {
    return "🍻 金曜日！夜のピークタイムに向けて準備しよう！";
  }
  if (DAY_OF_WEEK === 0 || DAY_OF_WEEK === 6) {
    return `☀️ ${dayName}曜日！ランチ〜夕方の時間帯をしっかり狙おう！`;
  }
  if (predictions.length > 0) {
    return `📈 需要UPの条件あり！チャンスを逃さず稼ごう！`;
  }
  if (telop.includes("晴")) {
    return `☀️ ${dayName}曜日、天気良好！快適に配達できる1日になりそう！`;
  }
  return `📊 ${dayName}曜日、いつも通りの1日。コツコツ稼いでいこう！`;
}

// ===== タイトル生成 =====

function generateTitle(weather) {
  const todayFc = weather?.forecasts?.[0];
  const type = getWeatherType(todayFc?.telop, todayFc?.tempMax);
  const tmpl = CONFIG.titleTemplates[type] || CONFIG.titleTemplates.sunny;
  return `${tmpl.emoji} ${DATE_STR} ${tmpl.text}`;
}

// ===== 本文フラグメント生成 =====
// buildArticlePages()（scripts/build/blog-pages.mjs）が head/広告/関連記事/前後ナビ等を
// 付与するため、ここでは .daily-comment + .uber-section×8 の本文だけを組み立てる。
// 天気セクション直後の <hr> は、build.mjs 側が最初の<hr>直後に中間広告を自動挿入する
// トリガーとして機能する（既存記事の慣行と同じ）。

function buildFragment({
  commentText,
  weatherHtml,
  platformsHtml,
  peakHtml,
  heatHtml,
  dayTipHtml,
  trafficHtml,
  newsHtml,
  eventsHtml,
  gasHtml,
}) {
  return `<div class="daily-comment">${commentText}</div>

<div class="uber-section">
  <h2>🌤️ 今日の天気 — 名古屋</h2>
  ${weatherHtml}
</div>

<hr>

<div class="uber-section">
  <h2>🛵 プラットフォーム別の狙い目</h2>
  ${platformsHtml}
</div>

<div class="uber-section">
  <h2>🎯 需要予測</h2>
  ${peakHtml}
</div>

<div class="uber-section">
  <h2>🌡️ 体感指数・配達アドバイス</h2>
  ${heatHtml}
</div>

<div class="uber-section">
  <h2>📈 曜日別傾向</h2>
  ${dayTipHtml}
</div>

<div class="uber-section">
  <h2>🚗 名古屋市 道路交通情報</h2>
  ${trafficHtml}
</div>

<div class="uber-section">
  <h2>📰 配達に影響しそうなニュース</h2>
  ${newsHtml}
</div>

<div class="uber-section">
  <h2>📍 名古屋イベント情報</h2>
  ${eventsHtml}
</div>

<div class="uber-section">
  <h2>⛽ ガソリン価格（${CONFIG.gasoline.region}地域平均）</h2>
  ${gasHtml}
</div>
`;
}

// ===== フラグメント書き込み =====
// src/articles/<YYYYMM>/<DATE_STR>_uber_daily.html へ常に上書きする
// （同日再実行時も最新データで更新される。build.mjs 側が dist へのHTML組み立てを担う）

function writeFragment(html, title, ogImageRel) {
  const dir = path.join(ROOT, "src/articles", YYYYMM);
  fs.mkdirSync(dir, { recursive: true });

  const blogTag = CONFIG.blog.tag;
  const fullTitle = `🚴 ${blogTag}情報 ${title}`;
  const metadata = {
    title: fullTitle,
    date: DATE_DISPLAY,
    excerpt: `名古屋のフードデリバリー配達（Uber Eats・出前館・ロケットナウ・menu）に役立つ${DATE_DISPLAY}の情報。天気・交通・ニュース・ガソリン価格・需要予測をチェック！`,
    tags: [blogTag],
    ...(ogImageRel ? { ogImage: ogImageRel } : {}),
  };

  const fileContent = stringifyFrontmatter(metadata, html.trimStart());
  fs.writeFileSync(path.join(dir, `${DATE_STR}_uber_daily.html`), fileContent);
}

// ===== blog-data.json 更新 =====

function updateBlogData(title, ogImageRel) {
  const blogDataPath = path.join(ROOT, "src/blog-data.json");

  let data = [];
  try {
    data = JSON.parse(fs.readFileSync(blogDataPath, "utf8"));
  } catch {}

  const slug = `${YYYYMM}/${DATE_STR}_uber_daily`;
  const blogTag = CONFIG.blog.tag;
  const fullTitle = `🚴 ${blogTag}情報 ${title}`;
  const entry = {
    slug,
    title: fullTitle,
    date: DATE_DISPLAY,
    excerpt: `名古屋のフードデリバリー配達（Uber Eats・出前館・ロケットナウ・menu）に役立つ${DATE_DISPLAY}の情報。天気・交通・ニュース・ガソリン価格・需要予測をチェック！`,
    tags: [blogTag],
    ...(ogImageRel ? { ogImage: ogImageRel } : {}),
  };

  // 同日の記事が既にあれば置換（冪等）、無ければ先頭に追加
  const existingIdx = data.findIndex((d) => d.slug === slug);
  if (existingIdx >= 0) {
    data[existingIdx] = entry;
    log("📋 blog-data.json: 同日の記事エントリを更新（冪等）");
  } else {
    data.unshift(entry);
  }

  if (!DRY_RUN) {
    fs.writeFileSync(blogDataPath, JSON.stringify(data, null, 2));
    log("📋 blog-data.json 更新完了");
  } else {
    log("📋 [dry-run] blog-data.json 更新スキップ");
  }
}

// ===== メイン実行 =====

async function main() {
  log(
    `🚴 ${CONFIG.blog.tag}デイリーレポート生成開始 — ${DATE_DISPLAY}（${DAY_NAMES[DAY_OF_WEEK]}）`,
  );
  if (DRY_RUN) log("⚠️ ドライランモード: ファイル出力なし");

  // 1. データ収集（並列）
  const [weather, news, gasPrice, events] = await Promise.all([
    getWeather(),
    getNews(),
    getGasPrice(),
    getEvents(),
  ]);

  // 2. 解析
  const predictions = getPeakPredictions(weather);
  const heatAdvice = getHeatAdvice(weather);
  const title = generateTitle(weather);
  const commentText = generateComment(weather, predictions);

  // 2.5 OGP画像生成（LLM/外部API不使用、フォント欠落時は null → DEFAULT_OG_IMAGE にフォールバック）
  const slug = `${YYYYMM}/${DATE_STR}_uber_daily`;
  let ogImageRel = null;
  if (!DRY_RUN) {
    const fullTitle = `🚴 ${CONFIG.blog.tag}情報 ${title}`;
    ogImageRel = await renderOgCard({
      title: fullTitle,
      date: DATE_DISPLAY,
      tags: [CONFIG.blog.tag],
      slug,
      imagesDir: path.join(ROOT, "src/images"),
      config: OG_CONFIG,
    });
  }

  // 3. 各セクションHTML生成
  const weatherHtml = renderWeatherSection(weather);
  const trafficHtml = renderTrafficSection();
  const newsHtml = renderNewsSection(news);
  const gasHtml = renderGasSection(gasPrice);
  const peakHtml = renderPeakSection(predictions);
  const eventsHtml = renderEventsSection(events);
  const heatHtml = renderHeatSection(heatAdvice);
  const dayTipHtml = renderDayTipSection();
  const platformsHtml = renderPlatformsSection();

  // 4. 本文フラグメント組み立て（head/広告/関連記事/前後ナビは build.mjs 側が付与）
  const fragment = buildFragment({
    commentText,
    weatherHtml,
    platformsHtml,
    peakHtml,
    heatHtml,
    dayTipHtml,
    trafficHtml,
    newsHtml,
    eventsHtml,
    gasHtml,
  });

  // 5. ファイル出力
  const outputFile = path.join(
    ROOT,
    "src/articles",
    YYYYMM,
    `${DATE_STR}_uber_daily.html`,
  );

  if (!DRY_RUN) {
    writeFragment(fragment, title, ogImageRel);
    log(`✅ 記事生成完了: ${outputFile}`);

    // 6. blog-data.json 更新（互換用）
    updateBlogData(title, ogImageRel);
  } else {
    log(`📄 [dry-run] 出力先: ${outputFile}`);
    log(`📄 [dry-run] タイトル: 🚴 ${CONFIG.blog.tag}情報 ${title}`);
    log(`📄 [dry-run] 一言: ${commentText}`);
    // dry-run でもフラグメントを表示
    console.log("\n--- 生成フラグメント ---");
    console.log(fragment);
  }

  log("🏁 完了");
}

main().catch((e) => {
  console.error("[uber-daily] ❌ エラー:", e);
  process.exit(1);
});
