// 詰将棋ソルバー（LAB /lab/shogi/）の試験。指し手生成の数・規則・サンプル問題の解を確かめる
// 使い方: node scripts/test-shogi.mjs（NG が 1 件でもあれば終了コード 1）
const base = new URL("../src/lab/shogi/js/", import.meta.url).href;
const core = await import(base + "core.js");
const { Position, perft, legalMoves, checkMoves, moveToUsi, fillDefenderHand } =
  core;

const t0 = performance.now();
let fail = 0;
const ng = (msg) => {
  fail++;
  console.log("NG", msg);
};
const eq = (name, got, want) => {
  if (got !== want) ng(`${name}: ${got}（期待 ${want}）`);
  else console.log("OK", name, got);
};
const usis = (pos, moves) => moves.map(moveToUsi).sort().join(" ");

// 1. 指し手の数（初期局面）
const START = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
{
  const pos = Position.fromSfen(START);
  eq("SFEN の往復", pos.toSfen(), START);
  const k0 = pos.key();
  eq("perft 1", perft(pos, 1), 30);
  eq("perft 2", perft(pos, 2), 900);
  eq("perft 3", perft(pos, 3), 25470);
  eq("perft 4", perft(pos, 4), 719731);
  eq("指した後にハッシュが戻る", pos.key(), k0);
}

// 2. 規則
{
  // 二歩: 5 筋に先手の歩があると 5 筋に歩を打てない
  const pos = Position.fromSfen("4k4/9/9/9/4P4/9/9/9/4K4 b P 1");
  const drops = legalMoves(pos).filter((m) => moveToUsi(m).startsWith("P*5"));
  eq("二歩は打てない", drops.length, 0);
}
{
  // 行き所のない駒: 一段目に歩・香、一・二段目に桂は打てない
  const pos = Position.fromSfen("8k/9/9/9/9/9/9/9/K8 b PLN 1");
  const bad = legalMoves(pos)
    .map(moveToUsi)
    .filter((u) => /^[PL]\*\da$/.test(u) || /^N\*\d[ab]$/.test(u));
  eq("行き所のない駒は打てない", bad.length, 0);
}
{
  // 王手放置: 飛車で王手されている玉は、受けない手を指せない
  const pos = Position.fromSfen("4k4/9/9/9/9/9/9/9/4K3r b G 1");
  const moves = legalMoves(pos);
  eq(
    "王手を受ける手だけ",
    usis(pos, moves),
    ["5i4h", "5i5h", "5i6h", "G*2i", "G*3i", "G*4i"].sort().join(" "),
  );
}
{
  // 打ち歩詰め: 1 一の玉に 1 二歩打は、2 三の金が歩と 2 二を押さえ、2 一は自分の桂で逃げ場が無いので打てない
  const pos = Position.fromSfen("7nk/9/7G1/9/9/9/9/9/9 b P 1");
  fillDefenderHand(pos);
  const pawnDrop = legalMoves(pos).filter((m) => moveToUsi(m) === "P*1b");
  eq("打ち歩詰めは打てない", pawnDrop.length, 0);
  const otherDrop = legalMoves(pos).filter((m) => moveToUsi(m) === "P*1c");
  eq("王手でない歩打ちは打てる", otherDrop.length, 1);
}
{
  // 突き歩詰めはよい: 1 三の歩を 1 二へ突いて詰ます手は指せる
  const pos = Position.fromSfen("7nk/9/7GP/9/9/9/9/9/9 b - 1");
  const push = checkMoves(pos).filter((m) => moveToUsi(m) === "1c1b");
  eq("突き歩詰めは指せる", push.length, 1);
}

