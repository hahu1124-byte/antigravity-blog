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
const EVA_ALPHA_MAX = 4; // 出現率の係数の上限（広げすぎて出現率の合計が 1 を超えないように）

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

// spBoost の層：SP リーチの回転では spBoost 倍出やすくする（実機の予告は SP リーチに乗って来ることが多い）。
// 予告とリーチが同じ回転に重なるので当りの枠を共有でき、リーチも予告もそれなりの頻度で出せる。
// 全体の出現率は share から決まる値のまま。リーチが決まった後に引くので linked と同じ形にする
// 弱い演出（信頼度 EVA_BOOST_MIN_TRUST 未満：点滅・青保留など）はどの回転でも出るので寄せない
const EVA_BOOST_MIN_TRUST = 20;
// 信頼度がこれ以上（100% 未満）の予告・保留は SP リーチの回転にしか出さない。
// 赤保留やカウントダウンがリーチ無しのハズレで終わる（何も起きない）のを防ぐ（ユーザー指摘 2026-10-03）。
// 100% の演出（一発告知など）はリーチ無しの突発当りでも出るので対象外。
// 当該レバブル（fixed：当りの約 3 割に出す）も、SP だけに寄せると枠が足りないので対象外
const EVA_SP_ONLY_TRUST = 50;

