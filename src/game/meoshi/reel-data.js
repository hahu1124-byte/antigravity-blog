// 目押しチャレンジ: リール配列・役・確率（DOM に触らない。Node から試験で読む）
// 配列は 2015 年アクロス版 HANABI（スマスロ ハナビと同配列）の並びに合わせ、図柄は差し替えている

// 規則の上限: 1 分 80 回転・190ms 以内に停止（= すべり最大 4 コマ）
export const RPM = 80;
export const FRAMES = 21;
export const CYCLE_MS = 60000 / RPM; // 1 周 750ms
export const FRAME_MS = CYCLE_MS / FRAMES; // 1 コマ約 35.7ms
export const MAX_SLIP = 4;

// 図柄の記号と表示名
//   R うちわ（リプレイ）  H 紫の花火柄（左リールのリプレイ代わり）
//   F 風鈴（橙の短冊）    G 風鈴（緑の短冊）
//   D 女の子              d 女の子（小・左 5 番だけ）
//   N 暖簾                S 赤7
//   I 氷                  C チェリー
export const SYMBOL_NAMES = {
  R: "うちわ",
  H: "花火柄",
  F: "風鈴",
  G: "風鈴",
  D: "女の子",
  d: "女の子",
  N: "暖簾",
  S: "赤7",
  I: "氷",
  C: "チェリー",
};

// 配列。文字列の先頭が 1 番（下）、末尾が 21 番（上）
// リールは図柄が下へ流れるので、中段が n 番のとき上段は n+1 番、下段は n-1 番
export const REELS = [
  "RFDDdRIGNCRFSIFRIFDCH", // 左
  "RCICGRDCGRHNGRSICGRCF", // 中
  "RIFDRNGCRIFSCRIGHRNGC", // 右
];

// 有効ライン（各リールの段: 0 下段・1 中段・2 上段）
export const LINES = [
  { name: "中段", rows: [1, 1, 1] },
  { name: "上段", rows: [2, 2, 2] },
  { name: "下段", rows: [0, 0, 0] },
  { name: "右下がり", rows: [2, 1, 0] },
  { name: "右上がり", rows: [0, 1, 2] },
];

// 掛け枚数ごとの有効ライン（LINES の番号）。1 枚掛けは中段だけ
export const BETS = [1, 3];
export const LINES_BY_BET = { 1: [0], 3: [0, 1, 2, 3, 4] };

// 役。reels[i] はリール i で揃ってよい図柄（null はどれでもよい）
// kind: bonus はボーナス、small は小役、replay は再遊技
const FUURIN = ["F", "G"];
export const ROLES = {
  big1: {
    flag: "big",
    kind: "bonus",
    name: "BIG",
    reels: [["D", "d"], ["D"], ["D"]],
  },
  big2: {
    flag: "big",
    kind: "bonus",
    name: "BIG",
    reels: [["S"], ["S"], ["S"]],
  },
  reg1: {
    flag: "reg",
    kind: "bonus",
    name: "REG",
    reels: [["N"], ["N"], ["N"]],
  },
  reg2: {
    flag: "reg",
    kind: "bonus",
    name: "REG",
    reels: [["S"], ["S"], ["N"]],
  },
  replay: {
    flag: "replay",
    kind: "replay",
    name: "リプレイ",
    reels: [["R", "H"], ["R"], ["R"]],
    pay: 0,
  },
  fuurin: {
    flag: "fuurin",
    kind: "small",
    name: "風鈴",
    reels: [FUURIN, FUURIN, FUURIN],
    pay: 10,
  },
  // 左の小ドン（左 5 番）は風鈴の代わり。中・右から押して左の中段に風鈴が届かないとき、
  // 3 連のドンの位置で取りこぼさないようにする。揃えられるときは本物の風鈴を優先する（alt）
  fuurinAlt: {
    flag: "fuurin",
    kind: "small",
    name: "風鈴",
    reels: [["d"], FUURIN, FUURIN],
    pay: 10,
    alt: true,
  },
  kori: {
    flag: "kori",
    kind: "small",
    name: "氷",
    // 暖簾は左・右リールで氷の代わり
    reels: [["I", "N"], ["I"], ["I", "N"]],
    // 払い出しが掛け枚数で変わる役は { 掛け枚数: 枚数 }（2015 年版の配当表）
    pay: { 1: 10, 3: 15 },
  },
  cherry: {
    flag: "cherry",
    kind: "small",
    name: "チェリー",
    reels: [["C"], null, null],
    pay: 2,
  },
  // ボーナス中だけ有効な役
  bonusFuurin: {
    flag: "bonusFuurin",
    kind: "small",
    name: "風鈴",
    reels: [FUURIN, FUURIN, FUURIN],
    pay: 15,
  },
  bonusFuurinAlt: {
    flag: "bonusFuurin",
    kind: "small",
    name: "風鈴",
    reels: [["d"], FUURIN, FUURIN],
    pay: 15,
    alt: true,
  },
};

