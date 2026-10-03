/* --- EVA15風 抽選エンジン --- */

// ============================================================
// 1回転を「当否と当り種別 → リーチ → 予告の層」の順に整数テーブルで引く。
// 予告の層は層の中で排他（1層から出る演出は1つまで）。層どうしは当り種別を条件に独立で、
// リーチに紐づく層（EVA_LINKED_*）だけは当り種別とリーチの両方を条件にする。
// 各演出を単体で数えた信頼度は宣言値（記事の値）どおりになり、重なれば実際の当りやすさも上がる。
// 表示の信頼度は、出た演出のうち宣言値（記事の値）が一番高いもの（ユーザー方針 2026-10-03）。
// その回転の本当の当りやすさ（事後確率）は evaPosterior で出し、job.posterior に持たせて試験で使う。
// ============================================================

// total を weights の比で整数に分ける（最大剰余法）
function evaApportion(total, weights) {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map((x) => Math.floor(x));
  const rest = total - out.reduce((s, x) => s + x, 0);
  const order = raw
    .map((x, i) => [x - Math.floor(x), i])
    .sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < rest; k++) out[order[k][1]]++;
  return out;
}

function evaMissFor(state, hitTotal) {
  if (state.miss !== undefined) return state.miss;
  if (!(state.trust > 0)) {
    throw new Error(`${state.name}: trust か miss を書いてください`);
  }
  if (state.trust >= 100) return 0;
  return Math.round((hitTotal * (100 - state.trust)) / state.trust);
}

function evaActiveStates(layer, rot) {
  return layer.states.filter((s) => !s.minRot || rot >= s.minRot);
}

const EVA_NONE = { id: "none", name: "なし" };

// リーチに依存しない層：counts[種別id][状態index]（最後が「なし」）
function evaBuildFreeLayer(layer, classes, rot) {
  const states = evaActiveStates(layer, rot);
  const hitClasses = classes.filter((c) => c.hit);
  const missClass = classes.find((c) => !c.hit);
  const H = hitClasses.reduce((s, c) => s + c.n, 0);
  const cap = {};
  const counts = {};
  for (const c of classes) {
    cap[c.id] = c.n;
    counts[c.id] = new Array(states.length + 1).fill(0);
  }
  const defaultIds = layer.hitClasses || hitClasses.map((c) => c.id);
  // 当り本数の置き場所を絞った演出（確変濃厚など）を先に置き、残りの容量の比で他を配る
  const allot = (i, weightOf) => {
    const s = states[i];
    const ids = s.only || defaultIds;
    const allowed = hitClasses.filter((c) => ids.includes(c.id));
    const hitTotal = s.all
      ? allowed.reduce((sum, c) => sum + cap[c.id], 0)
      : s.hit !== undefined
        ? s.hit
        : Math.round((s.share / 100) * H);
    const parts = evaApportion(
      hitTotal,
      allowed.map((c) => weightOf(c)),
    );
    allowed.forEach((c, k) => {
      counts[c.id][i] += parts[k];
      cap[c.id] -= parts[k];
    });
    const miss = evaMissFor(s, hitTotal);
    counts[missClass.id][i] += miss;
    cap[missClass.id] -= miss;
  };
  states.forEach((s, i) => {
    if (s.only) allot(i, (c) => c.n);
  });
  const snapshot = { ...cap };
  states.forEach((s, i) => {
    if (!s.only) allot(i, (c) => snapshot[c.id]);
  });
  for (const c of classes) {
    if (cap[c.id] < 0) {
      throw new Error(
        `${layer.label}: ${c.label} の本数が足りません（${cap[c.id]}）`,
      );
    }
    counts[c.id][states.length] = cap[c.id];
  }
  return {
    key: layer.key,
    label: layer.label,
    isReach: !!layer.isReach,
    states: [...states, EVA_NONE],
    counts,
  };
}

