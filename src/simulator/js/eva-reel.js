/* --- EVA15風 液晶の図柄 --- */

// ============================================================
// 通常時・時短中：3×3 の図柄。上段と下段に数字、中段はブランクの図柄。ラインは上段と下段の 2 本。
//   各列の下段は上段から決まる：左 +1・中 −2・右 −3（左右は逆回転）。
//   左 → 右 → 中の順に止め、左右がそろえばリーチ。中が止まって揃えば当り。
//   ハズレのズレ目は、上段 a のリーチなら中が上段 a+1／下段 a−1、下段 b のリーチなら中が上段 b+1／下段 b−1。
//   このときもう一方の段に暴走図柄の 1・3・5（順不同）が揃うのは「上段 4」「下段 2」のリーチだけ
//   （上段 4：下段 5・3・1、下段 2：上段 1・3・5）なので、この 2 つはハズレでは出さない＝大当り濃厚。
// ST 中：数字 3 つだけ（止める順番と演出の文字の出し方は同じ）。
// ============================================================

const EVA_REEL_TICK_MS = 45; // 回っている間の 1 コマの時間
const EVA_REEL_LEFT_MS = 360; // 左が止まるまで
const EVA_REEL_RIGHT_MS = 520; // 右が止まるまで
const EVA_REEL_CENTER_MS = 640; // リーチでないとき中が止まるまで
const EVA_REEL_REACH_MS = 900; // ノーマルリーチの中の回転時間（右が止まってから）
const EVA_REEL_SP_MS = 1900; // SP リーチ・激アツの中の回転時間（右が止まってから）
const EVA_STEP_MS = 450; // 液晶に出す演出の文字 1 段の時間
const EVA_STEP_MAX = 4; // リーチ前・リーチ後それぞれの最大段数（多いときはまとめる）
// 確変の当りのうち暴走図柄（1・3・5）で見せる割合（シンクロ経由の当りは必ず暴走）
const EVA_BOSO_SHOW_RATE = 0.12;
// 偶数図柄の当りのうち上段 4・下段 2 の大当り濃厚リーチで揃える割合
const EVA_SURE_REACH_RATE = 0.15;
// リーチのうちダブルライン（上段と下段が同時にリーチ）にする割合
const EVA_DOUBLE_REACH_RATE = 0.15;

// 各列の下段＝上段＋この値（左・中・右）
const EVA_COL_STEP = [1, -2, -3];
// 大当り濃厚のリーチ（ズレ目で暴走図柄が揃う）
const EVA_SURE_REACH = { top: 4, bot: 2 };

function evaWrap(n) {
  return ((((n - 1) % 9) + 9) % 9) + 1;
}
function evaReelNext(n) {
  return evaWrap(n + 1);
}
function evaReelPrev(n) {
  return evaWrap(n - 1);
}
function evaRandDigit(except) {
  let n;
  do n = Math.floor(Math.random() * 9) + 1;
  while (except && except.includes(n));
  return n;
}
function evaSleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 通常時・時短中は 3×3、ST 中は数字 3 つ
function evaUseGrid() {
  return mode !== "ST";
}

// --- 3×3 の盤面：grid[列] = [上段, 下段]（列 0=左 1=中 2=右） ---
function evaBottomOf(col, t) {
  return evaWrap(t + EVA_COL_STEP[col]);
}
// 逆回転の並びどおりの列（上段 t から下段が決まる）
function evaNatural(col, t) {
  return [t, evaBottomOf(col, t)];
}
function evaRowsOf(grid) {
  return { top: grid.map((c) => c[0]), bot: grid.map((c) => c[1]) };
}
function evaIsBoso(row) {
  return [...row].sort((a, b) => a - b).join(",") === "1,3,5";
}
function evaRowHit(row) {
  return row[0] === row[1] && row[1] === row[2];
}
// 左右がそろっているライン
function evaReachLines(grid) {
  const { top, bot } = evaRowsOf(grid);
  const out = [];
  if (top[0] === top[2]) out.push("top");
  if (bot[0] === bot[2]) out.push("bot");
  return out;
}
// 当りになっている段（図柄揃い・暴走図柄）
function evaWinRows(grid) {
  const rows = evaRowsOf(grid);
  return ["top", "bot"].filter((k) => evaRowHit(rows[k]) || evaIsBoso(rows[k]));
}

