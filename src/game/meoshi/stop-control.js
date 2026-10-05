// 目押しチャレンジ: 押し位置・すべり・役の判定（DOM に触らない。Node から試験で読む）
import {
  FRAMES,
  FRAME_MS,
  MAX_SLIP,
  REELS,
  LINES,
  LINES_BY_BET,
  BETS,
  ROLES,
  ROLES_BY_MODE,
  LOTTERY,
  LOTTERY_DENOM,
} from "./reel-data.js";
import { REACH_PATTERNS } from "./reach-data.js";

export const mod = (n) => ((n % FRAMES) + FRAMES) % FRAMES;

// リール i の idx 番（0 始まり）の図柄
export const symAt = (reel, idx) => REELS[reel][mod(idx)];

// 中段が mid 番のときの [下段, 中段, 上段]
export const windowOf = (reel, mid) => [
  symAt(reel, mid - 1),
  symAt(reel, mid),
  symAt(reel, mid + 1),
];

// 回転位置 pos（中段の中心にあるコマの連続値。時間とともに増える）で押したときの「押したコマ」。
// 次に中段の停止位置へ来るコマで、すべり 0 ならそこで止まる（戻らない）
export const pushedFrame = (pos) => Math.ceil(pos - 1e-9);

// 押したときのずれ（ms）。狙いのコマ target がすべり 0 で中段に止まる窓（35.7ms）の真ん中を 0 とし、
// 早押しが負・遅押しが正。窓の中なら |ずれ| ≤ FRAME_MS/2
export function pushOffsetMs(pos, target) {
  // 窓の真ん中は pos = target - 0.5。円環なので最も近い周回を選ぶ
  let d = pos - (target - 0.5);
  d = d - Math.round(d / FRAMES) * FRAMES;
  return d * FRAME_MS;
}

// 全リール停止時の入賞。stops は各リールの中段のコマ番号（0 始まり）。bet は掛け枚数（有効ラインが変わる）
export function judge(stops, mode = "normal", bet = 3) {
  const wins = [];
  for (const id of ROLES_BY_MODE[mode]) {
    const role = ROLES[id];
    for (const l of LINES_BY_BET[bet]) {
      const rows = LINES[l].rows;
      let ok = true;
      for (let r = 0; r < 3; r++) {
        const allow = role.reels[r];
        if (!allow) continue;
        if (!allow.includes(symAt(r, stops[r] + rows[r] - 1))) {
          ok = false;
          break;
        }
      }
      if (ok) wins.push({ role: id, line: l });
    }
  }
  return wins;
}

// ---- リーチ目 ----
// リーチ目の照合では、女の子の大小（D・d）と風鈴の短冊の色（F・G）を区別しない
// （画像の書き起こしでは見分けにくく、形の意味も変わらないため）
const LOOSE = { d: "D", G: "F", Dd: "D", FG: "F" };
const loose = (s) => LOOSE[s] || s;
const cellOk = (cell, sym) => {
  if (cell === null || cell === undefined) return true;
  if (Array.isArray(cell)) return cell.some((c) => cellOk(c, sym));
  return loose(cell) === loose(sym);
};

// "★" のセルは「★どうしが同じ図柄ならどれでもよい」（画像の注記「同じ図柄であれば有効」）
function reelMatches(spec, r, mid, stars) {
  if (spec === "any" || spec === "hazure") return true;
  const cells = [
    [spec.rows[0], mid + 1],
    [spec.rows[1], mid],
    [spec.rows[2], mid - 1],
    [spec.above, mid + 2],
    [spec.below, mid - 2],
  ];
  for (const [cell, idx] of cells) {
    const sym = symAt(r, idx);
    if (cell === "★") stars.push(sym);
    else if (!cellOk(cell, sym)) return false;
  }
  return true;
}

function patternMatches(p, stops) {
  // anyLine: 5 ラインのどれかで、各リールがその図柄（画像の「ALLラインOK」）
  if (p.anyLine)
    return LINES.some((line) =>
      line.rows.every((row, r) =>
        cellOk(p.anyLine[r], symAt(r, stops[r] + row - 1)),
      ),
    );
  const stars = [];
  if (!p.reels.every((spec, r) => reelMatches(spec, r, stops[r], stars)))
    return false;
  return stars.every((s) => s === stars[0]);
}

