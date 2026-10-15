// CPU の強さの段階（cpu.js の think が使う）。入門・初級・上級は Lv1〜Lv3、その上に最強
//   nodes: 1 手に読む局面数の上限（0 は上限なし＝byoyomi まで読む）
//   multiPv: 候補手をいくつ出させるか
//   margin: 最善との点差（評価値）がこの幅に入る候補から選ぶ（0 は常に最善）
//   mateRule: false なら詰みも見逃し、詰まされる手も指す（既定 true）
//   byoyomi: エンジンが 1 手に読む時間の上限（ms）。画面で待つ時間は game.js の思考時間の演出
//   rating: あなたの強さの判定に使う、その段のレーティング（rating.js）
//
// 決め方（2026-10-15・scripts/shogi/selfplay.mjs）: ユーザー指示「となりの Lv どうしで弱い側の勝率 30% ほど
// （入門Lv3 対 初級Lv1 も）、各段階の Lv1 と一つ上の段階の Lv1 では 0% ほど、上級Lv3 対 最強は前のまま」。
// となりどうしを 100 局ずつ対戦させ、勝率を Elo の差に直して足し上げた強さから、
// 上級Lv3（前の上級・8000/4/40）を固定して 30%（約 147）ずつ下へ割り付け、3 回り測って直した。
// 決めた段での弱い側の勝率（となり 100 局ずつ）: 29・36・26・34・38・28・29・27%、
// 入門Lv1 対 初級Lv1 3%・初級Lv1 対 上級Lv1 5%（40 局）、上級Lv3 対 最強 0%（10 局）。
// rating は入門Lv1 を 300 とし、上の勝率の Elo の差を足し上げた値（最強は上級Lv3 から +600 の推定）
export const LEVELS = [
  {
    id: 1,
    group: "入門",
    lv: 1,
    nodes: 3000,
    multiPv: 8,
    margin: 1270,
    rating: 300,
  },
  {
    id: 2,
    group: "入門",
    lv: 2,
    nodes: 3000,
    multiPv: 8,
    margin: 890,
    rating: 455,
  },
  {
    id: 3,
    group: "入門",
    lv: 3,
    nodes: 3000,
    multiPv: 8,
    margin: 680,
    rating: 555,
  },
  {
    id: 4,
    group: "初級",
    lv: 1,
    nodes: 3000,
    multiPv: 8,
    margin: 457,
    rating: 736,
  },
  {
    id: 5,
    group: "初級",
    lv: 2,
    nodes: 3000,
    multiPv: 8,
    margin: 325,
    rating: 851,
  },
  {
    id: 6,
    group: "初級",
    lv: 3,
    nodes: 3000,
    multiPv: 8,
    margin: 200,
    rating: 936,
  },
  {
    id: 7,
    group: "上級",
    lv: 1,
    nodes: 3500,
    multiPv: 8,
    margin: 70,
    rating: 1100,
  },
  {
    id: 8,
    group: "上級",
    lv: 2,
    nodes: 5000,
    multiPv: 6,
    margin: 60,
    rating: 1255,
  },
  {
    id: 9,
    group: "上級",
    lv: 3,
    nodes: 8000,
    multiPv: 4,
    margin: 40,
    rating: 1428,
  },
  {
    id: 10,
    group: "最強",
    lv: 0,
    nodes: 0,
    multiPv: 1,
    margin: 0,
    byoyomi: 2000,
    rating: 2028,
  },
].map((l) => ({
  byoyomi: 3000,
  ...l,
  name: l.lv ? `${l.group} Lv${l.lv}` : l.group,
}));

// 評価値の表示に使う読み（段階とは別。6 万局面・候補 1）
export const EVAL_LEVEL = {
  nodes: 60000,
  multiPv: 1,
  margin: 0,
  byoyomi: 3000,
};
