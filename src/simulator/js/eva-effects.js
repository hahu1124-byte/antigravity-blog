/* --- EVA15風 演出の宣言データ --- */

// ============================================================
// trust: 信頼度（%）。通常時はでちゃう！「新世紀エヴァンゲリオン〜未来への咆哮〜」演出信頼度特集の
//        ノーマルモード、ST はパチ７「【演出信頼度まとめ】新世紀エヴァンゲリオン～未来への咆哮～」の
//        IMPACT MODE（レイモード以外＝シンジモード）の値。100 は濃厚
//        （only で確変種別に絞れば確変濃厚、r10 だけなら 10R確変濃厚）。
//        当該レバブルはシミュ専用の値。
// share: 「単独で出たとき当りの何%を占めるか」の重み（実機非公開の推定値。ここだけ触れば調整できる）。
//        当り確率を固定するため、信頼度 100% 未満の演出は読み込み時に一律で縮められる
//        （eva-engine.js の alpha）。信頼度 100% の演出は縮めない＝そのまま当りの share% になる。
// rate: リーチが決まった後の出現率（SP リーチに必ず付く部品の層だけ）。数値かリーチ id ごとの表。
// forceKakuhen: この演出で当ったら 3R確変（シンクロ経由の暴走ボーナス）。
// ============================================================
const EVA_BIT = 1048576; // 2^20
const EVA_N_HIT = 3280; // 通常/時短 1/319.688
const EVA_S_HIT = 10544; // ST 1/99.448

// 当り種別：ヘソ当りの振り分け（実機 10R確変 3.0%・3R確変 56%・3R通常 41%）。n は比だけに使う
const EVA_CLASSES_N = [
  { id: "r10", label: "10R確変", n: 98, hit: true, st: true },
  { id: "k3", label: "3R確変", n: 1837, hit: true, st: true },
  { id: "t3", label: "3R通常", n: 1345, hit: true, st: false },
];
// ST（右打ち）の当りはすべて 10R 確変
const EVA_CLASSES_S = [
  { id: "r10", label: "10R確変", n: 1, hit: true, st: true },
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
      { id: "red", name: "赤保留", trust: 91.0, share: 8, holdType: "red" },
      { id: "green", name: "緑保留", trust: 1.5, share: 2, holdType: "green" },
      { id: "blue", name: "青保留", trust: 0.5, share: 1.5, holdType: "blue" },
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
        share: 4,
        text: "３２１０",
      },
    ],
  },
  {
    // 実機は「デバイス振動先読み」のショート/ロングだけ。当該変動の白/赤/虹はシミュ専用
    // （信頼度は旧来の 90 / 97.6 / 100%。出るのは当りの約2割）
    key: "lever",
    label: "当該レバブル",
    states: [
      {
        id: "white",
        name: "白レバブル",
        trust: 90,
        share: 12,
        vibeColor: "white",
      },
      {
        id: "red",
        name: "赤レバブル",
        trust: 97.6,
        share: 6,
        vibeColor: "red",
      },
      {
        id: "rainbow",
        name: "虹レバブル",
        trust: 100,
        share: 2,
        only: EVA_KAKUHEN,
        vibeColor: "rainbow",
      },
    ],
  },
  {
    // リーチは親の層。10R確変はすべて全回転リーチ（でちゃう！「全回転大当り＝通常時の10R確変当り」）
    key: "reach",
    label: "リーチ",
    isReach: true,
    states: [
      {
        id: "zenkaiten",
        name: "全回転リーチ",
        trust: 100,
        share: 3,
        only: ["r10"],
        text: "全回転リーチ\n祝",
      },
      {
        id: "final",
        name: "最終号機リーチ",
        trust: 70.5,
        share: 12,
        text: "最終号機リーチ",
      },
      {
        id: "sahaquiel",
        name: "vsサハクィエル",
        trust: 65.2,
        share: 7,
        text: "VSサハクィエル",
      },
      {
        id: "armisael",
        name: "vsアルミサエル",
        trust: 56.8,
        share: 8,
        text: "VSアルミサエル",
      },
      {
        id: "sho",
        name: "初号機リーチ",
        trust: 34.8,
        share: 18,
        text: "初号機リーチ",
      },
      {
        id: "zero",
        name: "零号機リーチ",
        trust: 10.2,
        share: 4,
        text: "零号機リーチ",
      },
      {
        id: "ni",
        name: "弐号機リーチ",
        trust: 7.2,
        share: 3,
        text: "弐号機リーチ",
      },
      // シンクロ経由の当りは暴走ボーナス（ST 確定の 3R）
      {
        id: "synchro",
        name: "シンクロリーチ",
        trust: 3.1,
        share: 2,
        forceKakuhen: true,
        text: "シンクロリーチ",
      },
      { id: "normal", name: "ノーマルリーチ", trust: 0.2, share: 4 },
    ],
  },
];

