#!/usr/bin/env node
/**
 * OGP画像生成 CLI（sharp、LLM/外部API不使用）
 *
 * 使い方:
 *   node scripts/generate-og-images.mjs --missing              新規記事すべてに生成し blog-data.json に書き戻す
 *   node scripts/generate-og-images.mjs --slug <slug>           単一記事を強制再生成
 *   node scripts/generate-og-images.mjs --check-font            CJKフォント診断のみ
 *   node scripts/generate-og-images.mjs --dry-run               対象一覧を表示するだけ（--missing と併用）
 *   node scripts/generate-og-images.mjs --preview --title "..." --tags a,b --date YYYY-MM-DD --out path.webp
 *                                                                blog-data.json を触らずプレビュー画像だけ出力
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  assertCjkFont,
  ogImageExists,
  ogImageRelPath,
  renderOgCard,
} from "./lib/og-image.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = dirname(__dirname);
const BLOG_DATA_PATH = join(PROJECT_DIR, "src", "blog-data.json");
const ARTICLES_DIR = join(PROJECT_DIR, "src", "articles");
const IMAGES_DIR = join(PROJECT_DIR, "src", "images");
const CONFIG_PATH = join(__dirname, "og-image-config.json");

const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function hasHeroImage(post) {
  const articlePath = join(ARTICLES_DIR, `${post.slug}.html`);
  if (!existsSync(articlePath)) return false;
  const content = readFileSync(articlePath, "utf-8");
  return /src="\/blog\/images\/[^"]+"/.test(content);
}

async function runCheckFont() {
  const ok = await assertCjkFont(config);
  console.log(
    ok
      ? "✅ CJKフォントは利用可能です"
      : "⚠️ CJKフォントが見つかりません（豆腐化リスクあり）",
  );
  process.exitCode = ok ? 0 : 1;
}

async function runPreview(args) {
  const title = args.title || "プレビュータイトル";
  const tags = args.tags
    ? String(args.tags)
        .split(",")
        .map((t) => t.trim())
    : [];
  const date = args.date || "2026-01-01";
  const outPath = args.out
    ? join(PROJECT_DIR, args.out)
    : join(PROJECT_DIR, "tmp", "og-preview.webp");

  mkdirSync(dirname(outPath), { recursive: true });

  const relPath = await renderOgCard({
    title,
    date,
    tags,
    slug: "__preview__",
    imagesDir: dirname(outPath),
    config,
    skipFontCheck: !!args["skip-font-check"],
  });

  if (!relPath) {
    console.error("❌ プレビュー生成に失敗しました（フォント欠落の可能性）");
    process.exitCode = 1;
    return;
  }

  // renderOgCard は imagesDir/og/<slug>.webp に書くため、指定outPathへリネームする
  const generatedPath = join(dirname(outPath), "og", "__preview__.webp");
  const { renameSync } = await import("fs");
  renameSync(generatedPath, outPath);
  console.log(`✅ プレビュー画像を書き出しました: ${outPath}`);
}

async function runMissing(args) {
  const dryRun = !!args["dry-run"];
  const blogData = JSON.parse(readFileSync(BLOG_DATA_PATH, "utf-8"));
  const since = config.sinceDate;

  const targets = blogData.filter((post) => {
    if (post.date < since) return false;
    if (post.ogImage) return false;
    if (ogImageExists(IMAGES_DIR, post.slug)) return false;
    if (hasHeroImage(post)) return false;
    return true;
  });

  if (targets.length === 0) {
    console.log(
      "対象記事はありません（新規かつヒーロー画像なし・OGP未生成の記事が無い）",
    );
    return;
  }

  console.log(`対象: ${targets.length}件`);
  targets.forEach((t) => console.log(`  - ${t.slug} (${t.date})`));

  if (dryRun) return;

  const fontOk = await assertCjkFont(config);
  if (!fontOk) {
    console.warn(
      "⚠️ CJKフォントが見つからないため、今回はOGP画像生成をスキップします（DEFAULT_OG_IMAGEにフォールバック）",
    );
    return;
  }

  let generated = 0;
  for (const post of targets) {
    const relPath = await renderOgCard({
      title: post.title,
      date: post.date,
      tags: post.tags,
      slug: post.slug,
      imagesDir: IMAGES_DIR,
      config,
      skipFontCheck: true,
    });
    if (relPath) {
      post.ogImage = relPath;
      generated++;
    }
  }

  writeFileSync(BLOG_DATA_PATH, JSON.stringify(blogData, null, 2), "utf-8");
  console.log(
    `✅ ${generated}/${targets.length}件のOGP画像を生成し blog-data.json を更新しました`,
  );
}

async function runSlug(args) {
  const slug = args.slug;
  const blogData = JSON.parse(readFileSync(BLOG_DATA_PATH, "utf-8"));
  const post = blogData.find((p) => p.slug === slug);
  if (!post) {
    console.error(`❌ slug が見つかりません: ${slug}`);
    process.exitCode = 1;
    return;
  }

  const relPath = await renderOgCard({
    title: post.title,
    date: post.date,
    tags: post.tags,
    slug: post.slug,
    imagesDir: IMAGES_DIR,
    config,
  });

  if (!relPath) {
    console.error("❌ 生成に失敗しました（フォント欠落の可能性）");
    process.exitCode = 1;
    return;
  }

  post.ogImage = relPath;
  writeFileSync(BLOG_DATA_PATH, JSON.stringify(blogData, null, 2), "utf-8");
  console.log(`✅ 生成しました: ${relPath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args["check-font"]) return runCheckFont();
  if (args.preview) return runPreview(args);
  if (args.slug) return runSlug(args);
  if (args.missing || args["dry-run"]) return runMissing(args);

  console.log(
    "使い方: node scripts/generate-og-images.mjs --missing | --slug <slug> | --check-font | --preview --title ... [--dry-run]",
  );
}

main().catch((err) => {
  console.error("❌ エラー:", err);
  process.exitCode = 1;
});
