// ==========================================
// 機種 SEO ページの slug と、改名した機種の転送（旧 URL → 新 URL）の計画
//
// machine-pages.mjs から使う純粋関数だけ（ファイル・通信なし）。
// GP の scripts/rename-amadigi-pa.mjs も試し運転で同じ付番を再現するためにこのファイルを読む。
// GP の src/app/sitemap.ts にも同じ toSlug がある（変えるときは両方そろえる）。
// ==========================================

/** 機種名から URL の slug を作る */
export function toSlug(name) {
  return String(name || "")
    .replace(/[【】「」『』（）()〈〉《》<>]/g, "")
    .replace(/[～〜]/g, "-")
    .replace(/[！!？?・：:＆&＋+／/＊*＃#|"]/g, "")
    .replace(/[\s　]+/g, "-")
    .replace(/[\\]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/**
 * 並び順どおりに slug を割り当てる（同じ slug が出たら `-<通し番号>` を付ける）。
 * 通し番号は重なりの全体の数なので、並び順・名前が変わると後ろの機種の付番も変わる。
 * それを防ぐため、機種が slugPin（公開中の slug）を持っていればそれをそのまま使う。
 * ピンの slug は先に押さえ、ピンの無い機種は従来の付け方で、ピンと重なれば番号を進める。
 * ピンが 1 つも無ければ従来と同じ結果になる。
 * @param {{name:string, slugPin?:string}[]} machines prob>0 かつ name ありに絞った後の並び
 * @returns {{ slugs: string[], dupes: number }}
 */
export function assignSlugs(machines) {
  const used = new Set(machines.map((m) => m.slugPin).filter(Boolean));
  const slugs = [];
  let dupes = 0;
  machines.forEach((m, i) => {
    if (m.slugPin) {
      slugs.push(m.slugPin);
      return;
    }
    const base = toSlug(m.name) || `machine-${i}`;
    let slug = base;
    if (used.has(slug)) {
      do {
        dupes++;
        slug = `${base}-${dupes}`;
      } while (used.has(slug));
    }
    used.add(slug);
    slugs.push(slug);
  });
  return { slugs, dupes };
}

/**
 * 改名した機種の旧 URL から新 URL への転送の計画を作る。
 * 旧 slug は extra_data 由来の formerSlugs（改名時点で実際に公開していた slug。付番つき）と、
 * formerNames から toSlug で作った slug の両方を使う。今のページの slug と重なるものは転送しない。
 * toSlug で作った slug が今の別の機種のページと同じなのは、付番で旧 URL が `-N` だった機種の
 * よくある形（基底の slug は同名の別機種の URL）なので、警告に出さず黙って捨てる。
 * @param {{name:string, formerNames?:string[], formerSlugs?:string[]}[]} machines assignSlugs と同じ並び
 * @param {string[]} slugs assignSlugs の結果
 * @returns {{ redirects: {from:string,to:string,name:string}[], skipped: {from:string,to:string,name:string,reason:string}[] }}
 */
export function planRedirects(machines, slugs) {
  const live = new Set(slugs);
  const planned = new Map(); // from → to
  const redirects = [];
  const skipped = [];
  machines.forEach((m, i) => {
    const to = slugs[i];
    const names = Array.isArray(m.formerNames) ? m.formerNames : [];
    const fromSlugs = Array.isArray(m.formerSlugs) ? m.formerSlugs : [];
    const candidates = [...new Set([...fromSlugs, ...names.map(toSlug)])];
    for (const from of candidates) {
      if (!from || from === to) continue;
      if (live.has(from)) {
        if (!fromSlugs.includes(from)) continue; // 名前から作っただけの候補（上の説明）
        skipped.push({
          from,
          to,
          name: m.name,
          reason: "今のページの slug と同じ",
        });
        continue;
      }
      if (planned.has(from)) {
        if (planned.get(from) !== to)
          skipped.push({
            from,
            to,
            name: m.name,
            reason: `別の機種（${planned.get(from)}）への転送と重なる`,
          });
        continue;
      }
      planned.set(from, to);
      redirects.push({ from, to, name: m.name });
    }
  });
  return { redirects, skipped };
}
