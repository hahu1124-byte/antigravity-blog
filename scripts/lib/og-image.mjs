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
  return variants[((dayIdx % variants.length) + variants.length) % variants.length];
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
 * ひらがな「あ」(U+3042)と必ず豆腐になる私用領域文字(U+E000)を同条件で描画しバイト比較する。
 * ラスタ結果が一致していれば CJK フォントが無いとみなす。
 */
export async function assertCjkFont(config) {
  const family = (config && config.font && config.font.family) || "sans-serif";
  const probe = (
    codePoint,
  ) => `<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" fill="#000"/>
    <text x="4" y="30" font-family="${escapeXml(family)}" font-size="28" fill="#fff">${String.fromCodePoint(codePoint)}</text>
  </svg>`;

  const JA_PROBE_CODEPOINT = 0x3042; // ひらがな「あ」
  const PUA_PROBE_CODEPOINT = 0xe000; // 私用領域（必ず豆腐になる）

  try {
    const [jaBuf, puaBuf] = await Promise.all([
      sharp(Buffer.from(probe(JA_PROBE_CODEPOINT)))
        .raw()
        .toBuffer(),
      sharp(Buffer.from(probe(PUA_PROBE_CODEPOINT)))
        .raw()
        .toBuffer(),
    ]);
    return !jaBuf.equals(puaBuf);
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

export function ogImageExists(imagesDir, slug) {
  return existsSync(join(imagesDir, "og", `${slug}.webp`));
}
