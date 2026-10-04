/* --- EVA15風 抽選エンジン --- */

// ============================================================
// 当否を先に決め、当り用・ハズレ用の表から演出を引く（案 B。ユーザー決定 2026-10-04）。
//   当否：65536 個の番号から 1 つ（当り範囲：通常・時短 205 個＝1/319.7、ST 659 個＝1/99.4）
//   当りなら当り用の表、ハズレならハズレ用の表で、リーチ → 各層（層の中は 1 回転に 1 つ）の順に引く
// 演出ごとの出現率（eva-effects.js の決めた割合 EVA_PLAN_N から読み込み時に作る）：
//   当り用の表 a ＝ その演出が「当りのうち何%に付くか」
//   ハズレ用の表 b ＝ a × T(1−t) ÷ (t(1−T))（t：演出の信頼度、T：基準の当りやすさ。
//   リーチ前の予告は当り確率、リーチに付く演出はそのリーチの信頼度）。
//   これで「出た回の当りやすさ＝資料の信頼度」がどの演出・どのリーチでも成り立つ。濃厚は b＝0
// 液晶に出す信頼度は、出た組合せの事後確率 P·Πa ÷ (P·Πa ＋ (1−P)·Πb)（層は当否ごとに独立なので積）。
// 旧方式（組合せのいちばん高い信頼度で当否・alpha の校正・2 つで 80%）は、予告が SP リーチに寄って
// シンクロが 31%（資料 3.1%）、リーチなしの当りが当りの 2 割になったため 2026-10-04 に廃止した。
// ============================================================

const EVA_SUDDEN_SHARE = 0.01; // 突発当り（リーチなしの当り）＝当りの 1%（1/31,969 回転。ユーザー方針 2026-10-04）
const EVA_LOW_TRUST = 10; // 信頼度がこれ未満の予告：当りのうち＝信頼度×信頼度、ハズレはリーチなしの回転にも出る
const EVA_SURE_MIN_HIT = 0.1; // 濃厚の演出の当りのうち（%）の下限
const EVA_ALWAYS_SURE_RATE = 0.005; // 必ず出る部品の濃厚：そのリーチの当りのときに出る割合

const EVA_NONE = { id: "none", name: "なし" };

// 「確変濃厚」「10R確変濃厚」の判定（only で当り種別を絞った 100% の演出）
function evaSureKind(s) {
  if (!(s.trust >= 100) || !s.only) return null;
  if (s.only.every((id) => id === "r10")) return "r10";
  if (s.only.every((id) => EVA_KAKUHEN.includes(id))) return "kaku";
  return null;
}

// 層の中のまとまり：層の key。層に groups があれば id の頭で分けて "key/group"
// （発展契機のタイトル予告・次回予告、リーチ前予告のステップアップ・セリフなど）
function evaGroupKey(layer, s) {
  if (layer.groups) {
    for (const [g, heads] of Object.entries(layer.groups)) {
      if (heads.some((h) => s.id.startsWith(h))) return layer.key + "/" + g;
    }
  }
  return layer.key;
}

// まとまりの目安：数（当りのうち何%）か { each：10%以上の演出 1 つあたりの% }。無ければ undefined
function evaBudgetOf(plan, layer, s) {
  const b = plan && plan.budget[layer.key];
  if (b === undefined || typeof b === "number" || b.each !== undefined)
    return b;
  return b[evaGroupKey(layer, s).slice(layer.key.length + 1)];
}

// その演出が出られるリーチ（id の配列。null はどのリーチでも）
function evaReachesOf(layer, s) {
  return s.reaches || layer.reaches || null;
}

// リーチに付く演出の乗せ先。演出に付くリーチの指定が無ければ、信頼度で分けた帯（plan.bands）のリーチに乗せる
// （弱い演出を強いリーチに乗せると、そのリーチのハズレが足りなくなる）。濃厚は層の指定どおり全部
function evaAttachOf(plan, layer, s) {
  const ids = evaReachesOf(layer, s);
  if (s.reaches || !plan || !plan.bands || s.trust >= 100) return ids;
  const band = plan.bands.find((b) => s.trust < b.below);
  return band ? band.reaches.filter((id) => !ids || ids.includes(id)) : ids;
}

// 演出の文字に掛けるノイズの強さ（名前に「ノイズ」が付く演出。eva-reel.js が文字にモザイクのノイズを掛ける）。
// 残り回数・背景ノイズ違和感・保留は別の見せ方なので null
function evaNoiseOf(state) {
  if (state.remain || state.holdType || /^bg-noise/.test(state.id)) return null;
  if (!/ノイズ/.test(state.name)) return null;
  return /ノイズ大/.test(state.name)
    ? "l"
    : /ノイズ小/.test(state.name)
      ? "s"
      : "m";
}

// ハズレ用の出現率の倍率：当り用の出現率 a に掛けるとハズレ用の b（t：演出の信頼度、T：基準の当りやすさ）
function evaMissFactor(t, T) {
  if (t >= 1 || T >= 1 || t <= 0) return 0;
  return (T * (1 - t)) / (t * (1 - T));
}

// 演出ごとの「当りのうち何%に付くか」を決める（必ず出る部品・rate の層は別に解く）：
//   個別に決めた値（plan.hit）→ 濃厚は share か 0.1% の大きいほう → 10%未満は 信頼度×信頼度
//   → 10%以上はまとまりの目安から上の分を引いた残りを配る（plan.spread の層は付くリーチの当りに比例、
//     ほかは同じ割合ずつ）。目安が { each } なら 1 つあたりその値
// ST（plan が無い）は値が未決なので share をそのまま使う
function evaResolveHits(spec, layer, states, hitByReach, trustByReach) {
  const h = new Map();
  // 目安の残りを配った演出（表づくりで、リーチの枠が溢れたらまとまりの中で配り直してよいもの）
  h.mid = new Set();
  const plan = spec.plan;
  if (!plan) {
    for (const s of states) h.set(s, s.share || 0);
    return h;
  }
  const own = plan.hit[layer.key] || {};
  const groups = new Map();
  for (const s of states) {
    const g = evaGroupKey(layer, s);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(s);
  }
  for (const list of groups.values()) {
    const budget = evaBudgetOf(plan, layer, list[0]);
    const mid = [];
    for (const s of list) {
      if (own[s.id] !== undefined) h.set(s, own[s.id]);
      else if (s.trust >= 100)
        h.set(s, Math.max(s.share || 0, EVA_SURE_MIN_HIT));
      else if (s.trust < EVA_LOW_TRUST) h.set(s, (s.trust * s.trust) / 100);
      else mid.push(s);
    }
    if (!mid.length) continue;
    if (typeof budget === "number") {
      const fixed = list.reduce((sum, s) => sum + (h.get(s) || 0), 0);
      const rest = Math.max(0, budget - fixed);
      // 付くリーチの当りに比例。信頼度がそのリーチより低い演出はハズレを多く使うので、その倍率で割って小さくする
      // （同じまとまりの中で高い演出に回す。まとまりの目安は変えない）
      const weight = (s) => {
        if (!plan.spread.includes(layer.key)) return 1;
        const ids = evaAttachOf(plan, layer, s);
        if (!ids) return 1;
        return ids.reduce((sum, id) => {
          const T = (trustByReach[id] || 0) / 100;
          const k = evaMissFactor(s.trust / 100, T);
          return sum + (hitByReach[id] || 0) / Math.max(1, k);
        }, 0);
      };
      const wSum = mid.reduce((sum, s) => sum + weight(s), 0);
      for (const s of mid) {
        h.set(s, wSum > 0 ? (rest * weight(s)) / wSum : 0);
        h.mid.add(s);
      }
    } else if (budget && budget.each !== undefined) {
      for (const s of mid) h.set(s, budget.each);
    } else {
      for (const s of mid) h.set(s, s.share || 0);
    }
  }
  return h;
}