// --- 通常/時短：リーチに紐づく層（SP リーチのときだけ出る） ---
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
        share: 4,
        text: "レイ背景",
      },
      // 旧レイ・アスカ・ユイ・加持・キール・零号機の背景は大当り濃厚（確変までは決まらない）
      {
        id: "premium-bg",
        name: "プレミア背景",
        trust: 100,
        share: 1,
        text: "プレミア背景",
      },
      {
        id: "kaworu-bg",
        name: "カヲル背景",
        trust: 100,
        share: 1,
        only: EVA_KAKUHEN,
        text: "来なさい",
      },
      // 群予告は実戦上 400 回転以降のみ
      {
        id: "gun-rei",
        name: "群予告(レイ)",
        trust: 81.8,
        share: 1.5,
        minRot: 401,
        text: "群予告",
      },
      {
        id: "gun-asuka",
        name: "群予告(アスカ)",
        trust: 80.4,
        share: 1.5,
        minRot: 401,
        text: "群予告",
      },
      {
        id: "gun-shinji",
        name: "群予告(シンジ)",
        trust: 87.3,
        share: 1.5,
        minRot: 401,
        text: "群予告",
      },
      {
        id: "gun-kaworu",
        name: "群予告(カヲル)",
        trust: 100,
        share: 0.3,
        only: EVA_KAKUHEN,
        minRot: 401,
        text: "群予告",
      },
    ],
  },
];

// ============================================================
// ST「IMPACT MODE」シンジモード（違和感保留の 3 種はでちゃう！の同じ表の値）
// ST 中の当りはすべて 10R 確変なので、濃厚の演出はすべて「当り濃厚」になる。
// ============================================================
const EVA_ST_SOKU_SP = ["sakiel", "zeruel"];
const EVA_ST_EVA_SP = ["st-sho", "st-ni", "st-zero"];
const EVA_ST_SP = [...EVA_ST_SOKU_SP, ...EVA_ST_EVA_SP, "dummy", "mission"];

