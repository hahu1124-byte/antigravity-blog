// 目押しチャレンジ: 抽選と状態の移り変わり（スマスロ ハナビの解析値。DOM に触らない。画面と出玉の試算で共通）
// 出典: 1geki https://1geki.jp/slot/l_hanabi/ の /0/（設定差）・/4/（小役確率）・/44/（ボーナス同時当選）・
//       /61/（BB）・/63/（RB）・/81/（花火チャレンジ）・/83/（花火GAME）。値は「1/x」の x
export const SETTINGS = [1, 2, 5, 6];

// 通常時の小役（設定別）。風鈴・氷・チェリーは A・B などを合算して 1 つの役として止める
const SMALL = {
  1: {
    replay: 7.3,
    fuurin: [12.9, 38.4],
    kori: [46.3, 1560.4],
    cherry: [99.4, 21.0, 307.7],
  },
  2: {
    replay: 7.3,
    fuurin: [12.5, 38.7],
    kori: [47.3, 1560.4],
    cherry: [99.4, 19.4, 306.2],
  },
  5: {
    replay: 7.3,
    fuurin: [12.1, 36.2],
    kori: [46.2, 1560.4],
    cherry: [99.4, 20.5, 300.6],
  },
  6: {
    replay: 7.3,
    fuurin: [11.5, 34.5],
    kori: [47.4, 1560.4],
    cherry: [99.3, 19.6, 297.9],
  },
};

// ボーナスの成立役別の当選確率（/44/）。alone は単独・特殊リプレイ・リーチ目役 A〜E（小役が揃わない）を合算する
const BONUS = {
  bigDon: {
    1: {
      alone: [1724.6, 4681.1, 8192.0, 2849.4, 10922.7],
      replay: 5461.3,
      fuurin: 16384.0,
      cherry: 13107.2,
    },
    2: {
      alone: [1680.4, 4369.1, 8192.0, 2849.4, 10922.7],
      replay: 5461.3,
      fuurin: 16384.0,
      cherry: 13107.2,
    },
    5: {
      alone: [1680.4, 4369.1, 8192.0, 2849.4, 10922.7],
      replay: 5041.2,
      fuurin: 13107.2,
      cherry: 10922.7,
    },
    6: {
      alone: [1598.4, 4369.1, 7281.8, 2730.7, 9362.3],
      replay: 5041.2,
      fuurin: 13107.2,
      cherry: 10922.7,
    },
  },
  // 赤7 BIG のチェリーは A1 と B の合算
  bigSeven: {
    1: {
      alone: [2184.5, 7281.8, 9362.3, 1872.5, 9362.3],
      replay: 5461.3,
      cherry: [16384.0, 10922.7],
    },
    2: {
      alone: [2114.1, 7281.8, 9362.3, 1872.5, 9362.3],
      replay: 5461.3,
      cherry: [16384.0, 10922.7],
    },
    5: {
      alone: [2114.1, 6553.6, 8192.0, 1771.2, 8192.0],
      replay: 5041.2,
      cherry: [13107.2, 9362.3],
    },
    6: {
      alone: [2048.0, 6553.6, 8192.0, 1771.2, 8192.0],
      replay: 5041.2,
      cherry: [13107.2, 9362.3],
    },
  },
  reg: {
    1: { alone: [1149.8, 1598.4, 1598.4], replay: 3276.8, cherry: 9362.3 },
    2: { alone: [1040.3, 1424.7, 1489.5], replay: 2978.9, cherry: 8192.0 },
    5: { alone: [936.2, 1236.5, 1310.7], replay: 2520.6, cherry: 6553.6 },
    6: { alone: [851.1, 1129.9, 1191.6], replay: 2184.5, cherry: 5461.3 },
  },
};

// RT 中はリプレイの部分だけ置き換える（ハズレ・風鈴・氷・チェリー・ボーナスは通常時と同じ）
// 花火チャレンジ: 通常リプレイと移行リプレイ（JAC IN）。花火GAME: 通常リプレイ 1/7.3 と RT リプレイ
const RT_REPLAY = {
  chal: {
    1: { replay: 3.2, jacIn: 3.5 },
    2: { replay: 3.4, jacIn: 3.5 },
    5: { replay: 3.6, jacIn: 3.5 },
    6: { replay: 3.7, jacIn: 3.5 },
  },
  game: {
    1: { replay: 7.3, rtReplay: 1.9 },
    2: { replay: 7.3, rtReplay: 2.0 },
    5: { replay: 7.3, rtReplay: 2.1 },
    6: { replay: 7.3, rtReplay: 2.1 },
  },
};

// BIG 中（/0/・/4/）: 風鈴A（平行）・風鈴B（斜め＝逆 L 字）・バラケ目。払い出しはどれも 15 枚
const BB_ODDS = {
  1: { fuurinB: 10.0, bara: 16384.0 },
  2: { fuurinB: 7.0, bara: 16384.0 },
  5: { fuurinB: 10.0, bara: 819.2 },
  6: { fuurinB: 7.0, bara: 819.2 },
};
// REG 中（/4/）: 風鈴 1/1.2・1 枚役・共通 15 枚 1/32.8・バラケ目（特殊役・15 枚）・残りはハズレ
const RB_ODDS = {
  1: { fuurin: 1.2, one: 8.0, common: 32.8, bara: 16384.0 },
  2: { fuurin: 1.2, one: 8.0, common: 32.8, bara: 16384.0 },
  5: { fuurin: 1.2, one: 7.0, common: 32.8, bara: 16384.0 },
  6: { fuurin: 1.2, one: 7.0, common: 32.8, bara: 1092.3 },
};

