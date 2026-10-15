// サンプル問題で解説（紛れ・変化）と手筋の札の中身を出す（確かめ用・第3段の文章化の材料を見る用）
// 使い方: node scripts/shogi/explain-dump.mjs
// 出力: 各手の札と、ほかの手ごとに kind・n（手数）・esc（逃れ手の数。? は受けの手を全部は確かめていない）・手順
const base = new URL("../../src/lab/shogi/js/", import.meta.url).href;
const { Position, moveToKif, moveTo } = await import(base + "core.js");
const { Solver } = await import(base + "solver.js");
const { SAMPLES } = await import(base + "samples.js");
const { lineLabels } = await import(base + "tesuji.js");

// pos から moves を指したときの棋譜（prevTo は直前の手の行き先）
const kifLine = (pos, moves, prevTo = -1) => {
  const p = pos.clone();
  return moves.map((m) => {
    const k = moveToKif(p, m, prevTo);
    prevTo = moveTo(m);
    p.doMove(m);
    return k;
  });
};

for (const s of SAMPLES) {
  if (!s.answer) continue;
  const pos = Position.fromSfen(s.sfen);
  const solver = new Solver({ timeLimitMs: 20000 });
  const r = solver.solve(pos);
  const t = performance.now();
  const ex = solver.explain(pos, r.moves);
  const ms = Math.round(performance.now() - t);
  const labels = lineLabels(pos, r.moves);
  console.log(`\n== ${s.title}（解説 ${ms} ms・partial ${ex.partial}）`);
  const p = pos.clone();
  r.moves.forEach((m, i) => {
    const prevTo = i ? moveTo(r.moves[i - 1]) : -1;
    console.log(
      `${i + 1}. ${kifLine(p, [m], prevTo)[0]} [${labels[i].join(",")}]`,
    );
    for (const o of ex.plies[i]?.others ?? []) {
      const [head, ...rest] = kifLine(p, [o.move, ...(o.line ?? [])], prevTo);
      const kind = o.kind ?? (o.futile ? "無駄合" : "");
      const esc = `${o.escapes ?? "-"}${o.sure === false ? "?" : ""}`;
      console.log(
        `    ${head} ${kind} n=${o.n ?? "-"} esc=${esc} | ${rest.join(" ")}`,
      );
    }
    p.doMove(m);
  });
}
