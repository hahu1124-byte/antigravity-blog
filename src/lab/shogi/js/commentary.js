// 解説の文章化（AI は使わない）: 本筋・手筋の札・解説（紛れ・変化）から、型の決まった文を組み立てる
// 書くのは材料で裏付けられることだけ。読みきれなかった所は「読みきれなかった」とだけ書く
import { moveToKif, moveTo, moveFrom, KIF_NAME, OU } from "./core.js";

// 紛れ・変化で例として挙げる数
const EXAMPLES = 2;
// 例の手順は先頭からこの手数まで書く
const LINE_HEAD = 3;
const PROMOTE = 1 << 14;
// 文の中での駒の呼び方（棋譜の 1 文字の名前を、読みやすい名前に）
const SPOKEN = { 飛: "飛車", 香: "香車", 桂: "桂馬" };
const spoken = (sq, pos) => {
  const n = KIF_NAME[Math.abs(pos.board[sq])];
  return SPOKEN[n] ?? n;
};

// moves を pos から指したときの棋譜（prevTo は直前の手の行き先。「同」に使う）
export function kifOf(pos, moves, prevTo = -1) {
  const p = pos.clone();
  return moves.map((m) => {
    const k = moveToKif(p, m, prevTo);
    prevTo = moveTo(m);
    p.doMove(m);
    return k;
  });
}

// 結果 { plies: 手ごとの段落（指し手の表記は含まない）, kifs: 手ごとの表記, summary: まとめ, text: 全部をつないだ文 }
// explain が無い（作れなかった）ときは、札の文だけを書く
export function commentary(start, moves, labels, explain = null) {
  const pos = start.clone();
  const plies = [];
  const kifs = [];
  for (let i = 0; i < moves.length; i++) {
    const prevTo = i > 0 ? moveTo(moves[i - 1]) : -1;
    const ctx = {
      pos,
      prevTo,
      move: moves[i],
      next: moves[i + 1],
      left: moves.length - i,
      last: i === moves.length - 1,
      labels: labels[i] ?? [],
      ply: explain?.plies?.[i] ?? null,
      explained: !!explain,
    };
    kifs.push(kifOf(pos, [moves[i]], prevTo)[0]);
    plies.push((i % 2 === 0 ? attackText(ctx) : defendText(ctx)).join(""));
    pos.doMove(moves[i]);
  }
  for (let i = moves.length - 1; i >= 0; i--) pos.undoMove(moves[i]);
  const summary = summaryText(start, moves, labels, explain);
  const text = [
    summary,
    ...plies.map((p, i) => `${i + 1}手目 ${kifs[i]}。${p}`),
  ].join("\n");
  return { plies, kifs, summary, text };
}

// ---- 攻め方の手 ----
function attackText(c) {
  const { pos, move } = c;
  const s = [];
  const to = moveTo(move);
  if (c.labels.includes("打ち歩詰め回避"))
    s.push(
      "玉の頭に歩を打てば詰みの形だが、それは打ち歩詰めの反則なので、この手で攻める。",
    );
  if (c.labels.includes("不成")) s.push(unpromoteText(c));
  if (c.labels.includes("両王手") || c.labels.includes("開き王手")) {
    pos.doMove(move);
    const back = pos
      .attackersOf(pos.king[pos.side], pos.side ^ 1)
      .filter((sq) => sq !== to)
      .map((sq) => spoken(sq, pos));
    pos.undoMove(move);
    if (c.labels.includes("両王手"))
      s.push(
        `動いた駒と後ろの${back.join("・")}の二つで王手をかける両王手。両方を一度に防ぐには玉が逃げるしかない。`,
      );
    else if (back.length)
      s.push(`駒が動いて、後ろの${back[0]}で王手をかける開き王手。`);
  }
  if (c.next !== undefined && moveTo(c.next) === to) {
    pos.doMove(move);
    const byKing = Math.abs(pos.board[moveFrom(c.next)]) === OU;
    pos.undoMove(move);
    const what = c.labels.includes("成り捨て") ? "成り捨て" : "捨て駒";
    s.push(
      byKing
        ? `取られる所への${what}で、玉に取らせて呼び寄せる。`
        : `取られる所への${what}で、わざと取らせる。`,
    );
  }
  if (c.last)
    s.push(
      c.labels.includes("頭金") ? "玉の頭に金を打って詰み。" : "これで詰み。",
    );
  if (c.explained) s.push(sideChecksText(c));
  return s.filter(Boolean);
}

// 不成: 成る手が紛れにあり、逃れ手が分かっていれば、その理由を書く
function unpromoteText(c) {
  const promoted = c.ply?.others.find((o) => o.move === (c.move | PROMOTE));
  if (promoted && promoted.escape != null) {
    const [pk, ek] = kifOf(c.pos, [promoted.move, promoted.escape], c.prevTo);
    c.used = promoted.move;
    return `${pk}と成ると${ek}で逃れられてしまうので、成らずに進める。`;
  }
  return "ここは成らずに進める。";
}