// 3. サンプル問題: df-pn の答えを、素朴な全探索（独立した物差し）と突き合わせる
// 全探索は「攻め方は全部の王手、受け方は全部の合法手」を深さ制限つきで読むだけ（無駄合の扱いは無い）
function orMate(pos, d, memo) {
  if (d <= 0) return false;
  const k = `${pos.key()}:${d}`;
  if (memo.has(k)) return memo.get(k);
  let r = false;
  for (const m of checkMoves(pos)) {
    pos.doMove(m);
    const ok = andMate(pos, d - 1, memo);
    pos.undoMove(m);
    if (ok) {
      r = true;
      break;
    }
  }
  memo.set(k, r);
  return r;
}
function andMate(pos, d, memo) {
  const moves = legalMoves(pos);
  if (moves.length === 0) return true;
  if (d <= 0) return false;
  const k = `${pos.key()}:${d}`;
  if (memo.has(k)) return memo.get(k);
  let r = true;
  for (const m of moves) {
    pos.doMove(m);
    const ok = orMate(pos, d - 1, memo);
    pos.undoMove(m);
    if (!ok) {
      r = false;
      break;
    }
  }
  memo.set(k, r);
  return r;
}
// 攻め方の各手番で、残りの手数以内に詰ます王手がいくつあるか（1 なら余詰なし）
function mateCounts(pos, moves) {
  const counts = [];
  for (let i = 0; i < moves.length; i++) {
    if (i % 2 === 0) {
      let n = 0;
      for (const c of checkMoves(pos)) {
        pos.doMove(c);
        if (andMate(pos, moves.length - i - 1, new Map())) n++;
        pos.undoMove(c);
      }
      counts.push(n);
    }
    pos.doMove(moves[i]);
  }
  for (let i = moves.length - 1; i >= 0; i--) pos.undoMove(moves[i]);
  return counts;
}
{
  const { Solver } = await import(base + "solver.js");
  const { SAMPLES } = await import(base + "samples.js");
  const BRUTE_MAX = 7;
  for (const s of SAMPLES) {
    const pos = Position.fromSfen(s.sfen);
    const st = performance.now();
    const r = new Solver({ timeLimitMs: 20000 }).solve(pos);
    const ms = Math.round(performance.now() - st);
    const name = `${s.title}（${ms} ms・${r.nodes} 局面）`;
    if (!s.answer) {
      eq(`${name} 不詰`, r.status, "nomate");
      eq(
        `${name} 全探索でも ${BRUTE_MAX} 手以内に詰まない`,
        orMate(pos, BRUTE_MAX, new Map()),
        false,
      );
      continue;
    }
    eq(`${name} 手順`, r.moves.map(moveToUsi).join(" "), s.answer);
    if (s.forbidden) {
      const [ply, usi] = s.forbidden;
      const p = Position.fromSfen(s.sfen);
      for (const m of r.moves.slice(0, ply)) p.doMove(m);
      eq(
        `${name} ${usi} は指せない`,
        legalMoves(p).some((m) => moveToUsi(m) === usi),
        false,
      );
    }
    if (r.futile || r.approx) ng(`${name} 注記が付いた: ${JSON.stringify(r)}`);
    if (r.len <= BRUTE_MAX) {
      const memo = new Map();
      eq(
        `${name} 全探索でも ${r.len} 手で詰む`,
        orMate(pos, r.len, memo),
        true,
      );
      eq(
        `${name} 全探索で ${r.len - 2} 手以内には詰まない`,
        orMate(pos, r.len - 2, memo),
        false,
      );
      const counts = mateCounts(pos, r.moves);
      eq(
        `${name} 攻め方の各手で詰ます手は一つだけ`,
        counts.every((n) => n === 1),
        true,
      );
    }
  }
}

// 4. 手筋のラベル（小さな局面で 1 つずつ）
const { lineLabels } = await import(base + "tesuji.js");
const { moveFromUsi } = core;
// sfen から usi の手順を指し、各手のラベルを返す
function labelsOf(sfen, usiLine) {
  const pos = Position.fromSfen(sfen);
  const p = pos.clone();
  const moves = usiLine.split(" ").map((u) => {
    const m = moveFromUsi(p, u);
    if (m === null) throw new Error(`${usiLine}: ${u} が指せない`);
    p.doMove(m);
    return m;
  });
  return lineLabels(pos, moves);
}
const has = (name, labels, tag) =>
  eq(`ラベル ${name}: ${tag}`, labels.includes(tag), true);
has(
  "飛車の前の銀をどける",
  labelsOf("4k4/9/9/9/4S4/9/9/9/4R4 b - 1", "5e4d")[0],
  "開き王手",
);
has(
  "桂が跳ねて飛車と桂で王手",
  labelsOf("4k4/9/9/9/4N4/9/9/9/4R4 b - 1", "5e4c")[0],
  "両王手",
);
has(
  "取られる金打",
  labelsOf("4k4/9/9/9/9/9/9/9/9 b Gg 1", "G*5b 5a5b")[0],
  "捨て駒",
);
has(
  "玉の隣に合駒",
  labelsOf("4k4/9/9/9/9/9/9/9/R8 b g 1", "9i5i G*5b")[1],
  "合駒",
);
has(
  "離れた所に合駒",
  labelsOf("4k4/9/9/9/9/9/9/9/R8 b g 1", "9i5i G*5e")[1],
  "中合",
);

// 4-2. 札の文（解説の材料なしで、札だけから文が出る）
{
  const { commentary } = await import(base + "commentary.js");
  const textOf = (sfen, usiLine) => {
    const pos = Position.fromSfen(sfen);
    const p = pos.clone();
    const moves = usiLine.split(" ").map((u) => {
      const m = moveFromUsi(p, u);
      p.doMove(m);
      return m;
    });
    return commentary(pos, moves, lineLabels(pos, moves)).plies;
  };
  const says = (name, text, word) =>
    eq(`札の文 ${name}: 「${word}」`, text.includes(word), true);
  says(
    "開き王手",
    textOf("4k4/9/9/9/4S4/9/9/9/4R4 b - 1", "5e4d")[0],
    "後ろの飛車で王手をかける開き王手",
  );
  says("両王手", textOf("4k4/9/9/9/4N4/9/9/9/4R4 b - 1", "5e4c")[0], "両王手");
  says(
    "捨て駒",
    textOf("4k4/9/9/9/9/9/9/9/9 b Gg 1", "G*5b 5a5b")[0],
    "玉に取らせて呼び寄せる",
  );
  says("合駒", textOf("4k4/9/9/9/9/9/9/9/R8 b g 1", "9i5i G*5b")[1], "合駒");
  says("中合", textOf("4k4/9/9/9/9/9/9/9/R8 b g 1", "9i5i G*5e")[1], "中合");
}

