/* --- EVA15風 抽選エンジン --- */

// ============================================================
// 1回転を「リーチ → 予告の層（層の中は排他）」の順に引いて、出た演出を先に決め、
// その組合せの信頼度 f で当否を引く（ユーザー方針 2026-10-03）。
//   f = 出た演出の信頼度（記事の値）の最大
//       ただし「数える演出」が 2 つ重なれば最低 80%、3 つ以上なら 100%（大当り濃厚）
//       信頼度 100% の演出が出れば 100%
// 表示の信頼度は f そのもの＝その回転の本当の当りやすさ。
// 数える演出は信頼度 EVA_COMBO_MIN_TRUST 以上の高信頼度の予告とリーチだけ（ユーザー方針：
// 60% の演出 2 つなら 80%、レバブルと 30% の演出ならレバブルの信頼度のまま）。リーチに必ず付く部品
// （ST の入力デバイス・SP 発展・シャッター：層の component）は max には使うが数えない。
//
// 当り確率（通常 1/319.688・ST 1/99.448）を固定するため、読み込み時に出現率を校正する：
// 信頼度 100% 未満の演出の出現率を係数 alpha で縮め、残りを無演出当り（突発当り）に回す。
// 信頼度 100% の演出（全回転・一発告知）と fixed の演出（当該レバブル）は縮めない。
// 期待値は層の独立性を使って厳密に数え上げる（乱数で回さない）。
// 旧方式（2^20 の整数テーブル＋事後確率表示）は、この規則と両立しないため廃止した。
// ============================================================

const EVA_COMBO_MIN_TRUST = 50; // 「2 つ以上」で数える高信頼度の演出の下限（%）
const EVA_COMBO2_FLOOR = 80; // 2 つ重なったときの最低信頼度（%）
const EVA_SUDDEN_SHARE = 0.03; // 無演出当り（突発当り）に回す当りの割合の目安

const EVA_NONE = { id: "none", name: "なし" };

function evaF(k, maxT, sure) {
  if (sure || k >= 3) return 1;
  if (k === 2) return Math.max(maxT, EVA_COMBO2_FLOOR) / 100;
  return maxT / 100;
}

function evaCounted(layer, s) {
  return !layer.component && s.trust >= EVA_COMBO_MIN_TRUST;
}

// 「確変濃厚」「10R確変濃厚」の判定（only で当り種別を絞った 100% の演出）
function evaSureKind(s) {
  if (!(s.trust >= 100) || !s.only) return null;
  if (s.only.every((id) => id === "r10")) return "r10";
  if (s.only.every((id) => EVA_KAKUHEN.includes(id))) return "kaku";
  return null;
}

// 層の各状態の出現率。share は「単独で出たとき当りの何%を占めるか」の重み、
// rate はリーチが決まった後の出現率（部品の層）
function evaFreq(s, pHit, alpha) {
  const base = ((s.share / 100) * pHit) / (s.trust / 100);
  return s.trust >= 100 || s.fixed ? base : base * alpha;
}

function evaBuildTables(spec, rot, alpha) {
  const pHit = spec.pHit;
  const active = (layer) =>
    layer.states.filter((s) => !s.minRot || rot >= s.minRot);
  const free = spec.layers.map((layer) => {
    const states = active(layer);
    const probs = states.map((s) => evaFreq(s, pHit, alpha));
    const none = 1 - probs.reduce((a, b) => a + b, 0);
    if (none < 0)
      throw new Error(`${layer.label}: 出現率の合計が 1 を超えています`);
    return {
      key: layer.key,
      label: layer.label,
      isReach: !!layer.isReach,
      component: !!layer.component,
      states: [...states, EVA_NONE],
      probs: [...probs, none],
    };
  });
  const reach = free.find((l) => l.isReach);
  const linked = spec.linked.map((layer) => {
    const states = active(layer);
    const probsByReach = reach.states.map((rs, r) => {
      const probs = states.map((s) => {
        const reaches = s.reaches || layer.reaches;
        if (!reaches.includes(rs.id)) return 0;
        if (s.rate !== undefined) {
          return typeof s.rate === "number" ? s.rate : s.rate[rs.id] || 0;
        }
        // share 指定：対象リーチ全体に同じ率で乗せ、単独での当り寄与が share になるようにする
        const pSet = reach.states.reduce(
          (sum, x, i) => (reaches.includes(x.id) ? sum + reach.probs[i] : sum),
          0,
        );
        return pSet > 0 ? evaFreq(s, pHit, alpha) / pSet : 0;
      });
      const none = 1 - probs.reduce((a, b) => a + b, 0);
      if (none < -1e-12) {
        throw new Error(
          `${layer.label}: ${rs.name} の出現率の合計が 1 を超えています`,
        );
      }
      return [...probs, Math.max(0, none)];
    });
    return {
      key: layer.key,
      label: layer.label,
      component: !!layer.component,
      states: [...states, EVA_NONE],
      probsByReach,
    };
  });
  return { pHit, spec, free, reach, linked, alpha };
}

