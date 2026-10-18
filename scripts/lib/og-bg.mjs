// 自動投稿（Uber 日次・週刊テックトレンド）の OGP 背景を選ぶ。
// 背景は assets/og-bg/<season>/<key>.webp（作り置きの AI の絵。index.json にキー → 季節・群）。
// 季節・天気から群を決め、直近 30 日に使った絵を避ける。使った絵は src/og-bg-history.json に残す
// （src/blog-data.json はビルドが記事の先頭の情報から作り直すので、そこには残せない）。
// 見出しの中身（日次・週刊）と、選ぶ → 重ねる → 記録するまでの流れ（renderAutoPhotoOg）もここに置く。
// context.mjs は import しない（og-image.mjs と同じリーフモジュール）。
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { renderOgPhotoCard } from "./og-image.mjs";

export const HISTORY_KEEP_DAYS = 40;
const AVOID_DAYS = 30;
// tech は週 1 回・12 枚なので、日数でなく直近の回数で避ける
const TECH_AVOID_COUNT = 8;
const HEAVY_RAIN_PERCENT = 80;

const SEASONS = ["spring", "summer", "autumn", "winter"];
const OTHER_WEATHER = {
  sunny: ["cloudy", "rainy"],
  cloudy: ["sunny", "rainy"],
  rainy: ["cloudy", "sunny"],
};

/** 月（1〜12）→ 季節。3〜5 春・6〜8 夏・9〜11 秋・12〜2 冬 */
export function seasonOf(month) {
  return SEASONS[Math.floor(((month + 9) % 12) / 3)];
}

/** 借りるときのとなりの季節。季節の最初の月なら前の季節、それ以外は次の季節を先に */
function neighborSeasons(month) {
  const i = SEASONS.indexOf(seasonOf(month));
  const prev = SEASONS[(i + 3) % 4];
  const next = SEASONS[(i + 1) % 4];
  return month % 3 === 0 ? [prev, next] : [next, prev];
}

function weatherChain(season, month, w) {
  return [
    `${season}_${w}`,
    ...OTHER_WEATHER[w].map((o) => `${season}_${o}`),
    ...neighborSeasons(month).map((s) => `${s}_${w}`),
  ];
}

/**
 * 背景の群を使う順に並べる（先頭が本来の群、後ろは尽きたときに借りる群）。
 * weatherType は generate-uber-daily.mjs の getWeatherType() の 7 種
 * （sunny / cloudy / rainy / storm / snow / hot / cold）。kind が "tech" なら週刊用。
 */
export function bgGroups({
  kind,
  weatherType,
  telop = "",
  rainMax = 0,
  month,
}) {
  if (kind === "tech") return ["tech"];
  const season = seasonOf(month);
  let groups;
  switch (weatherType) {
    case "hot":
      groups = [
        "summer_hot",
        "summer_sunny",
        ...weatherChain(season, month, "sunny"),
      ];
      break;
    case "cold":
      groups = ["winter_cold", "winter_sunny", "winter_cloudy"];
      break;
    case "snow":
      groups = ["winter_snow", "winter_cold", "winter_cloudy"];
      break;
    case "storm":
      groups = telop.includes("暴風")
        ? ["any_typhoon", "any_heavyrain", "any_thunder"]
        : ["any_thunder", "any_heavyrain"];
      groups.push(...weatherChain(season, month, "rainy"));
      break;
    case "rainy":
      groups = weatherChain(season, month, "rainy");
      if (rainMax >= HEAVY_RAIN_PERCENT) groups.unshift("any_heavyrain");
      break;
    case "cloudy":
    case "sunny":
      groups = weatherChain(season, month, weatherType);
      break;
    default:
      groups = weatherChain(season, month, "sunny");
  }
  return [...new Set(groups)];
}

/** 降水確率（"10%" / "--%" の 4 区分）の最大値。読めなければ 0 */
export function maxRainPercent(chanceOfRain) {
  const values = Object.values(chanceOfRain || {})
    .map((v) => parseInt(v))
    .filter((v) => !isNaN(v));
  return values.length ? Math.max(...values) : 0;
}