// 掛け枚数ごとに、全部止まった形（21³ 通り）がどのリーチ目に当たるかを 1 回だけ調べておく（-1 は当たらない）
const reachTables = {};
function reachTableOf(bet) {
  if (reachTables[bet]) return reachTables[bet];
  const t = new Int16Array(FRAMES * FRAMES * FRAMES).fill(-1);
  for (let a = 0; a < FRAMES; a++)
    for (let b = 0; b < FRAMES; b++)
      for (let c = 0; c < FRAMES; c++) {
        const stops = [a, b, c];
        let noWin = null;
        for (let k = 0; k < REACH_PATTERNS.length; k++) {
          const p = REACH_PATTERNS[k];
          if (!patternMatches(p, stops)) continue;
          if (p.reels && p.reels.includes("hazure")) {
            if (noWin === null)
              noWin = judge(stops, "normal", bet).length === 0;
            if (!noWin) continue;
          }
          t[(a * FRAMES + b) * FRAMES + c] = k;
          break;
        }
      }
  reachTables[bet] = t;
  return t;
}

// 全部止まった形がリーチ目ならその番号（REACH_PATTERNS の添字）、違えば -1
export function reachAt(stops, bet = 3) {
  return reachTableOf(bet)[(stops[0] * FRAMES + stops[1]) * FRAMES + stops[2]];
}

// 全部止まった形が当たるリーチ目の番号をすべて返す（試験用。reachAt は最初の 1 つだけ）
export function reachAllAt(stops, bet = 3) {
  const out = [];
  let noWin = null;
  REACH_PATTERNS.forEach((p, k) => {
    if (!patternMatches(p, stops)) return;
    if (p.reels && p.reels.includes("hazure")) {
      if (noWin === null) noWin = judge(stops, "normal", bet).length === 0;
      if (!noWin) return;
    }
    out.push(k);
  });
  return out;
}

// 入賞が成立フラグに対して正しいか（成立していない役が揃っていない・ボーナスと小役が同時に揃っていない）
function isLegal(wins, allowed) {
  let bonus = false;
  let other = false;
  for (const w of wins) {
    const role = ROLES[w.role];
    if (!allowed.includes(role.flag)) return false;
    if (role.kind === "bonus") bonus = true;
    else other = true;
  }
  return !(bonus && other);
}

// 揃った役の重み。同時に成立しているときは小役・リプレイをボーナスより優先して引き込む。
// 代わりの図柄（小ドン）での入賞は、本物の図柄で揃えられないときだけ使う
function scoreOf(wins) {
  let s = 0;
  for (const w of wins) {
    const role = ROLES[w.role];
    s += role.kind === "bonus" ? 10 : role.alt ? 50 : 1000;
  }
  return s;
}

const ILLEGAL = -1e9;
// ボーナス成立中にリーチ目の形で止める重み（ボーナス揃い 10 より小さい）
const REACH_SCORE = 5;

// 状態の評価を、フラグの組み合わせと掛け枚数ごとに数値の配列でメモする。
// 状態は各リールの中段のコマ番号（回転中は -1）。評価は、残りのリールが「どの順・どこで押されても」の
// 最悪値 min と平均値 avg で、各押し位置ではすべり 0〜4 の中から最良を選ぶ前提
const W = FRAMES + 1;
const STATE_N = W * W * W;
const idx3 = (s) => (s[0] + 1) * W * W + (s[1] + 1) * W + (s[2] + 1);
const tables = new Map();

const keyOf = (allowed, mode, bet) =>
  mode + ":" + bet + ":" + allowed.slice().sort().join("+");

function tableOf(allowed, mode, bet) {
  const key = keyOf(allowed, mode, bet);
  let t = tables.get(key);
  if (!t) {
    t = {
      mode,
      bet,
      allowed: allowed.slice(),
      hasBonus: allowed.includes("big") || allowed.includes("reg"),
      // "reach" はフラグではなく目印。ボーナス成立中にリーチ目の形を優先して止めるゲーム
      reachPref: allowed.includes("reach"),
      min: new Float64Array(STATE_N),
      avg: new Float64Array(STATE_N),
      done: new Uint8Array(STATE_N),
    };
    tables.set(key, t);
  }
  return t;
}