// リーチに付く層で、あるリーチの当り用・ハズレ用の合計が 1 を超えたら、そのリーチの「目安の残りを配った演出」を
// 枠に収まるまで縮め、縮めた分を同じまとまりの演出の、まだ空きのあるリーチ側へ移す（発展契機のように
// まとまりの目安が大きい層で、強いリーチの枠が足りなくなるため）。リーチごとにハズレ＝当り×倍率を保つので、
// 演出の出た回の当りやすさは信頼度のまま。まとまりの目安も変わらない（移す先が無いときだけ減る）
function evaRebalanceLinked(def, states, hs, hit, miss, aR, bR, TR, noneR) {
  const n = states.length;
  const isMid = states.map((s) => hs.mid.has(s));
  const group = states.map((s) => evaGroupKey(def, s));
  const k = (r, i) => evaMissFactor(states[i].trust / 100, TR[r]);
  const target = {};
  states.forEach((s, i) => {
    if (isMid[i]) target[group[i]] = (target[group[i]] || 0) + hs.get(s) / 100;
  });
  const full = new Set();
  for (let it = 0; it < 100; it++) {
    let clipped = false;
    for (let r = 0; r < noneR; r++) {
      if (!(aR[r] > 0)) continue;
      let fh = 0;
      let mh = 0;
      let fm = 0;
      let mm = 0;
      for (let i = 0; i < n; i++) {
        const x = hit[r][i];
        if (!x) continue;
        if (isMid[i]) {
          mh += x;
          mm += x * k(r, i);
        } else {
          fh += x;
          fm += x * k(r, i);
        }
      }
      let s = 1;
      if (fh + mh > 1 + 1e-9 && mh > 0) s = Math.min(s, (1 - fh) / mh);
      if (bR[r] > 0 && fm + mm > 1 + 1e-9 && mm > 0)
        s = Math.min(s, (1 - fm) / mm);
      if (s < 1) {
        s = Math.max(0, s);
        for (let i = 0; i < n; i++) if (isMid[i]) hit[r][i] *= s;
        full.add(r);
        clipped = true;
      }
    }
    if (!clipped) break;
    for (const g of Object.keys(target)) {
      let cur = 0;
      let room = 0;
      for (let i = 0; i < n; i++) {
        if (!isMid[i] || group[i] !== g) continue;
        for (let r = 0; r < noneR; r++) {
          cur += aR[r] * hit[r][i];
          if (!full.has(r)) room += aR[r] * hit[r][i];
        }
      }
      const lack = target[g] - cur;
      if (lack <= 1e-12 || room <= 0) continue;
      const f = 1 + lack / room;
      for (let i = 0; i < n; i++) {
        if (!isMid[i] || group[i] !== g) continue;
        for (let r = 0; r < noneR; r++) if (!full.has(r)) hit[r][i] *= f;
      }
    }
  }
  for (let i = 0; i < n; i++) {
    if (!isMid[i]) continue;
    for (let r = 0; r < noneR; r++) miss[r][i] = hit[r][i] * k(r, i);
  }
}

