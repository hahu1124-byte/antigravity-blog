import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const inputImage = "C:/Users/akino/.gemini/antigravity-ide/brain/b120c33c-3ecb-473f-bf60-c904d130d93a/pachinko_math_distribution_1789483877524.jpg";
const outputWebp = path.join(PROJECT_ROOT, "src", "images", "20260916_pachinko_expected_value_mathematics.webp");
const previewPng = path.join(PROJECT_ROOT, "src", "images", "preview_math_typography.png");

async function createOverlay() {
  const metadata = await sharp(inputImage).metadata();
  const width = metadata.width || 1792;
  const height = metadata.height || 1024;

  console.log(`Input image size: ${width}x${height}`);

  // SVG オーバーレイの生成（上部の横軸・パースに合わせて斜めに配置）
  // 角度: -4.5度（左肩上がり・スタイリッシュな斜体グリッド沿い）
  const svgOverlay = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- グラデーション定義 -->
      <linearGradient id="cyanGoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="40%" stop-color="#67e8f9"/>
        <stop offset="80%" stop-color="#38bdf8"/>
        <stop offset="100%" stop-color="#facc15"/>
      </linearGradient>

      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="50%" stop-color="#facc15"/>
        <stop offset="100%" stop-color="#fb923c"/>
      </linearGradient>

      <linearGradient id="subGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="70%" stop-color="#e2e8f0"/>
        <stop offset="100%" stop-color="#94a3b8"/>
      </linearGradient>

      <linearGradient id="badgeBg" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="rgba(8, 145, 178, 0.4)"/>
        <stop offset="100%" stop-color="rgba(14, 165, 233, 0.2)"/>
      </linearGradient>

      <!-- ドロップシャドウ -->
      <filter id="heavyShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.95"/>
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.9"/>
      </filter>

      <!-- ネオングロー -->
      <filter id="neonCyan" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="6" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- 上部テキスト群（斜め配置グループ: 角度 -4.5度） -->
    <g transform="translate(180, 140) rotate(-4.5)">
      <!-- バッジ装飾 -->
      <g transform="translate(0, 0)">
        <rect x="0" y="0" width="460" height="46" rx="23" fill="url(#badgeBg)" stroke="#38bdf8" stroke-width="2" filter="url(#heavyShadow)"/>
        <circle cx="24" cy="23" r="6" fill="#38bdf8" filter="url(#neonCyan)"/>
        <text x="42" y="30" font-family="'Segoe UI', 'Hiragino Sans', 'Noto Sans JP', sans-serif" font-size="18" font-weight="bold" fill="#38bdf8" letter-spacing="3">
          📊 PACHINKO MATHEMATICS &amp; STATS
        </text>
      </g>

      <!-- メイン見出し（大きく斜めに配置） -->
      <g transform="translate(0, 85)" filter="url(#heavyShadow)">
        <text x="0" y="0" font-family="'Hiragino Kaku Gothic ProN', 'Meiryo', 'Yu Gothic', 'Noto Sans JP', sans-serif" font-size="64" font-weight="900" fill="url(#cyanGoldGrad)" letter-spacing="3">
          ポアソン分布 vs ガウス分布
        </text>
      </g>

      <!-- サブ見出し（帯・アンダーライン付き） -->
      <g transform="translate(4, 150)" filter="url(#heavyShadow)">
        <line x1="0" y1="-5" x2="880" y2="-5" stroke="#38bdf8" stroke-width="3" stroke-dasharray="12,6" opacity="0.8"/>
        <text x="0" y="32" font-family="'Hiragino Kaku Gothic ProN', 'Meiryo', 'Yu Gothic', 'Noto Sans JP', sans-serif" font-size="34" font-weight="800" fill="url(#subGrad)" letter-spacing="2">
          期待値の数学的真実 ｜ 年間10万回転の収束と最新LT機の分散
        </text>
      </g>
    </g>
  </svg>
  `;

  console.log("Compositing SVG overlay onto image...");

  const svgBuffer = Buffer.from(svgOverlay);

  // WebP 変換出力 (quality: 90)
  await sharp(inputImage)
    .composite([{ input: svgBuffer, top: 0, left: 0 }])
    .webp({ quality: 90 })
    .toFile(outputWebp);

  console.log(`✅ Output WebP: ${outputWebp}`);

  // プレビュー用 PNG 出力
  await sharp(inputImage)
    .composite([{ input: svgBuffer, top: 0, left: 0 }])
    .png()
    .toFile(previewPng);

  console.log(`✅ Preview PNG: ${previewPng}`);
}

createOverlay().catch(err => {
  console.error("❌ Error creating overlay:", err);
  process.exit(1);
});