// 5. 解説（紛れ・変化）: サンプルで、素朴な全探索を物差しに確かめる
// 受け方の手で今の局面が詰んでいるか（指す手が無い）
const mated = (pos) => legalMoves(pos).length === 0;
{
  const { Solver } = await import(base + "solver.js");
  const { SAMPLES } = await import(base + "samples.js");
  const sampleLabels = {
    "1手詰 — 頭金": [0, "頭金"],
    "5手詰 — 銀不成": [2, "不成"],
    "3手詰 — 打ち歩詰めを避ける": [2, "打ち歩詰め回避"],
  };
  const { commentary } = await import(base + "commentary.js");
  // 解説の文章に出てほしい言葉（手の番号は 0 始まり）
  const sampleWords = {
    "1手詰 — 頭金": [[0, "玉の頭に金を打って詰み"]],
    "5手詰 — 銀不成": [[2, "と成ると△１二玉で逃れられてしまう"]],
    "3手詰 — 打ち歩詰めを避ける": [[2, "打ち歩詰めの反則"]],
    "7手詰 — 成銀で追い詰める": [[1, "いちばん長く粘れる"]],
  };
  for (const s of SAMPLES) {
    if (!s.answer) continue;
    const pos = Position.fromSfen(s.sfen);
    const solver = new Solver({ timeLimitMs: 20000 });
    const r = solver.solve(pos);
    const st = performance.now();
    const ex = solver.explain(pos, r.moves);
    const name = `${s.title}の解説（${Math.round(performance.now() - st)} ms）`;
    eq(`${name} 最後の手まで作れた`, ex.partial, false);
    if (sampleLabels[s.title]) {
      const [ply, tag] = sampleLabels[s.title];
      has(s.title, lineLabels(pos, r.moves)[ply], tag);
    }
    let bad = 0;
    const p = pos.clone();
    for (let i = 0; i < r.moves.length; i++) {
      const L = r.moves.length - i;
      for (const o of ex.plies[i].others) {
        const q = p.clone();
        q.doMove(o.move);
        const what = `${i + 1} 手目 ${moveToUsi(o.move)} ${o.kind ?? ""}`;
        if (i % 2 === 0) {
          // 紛れ: サンプルは余詰が無い・読みきれないものも無い
          if (o.kind === "yozume" || o.kind === "unknown") {
            bad++;
            ng(`${name} ${what}`);
          }
          if (o.escape === null || o.escape === undefined) {
            bad++;
            ng(`${name} ${what} に逃れ手が付いていない`);
            continue;
          }
          // 逃れ手の後は、残りの手数以内に詰まない
          {
            q.doMove(o.escape);
            if (orMate(q, L - 2, new Map())) {
              bad++;
              ng(`${name} ${what} 逃れ手 ${moveToUsi(o.escape)} の後に詰む`);
            }
            continue;
          }
        } else if (o.futile) continue;
        // 詰みの手順: 最後が詰み・手数が n どおり
        if (o.line && o.n) {
          for (const m of o.line) q.doMove(m);
          if (!mated(q) || o.line.length !== o.n - 1) {
            bad++;
            ng(`${name} ${what} の手順が詰みで終わらない`);
          }
        }
        // 変化の手数を全探索でも確かめる（攻め方の番から n-1 手）
        if (i % 2 === 1 && o.n - 1 <= 7) {
          const v = p.clone();
          v.doMove(o.move);
          if (!orMate(v, o.n - 1, new Map())) {
            bad++;
            ng(`${name} ${what} が全探索で ${o.n - 1} 手で詰まない`);
          }
        }
      }
      p.doMove(r.moves[i]);
    }
    eq(`${name} 紛れ・変化の確かめ`, bad, 0);

    // 解説の文章: 全部の手に段落があり、値の抜けが文に出ない。札の文は材料で裏付けられて出る
    const c = commentary(pos, r.moves, lineLabels(pos, r.moves), ex);
    eq(
      `${name} 文章: 全部の手に段落`,
      c.plies.length === r.moves.length && c.plies.every((p) => p.length > 0),
      true,
    );
    eq(
      `${name} 文章: 抜けた値が出ない`,
      /undefined|null|NaN|\[object/.test(c.text),
      false,
    );
    for (const [ply, word] of sampleWords[s.title] ?? [])
      eq(
        `${name} 文章: ${ply + 1} 手目に「${word}」`,
        c.plies[ply].includes(word),
        true,
      );
  }
}

const ms = Math.round(performance.now() - t0);
console.log(fail ? `NG ${fail} 件（${ms} ms）` : `全部 OK（${ms} ms）`);
process.exit(fail ? 1 : 0);