// リーチに紐づく層：counts[種別id][リーチindex][状態index]
function evaBuildLinkedLayer(layer, classes, reachLayer, rot) {
  const states = evaActiveStates(layer, rot);
  const hitClasses = classes.filter((c) => c.hit);
  const missClass = classes.find((c) => !c.hit);
  const reachCount = reachLayer.counts;
  const nReach = reachLayer.states.length;
  const counts = {};
  for (const c of classes) {
    counts[c.id] = [];
    for (let r = 0; r < nReach; r++) {
      counts[c.id].push(new Array(states.length + 1).fill(0));
    }
  }
  states.forEach((s, i) => {
    const reachIds = s.reaches || layer.reaches;
    const reachIdx = reachLayer.states
      .map((st, r) => (reachIds.includes(st.id) ? r : -1))
      .filter((r) => r >= 0);
    const allowed = hitClasses.filter((c) => !s.only || s.only.includes(c.id));
    let hitSum = 0;
    for (const r of reachIdx) {
      const reachHit = hitClasses.reduce(
        (sum, c) => sum + reachCount[c.id][r],
        0,
      );
      const hitTotal = Math.round((s.share / 100) * reachHit);
      const parts = evaApportion(
        hitTotal,
        allowed.map((c) => reachCount[c.id][r]),
      );
      allowed.forEach((c, k) => {
        counts[c.id][r][i] += parts[k];
      });
      hitSum += parts.reduce((sum, x) => sum + x, 0);
    }
    const missTotal = evaMissFor(s, hitSum);
    const missParts = evaApportion(
      missTotal,
      reachIdx.map((r) => reachCount[missClass.id][r]),
    );
    reachIdx.forEach((r, k) => {
      counts[missClass.id][r][i] += missParts[k];
    });
  });
  const totals = {};
  for (const c of classes) {
    totals[c.id] = [];
    for (let r = 0; r < nReach; r++) {
      const used = counts[c.id][r].reduce((sum, x) => sum + x, 0);
      const none = reachCount[c.id][r] - used;
      if (none < 0) {
        throw new Error(
          `${layer.label}: ${reachLayer.states[r].name} の ${c.label} の本数が足りません（${none}）`,
        );
      }
      counts[c.id][r][states.length] = none;
      totals[c.id].push(reachCount[c.id][r]);
    }
  }
  return {
    key: layer.key,
    label: layer.label,
    states: [...states, EVA_NONE],
    counts,
    totals,
  };
}

function evaBuildTables(classes, layers, linked, rot) {
  const bit = classes.reduce((s, c) => s + c.n, 0);
  const free = layers.map((l) => evaBuildFreeLayer(l, classes, rot));
  const reach = free.find((l) => l.isReach) || null;
  return {
    bit,
    classes,
    classTotals: classes.map((c) => c.n),
    free,
    reachKey: reach ? reach.key : null,
    linked: reach
      ? linked.map((l) => evaBuildLinkedLayer(l, classes, reach, rot))
      : [],
  };
}

function evaPick(counts, r) {
  for (let i = 0; i < counts.length; i++) {
    if (r < counts[i]) return i;
    r -= counts[i];
  }
  return counts.length - 1;
}

function evaRandInt(n) {
  return Math.floor(Math.random() * n);
}

// 1回転を引く：picks[層key] = 状態index
function evaDraw(T) {
  const c = T.classes[evaPick(T.classTotals, evaRandInt(T.bit))];
  const picks = {};
  for (const L of T.free) {
    picks[L.key] = evaPick(L.counts[c.id], evaRandInt(c.n));
  }
  const r = T.reachKey ? picks[T.reachKey] : 0;
  for (const L of T.linked) {
    const total = L.totals[c.id][r];
    picks[L.key] = total
      ? evaPick(L.counts[c.id][r], evaRandInt(total))
      : L.states.length - 1;
  }
  return { cls: c, picks };
}

// その回転で見えた全演出から、当り種別ごとの重みを出して事後確率にする
function evaPosterior(T, picks) {
  const r = T.reachKey ? picks[T.reachKey] : 0;
  const w = {};
  let total = 0;
  for (const c of T.classes) {
    let p = c.n / T.bit;
    for (const L of T.free) {
      p *= L.counts[c.id][picks[L.key]] / c.n;
    }
    for (const L of T.linked) {
      const t = L.totals[c.id][r];
      p *= t ? L.counts[c.id][r][picks[L.key]] / t : 0;
    }
    w[c.id] = p;
    total += p;
  }
  let hit = 0;
  for (const c of T.classes) if (c.hit) hit += w[c.id];
  const trust = total > 0 ? (hit / total) * 100 : 0;
  let sure = null;
  const live = T.classes.filter((c) => w[c.id] > 0);
  if (live.length && live.every((c) => c.hit)) {
    if (live.every((c) => c.id === "r10")) sure = "10R確変濃厚";
    else if (live.every((c) => c.st)) sure = "確変濃厚";
    else sure = "大当り濃厚";
  }
  return { trust, sure, weights: w };
}