// 全部止まった形の値。リーチ目の形は、ボーナスが成立していなければ禁止。
// 成立していれば許し、"reach" の目印があるゲームでは少し優先する
function finalValue(s, t) {
  const wins = judge(s, t.mode, t.bet);
  if (!isLegal(wins, t.allowed)) return ILLEGAL;
  let v = scoreOf(wins);
  if (t.mode === "normal" && reachAt(s, t.bet) >= 0) {
    if (!t.hasBonus) return ILLEGAL;
    if (t.reachPref) v += REACH_SCORE;
  }
  return v;
}

// s は呼び出し中に書き換えて戻す。返り値は状態の番号（t.min / t.avg を読む）
function evaluate(s, t) {
  const i = idx3(s);
  if (t.done[i]) return i;
  if (s[0] >= 0 && s[1] >= 0 && s[2] >= 0) {
    const v = finalValue(s, t);
    t.min[i] = v;
    t.avg[i] = v;
  } else {
    let min = Infinity;
    let sum = 0;
    let n = 0;
    for (let r = 0; r < 3; r++) {
      if (s[r] >= 0) continue;
      for (let p = 0; p < FRAMES; p++) {
        const j = bestSlip(s, r, p, t).i;
        if (t.min[j] < min) min = t.min[j];
        sum += t.avg[j];
        n++;
      }
    }
    t.min[i] = min;
    t.avg[i] = sum / n;
  }
  t.done[i] = 1;
  return i;
}

function bestSlip(s, reel, pushed, t) {
  const keep = s[reel];
  let slip = -1;
  let bi = -1;
  for (let k = 0; k <= MAX_SLIP; k++) {
    s[reel] = mod(pushed + k);
    const j = evaluate(s, t);
    // 同じ評価ならすべりの少ない方（k の小さい方が先に入る）
    if (
      slip < 0 ||
      t.min[j] > t.min[bi] ||
      (t.min[j] === t.min[bi] && t.avg[j] > t.avg[bi] + 1e-9)
    ) {
      slip = k;
      bi = j;
    }
  }
  s[reel] = keep;
  return { slip, i: bi };
}

const toInner = (stops) =>
  stops.map((v) => (v === null || v === undefined ? -1 : v));

// 起こりうるフラグの組み合わせ × 掛け枚数（ページを開いたときに先読みしておく）
export const FLAG_SETS = (() => {
  const small = [[], ["replay"], ["fuurin"], ["kori"], ["cherry"]];
  const sets = [];
  for (const bet of BETS) {
    for (const b of [[], ["big"], ["reg"], ["big", "reach"], ["reg", "reach"]])
      for (const s of small)
        sets.push({ allowed: [...b, ...s], mode: "normal", bet });
    sets.push({ allowed: ["bonusFuurin"], mode: "bonus", bet });
  }
  return sets;
})();

// 先読みを済ませておく（1 組 20〜30ms ほど。最初の停止で待たせないため）
export function prepare(allowed, mode = "normal", bet = 3) {
  evaluate([-1, -1, -1], tableOf(allowed, mode, bet));
}

// 停止位置を決める。stops は今の停止状態（未停止は null）、pushed は押したコマ、
// allowed は成立しているフラグの配列（例 ["big", "replay"]）。返り値は中段のコマ番号とすべりのコマ数
export function decideStop(
  stops,
  reel,
  pushed,
  allowed,
  mode = "normal",
  bet = 3,
) {
  const best = bestSlip(
    toInner(stops),
    reel,
    mod(pushed),
    tableOf(allowed, mode, bet),
  );
  return { mid: mod(pushed + best.slip), slip: best.slip };
}

// 通常時の抽選。rand は 0 以上 1 未満を返す関数
export function drawFlag(rand = Math.random) {
  let v = Math.floor(rand() * LOTTERY_DENOM);
  for (const e of LOTTERY) {
    if (v < e.weight) return e.flag;
    v -= e.weight;
  }
  return "none";
}