// 当り用・ハズレ用の表を作る。rot：今の回転数（群予告は 401 回転から、レイ背景は 400 回転まで）。
// 返り値の reach.hit / reach.miss はリーチの出現率、layers[].hit[r] / miss[r] はリーチ r のときの層の出現率
// （最後が「なし」）。同じ層の合計が 1 を超えたら比を保って縮め、warn に残す（確かめは試験と確認スクリプト）
function evaBuildTables(spec, rot) {
  const P = spec.pHit;
  const plan = spec.plan;
  const warn = [];
  const info = []; // 縮めたが信頼度は保った所（rate の層の出る割合など）
  const active = (layer) =>
    layer.states.filter(
      (s) => (!s.minRot || rot >= s.minRot) && (!s.maxRot || rot <= s.maxRot),
    );

  // リーチ：当り用 aR ＝ 当りのうち、ハズレ用 bR。リーチなしの当りは突発当り
  const reachDef = spec.layers.find((l) => l.isReach);
  const rStates = [...active(reachDef), EVA_NONE];
  const nR = rStates.length;
  const noneR = nR - 1;
  const ownReach = (plan && plan.hit.reach) || {};
  const raw = rStates.map((s) =>
    s === EVA_NONE
      ? 0
      : (plan && ownReach[s.id] !== undefined ? ownReach[s.id] : s.share || 0) /
        100,
  );
  const rawSum = raw.reduce((a, b) => a + b, 0);
  // plan が無い表はリーチの合計を当りの 99% にそろえる。spec.suddenShare があれば、リーチの合計を
  // 1 − suddenShare に縮めて、リーチなしの当りをその割合にする（ST の高速区間）
  const scaleR =
    rawSum > 0 && spec.suddenShare !== undefined
      ? (1 - spec.suddenShare) / rawSum
      : !plan && rawSum > 0
        ? (1 - EVA_SUDDEN_SHARE) / rawSum
        : 1;
  const aR = raw.map((x) => x * scaleR);
  aR[noneR] = Math.max(0, 1 - aR.reduce((a, b) => a + b, 0));
  const TR = rStates.map((s) => (s === EVA_NONE ? 0 : s.trust / 100));
  const bR = rStates.map((s, i) =>
    s === EVA_NONE ? 0 : aR[i] * evaMissFactor(TR[i], P),
  );
  const bSum = bR.reduce((a, b) => a + b, 0);
  if (bSum > 1)
    warn.push(
      `リーチ：ハズレ用の合計が 1 を超えています（${bSum.toFixed(3)}）`,
    );
  bR[noneR] = Math.max(0, 1 - bSum);
  const ri = Object.fromEntries(rStates.map((s, i) => [s.id, i]));
  const hitByReach = Object.fromEntries(
    rStates.map((s, i) => [s.id, aR[i] * 100]),
  );
  const trustByReach = Object.fromEntries(
    rStates.map((s, i) => [s.id, TR[i] * 100]),
  );
  const isSp = rStates.map((s) => spec.spReaches.includes(s.id));
  const idsToRows = (ids) =>
    ids.map((id) => ri[id]).filter((r) => r !== undefined);
  const sumOver = (probs, rows) => rows.reduce((a, r) => a + probs[r], 0);
  const allRows = rStates.map((_, r) => r);
  const hitRowsAll = allRows.filter((r) => r !== noneR);
  // 信頼度 10%以上のリーチ前の予告のハズレの乗せ先（リーチなしで終わらせない）。
  // ST は図柄テンパイ（リーチはかかる）も含める（SP のハズレだけでは保留 35% などが収まらない。2026-10-04）
  const spMissRows = allRows.filter(
    (r) => isSp[r] || (spec.preMissReaches || []).includes(rStates[r].id),
  );

  const linkedSet = new Set(spec.linked);
  const layers = [];
  for (const def of [
    ...spec.layers.filter((l) => !l.isReach),
    ...spec.linked,
  ]) {
    const states = active(def);
    const n = states.length;
    const hit = Array.from({ length: nR }, () => new Array(n + 1).fill(0));
    const miss = Array.from({ length: nR }, () => new Array(n + 1).fill(0));
    const isLinked = linkedSet.has(def);
    // rate の層：目安（plan.budget）を持たない層だけ（通常時のテロップなどは目安で配る）
    const rateMode =
      (!plan || plan.budget[def.key] === undefined) &&
      n > 0 &&
      states.every((s) => s.share === undefined && s.rate !== undefined);
    if (plan && plan.always.includes(def.key)) {
      // 必ずどれか 1 つ出る部品（SP 発展・カットイン・シンクロメーター）：リーチごとに当り・ハズレの割合を解く。
      // 信頼度がリーチより高い組と低い組に分け、組の中は同じ割合、当りでもハズレでも合計 100% になる比にする
      for (let r = 0; r < noneR; r++) {
        const on = [];
        states.forEach((s, i) => {
          const ids = evaReachesOf(def, s);
          if (ids && ids.includes(rStates[r].id)) on.push(i);
        });
        if (!on.length) continue;
        const T = TR[r];
        const k = (i) => evaMissFactor(states[i].trust / 100, T);
        const sure = on.filter((i) => states[i].trust >= 100);
        const hi = on.filter(
          (i) => states[i].trust < 100 && states[i].trust / 100 > T,
        );
        const lo = on.filter(
          (i) => states[i].trust < 100 && states[i].trust / 100 <= T,
        );
        const free = 1 - EVA_ALWAYS_SURE_RATE * sure.length;
        const avg = (list) =>
          list.length ? list.reduce((x, i) => x + k(i), 0) / list.length : 0;
        const Khi = avg(hi);
        const Klo = avg(lo);
        let aHi =
          hi.length && lo.length
            ? (Klo * free - 1) / (Klo - Khi)
            : hi.length
              ? free
              : 0;
        aHi = Math.min(free, Math.max(0, aHi));
        const aLo = free - aHi;
        for (const i of sure) hit[r][i] = EVA_ALWAYS_SURE_RATE;
        for (const i of hi) {
          hit[r][i] = aHi / hi.length;
          miss[r][i] = hit[r][i] * k(i);
        }
        for (const i of lo) {
          hit[r][i] = aLo / lo.length;
          miss[r][i] = hit[r][i] * k(i);
        }
      }
    } else if (rateMode) {
      // ST の部品（rate：資料の「そのリーチになったときに出る割合」）。
      // 出る割合を当り・ハズレに分けて、出た回の当りやすさを信頼度にする
      states.forEach((s, i) => {
        const t = s.trust / 100;
        for (const r of idsToRows(evaReachesOf(def, s) || spec.spReaches)) {
          const q =
            typeof s.rate === "number" ? s.rate : s.rate[rStates[r].id] || 0;
          const T = TR[r];
          if (!(T > 0)) continue;
          hit[r][i] = (q * t) / T;
          miss[r][i] = T >= 1 ? 0 : (q * (1 - t)) / (1 - T);
        }
      });
      // 資料の出る割合と信頼度がそのリーチの信頼度と合わず、当り用かハズレ用の合計が 1 を超えるリーチでは、
      // 当り・ハズレを同じ比で縮める（信頼度はそのまま、そのリーチで出る割合だけ下がる）。warn ではなく info に残す
      for (let r = 0; r < nR; r++) {
        const H = hit[r].slice(0, n).reduce((a, b) => a + b, 0);
        const M = miss[r].slice(0, n).reduce((a, b) => a + b, 0);
        const over = Math.max(H, bR[r] > 0 ? M : 0);
        if (over <= 1 + 1e-9) continue;
        info.push(
          `${def.label}：${rStates[r].name} で出る割合を ${((1 / over) * 100).toFixed(0)}% に縮めた`,
        );
        for (let i = 0; i < n; i++) {
          hit[r][i] /= over;
          miss[r][i] /= over;
        }
      }
    } else {
      const hs = evaResolveHits(spec, def, states, hitByReach, trustByReach);
      // リーチ前の予告は、付くリーチが決まっている演出を先に置き、決まっていない演出は
      // リーチごとの残りの空きに比例して配る（キャラ連続が零号機・弐号機の当りに寄る分を他の予告で埋めない）
      const order = states.map((_, i) => i);
      if (!isLinked) {
        order.sort(
          (x, y) =>
            (evaReachesOf(def, states[y]) ? 1 : 0) -
            (evaReachesOf(def, states[x]) ? 1 : 0),
        );
      }
      const free = (probs, rows) => {
        const f = new Array(nR).fill(0);
        for (const r of rows) {
          let used = 0;
          for (let j = 0; j < n; j++) {
            if (evaReachesOf(def, states[j]) && probs === aR) used += hit[r][j];
            else if (evaReachesOf(def, states[j])) used += miss[r][j];
          }
          f[r] = Math.max(0, 1 - used);
        }
        return f;
      };
      let hitFree = null;
      let missFree = null;
      order.forEach((i) => {
        const s = states[i];
        const a = (hs.get(s) || 0) / 100;
        const t = s.trust / 100;
        const ids = isLinked ? evaAttachOf(plan, def, s) : evaReachesOf(def, s);
        if (isLinked) {
          // リーチに付く演出：付くリーチの当りに同じ割合で乗せ、ハズレはリーチごとに信頼度を守る
          const rows = idsToRows(ids || spec.spReaches);
          const cap = sumOver(aR, rows);
          for (const r of rows) {
            hit[r][i] = cap > 0 ? a / cap : 0;
            miss[r][i] = hit[r][i] * evaMissFactor(t, TR[r]);
          }
        } else {
          // リーチ前の予告：当りはリーチのある当りに一様（突発当りには付けない）。
          // ハズレは、信頼度 10%未満ならどの回転にも（リーチなしでハズレ、次の回転へ）、
          // 10%以上は SP リーチのハズレだけ（強い予告がリーチなしで終わらない。2026-10-03 方針）
          const b = a * evaMissFactor(t, P);
          if (ids) {
            const rows = idsToRows(ids);
            const cap = sumOver(aR, rows);
            for (const r of rows) hit[r][i] = cap > 0 ? a / cap : 0;
            // 付くリーチより信頼度が低い演出（ST の背景ノイズ違和感 9〜33% → ダミー 80.5% など）は、
            // ハズレのときそのリーチに行かせると枠が足りない。ハズレは付くリーチの決まっていない演出と同じ所へ
            // （10%未満はどの回転にも、10%以上は SP リーチのハズレ）
            const tMin = Math.min(
              ...rows.map((r) => (r === noneR ? 0 : TR[r])),
            );
            const mRows =
              t < tMin
                ? s.trust < EVA_LOW_TRUST
                  ? allRows
                  : spMissRows
                : rows;
            const mcap = sumOver(bR, mRows);
            for (const r of mRows) miss[r][i] = mcap > 0 ? b / mcap : 0;
            return;
          }
          // 付くリーチが決まっていない演出：残りの空き（w）に比例して配る
          if (!hitFree) {
            hitFree = free(aR, hitRowsAll);
            missFree = free(bR, allRows);
          }
          const spread = (probs, rows, w, total, out) => {
            const cap = rows.reduce((x, r) => x + probs[r] * w[r], 0);
            for (const r of rows)
              out[r][i] = cap > 0 ? (total * w[r]) / cap : 0;
          };
          spread(aR, hitRowsAll, hitFree, a, hit);
          spread(
            bR,
            s.trust < EVA_LOW_TRUST ? allRows : spMissRows,
            missFree,
            b,
            miss,
          );
        }
      });
      if (isLinked && hs.mid.size) {
        evaRebalanceLinked(def, states, hs, hit, miss, aR, bR, TR, noneR);
      }
    }
    // 同じ層の合計（そのリーチが出る表だけ確かめる）と「なし」
    for (const [rows, probs, kind] of [
      [hit, aR, "当り用"],
      [miss, bR, "ハズレ用"],
    ]) {
      rows.forEach((row, r) => {
        const sum = row.slice(0, n).reduce((a, b) => a + b, 0);
        if (sum > 1 + 1e-9) {
          if (probs[r] > 0) {
            warn.push(
              `${def.label}：${rStates[r].name} の${kind}の合計が 1 を超えています（${sum.toFixed(3)}）`,
            );
          }
          for (let i = 0; i < n; i++) row[i] /= sum;
        }
        row[n] = Math.max(0, 1 - Math.min(1, sum));
      });
    }
    layers.push({
      key: def.key,
      label: def.label,
      lead: def.lead || null,
      component: !!def.component,
      groups: def.groups || null,
      isLinked,
      states: [...states, EVA_NONE],
      hit,
      miss,
    });
  }

  // 当り種別：全回転は 10R、確変濃厚の演出かシンクロ当りは 3R確変。残りの 3R確変の比を逆算する
  const isForced = (s) => !!evaSureKind(s) || !!s.forceKakuhen;
  const zen = ri.zenkaiten;
  let forced = 0;
  for (let r = 0; r < nR; r++) {
    if (r === zen || !(aR[r] > 0)) continue;
    let pNo = rStates[r].forceKakuhen ? 0 : 1;
    for (const L of layers) {
      let pf = 0;
      L.states.forEach((s, i) => {
        if (s !== EVA_NONE && isForced(s)) pf += L.hit[r][i];
      });
      pNo *= 1 - Math.min(1, pf);
    }
    forced += aR[r] * (1 - pNo);
  }
  const r10 = zen !== undefined ? aR[zen] : 0;
  const hitN = spec.classes.filter((c) => c.hit);
  const nHit = hitN.reduce((s, c) => s + c.n, 0);
  const k3 = hitN.find((c) => c.id === "k3");
  let k3Rate = 0;
  if (k3) {
    k3Rate = (k3.n / nHit - forced) / (1 - r10 - forced);
    if (!(k3Rate >= 0 && k3Rate <= 1)) {
      warn.push(`3R確変の比が範囲外です（${k3Rate.toFixed(3)}）`);
      k3Rate = Math.min(1, Math.max(0, k3Rate));
    }
  }
  return {
    pHit: P,
    spec,
    reach: {
      key: "reach",
      label: reachDef.label,
      isReach: true,
      states: rStates,
      hit: aR,
      miss: bR,
      trust: TR,
    },
    layers,
    k3Rate,
    forcedShare: forced,
    warn,
    info,
  };
}

