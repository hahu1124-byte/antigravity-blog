import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { BUILD_STAMP, OUTPUT_DIR, PROJECT_DIR } from "./context.mjs";
import { SITE_URL, escapeHtml } from "./html.mjs";
import { gpHeaderBlock } from "./gp-header.mjs";

// ==========================================
// 機種SEO個別ページ生成 (/machine-db/[slug]/index.html)
// ==========================================

export function buildMachinePages() {
  const MACHINES_PATH = join(PROJECT_DIR, "src", "data", "machines.json");
  if (!existsSync(MACHINES_PATH)) {
    console.log("⏭️  machines.json なし — 機種ページ生成スキップ");
    return;
  }

  const mData = JSON.parse(readFileSync(MACHINES_PATH, "utf-8"));
  const machines = (mData.machines || []).filter((m) => m.prob > 0 && m.name);

  function toSlug(name) {
    return name
      .replace(/[【】「」『』（）()〈〉《》<>]/g, "")
      .replace(/[～〜]/g, "-")
      .replace(/[！!？?・：:＆&＋+／/＊*＃#|"]/g, "")
      .replace(/[\s　]+/g, "-")
      .replace(/[\\]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  }

  function mTypeBadge(type) {
    const map = {
      ハイミドル: ["highmid", "ハイミドル"],
      ミドル: ["mid", "ミドル"],
      ライトミドル: ["lightmid", "ライトミドル"],
      "ライト(甘デジ)": ["ama", "甘デジ"],
    };
    const [cls, lbl] = map[type] || ["other", type || "不明"];
    return `<span class="type-badge type-${cls}">${lbl}</span>`;
  }

  function bdrClass(v) {
    return v <= 17 ? "clr-easy" : v <= 20 ? "clr-normal" : "clr-hard";
  }

  function fmtYt(m) {
    if (!m.yutimeTrigger) return '<span class="dim">なし</span>';
    let s = `${m.yutimeTrigger}回転 → ${m.yutimeSpins || 0}回転`;
    if (m.holdOver > 0) s += `+${m.holdOver}`;
    return `<span class="accent">${s}</span>`;
  }

  function machineJsonLd(m, border, slug) {
    return JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `${m.name}のボーダー・期待値・トータル確率完全解析`,
      description: `${m.name}の等価ボーダー${border}回転/千円、トータル確率1/${m.prob}を徹底解析。`,
      url: `${SITE_URL}/machine-db/${slug}/`,
      publisher: {
        "@type": "Organization",
        name: "Gravity Portal",
        url: SITE_URL,
      },
      datePublished: m.releaseDate || undefined,
      dateModified: BUILD_STAMP.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
    });
  }

  function machinePageHtml(m, slug) {
    const border = m.borderEquiv || 0,
      prob = m.prob || 0,
      base = m.baseProbability || 0;
    const chain = m.avgChainCalc || m.avgChain || 0,
      cont = m.realContRate || 0,
      entry = m.entryRate || 0;
    const rush = m.rushRate || 0,
      rb = m.rb || 0,
      avg = m.avgAcquired || 0;
    const incomplete = rb === 0; // ボーダー等の詳細データが未取得
    const title = incomplete
      ? `${m.name}のスペック情報`
      : `${m.name}のボーダー・期待値・トータル確率完全解析`;
    const desc = incomplete
      ? `${m.name}（${m.maker || ""}）のスペック情報ページ。トータル確率1/${prob}。詳細データは未取得のため、データ元リンクをご確認ください。`
      : `${m.name}の等価ボーダー${border}回転/千円、トータル確率1/${prob}。スペック・遊タイム情報と期待値計算ツールへのリンクあり。`;

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE_URL}/machine-db/${slug}/">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${SITE_URL}/machine-db/${slug}/">
<script type="application/ld+json">${machineJsonLd(m, border, slug)}</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0b10;color:#e0e0e8;min-height:100vh;line-height:1.7}
.wrap{max-width:820px;margin:0 auto;padding:1rem 1rem 2rem}
.bc{font-size:.78rem;color:#6b6f80;margin-bottom:1.2rem}.bc a{color:#7c7ff2;text-decoration:none}.bc a:hover{text-decoration:underline}
.hdr{margin-bottom:1.4rem}.hdr h1{font-size:1.45rem;font-weight:800;color:#f0f0f8;line-height:1.4;margin-bottom:.5rem}
.meta{display:flex;gap:.7rem;align-items:center;flex-wrap:wrap}
.type-badge{display:inline-block;padding:.18rem .6rem;border-radius:5px;font-size:.74rem;font-weight:700}
.type-highmid{background:rgba(239,68,68,.12);color:#f87171;border:1px solid rgba(239,68,68,.2)}
.type-mid{background:rgba(234,179,8,.12);color:#facc15;border:1px solid rgba(234,179,8,.2)}
.type-lightmid{background:rgba(34,197,94,.12);color:#4ade80;border:1px solid rgba(34,197,94,.2)}
.type-ama{background:rgba(96,165,250,.12);color:#93c5fd;border:1px solid rgba(96,165,250,.2)}
.type-other{background:rgba(148,163,184,.12);color:#94a3b8;border:1px solid rgba(148,163,184,.2)}
.maker{font-size:.8rem;color:#8b8fa0}.rel{font-size:.78rem;color:#6b6f80}
.hero{background:linear-gradient(135deg,rgba(30,32,48,.95),rgba(20,22,36,.95));border:1px solid rgba(99,102,241,.25);border-radius:16px;padding:1.5rem;margin-bottom:1.5rem}
.hero-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1.2rem}
.hero-item{text-align:center}.hero-lbl{font-size:.72rem;font-weight:700;color:#8b8fa0;text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem}
.hero-val{font-family:'SF Mono',Consolas,monospace;font-size:1.75rem;font-weight:800}.hero-unit{font-size:.8rem;color:#6b6f80;font-weight:400}
.clr-easy{color:#22c55e}.clr-normal{color:#eab308}.clr-hard{color:#ef4444}.clr-prob{color:#a78bfa}.clr-chain{color:#c084fc}.clr-entry{color:#facc15}
.notice{background:rgba(234,179,8,.08);border:1px solid rgba(234,179,8,.25);border-radius:10px;padding:.85rem 1rem;margin-bottom:1.5rem;font-size:.85rem;color:#fbbf24;line-height:1.6}
.notice a{color:#fde68a;text-decoration:underline}
.cta-primary{display:block;text-align:center;padding:1rem 2rem;background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff;font-size:1rem;font-weight:700;border-radius:12px;text-decoration:none;transition:transform .2s,box-shadow .2s;box-shadow:0 4px 20px rgba(99,102,241,.3);margin-bottom:.4rem}
.cta-primary:hover{transform:translateY(-2px);box-shadow:0 6px 30px rgba(99,102,241,.45)}
.cta-sub{text-align:center;font-size:.78rem;color:#6b6f80;margin-bottom:1.8rem}
.cta-secondary{display:block;text-align:center;padding:.8rem 1.5rem;background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);color:#a78bfa;font-size:.9rem;font-weight:700;border-radius:10px;text-decoration:none;margin-bottom:1.8rem;transition:all .2s}
.cta-secondary:hover{background:rgba(99,102,241,.2);border-color:#7c7ff2}
.sec{margin-bottom:1.8rem}.sec h2{font-size:1.08rem;font-weight:700;color:#e0e0e8;margin-bottom:.7rem;padding-bottom:.4rem;border-bottom:1px solid rgba(99,102,241,.15)}
.t-card{background:rgba(18,19,26,.9);border:1px solid rgba(99,102,241,.12);border-radius:12px;overflow:hidden}
.spec{width:100%;border-collapse:collapse}
.spec th{text-align:left;padding:.65rem .8rem;font-size:.82rem;font-weight:600;color:#8b8fa0;background:rgba(30,32,48,.6);border-bottom:1px solid rgba(255,255,255,.05);width:40%;white-space:nowrap}
.spec td{padding:.65rem .8rem;font-size:.9rem;color:#e0e0e8;border-bottom:1px solid rgba(255,255,255,.04);font-family:'SF Mono',Consolas,monospace}
.accent{color:#a78bfa;font-weight:600}.dim{color:#3a3d4e}.na{color:#4a4d5e;font-style:italic}
.link-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.8rem}
.link-card{display:block;padding:.8rem 1rem;background:rgba(30,32,48,.6);border:1px solid rgba(99,102,241,.12);border-radius:10px;color:#a78bfa;text-decoration:none;font-size:.85rem;font-weight:600;transition:all .2s}
.link-card:hover{background:rgba(99,102,241,.1);border-color:rgba(99,102,241,.3)}
.ft{padding:2rem 0;border-top:1px solid rgba(255,255,255,.05);text-align:center;font-size:.75rem;color:#3a3d4e;margin-top:2rem}.ft a{color:#7c7ff2;text-decoration:none}
@media(max-width:600px){.hero-val{font-size:1.35rem}.hdr h1{font-size:1.15rem}.hero-grid{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
${gpHeaderBlock()}
<div class="wrap">
<nav class="bc"><a href="/">トップ</a> &gt; <a href="/machine-db/">機種データベース</a> &gt; ${escapeHtml(m.name)}</nav>
<header class="hdr">
<h1>${escapeHtml(title)}</h1>
<div class="meta">${mTypeBadge(m.type)}${m.maker ? ` <span class="maker">${escapeHtml(m.maker)}</span>` : ""}${m.releaseDate ? ` <span class="rel">導入日: ${m.releaseDate}</span>` : ""}</div>
</header>
${incomplete ? `<div class="notice">⚠️ この機種はボーダー・出玉データが未取得のため、一部情報が表示できません。${m.sourceUrl ? `<br>詳細スペックは <a href="${m.sourceUrl}" target="_blank" rel="noopener">データ元サイト</a> でご確認ください。` : ""}</div>` : ""}
<section class="hero"><div class="hero-grid">
${!incomplete ? `<div class="hero-item"><div class="hero-lbl">等価ボーダー</div><div class="hero-val ${bdrClass(border)}">${border}<span class="hero-unit"> 回転/千円</span></div></div>` : ""}
<div class="hero-item"><div class="hero-lbl">トータル確率</div><div class="hero-val clr-prob">1/<span>${prob}</span></div></div>
${!incomplete ? `<div class="hero-item"><div class="hero-lbl">平均連荘</div><div class="hero-val clr-chain">${Math.round(chain * 100) / 100}<span class="hero-unit"> 連</span></div></div>` : ""}
${entry > 0 ? `<div class="hero-item"><div class="hero-lbl">RUSH突入率</div><div class="hero-val clr-entry">${entry}<span class="hero-unit"> %</span></div></div>` : ""}
</div></section>
${
  !incomplete
    ? `<a href="/tools/ev-calculator/" class="cta-primary">📊 この機種の正確な期待値を計算する</a>
<p class="cta-sub">店舗の換金率・実出玉に合わせた正確な期待値を算出できます</p>`
    : ""
}
<section class="sec"><h2>📋 基本スペック</h2><div class="t-card"><table class="spec">
${base > 0 ? `<tr><th>大当り確率（通常時）</th><td>1/${base}</td></tr>` : ""}
<tr><th>トータル確率</th><td>1/${prob}</td></tr>
<tr><th>等価ボーダー</th><td>${border > 0 ? border + " 回転/千円" : '<span class="na">データなし</span>'}</td></tr>
<tr><th>想定1R出玉</th><td>${rb > 0 ? rb + " 玉" : '<span class="na">データなし</span>'}</td></tr>
${avg > 0 ? `<tr><th>平均獲得出玉</th><td>${avg} 玉</td></tr>` : ""}
${!incomplete ? `<tr><th>平均連荘</th><td>${Math.round(chain * 100) / 100} 連</td></tr>` : ""}
${cont > 0 ? `<tr><th>実質継続率</th><td>${cont}%</td></tr>` : ""}
${entry > 0 ? `<tr><th>RUSH突入率</th><td>${entry}%</td></tr>` : ""}
${rush > 0 ? `<tr><th>RUSH発生率</th><td>${rush}%${m.rushType ? ` (${m.rushType})` : ""}</td></tr>` : ""}
${m.maker ? `<tr><th>メーカー</th><td>${escapeHtml(m.maker)}</td></tr>` : ""}
${m.releaseDate ? `<tr><th>導入日</th><td>${m.releaseDate}</td></tr>` : ""}
</table></div></section>
${
  !incomplete
    ? `<section class="sec"><h2>⏱ 遊タイム</h2><div class="t-card"><table class="spec">
<tr><th>遊タイム</th><td>${fmtYt(m)}</td></tr>
${m.yutimeTrigger > 0 ? `<tr><th>発動回転数</th><td>${m.yutimeTrigger} 回転</td></tr><tr><th>時短回転数</th><td>${m.yutimeSpins || 0} 回転</td></tr>${m.holdOver > 0 ? `<tr><th>残保留</th><td>${m.holdOver} 個</td></tr>` : ""}` : ""}
</table></div></section>
<a href="/tools/ev-calculator/" class="cta-secondary">🔧 EV計算ツールで ${escapeHtml(m.name)} を分析する →</a>`
    : ""
}
<section class="sec"><h2>🔗 関連ツール</h2><div class="link-grid">
<a href="/machine-db/?q=${encodeURIComponent(m.name)}" class="link-card">🔍 機種DBで ${escapeHtml(m.name)} を検索</a>
<a href="/machine-db/" class="link-card">📖 機種データベース一覧</a>
<a href="/tools/ev-calculator/" class="link-card">📊 期待値計算ツール</a>
<a href="/tools/" class="link-card">🛠 ツール一覧</a>
<a href="/guide/" class="link-card">📚 パチンコ初心者ガイド</a>
</div></section>
<footer class="ft"><p>&copy; ${new Date().getFullYear()} <a href="/">Gravity Portal</a></p></footer>
</div>
</body>
</html>`;
  }

  // 既存の machine-db ページスラッグを事前収集（差分表示用）
  const machineDbDistDir = join(OUTPUT_DIR, "machine-db");
  const existingMachineSlugs = new Set(
    existsSync(machineDbDistDir)
      ? readdirSync(machineDbDistDir, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
      : [],
  );

  // 生成
  const slugMap = new Map();
  let generated = 0,
    dupes = 0;
  for (const m of machines) {
    let slug = toSlug(m.name) || `machine-${generated}`;
    if (slugMap.has(slug)) {
      dupes++;
      slug = `${slug}-${dupes}`;
    }
    slugMap.set(slug, m.name);
    m.slug = slug; // 機種データにスラッグを直接追加
    const dir = join(OUTPUT_DIR, "machine-db", slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), machinePageHtml(m, slug), "utf-8");
    generated++;
  }

  // machines.json にスラッグ付きで書き戻し（machine-db.js が m.slug を参照）
  const mDataWithSlugs = JSON.parse(readFileSync(MACHINES_PATH, "utf-8"));
  const slugLookup = new Map(machines.map((m) => [m.name, m.slug]));
  for (const m of mDataWithSlugs.machines || []) {
    if (slugLookup.has(m.name)) m.slug = slugLookup.get(m.name);
  }
  writeFileSync(
    join(OUTPUT_DIR, "data", "machines.json"),
    JSON.stringify(mDataWithSlugs),
    "utf-8",
  );

  // サイトマップ
  const urls = [...slugMap.keys()].map((s) => `${SITE_URL}/machine-db/${s}/`);
  writeFileSync(
    join(OUTPUT_DIR, "machine-db", "sitemap-machines.txt"),
    urls.join("\n"),
    "utf-8",
  );

  // スラッグマップ（機種名 → スラッグ）をJSONで出力（サイトマップ用）
  const nameToSlug = {};
  for (const [slug, name] of slugMap) {
    nameToSlug[name] = slug;
  }
  writeFileSync(
    join(OUTPUT_DIR, "machine-db", "slug-map.json"),
    JSON.stringify(nameToSlug),
    "utf-8",
  );

  // stats.json — GP等が各種カウントを動的取得するための軽量ファイル
  // toolCount/gameCount/labCount はGPサイトのカード数（Vercelデプロイなしで更新するためここで管理）
  const stats = {
    machineCount: generated,
    toolCount: 9,
    gameCount: 2,
    labCount: 4,
    builtAt: BUILD_STAMP,
  };
  writeFileSync(
    join(OUTPUT_DIR, "data", "stats.json"),
    JSON.stringify(stats),
    "utf-8",
  );

  // machine-db.js の allSlugs プレースホルダーにスラッグ一覧を埋め込み
  const machineDbJsPath = join(OUTPUT_DIR, "machine-db", "machine-db.js");
  if (existsSync(machineDbJsPath)) {
    let jsContent = readFileSync(machineDbJsPath, "utf-8");
    const slugArray = JSON.stringify([...slugMap.keys()]);
    jsContent = jsContent.replace(
      /const allSlugs = \[\];\s*\/\*\s*__ALL_SLUGS_PLACEHOLDER__\s*\*\//,
      `const allSlugs = ${slugArray}`,
    );
    writeFileSync(machineDbJsPath, jsContent, "utf-8");
  }

  // 新規追加・削除スラッグを計算して差分のみ表示
  const newSlugs = [...slugMap.keys()].filter(
    (s) => !existingMachineSlugs.has(s),
  );
  const removedSlugs = [...existingMachineSlugs].filter(
    (s) => !slugMap.has(s) && s !== "sitemap-machines.txt",
  );
  if (newSlugs.length > 0 || removedSlugs.length > 0) {
    const preview = (arr) =>
      arr.length <= 3
        ? arr.join(", ")
        : `${arr.slice(0, 3).join(", ")} ...他${arr.length - 3}件`;
    if (newSlugs.length > 0)
      console.log(
        `🎰 +${newSlugs.length}件追加: ${preview(newSlugs)}${dupes ? ` (重複回避: ${dupes})` : ""}`,
      );
    if (removedSlugs.length > 0)
      console.log(
        `🗑️  -${removedSlugs.length}件削除: ${preview(removedSlugs)}`,
      );
  } else {
    console.log(`🎰 機種ページ: 変化なし (計${generated}件)`);
  }
}
