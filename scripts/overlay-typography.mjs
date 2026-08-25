import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const inputImage = "C:/Users/akino/.gemini/antigravity-ide/brain/c5c1763b-ac23-4df8-91cf-4e1407d549c0/cloud_local_ai_bridge_1787683093827.jpg";
const outputWebp = path.join(PROJECT_ROOT, "src", "images", "20260826_cloud_local_ai_bridge.webp");
const previewPng = path.join(PROJECT_ROOT, "src", "images", "preview_typography.png");

async function createOverlay() {
  const metadata = await sharp(inputImage).metadata();
  const width = metadata.width || 1200;
  const height = metadata.height || 675;

  console.log(`Input image size: ${width}x${height}`);

  // SVG オーバーレイの生成（16:9 / 1200x675または元サイズ）
  const svgOverlay = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- グラデーション定義 -->
      <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="60%" stop-color="#e0f2fe"/>
        <stop offset="100%" stop-color="#38bdf8"/>
      </linearGradient>

      <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="50%" stop-color="#818cf8"/>
        <stop offset="100%" stop-color="#c084fc"/>
      </linearGradient>

      <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="rgba(56, 189, 248, 0.25)"/>
        <stop offset="100%" stop-color="rgba(129, 140, 248, 0.25)"/>
      </linearGradient>

      <!-- ドロップシャドウ & ネオングロー -->
      <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.95"/>
        <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000000" flood-opacity="0.9"/>
      </filter>

      <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <linearGradient id="overlayDark" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(15, 23, 42, 0.3)"/>
        <stop offset="45%" stop-color="rgba(15, 23, 42, 0.65)"/>
        <stop offset="100%" stop-color="rgba(15, 23, 42, 0.92)"/>
      </linearGradient>
    </defs>

    <!-- 下地グラデーション（テキスト可読性向上） -->
    <rect width="${width}" height="${height}" fill="url(#overlayDark)"/>

    <!-- 装飾グリッドライン・アクセント -->
    <line x1="80" y1="120" x2="${width - 80}" y2="120" stroke="rgba(56, 189, 248, 0.2)" stroke-width="1" stroke-dasharray="8,8"/>
    <line x1="80" y1="${height - 100}" x2="${width - 80}" y2="${height - 100}" stroke="rgba(56, 189, 248, 0.2)" stroke-width="1" stroke-dasharray="8,8"/>

    <!-- カテゴリバッジ -->
    <g transform="translate(80, 150)">
      <rect x="0" y="0" width="310" height="42" rx="21" fill="url(#badgeGrad)" stroke="#38bdf8" stroke-width="1.5"/>
      <circle cx="22" cy="21" r="5" fill="#38bdf8"/>
      <text x="36" y="27" font-family="'Segoe UI', 'Hiragino Sans', 'Noto Sans JP', sans-serif" font-size="16" font-weight="bold" fill="#38bdf8" letter-spacing="2">
        ⚡ 24H HYBRID AI ECOSYSTEM
      </text>
    </g>

    <!-- メイン日本語タイトル（キネティック・タイポグラフィ） -->
    <g transform="translate(80, 260)">
      <!-- 1行目: クラウドAI × ローカルAI -->
      <text x="0" y="0" font-family="'Hiragino Kaku Gothic ProN', 'Meiryo', 'Yu Gothic', 'Noto Sans JP', sans-serif" font-size="52" font-weight="900" fill="url(#textGrad)" filter="url(#textShadow)" letter-spacing="1.5">
        クラウドAI × ローカルAI
      </text>

      <!-- 2行目: 24時間自走する開発エコシステム -->
      <text x="0" y="70" font-family="'Hiragino Kaku Gothic ProN', 'Meiryo', 'Yu Gothic', 'Noto Sans JP', sans-serif" font-size="44" font-weight="800" fill="#ffffff" filter="url(#textShadow)" letter-spacing="1">
        24時間自走する開発エコシステム
      </text>
    </g>

    <!-- サブテキスト / アーキテクチャ構成 -->
    <g transform="translate(80, 400)">
      <rect x="0" y="0" width="4" height="48" fill="url(#accentGrad)" rx="2"/>
      <text x="18" y="20" font-family="'Segoe UI', 'Hiragino Sans', 'Noto Sans JP', sans-serif" font-size="20" font-weight="600" fill="#94a3b8" letter-spacing="1">
        Gemini Spark ➔ Google Drive (AB) ➔ Antigravity
      </text>
      <text x="18" y="44" font-family="'Segoe UI', 'Hiragino Sans', 'Noto Sans JP', sans-serif" font-size="16" font-weight="normal" fill="#64748b" letter-spacing="0.5">
        Codex 5h制限緩和・Claude Code・Gemini 3大マルチ運用の実践記録
      </text>
    </g>

    <!-- 右下テックウォーターマーク / ブランドタグ -->
    <g transform="translate(${width - 240}, ${height - 120})">
      <text x="0" y="0" font-family="'Segoe UI', sans-serif" font-size="14" font-weight="bold" fill="rgba(148, 163, 184, 0.6)" letter-spacing="3">
        GRAVITY PORTAL
      </text>
      <line x1="0" y1="8" x2="160" y2="8" stroke="url(#accentGrad)" stroke-width="2"/>
    </g>
  </svg>
  `;

  // 元のAI生成画像の上にSVGオーバーレイを合成
  const rawBg = fs.readFileSync(inputImage);

  await sharp(rawBg)
    .composite([
      {
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      }
    ])
    .webp({ quality: 90 })
    .toFile(outputWebp);

  console.log(`✅ タイポグラフィ合成完了: ${outputWebp}`);
}

createOverlay().catch(console.error);