// 演出ごとの 1 回転あたりの出現率（freq）と「当りのうち何%に付くか」（hit：0〜1）。試験と確認用
function evaStateFreqs(T) {
  const P = T.pHit;
  const R = T.reach;
  const rows = [];
  R.states.forEach((s, i) => {
    if (s.id === "none") return;
    rows.push({
      layer: R,
      state: s,
      freq: P * R.hit[i] + (1 - P) * R.miss[i],
      hit: R.hit[i],
    });
  });
  for (const L of T.layers) {
    L.states.forEach((s, i) => {
      if (s.id === "none") return;
      let h = 0;
      let m = 0;
      R.states.forEach((_, r) => {
        h += R.hit[r] * L.hit[r][i];
        m += R.miss[r] * L.miss[r][i];
      });
      rows.push({ layer: L, state: s, freq: P * h + (1 - P) * m, hit: h });
    });
  }
  return rows;
}

// 出た演出の要約：何か出たか・濃厚か・確変濃厚の種類・確変を強制するか
function evaSummarize(shown) {
  const acc = { any: false, sure: false, sureKind: null, forced: false };
  for (const { state: s } of shown) {
    acc.any = true;
    if (s.trust >= 100) acc.sure = true;
    const k = evaSureKind(s);
    if (k === "r10") acc.sureKind = "r10";
    else if (k && !acc.sureKind) acc.sureKind = k;
    if (k || s.forceKakuhen) acc.forced = true;
  }
  return acc;
}

// 演出の番号：層ごとに 2^20（1,048,576）個の番号から 1 つ引き、出現率の表のどこに入ったかで演出を決める
// （抽選ログに「演出 #番号/1048576」と出す）
const EVA_EFFECT_LOTTERY = 1048576;
function evaPickNo(probs) {
  const no = Math.floor(Math.random() * EVA_EFFECT_LOTTERY);
  let r = (no + 0.5) / EVA_EFFECT_LOTTERY;
  for (let i = 0; i < probs.length - 1; i++) {
    if (r < probs[i]) return { i, no };
    r -= probs[i];
  }
  return { i: probs.length - 1, no };
}

const EVA_SPEC_N = {
  pHit: EVA_N_HIT / EVA_BIT,
  classes: EVA_CLASSES_N,
  layers: EVA_LAYERS_N,
  linked: EVA_LINKED_N,
  spReaches: EVA_SP_REACHES,
  plan: EVA_PLAN_N,
};
// ST も通常時と同じ決まり（EVA_PLAN_S。値は暫定）
const EVA_SPEC_S = {
  pHit: EVA_S_HIT / EVA_BIT,
  classes: EVA_CLASSES_S,
  layers: EVA_LAYERS_S,
  linked: EVA_LINKED_S,
  spReaches: EVA_ST_SP,
  preMissReaches: ["tenpai"],
  plan: EVA_PLAN_S,
};
// 時短（チャンスタイム）中はストーリーリーチ（vsアルミサエル・vsサハクィエル）が大当り濃厚
// （なな徹 7335）。通常時の表をもとに、その 2 本の信頼度だけ 100% にした表を使う（ハズレ用の表に出ない）
const EVA_JITAN_SURE_REACHES = ["armisael", "sahaquiel"];
const EVA_SPEC_J = {
  ...EVA_SPEC_N,
  layers: EVA_LAYERS_N.map((L) =>
    L.isReach
      ? {
          ...L,
          states: L.states.map((s) =>
            EVA_JITAN_SURE_REACHES.includes(s.id) ? { ...s, trust: 100 } : s,
          ),
        }
      : L,
  ),
};
// 群予告の 400 回転ゲートがあるので通常時は 2 組
const EVA_T_N_LOW = evaBuildTables(EVA_SPEC_N, 0);
const EVA_T_N_HIGH = evaBuildTables(EVA_SPEC_N, 401);
const EVA_T_J = evaBuildTables(EVA_SPEC_J, 0);
const EVA_T_S = evaBuildTables(EVA_SPEC_S, 0);
// ST の高速区間（残り 163〜101 回転。ユーザー方針 2026-10-04）：リーチなしの当りを当りの 6% にした表。
// うち 1% は通常の突発当り、5% は無演出で 7・7・7 が左から順に止まる即当り（createEvaJob の instant777）
const EVA_ST_FAST_FROM = 101; // 消化する前の残り回転がこれ以上なら高速区間
const EVA_ST_INSTANT_SHARE = 0.05; // 無演出即当り（当りのうち）
const EVA_T_S_FAST = evaBuildTables(
  { ...EVA_SPEC_S, suddenShare: EVA_SUDDEN_SHARE + EVA_ST_INSTANT_SHARE },
  0,
);

