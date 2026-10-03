/* --- EVA15風 演出の宣言データ --- */

// ============================================================
// trust: でちゃう！「新世紀エヴァンゲリオン〜未来への咆哮〜」演出信頼度特集の
//        ノーマルモードの値（%）。100 は大当り濃厚（only で確変種別に絞れば確変濃厚）
// share: 「当りの何%にこの演出が出るか」の推定値（実機非公開。ここだけ触れば調整できる）
//        リーチに紐づく層（EVA_LINKED_N）では「そのリーチの当りの何%に出るか」
// hit/miss: 本数を直接書いたもの（シミュ専用の当該レバブルと ST 中の旧来の値）
// only: 当り本数を置く当り種別（確変濃厚の演出は EVA_KAKUHEN）
// 本数はすべて 2^20 回転あたり。読み込み時に eva-engine.js が整数テーブルにする。
// ============================================================
const EVA_BIT = 1048576; // 2^20
const EVA_N_HIT = 3280; // 通常/時短 1/319.688（旧 205/65536 と同じ確率）
const EVA_S_HIT = 10544; // ST 1/99.448（旧 659/65536 と同じ確率）

// 当り種別：ヘソ当りの振り分け（実機 10R確変 3.0%・3R確変 56%・3R通常 41%）
const EVA_CLASSES_N = [
  { id: "r10", label: "10R確変", n: 98, hit: true, st: true },
  { id: "k3", label: "3R確変", n: 1837, hit: true, st: true },
  { id: "t3", label: "3R通常", n: 1345, hit: true, st: false },
  {
    id: "miss",
    label: "ハズレ",
    n: EVA_BIT - EVA_N_HIT,
    hit: false,
    st: false,
  },
];
// ST（右打ち）の当りはすべて 10R 確変
const EVA_CLASSES_S = [
  { id: "r10", label: "10R確変", n: EVA_S_HIT, hit: true, st: true },
  {
    id: "miss",
    label: "ハズレ",
    n: EVA_BIT - EVA_S_HIT,
    hit: false,
    st: false,
  },
];
const EVA_KAKUHEN = ["r10", "k3"];
// 3R確変のうち偶数図柄で揃えて昇格で見せる割合（見た目だけ。確率には関係しない）
const EVA_UPGRADE_RATE = 0.183;

const EVA_SP_REACHES = [
  "synchro",
  "zero",
  "ni",
  "sho",
  "armisael",
  "sahaquiel",
  "final",
];

// --- 通常/時短：リーチに依存しない層（層の中は排他） ---
const EVA_LAYERS_N = [
  {
    key: "hold",
    label: "保留",
    states: [
      { id: "red", name: "赤保留", trust: 91.0, share: 20, holdType: "red" },
      { id: "green", name: "緑保留", trust: 1.5, share: 6, holdType: "green" },
      { id: "blue", name: "青保留", trust: 0.5, share: 5, holdType: "blue" },
    ],
  },
  {
    key: "precursor",
    label: "前兆",
    states: [
      {
        id: "countdown",
        name: "カウントダウン",
        trust: 75.4,
        share: 10,
        text: "３２１０",
      },
    ],
  },
  {
    // 実機は「デバイス振動先読み」のショート/ロングだけ。当該変動の白/赤/虹はシミュ専用で旧来の値のまま
    key: "lever",
    label: "当該レバブル",
    states: [
      {
        id: "white",
        name: "白レバブル",
        hit: 1440,
        miss: 160,
        vibeColor: "white",
      },
      { id: "red", name: "赤レバブル", hit: 640, miss: 16, vibeColor: "red" },
      {
        id: "rainbow",
        name: "虹レバブル",
        hit: 112,
        miss: 0,
        only: EVA_KAKUHEN,
        vibeColor: "rainbow",
      },
    ],
  },
  {
    // リーチは親の層。10R確変はすべて全回転リーチ、他のリーチは 3R の当りに置く
    key: "reach",
    label: "リーチ",
    isReach: true,
    hitClasses: ["k3", "t3"],
    states: [
      {
        id: "zenkaiten",
        name: "全回転リーチ",
        trust: 100,
        all: true,
        only: ["r10"],
        text: "全回転リーチ\n祝",
      },
      {
        id: "final",
        name: "最終号機リーチ",
        trust: 70.5,
        share: 15,
        text: "最終号機リーチ",
      },
      {
        id: "sahaquiel",
        name: "vsサハクィエル",
        trust: 65.2,
        share: 9,
        text: "VSサハクィエル",
      },
      {
        id: "armisael",
        name: "vsアルミサエル",
        trust: 56.8,
        share: 11,
        text: "VSアルミサエル",
      },
      {
        id: "sho",
        name: "初号機リーチ",
        trust: 34.8,
        share: 30,
        text: "初号機リーチ",
      },
      {
        id: "zero",
        name: "零号機リーチ",
        trust: 10.2,
        share: 8,
        text: "零号機リーチ",
      },
      {
        id: "ni",
        name: "弐号機リーチ",
        trust: 7.2,
        share: 6,
        text: "弐号機リーチ",
      },
      // シンクロ経由の当りは暴走ボーナス（ST 確定の 3R）
      {
        id: "synchro",
        name: "シンクロリーチ",
        trust: 3.1,
        share: 4,
        only: ["k3"],
        text: "シンクロリーチ",
      },
      { id: "normal", name: "ノーマルリーチ", trust: 0.4, share: 10 },
    ],
  },
];