const EVA_LAYERS_S = [
  {
    key: "hold",
    label: "保留",
    states: [
      { id: "red", name: "赤保留", trust: 95.1, share: 4, holdType: "red" },
      {
        id: "green",
        name: "緑保留",
        trust: 41.9,
        share: 1.5,
        holdType: "green",
      },
      { id: "blue", name: "青保留", trust: 20.8, share: 1, holdType: "blue" },
      {
        id: "rainbow",
        name: "虹保留",
        trust: 100,
        share: 0.5,
        holdType: "rainbow",
      },
      {
        id: "odd-reverse",
        name: "違和感保留(文字が逆に流れる)",
        trust: 69.8,
        share: 1,
        holdType: "vibe",
      },
      {
        id: "odd-noise",
        name: "違和感保留(全体にノイズ)",
        trust: 28.0,
        share: 0.3,
        holdType: "vibe",
      },
      {
        id: "odd-blank",
        name: "違和感保留(中の文字なし)",
        trust: 13.9,
        share: 0.2,
        holdType: "vibe",
      },
    ],
  },
  {
    key: "lever-pre",
    label: "レバブル先読み",
    states: [
      {
        id: "short",
        name: "レバブル先読み(ショート)",
        trust: 95.6,
        share: 1.5,
        text: "レバブル先読み",
      },
      {
        id: "long",
        name: "レバブル先読み(ロング)",
        trust: 100,
        share: 0.5,
        text: "レバブル先読み\nロング",
      },
    ],
  },
  {
    key: "precursor",
    label: "前兆",
    states: [
      {
        id: "countdown",
        name: "カウントダウン",
        trust: 85.2,
        share: 2,
        text: "３２１０",
      },
      {
        id: "countdown-kaworu",
        name: "カウントダウン(0:カヲル)",
        trust: 100,
        share: 0.3,
        text: "３２１カヲル",
      },
      {
        id: "eyecatch-red",
        name: "アイキャッチ(赤)",
        trust: 69.5,
        share: 1.5,
        text: "アイキャッチ",
      },
      {
        id: "eyecatch-white",
        name: "アイキャッチ(白×4)",
        trust: 29.5,
        share: 0.3,
        text: "アイキャッチ",
      },
      {
        id: "dokkun",
        name: "ドックン",
        trust: 66.4,
        share: 1,
        text: "ドックン",
      },
      {
        id: "dokkun-red",
        name: "ドックン(赤)",
        trust: 84.8,
        share: 1,
        text: "ドックン",
      },
      {
        id: "sakiel-pre",
        name: "使徒襲来(サキエル)",
        trust: 73.1,
        share: 1,
        text: "使徒襲来",
      },
      {
        id: "zeruel-pre",
        name: "使徒襲来(ゼルエル)",
        trust: 17.3,
        share: 0.3,
        text: "使徒襲来",
      },
      {
        id: "accel",
        name: "初号機加速",
        trust: 31.9,
        share: 0.5,
        text: "初号機加速",
      },
      {
        id: "mission-pre",
        name: "ミッションモード前兆",
        trust: 45.2,
        share: 1,
        text: "CAUTION",
      },
      {
        id: "search-pre",
        name: "敵探索前兆",
        trust: 13.1,
        share: 0.3,
        text: "警報",
      },
    ],
  },
  {
    key: "screen",
    label: "画面系の前兆",
    states: [
      {
        id: "logo-green",
        name: "ロゴフラッシュ(緑ロング)",
        trust: 79.1,
        share: 1,
      },
      {
        id: "logo-red",
        name: "ロゴフラッシュ(赤ロング)",
        trust: 91.2,
        share: 1,
      },
      {
        id: "logo-rainbow",
        name: "ロゴフラッシュ(虹)",
        trust: 100,
        share: 0.2,
      },
      { id: "stop-green", name: "図柄停止時発光(緑)", trust: 45.2, share: 0.7 },
      { id: "stop-red", name: "図柄停止時発光(赤)", trust: 60.1, share: 0.7 },
      {
        id: "stop-rainbow",
        name: "図柄停止時発光(虹)",
        trust: 100,
        share: 0.2,
      },
      { id: "mute-white", name: "変動音オフ(白)", trust: 81.7, share: 1 },
      { id: "mute-red", name: "変動音オフ(赤)", trust: 90.7, share: 0.7 },
      {
        id: "remain-red",
        name: "残り回数表示(赤文字)",
        trust: 86.8,
        share: 0.7,
      },
      {
        id: "remain-noise",
        name: "残り回数表示(ノイズ大)",
        trust: 90.3,
        share: 0.4,
      },
      {
        id: "remain-shake",
        name: "残り回数表示(ガタガタ)",
        trust: 52.3,
        share: 0.4,
      },
      {
        id: "remain-rainbow",
        name: "残り回数表示(虹文字)",
        trust: 100,
        share: 0.1,
      },
      {
        id: "chance-bg",
        name: "チャンス背景変化",
        trust: 86.3,
        share: 1.5,
        text: "チャンス背景",
      },
      { id: "bg-noise", name: "背景ノイズ違和感(大)", trust: 80.0, share: 0.7 },
    ],
  },
  {
    key: "midway",
    label: "変動中予告",
    states: [
      {
        id: "su-white3",
        name: "ステップアップ(白SU3)",
        trust: 15.6,
        share: 0.5,
        text: "STEP UP",
      },
      {
        id: "su-white4",
        name: "ステップアップ(白SU4)",
        trust: 40.8,
        share: 0.7,
        text: "STEP UP 4",
      },
      {
        id: "su-red3",
        name: "ステップアップ(赤SU3)",
        trust: 62.1,
        share: 1,
        text: "STEP UP 赤",
      },
      {
        id: "su-gold3",
        name: "ステップアップ(金SU3)",
        trust: 93.3,
        share: 0.7,
        text: "STEP UP 金",
      },
      {
        id: "su-kaworu",
        name: "ステップアップ(カヲル)",
        trust: 100,
        share: 0.1,
        text: "STEP UP カヲル",
      },
      {
        id: "chance-green",
        name: "エヴァチャンス文字(CHANCE緑)",
        trust: 74.3,
        share: 1,
        text: "CHANCE",
      },
      {
        id: "chance-red",
        name: "エヴァチャンス文字(CHANCE赤)",
        trust: 63.4,
        share: 0.7,
        text: "CHANCE",
      },
      {
        id: "chance-other",
        name: "エヴァチャンス文字(CHANCE以外)",
        trust: 100,
        share: 0.2,
        text: "REACH",
      },
      {
        id: "shito-armisael",
        name: "新使徒予告(アルミサエル)",
        trust: 72.9,
        share: 0.7,
        text: "アルミサエル",
      },
      {
        id: "shito-shamshel",
        name: "新使徒予告(シャムシエル)",
        trust: 82.7,
        share: 0.7,
        text: "シャムシエル",
      },
      {
        id: "shito-kaworu",
        name: "新使徒予告(渚カヲル)",
        trust: 100,
        share: 0.1,
        text: "渚カヲル",
      },
      {
        id: "cut-white",
        name: "高速キャラカットSU(白SU4)",
        trust: 40.4,
        share: 0.7,
      },
      {
        id: "cut-red",
        name: "高速キャラカットSU(赤SU4)",
        trust: 74.3,
        share: 0.7,
      },
      {
        id: "cut-gold",
        name: "高速キャラカットSU(金SU4)",
        trust: 88.3,
        share: 0.5,
      },
      { id: "serif-2", name: "セリフ予告(2段階)", trust: 13.7, share: 0.5 },
      {
        id: "serif-3",
        name: "セリフ予告(3段階)",
        trust: 80.0,
        share: 1,
        text: "セリフ予告",
      },
      {
        id: "serif-premium",
        name: "セリフ予告(プレミア)",
        trust: 100,
        share: 0.2,
        text: "パーペキね",
      },
      {
        id: "search-isra-white",
        name: "敵探索(イスラフェル白文字)",
        trust: 46.9,
        share: 0.4,
        text: "イスラフェル",
      },
      {
        id: "search-isra-red",
        name: "敵探索(イスラフェル赤文字)",
        trust: 65.0,
        share: 0.4,
        text: "イスラフェル",
      },
      {
        id: "search-sham-white",
        name: "敵探索(シャムシエル白文字)",
        trust: 66.7,
        share: 0.4,
        text: "シャムシエル",
      },
      {
        id: "search-sham-red",
        name: "敵探索(シャムシエル赤文字)",
        trust: 78.9,
        share: 0.4,
        text: "シャムシエル",
      },
      {
        id: "panel-right",
        name: "パネル予告(右選択・左金)",
        trust: 93.6,
        share: 0.4,
        text: "パネル予告",
      },
      {
        id: "panel-left",
        name: "パネル予告(左選択・左赤右金)",
        trust: 62.2,
        share: 0.4,
        text: "パネル予告",
      },
      {
        id: "panel-kaji",
        name: "パネル予告(加持・金)",
        trust: 93.8,
        share: 0.2,
        text: "パネル予告",
      },
      {
        id: "push-red",
        name: "押しボタン(押せ文字赤)",
        trust: 72.1,
        share: 0.7,
        text: "PUSH",
      },
      { id: "push", name: "押しボタン", trust: 40.9, share: 0.7, text: "PUSH" },
      {
        id: "next-preview",
        name: "新次回予告",
        trust: 100,
        share: 0.2,
        text: "次回予告\nサービス、サービス",
      },
    ],
  },
  {
    key: "flash",
    label: "一発告知・枠フラッシュ",
    states: [
      {
        id: "impact-flash",
        name: "インパクトフラッシュ",
        trust: 100,
        share: 1,
        text: "IMPACT",
      },
      {
        id: "fukuin-air",
        name: "福音エアー",
        trust: 100,
        share: 0.5,
        text: "福音エアー",
      },
      { id: "kaworu-button", name: "カヲルボタン", trust: 100, share: 0.2 },
      { id: "frame-eye", name: "枠初号機眼光", trust: 100, share: 0.2 },
      { id: "frame-weak", name: "枠フラッシュ(弱・白)", trust: 48.4, share: 1 },
      {
        id: "frame-strong",
        name: "枠フラッシュ(強・赤)",
        trust: 91.6,
        share: 1,
      },
      { id: "frame-late", name: "枠フラッシュ(遅れ)", trust: 100, share: 0.2 },
    ],
  },
  {
    // シミュ専用の当該レバブル。ST 中はどれも当り確定、出るのは当りの約2割
    // （ユーザー方針 2026-10-03）。白:赤:虹 の比は旧来（6720:2880:800）のまま
    key: "lever",
    label: "当該レバブル",
    states: [
      {
        id: "white",
        name: "白レバブル",
        trust: 100,
        share: 12.93,
        vibeColor: "white",
      },
      {
        id: "red",
        name: "赤レバブル",
        trust: 100,
        share: 5.54,
        vibeColor: "red",
      },
      {
        id: "rainbow",
        name: "虹レバブル",
        trust: 100,
        share: 1.53,
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
        id: "sakiel",
        name: "即SP vsサキエル",
        trust: 84.9,
        share: 12,
        text: "VSサキエル",
      },
      {
        id: "zeruel",
        name: "即SP vsゼルエル",
        trust: 26.8,
        share: 4,
        text: "VSゼルエル",
      },
      {
        id: "st-sho",
        name: "初号機vsシャムシエル",
        trust: 71.5,
        share: 8,
        text: "初号機VSシャムシエル",
      },
      {
        id: "st-ni",
        name: "弐号機vs量産型",
        trust: 60.2,
        share: 5,
        text: "弐号機VS量産型",
      },
      {
        id: "st-zero",
        name: "零号機vsイスラフェル",
        trust: 55.8,
        share: 3,
        text: "零号機VSイスラフェル",
      },
      {
        id: "dummy",
        name: "ダミー初号機リーチ",
        trust: 80.5,
        share: 8,
        text: "ダミー初号機リーチ",
      },
      {
        id: "mission",
        name: "ミッションモード",
        trust: 42.5,
        share: 3,
        text: "ミッションモード",
      },
      {
        id: "zenkaiten",
        name: "全回転リーチ",
        trust: 100,
        share: 2,
        text: "全回転リーチ\n祝",
      },
      // SP に発展しないテンパイ（図柄煽り）
      { id: "tenpai", name: "図柄テンパイ", trust: 5, share: 3 },
    ],
  },
];