// regime：確率の状態。"n"＝通常、"j"＝時短、"s"＝ST、"sf"＝ST の高速区間
function evaTablesFor(regime) {
  if (regime === "s") return EVA_T_S;
  if (regime === "sf") return EVA_T_S_FAST;
  if (regime === "j") return EVA_T_J;
  return currentRot > 400 ? EVA_T_N_HIGH : EVA_T_N_LOW;
}

// ヘソ（特図1）の当りの振り分け。確変を強制する演出（確変濃厚・シンクロ）なら 10R か 3R確変
function evaPickHesoKind(forced) {
  const n = Object.fromEntries(EVA_CLASSES_N.map((c) => [c.id, c.n]));
  const total = forced ? n.r10 + n.k3 : n.r10 + n.k3 + n.t3;
  const r = Math.random() * total;
  if (r < n.r10) return "r10";
  if (r < n.r10 + n.k3) return "k3";
  return "t3";
}

// 演出を液晶に出す段階：リーチ前（pre）・リーチ成立（reach）・リーチ後（post）。
// リーチ後予告の層は key が "after" で始まる（after・after-voice など）
const EVA_POST_LAYERS = [
  "mission-kind",
  // リーチ成立時の図柄送り・槍役物（SP リーチの回転だけ）
  "order",
  "lance",
  "cutin",
  "n-telop",
  "premovie",
  "gabure",
  "synchro-meter",
  "st-telop",
  "launch",
  "chanceup",
  "device",
  "shutter",
  "aori",
  "expect",
];
function evaPhaseOf(layer) {
  if (layer.isReach) return "reach";
  return layer.key.startsWith("after") || EVA_POST_LAYERS.includes(layer.key)
    ? "post"
    : "pre";
}

// 液晶に出す文字の色。state.color があればそれ、なければ演出名に入っている色から決める
// （CHANCE緑・赤テロップ・金シャッターなど。強い色を優先）
const EVA_TEXT_COLORS = [
  ["虹", "rainbow"],
  ["金", "gold"],
  ["朱", "vermilion"],
  ["赤", "red"],
  ["緑", "green"],
  ["青", "blue"],
  ["紫", "purple"],
  ["銀", "silver"],
];
function evaColorOf(state) {
  if (state.color) return state.color;
  const hit = EVA_TEXT_COLORS.find(([ch]) => state.name.includes(ch));
  return hit ? hit[1] : null;
}

// 当否の乱数の数（実機の大当り乱数と同じ 65536 個）
const EVA_LOTTERY = 65536;

// 全回転リーチのうち格納庫背景(四号機)を前段に見せる割合（見せ方だけ）
const EVA_HANGAR4_RATE = 0.2;

// 変化保留：青・緑・赤・虹の保留は入賞時は無地で、保留にいる間（先読み）か
// 消化を始めたとき（当該）に変わる。青・緑は横回転、赤・虹はロンギヌスの槍で切り替える。
// 通常の赤・虹は横回転で青か緑を挟む二段構えにもなり、ロンギヌスの槍保留変化は無地から槍で一気に変わる
// （見た目で区別できるように）。シフト変化は当該だけ。
const EVA_HOLD_CHANGE = ["blue", "green", "red", "rainbow"];
const EVA_HOLD_STOCK_RATE = 0.65; // 先読みで変わる割合（残りは当該で変わる）
// ST 中は先読みで変わるのは稀で、消化中（当該）に変わるのがほとんど（ユーザー指摘 2026-10-04）
const EVA_HOLD_STOCK_RATE_ST = 0.1;
const EVA_HOLD_TWO_STEP_RATE = 0.6; // 通常の赤・虹のうち青か緑を挟む割合
// ST の色の保留（シフト変化を除く）のうち、入るときの見た目をノイズ保留にする割合。変化してもノイズの模様のまま
// 色が付く（見せ方だけ。色ごとの信頼度は変わらない。ユーザー方針 2026-10-04）
const EVA_HOLD_NOISE_RATE_ST = 0.1;

// 返り値：{ seq：[{ view, fx: "spin"|"lance" }]（順に適用）, when："stock"|"current"|null, view：入賞時の見た目,
//   noise：ノイズ保留の見た目から変わる（ST） }。
// ST 中は必ず「変化」（立方体の横回転）を挟む（ユーザー方針 2026-10-04）：
//   通常保留 → 変化 → 青〜虹（1 段）／通常保留 → 変化 → 青か緑 → 槍 → 赤・虹（2 段。赤・虹の EVA_HOLD_TWO_STEP_RATE）。
//   槍でいきなり赤・虹になる流れは ST には無い
function evaHoldPlan(holdType, holdId, shift, regime) {
  if (!EVA_HOLD_CHANGE.includes(holdType)) {
    return { seq: [], when: null, view: holdType };
  }
  const st = regime === "s" || regime === "sf";
  const lance = holdType === "red" || holdType === "rainbow";
  const seq = [];
  const twoStep =
    lance &&
    !holdId.startsWith("lance") &&
    Math.random() < EVA_HOLD_TWO_STEP_RATE;
  if (twoStep) {
    seq.push({ view: Math.random() < 0.5 ? "blue" : "green", fx: "spin" });
  }
  // ST の 1 段の赤・虹は変化（横回転）で直接。それ以外の赤・虹は槍
  seq.push({
    view: holdType,
    fx: lance && (twoStep || !st) ? "lance" : "spin",
  });
  const stockRate = st ? EVA_HOLD_STOCK_RATE_ST : EVA_HOLD_STOCK_RATE;
  const when = shift || Math.random() >= stockRate ? "current" : "stock";
  const noise = st && !shift && Math.random() < EVA_HOLD_NOISE_RATE_ST;
  return { seq, when, view: noise ? "odd-noise" : "none", noise };
}

// デバッグ：指定した演出（force = { key：層の key, id：state.id }）を今の表から探す。
// 返り値 { L：層（リーチは reach）, si：層の中の番号, canHit / canMiss：当り用・ハズレ用の表に出られるか }。
// 今の表に無い演出（回転数の条件で外れているなど）は null
function evaFindForced(T, force) {
  if (!force) return null;
  const R = T.reach;
  if (force.key === "reach") {
    const si = R.states.findIndex((s) => s.id === force.id);
    if (si < 0) return null;
    return { L: R, si, canHit: R.hit[si] > 0, canMiss: R.miss[si] > 0 };
  }
  const L = T.layers.find(
    (l) => l.key === force.key && l.states.some((s) => s.id === force.id),
  );
  if (!L) return null;
  const si = L.states.findIndex((s) => s.id === force.id);
  const can = (probs, rows) =>
    R.states.some((_, r) => probs[r] > 0 && rows[r][si] > 0);
  return { L, si, canHit: can(R.hit, L.hit), canMiss: can(R.miss, L.miss) };
}

// 指定した演出が出た回の当りやすさ（当り用・ハズレ用の表での出現率から。check-b.cjs の「出た回」と同じ数え方）
function evaForcedHitRate(T, found) {
  const R = T.reach;
  let a = 0;
  let b = 0;
  if (found.L === R) {
    a = R.hit[found.si];
    b = R.miss[found.si];
  } else {
    R.states.forEach((_, r) => {
      a += R.hit[r] * found.L.hit[r][found.si];
      b += R.miss[r] * found.L.miss[r][found.si];
    });
  }
  const H = T.pHit * a;
  const M = (1 - T.pHit) * b;
  return H + M > 0 ? H / (H + M) : 0;
}