// RT のゲーム数（/81/・/83/）。花火チャレンジは残り 8G まで移行リプレイを外すと延命
export const RT_GAMES = 20;
export const CHAL_EXTEND_LEFT = 8;

const inv = (x) =>
  Array.isArray(x) ? x.reduce((a, v) => a + 1 / v, 0) : 1 / x;

// 1 ゲームの抽選表（互いに重ならない結果の一覧）。rt は null・"chal"・"game"
// 各結果は { bonus, small, p }。small は replay・jacIn・rtReplay・fuurin・kori・cherry・null
const tableCache = new Map();
export function lotteryTable(setting, rt = null) {
  const key = setting + ":" + rt;
  if (tableCache.has(key)) return tableCache.get(key);
  const s = SMALL[setting];
  const out = [];
  const used = { replay: 0, fuurin: 0, cherry: 0 };
  for (const type of ["bigDon", "bigSeven", "reg"]) {
    const b = BONUS[type][setting];
    out.push({ bonus: type, small: null, p: inv(b.alone) });
    for (const small of ["replay", "fuurin", "cherry"]) {
      if (b[small] === undefined) continue;
      const p = inv(b[small]);
      out.push({ bonus: type, small, p });
      used[small] += p;
    }
  }
  const replays =
    rt === "chal"
      ? {
          replay: inv(RT_REPLAY.chal[setting].replay),
          jacIn: inv(RT_REPLAY.chal[setting].jacIn),
        }
      : rt === "game"
        ? {
            replay: inv(RT_REPLAY.game[setting].replay),
            rtReplay: inv(RT_REPLAY.game[setting].rtReplay),
          }
        : { replay: inv(s.replay) };
  for (const [small, p] of Object.entries(replays))
    out.push({
      bonus: null,
      small,
      p: small === "replay" ? p - used.replay : p,
    });
  out.push({ bonus: null, small: "fuurin", p: inv(s.fuurin) - used.fuurin });
  out.push({ bonus: null, small: "kori", p: inv(s.kori) });
  out.push({ bonus: null, small: "cherry", p: inv(s.cherry) - used.cherry });
  tableCache.set(key, out);
  return out;
}

// 1 ゲームを引く。返り値 { bonus, small }（どちらも null ならハズレ）
export function drawNormal(setting, rt = null, rand = Math.random) {
  let v = rand();
  for (const e of lotteryTable(setting, rt)) {
    if (v < e.p) return { bonus: e.bonus, small: e.small };
    v -= e.p;
  }
  return { bonus: null, small: null };
}

// BIG 中の 1 ゲーム: "fuurinA"・"fuurinB"・"bara"（どれも 15 枚）
export function drawBB(setting, rand = Math.random) {
  const o = BB_ODDS[setting];
  const v = rand();
  if (v < 1 / o.bara) return "bara";
  if (v < 1 / o.bara + 1 / o.fuurinB) return "fuurinB";
  return "fuurinA";
}

// REG 中の 1 ゲーム: "one"（1 枚役）・"common"（共通 15 枚）・"bara"（特殊役 15 枚）・"fuurin"・"none"
export function drawRB(setting, rand = Math.random) {
  const o = RB_ODDS[setting];
  let v = rand();
  for (const [k, x] of [
    ["one", o.one],
    ["common", o.common],
    ["bara", o.bara],
    ["fuurin", o.fuurin],
  ]) {
    if (v < 1 / x) return k;
    v -= 1 / x;
  }
  return "none";
}

// 役の確率の表（設定値の列）: ドン BIG・赤7 BIG・REG と小役（同時当選も含めた全体）の 1/x
export function theoryOdds(setting) {
  const t = lotteryTable(setting, null);
  const sum = (f) => t.filter(f).reduce((a, e) => a + e.p, 0);
  return {
    bigDon: 1 / sum((e) => e.bonus === "bigDon"),
    bigSeven: 1 / sum((e) => e.bonus === "bigSeven"),
    reg: 1 / sum((e) => e.bonus === "reg"),
    big: 1 / sum((e) => e.bonus === "bigDon" || e.bonus === "bigSeven"),
    bonus: 1 / sum((e) => e.bonus),
    replay: 1 / sum((e) => e.small === "replay"),
    fuurin: 1 / sum((e) => e.small === "fuurin"),
    kori: 1 / sum((e) => e.small === "kori"),
    cherry: 1 / sum((e) => e.small === "cherry"),
  };
}

// 花火チャレンジ・花火GAME の 1 ゲームを終えたあとの RT。rt は { type: "chal"|"game", left }
//   jacIn: 移行リプレイが成立したか、aligned: そのリプレイが揃ったか（外せば false）
export function nextRt(rt, { jacIn = false, aligned = false } = {}) {
  if (!rt) return null;
  if (rt.type === "chal") {
    if (jacIn && aligned) return { type: "game", left: RT_GAMES };
    // 残り 8G までに移行リプレイを外せば、このゲームは数えない（延命）
    if (jacIn && !aligned && rt.left >= CHAL_EXTEND_LEFT) return rt;
  }
  const left = rt.left - 1;
  return left > 0 ? { ...rt, left } : null;
}
