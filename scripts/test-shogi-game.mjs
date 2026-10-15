// 将棋 CPU 対局（GAME /game/shogi/）の試験。終局の判定・KIF の書き出し・エンジンが合法手を返すか
// 使い方: node scripts/test-shogi-game.mjs（NG が 1 件でもあれば終了コード 1）
import fs from "node:fs/promises";

const game = new URL("../src/game/shogi/", import.meta.url);
const core = await import(
  new URL("../src/lab/shogi/js/core.js", import.meta.url).href
);
const { Position, legalMoves, moveFromUsi, moveToUsi, BLACK, WHITE } = core;
const { START, record, initialRecord, judge, toKif } = await import(
  new URL("js/rules.js", game).href
);

const t0 = performance.now();
let fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got),
    w = JSON.stringify(want);
  if (g !== w) {
    fail++;
    console.log("NG", name, g, "（期待", w, "）");
  } else console.log("OK", name, g);
};

// sfen から usi の手順を指し、手ごとに judge した結果の最後と、それが出た手数を返す
function playLine(sfen, usiLine) {
  const pos = Position.fromSfen(sfen);
  const history = [initialRecord(pos)];
  let result = null,
    at = 0;
  for (const u of usiLine.split(" ")) {
    const m = moveFromUsi(pos, u);
    if (m === null) throw new Error(`指せない手 ${u}`);
    const side = pos.side;
    pos.doMove(m);
    history.push(record(pos, side));
    at++;
    result = judge(pos, history);
    if (result) break;
  }
  return { result, at };
}

// 1. 詰み
eq("頭金で詰み", playLine("4k4/9/4P4/9/9/9/9/9/9 b G 1", "G*5b").result, {
  kind: "mate",
  winner: BLACK,
});

// 2. 千日手: 玉が行ったり来たりして、同じ局面が 4 回目になった手で引き分け
//    最初の局面も 1 回目に数えるので、4 手で 1 周して 12 手目
{
  const cycle = "5i5h 5a5b 5h5i 5b5a";
  const r = playLine(
    "4k4/9/9/9/9/9/9/9/4K4 b - 1",
    Array(5).fill(cycle).join(" "),
  );
  eq("千日手", r.result, { kind: "sennichite", winner: null });
  eq("千日手になる手数", r.at, 12);
}

// 3. 連続王手の千日手: 先手が王手を続けて同じ局面が 4 回 → 先手の負け
{
  const cycle = "2i1i 1a2b 1i2i 2b1a";
  const r = playLine(
    "8k/9/9/9/9/9/9/9/K6R1 b - 1",
    Array(5).fill(cycle).join(" "),
  );
  eq("連続王手の千日手", r.result, { kind: "perpetual", winner: WHITE });
}

// 4. KIF の書き出し（成る手・「同」・打つ手）
{
  const start = Position.fromSfen(START);
  const p = start.clone();
  const moves = "7g7f 3c3d 8h2b+ 3a2b B*4e".split(" ").map((u) => {
    const m = moveFromUsi(p, u);
    p.doMove(m);
    return m;
  });
  const kif = toKif(start, moves, {
    black: "あなた",
    white: "CPU",
    endText: "中断",
  });
  eq("KIF の指し手", kif.split("\n").slice(5, 11), [
    "   1 ７六歩(77)",
    "   2 ３四歩(33)",
    "   3 ２二角成(88)",
    "   4 同　銀(31)",
    "   5 ４五角打",
    "   6 中断",
  ]);
}