// 指定した演出が、決まった当否の表で出られるリーチの番号（evaDrawEffects の plan）
function evaForcePlan(T, found, isHit) {
  const R = T.reach;
  if (found.L === R) return { L: R, si: found.si, reaches: [found.si] };
  const probs = isHit ? R.hit : R.miss;
  const rows = isHit ? found.L.hit : found.L.miss;
  const reaches = R.states
    .map((_, r) => r)
    .filter((r) => probs[r] > 0 && rows[r][found.si] > 0);
  return reaches.length ? { L: found.L, si: found.si, reaches } : null;
}

// 指定したリーチの番号の中から、その表の出現率の比で 1 つ引く（デバッグ用）
function evaPickReachIn(probs, reaches) {
  const w = reaches.map((r) => probs[r]);
  const sum = w.reduce((a, b) => a + b, 0);
  let x = Math.random() * (sum > 0 ? sum : reaches.length);
  for (let k = 0; k < reaches.length; k++) {
    const wk = sum > 0 ? w[k] : 1;
    if (x < wk) return reaches[k];
    x -= wk;
  }
  return reaches[reaches.length - 1];
}

// 保留に居る間に見える演出の層（前兆・入賞時・保留の見た目・レバブル先読み）
function evaIsLeadLayer(L) {
  return !!L.lead || L.key === "hold";
}

// 層の中の次回予告（EVA_NEXT_MOVIE_IDS）の番号（層ごとに 1 回だけ数える）
function evaNextIdx(L) {
  if (!L._nextIdx) {
    L._nextIdx = L.states
      .map((s, i) => (EVA_NEXT_MOVIE_IDS.includes(s.id) ? i : -1))
      .filter((i) => i >= 0);
  }
  return L._nextIdx;
}

// 先読み・前兆の層の出る割合を 1/(1−q) 倍にする（次回予告の出なかった回だけで引くため）。
// 合計が 1 を超えたら 1 に収める（その分だけ出た回の当りやすさが表からずれる）
function evaBoostRow(row, q) {
  if (q <= 0 || q >= 1) return row;
  const out = row.slice();
  const last = out.length - 1;
  let sum = 0;
  for (let i = 0; i < last; i++) {
    out[i] /= 1 - q;
    sum += out[i];
  }
  if (sum > 1) {
    for (let i = 0; i < last; i++) out[i] /= sum;
    sum = 1;
  }
  out[last] = 1 - sum;
  return out;
}

// 当否の決まった表から演出の組合せを 1 つ引く（リーチ → 各層。層の中は 1 つ）。
// plan（evaForcePlan）があれば、その層はその演出に決め、リーチはその演出が出られるものから引く。
// noLead：保留に居る間に見える層を「なし」にする（抜けの残保留）。
// 次回予告はいきなり来る（ユーザー方針 2026-10-04）：次回予告の層を先に引き、出たら先読み・前兆の層
// （evaIsLeadLayer）を「なし」にする。出なかった回は先読み・前兆の出る割合を 1/(1−q) 倍
// （q：このリーチ・当否で次回予告が出る割合）にして、各演出の出た回の当りやすさを表のまま保つ。
// f：その組合せの事後確率（液晶に出す信頼度。上の引き方どおりの割合で数える）
function evaDrawEffects(T, isHit, plan, noLead) {
  const R = T.reach;
  const P = T.pHit;
  const rp =
    plan && plan.reaches
      ? { i: evaPickReachIn(isHit ? R.hit : R.miss, plan.reaches), no: -1 }
      : evaPickNo(isHit ? R.hit : R.miss);
  const r = rp.i;
  const reach = R.states[r];
  const shown = []; // [{ layer, state, no：その層で引いた番号（指定した演出は -1） }]
  let H = P * R.hit[r];
  let M = (1 - P) * R.miss[r];
  let reachPushed = false;
  const pushReach = () => {
    if (!reachPushed && reach.id !== "none")
      shown.push({ layer: R, state: reach, no: rp.no });
    reachPushed = true;
  };
  // 次回予告の層を先に引く（層は当否とリーチが決まれば互いに独立なので、引く順は割合を変えない）
  const nextPick = new Map();
  let nextShown = false;
  let keepH = 1; // このリーチで次回予告が出ない割合（当り用・ハズレ用）
  let keepM = 1;
  for (const L of T.layers) {
    const idx = evaNextIdx(L);
    if (!idx.length) continue;
    const p =
      plan && plan.L === L
        ? { i: plan.si, no: -1 }
        : evaPickNo((isHit ? L.hit : L.miss)[r]);
    nextPick.set(L, p);
    if (idx.includes(p.i)) nextShown = true;
    keepH *= 1 - idx.reduce((a, i) => a + L.hit[r][i], 0);
    keepM *= 1 - idx.reduce((a, i) => a + L.miss[r][i], 0);
  }
  // デバッグで先読み・前兆を指定したときは、そちらを出して次回予告を外す
  if (nextShown && plan && evaIsLeadLayer(plan.L)) {
    for (const [L, p] of nextPick) {
      if (evaNextIdx(L).includes(p.i))
        nextPick.set(L, { i: L.states.length - 1, no: -1 });
    }
    nextShown = false;
  }
  for (const L of T.layers) {
    // リーチ前の層 → リーチ → リーチに付く層の順に並べる（液晶の段の順）
    if (L.isLinked) pushReach();
    const none = L.states.length - 1;
    const lead = evaIsLeadLayer(L);
    let p;
    // 先読み・前兆の層の当り用・ハズレ用の割合（次回予告の出なかった回は 1/(1−q) 倍）
    let rowH = L.hit[r];
    let rowM = L.miss[r];
    if (nextPick.has(L)) p = nextPick.get(L);
    else if (plan && plan.L === L) p = { i: plan.si, no: -1 };
    else if (noLead && lead) p = { i: none, no: -1 };
    else if (lead && nextShown) {
      p = { i: none, no: -1 };
      rowH = rowM = null; // 次回予告が出たら必ず「なし」
    } else {
      if (lead) {
        rowH = evaBoostRow(rowH, 1 - keepH);
        rowM = evaBoostRow(rowM, 1 - keepM);
      }
      p = evaPickNo(isHit ? rowH : rowM);
    }
    if (rowH) {
      H *= rowH[p.i];
      M *= rowM[p.i];
    }
    const s = L.states[p.i];
    if (s.id !== "none") shown.push({ layer: L, state: s, no: p.no });
  }
  pushReach();
  const acc = evaSummarize(shown);
  const f = acc.sure ? 1 : H + M > 0 ? H / (H + M) : isHit ? 1 : 0;
  return { reach, shown, acc, f };
}

// 次回予告の演出（通常時・時短の 8 種と ST の新次回予告）。当該で出たら「予告」の画面と曲を流す
// （ユーザー方針 2026-10-03。出現率はそれぞれの表のまま）
const EVA_NEXT_MOVIE_IDS = [
  "next-rei",
  "next-asuka",
  "next-otoko",
  "next-namida",
  "next-kiseki",
  "next-air",
  "next-service",
  "next-kuroji",
  "next-preview",
  "next-last",
  "next-contra",
  "next-lamp-contra",
  "next-lamp-last",
  "next-voice-kitai",
  "next-voice-service",
];

// 抜けの残保留の当りで、濃厚が入るまで引き直す上限
const EVA_DRAW_MAX = 200000;

