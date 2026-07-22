import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

export const PROJECT_DIR = dirname(
  dirname(dirname(fileURLToPath(import.meta.url))),
);

// ビルド日付スタンプ（YYYYMMDD）— キャッシュバスターに使用。同日複数回ビルドでもHTMLが変わらない
export const BUILD_STAMP = new Date()
  .toISOString()
  .split("T")[0]
  .replace(/-/g, "");

// ソースパス
const BLOG_DATA_PATH = join(PROJECT_DIR, "src", "blog-data.json");
const ARTICLES_DIR = join(PROJECT_DIR, "src", "articles");
export const OUTPUT_DIR = resolve(
  PROJECT_DIR,
  process.env.BLOG_BUILD_OUTPUT_DIR || "dist",
);

// 前回ビルドの統計情報（差分表示用）
export const BUILD_STATS_PATH = join(OUTPUT_DIR, ".build-stats.json");
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
export const prevStats = loadBuildStats();
export const curStats = {};

// blog-data.json 読み込み（メタデータ）+ 個別HTMLファイルからcontent結合
export const posts = JSON.parse(readFileSync(BLOG_DATA_PATH, "utf-8")).map(
  (post) => {
    const articlePath = join(ARTICLES_DIR, `${post.slug}.html`);
    if (existsSync(articlePath)) {
      post.content = readFileSync(articlePath, "utf-8");
    }
    return post;
  },
);

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
export const metaOnly = posts.map(({ slug, title, date, excerpt, tags }) => ({
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
const imgSrc = join(PROJECT_DIR, "src", "images");
const imgDst = join(OUTPUT_DIR, "blog", "images");
if (existsSync(imgSrc)) {
  mkdirSync(imgDst, { recursive: true });
  cpSync(imgSrc, imgDst, { recursive: true });
}

// CSSをコピー
const cssSrc = join(PROJECT_DIR, "src", "styles.css");
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
  const toolSrc = join(PROJECT_DIR, "src", tool);
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
const scriptsSrc = join(PROJECT_DIR, "src", "scripts");
const scriptsDst = join(OUTPUT_DIR, "blog", "scripts");
if (existsSync(scriptsSrc)) {
  mkdirSync(scriptsDst, { recursive: true });
  cpSync(scriptsSrc, scriptsDst, { recursive: true });
}
