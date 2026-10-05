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
    pay: 15,
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

// 通常時の抽選（分母 65536）。2015 年版の設定 1 の解析値:
// BIG 1/312.1・REG 1/385.5・風鈴 1/15.66・氷 1/52.85（平行）＋1/1638.4（斜め）
// リプレイとチェリーは通常時の値が見つからないので参考値（リプレイは花火ゲーム中の 1/7.30 を流用）
export const LOTTERY_DENOM = 65536;
export const LOTTERY = [
  { flag: "big", weight: 210 },
  { flag: "reg", weight: 170 },
  { flag: "replay", weight: 8978 }, // 約 1/7.30（参考値）
  { flag: "fuurin", weight: 4185 }, // 約 1/15.66
  { flag: "kori", weight: 1280 }, // 約 1/51.2（平行と斜めの合算）
  { flag: "cherry", weight: 1638 }, // 約 1/40（参考値）
];

// ボーナスの終わり方（2015 年版）
export const BIG_END_PAYOUT = 344; // 344 枚を超えたら終了
export const REG_END_PAYOUT = 105; // 105 枚を超えたら終了
export const BET = 3;
