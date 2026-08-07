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
import {
  DEFAULT_OG_IMAGE,
  SITE_URL,
  escapeHtml,
  getAdVisibilityScript,
  getNinjaAdHtml,
  htmlHead,
} from "./html.mjs";

// ==========================================
// ブログ小説本文ページ生成（/blog/novels/）
// カクヨム版とは別に、ルビ・傍点・場面転換の組版を
// 作り込んだブログ専用版として公開する。
// ==========================================

const SERIES_SLUG = "haijo-no-ou";
const NOVEL_SRC_DIR = join(PROJECT_DIR, "src", "novels", SERIES_SLUG);
const NOVEL_OUT_DIR = join(OUTPUT_DIR, "blog", "novels");
const NOVEL_BASE_URL = `${SITE_URL}/blog/novels`;

// ==========================================
// カクヨム記法 → HTML 変換
// ==========================================

// 漢字クラス: CJK統合漢字 + 拡張A + 互換漢字 + 々〆〇〻
const KANJI_CLASS =
  "\\u3005\\u3006\\u3007\\u303B\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF";

/** ① 傍点: 《《語句》》 — ルビ記法と競合するため必ず最初に処理する */
const RE_BOUTEN = /《《([^》\n]{1,40})》》/g;

/** ② ルビ(縦線あり): ｜親文字《ルビ》（全角｜・半角|どちらも許容） */
const RE_RUBY_BAR = /[｜|]([^《｜|\n]{1,40})《([^》\n]{1,40})》/g;

/** ③ ルビ(縦線なし): 漢字直後《ルビ》 */
const RE_RUBY_KANJI = new RegExp(
  `([${KANJI_CLASS}]{1,20})《([^》\\n]{1,40})》`,
  "g",
);

/** ④ 場面転換ブロック（◆◆◆ 等の記号のみで構成される場合） */
const RE_SCENE_BREAK = /^[◆◇◈❖＊*・]{2,}$/;

const SCENE_BREAK_HTML =
  '<div class="nv-scene-break" role="separator" aria-hidden="true">' +
  '<span class="nv-scene-break-mark">◆◆◆</span></div>';

const BOM_CHAR = String.fromCharCode(0xfeff);

export function stripBom(s) {
  return s.startsWith(BOM_CHAR) ? s.slice(1) : s;
}

/**
 * 1行分のエスケープ済みテキストにカクヨム記法を適用する。
 * 呼び出し前に必ず escapeHtml() を通しておくこと。
 * ルビ記法は改行をまたぐと無効（カクヨム仕様）なので、必ず行単位で呼ぶ。
 * 変換順序（傍点→ルビ縦線あり→ルビ縦線なし）は入れ替え不可。
 */
export function convertKakuyomuInline(escapedLine) {
  return escapedLine
    .replace(RE_BOUTEN, '<em class="nv-em">$1</em>')
    .replace(RE_RUBY_BAR, "<ruby>$1<rp>（</rp><rt>$2</rt><rp>）</rp></ruby>")
    .replace(
      RE_RUBY_KANJI,
      "<ruby>$1<rp>（</rp><rt>$2</rt><rp>）</rp></ruby>",
    );
}

function warnUnconvertedNotation(slug, html) {
  const leftovers = html.match(/[《》｜]/g);
  if (leftovers) {
    console.warn(
      `⚠️  ${slug}: カクヨム記法の未変換文字が${leftovers.length}件残っています（改行またぎ／閉じ括弧漏れの可能性）`,
    );
  }
}

/**
 * エピソード本文（frontmatter除去済み）をHTMLに変換する。
 * remarkは使わない（段落内の単一改行が空白に潰れるため。本文にMarkdown
 * 特殊文字も無いのでremarkを通すメリットがない）。
 */