// 止まる盤面を決める。spec：{ tenpai, isHit, hitDigit, boso, line, double }
//   boso：上段 4 のリーチから下段 5・3・1、または下段 2 のリーチから上段 1・3・5（暴走図柄の当り）
//   double：上段と下段のダブルライン（逆回転の並びでは止まらない形。見た目の演出として右列だけ並びから外す）
// 返り値：{ grid, reach（リーチの段の配列）, win（当りの段）, boso }
function evaBuildGrid(spec) {
  const { tenpai, isHit, hitDigit } = spec;
  for (let tries = 0; tries < 500; tries++) {
    const line = spec.line || (Math.random() < 0.5 ? "top" : "bot");
    let grid;
    let reach = [];
    let win = null;
    if (isHit && spec.boso) {
      reach = [line];
      if (line === "top") {
        grid = [evaNatural(0, 4), evaNatural(1, 5), evaNatural(2, 4)];
        win = "bot";
      } else {
        grid = [evaNatural(0, 1), evaNatural(1, 3), evaNatural(2, 5)];
        win = "top";
      }
    } else if ((isHit || tenpai) && spec.double) {
      // 上段 a・下段 a+1 のダブルライン（左は並びどおり、右を合わせる）
      reach = ["top", "bot"];
      let a;
      if (isHit) {
        win = line;
        a = line === "top" ? hitDigit : evaWrap(hitDigit - 1);
      } else a = evaRandDigit();
      const b = evaWrap(a + 1);
      const center = isHit
        ? line === "top"
          ? evaNatural(1, a)
          : evaNatural(1, evaWrap(b + 2))
        : evaNatural(1, evaWrap(a + 1)); // ハズレ：上段も下段もズレる
      grid = [evaNatural(0, a), center, [a, b]];
    } else if (isHit) {
      const a = hitDigit;
      reach = [line];
      win = line;
      grid =
        line === "top"
          ? [evaNatural(0, a), evaNatural(1, a), evaNatural(2, a)]
          : [
              evaNatural(0, evaWrap(a - 1)),
              evaNatural(1, evaWrap(a + 2)),
              evaNatural(2, evaWrap(a + 3)),
            ];
    } else if (tenpai) {
      reach = [line];
      if (line === "top") {
        const a = evaRandDigit([EVA_SURE_REACH.top]);
        grid = [
          evaNatural(0, a),
          evaNatural(1, evaWrap(a + 1)),
          evaNatural(2, a),
        ];
      } else {
        const b = evaRandDigit([EVA_SURE_REACH.bot]);
        grid = [
          evaNatural(0, evaWrap(b - 1)),
          evaNatural(1, evaWrap(b + 1)),
          evaNatural(2, evaWrap(b + 3)),
        ];
      }
    } else {
      grid = [0, 1, 2].map((col) => evaNatural(col, evaRandDigit()));
    }
    const reachOk = evaReachLines(grid).join() === reach.join();
    const winOk = evaWinRows(grid).join() === (win ? win : "");
    if (reachOk && winOk)
      return { grid, reach, win, boso: !!(isHit && spec.boso) };
  }
  // 理論上ここには来ない（念のためのリーチなし）
  return {
    grid: [evaNatural(0, 9), evaNatural(1, 4), evaNatural(2, 6)],
    reach: [],
    win: null,
    boso: false,
  };
}

function evaCellClass(n) {
  return n % 2 !== 0 ? "odd" : "even";
}

// 列 col（0〜2）を出す。v は [上段, 下段] か上段の数字（下段は並びどおり）。
// hot の段は光らせる（リーチ）、win の段は当りの光
function evaGridSetCol(col, v, hot, win) {
  const el = document.getElementById("d" + (col + 1));
  if (!el) return;
  // 3 要素の配列は [上段, 中段, 下段] をそのまま出す（null はブランク）
  const cells =
    Array.isArray(v) && v.length === 3
      ? v
      : (() => {
          const pair = Array.isArray(v) ? v : evaNatural(col, v);
          return [pair[0], null, pair[1]];
        })();
  el.className = "digit grid-col";
  el.innerHTML = cells
    .map((n, row) => {
      if (n === null) return `<span class="cell blank">◆</span>`;
      const key = ["top", "mid", "bot"][row];
      const cls = ["cell", evaCellClass(n)];
      if (hot && hot.includes(key)) cls.push("hot");
      if (win && win.includes(key)) cls.push("win");
      return `<span class="${cls.join(" ")}">${n}</span>`;
    })
    .join("");
}

