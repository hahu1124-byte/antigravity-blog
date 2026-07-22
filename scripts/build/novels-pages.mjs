import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import { OUTPUT_DIR, PROJECT_DIR } from "./context.mjs";
import { SITE_URL, escapeHtml } from "./html.mjs";

// ==========================================
// LAB novels ページ生成（Markdown → HTML）
// ==========================================

const LAB_CSS_URL =
  "https://hahu1124-byte.github.io/antigravity-blog/lab/styles.css";
const NOVELS_SRC_DIR = join(PROJECT_DIR, "src", "lab", "novels");

/** Markdown ファイルを読んで HTML 文字列に変換 */
export async function mdToHtml(filePath) {
  const src = readFileSync(filePath, "utf-8");
  const { content } = matter(src);
  const result = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(content);
  return result.toString();
}

/** LAB 共通ページラッパー（既存 ai-tools/index.html の構造を踏襲） */
export function labWrap({
  title,
  description,
  cssDepth,
  backHref,
  backLabel,
  titleIcon,
  titleText,
  bodyHtml,
}) {
  const cssPath = cssDepth === 0 ? `./styles.css` : LAB_CSS_URL;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${SITE_URL}/lab/novels/">
    <meta property="og:type" content="article">
    <link rel="stylesheet" href="${LAB_CSS_URL}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script>
        (function(){try{var t=localStorage.getItem('gp-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()
    </script>
</head>
<body>
    <button class="theme-toggle" id="themeToggle" aria-label="テーマ切替">🌙</button>
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

    <header class="lab-header">
        <a href="${backHref}" class="lab-back">← ${backLabel}</a>
        <span class="lab-title">${titleIcon} ${titleText}</span>
    </header>

    <main class="lab-content novels-content">
        ${bodyHtml}
    </main>
</body>
</html>`;
}

/** timeline.md を ## 見出しで週ごとに分割してタブUIのHTMLを生成 */
export async function buildTimelineTabsHtml(filePath) {
  const src = readFileSync(filePath, "utf-8");
  const { content } = matter(src);

  // ## で始まるセクションに分割
  const parts = content.split(/(?=\n## )/);
  const preamble = parts[0]; // ## より前の部分（注記・区切り線など）
  const sections = parts.slice(1);

  // 週セクションが1つ以下ならそのままHTML変換して返す
  if (sections.length <= 1) {
    const result = await remark()
      .use(remarkGfm)
      .use(remarkHtml, { sanitize: false })
      .process(content);
    return result.toString();
  }

  // preamble をHTML変換
  const preambleHtml = preamble.trim()
    ? (
        await remark()
          .use(remarkGfm)
          .use(remarkHtml, { sanitize: false })
          .process(preamble)
      ).toString()
    : "";

  // 各セクションのタイトルとHTMLを収集
  const weekData = [];
  for (const section of sections) {
    const titleMatch = section.match(/^## (.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : "不明";
    const result = await remark()
      .use(remarkGfm)
      .use(remarkHtml, { sanitize: false })
      .process(section);
    weekData.push({ title, html: result.toString() });
  }

  // 日付セクション（年で始まるもの）を逆順にし、その他（メモ等）は末尾に残す
  const dateWeeks = weekData.filter((w) => /^\d{4}年/.test(w.title));
  const otherWeeks = weekData.filter((w) => !/^\d{4}年/.test(w.title));
  weekData.length = 0;
  dateWeeks.reverse().forEach((w) => weekData.push(w));
  otherWeeks.forEach((w) => weekData.push(w));

  const tabButtons = weekData
    .map(
      (w, i) =>
        `<button class="tl-tab${i === 0 ? " tl-tab-active" : ""}" data-week="${i}">${escapeHtml(w.title)}</button>`,
    )
    .join("");

  const tabContents = weekData
    .map(
      (w, i) =>
        `<div class="tl-content${i === 0 ? " tl-content-active" : ""}" data-week="${i}">${w.html}</div>`,
    )
    .join("");

  return `
<style>
.tl-tabs{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1.5rem}
.tl-tab{padding:.45rem 1rem;background:var(--lab-bg-card,rgba(30,32,48,.8));border:1px solid var(--lab-border,rgba(99,102,241,.2));border-radius:8px;color:var(--lab-text-muted,#8b8fa0);font-size:.85rem;font-weight:600;cursor:pointer;transition:all .2s}
.tl-tab:hover{border-color:var(--lab-accent,#58a6ff);color:var(--lab-text,#e0e0e8)}
.tl-tab-active{background:rgba(88,166,255,.15);border-color:var(--lab-accent,#58a6ff);color:var(--lab-text,#e0e0e8)}
.tl-content{display:none}.tl-content-active{display:block}
</style>
${preambleHtml}
<div class="tl-tabs">${tabButtons}</div>
<div class="tl-contents">
${tabContents}
</div>
<script>
(function(){
  var tabs=document.querySelectorAll('.tl-tab');
  tabs.forEach(function(tab){
    tab.addEventListener('click',function(){
      var w=this.dataset.week;
      tabs.forEach(function(t){t.classList.remove('tl-tab-active');});
      document.querySelectorAll('.tl-content').forEach(function(c){c.classList.remove('tl-content-active');});
      this.classList.add('tl-tab-active');
      document.querySelector('.tl-content[data-week="'+w+'"]').classList.add('tl-content-active');
    });
  });
})();
</script>`;
}

/** 設定詳細ハブ＋個別ページを生成。src/lab/novels/settings/*.md を読み込む */
export async function buildSettingsPages() {
  const settingsSrcDir = join(NOVELS_SRC_DIR, "settings");
  if (!existsSync(settingsSrcDir)) {
    console.log(
      "⏭️  src/lab/novels/settings/ なし — 設定詳細ページ生成スキップ",
    );
    return;
  }

  const files = readdirSync(settingsSrcDir).filter((f) => f.endsWith(".md"));
  const settings = [];
  for (const file of files) {
    const filePath = join(settingsSrcDir, file);
    const src = readFileSync(filePath, "utf-8");
    const { content, data } = matter(src);
    const html = (
      await remark()
        .use(remarkGfm)
        .use(remarkHtml, { sanitize: false })
        .process(content)
    ).toString();
    const slug = file.replace(/\.md$/, "");
    settings.push({
      slug,
      title: data.title || slug,
      icon: data.icon || "📄",
      updated: data.updated || "",
      html,
    });
  }

  const settingsDir = join(OUTPUT_DIR, "lab", "novels", "settings");
  mkdirSync(settingsDir, { recursive: true });

  // --- settings/index.html（ハブ） ---
  const cardsHtml = settings
    .map(
      (s) => `
            <a href="/lab/novels/settings/${s.slug}/" class="novels-timeline-link">
                <span class="novels-timeline-icon">${s.icon}</span>
                <div>
                    <div class="novels-timeline-link-title">${escapeHtml(s.title)}</div>
                    <div class="novels-timeline-link-sub">最終更新: ${escapeHtml(s.updated)}</div>
                </div>
                <span class="novels-timeline-arrow">→</span>
            </a>`,
    )
    .join("");

  const settingsHubBody = `
        <nav class="novels-breadcrumb">
            <a href="/">トップ</a>
            <span class="novels-sep">›</span>
            <a href="/lab/">LAB</a>
            <span class="novels-sep">›</span>
            <a href="/lab/novels/">AI小説</a>
            <span class="novels-sep">›</span>
            <span class="novels-current">設定詳細</span>
        </nav>

        <section class="novels-section">
            <h2 class="novels-section-title">設定詳細</h2>
            <p class="novels-timeline-desc">「廃城の王」の世界観設定を公開しています。物語内現在：ep56時点。今後も随時追加していきます。</p>
            <div class="novels-settings-grid">${cardsHtml}
            </div>
        </section>

        <div class="novels-footer">
            <a href="/lab/novels/" class="novels-back-link">← AI小説に戻る</a>
        </div>`;

  writeFileSync(
    join(settingsDir, "index.html"),
    labWrap({
      title: "設定詳細 — 廃城の王 | AI小説 | Gravity Portal",
      description:
        "「廃城の王」の世界観設定（マルチバース・エルダリア暦・神々・遺言石）を公開。",
      backHref: "/lab/novels/",
      backLabel: "AI小説に戻る",
      titleIcon: "📚",
      titleText: "設定詳細",
      bodyHtml: settingsHubBody,
    }),
    "utf-8",
  );

  // --- settings/<slug>/index.html（個別ページ） ---
  for (const s of settings) {
    const dir = join(settingsDir, s.slug);
    mkdirSync(dir, { recursive: true });

    const body = `
        <nav class="novels-breadcrumb">
            <a href="/">トップ</a>
            <span class="novels-sep">›</span>
            <a href="/lab/">LAB</a>
            <span class="novels-sep">›</span>
            <a href="/lab/novels/">AI小説</a>
            <span class="novels-sep">›</span>
            <a href="/lab/novels/settings/">設定詳細</a>
            <span class="novels-sep">›</span>
            <span class="novels-current">${escapeHtml(s.title)}</span>
        </nav>

        <section class="novels-section novels-markdown">
            <p class="novels-timeline-desc">最終更新: ${escapeHtml(s.updated)}</p>
            ${s.html}
        </section>

        <div class="novels-footer">
            <a href="/lab/novels/settings/" class="novels-back-link">← 設定詳細に戻る</a>
        </div>`;

    writeFileSync(
      join(dir, "index.html"),
      labWrap({
        title: `${s.title} — 廃城の王 | AI小説 | Gravity Portal`,
        description: `「廃城の王」の世界観設定「${s.title}」の詳細。`,
        backHref: "/lab/novels/settings/",
        backLabel: "設定詳細に戻る",
        titleIcon: s.icon,
        titleText: s.title,
        bodyHtml: body,
      }),
      "utf-8",
    );
  }

  console.log(
    `📚 設定詳細ページ生成完了 (settings/index.html + ${settings.length}件の個別ページ)`,
  );
}

export async function buildNovelsPages() {
  if (!existsSync(NOVELS_SRC_DIR)) {
    console.log("⏭️  src/lab/novels/ なし — novelsページ生成スキップ");
    return;
  }

  const introHtml = await mdToHtml(join(NOVELS_SRC_DIR, "intro.md"));
  const structureHtml = await mdToHtml(join(NOVELS_SRC_DIR, "structure.md"));
  const timelineTabsHtml = await buildTimelineTabsHtml(
    join(NOVELS_SRC_DIR, "timeline.md"),
  );

  // --- novels/index.html ---
  const novelsDir = join(OUTPUT_DIR, "lab", "novels");
  mkdirSync(novelsDir, { recursive: true });

  const novelsBody = `
        <nav class="novels-breadcrumb">
            <a href="/">トップ</a>
            <span class="novels-sep">›</span>
            <a href="/lab/">LAB</a>
            <span class="novels-sep">›</span>
            <span class="novels-current">AI小説</span>
        </nav>

        <div class="novels-hero">
            <div class="novels-hero-meta">
                <span class="novels-badge">📖 カクヨム連載中</span>
            </div>
            <h1 class="novels-hero-title">廃城の王</h1>
            <p class="novels-hero-sub">ふたつのAIが同じ話を書き、人間が統合する。</p>
            <div class="novels-cta-group">
                <a href="https://kakuyomu.jp/works/2912051602055329793" target="_blank" rel="noopener noreferrer" class="novels-cta">カクヨムで読む →</a>
                <a href="/lab/novels/timeline/" class="novels-cta">制作タイムラインを見る →</a>
                <a href="/lab/novels/settings/" class="novels-cta">設定詳細を見る →</a>
                <a href="/lab/novels/world-map/" class="novels-cta">ワールドマップを見る →</a>
            </div>
        </div>

        <p class="novels-behind-note">執筆裏話をここに記載していきます。</p>

        <section class="novels-section novels-markdown">
            ${introHtml}
        </section>

        <hr class="novels-divider">

        <section class="novels-section novels-markdown">
            ${structureHtml}
        </section>

        <hr class="novels-divider">

        <section class="novels-section">
            <h2 class="novels-section-title">制作タイムライン</h2>
            <p class="novels-timeline-desc">いつ・どの話を書き・何を修正したか。週ごとにまとめた制作記録です。</p>
            <a href="/lab/novels/timeline/" class="novels-timeline-link">
                <span class="novels-timeline-icon">📅</span>
                <div>
                    <div class="novels-timeline-link-title">制作タイムラインを見る</div>
                    <div class="novels-timeline-link-sub">週ごとの執筆・修正ログ</div>
                </div>
                <span class="novels-timeline-arrow">→</span>
            </a>
        </section>

        <div class="novels-footer">
            <a href="/lab/" class="novels-back-link">← LAB に戻る</a>
        </div>`;

  writeFileSync(
    join(novelsDir, "index.html"),
    labWrap({
      title: "AI小説 — 廃城の王 | LAB | Gravity Portal",
      description:
        "2つのAIが同じ話を書き、人間が統合する。カクヨム連載中「廃城の王」の制作プロセスと修正履歴を公開。",
      backHref: "/lab/",
      backLabel: "LABに戻る",
      titleIcon: "📖",
      titleText: "AI小説",
      bodyHtml: novelsBody,
    }),
    "utf-8",
  );

  // --- novels/timeline/index.html ---
  const timelineDir = join(novelsDir, "timeline");
  mkdirSync(timelineDir, { recursive: true });

  const timelineBody = `
        <nav class="novels-breadcrumb">
            <a href="/">トップ</a>
            <span class="novels-sep">›</span>
            <a href="/lab/">LAB</a>
            <span class="novels-sep">›</span>
            <a href="/lab/novels/">AI小説</a>
            <span class="novels-sep">›</span>
            <span class="novels-current">制作タイムライン</span>
        </nav>

        <section class="novels-section novels-markdown novels-timeline-body">
            ${timelineTabsHtml}
        </section>

        <div class="novels-footer">
            <a href="/lab/novels/" class="novels-back-link">← AI小説に戻る</a>
        </div>`;

  writeFileSync(
    join(timelineDir, "index.html"),
    labWrap({
      title: "制作タイムライン — 廃城の王 | AI小説 | Gravity Portal",
      description:
        "カクヨム連載中「廃城の王」の制作タイムライン。いつ・どの話を書き・何を修正したか週ごとにまとめた制作記録。",
      backHref: "/lab/novels/",
      backLabel: "AI小説に戻る",
      titleIcon: "📅",
      titleText: "制作タイムライン",
      bodyHtml: timelineBody,
    }),
    "utf-8",
  );

  // --- novels/world-map/index.html ---
  const worldMapDir = join(novelsDir, "world-map");
  mkdirSync(worldMapDir, { recursive: true });

  const worldMapBody = `
        <nav class="novels-breadcrumb">
            <a href="/">トップ</a>
            <span class="novels-sep">›</span>
            <a href="/lab/">LAB</a>
            <span class="novels-sep">›</span>
            <a href="/lab/novels/">AI小説</a>
            <span class="novels-sep">›</span>
            <span class="novels-current">ワールドマップ</span>
        </nav>

        <div class="wm-hero">
            <div class="novels-hero-meta">
                <span class="novels-badge">🗺️ エルダリア大陸 公式地図</span>
            </div>
            <h1 class="novels-hero-title">「廃城の王」ワールドマップ</h1>
            <p class="novels-hero-sub">主人公アシュたちが駆け抜けるエルダリア世界、廃境、グラウド市街、地下倉庫街のインタラクティブマップ。</p>
        </div>

        <!-- コントロールバー -->
        <div class="wm-controls">
            <div class="wm-control-group">
                <span class="wm-control-label">表示範囲:</span>
                <button id="btn-view-world" class="wm-btn active" onclick="switchMapMode('world')">🗺️ エルダリア全体図</button>
                <button id="btn-view-arden" class="wm-btn" onclick="switchMapMode('arden')">📍 アルデン東部・廃境拡大</button>
                <button id="btn-view-west" class="wm-btn" onclick="switchMapMode('west')">🌾 西部拡大（カルン街道）</button>
                <button id="btn-view-east" class="wm-btn" onclick="switchMapMode('east')">🌫️ 東部拡張（廃境最深部）</button>
            </div>
            <div class="wm-control-group">
                <span class="wm-control-label">構造レイヤー:</span>
                <button id="btn-layer-surface" class="wm-btn active" onclick="switchLayer('surface')">🏰 地上構造</button>
                <button id="btn-layer-underground" class="wm-btn" onclick="switchLayer('underground')">🕳️ 地下排水路・倉庫街</button>
            </div>
            <div class="wm-control-group">
                <span class="wm-control-label">ピン表示:</span>
                <button id="btn-label-all" class="wm-btn active" onclick="switchLabelMode('all')">🏷️ 全表示</button>
                <button id="btn-label-select" class="wm-btn" onclick="switchLabelMode('select')">🎯 選択中・ホバーのみ</button>
            </div>
        </div>

        <!-- メインマップ＆サイドパネルコンテナ -->
        <div class="wm-container">
            <!-- マップ表示エリア -->
            <div class="wm-map-viewport" id="wm-viewport">
                <div class="wm-map-stage" id="wm-stage">
                    <img src="/blog/images/eldaria_world_map.webp" alt="エルダリア世界地図" class="wm-map-bg" id="wm-map-bg">
                    
                    <!-- 地下構造オーバーレイキャンバス -->
                    <div class="wm-underground-overlay" id="wm-underground-overlay">
                        <div class="wm-tunnel-grid"></div>
                        <div class="wm-tunnel-glow"></div>
                        <div class="wm-tunnel-label">⚡ 地下排水管網 & 汚染魔力バイパス（旧王国遺構）</div>
                    </div>

                    <!-- ピンコンテナ -->
                    <div class="wm-pins-layer" id="wm-pins-layer"></div>
                </div>
            </div>

            <!-- サイド情報パネル -->
            <aside class="wm-sidebar" id="wm-sidebar">
                <div class="wm-sidebar-header">
                    <span class="wm-badge" id="wm-info-category">エリア分類</span>
                    <h2 class="wm-sidebar-title" id="wm-info-name">ピンを選択してください</h2>
                    <span class="wm-sidebar-sub" id="wm-info-name-en">Select a location on the map</span>
                </div>
                <div class="wm-sidebar-body" id="wm-info-body">
                    <p class="wm-sidebar-desc">地図上のノード（ピン）または下の地点一覧をクリックすると、その土地の歴史・地理概要、関連する登場人物、エピソードの記憶が表示されます。</p>
                    <div class="wm-empty-hint">
                        💡 <strong>操作ヒント:</strong><br>
                        ・「アルデン東部・廃境拡大」で廃城やグラウド周辺にフォーカスできます。<br>
                        ・「地下排水路・倉庫街」ボタンで、地上と地下の隠し構造が切り替わります。<br>
                        ・ピンが重なって選択しづらい場合は、下の「地点一覧」から選んでください。
                    </div>
                </div>
            </aside>
        </div>

        <!-- 地点一覧（ピン重なり回避用） -->
        <div class="wm-location-list-wrap">
            <span class="wm-control-label">📌 地点一覧（クリックで選択）:</span>
            <div class="wm-location-list" id="wm-location-list"></div>
        </div>

        <script>
        const MAP_LOCATIONS = [
          {
            id: "graud-city",
            name: "グラウド市街",
            nameEn: "Graud City",
            category: "市街・都市",
            layer: "both",
            coords: { x: 72, y: 37 },
            labelPos: "left",
            zoomCoords: { x: 19, y: 55 },
            zoomLabelPos: "right",
            showInWorld: true,
            showInZoom: true,
            desc: "ダルク候国（東方三候国の一つ）の商業中心地。ラングリア王国東部の国境に近く、廃魔国跡地（廃境）にも隣接する交易拠点。かつて古い王国の排水路や地下施設が網の目のように張り巡らされており、地上は活気ある市場や書庫棟、商業区が広がる。",
            characters: ["アシュ", "ミラ", "ヴォルフ"],
            episodes: [
              { code: "ep01-ep10", title: "物語の開幕", text: "アシュが書庫棟で古い排水管の見取り図を解読。" },
              { code: "ep73A", title: "地下排水管の見取り図", text: "記憶の中の見取り図と現場の構造を論理的に重ね合わせて脱出路を思考。" }
            ],
            items: ["グラウド排水管見取り図", "古書庫の記録"]
          },
          {
            id: "underground-warehouses",
            name: "地下倉庫街・旧排水路網",
            nameEn: "Underground Warehouses & Sewers",
            category: "地下・遺構",
            layer: "underground",
            coords: { x: 72, y: 42 },
            labelPos: "bottom",
            zoomCoords: { x: 25, y: 66 },
            zoomLabelPos: "right",
            showInWorld: true,
            showInZoom: true,
            desc: "グラウド市街の地下深くに眠る巨大な旧排水管網および密輸業者や冒険者が利用する地下倉庫街。魔力バイパスや隠し通路が点在する。",
            characters: ["アシュ", "ミラ", "ドルク"],
            episodes: [
              { code: "ep73A", title: "地下倉庫街の攻防", text: "魔力バイパスと汚染水の流れを利用した秘密の脱出戦。" },
              { code: "ep77T", title: "灰色の石と断絶された記憶", text: "地下深奥にて封石の七人の声とは異なる歪んだ記憶の石（灰色の石）を発見。" }
            ],
            items: ["灰色の石", "汚染魔力バイパス"]
          },
          {
            id: "arkane-temple",
            name: "アルカネ神殿",
            nameEn: "Arkane Temple",
            category: "神聖領域・解呪",
            layer: "surface",
            coords: { x: 76, y: 39 },
            labelPos: "top",
            zoomCoords: { x: 45, y: 58 },
            zoomLabelPos: "top",
            showInWorld: true,
            showInZoom: true,
            desc: "古の神々の祈りと声が呼応する神秘的な神殿。解呪の儀式や「声の解放段階」と深く連動しており、封石の継承者が訪れる重要拠点。",
            characters: ["アシュ", "神殿の神官たち"],
            episodes: [
              { code: "設定資料", title: "アルカネ神殿の祈りシステム", text: "祈りの深さに応じて応答する神が段階的に増える。" }
            ],
            items: ["声の解放段階", "神聖遺言石"]
          },
          {
            id: "obsidian-wastes",
            name: "魔骨丘陵（まこつきゅうりょう）",
            nameEn: "The Obsidian Wastes",
            category: "危険地帯・黒岩",
            layer: "surface",
            coords: { x: 87, y: 27 },
            labelPos: "bottom",
            zoomCoords: { x: 57, y: 27 },
            zoomLabelPos: "bottom",
            showInWorld: true,
            showInZoom: true,
            desc: "奇妙な黒い岩肌（黒曜石）が延々と連なる死の丘陵地帯。廃魔国跡地（廃境）への入口であり、凶悪な魔物や歪んだ魔力が渦巻く。",
            characters: ["アシュ", "ミラ", "廃境の巡回兵"],
            episodes: [
              { code: "ep50-ep60", title: "魔骨丘陵突破戦", text: "黒岩の影に潜む魔物を警戒しながら廃境を目指す行軍。" }
            ],
            items: ["黒曜魔石", "魔骨の残骸"],
            showInEast: true,
            eastCoords: { x: 27, y: 61 },
            eastLabelPos: "bottom"
          },
          {
            id: "demon-realm",
            name: "廃魔国跡地（廃境）",
            nameEn: "The Demon Realm",
            category: "旧魔国・無主の地",
            layer: "surface",
            coords: { x: 84, y: 44 },
            labelPos: "left",
            zoomCoords: { x: 70, y: 60 },
            zoomLabelPos: "top",
            showInWorld: true,
            showInZoom: true,
            desc: "かつて七代の魔王が支配した旧魔国の遺領。濃度の高い魔力が大地に染み込み、廃城・廃村が点在する。支配者なき無主の地で、竜人・角人族・アウトローが自治的に暮らす。",
            characters: ["廃境の巡回兵", "廃境の民"],
            episodes: [
              { code: "ep50-ep60", title: "廃境突入", text: "魔骨丘陵を越え、無主の地・廃境へ足を踏み入れる。" }
            ],
            items: ["魔力溜まり"]
          },
          {
            id: "ruined-castle",
            name: "廃城（ダルネイン城塞）",
            nameEn: "Ruined Castle (Dalnain Fortress)",
            category: "廃城・封石の間",
            layer: "surface",
            coords: { x: 88, y: 45 },
            labelPos: "right",
            zoomCoords: { x: 79, y: 54 },
            zoomLabelPos: "right",
            showInWorld: true,
            showInZoom: true,
            desc: "廃境の最深部に鎮座する、物語『廃城の王』の核心舞台。七代目魔王ライガス以来、初代を除く六代分の残留思念が統合されて宿っており、封石の継承者アシュが「廃城の王」として覚醒する場所。",
            characters: ["アシュ（廃城の王）", "ミラ", "七人の封石の主"],
            episodes: [
              { code: "全体プロット", title: "廃城の王の覚醒", text: "二つのAIと人間が統合する物語の核心部。六代分の残留思念がここに眠る。" }
            ],
            items: ["封石（七人の声）", "廃王の座"],
            showInEast: true,
            eastCoords: { x: 32, y: 36 },
            eastLabelPos: "bottom"
          },
          {
            id: "tower-of-unanswered-question",
            name: "問答の廃塔",
            nameEn: "Tower of the Unanswered Question",
            category: "廃境最深部・存在の抹消",
            layer: "surface",
            coords: { x: 0, y: 0 },
            labelPos: "top",
            zoomCoords: { x: 0, y: 0 },
            zoomLabelPos: "top",
            showInWorld: false,
            showInZoom: false,
            showInEast: true,
            eastCoords: { x: 88, y: 36 },
            eastLabelPos: "left",
            desc: "廃魔国跡地の最深部、大陸最東端に位置する初代魔王アルクの終焉の地。冥王による「存在の抹消」を受けたため、他の廃城と異なり残留思念が「見えない」。近づいても何も感じないが、長時間滞在した者が「知りたくなかったものを知った」と錯乱して帰還する事例が複数ある。",
            characters: ["初代アルク（存在抹消済み）"],
            episodes: [
              { code: "世界観設定", title: "存在の抹消", text: "冥王により初代魔王のみ「なかったこと」にされた唯一の廃城。" }
            ],
            items: []
          },
          {
            id: "langria-kingdom",
            name: "ラングリア王国 中央平原",
            nameEn: "Central Langria",
            category: "王国・大平原",
            layer: "surface",
            coords: { x: 60, y: 40 },
            labelPos: "bottom",
            zoomCoords: { x: 10, y: 20 },
            zoomLabelPos: "bottom",
            showInWorld: true,
            showInZoom: false,
            desc: "アルデン大陸の中央部に広がる最も肥沃な大平原と、それを統治するラングリア王国の領土。騎士団と貴族政治の中心地。",
            characters: ["王国騎士団", "中央商人組合"],
            episodes: [
              { code: "世界観設定", title: "アルデン大陸の秩序", text: "王国の支配と廃境への警戒体制。" }
            ],
            items: ["王国通行手形"]
          },
          {
            id: "auros-isles",
            name: "アウロス諸島（珊瑚諸島）",
            nameEn: "Auros Isles / Coral Archipelago",
            category: "南方諸島・貿易",
            layer: "surface",
            coords: { x: 80, y: 84 },
            labelPos: "top",
            zoomCoords: { x: 50, y: 90 },
            zoomLabelPos: "top",
            showInWorld: true,
            showInZoom: false,
            desc: "アルデン大陸南部のカリン湾を抜けた先に広がる温暖な諸島。遺言石の流通拠点であり、異国船や自由貿易商が集う。",
            characters: ["南方貿易商", "自由冒険者"],
            episodes: [
              { code: "世界観設定", title: "遺言石の流通ルート", text: "アウロス諸島を経由して世界中に広がる遺言石。" }
            ],
            items: ["流通遺言石", "海産宝石"]
          },
          {
            id: "sunscald-desert",
            name: "白砂漠・アルタン神聖王国",
            nameEn: "The Sunscald Desert / Wern Continent",
            category: "西の大陸・砂漠",
            layer: "surface",
            coords: { x: 18, y: 84 },
            labelPos: "top",
            zoomCoords: { x: 10, y: 90 },
            zoomLabelPos: "top",
            showInWorld: true,
            showInZoom: false,
            desc: "ヴェルン大陸南部に広がる広大な白砂漠。専制国家ヴァルディア帝国と対峙するアルタン神聖王国が存在する。",
            characters: ["ヴェルン大陸の使者"],
            episodes: [
              { code: "世界観設定", title: "二大大陸の均衡", text: "アルデン大陸とヴェルン大陸を隔てる海と砂漠。" }
            ],
            items: ["白砂漠のオアシス水"]
          },
          {
            id: "silvermoon",
            name: "銀月都市（シルバームーン）",
            nameEn: "Silvermoon",
            category: "都市・中央アルデン",
            layer: "surface",
            coords: { x: 53, y: 45 },
            labelPos: "bottom",
            zoomCoords: { x: 0, y: 0 },
            zoomLabelPos: "bottom",
            showInWorld: true,
            showInZoom: false,
            desc: "中央アルデンに広がる肥沃な平原地帯の主要都市のひとつ。ラングリア王国の経済・文化を支える中心地。",
            characters: ["中央アルデンの商人組合"],
            episodes: [
              { code: "世界観設定", title: "アルデン大陸の秩序", text: "王国の支配が及ぶ中央アルデンの主要都市。" }
            ],
            items: []
          },
          {
            id: "aethelburg",
            name: "エーテルブルク",
            nameEn: "Aethelburg",
            category: "城砦都市・中央アルデン",
            layer: "surface",
            coords: { x: 48, y: 37 },
            labelPos: "top",
            zoomCoords: { x: 0, y: 0 },
            zoomLabelPos: "top",
            showInWorld: true,
            showInZoom: false,
            desc: "中央アルデン北西部、囁きの森に近い城砦都市。フロスト山脈方面への玄関口にあたる。",
            characters: ["中央アルデンの守備隊"],
            episodes: [
              { code: "世界観設定", title: "アルデン大陸の秩序", text: "フロスト山脈方面を睨む城砦都市。" }
            ],
            items: []
          },
          {
            id: "zolara",
            name: "ゾラーラ",
            nameEn: "Zolara",
            category: "都市・ヴェルン大陸",
            layer: "surface",
            coords: { x: 15, y: 50 },
            labelPos: "right",
            zoomCoords: { x: 0, y: 0 },
            zoomLabelPos: "right",
            showInWorld: true,
            showInZoom: false,
            desc: "西の大陸ヴェルン、カルギア草原地帯（ヴェルダント・ステップス）に位置する主要都市。ヴェルン大陸西側の交易拠点。",
            characters: ["ヴェルン大陸の使者"],
            episodes: [
              { code: "世界観設定", title: "二大大陸の均衡", text: "アルデン大陸とヴェルン海を挟んで対峙するヴェルン大陸の都市。" }
            ],
            items: []
          },
          {
            id: "carn-village",
            name: "カルン村",
            nameEn: "Carn Village",
            category: "村・出身地",
            layer: "surface",
            coords: { x: 63, y: 39 },
            labelPos: "top",
            zoomCoords: { x: 0, y: 0 },
            zoomLabelPos: "top",
            showInWorld: true,
            showInZoom: false,
            desc: "廃城近くの小村。カルン男爵家の旧領であり、アシュとミラの出身地。2章ではカルン村の若者トルク・ガント・ノルを迎え入れ、地下倉庫での共同採掘を始める拠点となる。",
            characters: ["アシュ", "ミラ", "トルク", "ガント", "ノル"],
            episodes: [
              { code: "ep01", title: "男爵と呼ばれた乞食", text: "「俺はカルン男爵だ」——アシュが廃城の門前で家督にまつわる経緯を独白する物語の起点。" },
              { code: "2章「起」", title: "共同採掘の始動", text: "カルン村の若者トルク・ガント・ノルを迎え入れ、地下倉庫での共同採掘初日を迎える。" }
            ],
            items: ["カルン男爵の権利書"],
            showInWest: true,
            westCoords: { x: 81, y: 46 },
            westLabelPos: "top"
          },
          {
            id: "bortan",
            name: "ボルタン",
            nameEn: "Bortan",
            category: "交易町・最寄りの町",
            layer: "surface",
            coords: { x: 66, y: 40 },
            labelPos: "bottom",
            zoomCoords: { x: 0, y: 0 },
            zoomLabelPos: "bottom",
            showInWorld: true,
            showInZoom: false,
            desc: "廃城から徒歩約1日の中規模交易町。市場・冒険者ギルド小支部・商業ギルド支部があり、ダイネン伯爵家の影響が強い。アシュたちの日常拠点。",
            characters: ["ダイネン伯爵家", "セルド", "グルス", "ドルク"],
            episodes: [
              { code: "ep04", title: "廃棄魔石を売りに行く", text: "近くの町ボルタンの鑑定師・冒険者ギルドに廃棄魔石を持ち込み、最低限の生活費を確保する。" },
              { code: "2章「承」", title: "ボルタン経済戦", text: "ダイネン伯爵家の市場圧力とドルクの独占契約要求を「道化」の情報戦で切り抜ける。" }
            ],
            items: ["廃棄魔石", "加工魔石"],
            showInWest: true,
            westCoords: { x: 55, y: 49 },
            westLabelPos: "bottom"
          },
          {
            id: "worga",
            name: "ウォルガ",
            nameEn: "Worga",
            category: "地方都市",
            layer: "surface",
            coords: { x: 69, y: 39 },
            labelPos: "top",
            zoomCoords: { x: 0, y: 0 },
            zoomLabelPos: "top",
            showInWorld: true,
            showInZoom: false,
            desc: "ボルタンからさらに半日〜1日の地方都市（ボルタンの3〜4倍規模）。監査院出張所・地方裁判所・王国軍小規模駐屯地があり、国の統制が強い。ローザ商会が拠点を置く。",
            characters: ["ローザ商会（エレーナ・セリン）", "コドー・ラシュ", "監察官ガルツ"],
            episodes: [
              { code: "ep55-56", title: "旅立ちの風・商会の懸念", text: "ローザ商会のエレーナ・セリンを訪ね、闇市場で変色魔石が買い漁られている実態を知る。" },
              { code: "ep57-58", title: "路地裏の感知・裏街のネズミ", text: "廃石感知で変色魔石の取引現場を特定し、情報屋コドー・ラシュと遭遇して協力者に加える。" }
            ],
            items: ["変色魔石"],
            showInWest: true,
            westCoords: { x: 18, y: 37 },
            westLabelPos: "top"
          }
        ];

        let currentMapMode = "world";
        let currentLayer = "surface";
        let currentLabelMode = "all";
        let activeLocationId = null;

        function isShownInMode(loc, mode) {
          if (mode === "arden") return loc.showInZoom !== false;
          if (mode === "west") return loc.showInWest === true;
          if (mode === "east") return loc.showInEast === true;
          return loc.showInWorld !== false;
        }

        function getModeCoords(loc, mode) {
          if (mode === "arden") return loc.zoomCoords;
          if (mode === "west") return loc.westCoords;
          if (mode === "east") return loc.eastCoords;
          return loc.coords;
        }

        function getModeLabelPos(loc, mode) {
          if (mode === "arden") return loc.zoomLabelPos || loc.labelPos;
          if (mode === "west") return loc.westLabelPos || loc.labelPos;
          if (mode === "east") return loc.eastLabelPos || loc.labelPos;
          return loc.labelPos;
        }

        function renderPins() {
          const container = document.getElementById("wm-pins-layer");
          const listContainer = document.getElementById("wm-location-list");
          container.innerHTML = "";
          listContainer.innerHTML = "";

          MAP_LOCATIONS.forEach(loc => {
            if (currentLayer === "surface" && loc.layer === "underground") return;
            if (currentLayer === "underground" && loc.layer === "surface") return;
            if (!isShownInMode(loc, currentMapMode)) return;

            const isActive = activeLocationId === loc.id;

            const pin = document.createElement("div");
            const labelPos = getModeLabelPos(loc, currentMapMode);
            let pinClasses = ["wm-pin", "pos-" + (labelPos || "top"), "layer-" + loc.layer];
            if (isActive) pinClasses.push("active");
            if (currentLabelMode === "select" && !isActive) pinClasses.push("hide-label");

            pin.className = pinClasses.join(" ");

            const pos = getModeCoords(loc, currentMapMode);
            pin.style.left = pos.x + "%";
            pin.style.top = pos.y + "%";

            pin.onclick = () => selectLocation(loc.id);

            pin.innerHTML = \`
              <div class="wm-pin-pulse"></div>
              <div class="wm-pin-icon">\${loc.layer === "underground" ? "🕳️" : "📍"}</div>
              <div class="wm-pin-label">\${loc.name}</div>
            \`;

            container.appendChild(pin);

            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "wm-location-chip" + (isActive ? " active" : "");
            chip.innerHTML = \`<span class="wm-location-chip-icon">\${loc.layer === "underground" ? "🕳️" : "📍"}</span><span class="wm-location-chip-name">\${loc.name}</span>\`;
            chip.onclick = () => selectLocation(loc.id);
            listContainer.appendChild(chip);
          });
        }

        function selectLocation(id) {
          activeLocationId = id;
          renderPins();

          const loc = MAP_LOCATIONS.find(l => l.id === id);
          if (!loc) return;

          document.getElementById("wm-info-category").textContent = loc.category;
          document.getElementById("wm-info-name").textContent = loc.name;
          document.getElementById("wm-info-name-en").textContent = loc.nameEn;

          let html = \`
            <p class="wm-sidebar-desc">\${loc.desc}</p>

            <div class="wm-info-section">
                <h4>👥 主な関連人物</h4>
                <div class="wm-tag-list">
                    \${loc.characters.map(c => \`<span class="wm-tag">\${c}</span>\`).join("")}
                </div>
            </div>

            <div class="wm-info-section">
                <h4>📜 関連エピソード・記憶</h4>
                <ul class="wm-ep-list">
                    \${loc.episodes.map(ep => \`
                        <li>
                            <span class="wm-ep-code">\${ep.code}</span>
                            <strong>\${ep.title}</strong>
                            <p>\${ep.text}</p>
                        </li>
                    \`).join("")}
                </ul>
            </div>

            <div class="wm-info-section">
                <h4>✨ キーワード・アイテム</h4>
                <div class="wm-tag-list">
                    \${loc.items.map(item => \`<span class="wm-tag item">\${item}</span>\`).join("")}
                </div>
            </div>
          \`;

          document.getElementById("wm-info-body").innerHTML = html;
        }

        function switchMapMode(mode) {
          currentMapMode = mode;
          document.getElementById("btn-view-world").classList.toggle("active", mode === "world");
          document.getElementById("btn-view-arden").classList.toggle("active", mode === "arden");
          document.getElementById("btn-view-west").classList.toggle("active", mode === "west");
          document.getElementById("btn-view-east").classList.toggle("active", mode === "east");

          const bgImg = document.getElementById("wm-map-bg");
          if (mode === "arden") {
            bgImg.src = "/blog/images/arden_region_detail_map.webp";
          } else if (mode === "west") {
            bgImg.src = "/blog/images/western_arden_carn_road_map.webp";
          } else if (mode === "east") {
            bgImg.src = "/blog/images/demon_realm_beyond_ruined_castle_map.webp";
          } else {
            bgImg.src = "/blog/images/eldaria_world_map.webp";
          }

          renderPins();
        }

        function switchLayer(layer) {
          currentLayer = layer;
          document.getElementById("btn-layer-surface").classList.toggle("active", layer === "surface");
          document.getElementById("btn-layer-underground").classList.toggle("active", layer === "underground");

          const overlay = document.getElementById("wm-underground-overlay");
          if (layer === "underground") {
            overlay.classList.add("visible");
          } else {
            overlay.classList.remove("visible");
          }

          renderPins();
        }

        function switchLabelMode(mode) {
          currentLabelMode = mode;
          document.getElementById("btn-label-all").classList.toggle("active", mode === "all");
          document.getElementById("btn-label-select").classList.toggle("active", mode === "select");
          renderPins();
        }

        document.addEventListener("DOMContentLoaded", () => {
          renderPins();
          selectLocation("graud-city");
        });
        </script>

        <div class="novels-footer">
            <a href="/lab/novels/" class="novels-back-link">← AI小説に戻る</a>
        </div>`;

  writeFileSync(
    join(worldMapDir, "index.html"),
    labWrap({
      title: "ワールドマップ — 廃城の王 | AI小説 | Gravity Portal",
      description:
        "カクヨム連載中「廃城の王」の舞台エルダリア大陸、廃境、グラウド市街、地下倉庫街のインタラクティブマップ。",
      backHref: "/lab/novels/",
      backLabel: "AI小説に戻る",
      titleIcon: "🗺️",
      titleText: "ワールドマップ",
      bodyHtml: worldMapBody,
    }),
    "utf-8",
  );

  console.log(
    "📖 novelsページ生成完了 (novels/index.html + novels/timeline/index.html + novels/world-map/index.html)",
  );
}