// 4-2. 候補手の読み取りと、強さに応じた手の選び方
{
  const { parseCandidates, pick } = await import(
    new URL("js/cpu.js", game).href
  );
  const lines = [
    "info depth 5 multipv 1 score cp 120 nodes 900 pv 7g7f 3c3d",
    "info depth 5 multipv 2 score cp 40 nodes 900 pv 2g2f 8c8d",
    "info depth 5 multipv 3 score cp -300 nodes 900 pv 5g5f 3c3d",
    "info depth 6 multipv 1 score cp 150 lowerbound nodes 1200 pv 7g7f",
    "info depth 5 multipv 4 score mate -3 nodes 900 pv 9g9f 8b2b",
  ];
  const c = parseCandidates(lines);
  eq(
    "候補手の読み取り（lowerbound は捨てる・詰まされる手は最後）",
    c.map((x) => [x.move, x.score]),
    [
      ["7g7f", 120],
      ["2g2f", 40],
      ["5g5f", -300],
      ["9g9f", -29997],
    ],
  );
  eq("幅 0 なら最善", pick("7g7f", c, { margin: 0 }), "7g7f");
  // 幅 100: 120 と 40 の 2 つから選ぶ（乱数で両方とも出る・-300 と詰まされる手は出ない）
  const got = new Set();
  for (let i = 0; i < 50; i++)
    got.add(pick("7g7f", c, { margin: 100 }, () => i / 50));
  eq("幅 100 で選ばれる手", [...got].sort(), ["2g2f", "7g7f"]);
  eq(
    "詰ます手があれば幅があっても選ぶ",
    pick(
      "1a1b",
      [
        { move: "1a1b", score: 29995 },
        { move: "2a2b", score: 500 },
      ],
      { margin: 800 },
    ),
    "1a1b",
  );
  eq("投了はそのまま", pick("resign", c, { margin: 800 }), "resign");
}

// 4-3. レーティングと評価値の表示
{
  const { eloDiff, expected, updateRating, nearestLevel } = await import(
    new URL("js/rating.js", game).href
  );
  const { toBlack, evalText, barRatio } = await import(
    new URL("js/evalbar.js", game).href
  );
  const { LEVELS } = await import(new URL("js/levels.js", game).href);
  eq("勝率 30% の差は約 -147", Math.round(eloDiff(0.3)), -147);
  eq("同じ強さなら見込み 0.5", expected(1000, 1000), 0.5);
  eq(
    "最初の 10 局は K=48（同じ強さに勝って +24）",
    updateRating({ rating: 800, games: 0 }, 800, 1),
    { rating: 824, games: 1, delta: 24 },
  );
  eq(
    "11 局目からは K=24（同じ強さに負けて -12）",
    updateRating({ rating: 800, games: 10 }, 800, 0),
    { rating: 788, games: 11, delta: -12 },
  );
  eq("いちばん近い段", nearestLevel(860, LEVELS).name, "初級 Lv2");
  eq(
    "段のレーティングは弱い順に上がる",
    LEVELS.every((l, i) => i === 0 || l.rating > LEVELS[i - 1].rating),
    true,
  );
  eq("後手番の評価値は向きを変える", toBlack(300, WHITE), -300);
  eq("評価値の文言（互角）", evalText(150), "+150　互角");
  eq("評価値の文言（後手有利）", evalText(-500), "−500　後手有利");
  eq("評価値の文言（詰み）", evalText(30000 - 5), "先手の勝ち（詰み 5 手）");
  eq(
    "あなた基準の文言（後手のあなたが有利: 先手から見て −400 を逆にした +400）",
    evalText(-toBlack(400, WHITE), { plus: "あなた", minus: "CPU" }),
    "+400　あなた有利",
  );
  eq("棒は互角で半分", barRatio(0), 0.5);
}

// 5. エンジン: 開いて、どの段階でも初形と途中の局面で合法手を返す
{
  const { LEVELS } = await import(new URL("js/levels.js", game).href);
  const { openEngine, think } = await import(new URL("js/cpu.js", game).href);
  const engine = await openEngine({
    wasmBinary: await fs.readFile(new URL("engine/yaneuraou.wasm", game)),
    evalBin: (await fs.readFile(new URL("engine/nn.bin", game))).buffer,
  });
  const line = "7g7f 3c3d 2g2f 8c8d";
  for (const level of LEVELS.filter((l) => l.nodes > 0)) {
    const pos = Position.fromSfen(START);
    for (const u of line.split(" ")) pos.doMove(moveFromUsi(pos, u));
    const r = await think(engine, `${START} moves ${line}`, level);
    eq(
      `エンジン ${level.name} が合法手を返す`,
      legalMoves(pos).some((m) => moveToUsi(m) === r.move),
      true,
    );
  }
  engine.dispose();
}

const ms = Math.round(performance.now() - t0);
console.log(fail ? `NG ${fail} 件（${ms} ms）` : `全部 OK（${ms} ms）`);
process.exit(fail ? 1 : 0);
