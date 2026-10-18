// OGP画像の動的自動生成（LLM/外部API不使用）
// 生SVGテンプレートを組み立て → sharp でWebPにラスタライズする。
// context.mjs は import しない（トップレベル副作用を持ち込まないリーフモジュール）。
import sharp from "sharp";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";

const EMOJI_RE = /\p{Extended_Pictographic}️?/gu;

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripEmoji(str) {
  return str
    .replace(EMOJI_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// 全角相当（ひらがな・カタカナ・CJK統合漢字・CJK拡張A・全角記号/英数）の判定
const FULLWIDTH_RE = /[　-ヿ㐀-䶿一-鿿＀-￯]/;

/** 全角=1.0 / 半角=0.5 単位で表示幅を計算 */
function displayWidth(str) {
  let w = 0;
  for (const ch of str) {
    w += FULLWIDTH_RE.test(ch) ? 1.0 : 0.5;
  }
  return w;
}

/** タイトルを表示幅ベースで手動改行し、maxLines行に収める（溢れは … ） */
export function wrapTitle(title, unitsPerLine, maxLines) {
  const clean = stripEmoji(title);
  const chars = Array.from(clean);
  const lines = [];
  let cur = "";
  let curWidth = 0;

  for (const ch of chars) {
    const chWidth = FULLWIDTH_RE.test(ch) ? 1.0 : 0.5;
    if (curWidth + chWidth > unitsPerLine) {
      lines.push(cur);
      cur = ch;
      curWidth = chWidth;
      if (lines.length === maxLines) break;
    } else {
      cur += ch;
      curWidth += chWidth;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);

  const overflow =
    lines.length === maxLines &&
    displayWidth(lines.slice(0, maxLines).join("")) < displayWidth(clean);
  if (overflow) {
    let last = lines[maxLines - 1];
    while (displayWidth(last) > unitsPerLine - 1 && last.length > 0) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = last + "…";
  }
  return lines.length ? lines : [clean || "Gravity Portal Blog"];
}

/** "YYYY-MM-DD" → 曜日インデックス（0=日〜6=土、JST固定）。パース不可時は0 */
export function dayOfWeekIndex(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ""));
  if (!m) return 0;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const idx = d.getUTCDay();
  return Number.isNaN(idx) ? 0 : idx;
}

/** タグに紐づくパレット（配列）から曜日インデックスに応じて1色を決定的に選ぶ */
function pickVariant(variants, dayIdx) {
  if (!Array.isArray(variants)) return variants;
  return variants[
    ((dayIdx % variants.length) + variants.length) % variants.length
  ];
}

/** タグ配列 → paletteOrder の優先順位でパレットを1つ選ぶ（曜日で同系統内の配色をローテーション） */
export function resolvePalette(tags, config, dayIdx = 0) {
  const list = tags || [];
  for (const key of config.paletteOrder) {
    if (list.includes(key) && config.palettes[key]) {
      return pickVariant(config.palettes[key], dayIdx);
    }
  }
  return pickVariant(config.palettes._default, dayIdx);
}

function patternDef(id, pattern, accent) {
  const a = escapeXml(accent);
  switch (pattern) {
    case "grid":
      return `<pattern id="${id}" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M 60 0 L 0 0 0 60" fill="none" stroke="${a}" stroke-width="1" opacity="0.12"/>
      </pattern>`;
    case "diagonal":
      return `<pattern id="${id}" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="40" stroke="${a}" stroke-width="12" opacity="0.10"/>
      </pattern>`;
    case "wave":
      return `<pattern id="${id}" width="120" height="40" patternUnits="userSpaceOnUse">
        <path d="M0 20 Q30 0 60 20 T120 20" fill="none" stroke="${a}" stroke-width="2" opacity="0.14"/>
      </pattern>`;
    case "circuit":
      return `<pattern id="${id}" width="80" height="80" patternUnits="userSpaceOnUse">
        <path d="M10 10 H70 V40 H40 V70" fill="none" stroke="${a}" stroke-width="2" opacity="0.14"/>
        <circle cx="10" cy="10" r="4" fill="${a}" opacity="0.18"/>
        <circle cx="70" cy="40" r="4" fill="${a}" opacity="0.18"/>
      </pattern>`;
    case "dots":
    default:
      return `<pattern id="${id}" width="36" height="36" patternUnits="userSpaceOnUse">
        <circle cx="6" cy="6" r="2.5" fill="${a}" opacity="0.14"/>
      </pattern>`;
  }
}

/** OGP画像本体のSVG文字列を組み立てる */
export function buildOgSvg({ title, date, label, palette, config }) {
  const { width, height } = config.size;
  const {
    unitsPerLine,
    maxLines,
    titleSize,
    titleLineHeight,
    metaSize,
    labelSize,
    padding,
  } = config.layout;

  const lines = wrapTitle(title, unitsPerLine, maxLines);
  const patId = "pat";
  const gradId = "grad";
  const cx = width / 2;

  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${cx}" dy="${i === 0 ? 0 : titleSize * titleLineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  const titleBlockHeight = lines.length * titleSize * titleLineHeight;
  const titleY = height / 2 - titleBlockHeight / 2 + titleSize * 0.75;

  const badgeWidth = labelSize * (label.length + 2);

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${escapeXml(palette.bg1)}"/>
      <stop offset="1" stop-color="${escapeXml(palette.bg2)}"/>
    </linearGradient>
    ${patternDef(patId, palette.pattern, palette.accent)}
  </defs>
  <rect width="${width}" height="${height}" fill="url(#${gradId})"/>
  <rect width="${width}" height="${height}" fill="url(#${patId})"/>
  <rect x="${cx - badgeWidth / 2}" y="${padding}" width="${badgeWidth}" height="${labelSize * 1.8}" rx="6" fill="${escapeXml(palette.accent)}" opacity="0.9"/>
  <text x="${cx}" y="${padding + labelSize * 1.25}" font-family="${escapeXml(config.font.family)}" font-size="${labelSize}" font-weight="700" fill="${escapeXml(palette.bg1)}" text-anchor="middle">${escapeXml(label)}</text>
  <text x="${cx}" y="${titleY}" font-family="${escapeXml(config.font.family)}" font-size="${titleSize}" font-weight="700" fill="#ffffff" text-anchor="middle">${tspans}</text>
  <text x="${cx}" y="${height - padding + 8}" font-family="${escapeXml(config.font.family)}" font-size="${metaSize}" fill="#ffffff" opacity="0.75" text-anchor="middle">${escapeXml(date || "")}　·　Gravity Portal</text>
</svg>`;
}

/** slug → OGP画像の格納相対パス（画像ルート = src/images/ からの相対） */
export function ogImageRelPath(slug) {
  return `og/${slug}.webp`;
}

/**
 * CJKフォントの実レンダリング診断。
 * Linux環境ではfc-listによる日本語フォント登録を検証し、sharpによる描画検証も併せて行う。
 */
export async function assertCjkFont(config) {
  // Linux環境ではfc-listで日本語フォントの有無を直接確認
  if (process.platform === "linux") {
    try {
      const { execSync } = await import("child_process");
      const list = execSync("fc-list :lang=ja", {
        encoding: "utf-8",
        timeout: 3000,
      });
      if (!list || list.trim().length === 0) {
        console.warn(
          "⚠️ Linux環境で日本語フォント（fc-list :lang=ja）が見つかりません",
        );
        return false;
      }
    } catch (e) {
      console.warn(`⚠️ fc-list実行失敗: ${e.message}`);
    }
  }

  const family = (config && config.font && config.font.family) || "sans-serif";
  const probe = (
    codePoint,
  ) => `<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" fill="#000"/>
    <text x="4" y="30" font-family="${escapeXml(family)}" font-size="28" fill="#fff">${String.fromCodePoint(codePoint)}</text>
  </svg>`;

  const JA_PROBE_CODEPOINT = 0x3042; // ひらがな「あ」

  try {
    const jaBuf = await sharp(Buffer.from(probe(JA_PROBE_CODEPOINT)))
      .raw()
      .toBuffer();

    // 何らかの描画ピクセルが存在することを確認
    let whitePixels = 0;
    for (let i = 0; i < jaBuf.length; i += 3) {
      if (jaBuf[i] > 100) whitePixels++;
    }
    return whitePixels > 50;
  } catch {
    return false;
  }
}

/**
 * OGP画像を生成し imagesDir/og/<slug>.webp に書き出す。
 * 戻り値は blog-data.json に保存する相対パス（例: "og/202608/xxx.webp"）。
 * フォント欠落や描画失敗時は null を返す（呼び出し側は DEFAULT_OG_IMAGE にフォールバックすること）。
 */
export async function renderOgCard({
  title,
  date,
  tags,
  slug,
  imagesDir,
  config,
  skipFontCheck,
}) {
  try {
    if (!skipFontCheck) {
      const ok = await assertCjkFont(config);
      if (!ok) return null;
    }
    const palette = resolvePalette(tags, config, dayOfWeekIndex(date));
    const svg = buildOgSvg({
      title,
      date,
      label: palette.label,
      palette,
      config,
    });
    const webp = await sharp(Buffer.from(svg))
      .webp({ quality: config.quality })
      .toBuffer();

    const relPath = ogImageRelPath(slug);
    const outPath = join(imagesDir, "og", `${slug}.webp`);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, webp);
    return relPath;
  } catch (err) {
    console.warn(
      `⚠️ OGP画像生成に失敗（フォールバックします）: ${slug} — ${err.message}`,
    );
    return null;
  }
}

// ===== AI の絵＋見出しのカード（自動投稿用。手で書く記事の見出しの合成と同じ作り） =====
// E:/create-images/scripts/overlay.mjs（1600×900）を 1200×630 に移したもの。
// 文字の太さは見本どおり（見出し 900・副題 800・情報の 2 行目 500）。fonts-noto-cjk は Regular/Bold だけで
// 900 が黙って 700 になるので、Actions（日次・GP の週刊）で fonts-noto-cjk-extra（Black・Medium 入り）も入れる。

// 天気・種類ごとの色（見出しのグラデーションとバッジ）
export const PHOTO_THEMES = {
  sunny: ["#fde047", "#fb923c", "#f97316"],
  cloudy: ["#e2e8f0", "#93c5fd", "#60a5fa"],
  rainy: ["#a5f3fc", "#38bdf8", "#6366f1"],
  storm: ["#fde68a", "#f87171", "#a855f7"],
  snow: ["#ffffff", "#bae6fd", "#7dd3fc"],
  hot: ["#fef08a", "#f97316", "#ef4444"],
  cold: ["#e0f2fe", "#7dd3fc", "#818cf8"],
  tech: ["#67e8f9", "#818cf8", "#c084fc"],
};

/** 背景の上に重ねる見出しの SVG（左を暗くする・バッジ・見出し・副題・情報の行・GRAVITY PORTAL） */
export function buildPhotoSvg({
  theme,
  badge,
  title,
  subtitle,
  lines = [],
  config,
}) {
  const { width: W, height: H } = config.size;
  const font = escapeXml(config.font.family);
  const [c1, c2, c3] = PHOTO_THEMES[theme] ?? PHOTO_THEMES.tech;
  const clean = stripEmoji(title);
  // 見出しは左 590px に収める（全角 1 文字 ≒ フォントサイズ）
  const titleSize = Math.min(
    88,
    Math.floor(590 / Math.max(1, displayWidth(clean))),
  );
  // 17px・字間 3 の英大文字は 1 文字 ≒ 14px
  const badgeW = 60 + badge.length * 14;
  const titleY = 200 + titleSize;
  const lineSvg = lines
    .map(
      (t, i) =>
        `<text x="16" y="${24 + i * 34}" font-family="${font}" font-size="${i === 0 ? 23 : 20}" font-weight="${i === 0 ? 700 : 500}" fill="${i === 0 ? "#e2e8f0" : "#cbd5e1"}">${escapeXml(t)}</text>`,
    )
    .join("\n    ");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shadeX" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#020617" stop-opacity="0.92"/>
      <stop offset="40%" stop-color="#020617" stop-opacity="0.72"/>
      <stop offset="65%" stop-color="#020617" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="shadeY" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#020617" stop-opacity="0.35"/>
      <stop offset="30%" stop-color="#020617" stop-opacity="0"/>
      <stop offset="75%" stop-color="#020617" stop-opacity="0"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0.55"/>
    </linearGradient>
    <linearGradient id="titleGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="55%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-20%" width="120%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#000" flood-opacity="0.85"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#shadeX)"/>
  <rect width="${W}" height="${H}" fill="url(#shadeY)"/>
  <line x1="72" y1="105" x2="${W - 72}" y2="105" stroke="${c2}" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="6,6"/>
  <line x1="72" y1="${H - 84}" x2="${W - 72}" y2="${H - 84}" stroke="${c2}" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="6,6"/>
  <g transform="translate(72, 140)">
    <rect x="0" y="0" width="${badgeW}" height="38" rx="19" fill="#020617" fill-opacity="0.55" stroke="${c2}" stroke-width="2"/>
    <circle cx="21" cy="19" r="5" fill="${c2}"/>
    <text x="38" y="25" font-family="${font}" font-size="17" font-weight="700" fill="#f1f5f9" letter-spacing="3">${escapeXml(badge)}</text>
  </g>
  <text x="72" y="${titleY}" font-family="${font}" font-size="${titleSize}" font-weight="900" fill="url(#titleGrad)" filter="url(#shadow)">${escapeXml(clean)}</text>
  <text x="72" y="${titleY + 58}" font-family="${font}" font-size="36" font-weight="800" fill="#ffffff" filter="url(#shadow)">${escapeXml(subtitle)}</text>
  <g transform="translate(72, ${titleY + 92})">
    <rect x="0" y="0" width="4" height="${lines.length * 34 + 2}" rx="2" fill="url(#accent)"/>
    ${lineSvg}
  </g>
  <g transform="translate(72, ${H - 46})">
    <text x="0" y="0" font-family="${font}" font-size="17" font-weight="700" fill="#cbd5e1" fill-opacity="0.85" letter-spacing="4">GRAVITY PORTAL</text>
    <rect x="0" y="11" width="160" height="3" rx="1.5" fill="url(#accent)"/>
  </g>
</svg>`;
}

/**
 * 背景の絵（bgPath）に見出しを重ねて imagesDir/og/<slug>.webp に書き出す。
 * 戻り値は renderOgCard と同じ相対パス。フォント欠落・背景の読み込み失敗時は null
 * （呼び出し側は renderOgCard の文字だけのカードに落とすこと）。
 */
export async function renderOgPhotoCard({
  bgPath,
  theme,
  badge,
  title,
  subtitle,
  lines,
  slug,
  imagesDir,
  config,
  skipFontCheck,
}) {
  try {
    if (!skipFontCheck) {
      const ok = await assertCjkFont(config);
      if (!ok) return null;
    }
    const { width, height } = config.size;
    const svg = buildPhotoSvg({ theme, badge, title, subtitle, lines, config });
    const webp = await sharp(bgPath)
      .resize(width, height, { fit: "cover" })
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .webp({ quality: config.photoQuality ?? 82, smartSubsample: true })
      .toBuffer();
    const outPath = join(imagesDir, "og", `${slug}.webp`);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, webp);
    return ogImageRelPath(slug);
  } catch (err) {
    console.warn(
      `⚠️ 背景つきOGP画像の生成に失敗（文字だけのカードにします）: ${slug} — ${err.message}`,
    );
    return null;
  }
}

export function ogImageExists(imagesDir, slug) {
  return existsSync(join(imagesDir, "og", `${slug}.webp`));
}