function dayNumber(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ""));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : NaN;
}

// 文字列 → 決まった整数（同じ記事なら何度やり直しても同じ絵にするため）
function hash(str) {
  let h = 2166136261;
  for (const ch of str) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function loadBgIndex(assetsDir) {
  return JSON.parse(readFileSync(join(assetsDir, "index.json"), "utf-8"));
}

export function loadBgHistory(historyPath) {
  try {
    return JSON.parse(readFileSync(historyPath, "utf-8"));
  } catch {
    return [];
  }
}

/**
 * 使う背景を選ぶ。戻り値 { key, path, group, borrowed }、使える絵が 1 枚も無ければ null。
 * 同じ slug の記録は除外の対象に入れない（同じ日にやり直しても同じ絵になる）。
 */
export function pickBackground({
  assetsDir,
  index,
  history,
  slug,
  date,
  groups,
}) {
  const today = dayNumber(date);
  const others = history.filter((h) => h.slug !== slug);
  const avoid = new Set(
    groups[0] === "tech"
      ? others
          .filter((h) => index[h.key]?.group === "tech")
          .sort((a, b) => dayNumber(b.date) - dayNumber(a.date))
          .slice(0, TECH_AVOID_COUNT)
          .map((h) => h.key)
      : others
          .filter(
            (h) =>
              today - dayNumber(h.date) < AVOID_DAYS &&
              today - dayNumber(h.date) >= 0,
          )
          .map((h) => h.key),
  );
  const keysOf = (group) =>
    Object.keys(index)
      .filter(
        (k) =>
          index[k].group === group &&
          existsSync(join(assetsDir, index[k].season, `${k}.webp`)),
      )
      .sort();

  for (const group of groups) {
    const free = keysOf(group).filter((k) => !avoid.has(k));
    if (free.length) {
      const key = free[hash(slug) % free.length];
      return {
        key,
        path: join(assetsDir, index[key].season, `${key}.webp`),
        group,
        borrowed: group !== groups[0],
      };
    }
  }
  // どの群も 30 日以内に使い切った（実際には起きない量）: 本来の群で最も前に使った絵
  const all = keysOf(groups[0]);
  if (!all.length) return null;
  const lastUsed = (k) =>
    Math.max(
      -Infinity,
      ...others.filter((h) => h.key === k).map((h) => dayNumber(h.date)),
    );
  const key = all.sort((a, b) => lastUsed(a) - lastUsed(b))[0];
  return {
    key,
    path: join(assetsDir, index[key].season, `${key}.webp`),
    group: groups[0],
    borrowed: false,
  };
}

/**
 * 使った背景を記録する（同じ slug は置き換え、HISTORY_KEEP_DAYS より前は消す）。
 * tech は週 1 回なので 40 日では 6 回分しか残らない → 直近 TECH_AVOID_COUNT 回分は日数に関わらず残す
 */
export function recordBackground(historyPath, history, { date, slug, key }) {
  const today = dayNumber(date);
  const sorted = [
    { date: String(date).slice(0, 10), slug, key },
    ...history.filter((h) => h.slug !== slug),
  ].sort(
    (a, b) =>
      dayNumber(b.date) - dayNumber(a.date) || b.slug.localeCompare(a.slug),
  );
  const recentTech = new Set(
    sorted.filter((h) => h.key.startsWith("tech_")).slice(0, TECH_AVOID_COUNT),
  );
  const next = sorted.filter(
    (h) => today - dayNumber(h.date) < HISTORY_KEEP_DAYS || recentTech.has(h),
  );
  writeFileSync(historyPath, JSON.stringify(next, null, 2) + "\n", "utf-8");
  return next;
}

// ===== 見出しの中身 =====

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * 日次レポートの見出し。titleTemplates は uber-daily-config.json の同名の設定。
 * ガソリン価格は載せない（ユーザー指示 2026-10-18「燃料の料金は別にいれなくていい」）
 */
export function dailyCardText({
  date,
  weatherType,
  telop,
  tempMax,
  tempMin,
  multiplier,
  titleTemplates,
}) {
  const [y, mo, d] = String(date).slice(0, 10).split("-").map(Number);
  const dow = DAY_NAMES[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  const tmpl = titleTemplates[weatherType] || titleTemplates.sunny;
  const temp = [
    tempMax != null && tempMax !== "" ? `最高 ${tempMax}℃` : "",
    tempMin != null && tempMin !== "" ? `最低 ${tempMin}℃` : "",
  ]
    .filter(Boolean)
    .join(" / ");
  const demand =
    multiplier > 1 ? `需要 ×${multiplier} の見込み` : "需要は通常レベル";
  return {
    theme: weatherType,
    badge: "FOOD DELIVERY DAILY",
    title: tmpl.text,
    subtitle: `${mo}月${d}日（${dow}）のデリバリー情報`,
    lines: [[telop, temp].filter(Boolean).join("　"), demand].filter(Boolean),
  };
}

/** 週刊テックトレンドの見出し（記事のタイトル「📰 週刊テックトレンド #41（10/05〜10/11）」と excerpt から） */
export function weeklyCardText({ title, excerpt, date }) {
  const m = /週刊テックトレンド\s*#(\d+)\s*（([^）]+)）/.exec(title || "");
  const count = /(\d+)件/.exec(excerpt || "")?.[1];
  return {
    theme: "tech",
    badge: "WEEKLY TECH TREND",
    title: m ? `週刊テックトレンド #${m[1]}` : "週刊テックトレンド",
    subtitle: m ? `${m[2]} の注目トレンド` : String(date || "").slice(0, 10),
    lines: [
      "Webデザイン・技術・AI・個人開発",
      count ? `${count}件から注目記事をピックアップ` : "",
    ].filter(Boolean),
  };
}

// ===== 選ぶ → 重ねる → 記録する =====

/**
 * 背景を選んで見出しを重ね、imagesDir/og/<slug>.webp に書く。使った絵は src/og-bg-history.json に残す。
 * 背景の一覧が無い・選べない・合成に失敗したら null（呼び出し側は renderOgCard の文字だけのカードに落とす）。
 * 何が起きても投げない（朝の日次レポートを止めない）。記録だけ失敗したときは画像を使う。
 * record: false のときは記録しない（見本づくり用）。
 */
export async function renderAutoPhotoOg({
  projectDir,
  slug,
  date,
  groups,
  text,
  imagesDir,
  config,
  record = true,
}) {
  try {
    const assetsDir = join(projectDir, "assets", "og-bg");
    const historyPath = join(projectDir, "src", "og-bg-history.json");
    const index = loadBgIndex(assetsDir);
    const history = loadBgHistory(historyPath);
    const bg = pickBackground({
      assetsDir,
      index,
      history,
      slug,
      date,
      groups,
    });
    if (!bg) {
      console.warn(`⚠️ OGP背景が見つかりません（${groups.join(" → ")}）`);
      return null;
    }
    const rel = await renderOgPhotoCard({
      bgPath: bg.path,
      ...text,
      slug,
      imagesDir,
      config,
    });
    if (!rel) return null;
    if (record) {
      try {
        recordBackground(historyPath, history, { date, slug, key: bg.key });
      } catch (err) {
        console.warn(
          `⚠️ OGP背景の記録に失敗（画像はそのまま使います）: ${err.message}`,
        );
      }
    }
    console.log(
      `🖼️ OGP背景: ${bg.key}（${bg.group}${bg.borrowed ? `・本来は ${groups[0]} から借用` : ""}）`,
    );
    return rel;
  } catch (err) {
    console.warn(
      `⚠️ 背景つきOGP画像を作れません（文字だけのカードにします）: ${slug} — ${err.message}`,
    );
    return null;
  }
}