// ST：SP リーチに必ず付く部品の層（信頼度の最大には使うが「2 つ以上」には数えない）。
// rate はそのリーチのときに出る割合の推定値
const EVA_LINKED_S = [
  {
    key: "device",
    label: "入力デバイス",
    component: true,
    reaches: [...EVA_ST_SOKU_SP, ...EVA_ST_EVA_SP],
    states: [
      {
        id: "soku-button",
        name: "入力デバイス(即SP・ボタン)",
        trust: 18.7,
        reaches: EVA_ST_SOKU_SP,
        rate: { sakiel: 0.2, zeruel: 0.85 },
      },
      {
        id: "soku-lever",
        name: "入力デバイス(即SP・レバー)",
        trust: 83.5,
        reaches: EVA_ST_SOKU_SP,
        rate: { sakiel: 0.75, zeruel: 0.1 },
      },
      {
        id: "eva-button",
        name: "入力デバイス(エヴァ系・ボタン)",
        trust: 41.4,
        reaches: EVA_ST_EVA_SP,
        rate: { "st-sho": 0.4, "st-ni": 0.5, "st-zero": 0.55 },
      },
      {
        id: "eva-lever",
        name: "入力デバイス(エヴァ系・レバー)",
        trust: 84.3,
        reaches: EVA_ST_EVA_SP,
        rate: { "st-sho": 0.55, "st-ni": 0.45, "st-zero": 0.4 },
      },
      {
        id: "lever-heavy",
        name: "入力デバイス(レバーが重い)",
        trust: 100,
        rate: 0.025,
        text: "レバー抵抗",
      },
      {
        id: "lever-auto",
        name: "入力デバイス(自動引き込み)",
        trust: 100,
        rate: 0.025,
        text: "自動引き込み",
      },
    ],
  },
  {
    key: "launch",
    label: "SP発展演出",
    component: true,
    reaches: [...EVA_ST_EVA_SP, "dummy"],
    states: [
      { id: "three", name: "SP発展(3機発進)", trust: 58.9, rate: 0.75 },
      {
        id: "solo-zero",
        name: "SP発展(零号機単機)",
        trust: 80.7,
        reaches: ["st-zero"],
        rate: 0.2,
        text: "零号機 単機発進",
      },
      {
        id: "solo-ni",
        name: "SP発展(弐号機単機)",
        trust: 83.4,
        reaches: ["st-ni"],
        rate: 0.2,
        text: "弐号機 単機発進",
      },
      {
        id: "solo-sho",
        name: "SP発展(初号機単機)",
        trust: 90.0,
        reaches: ["st-sho", "dummy"],
        rate: 0.2,
        text: "初号機 単機発進",
      },
      {
        id: "launch-premium",
        name: "SP発展(プレミアム)",
        trust: 100,
        rate: 0.01,
        text: "プレミアム発進",
      },
    ],
  },
  {
    key: "shutter",
    label: "リーチ時シャッター",
    component: true,
    reaches: EVA_ST_SP,
    states: [
      {
        id: "shutter-normal",
        name: "シャッター(通常)",
        trust: 30.0,
        rate: 0.55,
      },
      {
        id: "shutter-red",
        name: "シャッター(赤)",
        trust: 73.4,
        rate: {
          sakiel: 0.25,
          zeruel: 0.05,
          "st-sho": 0.25,
          "st-ni": 0.2,
          "st-zero": 0.15,
          dummy: 0.25,
          mission: 0.1,
        },
        text: "赤シャッター",
      },
      {
        id: "shutter-gold",
        name: "シャッター(金)",
        trust: 94.3,
        rate: {
          sakiel: 0.08,
          zeruel: 0.01,
          "st-sho": 0.06,
          "st-ni": 0.04,
          "st-zero": 0.03,
          dummy: 0.08,
          mission: 0.02,
        },
        text: "金シャッター",
      },
      {
        id: "shutter-dummy",
        name: "シャッター(ダミープラグ)",
        trust: 78.8,
        reaches: ["dummy"],
        rate: 0.1,
        text: "ダミープラグ",
      },
    ],
  },
];