// 起動時に整数テーブルを作る（群予告の 400 回転ゲートで通常時は 2 種類）
const EVA_T_N_LOW = evaBuildTables(
  EVA_CLASSES_N,
  EVA_LAYERS_N,
  EVA_LINKED_N,
  0,
);
const EVA_T_N_HIGH = evaBuildTables(
  EVA_CLASSES_N,
  EVA_LAYERS_N,
  EVA_LINKED_N,
  401,
);
const EVA_T_S = evaBuildTables(EVA_CLASSES_S, EVA_LAYERS_S, EVA_LINKED_S, 0);

function evaTablesFor(regime) {
  if (regime !== "n") return EVA_T_S;
  return currentRot > 400 ? EVA_T_N_HIGH : EVA_T_N_LOW;
}

// 演出ひとつの宣言上の信頼度（記事の値。本数指定の演出は本数から）
function evaStateTrust(s) {
  if (s.trust !== undefined) return s.trust;
  return s.hit + s.miss ? (s.hit / (s.hit + s.miss)) * 100 : 0;
}

// 濃厚の演出の中で一番強い言い方を選ぶ（10R確変 ＞ 確変 ＞ 大当り）
function evaSureLabel(states) {
  if (!states.length) return null;
  const onlyIn = (s, ids) => s.only && s.only.every((id) => ids.includes(id));
  if (states.some((s) => onlyIn(s, ["r10"]))) return "10R確変濃厚";
  if (states.some((s) => onlyIn(s, EVA_KAKUHEN))) return "確変濃厚";
  return "大当り濃厚";
}

function createEvaJob(isRight, regime) {
  const T = evaTablesFor(regime);
  const { cls, picks } = evaDraw(T);
  const post = evaPosterior(T, picks);
  const pickOf = (key) => {
    const L = [...T.free, ...T.linked].find((x) => x.key === key);
    return L ? L.states[picks[key]] : EVA_NONE;
  };

  const name = [];
  let text = "";
  let holdType = "none";
  let vibe = false;
  let vibeColor = "none";
  let trust = 0;
  const sureStates = [];
  for (const L of [...T.free, ...T.linked]) {
    const s = L.states[picks[L.key]];
    if (s.id === "none") continue;
    name.push(s.name);
    const t = evaStateTrust(s);
    trust = Math.max(trust, t);
    if (t >= 100) sureStates.push(s);
    if (s.holdType) holdType = s.holdType;
    if (s.text) text = text ? text + "\n" + s.text : s.text;
    // 液晶の揺れ（vibe）は当該レバブルのときだけ
    if (L.key === "lever") {
      vibe = true;
      vibeColor = s.vibeColor;
    }
  }
  // 保留が無地で当該レバブルが出たときだけ「レバブル保留」に表示を格上げする（抽選には影響しない）
  if (holdType === "none" && vibe) {
    holdType = "vibe";
    name.unshift("レバブル保留");
  }

  const reach = T.reachKey ? pickOf(T.reachKey) : EVA_NONE;
  let hitDigit = null;
  let upgrade = false;
  if (cls.hit) {
    if (regime !== "n") hitDigit = Math.random() < 0.5 ? 3 : 1;
    else if (cls.id === "r10") hitDigit = 7;
    else if (cls.id === "k3") {
      upgrade = Math.random() < EVA_UPGRADE_RATE;
      hitDigit = upgrade
        ? [2, 4, 6, 8][Math.floor(Math.random() * 4)]
        : [1, 3, 5, 9][Math.floor(Math.random() * 4)];
    } else hitDigit = [2, 4, 6, 8][Math.floor(Math.random() * 4)];
  }

  return {
    isHit: cls.hit,
    isRight,
    heavy: false,
    name,
    trust,
    sure: evaSureLabel(sureStates),
    posterior: post.trust,
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
    kind: cls.hit ? cls.id : null,
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
