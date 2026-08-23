#!/usr/bin/env node
/**
 * import-article-image.mjs
 * ブログ記事用アイキャッチ画像のインポート・WebP変換・記事HTML自動反映＆差し替えツール
 *
 * 使い方:
 *   1. 画像インポート・差し替え:
 *      node scripts/import-article-image.mjs <画像パス> <記事スラッグまたはHTMLパス> [--name <画像名>] [--alt <説明>]
 *
 *   2. プロンプトプリセット一覧表示:
 *      node scripts/import-article-image.mjs --presets
 *
 *   3. 記事タイトルからプロンプト候補を生成:
 *      node scripts/import-article-image.mjs --suggest "記事タイトル"
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseFrontmatter, stringifyFrontmatter } from "./lib/frontmatter.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ARTICLES_DIR = path.join(PROJECT_ROOT, "src", "articles");
const IMAGES_DIR = path.join(PROJECT_ROOT, "src", "images");
const PRESETS_PATH = path.join(__dirname, "image-prompt-presets.json");

function loadPresets() {
  if (fs.existsSync(PRESETS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(PRESETS_PATH, "utf-8"));
    } catch {
      return { styles: {}, categories: {} };
    }
  }
  return { styles: {}, categories: {} };
}

function showHelp() {
  console.log(`
🖼️  import-article-image.mjs - ブログ記事画像インポート＆差し替えツール

【使用方法】
  node scripts/import-article-image.mjs <画像パス> <記事スラッグまたはHTMLパス> [オプション]

【オプション】
  --name, -n <名前>    保存するWebP画像ファイル名 (拡張子なし、省略時はスラッグ名)
  --alt, -a <説明>     imgタグのaltテキスト (省略時は記事タイトル)
  --quality, -q <数値> WebP品質 (既定: 85)
  --no-build           変換後の node build.mjs 実行をスキップ
  --presets            登録済みのプロンプトプリセット・スタイル一覧を表示
  --suggest <タイトル> 記事タイトルからおすすめの画像生成プロンプト案（3種類）を生成
  --help, -h           ヘルプを表示

【使用例】
  # 1. 記事作成時に生成画像をWebP化して記事に自動反映
  node scripts/import-article-image.mjs "C:/path/to/gen.png" 20260822_ai_guardrails_handoff_guide

  # 2. あとから画像を新しいものに差し替える（同じコマンドでOK）
  node scripts/import-article-image.mjs "C:/path/to/new_gen.png" 20260822_ai_guardrails_handoff_guide

  # 3. 記事タイトルからNanobanana用プロンプト案を取得
  node scripts/import-article-image.mjs --suggest "AIの暴走を防ぐガードレール運用術"
`);
}

function showPresets() {
  const presets = loadPresets();
  console.log("\n🎨 【登録済み画像スタイル・プロンプトプリセット一覧】\n");

  console.log("=== 🌟 スタイル別キーワード ===");
  for (const [key, s] of Object.entries(presets.styles || {})) {
    console.log(`\n▶ [${key}] ${s.name}`);
    console.log(`  説明: ${s.description}`);
    console.log(`  推奨カテゴリ: ${s.recommended_for ? s.recommended_for.join(", ") : "全般"}`);
    console.log(`  スタイル構文: ${s.keywords}`);
  }

  console.log("\n=== 📁 カテゴリ別ベースプロンプト ===");
  for (const [catKey, cat] of Object.entries(presets.categories || {})) {
    console.log(`\n▶ [${catKey}] ${cat.label} (既定スタイル: ${cat.default_style})`);
    console.log(`  テンプレート: ${cat.prompt_template}`);
  }
  console.log("\n");
}

function suggestPrompts(title) {
  const presets = loadPresets();
  console.log(`\n💡 【記事タイトルから生成されたプロンプト案（全7スタイル）】: "${title}"\n`);

  const styles = presets.styles || {};

  // 1. サイバーネオン / HUD
  const cyber = styles.cyber_neon?.keywords || "cyberpunk aesthetics, dark glowing neon elements, futuristic HUD interface, 16:9 aspect ratio, no text, no letters";
  console.log("--------------------------------------------------");
  console.log("🔵 1. サイバーネオン / HUD (Space UI 調)");
  console.log("--------------------------------------------------");
  console.log(`A striking concept visual representing "${title}". High-tech digital command center, holographic floating diagrams, glowing neon cyan and purple accents against a deep dark background, ${cyber}\n`);

  // 2. シネマティック / ドラマチック
  const cinema = styles.cinematic_realistic?.keywords || "cinematic shot, dramatic moody lighting, shallow depth of field, 35mm lens photography, 16:9 aspect ratio, no text, no letters";
  console.log("--------------------------------------------------");
  console.log("🟠 2. シネマティック / ドラマチック (リアル調)");
  console.log("--------------------------------------------------");
  console.log(`A cinematic high-detail atmospheric scene inspired by "${title}". Atmospheric lighting, rich environmental textures, dramatic composition, evocative shadows, ${cinema}\n`);

  // 3. モダンベクター / アイソメトリック
  const vector = styles.modern_vector_illustration?.keywords || "modern vector illustration, isometric 3D view, clean geometric shapes, soft gradient shading, 16:9 aspect ratio, no text, no letters";
  console.log("--------------------------------------------------");
  console.log("🟢 3. モダンベクター / アイソメトリック (ビジネス・解説調)");
  console.log("--------------------------------------------------");
  console.log(`A clean modern vector conceptual illustration representing "${title}". Isometric composition, elegant modern color palette, minimalist design, visually balanced objects, ${vector}\n`);

  // 4. アニメーション / 劇場版アニメ調
  const anime = styles.anime_cinematic?.keywords || "High quality Japanese anime background art style, Makoto Shinkai aesthetic, emotional volumetric lighting, 16:9 aspect ratio, no text, no letters";
  console.log("--------------------------------------------------");
  console.log("🟣 4. ジャパニーズ・アニメーション (新海誠・劇場版アニメ調)");
  console.log("--------------------------------------------------");
  console.log(`A beautiful emotional anime scene inspired by "${title}". A character at a workspace with glowing holographic windows, dramatic dusk sky with glowing clouds and starry night outside the window, ${anime}\n`);

  // 5. マンガ・コミック / 少年漫画調
  const manga = styles.manga_comic_dynamic?.keywords || "Dynamic Japanese manga style, high contrast black and white ink drawing with fine screentone dots, dramatic action speed lines, 16:9 aspect ratio, no text, no letters";
  console.log("--------------------------------------------------");
  console.log("🔴 5. ダイナミック・マンガ (少年漫画・スクリーントーン調)");
  console.log("--------------------------------------------------");
  console.log(`Dynamic Japanese manga climactic panel representing "${title}". A hero character commanding powerful glowing data shields against chaotic glitch monsters, dramatic angles, speed lines, ${manga}\n`);

  // 6. ピクセルアート / レトロゲーム調
  const pixel = styles.pixel_art_retro?.keywords || "Gorgeous 16-bit pixel art, retro gaming aesthetic, vibrant pixelated colors, 16:9 aspect ratio, no text, no letters";
  console.log("--------------------------------------------------");
  console.log("🟡 6. 16-bit ピクセルアート (レトロゲーム・ドット絵調)");
  console.log("--------------------------------------------------");
  console.log(`A charming 16-bit pixel art scene inspired by "${title}". Nostalgic retro game interface, detailed pixel landscape, glowing 8-bit energy effects, ${pixel}\n`);

  // 7. ミニマル・スケッチ / 設計図調
  const sketch = styles.minimal_sketch_lineart?.keywords || "Elegant architectural concept sketch, delicate black ink line art with subtle pastel watercolor washes, 16:9 aspect ratio, no text, no letters";
  console.log("--------------------------------------------------");
  console.log("⚪ 7. ミニマル・ラインアート / スケッチ (建築パース・設計図調)");
  console.log("--------------------------------------------------");
  console.log(`An elegant conceptual design blueprint illustrating "${title}". Sophisticated architectural line drawing, delicate ink strokes, clean white textured background, ${sketch}\n`);

  console.log("👉 お好みのプロンプトをコピーして Nanobanana (generate_image ツール) で生成してください。\n");
}

function findArticleFile(slugOrPath) {
  // 直接パスが存在する場合
  if (fs.existsSync(slugOrPath)) {
    return path.resolve(slugOrPath);
  }

  // 拡張子なし・スラッグ指定の場合
  const cleanSlug = path.basename(slugOrPath, ".html");

  // src/articles 配下を再帰検索
  function searchDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = searchDir(fullPath);
        if (found) return found;
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        const fileSlug = path.basename(entry.name, ".html");
        if (fileSlug === cleanSlug) {
          return fullPath;
        }
      }
    }
    return null;
  }

  return searchDir(ARTICLES_DIR);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  if (args.includes("--presets")) {
    showPresets();
    return;
  }

  const suggestIdx = args.indexOf("--suggest");
  if (suggestIdx !== -1) {
    const title = args[suggestIdx + 1];
    if (!title) {
      console.error("❌ エラー: --suggest には記事タイトルを指定してください。");
      process.exit(1);
    }
    suggestPrompts(title);
    return;
  }

  // 位置引数のパース
  const positional = [];
  let customName = null;
  let customAlt = null;
  let quality = "85";
  let noBuild = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--name" || arg === "-n") {
      customName = args[++i];
    } else if (arg === "--alt" || arg === "-a") {
      customAlt = args[++i];
    } else if (arg === "--quality" || arg === "-q") {
      quality = args[++i];
    } else if (arg === "--no-build") {
      noBuild = true;
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  if (positional.length < 2) {
    console.error("❌ エラー: <画像パス> と <記事スラッグまたはHTMLパス> を指定してください。");
    showHelp();
    process.exit(1);
  }

  const inputImagePath = path.resolve(positional[0]);
  const articleArg = positional[1];

  if (!fs.existsSync(inputImagePath)) {
    console.error(`❌ エラー: 画像ファイルが見つかりません: ${inputImagePath}`);
    process.exit(1);
  }

  const articlePath = findArticleFile(articleArg);
  if (!articlePath) {
    console.error(`❌ エラー: 該当する記事HTMLファイルが見つかりません: "${articleArg}"`);
    process.exit(1);
  }

  const articleSlug = path.basename(articlePath, ".html");
  const baseImageName = customName || articleSlug;
  const webpFileName = `${baseImageName.replace(/\.webp$/i, "")}.webp`;
  const outputWebpPath = path.join(IMAGES_DIR, webpFileName);

  console.log(`\n🚀 【画像インポート＆記事反映開始】`);
  console.log(`  - 入力画像: ${inputImagePath}`);
  console.log(`  - 対象記事: ${path.relative(PROJECT_ROOT, articlePath)}`);
  console.log(`  - 出力WebP: ${path.relative(PROJECT_ROOT, outputWebpPath)}`);

  // 1. ffmpeg を用いた WebP 変換
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const ffmpegArgs = [
    "-y",
    "-i", inputImagePath,
    "-quality", quality,
    outputWebpPath
  ];

  try {
    execFileSync("ffmpeg", ffmpegArgs, { stdio: "pipe" });
    const stat = fs.statSync(outputWebpPath);
    console.log(`  ✅ WebP変換完了: ${webpFileName} (${Math.round(stat.size / 1024)} KB)`);
  } catch (err) {
    console.error(`❌ ffmpeg での変換に失敗しました:`, err.message);
    process.exit(1);
  }

  // 2. 記事HTMLのパースと更新
  const rawHtml = fs.readFileSync(articlePath, "utf-8");
  const { metadata, content } = parseFrontmatter(rawHtml);

  // Frontmatter更新
  metadata.ogImage = webpFileName;
  const altText = customAlt || metadata.title || articleSlug;

  // 本文中の先頭にある <img> タグの置換または挿入
  // パターン: <p><img src="..." alt="..."></p> または <img src="..." alt="...">
  const imgTagRegex = /^(?:\s*<p>\s*)?<img\s+src=["'][^"']*["'][^>]*>(?:\s*<\/p>)?\s*\n?/i;
  const newImgTag = `<p><img src="/blog/images/${webpFileName}" alt="${altText}"></p>\n\n`;

  let updatedContent = content;
  if (imgTagRegex.test(content.trimStart())) {
    // 既存の先頭画像タグを置換
    updatedContent = content.trimStart().replace(imgTagRegex, newImgTag);
    console.log(`  🔄 既存のアイキャッチ画像タグを差し替えました。`);
  } else {
    // 先頭に新規挿入
    updatedContent = newImgTag + content.trimStart();
    console.log(`  ✨ アイキャッチ画像タグを先頭に新規挿入しました。`);
  }

  const finalHtml = stringifyFrontmatter(metadata, updatedContent);
  fs.writeFileSync(articlePath, finalHtml, "utf-8");
  console.log(`  📝 Frontmatter & 記事HTMLを更新しました (ogImage: ${webpFileName})`);

  // 3. node build.mjs の実行
  if (!noBuild) {
    console.log(`\n🔨 【ブログを再ビルド中...】`);
    try {
      execFileSync("node", ["build.mjs"], { cwd: PROJECT_ROOT, stdio: "inherit" });
      console.log(`\n🎉 【全工程完了】 アイキャッチ画像が記事に反映され、ビルドが完了しました！`);
    } catch (err) {
      console.warn(`⚠️ ビルド実行中に警告/エラーが発生しました:`, err.message);
    }
  } else {
    console.log(`\n🎉 【完了】 HTML更新完了 (--no-build 指定のためビルドはスキップしました)`);
  }
}

main();