// opts.lotNo：入賞時に引いた当否の番号（判定し直すときは同じ番号を新しい範囲に当てる）
// opts.after：ST・時短が終わった後に消化される残保留（先読みを出さず、当りは必ずプレミア）
// opts.force：デバッグで演出を 1 つ指定して必ず出す（{ key, id }。evaFindForced）。
// opts.forceHit：デバッグで当否を決める（true＝当り・false＝ハズレ・省く＝ふだんどおり。
// 指定した演出が当り用・ハズレ用のどちらかにしか無ければ、それに合わせる）
function createEvaJob(isRight, regime, opts = {}) {
  let T = evaTablesFor(regime);
  let found = evaFindForced(T, opts.force);
  // 通常時の表は回転数で 2 組（群予告・レイ背景の条件）。今の表に無ければもう一方で引く
  if (opts.force && !found && regime === "n") {
    const other = T === EVA_T_N_LOW ? EVA_T_N_HIGH : EVA_T_N_LOW;
    const f2 = evaFindForced(other, opts.force);
    if (f2) {
      T = other;
      found = f2;
    }
  }
  // 実機と同じく、先に当否を引く：65536 個の番号から 1 つ。当り範囲は毎回同じ
  // （通常・時短 0〜204 の 205 個＝1/319.7、ST 0〜658 の 659 個＝1/99.4）
  const hitRange = Math.round(T.pHit * EVA_LOTTERY);
  let forceHit = opts.forceHit;
  if (found && !found.canMiss) forceHit = true;
  else if (found && !found.canHit) forceHit = false;
  // デバッグで演出を指定して当否を「信頼度どおり」にしたときは、その演出が出た回の当りやすさ（資料の信頼度）で
  // 当否を引く。ふだんの 1/319.7 で引いてから演出を乗せると、赤保留でもほとんど当たらない（ユーザー方針 2026-10-04）
  else if (found && forceHit === undefined && opts.lotNo === undefined)
    forceHit = Math.random() < evaForcedHitRate(T, found);
  const lotNo =
    opts.lotNo !== undefined
      ? opts.lotNo
      : forceHit === true
        ? Math.floor(Math.random() * hitRange)
        : forceHit === false
          ? hitRange + Math.floor(Math.random() * (EVA_LOTTERY - hitRange))
          : Math.floor(Math.random() * EVA_LOTTERY);
  const isHit = lotNo < hitRange;
  const plan = found ? evaForcePlan(T, found, isHit) : null;
  const after = !!opts.after;
  // 当否の表から演出を引く。抜けの残保留は先読みの層を出さず、当りは濃厚が入るまで引き直す
  let draw = evaDrawEffects(T, isHit, plan, after);
  for (
    let tries = 0;
    after && isHit && !draw.acc.sure && tries < EVA_DRAW_MAX;
    tries++
  ) {
    draw = evaDrawEffects(T, isHit, plan, after);
  }
  // ST の新次回予告は出ただけで当り（タイトルの後いきなり図柄が揃う）なので、リーチとリーチに付く演出
  // （リーチ・リーチ後の段）は出さない（ユーザー方針 2026-10-04）。デバッグでリーチ側を指定したときは除く
  const onReach = (L) => L === T.reach || L.isLinked || evaPhaseOf(L) !== "pre";
  const stNext =
    (regime === "s" || regime === "sf") &&
    draw.reach.id !== "none" &&
    draw.shown.some(({ state }) => EVA_NEXT_MOVIE_IDS.includes(state.id)) &&
    !(plan && onReach(plan.L));
  if (stNext) {
    const kept = draw.shown.filter(({ layer }) => !onReach(layer));
    draw = {
      ...draw,
      reach: T.reach.states.find((s) => s.id === "none"),
      shown: kept,
      acc: evaSummarize(kept),
    };
  }
  // キャラ連続の回は図柄拡大を出さない（キャラ連続は 3×3 の図柄で仮停止を見せる。ユーザー方針 2026-10-04）。
  // デバッグで図柄拡大を指定したときは除く
  const isZoom = (s) => s.zoom || s.zoomRed;
  if (
    draw.shown.some(({ state }) => state.chara) &&
    draw.shown.some(({ state }) => isZoom(state)) &&
    !(plan && isZoom(plan.L.states[plan.si]))
  ) {
    const kept = draw.shown.filter(({ state }) => !isZoom(state));
    draw = { ...draw, shown: kept, acc: evaSummarize(kept) };
  }
  const { reach, shown, acc, f } = draw;

  // 当り種別：全回転は 10R、確変濃厚の演出かシンクロ当りは 3R確変、他は逆算した比で
  let kind = null;
  if (isHit) {
    const hitClasses = T.spec.classes.filter((c) => c.hit);
    if (!isRight && regime !== "n") {
      // ST 中のヘソ保留（特図1）の当りはヘソの振り分け（10R確変 3%・3R確変 56%・3R通常 41%）
      kind = evaPickHesoKind(acc.forced);
    } else if (hitClasses.length === 1) kind = hitClasses[0].id;
    else if (reach.id === "zenkaiten") kind = "r10";
    else if (acc.forced) kind = "k3";
    else kind = Math.random() < T.k3Rate ? "k3" : "t3";
  }

  const name = [];
  let text = "";
  let holdType = "none";
  let shift = false; // シフト変化：保留にいる間は無地、当該になってから色が付く
  let vibe = false;
  let vibeColor = "none";
  const fx = []; // 液晶に付ける効果のクラス（style.css の fx-*）
  const steps = []; // 液晶に順番に出す文字（eva-reel.js が回転中に出す）
  let holdId = "";
  // 先読みの演出（保留に居る間の変動に出す段。script.js の scheduleLeads が変動に割り振る）
  const leads = [];
  // 保留に居る間に見える先読み（前兆・入賞時・保留の見た目）のうち一番高い信頼度。
  // 高速オートを保留が入った時点で低速に落とす判断に使う（当該で変わる保留は下で除く）
  let leadTrust = 0;
  let holdTrust = 0;
  let holdShake = false; // レバブル先読み：入賞から消化まで保留を震わせる
  for (const { layer, state } of shown) {
    name.push(state.name);
    if (state.holdShake) holdShake = true;
    if (layer.lead) leadTrust = Math.max(leadTrust, state.trust);
    if (layer.key === "hold") holdTrust = state.trust;
    if (state.holdType) {
      holdType = state.holdType;
      holdId = state.id;
    }
    if (state.shift) shift = true;
    if (layer.lead) {
      leads.push({
        kind: layer.lead,
        seq: state.lead || null,
        // 残り回数の違和感は文字を出さず「残り N」の表示だけ
        text: state.remain || state.mono ? "" : state.text || state.name,
        color: evaColorOf(state),
        voice: evaVoiceOf(state.text),
        spark: state.spark || null,
        remain: state.remain || null, // ST の残り回数の違和感（eva-reel.js の evaMarkRemain）
        noise: evaNoiseOf(state), // 文字に掛けるノイズ
        mono: state.mono || null, // 画面のモノクロ（変動音オフ。eva-reel.js の evaMono）
        fx: state.fx || null, // 先読みの段でも当該と同じ液晶の効果（ドックンの炎など）を出す
      });
    }
    // 入賞時の演出は入賞した変動で出すので、当該の段には入れない。
    // 文字の無い演出でも、液晶の見た目（stage：シャッター、spark：図柄のキラキラ）があれば段にする
    if (
      (state.text ||
        state.stage ||
        state.spark ||
        state.remain ||
        state.mono) &&
      layer.lead !== "entry"
    ) {
      if (state.text) text = text ? text + "\n" + state.text : state.text;
      steps.push({
        phase: evaPhaseOf(layer),
        text: state.text || "",
        color: evaColorOf(state),
        voice: evaVoiceOf(state.text), // eva-voice.js
        stage: state.stage || null, // eva-reel.js の evaPlayShutter
        spark: state.spark || null,
        remain: state.remain || null,
        noise: evaNoiseOf(state),
        mono: state.mono || null,
        bg: state.bg || null, // 液晶の背景の画像（格納庫など。eva-reel.js の evaSetBg）
        // 次回予告：図柄を消して「予告」の画面と曲（28 秒）→ 各予告のタイトル（eva-reel.js の evaPlayNextMovie）
        movie: EVA_NEXT_MOVIE_IDS.includes(state.id) ? "next" : null,
        // ST の新次回予告（濃厚）は、最後のタイトルの後いきなり図柄が揃う（リーチを経ない。ユーザー方針 2026-10-04）
        nextHit:
          (regime === "s" || regime === "sf") &&
          EVA_NEXT_MOVIE_IDS.includes(state.id) &&
          state.trust >= 100,
        // キャラ連続：キャラが出るたびに図柄が仮停止して擬似連のように続く（eva-reel.js の evaPlayChara）
        chara: state.chara || null,
        // 前兆（先読み系）の段は、図柄を隠してその演出の専用画面に切り替える（eva-reel.js）
        // 残り回数の違和感は左下の数字が変わるだけなので図柄は隠さない
        // モノクロも図柄を白黒にするだけなので隠さない
        takeover: layer.lead === "pre" && !state.remain && !state.mono,
        fx: layer.lead === "pre" ? state.fx || null : null,
      });
    }
    if (state.fx) fx.push(state.fx);
    // 液晶の揺れ（vibe）は当該レバブルのときだけ
    if (layer.key === "lever") {
      vibe = true;
      vibeColor = state.vibeColor;
    }
  }
  // 保留が無地で当該レバブルが出たときだけ「レバブル保留」に表示を格上げする（抽選には影響しない）。
  // 抜けの残保留は保留の見た目を変えない（先読みなし）
  if (holdType === "none" && vibe && !after) {
    holdType = "vibe";
    name.unshift("レバブル保留");
  }
  // 格納庫背景(四号機)は 10R確変濃厚。通常時の 10R はすべて全回転リーチなので、
  // 全回転リーチの一部にだけ前段として見せる（抽選には影響しない）
  if (
    reach.id === "zenkaiten" &&
    regime === "n" &&
    Math.random() < EVA_HANGAR4_RATE
  ) {
    name.unshift("格納庫背景(四号機)");
    text = text ? "格納庫\n四号機\n" + text : "格納庫\n四号機";
    steps.unshift({ phase: "pre", text: "格納庫\n四号機", bg: "hangar-4" });
  }
  // ST の高速区間のリーチなしの当り（当りの 6%）のうち 5% 分は、無演出で 7・7・7 が左から順に止まる即当り
  // （eva-reel.js。告知も文字もなし。ユーザー方針 2026-10-04）
  let instant777 = false;
  if (
    isHit &&
    !acc.any &&
    reach.id === "none" &&
    regime === "sf" &&
    Math.random() <
      EVA_ST_INSTANT_SHARE / (EVA_ST_INSTANT_SHARE + EVA_SUDDEN_SHARE)
  ) {
    instant777 = true;
    name.push("無演出即当り(777)");
  } else if (isHit && !acc.any) {
    // 演出なしの当りは突発当り（初号機が画面を引き裂いて告知）
    name.push("突発当り");
    text = "突発当り";
    steps.push({ phase: "post", text: "突発当り" });
    fx.push("fx-tear");
  }

  // 保留の色が変わる流れ（見せ方だけ。当否と holdType はもう決まっている）
  const hold = evaHoldPlan(holdType, holdId, shift, regime);
  if (hold.noise) name.push("ノイズ保留から変化");
  // 当該で変わる保留（シフト変化・当該変化）は保留に居る間は無地なので先読みに数えない
  const preTrust = Math.max(leadTrust, hold.when === "current" ? 0 : holdTrust);

  let sure = null;
  if (acc.sure) {
    sure =
      acc.sureKind === "r10"
        ? "10R確変濃厚"
        : acc.sureKind === "kaku"
          ? "確変濃厚"
          : "大当り濃厚";
  }

  let hitDigit = null;
  let upgrade = false;
  if (isHit) {
    // 全回転リーチは ST 中でも 7 で止める（液晶で 1 周して 7 で止まる演出。eva-reel.js）
    if (reach.id === "zenkaiten" || instant777) hitDigit = 7;
    else if (isRight && regime !== "n") hitDigit = Math.random() < 0.5 ? 3 : 1;
    else if (kind === "r10") hitDigit = 7;
    else if (kind === "k3") {
      // 偶数図柄からの昇格演出は通常時のヘソ当りだけ（電サポ中の当りは確変図柄で見せる）
      upgrade = regime === "n" && Math.random() < EVA_UPGRADE_RATE;
      hitDigit = upgrade
        ? [2, 4, 6, 8][Math.floor(Math.random() * 4)]
        : [1, 3, 5, 9][Math.floor(Math.random() * 4)];
    } else hitDigit = [2, 4, 6, 8][Math.floor(Math.random() * 4)];
  }

  return {
    isHit,
    isRight,
    heavy: false,
    name,
    // 液晶に出す信頼度：出た組合せの事後確率（表示と実際の当りやすさが一致する）
    trust: acc.any ? f * 100 : 0,
    // 出た演出の資料の信頼度の最大（ログの「信頼度 50% 以上」はこちらで判断して出す。組合せの事後確率は
    // 演出が多く重なるハズレで数 % 以下まで下がり、50% 以上のハズレがログにほぼ出なくなっていた。ユーザー指摘 2026-10-04）
    maxTrust: Math.max(
      0,
      ...shown.map(({ state }) => Math.min(100, state.trust)),
    ),
    sure,
    instant777, // ST の高速区間の無演出即当り（eva-reel.js で 7 を左から順に止める）
    effects: shown.map(({ state, no }) => ({
      name: state.name,
      trust: state.trust,
      no, // その層で引いた演出の番号（0〜1048575）
    })),
    vibe,
    vibeColor,
    fx,
    steps,
    flash: false,
    text,
    holdType,
    currentView: hold.view,
    holdSeq: hold.seq,
    holdWhen: hold.when,
    holdNoise: !!hold.noise, // ノイズ保留の見た目から変わり、色が付いてもノイズの模様のまま（style.css の .heso-noisy）
    holdStep: 0,
    leads,
    leadPlan: null,
    preTrust,
    holdShake,
    // 図柄拡大：3×3 をやめて縦長の 1×1 で回す（"red" は赤の図柄拡大）
    zoom: shown.some(({ state }) => state.zoomRed)
      ? "red"
      : shown.some(({ state }) => state.zoom)
        ? "on"
        : null,
    lotNo, // 当否で引いた番号（0〜65535）
    hitRange, // 当り範囲の数（0〜hitRange-1 が当り）
    after, // ST・時短が終わった後に消化される残保留（先読みなし）
    notice: evaNoticeOf(shown), // 一発告知音（eva-voice.js）。保留を消化した瞬間に鳴らす
    // SP リーチ（全回転を含む）：SP に発展したら当該保留を消す
    sp: reach.id === "zenkaiten" || T.spec.spReaches.includes(reach.id),
    isRushSure: false,
    bonusType: null,
    deferHitLog: false,
    saibare: false,
    regime,
    forced: plan ? plan.L.states[plan.si].name : null, // デバッグで指定して出した演出
    kind,
    hitDigit,
    upgrade,
    reachId: reach.id,
    tenpai: reach.id !== "none",
  };
}