function evaBoostedLayer(layer, states, reach, spReaches, pHit, alpha) {
  const isSp = reach.states.map((rs) => spReaches.includes(rs.id));
  const pSp = reach.probs.reduce((sum, p, i) => (isSp[i] ? sum + p : sum), 0);
  const spOnly = states.map(
    (s) => s.trust >= EVA_SP_ONLY_TRUST && s.trust < 100 && !s.fixed,
  );
  const ks = states.map((s) =>
    s.trust >= EVA_BOOST_MIN_TRUST ? layer.spBoost : 1,
  );
  // reaches を持つ状態は、そのリーチの回転だけに全部を乗せる（予告→発展先の対応。
  // 群予告レイなら零号機リーチだけ、など）。全体の出現率は share から決まる値のまま
  const pOf = (ids) =>
    reach.probs.reduce(
      (sum, p, i) => (ids.includes(reach.states[i].id) ? sum + p : sum),
      0,
    );
  const pSet = states.map((s) => (s.reaches ? pOf(s.reaches) : 0));
  // SP 限定の状態は SP の回転だけに全部を乗せる（全体の出現率は share から決まる値のまま）
  const base = states.map((s, i) =>
    s.reaches
      ? pSet[i] > 0
        ? evaFreq(s, pHit, alpha) / pSet[i]
        : 0
      : spOnly[i]
        ? pSp > 0
          ? evaFreq(s, pHit, alpha) / pSp
          : 0
        : evaFreq(s, pHit, alpha) / (1 - pSp + ks[i] * pSp),
  );
  const probsByReach = reach.states.map((rs, r) => {
    const probs = base.map((b, i) =>
      states[i].reaches
        ? states[i].reaches.includes(rs.id)
          ? b
          : 0
        : spOnly[i]
          ? isSp[r]
            ? b
            : 0
          : isSp[r]
            ? b * ks[i]
            : b,
    );
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
    lead: layer.lead || null,
    states: [...states, EVA_NONE],
    probsByReach,
  };
}

function evaBuildTables(spec, rot, alpha) {
  const pHit = spec.pHit;
  // minRot / maxRot：出せる回転数の範囲（群予告は 401 回転から、レイ背景は 400 回転まで）
  const active = (layer) =>
    layer.states.filter(
      (s) => (!s.minRot || rot >= s.minRot) && (!s.maxRot || rot <= s.maxRot),
    );
  const free = spec.layers
    .filter((layer) => !layer.spBoost)
    .map((layer) => {
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
        lead: layer.lead || null,
        states: [...states, EVA_NONE],
        probs: [...probs, none],
      };
    });
  const reach = free.find((l) => l.isReach);
  const boosted = spec.layers
    .filter((layer) => layer.spBoost)
    .map((layer) =>
      evaBoostedLayer(layer, active(layer), reach, spec.spReaches, pHit, alpha),
    );
  const linkedOwn = spec.linked.map((layer) => {
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
  const linked = [...boosted, ...linkedOwn];
  return { pHit, spec, free, reach, linked, alpha };
}

// 各演出の 1 回転あたりの出現率（試験と調整用の一覧）
function evaStateFreqs(T) {
  const rows = [];
  for (const L of T.free) {
    L.states.forEach((s, i) => {
      if (s.id !== "none") rows.push({ layer: L, state: s, freq: L.probs[i] });
    });
  }
  for (const L of T.linked) {
    L.states.forEach((s, i) => {
      if (s.id === "none") return;
      const freq = T.reach.probs.reduce(
        (sum, p, r) => sum + p * L.probsByReach[r][i],
        0,
      );
      rows.push({ layer: L, state: s, freq });
    });
  }
  return rows;
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
  // alpha は縮めるだけでなく広げもする（余った枠を突発当りに回しすぎないため。上限 EVA_ALPHA_MAX）
  let alpha = 1;
  let T = evaBuildTables(spec, rot, alpha);
  let E = evaExpect(T);
  // alpha で縮まない分（100%・fixed の演出）。SP 限定の演出は alpha=0 で SP の回転ごと消える（出現率 0 で正しい）
  const fixed = evaExpect(evaBuildTables(spec, rot, 0)).effect;
  for (let i = 0; i < 12 && Math.abs(E.effect - target) > target * 1e-4; i++) {
    const next = Math.min(
      EVA_ALPHA_MAX,
      alpha * ((target - fixed) / (E.effect - fixed)),
    );
    if (next === alpha) break;
    alpha = next;
    T = evaBuildTables(spec, rot, alpha);
    E = evaExpect(T);
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
  return evaPickNo(probs).i;
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
};
const EVA_SPEC_S = {
  pHit: EVA_S_HIT / EVA_BIT,
  classes: EVA_CLASSES_S,
  layers: EVA_LAYERS_S,
  linked: EVA_LINKED_S,
  spReaches: EVA_ST_SP,
};
// 時短（チャンスタイム）中はストーリーリーチ（vsアルミサエル・vsサハクィエル）が大当り濃厚
// （なな徹 7335）。通常時の表をもとに、その 2 本の信頼度だけ 100% にした表を使う
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
const EVA_T_N_LOW = evaCalibrate(EVA_SPEC_N, 0);
const EVA_T_N_HIGH = evaCalibrate(EVA_SPEC_N, 401);
const EVA_T_J = evaCalibrate(EVA_SPEC_J, 0);
const EVA_T_S = evaCalibrate(EVA_SPEC_S, 0);

// regime：確率の状態。"n"＝通常、"j"＝時短、"s"＝ST
function evaTablesFor(regime) {
  if (regime === "s") return EVA_T_S;
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
const EVA_HOLD_TWO_STEP_RATE = 0.6; // 通常の赤・虹のうち青か緑を挟む割合

// 返り値：{ seq：[{ view, fx: "spin"|"lance" }]（順に適用）, when："stock"|"current"|null, view：入賞時の見た目 }
function evaHoldPlan(holdType, holdId, shift) {
  if (!EVA_HOLD_CHANGE.includes(holdType)) {
    return { seq: [], when: null, view: holdType };
  }
  const lance = holdType === "red" || holdType === "rainbow";
  const seq = [];
  if (
    lance &&
    !holdId.startsWith("lance") &&
    Math.random() < EVA_HOLD_TWO_STEP_RATE
  ) {
    seq.push({ view: Math.random() < 0.5 ? "blue" : "green", fx: "spin" });
  }
  seq.push({ view: holdType, fx: lance ? "lance" : "spin" });
  const when =
    shift || Math.random() >= EVA_HOLD_STOCK_RATE ? "current" : "stock";
  return { seq, when, view: "none" };
}

// デバッグ：演出を 1 つ指定して必ず出す（force = { key：層の key, id：state.id }）。
// 返り値 { L：その層, si：層の中の番号, reaches：出られるリーチの番号（null はどのリーチでも） }。
// 今の表に無い演出（回転数の条件で外れているなど）は null
function evaForcePlan(T, force) {
  if (!force) return null;
  const L = [...T.free, ...T.linked].find(
    (l) => l.key === force.key && l.states.some((s) => s.id === force.id),
  );
  if (!L) return null;
  const si = L.states.findIndex((s) => s.id === force.id);
  let reaches = null;
  if (L.isReach) reaches = [si];
  else if (L.probsByReach) {
    reaches = T.reach.states
      .map((_, r) => r)
      .filter((r) => L.probsByReach[r][si] > 0);
    if (!reaches.length) return null;
  }
  return { L, si, reaches };
}

// 指定したリーチの番号の中から、ふだんの出現率の比で 1 つ引く（デバッグ用）
function evaPickReachIn(T, reaches) {
  const w = reaches.map((r) => T.reach.probs[r]);
  const sum = w.reduce((a, b) => a + b, 0);
  let x = Math.random() * (sum > 0 ? sum : reaches.length);
  for (let k = 0; k < reaches.length; k++) {
    const wk = sum > 0 ? w[k] : 1;
    if (x < wk) return reaches[k];
    x -= wk;
  }
  return reaches[reaches.length - 1];
}

// 演出の組合せを 1 つ引く（層ごとに 1 つ。リーチに紐づく層はリーチで出方が変わる）。
// plan（evaForcePlan）があれば、その層はその演出に決め、リーチはその演出が出られるものから引く
function evaDrawEffects(T, plan) {
  const rp =
    plan && plan.reaches
      ? { i: evaPickReachIn(T, plan.reaches), no: -1 }
      : evaPickNo(T.reach.probs);
  const r = rp.i;
  const reach = T.reach.states[r];
  const shown = []; // [{ layer, state, no：その層で引いた番号（指定した演出は -1） }]
  const pickIn = (L, probs) =>
    plan && plan.L === L ? { i: plan.si, no: -1 } : evaPickNo(probs);
  for (const L of T.free) {
    const p = L.isReach ? rp : pickIn(L, L.probs);
    const s = L.states[p.i];
    if (s.id !== "none") shown.push({ layer: L, state: s, no: p.no });
  }
  for (const L of T.linked) {
    const p = pickIn(L, L.probsByReach[r]);
    const s = L.states[p.i];
    if (s.id !== "none") shown.push({ layer: L, state: s, no: p.no });
  }
  let acc = EVA_EMPTY;
  for (const { layer, state } of shown) acc = evaStep(acc, layer, state);
  const f = acc.any ? evaF(acc.k, acc.maxT, acc.sure) : T.base0;
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
];

// 当否が決まった後に演出を選ぶときの引き直しの上限（当りでも平均 320 回ほどで決まる）
const EVA_DRAW_MAX = 200000;

// 保留に居る間に見える演出（前兆・入賞時・保留の見た目・レバブル先読みの震え）
function evaIsLeadEffect(layer, state) {
  return !!layer.lead || layer.key === "hold" || !!state.holdShake;
}

// opts.lotNo：入賞時に引いた当否の番号（判定し直すときは同じ番号を新しい範囲に当てる）
// opts.after：ST・時短が終わった後に消化される残保留（先読みを出さず、当りは必ずプレミア）
// opts.force：デバッグで演出を 1 つ指定して必ず出す（{ key, id }。evaForcePlan）。
// opts.forceHit：デバッグで当否を決める（true＝当り・false＝ハズレ・省く＝ふだんどおり。
// 信頼度 100% の演出を指定したときは当り）
function createEvaJob(isRight, regime, opts = {}) {
  let T = evaTablesFor(regime);
  let plan = evaForcePlan(T, opts.force);
  // 通常時の表は回転数で 2 組（群予告・レイ背景の条件）。今の表に無ければもう一方で引く
  if (opts.force && !plan && regime === "n") {
    const other = T === EVA_T_N_LOW ? EVA_T_N_HIGH : EVA_T_N_LOW;
    const p2 = evaForcePlan(other, opts.force);
    if (p2) {
      T = other;
      plan = p2;
    }
  }
  // 実機と同じく、先に当否を引く：65536 個の番号から 1 つ。当り範囲は毎回同じ
  // （通常・時短 0〜204 の 205 個＝1/319.7、ST 0〜658 の 659 個＝1/99.4）
  const hitRange = Math.round(T.pHit * EVA_LOTTERY);
  const forceHit =
    plan && plan.L.states[plan.si].trust >= 100 ? true : opts.forceHit;
  const lotNo =
    opts.lotNo !== undefined
      ? opts.lotNo
      : forceHit === true
        ? Math.floor(Math.random() * hitRange)
        : forceHit === false
          ? hitRange + Math.floor(Math.random() * (EVA_LOTTERY - hitRange))
          : Math.floor(Math.random() * EVA_LOTTERY);
  const isHit = lotNo < hitRange;
  const after = !!opts.after;
  // 当否が決まってから演出を選ぶ：演出の組合せを引き、その組合せの信頼度で当るかを試し、
  // 決まった当否と同じ結果になった組合せを使う。演出ごとの「出たら何%当るか」（信頼度）は
  // そのまま保たれる（当りなら当りのときの出方、ハズレならハズレのときの出方から選ぶのと同じ）。
  // 抜けの残保留は、先読みの付かない組合せだけを使い、当りなら信頼度 100% の演出を含むものだけにする
  let draw;
  for (let tries = 0; tries < EVA_DRAW_MAX; tries++) {
    draw = evaDrawEffects(T, plan);
    if (Math.random() < draw.f !== isHit) continue;
    if (after) {
      if (draw.shown.some(({ layer, state }) => evaIsLeadEffect(layer, state)))
        continue;
      if (isHit && !draw.acc.sure) continue;
    }
    break;
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
        text: state.text || state.name,
        color: evaColorOf(state),
        voice: evaVoiceOf(state.text),
        spark: state.spark || null,
        fx: state.fx || null, // 先読みの段でも当該と同じ液晶の効果（ドックンの炎など）を出す
      });
    }
    // 入賞時の演出は入賞した変動で出すので、当該の段には入れない。
    // 文字の無い演出でも、液晶の見た目（stage：シャッター、spark：図柄のキラキラ）があれば段にする
    if ((state.text || state.stage || state.spark) && layer.lead !== "entry") {
      if (state.text) text = text ? text + "\n" + state.text : state.text;
      steps.push({
        phase: evaPhaseOf(layer),
        text: state.text || "",
        color: evaColorOf(state),
        voice: evaVoiceOf(state.text), // eva-voice.js
        stage: state.stage || null, // eva-reel.js の evaPlayShutter
        spark: state.spark || null,
        bg: state.bg || null, // 液晶の背景の画像（格納庫など。eva-reel.js の evaSetBg）
        // 次回予告：図柄を消して「予告」の画面と曲（28 秒）→ 各予告のタイトル（eva-reel.js の evaPlayNextMovie）
        movie: EVA_NEXT_MOVIE_IDS.includes(state.id) ? "next" : null,
        // 前兆（先読み系）の段は、図柄を隠してその演出の専用画面に切り替える（eva-reel.js）
        takeover: layer.lead === "pre",
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
  // 演出なしの当りは突発当り（初号機が画面を引き裂いて告知）
  if (isHit && !acc.any) {
    name.push("突発当り");
    text = "突発当り";
    steps.push({ phase: "post", text: "突発当り" });
    fx.push("fx-tear");
  }

  // 保留の色が変わる流れ（見せ方だけ。当否と holdType はもう決まっている）
  const hold = evaHoldPlan(holdType, holdId, shift);
  // 当該で変わる保留（シフト変化・当該変化）は保留に居る間は無地なので先読みに数えない
  const preTrust = Math.max(leadTrust, hold.when === "current" ? 0 : holdTrust);

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
    // 全回転リーチは ST 中でも 7 で止める（液晶で 1 周して 7 で止まる演出。eva-reel.js）
    if (reach.id === "zenkaiten") hitDigit = 7;
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
    trust: acc.any ? f * 100 : 0,
    sure,
    effects: shown.map(({ layer, state, no }) => ({
      name: state.name,
      trust: state.trust,
      counted: evaCounted(layer, state),
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
