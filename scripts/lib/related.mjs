// 重複検知＋関連記事の軽量類似度計算（LLM/形態素解析/外部API不使用）
// context.mjs は import しない（トップレベル副作用を持ち込まないリーフモジュール）。

const EMOJI_RE = /\p{Extended_Pictographic}️?/gu;

// シリーズ記事判定パターン（slug末尾）。ここに載る記事同士は「形式が同じだけ」で
// 内容の重複ではないため、重複検知の対象外・関連記事選定では多様性制約を課す。
// Uber日報は命名規則が2026-03頃に変遷しており（曜日+週番号 → _uber_daily 統一）、
// 旧命名の記事も同一シリーズとして扱う。
const SERIES_PATTERNS = [
  [/_uber_daily$/, "uber_daily"],
  [
    /_uber_(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/,
    "uber_daily",
  ],
  [/_uber_report$/, "uber_daily"],
  [/_weekly_trend_w\d+$/, "weekly_trend"],
  [/_uber_weekly_summary(_w\d+)?$/, "weekly_summary"],
  [/_weekly_report$/, "weekly_summary"],
  [/_ai_web_dev_day\d+$/, "ai_web_dev"],
  [/_ai_lab_update_v\d+$/, "ai_lab_update"],
];

export function seriesKey(post) {
  const slug = post.slug || "";
  for (const [re, key] of SERIES_PATTERNS) {
    if (re.test(slug)) return key;
  }
  return null;
}

export function normalizeTitle(title) {
  return String(title || "")
    .normalize("NFKC")
    .replace(EMOJI_RE, "")
    .replace(/[「」『』【】（）()［］\[\]!！?？、。,.:：;；\-—―~〜'"]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** 文字2-gramのSetを作る（日本語は形態素解析不要でそこそこ機能する） */
export function bigrams(str) {
  const s = normalizeTitle(str);
  const set = new Set();
  if (s.length < 2) {
    if (s.length === 1) set.add(s);
    return set;
  }
  for (let i = 0; i < s.length - 1; i++) {
    set.add(s.slice(i, i + 2));
  }
  return set;
}

/** Dice係数: 2|A∩B| / (|A|+|B|) */
export function diceCoefficient(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let inter = 0;
  const [small, large] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const x of small) if (large.has(x)) inter++;
  return (2 * inter) / (setA.size + setB.size || 1);
}

/** Jaccard係数: |A∩B| / |A∪B| */
export function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let inter = 0;
  const [small, large] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const x of small) if (large.has(x)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

function daysBetween(dateA, dateB) {
  const a = new Date(`${String(dateA).slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${String(dateB).slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 365;
  return Math.abs(a - b) / (1000 * 60 * 60 * 24);
}

function recencyScore(dateA, dateB) {
  const days = daysBetween(dateA, dateB);
  return 1 - Math.min(days / 365, 1);
}

/** 2記事間の類似度スコア（0〜1） */
export function similarity(a, b) {
  const tagJaccard = jaccard(new Set(a.tags || []), new Set(b.tags || []));
  const titleDice = diceCoefficient(bigrams(a.title), bigrams(b.title));
  const recency = recencyScore(a.date, b.date);
  return 0.6 * tagJaccard + 0.3 * titleDice + 0.1 * recency;
}

const DEFAULT_RELATED_LIMIT = 3;
const DEFAULT_RELATED_THRESHOLD = 0.15;
const DEFAULT_DUP_THRESHOLD = 0.75;

/**
 * post に対する関連記事を選定する。
 * - 自分自身・excludeSlugs（前後ナビの2件）は候補から除外
 * - 同一シリーズからは最大1件までという多様性制約を課す
 */
export function findRelated(post, allPosts, opts = {}) {
  const limit = opts.limit ?? DEFAULT_RELATED_LIMIT;
  const threshold = opts.threshold ?? DEFAULT_RELATED_THRESHOLD;
  const excludeSlugs = new Set(opts.excludeSlugs || []);

  const scored = allPosts
    .filter((p) => p.slug !== post.slug && !excludeSlugs.has(p.slug))
    .map((p) => ({ post: p, score: similarity(post, p) }))
    .filter((x) => x.score >= threshold)
    .sort((a, b) => b.score - a.score);

  // 候補側が属するシリーズごとに最大1件までという多様性制約
  // （自分自身がシリーズ記事かどうかに関わらず、候補プールが同一シリーズで埋まるのを防ぐ）
  const picked = [];
  const seriesCounts = new Map();
  for (const { post: candidate, score } of scored) {
    if (picked.length >= limit) break;
    const candSeriesKey = seriesKey(candidate);
    if (candSeriesKey) {
      const count = seriesCounts.get(candSeriesKey) || 0;
      if (count >= 1) continue;
      seriesCounts.set(candSeriesKey, count + 1);
    }
    picked.push({ post: candidate, score });
  }
  return picked;
}

/**
 * 非シリーズ記事同士の重複候補ペアを検出する（シリーズ記事は形式が同じだけなので対象外）。
 */
export function findDuplicates(allPosts, opts = {}) {
  const threshold = opts.threshold ?? DEFAULT_DUP_THRESHOLD;
  const nonSeries = allPosts.filter((p) => seriesKey(p) === null);
  const pairs = [];
  for (let i = 0; i < nonSeries.length; i++) {
    for (let j = i + 1; j < nonSeries.length; j++) {
      const score = similarity(nonSeries[i], nonSeries[j]);
      if (score >= threshold) {
        pairs.push({ a: nonSeries[i], b: nonSeries[j], score });
      }
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 関連記事ブロックのHTML断片を生成する（html.mjs の getNoteBannerHtml 等と同じ純関数パターン）。
 * toRoot: post.slug から blog/ ルートへの相対パス（末尾スラッシュ付き）
 */
export function getRelatedPostsHtml(related, toRoot) {
  if (!related || related.length === 0) return "";
  const items = related
    .map(
      ({ post }) => `
            <a href="${toRoot}${post.slug}/" class="related-post-card">
                <span class="related-post-title">${escapeHtml(post.title)}</span>
            </a>`,
    )
    .join("");
  return `
        <section class="related-posts">
            <h3 class="related-posts-heading">関連記事</h3>
            <div class="related-posts-grid">${items}
            </div>
        </section>`;
}