// 出た演出の組合せを要約する（引くときも数え上げるときも同じ規則を使う）
function evaStep(acc, layer, s) {
  if (s.id === "none") return acc;
  const sureKind = evaSureKind(s);
  return {
    any: true,
    k: Math.min(3, acc.k + (evaCounted(layer, s) ? 1 : 0)),
    maxT: Math.max(acc.maxT, s.trust),
    sure: acc.sure || s.trust >= 100,
    sureKind:
      acc.sureKind === "r10" || sureKind === "r10"
        ? "r10"
        : acc.sureKind || sureKind,
    forced: acc.forced || !!sureKind || !!s.forceKakuhen,
  };
}
const EVA_EMPTY = {
  any: false,
  k: 0,
  maxT: 0,
  sure: false,
  sureKind: null,
  forced: false,
};

// 全回転の当り・確変を強制する当り・演出ありの当りの期待値を厳密に数え上げる
function evaExpect(T) {
  const out = { effect: 0, none: 0, forced: 0, r10: 0 };
  const others = T.free.filter((l) => !l.isReach);
  T.reach.states.forEach((rs, r) => {
    const pr = T.reach.probs[r];
    if (pr <= 0) return;
    // 状態を数値のキーにまとめる（f に効く情報だけ残す）
    let dist = new Map();
    const put = (m, acc, p) => {
      const sure = acc.sure || acc.k >= 3;
      const t = sure ? 1000 : Math.round(acc.maxT * 10);
      const key = [acc.any, sure ? 3 : acc.k, t, acc.sureKind, acc.forced].join(
        "|",
      );
      const cur = m.get(key);
      if (cur) cur.p += p;
      else m.set(key, { acc: { ...acc, sure }, p });
    };
    put(dist, evaStep(EVA_EMPTY, T.reach, rs), pr);
    const layers = [
      ...others.map((L) => ({ L, probs: L.probs })),
      ...T.linked.map((L) => ({ L, probs: L.probsByReach[r] })),
    ];
    for (const { L, probs } of layers) {
      const next = new Map();
      for (const { acc, p } of dist.values()) {
        L.states.forEach((s, i) => {
          if (probs[i] > 0) put(next, evaStep(acc, L, s), p * probs[i]);
        });
      }
      dist = next;
    }
    for (const { acc, p } of dist.values()) {
      if (!acc.any) {
        out.none += p;
        continue;
      }
      const f = evaF(acc.k, acc.maxT, acc.sure);
      out.effect += p * f;
      if (rs.id === "zenkaiten") out.r10 += p * f;
      else if (acc.forced) out.forced += p * f;
    }
  });
  return out;
}

// 当り確率が仕様どおりになるよう alpha を決め、無演出当りの確率と 3R確変の比を出す
function evaCalibrate(spec, rot) {
  const target = spec.pHit * (1 - EVA_SUDDEN_SHARE);
  let alpha = 1;
  let T = evaBuildTables(spec, rot, alpha);
  let E = evaExpect(T);
  if (E.effect > target) {
    const fixed = evaExpect(evaBuildTables(spec, rot, 0)).effect;
    for (
      let i = 0;
      i < 12 && Math.abs(E.effect - target) > target * 1e-4;
      i++
    ) {
      alpha *= (target - fixed) / (E.effect - fixed);
      T = evaBuildTables(spec, rot, alpha);
      E = evaExpect(T);
    }
  }
  const base0 = (spec.pHit - E.effect) / E.none;
  if (base0 < 0) throw new Error("無演出当りの確率が負になりました");
  // 3R確変の比：全回転（10R）と確変を強制した当りを差し引いた残りで逆算する
  const hitN = spec.classes.filter((c) => c.hit);
  const nHit = hitN.reduce((s, c) => s + c.n, 0);
  const k3 = hitN.find((c) => c.id === "k3");
  let k3Rate = 0;
  if (k3) {
    const k3Target = (spec.pHit * k3.n) / nHit;
    k3Rate = (k3Target - E.forced) / (spec.pHit - E.r10 - E.forced);
    if (k3Rate < 0 || k3Rate > 1) throw new Error("3R確変の比が範囲外です");
  }
  return { ...T, base0, k3Rate, expect: E };
}

