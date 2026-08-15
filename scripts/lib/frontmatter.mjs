/**
 * 記事HTMLの先頭にあるコメント型Frontmatterをパース / シリアライズするモジュール
 *
 * 形式:
 * <!--
 * title: 記事のタイトル
 * date: 2026-08-15
 * excerpt: 記事の概要
 * tags: [タグ1, タグ2]
 * ogImage: og/202608/sample.webp
 * dateModified: 2026-08-15
 * -->
 */

/**
 * HTMLテキストからFrontmatter（メタデータ）と本文（content）を抽出する
 * @param {string} html
 * @returns {{ metadata: Object, content: string }}
 */
export function parseFrontmatter(html) {
  const match = html.match(/^<!--\s*([\s\S]*?)\s*-->\r?\n?/);
  if (!match) {
    return { metadata: {}, content: html };
  }

  const rawMeta = match[1];
  const content = html.slice(match[0].length);
  const metadata = {};

  const lines = rawMeta.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let val = line.slice(colonIndex + 1).trim();

    // tags: [a, b, c] の配列パース
    if (key === "tags") {
      if (val.startsWith("[") && val.endsWith("]")) {
        try {
          // JSON配列としてパース（["a", "b"] または [a, b]）
          metadata.tags = JSON.parse(val);
        } catch {
          // カンマ区切りのフォールバック
          metadata.tags = val
            .slice(1, -1)
            .split(",")
            .map((t) => t.trim().replace(/^["']|["']$/g, ""))
            .filter(Boolean);
        }
      } else {
        metadata.tags = val
          .split(",")
          .map((t) => t.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
      }
      continue;
    }

    // 文字列のクォート除去
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    metadata[key] = val;
  }

  return { metadata, content };
}

/**
 * メタデータオブジェクトと本文からFrontmatter付きHTMLを生成する
 * @param {Object} metadata
 * @param {string} content
 * @returns {string}
 */
export function stringifyFrontmatter(metadata, content) {
  const lines = ["<!--"];
  if (metadata.title) lines.push(`title: ${metadata.title}`);
  if (metadata.date) lines.push(`date: ${metadata.date}`);
  if (metadata.excerpt) lines.push(`excerpt: ${metadata.excerpt}`);
  if (metadata.tags && Array.isArray(metadata.tags)) {
    lines.push(`tags: ${JSON.stringify(metadata.tags)}`);
  }
  if (metadata.ogImage) lines.push(`ogImage: ${metadata.ogImage}`);
  if (metadata.dateModified) lines.push(`dateModified: ${metadata.dateModified}`);
  lines.push("-->\n");

  return lines.join("\n") + content;
}