// --- 数字 3 つ（ST 中） ---
function evaPlainSet(i, n, cls) {
  const el = document.getElementById("d" + i);
  if (!el) return;
  el.className = cls || getDigitClass(n, mode);
  el.innerText = n;
}

// 待機中の図柄（起動・機種選択・リセット時）：中段に 3・5・7（上段・下段はブランク）
function evaDisplayIdle() {
  if (evaUseGrid()) {
    [3, 5, 7].forEach((n, col) => evaGridSetCol(col, [null, n, null]));
  } else {
    [3, 5, 7].forEach((n, k) => evaPlainSet(k + 1, n));
  }
}

// 当り後の昇格・右打ち当りの演出：上段（数字 3 つなら全部）を図柄 n にそろえる
function evaShowTriple(n, cls) {
  if (evaUseGrid()) {
    [0, 1, 2].forEach((col) => evaGridSetCol(col, n, null, ["top"]));
  } else {
    [1, 2, 3].forEach((i) => evaPlainSet(i, n, cls));
  }
}

// 多すぎる段は前からまとめて最大 max 段にする（1 回転が長くなりすぎないように）
function evaChunkSteps(texts, max) {
  if (texts.length <= max) return texts;
  const size = Math.ceil(texts.length / max);
  const out = [];
  for (let i = 0; i < texts.length; i += size) {
    out.push(texts.slice(i, i + size).join("\n"));
  }
  return out;
}