export function renderEpisodeBody(body) {
  const text = stripBom(body)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t　]+$/gm, "");

  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const out = [];
  let charCount = 0;
  let leadDone = false;

  for (const block of blocks) {
    // 見出し行は frontmatter が正なので破棄（話ごとに形式が揺れているため）
    if (/^#{1,6}\s/.test(block)) continue;

    if (RE_SCENE_BREAK.test(block)) {
      out.push(SCENE_BREAK_HTML);
      continue;
    }

    charCount += block.replace(/\s/g, "").length;

    const isDialogue = /^[「『（(]/.test(block);
    const cls = ["nv-p"];
    if (isDialogue) {
      cls.push("nv-p-dialogue");
    } else if (!leadDone) {
      cls.push("nv-p-lead");
      leadDone = true;
    }

    // escapeHtml() は記法変換より必ず先に行う（順序が逆だと生成したタグが壊れる）
    const inner = escapeHtml(block)
      .split("\n")
      .map(convertKakuyomuInline)
      .join("<br>\n");

    out.push(`<p class="${cls.join(" ")}">${inner}</p>`);
  }

  return { html: out.join("\n"), charCount };
}

// ==========================================
// データ読み込み
// ==========================================

async function loadSeries() {
  const seriesPath = join(NOVEL_SRC_DIR, "_series.md");
  if (!existsSync(seriesPath)) return null;
  const raw = stripBom(readFileSync(seriesPath, "utf-8"));
  const { content, data } = matter(raw);
  const introHtml = (
    await remark()
      .use(remarkGfm)
      .use(remarkHtml, { sanitize: false })
      .process(content)
  ).toString();
  return {
    title: data.title || "",
    subtitle: data.subtitle || "",
    status: data.status || "",
    kakuyomuUrl: data.kakuyomuUrl || "",
    labUrl: data.labUrl || "/lab/novels/",
    ogImage: data.ogImage || DEFAULT_OG_IMAGE,
    introHtml,
  };
}

function loadEpisodes() {
  const files = readdirSync(NOVEL_SRC_DIR).filter(
    (f) => f.endsWith(".md") && !f.startsWith("_"),
  );

  const episodes = files.map((file) => {
    const raw = stripBom(readFileSync(join(NOVEL_SRC_DIR, file), "utf-8"));
    const { content, data } = matter(raw);
    const { html, charCount } = renderEpisodeBody(content);
    const slug = data.slug || file.replace(/\.md$/, "");
    warnUnconvertedNotation(slug, html);
    return {
      episode: Number(data.episode) || 0,
      slug,
      title: data.title || slug,
      chapter: Number(data.chapter) || 1,
      chapterTitle: data.chapterTitle || "",
      chapterStart: data.chapterStart === true,
      date: data.date || "",
      updated: data.updated || data.date || "",
      excerpt: data.excerpt || "",
      source: data.source || "",
      kakuyomuUrl: data.kakuyomuUrl || "",
      ogImage: data.ogImage || "",
      bodyHtml: html,
      charCount,
      readMinutes: Math.max(1, Math.round(charCount / 550)),
    };
  });

  episodes.sort((a, b) => a.episode - b.episode); // 数値ソート必須（ep10 < ep2 事故防止）
  return episodes;
}

// ==========================================
// HTML断片生成
// ==========================================

function novelToolbarHtml() {
  return `
            <div class="novel-toolbar">
                <button type="button" class="novel-tool-btn" data-size="s">小</button>
                <button type="button" class="novel-tool-btn active" data-size="m">中</button>
                <button type="button" class="novel-tool-btn" data-size="l">大</button>
            </div>`;
}

function episodeNavHtml(prev, next) {
  const prevHtml = prev
    ? `<a href="../${prev.slug}/" class="post-nav-link">
                <span class="post-nav-label">← 第${prev.episode}話</span>
                <span class="post-nav-title">${escapeHtml(prev.title)}</span>
            </a>`
    : "";
  const nextHtml = next
    ? `<a href="../${next.slug}/" class="post-nav-link">
                <span class="post-nav-label">第${next.episode}話 →</span>
                <span class="post-nav-title">${escapeHtml(next.title)}</span>
            </a>`
    : "";
  return `
        <nav class="post-nav">
            <div class="post-nav-prev">${prevHtml}</div>
            <div class="post-nav-next">${nextHtml}</div>
        </nav>`;
}

function kakuyomuLinkHtml(url) {
  return `
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="novel-kakuyomu-link">
            📗 カクヨム版でも読む →
        </a>`;
}

function episodeJsonLd(ep, series, ogImageUrl) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${ep.title} — 廃城の王 第${ep.episode}話`,
    description: ep.excerpt,
    url: `${NOVEL_BASE_URL}/${ep.slug}/`,
    image: ogImageUrl,
    datePublished: ep.date || undefined,
    dateModified: ep.updated || ep.date || undefined,
    author: { "@type": "Person", name: series?.author || "hahu1124" },
    publisher: { "@type": "Organization", name: "Gravity Portal", url: SITE_URL },
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function novelReaderScript() {
  return `<script>
(function(){
  var body=document.getElementById('novelBody');
  var bar=document.getElementById('novelProgress');
  if(!body) return;
  try{var s=localStorage.getItem('gp-novel-size');if(s)body.dataset.size=s}catch(e){}
  document.querySelectorAll('.novel-tool-btn').forEach(function(b){
    if(b.dataset.size===body.dataset.size) b.classList.add('active'); else b.classList.remove('active');
    b.addEventListener('click',function(){
      body.dataset.size=b.dataset.size;
      try{localStorage.setItem('gp-novel-size',b.dataset.size)}catch(e){}
      document.querySelectorAll('.novel-tool-btn').forEach(function(x){x.classList.toggle('active',x===b)});
    });
  });
  if(!bar) return;
  function onScroll(){
    var r=body.getBoundingClientRect();
    var total=r.height-window.innerHeight;
    var done=Math.min(Math.max(-r.top,0),Math.max(total,1));
    bar.style.width=(total<=0?100:done/total*100)+'%';
  }
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',onScroll);
  onScroll();
})();
</script>`;
}

// ==========================================
// ページ生成
// ==========================================

function buildNovelEpisodePages(series, episodes) {
  episodes.forEach((ep, i) => {
    const prev = i > 0 ? episodes[i - 1] : null;
    const next = i < episodes.length - 1 ? episodes[i + 1] : null;
    const ogImageUrl = ep.ogImage
      ? `${SITE_URL}${ep.ogImage.startsWith("/") ? "" : "/"}${ep.ogImage}`
      : series?.ogImage || DEFAULT_OG_IMAGE;

    const html = `${htmlHead(
      `${ep.title} — 廃城の王 第${ep.episode}話`,
      ep.excerpt,
      "../../styles.css",
      {
        url: `${NOVEL_BASE_URL}/${ep.slug}/`,
        image: ogImageUrl,
        type: "article",
      },
    )}
    <div class="article-page novel-page">
        <div class="novel-progress" id="novelProgress"></div>

        <nav class="breadcrumb">
            <a href="https://antigravity-portal.com/">トップ</a>
            <span class="separator">/</span>
            <a href="../../">ブログ</a>
            <span class="separator">/</span>
            <a href="../">廃城の王</a>
            <span class="separator">/</span>
            <span class="current">第${ep.episode}話 ${escapeHtml(ep.title)}</span>
        </nav>

        <article class="article novel-article">
            <header class="novel-ep-header">
                <p class="novel-chapter-label${ep.chapterStart ? "" : " novel-chapter-label-sub"}">第${ep.chapter}章　${escapeHtml(ep.chapterTitle)}</p>
                <p class="novel-ep-index">第${ep.episode}話</p>
                <h1 class="novel-ep-heading">${escapeHtml(ep.title)}</h1>
                <p class="novel-ep-stat">
                    <span>約${ep.charCount.toLocaleString()}字</span>
                    <span class="novel-stat-sep">/</span>
                    <span>読了約${ep.readMinutes}分</span>
                    <span class="novel-stat-sep">/</span>
                    <time datetime="${ep.date}">${ep.date}</time>
                </p>
            </header>

            ${novelToolbarHtml()}

            <div class="novel-body" id="novelBody" data-size="m">
                ${ep.bodyHtml}
            </div>
        </article>

        ${ep.kakuyomuUrl ? kakuyomuLinkHtml(ep.kakuyomuUrl) : ""}
        ${getNinjaAdHtml()}
        ${episodeNavHtml(prev, next)}

        <nav class="back-nav">
            <a href="https://antigravity-portal.com/" class="back-link">🏠 TOPに戻る</a>
            <a href="../" class="back-link">← 話数一覧に戻る</a>
            <a href="/lab/novels/" class="back-link">📖 制作の裏側を見る</a>
        </nav>
    </div>
    ${episodeJsonLd(ep, series, ogImageUrl)}
    ${novelReaderScript()}
    ${getAdVisibilityScript()}
</body>
</html>`;

    const dir = join(NOVEL_OUT_DIR, ep.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html, "utf-8");
  });
}

function buildNovelIndexPage(series, episodes) {
  const totalChars = episodes.reduce((s, e) => s + e.charCount, 0);

  // 章ごとにグループ化してから、章見出し+リストを正しく開閉する
  const chapters = [];
  for (const ep of episodes) {
    let group = chapters[chapters.length - 1];
    if (!group || group.chapter !== ep.chapter) {
      group = { chapter: ep.chapter, chapterTitle: ep.chapterTitle, episodes: [] };
      chapters.push(group);
    }
    group.episodes.push(ep);
  }

  const cardsHtml = chapters
    .map((group) => {
      const cards = group.episodes
        .map(
          (ep) => `
        <a href="${ep.slug}/" class="novel-ep-card">
            <span class="novel-ep-num">第${ep.episode}話</span>
            <span class="novel-ep-body">
                <span class="novel-ep-title">${escapeHtml(ep.title)}</span>
                <span class="novel-ep-meta">約${ep.charCount.toLocaleString()}字 / 読了約${ep.readMinutes}分 / ${ep.date}</span>
            </span>
            <span class="novel-ep-arrow">→</span>
        </a>`,
        )
        .join("\n");
      return `
        <h2 class="novel-chapter-heading">第${group.chapter}章　${escapeHtml(group.chapterTitle)}</h2>
        <div class="novel-ep-list">${cards}
        </div>`;
    })
    .join("\n");

  const body = `
    <div class="blog-page novel-page">
        <nav class="breadcrumb">
            <a href="https://antigravity-portal.com/">トップ</a>
            <span class="separator">/</span>
            <a href="../">ブログ</a>
            <span class="separator">/</span>
            <span class="current">廃城の王</span>
        </nav>

        <div class="novel-hero">
            <span class="novel-badge">📕 ブログ専用リッチ版</span>
            <h1 class="novel-hero-title">${escapeHtml(series?.title || "廃城の王")}</h1>
            <p class="novel-hero-sub">${escapeHtml(series?.subtitle || "")}</p>
            <div class="novel-hero-meta">全${episodes.length}話公開中 / 計${totalChars.toLocaleString()}字</div>
            <div class="novel-cta-group">
                <a href="${episodes[0]?.slug || ""}/" class="novel-cta novel-cta-primary">第1話から読む →</a>
                <a href="${series?.labUrl || "/lab/novels/"}" class="novel-cta">制作の裏側・設定資料 →</a>
                ${series?.kakuyomuUrl ? `<a href="${escapeHtml(series.kakuyomuUrl)}" target="_blank" rel="noopener noreferrer" class="novel-cta">カクヨム版 →</a>` : ""}
            </div>
        </div>

        <section class="novel-intro">${series?.introHtml || ""}</section>

        ${cardsHtml}

        <div class="novel-notice">
            現在は試験公開として第1〜${episodes.length}話を掲載しています。以降は順次追加予定です。
        </div>
    </div>`;

  const html = `${htmlHead(
    `廃城の王 — ブログ専用版`,
    series?.introHtml
      ? series.subtitle || "AI協業ファンタジー「廃城の王」のブログ専用版"
      : "AI協業ファンタジー「廃城の王」のブログ専用版",
    "../styles.css",
    {
      url: `${NOVEL_BASE_URL}/`,
      image: series?.ogImage || DEFAULT_OG_IMAGE,
      type: "website",
    },
  )}
${body}
    ${getAdVisibilityScript()}
</body>
</html>`;

  mkdirSync(NOVEL_OUT_DIR, { recursive: true });
  writeFileSync(join(NOVEL_OUT_DIR, "index.html"), html, "utf-8");
}

// ==========================================
// エントリポイント
// ==========================================

export async function buildBlogNovelPages() {
  if (!existsSync(NOVEL_SRC_DIR)) {
    console.log("⏭️  src/novels/ なし — 小説本文ページ生成スキップ");
    return;
  }
  const series = await loadSeries();
  const episodes = loadEpisodes();
  if (episodes.length === 0) {
    console.log("⏭️  エピソード0件 — 小説本文ページ生成スキップ");
    return;
  }
  mkdirSync(NOVEL_OUT_DIR, { recursive: true });
  buildNovelIndexPage(series, episodes);
  buildNovelEpisodePages(series, episodes);
  const totalChars = episodes.reduce((s, e) => s + e.charCount, 0);
  console.log(
    `📕 小説本文ページ生成完了 (novels/index.html + ${episodes.length}話 / 計${totalChars.toLocaleString()}字)`,
  );
}