// --- 通常/時短：リーチに紐づく層（リーチ×当否で条件付き・層の中は排他） ---
const EVA_LINKED_N = [
  {
    key: "after",
    label: "リーチ後予告",
    reaches: EVA_SP_REACHES,
    states: [
      {
        id: "rei-bg",
        name: "レイ背景",
        trust: 85.4,
        share: 12,
        text: "レイ背景",
      },
      // 旧レイ・アスカ・ユイ・加持・キール・零号機の背景は大当り濃厚（確変までは決まらない）
      {
        id: "premium-bg",
        name: "プレミア背景",
        trust: 100,
        share: 2,
        text: "プレミア背景",
      },
      {
        id: "kaworu-bg",
        name: "カヲル背景",
        trust: 100,
        share: 2,
        only: EVA_KAKUHEN,
        text: "来なさい",
      },
      // 群予告は実戦上 400 回転以降のみ
      {
        id: "gun-rei",
        name: "群予告(レイ)",
        trust: 81.8,
        share: 3,
        minRot: 401,
        text: "群予告",
      },
      {
        id: "gun-asuka",
        name: "群予告(アスカ)",
        trust: 80.4,
        share: 3,
        minRot: 401,
        text: "群予告",
      },
      {
        id: "gun-shinji",
        name: "群予告(シンジ)",
        trust: 87.3,
        share: 3,
        minRot: 401,
        text: "群予告",
      },
      {
        id: "gun-kaworu",
        name: "群予告(カヲル)",
        trust: 100,
        share: 0.5,
        only: EVA_KAKUHEN,
        minRot: 401,
        text: "群予告",
      },
    ],
  },
];

// --- ST（旧来の 5 軸の値を 16 倍。ST 中の当りはすべて 10R 確変） ---
const EVA_LAYERS_S = [
  {
    key: "hold",
    label: "保留",
    states: [
      { id: "red", name: "赤保留", hit: 4800, miss: 0, holdType: "red" },
      { id: "green", name: "緑保留", hit: 3200, miss: 3904, holdType: "green" },
      { id: "blue", name: "青保留", hit: 1600, miss: 3728, holdType: "blue" },
    ],
  },
  {
    key: "background",
    label: "背景予告",
    states: [
      { id: "rei-bg", name: "レイ背景", hit: 6720, miss: 0, text: "レイ背景" },
      {
        id: "premium-bg",
        name: "プレミア背景",
        hit: 1920,
        miss: 0,
        text: "プレミア背景",
      },
      {
        id: "kaworu-bg",
        name: "渚カヲル",
        hit: 1600,
        miss: 0,
        text: "来なさい",
      },
    ],
  },
  {
    key: "precursor",
    label: "先読み",
    states: [
      {
        id: "countdown",
        name: "カウントダウン",
        hit: 6720,
        miss: 752,
        text: "３２１０",
      },
      { id: "gun", name: "群予告", hit: 2880, miss: 0, text: "群予告" },
    ],
  },
  {
    key: "lever",
    label: "当該レバブル",
    states: [
      {
        id: "white",
        name: "白レバブル",
        hit: 6720,
        miss: 0,
        vibeColor: "white",
      },
      { id: "red", name: "赤レバブル", hit: 2880, miss: 0, vibeColor: "red" },
      {
        id: "rainbow",
        name: "虹レバブル",
        hit: 800,
        miss: 0,
        vibeColor: "rainbow",
      },
    ],
  },
  {
    key: "reach",
    label: "リーチ",
    isReach: true,
    states: [
      {
        id: "zenkaiten",
        name: "全回転リーチ",
        hit: 512,
        miss: 0,
        text: "全回転リーチ\n祝",
      },
      {
        id: "armisael",
        name: "vsアルミサエル",
        hit: 2880,
        miss: 640,
        text: "VSアルミサエル",
      },
      {
        id: "sahaquiel",
        name: "vsサハクィエル",
        hit: 2944,
        miss: 320,
        text: "VSサハクィエル",
      },
      {
        id: "final",
        name: "最終号機リーチ",
        hit: 4032,
        miss: 192,
        text: "最終号機リーチ",
      },
    ],
  },
];
const EVA_LINKED_S = [];