// 1 回転の液晶。opts.steps：[{ phase: "pre"|"reach"|"post", text }]。
// リーチ前の予告は回っている間に、リーチ名は左右が揃ったときに、
// リーチ後の予告とチャンスアップは中が回っている間に順番に出す
async function evaRunDisplay(eff, opts) {
  const grid = evaUseGrid();
  const tenpai = eff.isHit || eff.tenpai;
  // 止まる図柄と表示の部品（3×3 と数字 3 つで同じ流れにする）
  let finals, reachKeys, winKeys, setCol, step, centerSeq;
  let label = "";
  if (grid) {
    // 暴走図柄の当りは確変濃厚（見せ方だけ。通常当りでは出さない）：
    // 通常時は 3R確変（昇格なし）の当り、右打ちは当りがすべて 10R 確変なのでどの当りでも
    let boso = false;
    if (eff.isHit) {
      boso = eff.isRight
        ? Math.random() < EVA_BOSO_SHOW_RATE
        : eff.kind === "k3" &&
          !eff.upgrade &&
          (eff.reachId === "synchro" || Math.random() < EVA_BOSO_SHOW_RATE);
    }
    // 偶数図柄の当りの一部は上段 4・下段 2 の大当り濃厚リーチで揃える
    let line = null;
    if (
      eff.isHit &&
      !boso &&
      eff.hitDigit % 2 === 0 &&
      Math.random() < EVA_SURE_REACH_RATE
    ) {
      line = Math.random() < 0.5 ? "top" : "bot";
      eff.hitDigit = EVA_SURE_REACH[line];
    }
    const double =
      tenpai && !boso && !line && Math.random() < EVA_DOUBLE_REACH_RATE;
    const g = evaBuildGrid({
      tenpai,
      isHit: eff.isHit,
      hitDigit: eff.hitDigit,
      boso,
      line,
      double,
    });
    if (g.boso) {
      // 暴走図柄の当り（暴走ボーナス）は ST 確定なので昇格演出は出さない
      eff.bosoShown = true;
      eff.upgrade = false;
    }
    if (double) label = "ダブルリーチ！";
    finals = g.grid;
    reachKeys = g.reach;
    winKeys = g.win ? [g.win] : [];
    setCol = (col, v, hot, win) => evaGridSetCol(col, v, hot, win);
    // 左右は逆回転：左は数字が増える向き、中と右は減る向きに流れる（回っている間は上段の数字で持つ）
    step = (col, t) => (col === 0 ? evaReelNext(t) : evaReelPrev(t));
    // 中は数字が減る向きに 4 コマかけて止まる（下段リーチのズレ目は当り図柄を通り過ぎる）
    centerSeq = (v) => {
      const t = v[0];
      return [evaWrap(t + 3), evaWrap(t + 2), evaWrap(t + 1), v];
    };
  } else {
    finals = eff.isHit
      ? [eff.hitDigit, eff.hitDigit, eff.hitDigit]
      : evaMissDigits(eff.tenpai);
    reachKeys = finals[0] === finals[2] ? ["top"] : [];
    winKeys = eff.isHit ? ["top"] : [];
    setCol = (col, n, hot, win) =>
      evaPlainSet(
        col + 1,
        n,
        getDigitClass(n, mode) +
          (hot && hot.length ? " hot" : "") +
          (win && win.length ? " win" : ""),
      );
    step = (col, n) => evaReelNext(n);
    centerSeq = (n) => [
      evaReelPrev(evaReelPrev(evaReelPrev(n))),
      evaReelPrev(evaReelPrev(n)),
      evaReelPrev(n),
      n,
    ];
  }
  const hotOf = (col) => (col === 1 ? [] : reachKeys);

  if (opts.instant) {
    [0, 1, 2].forEach((col) => setCol(col, finals[col], null, winKeys));
    await evaSleep(5);
    return;
  }

  const ov = document.getElementById("effect-overlay");
  const show = (t) => {
    if (!ov) return;
    ov.innerText = t || "";
    ov.style.display = t ? "block" : "none";
  };
  const steps = opts.steps || [];
  const pre = evaChunkSteps(
    steps.filter((s) => s.phase === "pre").map((s) => s.text),
    EVA_STEP_MAX,
  );
  const reachText = [
    label,
    ...steps.filter((s) => s.phase === "reach").map((s) => s.text),
  ]
    .filter(Boolean)
    .join("\n");
  const post = evaChunkSteps(
    steps.filter((s) => s.phase === "post").map((s) => s.text),
    EVA_STEP_MAX,
  );

  const frames = [0, 1, 2].map(() => evaRandDigit());
  const spinning = [true, true, true];
  const timer = setInterval(() => {
    [0, 1, 2].forEach((col) => {
      if (!spinning[col]) return;
      frames[col] = step(col, frames[col]);
      setCol(col, frames[col]);
    });
  }, EVA_REEL_TICK_MS);

  // リーチ前の予告：全部の列が回っている間に 1 段ずつ
  for (const t of pre) {
    show(t);
    await evaSleep(EVA_STEP_MS);
  }
  await evaSleep(Math.max(0, EVA_REEL_LEFT_MS - pre.length * EVA_STEP_MS));
  show("");
  spinning[0] = false;
  setCol(0, finals[0]);
  await evaSleep(EVA_REEL_RIGHT_MS - EVA_REEL_LEFT_MS);
  spinning[2] = false;
  const reach = reachKeys.length > 0;
  setCol(0, finals[0], hotOf(0));
  setCol(2, finals[2], hotOf(2));

  if (reach) {
    // リーチ名 → リーチ後の予告・チャンスアップ。中の回転は SP・激アツなら長く
    const total = opts.heavy ? EVA_REEL_SP_MS : EVA_REEL_REACH_MS;
    let used = 0;
    if (reachText) {
      show(reachText);
      await evaSleep(EVA_STEP_MS);
      used += EVA_STEP_MS;
    }
    for (const t of post) {
      show(t);
      await evaSleep(EVA_STEP_MS);
      used += EVA_STEP_MS;
    }
    await evaSleep(Math.max(0, total - used));
  } else {
    await evaSleep(EVA_REEL_CENTER_MS - EVA_REEL_RIGHT_MS);
  }
  clearInterval(timer);
  spinning[1] = false;

  if (reach) {
    // 中は最後の 4 コマをだんだん遅くして止める
    const seq = centerSeq(finals[1]);
    for (let s = 0; s < seq.length; s++) {
      setCol(1, seq[s]);
      await evaSleep(120 + s * 90);
    }
  }
  // 止まったらリーチの光を消し、当りならその段を光らせる
  [0, 1, 2].forEach((col) => setCol(col, finals[col], null, winKeys));
  // 暴走図柄の当りは確変濃厚
  if (eff.bosoShown) {
    show("暴走ボーナス\n確変濃厚");
    await evaSleep(EVA_STEP_MS);
  }
  show("");
}

// ハズレ図柄（数字 3 つ）：リーチは左右を揃え、中は当り図柄の 1 コマ先（ズレ目）
function evaMissDigits(tenpai) {
  const d1 = evaRandDigit();
  if (tenpai) return [d1, evaReelNext(d1), d1];
  return [d1, evaRandDigit(), evaRandDigit([d1])];
}
