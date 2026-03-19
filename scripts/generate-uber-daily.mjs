#!/usr/bin/env node
/**
 * Uber配達デイリーレポート自動生成スクリプト
 *
 * 毎朝 GitHub Actions (JST 6:00) で実行され、名古屋の配達関連情報を
 * 収集してブログ記事として自動生成する。
 *
 * Usage:
 *   node scripts/generate-uber-daily.mjs            # 通常実行
 *   node scripts/generate-uber-daily.mjs --dry-run   # ファイル出力なし
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'uber-daily-config.json'), 'utf8'));
const DRY_RUN = process.argv.includes('--dry-run');

// ===== ユーティリティ =====

const today = new Date();
const YYYY = today.getFullYear();
const MM = String(today.getMonth() + 1).padStart(2, '0');
const DD = String(today.getDate()).padStart(2, '0');
const DATE_STR = `${YYYY}${MM}${DD}`;
const DATE_DISPLAY = `${YYYY}-${MM}-${DD}`;
const YYYYMM = `${YYYY}${MM}`;
const DAY_OF_WEEK = today.getDay(); // 0=日, 1=月, ..., 6=土
const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

function log(msg) { console.log(`[uber-daily] ${msg}`); }

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
  log('🌤️ 天気予報を取得中...');
  const data = await fetchJson(CONFIG.weather.apiUrl);
  if (!data || !data.forecasts) return null;

  return {
    description: data.description?.bodyText || '',
    forecasts: data.forecasts.map(f => ({
      date: f.date,
      dateLabel: f.dateLabel,
      telop: f.telop,
      weather: f.detail?.weather || f.telop,
      wind: f.detail?.wind || '',
      tempMin: f.temperature?.min?.celsius,
      tempMax: f.temperature?.max?.celsius,
      chanceOfRain: f.chanceOfRain || {},
      imageUrl: f.image?.url || ''
    }))
  };
}

function getWeatherType(telop, tempMax) {
  const t = telop || '';
  if (t.includes('雪')) return 'snow';
  if (t.includes('暴風') || t.includes('雷')) return 'storm';
  if (t.includes('雨')) return 'rainy';
  if (t.includes('曇')) return 'cloudy';
  const max = parseInt(tempMax);
  if (!isNaN(max)) {
    if (max >= 33) return 'hot';
    if (max <= 5) return 'cold';
  }
  return 'sunny';
}

function renderWeatherSection(weather) {
  if (!weather) return '<p>天気予報の取得に失敗しました。<a href="https://www.jma.go.jp/bosai/forecast/#area_type=offices&area_code=230000" target="_blank">気象庁ページ</a>をご確認ください。</p>';

  const todayFc = weather.forecasts[0];
  const tomorrowFc = weather.forecasts[1];
  const dayAfterFc = weather.forecasts[2];

  let html = '';

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
  <tr><td>☔ 降水確率</td><td>${rain.T00_06 || '--'}</td><td>${rain.T06_12 || '--'}</td><td>${rain.T12_18 || '--'}</td><td>${rain.T18_24 || '--'}</td></tr>
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
    html += '</div>';
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
    const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]>/) || block.match(/<title>(.*?)<\/title>/))?.[1] || '';
    const link = (block.match(/<link>(.*?)<\/link>/))?.[1] || '';
    const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/))?.[1] || '';
    items.push({ title, link, pubDate });
  }
  return items;
}

function filterNewsByKeywords(items, keywords) {
  return items.filter(item => {
    const text = item.title.toLowerCase();
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  });
}

async function getNews() {
  log('📰 ニュースRSSを取得中...');
  const allFiltered = [];

  for (const source of CONFIG.news.sources) {
    const xml = await fetchText(source.url);
    if (!xml) continue;

    const items = parseRssItems(xml);
    const filtered = filterNewsByKeywords(items, CONFIG.news.deliveryKeywords);
    const limited = filtered.slice(0, source.maxItems);
    allFiltered.push(...limited.map(item => ({ ...item, source: source.name })));
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
  html += '</ul>';
  return html;
}

// ===== 3. 道路交通情報 =====

function renderTrafficSection() {
  // 自動取得が不安定なため、安定するまではリンク案内のみ
  return `<p>特に無し</p>
<p class="section-note">名古屋市内の最新交通規制情報は <a href="https://www.jartic.or.jp/" target="_blank" rel="noopener">JARTIC</a> をご確認ください。</p>`;
}

// ===== 4. ガソリン価格 =====

function getGasPriceCache() {
  const cachePath = path.join(ROOT, CONFIG.gasoline.cacheFile);
  try {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const cacheDate = new Date(data.fetchDate);
    const diffDays = (today - cacheDate) / (1000 * 60 * 60 * 24);
    if (diffDays > 8) {
      log('⛽ ガソリン価格キャッシュが古め（' + Math.floor(diffDays) + '日前）。gas-price-cache.json の手動更新を推奨');
    }
    // キャッシュが古くてもデータがあれば使用（経産省CSVは自動取得不可のため）
    return data;
  } catch {
    return null;
  }
}

async function updateGasPriceCache() {
  log('⛽ 経産省ガソリン価格データを取得中...');
  // 経産省の石油製品価格調査（毎週水曜発表）
  // CSVファイルのURLパターン: 最新データのURL
  const url = 'https://www.enecho.meti.go.jp/statistics/petroleum_and_lpgas/pl007/csv/sekiyu_kakaku_latest.csv';
  const csv = await fetchText(url);

  if (!csv) {
    log('⚠️ 経産省データ取得失敗。代替価格データを使用');
    return null;
  }

  // CSV解析（愛知県の行を探す）
  const lines = csv.split('\n');
  let prices = null;
  for (const line of lines) {
    if (line.includes(CONFIG.gasoline.region)) {
      const cols = line.split(',');
      // 一般的なCSVフォーマット: 地域, レギュラー, ハイオク, 軽油, 灯油
      prices = {
        regular: cols[1]?.trim(),
        premium: cols[2]?.trim(),
        diesel: cols[3]?.trim(),
        kerosene: cols[4]?.trim()
      };
      break;
    }
  }

  if (prices) {
    const cacheData = {
      fetchDate: DATE_DISPLAY,
      region: CONFIG.gasoline.region,
      source: '経済産業省 石油製品価格調査',
      ...prices
    };
    if (!DRY_RUN) {
      fs.writeFileSync(path.join(ROOT, CONFIG.gasoline.cacheFile), JSON.stringify(cacheData, null, 2));
    }
    return cacheData;
  }

  return null;
}

async function getGasPrice() {
  let cache = getGasPriceCache();
  if (!cache) {
    cache = await updateGasPriceCache();
  }
  return cache;
}

function renderGasSection(gas) {
  if (!gas) {
    return `<p>ガソリン価格情報を取得できませんでした。</p>
<p class="section-note"><a href="https://gogo.gs/" target="_blank" rel="noopener">gogo.gs</a> で最寄りのスタンドをチェック！</p>`;
  }

  return `<table class="gas-table">
  <tr><th>種別</th><th>価格（円/L）</th></tr>
  <tr><td>⛽ レギュラー</td><td><strong>${gas.regular || '---'}</strong></td></tr>
  <tr><td>⛽ ハイオク</td><td>${gas.premium || '---'}</td></tr>
  <tr><td>🛢️ 軽油</td><td>${gas.diesel || '---'}</td></tr>
  <tr><td>🔥 灯油（18L）</td><td>${gas.kerosene || '---'}</td></tr>
</table>
<p class="section-note">出典: 経済産業省 石油製品価格調査（${gas.region}地域平均・週次更新）<br>調査日: ${gas.fetchDate}</p>`;
}

// ===== 5. ピーク予測 =====

function getPeakPredictions(weather) {
  const predictions = [];
  const todayFc = weather?.forecasts?.[0];
  const telop = todayFc?.telop || '';
  const maxTemp = parseInt(todayFc?.tempMax);

  // 雨チェック
  if (telop.includes('雨')) {
    predictions.push(CONFIG.peakRules.find(r => r.condition === 'rain'));
  }

  // 寒さ / 暑さ
  if (!isNaN(maxTemp)) {
    if (maxTemp <= 8) predictions.push(CONFIG.peakRules.find(r => r.condition === 'cold'));
    if (maxTemp >= 30) predictions.push(CONFIG.peakRules.find(r => r.condition === 'hot'));
  }

  // 金曜夜
  if (DAY_OF_WEEK === 5) {
    predictions.push(CONFIG.peakRules.find(r => r.condition === 'friday_evening'));
  }

  // 週末ランチ
  if (DAY_OF_WEEK === 0 || DAY_OF_WEEK === 6) {
    predictions.push(CONFIG.peakRules.find(r => r.condition === 'weekend_lunch'));
  }

  return predictions.filter(Boolean);
}

function renderPeakSection(predictions) {
  if (predictions.length === 0) {
    return '<p>📊 通常レベルの需要が予想されます。</p>';
  }

  let maxMultiplier = Math.max(...predictions.map(p => p.multiplier));
  let level = maxMultiplier >= 1.4 ? '🔥 高需要' : maxMultiplier >= 1.2 ? '📈 やや高め' : '📊 通常';

  let html = `<p class="peak-level"><strong>${level}</strong></p><ul class="peak-list">`;
  for (const p of predictions) {
    html += `<li>${p.emoji} ${p.message}（需要 ×${p.multiplier}）</li>`;
  }
  html += '</ul>';
  return html;
}

// ===== 6. イベント情報 =====

async function getEvents() {
  log('📍 イベント情報を取得中...');
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
    html += `<li>${event.emoji || '📍'} ${event.name} — ${event.venue}</li>`;
  }
  html += '</ul>';
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
  return { emoji: '❄️', message: '極寒。路面凍結に最大限の注意を', temp: maxTemp };
}

function renderHeatSection(advice) {
  if (!advice) return '<p>気温情報を取得できませんでした。</p>';

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
  if (!tip) return '';
  return `<div class="day-tip">
  <span class="day-tip-emoji">${tip.emoji}</span>
  <span class="day-tip-text"><strong>${DAY_NAMES[DAY_OF_WEEK]}曜日の傾向:</strong> ${tip.tip}</span>
</div>`;
}

// ===== 9. 一言コメント =====

function generateComment(weather, predictions) {
  const todayFc = weather?.forecasts?.[0];
  const telop = todayFc?.telop || '';
  const dayName = DAY_NAMES[DAY_OF_WEEK];

  if (telop.includes('雨') && DAY_OF_WEEK === 5) {
    return '🔥 雨×金曜のダブルブースト！今日は稼ぎ時です！';
  }
  if (telop.includes('雨')) {
    return '🌧️ 雨の日は注文数UP！レインウェアを装備して出発しよう！';
  }
  if (DAY_OF_WEEK === 5) {
    return '🍻 金曜日！夜のピークタイムに向けて準備しよう！';
  }
  if (DAY_OF_WEEK === 0 || DAY_OF_WEEK === 6) {
    return `☀️ ${dayName}曜日！ランチ〜夕方の時間帯をしっかり狙おう！`;
  }
  if (predictions.length > 0) {
    return `📈 需要UPの条件あり！チャンスを逃さず稼ごう！`;
  }
  if (telop.includes('晴')) {
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

// ===== HTML生成 =====

function buildArticleHtml({
  title, weatherHtml, trafficHtml, newsHtml, gasHtml,
  peakHtml, eventsHtml, heatHtml, dayTipHtml, commentText
}) {
  const fullTitle = `🚴 Uber配達日報 ${title}`;
  const description = `名古屋のUber配達に役立つ今日の情報をまとめました。天気・交通・ニュース・ガソリン価格・需要予測をチェック！`;
  const articleUrl = `https://www.antigravity-portal.com/blog/${YYYYMM}/${DATE_STR}_uber_daily/`;
  const encodedTag = encodeURIComponent('Uber配達');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fullTitle} | Gravity Portal</title>
    <meta name="description" content="${description}">
    <!-- OGP -->
    <meta property="og:title" content="${fullTitle}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${articleUrl}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Gravity Portal">
    <meta property="og:locale" content="ja_JP">
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${fullTitle}">
    <meta name="twitter:description" content="${description}">
    <link rel="stylesheet" href="../../styles.css?v=${Date.now()}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="preconnect" href="https://adm.shinobi.jp">
    <link rel="preconnect" href="https://cnobi.jp">
    <link rel="dns-prefetch" href="https://adm.shinobi.jp">
    <link rel="dns-prefetch" href="https://cnobi.jp">
    <style>
      /* Uber Daily 専用スタイル — テーマ対応 */
      /* ベース: テキスト色を明示的に指定 */
      .article-page { color: #1a1a1a; }
      [data-theme="dark"] .article-page { color: #e8e8e8; }

      .weather-today { background: #f0f2f5; border-radius: 12px; padding: 1.2rem; margin: 1rem 0; color: #1a1a1a; }
      [data-theme="dark"] .weather-today { background: #2a2d35; color: #e8e8e8; }
      .weather-main { display: flex; align-items: center; gap: 1rem; }
      .weather-icon-large { width: 80px; height: 60px; }
      .weather-telop-large { font-size: 1.5rem; font-weight: 700; display: block; color: inherit; }
      .weather-temp-large { font-size: 1.2rem; color: #555; display: block; }
      [data-theme="dark"] .weather-temp-large { color: #bbb; }
      .weather-detail, .weather-wind { font-size: 0.9rem; color: #555; margin: 0.3rem 0; }
      [data-theme="dark"] .weather-detail, [data-theme="dark"] .weather-wind { color: #bbb; }

      .rain-table { width: 100%; border-collapse: collapse; margin: 0.8rem 0; font-size: 0.9rem; color: inherit; }
      .rain-table th, .rain-table td { padding: 0.4rem 0.6rem; border: 1px solid #ccc; text-align: center; color: inherit; }
      .rain-table th { background: #e8eaed; font-weight: 600; }
      [data-theme="dark"] .rain-table th { background: #35383f; }
      [data-theme="dark"] .rain-table th, [data-theme="dark"] .rain-table td { border-color: #444; color: #e8e8e8; }

      .weather-next-days { display: flex; gap: 1rem; margin: 1rem 0; }
      .weather-next-day { flex: 1; background: #f0f2f5; border-radius: 8px; padding: 0.8rem; text-align: center; color: #1a1a1a; }
      [data-theme="dark"] .weather-next-day { background: #2a2d35; color: #e8e8e8; }
      .weather-next-label { display: block; font-size: 0.8rem; color: #666; margin-bottom: 0.3rem; }
      [data-theme="dark"] .weather-next-label { color: #aaa; }
      .weather-icon-small { width: 50px; height: 38px; }
      .weather-next-telop { display: block; font-weight: 600; margin-top: 0.3rem; color: inherit; }
      .weather-next-temp { display: block; font-size: 0.85rem; color: #555; }
      [data-theme="dark"] .weather-next-temp { color: #bbb; }

      .gas-table { width: 100%; max-width: 320px; border-collapse: collapse; margin: 0.8rem 0; }
      .gas-table th, .gas-table td { padding: 0.5rem 0.8rem; border: 1px solid #ccc; color: inherit; }
      .gas-table th { background: #e8eaed; text-align: left; }
      [data-theme="dark"] .gas-table th { background: #35383f; }
      [data-theme="dark"] .gas-table th, [data-theme="dark"] .gas-table td { border-color: #444; }

      .section-note { font-size: 0.85rem; color: #777; margin-top: 0.4rem; }
      [data-theme="dark"] .section-note { color: #999; }
      .peak-level { font-size: 1.2rem; margin: 0.5rem 0; color: inherit; }
      .peak-list { list-style: none; padding: 0; }
      .peak-list li { padding: 0.3rem 0; color: inherit; }
      .news-list { list-style: none; padding: 0; }
      .news-list li { padding: 0.4rem 0; border-bottom: 1px solid #eee; color: inherit; }
      [data-theme="dark"] .news-list li { border-bottom-color: #333; }
      .news-list a { color: #0066cc; text-decoration: none; }
      [data-theme="dark"] .news-list a { color: #6db3f2; }
      .news-list a:hover { text-decoration: underline; }
      .news-source { font-size: 0.8rem; color: #888; }
      [data-theme="dark"] .news-source { color: #999; }

      .heat-advice { display: flex; align-items: center; gap: 1rem; background: #f0f2f5; border-radius: 12px; padding: 1rem; margin: 0.8rem 0; color: #1a1a1a; }
      [data-theme="dark"] .heat-advice { background: #2a2d35; color: #e8e8e8; }
      .heat-emoji { font-size: 2rem; }
      .heat-temp { display: block; font-weight: 700; font-size: 1.1rem; color: inherit; }
      .heat-message { display: block; color: #555; font-size: 0.95rem; }
      [data-theme="dark"] .heat-message { color: #bbb; }

      .day-tip { display: flex; align-items: center; gap: 0.8rem; background: #eef4ff; border-radius: 10px; padding: 1rem; margin: 0.8rem 0; border-left: 4px solid #4a9eff; color: #1a1a1a; }
      [data-theme="dark"] .day-tip { background: #1e2a3a; color: #e8e8e8; }
      .day-tip-emoji { font-size: 1.5rem; }
      .day-tip-text { font-size: 0.95rem; color: inherit; }

      .daily-comment { background: linear-gradient(135deg, #667eea22, #764ba222); border-radius: 12px; padding: 1.2rem; margin: 1.2rem 0; font-size: 1.1rem; text-align: center; font-weight: 600; color: inherit; }
      .uber-section { margin: 1.5rem 0; }
      .uber-section h2 { border-bottom: 2px solid #ddd; padding-bottom: 0.4rem; color: inherit; }
      [data-theme="dark"] .uber-section h2 { border-bottom-color: #444; }
      .uber-section p, .uber-section li, .uber-section td { color: inherit; }
    </style>
    <script>
        (function(){try{var t=localStorage.getItem('gp-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()
    </script>
</head>
<body>
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
    </script>
    <div class="article-page">
        <nav class="breadcrumb">
            <a href="https://antigravity-portal.com/">トップ</a>
            <span class="separator">/</span>
            <a href="../../">ブログ</a>
            <span class="separator">/</span>
            <span class="current">🚴 Uber配達日報 ${title}</span>
        </nav>

        <article class="article">
            <header class="article-header">
                <div class="meta">
                    <time class="date">${DATE_DISPLAY}</time>
                    <div class="tags">
                        <a href="../../tag/${encodedTag}/" class="tag">Uber配達</a>
                    </div>
                </div>
                <h1 class="title">🚴 Uber配達日報 ${title}</h1>
            </header>

            <div class="content">
                <div class="daily-comment">${commentText}</div>

                <div class="uber-section">
                  <h2>🌤️ 今日の天気 — 名古屋</h2>
                  ${weatherHtml}
                </div>

                <div class="ninja-ad-slot">
                    <span class="ninja-ad-label">PR</span>
                    <div class="admax-switch" data-admax-id="06dfeeba49e20207a86cd5f651221d50" style="display:inline-block;"></div>
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

            </div>

            <div class="ninja-ad-slot">
                <span class="ninja-ad-label">PR</span>
                <div class="admax-switch" data-admax-id="06dfeeba49e20207a86cd5f651221d50" style="display:inline-block;"></div>
            </div>

            <div class="amazon-ads-section">
                <h3 class="amazon-ads-heading">🚴 配達に役立つアイテム</h3>
                <div class="amazon-ads-grid">
${CONFIG.blog.amazonSearches.map(s => `                    <a href="https://www.amazon.co.jp/s?k=${encodeURIComponent(s.query)}&tag=gravity063-22" target="_blank" rel="noopener noreferrer" class="amazon-ad-card">
                        <span class="amazon-ad-emoji">${s.emoji}</span>
                        <span class="amazon-ad-title">${s.title}</span>
                        <span class="amazon-ad-badge">Amazonで見る</span>
                    </a>`).join('\n')}
                </div>
                <div class="amazon-search-box">
                    <p class="amazon-search-label">🔍 <span class="amazon-logo-text">Amazon</span>で探す</p>
                    <form onsubmit="window.open('https://www.amazon.co.jp/s?k='+encodeURIComponent(this.q.value)+'&tag=gravity063-22','_blank');return false;" class="amazon-search-form">
                        <input type="text" name="q" placeholder="キーワードを入力..." class="amazon-search-input" />
                        <button type="submit" class="amazon-search-btn">検索</button>
                    </form>
                </div>
                <p class="amazon-ads-note">※ 上記リンクはAmazonアソシエイトリンクです</p>
                <p class="amazon-ads-note">Amazonのアソシエイトとして、Gravity Portalは適格販売により収入を得ています。</p>
            </div>
        </article>

        <nav class="back-nav">
            <a href="https://antigravity-portal.com/" class="back-link">🏠 TOPに戻る</a>
            <a href="../../" class="back-link">← 記事一覧に戻る</a>
        </nav>
    </div>

    <script>
    (function(){
        var AD_ID = '06dfeeba49e20207a86cd5f651221d50';
        var SDK_URL = 'https://adm.shinobi.jp/st/t.js';
        function hideAllAds(){document.querySelectorAll('.ninja-ad-slot').forEach(function(s){s.style.display='none'})}
        function initAds(){
            if(!window.admaxads) window.admaxads=[];
            document.querySelectorAll('.admax-switch[data-admax-id]').forEach(function(el){window.admaxads.push({admax_id:el.getAttribute('data-admax-id'),type:'switch'})});
            var s=document.createElement('script');s.type='text/javascript';s.charset='utf-8';s.src=SDK_URL;s.async=true;document.body.appendChild(s);
            function check(){document.querySelectorAll('.ninja-ad-slot').forEach(function(s){var a=s.querySelector('.admax-switch');if(a&&a.children.length>0)s.classList.add('ad-loaded');else s.style.display='none'})}
            setTimeout(check,5000);setTimeout(check,10000);
        }
        fetch('/api/subscription-status').then(function(r){return r.json()}).then(function(d){if(d&&d.isPaid)hideAllAds();else initAds()}).catch(function(){initAds()});
    })()
    </script>
</body>
</html>`;
}

// ===== blog-data.json 更新 =====

function updateBlogData(title) {
  const blogDataPath = path.join(ROOT, 'src/blog-data.json');
  const blogDataDistPath = path.join(ROOT, 'dist/blog-data.json');

  let data = [];
  try { data = JSON.parse(fs.readFileSync(blogDataPath, 'utf8')); } catch { }

  const slug = `${YYYYMM}/${DATE_STR}_uber_daily`;
  // 同日の記事が既にあればスキップ
  if (data.some(d => d.slug === slug)) {
    log('📋 blog-data.json: 同日の記事が既に存在するためスキップ');
    return;
  }

  const fullTitle = `🚴 Uber配達日報 ${title}`;
  const entry = {
    slug,
    title: fullTitle,
    date: DATE_DISPLAY,
    excerpt: `名古屋のUber配達に役立つ${DATE_DISPLAY}の情報。天気・交通・ニュース・ガソリン価格・需要予測をチェック！`,
    tags: ['Uber配達']
  };

  data.unshift(entry);

  if (!DRY_RUN) {
    fs.writeFileSync(blogDataPath, JSON.stringify(data, null, 2));
    fs.writeFileSync(blogDataDistPath, JSON.stringify(data, null, 2));
    log('📋 blog-data.json 更新完了');
  } else {
    log('📋 [dry-run] blog-data.json 更新スキップ');
  }
}

// ===== ブログ一覧ページ更新 =====

function updateBlogIndex(title) {
  const indexPath = path.join(ROOT, 'dist/blog/index.html');
  let html;
  try { html = fs.readFileSync(indexPath, 'utf8'); } catch { log('⚠️ blog/index.html が見つかりません'); return; }

  const slug = `${YYYYMM}/${DATE_STR}_uber_daily/`;
  // 同日の記事が既にあればスキップ
  if (html.includes(slug)) {
    log('📄 index.html: 同日の記事カードが既に存在するためスキップ');
    return;
  }

  const fullTitle = `🚴 Uber配達日報 ${title}`;
  const excerpt = `名古屋のUber配達に役立つ${DATE_DISPLAY}の情報。天気・交通・ニュース・ガソリン価格・需要予測をまとめました。`;

  const newCard = `<a href="${slug}" class="article-card" data-tags="Uber配達" data-index="0">
            <div class="card-header">
                <time class="date">${DATE_DISPLAY}</time>
                
                <div class="tags">
                    <span class="tag">Uber配達</span>
                </div>
            </div>
            <h2 class="card-title">${fullTitle}</h2>
            <p class="card-excerpt">${excerpt}</p>
        </a>`;

  // article-grid セクションの先頭カードの前に挿入
  const gridStart = html.indexOf('class="article-grid"');
  if (gridStart === -1) {
    log('⚠️ article-grid が見つかりません');
    return;
  }
  // article-grid の閉じ > の直後に改行+カードを挿入
  const gridTagEnd = html.indexOf('>', gridStart);
  if (gridTagEnd === -1) return;
  const insertPos = gridTagEnd + 1;

  // data-index を全て +1 する
  html = html.replace(/data-index="(\d+)"/g, (_, n) => `data-index="${parseInt(n) + 1}"`);

  // 新しいカードを先頭に挿入
  html = html.slice(0, insertPos) + '\n\n        ' + newCard + '\n' + html.slice(insertPos);

  // タグフィルターの「すべて」カウントを +1（aタグ形式）
  html = html.replace(/すべて \((\d+)\)/, (_, n) => `すべて (${parseInt(n) + 1})`);

  if (!DRY_RUN) {
    fs.writeFileSync(indexPath, html);
    log('📄 blog/index.html 更新完了');
  } else {
    log('📄 [dry-run] blog/index.html 更新スキップ');
  }
}

// ===== メイン実行 =====

async function main() {
  log(`🚴 Uber配達デイリーレポート生成開始 — ${DATE_DISPLAY}（${DAY_NAMES[DAY_OF_WEEK]}）`);
  if (DRY_RUN) log('⚠️ ドライランモード: ファイル出力なし');

  // 1. データ収集（並列）
  const [weather, news, gasPrice, events] = await Promise.all([
    getWeather(),
    getNews(),
    getGasPrice(),
    getEvents()
  ]);

  // 2. 解析
  const predictions = getPeakPredictions(weather);
  const heatAdvice = getHeatAdvice(weather);
  const title = generateTitle(weather);
  const commentText = generateComment(weather, predictions);

  // 3. 各セクションHTML生成
  const weatherHtml = renderWeatherSection(weather);
  const trafficHtml = renderTrafficSection();
  const newsHtml = renderNewsSection(news);
  const gasHtml = renderGasSection(gasPrice);
  const peakHtml = renderPeakSection(predictions);
  const eventsHtml = renderEventsSection(events);
  const heatHtml = renderHeatSection(heatAdvice);
  const dayTipHtml = renderDayTipSection();

  // 4. HTML組み立て
  const html = buildArticleHtml({
    title, weatherHtml, trafficHtml, newsHtml, gasHtml,
    peakHtml, eventsHtml, heatHtml, dayTipHtml, commentText
  });

  // 5. ファイル出力
  const outputDir = path.join(ROOT, `dist/blog/${YYYYMM}/${DATE_STR}_uber_daily`);
  const outputFile = path.join(outputDir, 'index.html');

  if (!DRY_RUN) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputFile, html);
    log(`✅ 記事生成完了: ${outputFile}`);

    // 6. blog-data.json 更新
    updateBlogData(title);

    // 7. ブログ一覧ページ更新
    updateBlogIndex(title);
  } else {
    log(`📄 [dry-run] 出力先: ${outputFile}`);
    log(`📄 [dry-run] タイトル: 🚴 Uber配達日報 ${title}`);
    log(`📄 [dry-run] 一言: ${commentText}`);
    // dry-run でもHTMLを表示
    console.log('\n--- 生成HTML（先頭200行）---');
    console.log(html.split('\n').slice(0, 200).join('\n'));
  }

  log('🏁 完了');
}

main().catch(e => {
  console.error('[uber-daily] ❌ エラー:', e);
  process.exit(1);
});
