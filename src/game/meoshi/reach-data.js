// 目押しチャレンジ: リーチ目の停止形（1geki「スマスロ ハナビ リーチ目まとめ」の画像を書き起こしたもの。配列は 2015 年版と同じ）
// 各リールは次のどれか
//   "any"     … どこでもよい（画像の「回転中」「ANY」）
//   "hazure"  … どこでもよいが、全部止まったときに役が揃っていない（画像の「ハズレ」）
//   { rows: [上段, 中段, 下段], above?, below? } … 各セルは図柄の記号か、その配列（どれか）か null（どれでもよい）
// 図柄の記号は reel-data.js と同じ。"FG" は風鈴（短冊の色を問わない）、"Dd" は女の子（大小を問わない）

export const REACH_KINDS = {
  two: "2リール確定目",
  smallMiss: "小役ハズレ目",
  classic: "伝統のリーチ目",
  noren: "暖簾狙い時",
  tanDon: "単ドン狙い時",
  seven: "赤7付近狙い時",
  tenpai: "テンパイハズレ",
};

export const REACH_PATTERNS = [
  {
    id: "r01",
    kind: "classic",
    reels: [{ rows: ["D", "D", "D"] }, "any", "any"],
  },
  {
    id: "r02",
    kind: "two",
    reels: [{ rows: ["N", "G", "I"] }, "any", { rows: ["R", "C", "S"] }],
  },
  {
    id: "r03",
    kind: "smallMiss",
    reels: [
      { rows: ["N", "G", "I"] },
      "hazure",
      { rows: [null, ["F", "G"], ["I", "N"]] },
    ],
  },
  {
    id: "r04",
    kind: "two",
    reels: [{ rows: ["N", "G", "I"] }, { rows: ["N", "H", "R"] }, "any"],
  },
  {
    id: "r05",
    kind: "two",
    reels: [{ rows: ["D", "F", "I"] }, { rows: ["D", "R", "G"] }, "any"],
  },
  {
    id: "r06",
    kind: "two",
    reels: [
      { rows: ["G", "I", "R"], above: "N" },
      "any",
      { rows: ["C", "S", "F"] },
    ],
  },
  {
    id: "r07",
    kind: "two",
    reels: [{ rows: ["F", "I", "S"] }, { rows: ["I", "S", "R"] }, "any"],
  },
  {
    id: "r08",
    kind: "two",
    reels: [
      { rows: ["S", "F", "R"] },
      { rows: ["G", "C", "I"], below: "S" },
      "any",
    ],
  },
  {
    id: "r09",
    kind: "two",
    reels: [{ rows: ["I", "R", "F"] }, "any", { rows: ["R", "C", "S"] }],
  },
  {
    id: "r10",
    kind: "smallMiss",
    reels: [{ rows: ["N", "G", "I"] }, "hazure", { rows: ["N", "R", "Dd"] }],
  },
  {
    id: "r11",
    kind: "smallMiss",
    reels: [{ rows: ["D", "F", "I"] }, "hazure", { rows: ["D", "F", "I"] }],
  },
  {
    id: "r12",
    kind: "smallMiss",
    reels: [{ rows: ["S", "F", "R"] }, "hazure", { rows: ["H", "G", "I"] }],
  },
  {
    id: "r13",
    kind: "smallMiss",
    reels: [{ rows: ["N", "G", "I"] }, { rows: ["C", "I", "C"] }, "hazure"],
  },
  {
    id: "r14",
    kind: "smallMiss",
    reels: [
      { rows: ["D", "F", "I"] },
      { rows: ["G", "C", "I"], below: "S" },
      "hazure",
    ],
  },
  {
    id: "r15",
    kind: "smallMiss",
    reels: [{ rows: ["S", "F", "R"] }, { rows: ["S", "R", "G"] }, "hazure"],
  },
  {
    id: "r22",
    kind: "classic",
    anyLine: [
      ["Dd", "S"],
      ["Dd", "S"],
      ["Dd", "S"],
    ],
  },
  {
    id: "r23",
    kind: "classic",
    reels: [
      { rows: ["N", "G", "I"] },
      { rows: [null, "R", null] },
      { rows: [null, "R", null] },
    ],
  },
  {
    id: "r24",
    kind: "classic",
    reels: [
      { rows: [null, null, "I"] },
      { rows: [null, "I", null] },
      { rows: [null, null, ["I", "N"]] },
    ],
  },
  {
    id: "r25",
    kind: "classic",
    reels: [
      { rows: [["F", "G"], "I", "R"] },
      { rows: [null, "R", null] },
      { rows: [null, null, "R"] },
    ],
  },
  {
    id: "r26",
    kind: "classic",
    reels: [
      { rows: [null, "R", null] },
      { rows: [null, "R", null] },
      { rows: [null, ["I", "N"], null] },
    ],
  },
  {
    id: "r27",
    kind: "classic",
    reels: [
      { rows: ["I", null, null] },
      { rows: ["I", null, null] },
      { rows: [null, null, ["I", "N"]] },
    ],
  },
  {
    id: "r28",
    kind: "noren",
    reels: [{ rows: ["N", "G", "I"] }, { rows: ["N", "H", "R"] }, "any"],
  },
  {
    id: "r29",
    kind: "noren",
    reels: [{ rows: ["N", "G", "I"] }, "any", { rows: ["R", "C", "S"] }],
  },
  {
    id: "r30",
    kind: "noren",
    reels: [{ rows: ["N", "G", "I"] }, { rows: ["C", "I", "C"] }, "hazure"],
  },
  {
    id: "r31",
    kind: "noren",
    reels: [
      { rows: ["N", "G", "I"] },
      "hazure",
      { rows: [null, "G", ["I", "N"]] },
    ],
  },
  {
    id: "r32",
    kind: "noren",
    reels: [{ rows: ["N", "G", "I"] }, "hazure", { rows: ["I", "R", "C"] }],
  },
  {
    id: "r33",
    kind: "noren",
    reels: [{ rows: ["N", "G", "I"] }, "hazure", { rows: ["N", "R", "D"] }],
  },
  {
    id: "r35",
    kind: "noren",
    reels: [
      { rows: ["N", "G", "I"] },
      { rows: ["I", "S", "R"] },
      { rows: ["D", "F", "I"] },
    ],
  },
  {
    id: "r36",
    kind: "noren",
    reels: [
      { rows: ["N", "G", "I"] },
      { rows: [null, "R", null] },
      { rows: [null, "R", null] },
    ],
  },
  {
    id: "r37",
    kind: "noren",
    reels: [
      { rows: ["N", "G", "I"] },
      { rows: [null, "G", null] },
      { rows: ["G", "N", "R"] },
    ],
  },
  {
    id: "r38",
    kind: "noren",
    reels: [
      { rows: ["N", "G", "I"] },
      { rows: ["F", "C", "R"] },
      { rows: ["G", "N", "R"] },
    ],
  },
  {
    id: "r39",
    kind: "noren",
    reels: [
      { rows: ["N", "G", "I"] },
      { rows: ["S", "R", "G"] },
      { rows: ["F", "I", "R"], above: ["D", "S"] },
    ],
  },
  {
    id: "r40",
    kind: "noren",
    reels: [{ rows: ["G", "I", "R"] }, "any", { rows: ["C", "S", "F"] }],
  },
  {
    id: "r41",
    kind: "noren",
    reels: [{ rows: ["G", "I", "R"] }, { rows: ["C", "I", "S"] }, "hazure"],
  },
  {
    id: "r42",
    kind: "noren",
    reels: [{ rows: ["G", "I", "R"] }, "hazure", { rows: ["R", "C", "S"] }],
  },
  {
    id: "r43",
    kind: "tanDon",
    reels: [
      { rows: ["G", "I", "R"] },
      { rows: [null, "R", null] },
      { rows: ["G", ["I", "N"], "R"] },
    ],
  },
  {
    id: "r44",
    kind: "tanDon",
    reels: [{ rows: ["D", "F", "I"] }, { rows: ["D", "R", "G"] }, "any"],
  },
  {
    id: "r45",
    kind: "tanDon",
    reels: [{ rows: ["D", "F", "I"] }, "any", { rows: ["R", "C", "S"] }],
  },
  {
    id: "r46",
    kind: "tanDon",
    reels: [{ rows: ["D", "F", "I"] }, "hazure", { rows: ["N", "R", "D"] }],
  },
  {
    id: "r47",
    kind: "tanDon",
    reels: [
      { rows: ["D", "F", "I"] },
      { rows: ["C", "I", "S"] },
      { rows: ["S", "F", "I"] },
    ],
  },
  {
    id: "r48",
    kind: "tanDon",
    reels: [
      { rows: ["D", "F", "I"] },
      { rows: ["S", "R", "G"] },
      { rows: ["D", "F", "I"] },
    ],
  },
  {
    id: "r49",
    kind: "tanDon",
    reels: [
      { rows: ["D", "F", "I"] },
      { rows: ["S", "R", "G"] },
      { rows: ["N", "R", "H"] },
    ],
  },
  {
    id: "r50",
    kind: "tanDon",
    reels: [
      { rows: ["D", "F", "I"] },
      { rows: ["I", "S", "R"] },
      { rows: ["R", "C", "G"] },
    ],
  },
  {
    id: "r51",
    kind: "tanDon",
    reels: [
      { rows: ["D", "F", "I"] },
      { rows: ["C", "I", "S"] },
      { rows: ["C", "G", "N"] },
    ],
  },
  {
    id: "r52",
    kind: "tanDon",
    reels: [
      { rows: ["D", "F", "I"] },
      { rows: ["G", "C", "D"] },
      { rows: ["G", "N", "R"] },
    ],
  },
  {
    id: "r53",
    kind: "tanDon",
    reels: [
      { rows: ["D", "F", "I"] },
      { rows: ["R", "G", null] },
      { rows: ["R", ["H", "C"], "G"] },
    ],
  },
  {
    id: "r54",
    kind: "tanDon",
    reels: [
      { rows: ["D", "F", "I"] },
      { rows: [null, "R", null] },
      { rows: ["G", "N", "R"] },
    ],
  },
  {
    id: "r55",
    kind: "tanDon",
    reels: [
      { rows: ["D", "F", "I"] },
      { rows: [null, "R", "G"] },
      { rows: ["H", "G", "I"] },
    ],
  },
  {
    id: "r56",
    kind: "tanDon",
    reels: [
      { rows: ["F", "I", "R"] },
      "any",
      { rows: [["I", "N"], "R", null] },
    ],
  },
  {
    id: "r57",
    kind: "tanDon",
    reels: [{ rows: ["F", "I", "R"] }, { rows: ["G", "C", "I"] }, "hazure"],
  },
  {
    id: "r58",
    kind: "tanDon",
    reels: [{ rows: ["F", "I", "R"] }, { rows: ["G", "N", "H"] }, "any"],
  },
  {
    id: "r60",
    kind: "tanDon",
    reels: [
      { rows: ["I", "R", "F"] },
      { rows: [["H", "C"], "R", "G"] },
      "hazure",
    ],
  },
  {
    id: "r61",
    kind: "tanDon",
    reels: [
      { rows: ["I", "R", "F"] },
      { rows: ["C", "I", "S"] },
      { rows: ["N", "R", "H"] },
    ],
  },
  {
    id: "r62",
    kind: "tanDon",
    reels: [
      { rows: ["I", "R", "F"] },
      { rows: ["G", "C", "Dd"] },
      { rows: [null, null, "G"] },
    ],
  },
  {
    id: "r64",
    kind: "seven",
    reels: [{ rows: ["S", "F", "R"] }, { rows: ["G", "C", "I"] }, "any"],
  },
  {
    id: "r65",
    kind: "seven",
    reels: [{ rows: ["S", "F", "R"] }, "any", { rows: ["N", "R", "H"] }],
  },
  {
    id: "r66",
    kind: "seven",
    reels: [{ rows: ["S", "F", "R"] }, { rows: ["N", "H", "R"] }, "hazure"],
  },
  {
    id: "r67",
    kind: "seven",
    reels: [{ rows: ["S", "F", "R"] }, { rows: ["S", "R", "G"] }, "hazure"],
  },
  {
    id: "r68",
    kind: "seven",
    reels: [{ rows: ["S", "F", "R"] }, "hazure", { rows: ["H", "G", "I"] }],
  },
  {
    id: "r69",
    kind: "seven",
    reels: [
      { rows: ["S", "F", "R"] },
      { rows: ["R", "G", "R"] },
      { rows: ["R", null, "G"] },
    ],
  },
  {
    id: "r70",
    kind: "seven",
    reels: [
      { rows: ["S", "F", "R"] },
      { rows: [null, "G", null] },
      { rows: [null, "R", null] },
    ],
  },
  {
    id: "r71",
    kind: "seven",
    reels: [
      { rows: ["S", "F", "R"] },
      { rows: [null, "R", null] },
      { rows: ["G", "I", "R"] },
    ],
  },
  {
    id: "r72",
    kind: "seven",
    reels: [
      { rows: ["S", "F", "R"] },
      { rows: ["I", "S", "R"] },
      { rows: [null, "R", null] },
    ],
  },
  {
    id: "r73",
    kind: "seven",
    reels: [
      { rows: ["S", "F", "R"] },
      { rows: ["C", "Dd", "R"] },
      { rows: ["N", "R", "Dd"] },
    ],
  },
  {
    id: "r74",
    kind: "seven",
    reels: [
      { rows: ["S", "F", "R"] },
      { rows: ["C", "I", "S"] },
      { rows: ["S", "F", "I"] },
    ],
  },
  {
    id: "r75",
    kind: "seven",
    reels: [
      { rows: ["S", "F", "R"] },
      { rows: ["F", "C", "R"] },
      { rows: [["Dd", "S"], "F", "I"] },
    ],
  },
  {
    id: "r76",
    kind: "seven",
    reels: [{ rows: ["I", "S", "F"] }, { rows: ["G", "N", "H"] }, "any"],
  },
  {
    id: "r77",
    kind: "seven",
    reels: [{ rows: ["I", "S", "F"] }, { rows: ["I", "S", "R"] }, "hazure"],
  },
  {
    id: "r78",
    kind: "seven",
    reels: [{ rows: ["I", "S", "F"] }, "hazure", { rows: ["R", "Dd", "F"] }],
  },
  {
    id: "r79",
    kind: "seven",
    reels: [{ rows: ["I", "S", "F"] }, "hazure", { rows: ["G", "N", "R"] }],
  },
  {
    id: "r80",
    kind: "seven",
    reels: [
      { rows: ["I", "S", "F"] },
      { rows: [null, "R", null] },
      { rows: [null, "R", null] },
    ],
  },
  {
    id: "r81",
    kind: "seven",
    reels: [
      { rows: ["I", "S", "F"] },
      { rows: [null, "★", null] },
      { rows: [null, "★", null] },
    ],
  },
  {
    id: "r82",
    kind: "seven",
    reels: [
      { rows: ["I", "S", "F"] },
      { rows: ["C", "I", "C"] },
      { rows: ["R", "C", "S"] },
    ],
  },
  {
    id: "r83",
    kind: "seven",
    reels: [
      { rows: ["I", "S", "F"] },
      { rows: ["G", "C", "I"] },
      { rows: ["I", "R", "C"] },
    ],
  },
  {
    id: "r84",
    kind: "seven",
    reels: [{ rows: ["F", "I", "S"] }, { rows: ["I", "S", "R"] }, "any"],
  },
  {
    id: "r85",
    kind: "seven",
    reels: [{ rows: ["F", "I", "S"] }, "any", { rows: ["Dd", "F", "I"] }],
  },
  {
    id: "r86",
    kind: "seven",
    reels: [{ rows: ["F", "I", "S"] }, { rows: ["G", "N", "H"] }, "hazure"],
  },
  {
    id: "r87",
    kind: "seven",
    reels: [
      { rows: ["F", "I", "S"] },
      { rows: [null, null, "G"] },
      { rows: ["G", null, null] },
    ],
  },
];