// ほかの王手（紛れ）の文
function sideChecksText(c) {
  const ply = c.ply;
  if (!ply) return "この手の紛れは読みきれなかった。";
  const others = ply.others;
  if (!others.length) return "王手はこの手しかない。";
  const yozume = others.filter((o) => o.kind === "yozume");
  if (yozume.length) {
    const [yk] = kifOf(c.pos, [yozume[0].move], c.prevTo);
    return `ただし${yk}でも${yozume[0].n ? `${yozume[0].n}手で` : ""}詰む（余詰）。`;
  }
  const known = others.filter((o) => o.kind !== "unknown");
  const unknown = others.length - known.length;
  // ほかの王手が 1 つだけなら、その手の逃れ方だけを書く
  if (others.length === 1) {
    const o = others[0];
    if (o.kind === "unknown" || o.escape == null) {
      const [ok] = kifOf(c.pos, [o.move], c.prevTo);
      return o.kind === "unknown"
        ? `ほかの王手${ok}は読みきれなかった。`
        : `ほかの王手${ok}では詰まない。`;
    }
    const [ok, ek] = kifOf(c.pos, [o.move, o.escape], c.prevTo);
    return `ほかの王手${ok}は${ek}で逃れる。`;
  }
  const allNomate = known.length > 0 && known.every((o) => o.kind === "nomate");
  let t = `ほかの王手は${others.length}通りあるが、`;
  t += allNomate
    ? "どれも詰まない。"
    : known.length
      ? "どれも残りの手数では詰まない。"
      : "どれも読みきれなかった。";
  // 不成の文で挙げた成る手は、例に重ねない
  const examples = known
    .filter((o) => o.escape != null && o.move !== c.used)
    .slice(0, EXAMPLES);
  examples.forEach((o, j) => {
    const [ok, ek] = kifOf(c.pos, [o.move, o.escape], c.prevTo);
    const only = o.escapes === 1 && o.sure ? "（逃れる手はこれだけ）" : "";
    t += `${j === 0 ? "たとえば" : ""}${ok}${j === 0 ? "は" : "も"}${ek}で逃れる${only}。`;
  });
  if (unknown && known.length) t += `（${unknown}通りは読みきれなかった）`;
  return t;
}

// ---- 受け方の手 ----
function defendText(c) {
  const s = [];
  if (c.labels.includes("合駒")) s.push("王手の間に駒を入れて（合駒）受ける。");
  if (c.labels.includes("中合"))
    s.push("玉から離れた所に駒を入れる中合で受ける。");
  if (c.explained) s.push(sideRepliesText(c));
  return s.filter(Boolean);
}

// ほかの応手（変化）の文
function sideRepliesText(c) {
  const ply = c.ply;
  if (!ply) return "この手の変化は読みきれなかった。";
  const others = ply.others;
  if (!others.length) return "ほかに指せる手はない。";
  const mates = others.filter((o) => !o.futile && o.n != null);
  const futile = others.filter((o) => o.futile).length;
  const unknown = others.filter((o) => !o.futile && o.n == null).length;
  let t = "";
  mates.slice(0, EXAMPLES).forEach((o, j) => {
    const [ok, ...rest] = kifOf(c.pos, [o.move, ...o.line], c.prevTo);
    const head = rest.slice(0, LINE_HEAD).join(" ");
    const more = rest.length > LINE_HEAD ? " …" : "";
    t += `${j === 0 ? "ほかに" : ""}${ok}なら以下${rest.length}手（${head}${more}）で詰む。`;
  });
  if (mates.length) {
    // この手から数えた本筋の手数と比べる
    const same = mates.filter((o) => o.n === c.left).length;
    t +=
      same > 0
        ? "同じ手数で詰む応手もある。"
        : "どの応手もこの手より早く詰むので、いちばん長く粘れるのがこの手。";
  }
  if (futile)
    t += `合駒の${futile}通りは、取られて同じように詰む無駄合なので数えない。`;
  if (unknown) t += `（${unknown}通りは読みきれなかった）`;
  return t;
}

// ---- まとめ ----
function summaryText(start, moves, labels, explain) {
  const s = [`${moves.length}手詰。`];
  const tags = [...new Set(labels.flat())];
  if (tags.length) s.push(`手筋は ${tags.join("・")}。`);
  if (explain?.plies && moves.length >= 3) {
    // 逃れる手が一つしかない紛れ（惜しい紛れ）がいちばん多い攻め方の手を難所とする
    let best = null;
    explain.plies.forEach((ply, i) => {
      if (i % 2 !== 0 || !ply) return;
      const close = ply.others.filter(
        (o) => o.escapes === 1 && o.sure && o.kind !== "yozume",
      ).length;
      if (close > 0 && (!best || close > best.close))
        best = { i, close, total: ply.others.length };
    });
    if (best) {
      const pos = start.clone();
      for (let j = 0; j < best.i; j++) pos.doMove(moves[j]);
      const [k] = kifOf(
        pos,
        [moves[best.i]],
        best.i > 0 ? moveTo(moves[best.i - 1]) : -1,
      );
      s.push(
        `難所は${best.i + 1}手目の${k}で、ほかの王手${best.total}通りのうち${best.close}通りは逃れる手が一つしかない。`,
      );
    }
  }
  if (explain?.partial) s.push("一部の手は時間内に読みきれなかった。");
  return s.join("");
}
