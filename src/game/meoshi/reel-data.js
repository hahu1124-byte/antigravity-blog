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
  // BIG はヒバナ BIG（女の子揃い。実機のドン BIG）と赤7 BIG（赤7 揃い）に分かれ、フラグも別
  big1: {
    flag: "bigDon",
    kind: "bonus",
    name: "ヒバナBIG",
    reels: [["D", "d"], ["D"], ["D"]],
  },
  big2: {
    flag: "bigSeven",
    kind: "bonus",
    name: "赤7BIG",
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
    // 払い出しが掛け枚数で変わる役は { 掛け枚数: 枚数 }（スマスロ ハナビの配当表: 1 枚掛けは 5 枚）
    pay: { 1: 5, 3: 8 },
  },
  // 左の小ドン（左 5 番）は風鈴の代わり。中・右から押して左の中段に風鈴が届かないとき、
  // 3 連のドンの位置で取りこぼさないようにする。揃えられるときは本物の風鈴を優先する（alt）
  fuurinAlt: {
    flag: "fuurin",
    kind: "small",
    name: "風鈴",
    reels: [["d"], FUURIN, FUURIN],
    pay: { 1: 5, 3: 8 },
    alt: true,
  },
  kori: {
    flag: "kori",
    kind: "small",
    name: "氷",
    // 暖簾は右リールだけ氷の代わり（p-town の配当表・1geki のリーチ目画像の重ね描きも右。
    // 左の暖簾は代わりにならないので、上段の「暖簾・氷・暖簾」はハズレ＝r34 のリーチ目）
    reels: [["I"], ["I"], ["I", "N"]],
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

// 抽選（確率の表）は game-rules.js

// 1 ライン分の払い出し（掛け枚数で変わる役は表から引く）
export function payOf(roleId, bet) {
  const p = ROLES[roleId].pay || 0;
  return typeof p === "number" ? p : p[bet];
}

// ボーナス成立中のゲームで、リーチ目の形を優先して止める割合（解析値が無いので仮の値）。
// 優先しないゲームでも、押し位置しだいでリーチ目になることはある
export const REACH_SHOW_RATE = 0.6;

// 遅れ（リール始動音が 0.8 秒遅れる）。1geki /43/: 遅れは 1/97.5、ボーナス期待度は全体で 20%、
// ボーナスでないときはチェリー。成立役ごとの率は非公開なので逆算した（設定 1 の確率で）:
//   チェリー成立時 = (0.8 / 97.5) ÷ (1/16.41) ≈ 13.5%、ボーナス成立ゲーム = (0.2 / 97.5) ÷ (1/169.8) ≈ 35%
export const DELAY_MS = 800;
export const DELAY_RATE = { cherry: 0.135, bonus: 0.35 };

// ボーナス（スマスロ ハナビ。1geki の配当表・/61/・/63/）
// BB: 279 枚を超えたら終了。枚数調整（左リール中段に赤7 をビタ押しで 14 枚役・1 回だけ）の 14 枚は
// 279 枚の数に入れない（ユーザーの計算: 15 枚 × 19G ＋ 14 枚 × 1G で純増 12×19＋11 ＝ 最大 239 枚）
export const BIG_END_PAYOUT = 279;
export const BB_VITA_PAY = 14;
// RB: 12 ゲームか 8 回入賞で終了（最大 96 枚 ＝ 15×8 − 3×8）。1 枚役が成立すると予告音が鳴り、
// 左リールに 3 連ドンを狙うと外せる（入賞回数を 1 枚役で使わないため）。共通 15 枚役でも予告音は鳴る
export const REG_END_GAMES = 12;
export const REG_END_WINS = 8;
// 3 連ドンの位置（左リールの 0 始まりの番号）。窓にどれか 1 つでも入っていれば外し成功（アバウトで OK）
export const TRIPLE_DON = [2, 3, 4];
// ボーナス中は自動で 3 枚掛け（REG の最大 96 枚が 3 枚掛けでぴったり合う。ユーザー決定）
export const BONUS_BET = 3;