function evaPick(probs) {
  let r = Math.random();
  for (let i = 0; i < probs.length - 1; i++) {
    if (r < probs[i]) return i;
    r -= probs[i];
  }
  return probs.length - 1;
}

const EVA_SPEC_N = {
  pHit: EVA_N_HIT / EVA_BIT,
  classes: EVA_CLASSES_N,
  layers: EVA_LAYERS_N,
  linked: EVA_LINKED_N,
};
const EVA_SPEC_S = {
  pHit: EVA_S_HIT / EVA_BIT,
  classes: EVA_CLASSES_S,
  layers: EVA_LAYERS_S,
  linked: EVA_LINKED_S,
};
// 群予告の 400 回転ゲートがあるので通常時は 2 組
const EVA_T_N_LOW = evaCalibrate(EVA_SPEC_N, 0);
const EVA_T_N_HIGH = evaCalibrate(EVA_SPEC_N, 401);
const EVA_T_S = evaCalibrate(EVA_SPEC_S, 0);

function evaTablesFor(regime) {
  if (regime !== "n") return EVA_T_S;
  return currentRot > 400 ? EVA_T_N_HIGH : EVA_T_N_LOW;
}

function createEvaJob(isRight, regime) {
  const T = evaTablesFor(regime);
  const r = evaPick(T.reach.probs);
  const reach = T.reach.states[r];
  const shown = []; // [{ layer, state }]
  for (const L of T.free) {
    const s = L.isReach ? reach : L.states[evaPick(L.probs)];
    if (s.id !== "none") shown.push({ layer: L, state: s });
  }
  for (const L of T.linked) {
    const s = L.states[evaPick(L.probsByReach[r])];
    if (s.id !== "none") shown.push({ layer: L, state: s });
  }
  let acc = EVA_EMPTY;
  for (const { layer, state } of shown) acc = evaStep(acc, layer, state);
  const f = acc.any ? evaF(acc.k, acc.maxT, acc.sure) : T.base0;
  const isHit = Math.random() < f;

  // 当り種別：全回転は 10R、確変濃厚の演出かシンクロ当りは 3R確変、他は逆算した比で
  let kind = null;
  if (isHit) {
    const hitClasses = T.spec.classes.filter((c) => c.hit);
    if (hitClasses.length === 1) kind = hitClasses[0].id;
    else if (reach.id === "zenkaiten") kind = "r10";
    else if (acc.forced) kind = "k3";
    else kind = Math.random() < T.k3Rate ? "k3" : "t3";
  }

  const name = [];
  let text = "";
  let holdType = "none";
  let vibe = false;
  let vibeColor = "none";
  for (const { layer, state } of shown) {
    name.push(state.name);
    if (state.holdType) holdType = state.holdType;
    if (state.text) text = text ? text + "\n" + state.text : state.text;
    // 液晶の揺れ（vibe）は当該レバブルのときだけ
    if (layer.key === "lever") {
      vibe = true;
      vibeColor = state.vibeColor;
    }
  }
  // 保留が無地で当該レバブルが出たときだけ「レバブル保留」に表示を格上げする（抽選には影響しない）
  if (holdType === "none" && vibe) {
    holdType = "vibe";
    name.unshift("レバブル保留");
  }

  let sure = null;
  if (acc.any && f >= 1) {
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
    if (regime !== "n") hitDigit = Math.random() < 0.5 ? 3 : 1;
    else if (kind === "r10") hitDigit = 7;
    else if (kind === "k3") {
      upgrade = Math.random() < EVA_UPGRADE_RATE;
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
    trust: acc.any ? f * 100 : 0,
    sure,
    effects: shown.map(({ layer, state }) => ({
      name: state.name,
      trust: state.trust,
      counted: evaCounted(layer, state),
    })),
    vibe,
    vibeColor,
    flash: false,
    text,
    holdType,
    currentView: holdType,
    isRushSure: false,
    bonusType: null,
    deferHitLog: false,
    saibare: false,
    regime,
    kind,
    hitDigit,
    upgrade,
    reachId: reach.id,
    tenpai: reach.id !== "none",
  };
}

// ハズレ図柄：リーチがかかった回転だけ左右を揃える
function evaMissDigits(tenpai) {
  const d1 = Math.floor(Math.random() * 9) + 1;
  let d2 = Math.floor(Math.random() * 9) + 1;
  let d3 = Math.floor(Math.random() * 9) + 1;
  if (tenpai) {
    d3 = d1;
    while (d2 === d1) d2 = Math.floor(Math.random() * 9) + 1;
  } else {
    while (d3 === d1) d3 = Math.floor(Math.random() * 9) + 1;
  }
  return [d1, d2, d3];
}