// 遊技状態ごとに判定する役
export const ROLES_BY_MODE = {
  normal: [
    "big1",
    "big2",
    "reg1",
    "reg2",
    "replay",
    "fuurin",
    "fuurinAlt",
    "kori",
    "cherry",
  ],
  bonus: ["bonusFuurin", "bonusFuurinAlt"],
};

// 通常時の抽選（分母 65536）。スマスロ ハナビの解析値（1geki。設定 3・4 は非公開）
//   BB・RB・風鈴（A＋B）・チェリー（A1＋A2＋B）は設定差あり、リプレイ 1/7.3・氷 1/46.3＋1/1560.4 は共通
// 値は「1/x」の x。重なった役は合算した
export const SETTINGS = [1, 2, 5, 6];
const ODDS = {
  1: {
    big: 297.9,
    reg: 394.8,
    fuurin: [12.9, 38.4],
    cherry: [99.4, 21.0, 307.7],
  },
  2: {
    big: 292.6,
    reg: 358.1,
    fuurin: [12.5, 38.7],
    cherry: [99.4, 19.4, 306.2],
  },
  5: {
    big: 284.9,
    reg: 313.6,
    fuurin: [12.1, 36.2],
    cherry: [99.4, 20.5, 300.6],
  },
  6: {
    big: 273.1,
    reg: 282.5,
    fuurin: [11.5, 34.5],
    cherry: [99.3, 19.6, 297.9],
  },
};
const REPLAY_ODDS = 7.3;
const KORI_ODDS = [46.3, 1560.4];
export const LOTTERY_DENOM = 65536;
const w = (...xs) =>
  Math.round(LOTTERY_DENOM * xs.reduce((a, x) => a + 1 / x, 0));
export const LOTTERY_BY_SETTING = Object.fromEntries(
  SETTINGS.map((s) => {
    const o = ODDS[s];
    return [
      s,
      [
        { flag: "big", weight: w(o.big) },
        { flag: "reg", weight: w(o.reg) },
        { flag: "replay", weight: w(REPLAY_ODDS) },
        { flag: "fuurin", weight: w(...o.fuurin) },
        { flag: "kori", weight: w(...KORI_ODDS) },
        { flag: "cherry", weight: w(...o.cherry) },
      ],
    ];
  }),
);

// 1 ライン分の払い出し（掛け枚数で変わる役は表から引く）
export function payOf(roleId, bet) {
  const p = ROLES[roleId].pay || 0;
  return typeof p === "number" ? p : p[bet];
}

// ボーナス成立中のゲームで、リーチ目の形を優先して止める割合（解析値が無いので仮の値）。
// 優先しないゲームでも、押し位置しだいでリーチ目になることはある
export const REACH_SHOW_RATE = 0.6;

// ボーナス（スマスロ ハナビ。1geki /61/・/63/ と役構成の画像）
// BB: 279 枚を超えたら終了。1 ゲーム目だけ「左リール中段に赤7 をビタ押し」で 14 枚役（技術介入）、あとは 15 枚
export const BIG_END_PAYOUT = 279;
export const BB_VITA_PAY = 14;
// RB: 12 ゲームか 8 回入賞で終了。1 枚役が成立すると予告音が鳴り、左リールに 3 連ドンを狙うと外せる
// （入賞回数を 1 枚役で使わないため）。共通 15 枚役でも予告音は鳴る
export const REG_END_GAMES = 12;
export const REG_END_WINS = 8;
export const RB_ONE_ODDS = { 1: 8.0, 2: 8.0, 5: 7.0, 6: 7.0 }; // 1 枚役 1/x
export const RB_COMMON_ODDS = 32.8; // 共通 15 枚役 1/x
// 3 連ドンの位置（左リールの 0 始まりの番号）。窓にどれか 1 つでも入っていれば外し成功（アバウトで OK）
export const TRIPLE_DON = [2, 3, 4];
// ボーナス中の掛け枚数。1 枚掛けで自動（役構成の表でボーナス中の払い出しは 3 枚掛け・2 枚掛けとは別。
// 3 枚掛けで 15 枚の役はない）。有効ラインは 1 枚掛けと同じ中段だけ
export const BONUS_BET = 1;
