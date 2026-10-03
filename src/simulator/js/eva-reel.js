/* --- EVA15風 液晶の図柄 --- */

// ============================================================
// 通常時・時短中：3×3 の図柄。各列のリールは数字の間にブランクが入り、
//   左は上から 1→9、中と右はその逆で上から 9→1（逆回転。ユーザー方針 2026-10-03）。
//   列は「数字・ブランク・数字」か「ブランク・数字・ブランク」で止まる。ラインは上段・中段・下段。
//   左 → 右 → 中の順に止め、左右がそろえばリーチ。中が止まって揃えば当り。ハズレは中が当り図柄の
//   すぐ外（1 コマずれた所）で止まる（ズレ目）。
//   上段 4・下段 2 のリーチは特別な大当り濃厚リーチ（ハズレでは出さない）。7 のリーチは 10R 濃厚
//   （ヘソの 10R はすべて 7 で揃う）なので、3×3 のハズレでは 7 のリーチも出さない（ユーザー方針 2026-10-03）。当りは 4・4・4／2・2・2 か、
//   ズレて暴走図柄の 1・3・5 が揃う（暴走ボーナス・確変濃厚）。
//   ダブルラインは上下のクロス（左上→中段→右下・左下→中段→右上）。左が上 a・下 a+1 なら、
//   逆回転の右は上 a+1・下 a で止まるので、2 本の斜めが同時にリーチになる（中段で交わる）。
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
// リーチの当りのうち、いったんハズレ目で止まってから復活する割合と、その間（ミリ秒）
const EVA_REVIVE_RATE = 0.15;
const EVA_REVIVE_WAIT_MS = 900;
const EVA_REVIVE_SHOW_MS = 600;
// 大当り濃厚のリーチ（段 → 数字）
const EVA_SURE_REACH = { top: 4, bot: 2 };
const EVA_ROWS = ["top", "mid", "bot"];
// ライン → 左・中・右それぞれの段（0=上段 1=中段 2=下段）。x1・x2 はダブルラインのクロス
const EVA_LINES = {
  top: [0, 0, 0],
  mid: [1, 1, 1],
  bot: [2, 2, 2],
  x1: [0, 1, 2],
  x2: [2, 1, 0],
};
const EVA_LINE_KEYS = Object.keys(EVA_LINES);
// ラインの一覧を、列 col の光らせる段（"top"/"mid"/"bot"）に直す
function evaRowsForCol(lines, col) {
  return (lines || []).map((k) => EVA_ROWS[EVA_LINES[k][col]]);
}

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

// --- リール（数字の間にブランク：null） ---
const EVA_STRIP_UP = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const EVA_STRIP_DOWN = [9, 8, 7, 6, 5, 4, 3, 2, 1];
// 列 0=左・1=中・2=右
const EVA_REEL_CELLS = [EVA_STRIP_UP, EVA_STRIP_DOWN, EVA_STRIP_DOWN].map(
  (strip) => strip.flatMap((n) => [n, null]),
);
const EVA_REEL_LEN = 18;

// 列 col のリールの位置 p（上段に来るセル）から 3 段の図柄
function evaWindow(col, p) {
  const cs = EVA_REEL_CELLS[col];
  const q = ((p % EVA_REEL_LEN) + EVA_REEL_LEN) % EVA_REEL_LEN;
  return [0, 1, 2].map((k) => cs[(q + k) % EVA_REEL_LEN]);
}
// 列 col で、段 row（0=上段 1=中段 2=下段）に数字 n が来る位置
function evaPosOf(col, n, row) {
  return EVA_REEL_CELLS[col].indexOf(n) - row;
}

// ラインごとの図柄（左・中・右）
function evaRowsOf(grid) {
  const out = {};
  for (const k of EVA_LINE_KEYS) {
    out[k] = EVA_LINES[k].map((row, col) => grid[col][row]);
  }
  return out;
}
function evaIsBoso(row) {
  return (
    !row.includes(null) && [...row].sort((a, b) => a - b).join(",") === "1,3,5"
  );
}
function evaRowHit(row) {
  return row[0] !== null && row[0] === row[1] && row[1] === row[2];
}
// 左右がそろっているライン（リーチ）
function evaReachLines(grid) {
  const rows = evaRowsOf(grid);
  return EVA_LINE_KEYS.filter(
    (k) => rows[k][0] !== null && rows[k][0] === rows[k][2],
  );
}
// 当りになっているライン（図柄揃い・暴走図柄）
function evaWinRows(grid) {
  const rows = evaRowsOf(grid);
  return EVA_LINE_KEYS.filter((k) => evaRowHit(rows[k]) || evaIsBoso(rows[k]));
}

function evaPickLine() {
  const r = Math.random();
  return r < 0.35 ? "top" : r < 0.65 ? "mid" : "bot";
}

// 止まる盤面を決める。spec：{ tenpai, isHit, hitDigit, boso, line, double }
// 返り値：{ grid（列ごとの 3 段）, pos（中列の位置。回転の止め方に使う）, reach, win, boso }
function evaBuildGrid(spec) {
  const { tenpai, isHit, hitDigit } = spec;
  const W = evaWindow;
  for (let tries = 0; tries < 500; tries++) {
    const line = spec.line || evaPickLine();
    const row = EVA_ROWS.indexOf(line);
    let grid;
    let cpos = null;
    let reach = [];
    let win = [];
    if (isHit && spec.boso) {
      // 上段 4 のリーチがズレて下段 5・1・3、または下段 2 のリーチがズレて上段 1・5・3
      if (line === "bot") {
        cpos = evaPosOf(1, 5, 0);
        grid = [W(0, evaPosOf(0, 2, 2)), W(1, cpos), W(2, evaPosOf(2, 2, 2))];
        reach = ["bot"];
        win = ["top"];
      } else {
        cpos = evaPosOf(1, 1, 2);
        grid = [W(0, evaPosOf(0, 4, 0)), W(1, cpos), W(2, evaPosOf(2, 4, 0))];
        reach = ["top"];
        win = ["bot"];
      }
    } else if ((isHit || tenpai) && spec.double) {
      // 上下のクロス：左は上 a・下 a+1、逆回転の右は上 a+1・下 a。
      // x1（左上→右下）が a、x2（左下→右上）が a+1 のリーチ。中が中段に a か a+1 で止まれば当り
      const dline = Math.random() < 0.5 ? "x1" : "x2";
      // ハズレは 7 のリーチを作らない（a と a+1 のどちらも 7 にしない。7 テンパイは 10R 濃厚）
      const a = isHit
        ? dline === "x1"
          ? hitDigit
          : evaWrap(hitDigit - 1)
        : evaRandDigit([6, 7]);
      const target = dline === "x1" ? a : evaWrap(a + 1);
      const hitPos = evaPosOf(1, target, 1);
      // ハズレは中段が揃う数字のすぐ外（中は 9→1 の並び：x1 なら a の 2 セル下の a-1、
      // x2 なら a+1 の 2 セル上の a+2）
      cpos = isHit ? hitPos : hitPos + (dline === "x1" ? 2 : -2);
      grid = [
        W(0, evaPosOf(0, a, 0)),
        W(1, cpos),
        W(2, evaPosOf(2, evaWrap(a + 1), 0)),
      ];
      reach = ["x1", "x2"];
      win = isHit ? [dline] : [];
    } else if (isHit || tenpai) {
      let n;
      if (isHit) n = hitDigit;
      else {
        // 7 のリーチは 10R 濃厚（ヘソの 10R はすべて 7 で揃う）なのでハズレでは出さない。
        // 上段 4・下段 2 も大当り濃厚のリーチ
        const except = line === "top" ? [4, 7] : line === "bot" ? [2, 7] : [7];
        n = evaRandDigit(except);
      }
      const hitPos = evaPosOf(1, n, row);
      // ハズレのズレ目：上段・下段のリーチは隣の数字（2 セル）、中段のリーチは 1 セルずらす
      const off = line === "mid" ? 1 : 2;
      cpos = isHit ? hitPos : hitPos + (Math.random() < 0.5 ? off : -off);
      grid = [W(0, evaPosOf(0, n, row)), W(1, cpos), W(2, evaPosOf(2, n, row))];
      reach = [line];
      win = isHit ? [line] : [];
    } else {
      cpos = Math.floor(Math.random() * EVA_REEL_LEN);
      grid = [
        W(0, Math.floor(Math.random() * EVA_REEL_LEN)),
        W(1, cpos),
        W(2, Math.floor(Math.random() * EVA_REEL_LEN)),
      ];
    }
    const reachOk = evaReachLines(grid).join() === reach.join();
    const winOk = evaWinRows(grid).join() === win.join();
    if (reachOk && winOk) {
      return { grid, cpos, reach, win, boso: !!(isHit && spec.boso) };
    }
  }
  // 理論上ここには来ない（念のための中段 3・5・7）
  return {
    grid: [
      W(0, evaPosOf(0, 3, 1)),
      W(1, evaPosOf(1, 5, 1)),
      W(2, evaPosOf(2, 7, 1)),
    ],
    cpos: evaPosOf(1, 5, 1),
    reach: [],
    win: [],
    boso: false,
  };
}

function evaCellClass(n) {
  return n % 2 !== 0 ? "odd" : "even";
}

// 列 col（0〜2）に 3 段（null はブランク）を出す。hot の段は光らせる（リーチ）、win の段は当りの光
function evaGridSetCol(col, cells, hot, win) {
  const el = document.getElementById("d" + (col + 1));
  if (!el) return;
  el.className = "digit grid-col";
  el.innerHTML = cells
    .map((n, row) => {
      if (n === null) return `<span class="cell blank">◆</span>`;
      const key = EVA_ROWS[row];
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

// 当り後の昇格・右打ち当りの演出：中段（数字 3 つなら全部）を図柄 n にそろえる
function evaShowTriple(n, cls) {
  if (evaUseGrid()) {
    [0, 1, 2].forEach((col) =>
      evaGridSetCol(col, [null, n, null], null, ["mid"]),
    );
  } else {
    [1, 2, 3].forEach((i) => evaPlainSet(i, n, cls));
  }
}

// 多すぎる段は前からまとめて最大 max 段にする（1 回転が長くなりすぎないように）。
// 1 段は items の配列（色を行ごとに分けて出すため、文字列にはつながない）
function evaChunkSteps(items, max) {
  const size = items.length <= max ? 1 : Math.ceil(items.length / max);
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

// 液晶の文字を出す。lines は文字列か [{ text, color }] の配列。色は style.css の .tc-*
function evaShowText(ov, lines) {
  if (!ov) return;
  const items = typeof lines === "string" ? [{ text: lines }] : lines || [];
  ov.textContent = "";
  for (const it of items) {
    for (const row of String(it.text || "").split("\n")) {
      if (!row) continue;
      const div = document.createElement("div");
      if (it.color) div.className = "tc-" + it.color;
      div.textContent = row;
      ov.appendChild(div);
    }
  }
  ov.style.display = ov.childNodes.length ? "block" : "none";
}

// 1 回転の液晶。opts.steps：[{ phase: "pre"|"reach"|"post", text }]。
// リーチ前の予告は回っている間に、リーチ名は左右が揃ったときに、
// リーチ後の予告とチャンスアップは中が回っている間に順番に出す
async function evaRunDisplay(eff, opts) {
  const grid = evaUseGrid();
  const tenpai = eff.isHit || eff.tenpai;
  // 止まる図柄と表示の部品（3×3 と数字 3 つで同じ流れにする）。回っている間はリールの位置で持つ
  let finals, reachKeys, winKeys, setCol, frameOf, step, centerSeq;
  let label = "";
  if (grid) {
    // 暴走図柄の当りは確変濃厚（見せ方だけ。通常当りでは出さない）：
    // 通常時は 3R確変（昇格なし）の当り、右打ちは当りがすべて 10R 確変なのでどの当りでも
    let boso = false;
    // 全回転リーチは 7 で揃える演出なので暴走図柄にしない
    if (eff.isHit && eff.reachId !== "zenkaiten") {
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
    if (boso) line = Math.random() < 0.5 ? "top" : "bot";
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
    winKeys = g.win;
    // hot・win はラインで持つので、列ごとの段に直して光らせる（クロスは列で段が違う）
    setCol = (col, cells, hot, win) =>
      evaGridSetCol(
        col,
        cells,
        hot && evaRowsForCol(hot, col),
        win && evaRowsForCol(win, col),
      );
    frameOf = (col, p) => evaWindow(col, p);
    // 左と、中・右は逆回転
    step = (col, p) => (col === 0 ? p - 1 : p + 1);
    // 中は 4 セルかけて止まる（中の回る向きのまま止まる位置に近づく）
    centerSeq = () => [g.cpos - 4, g.cpos - 3, g.cpos - 2, g.cpos - 1];
  } else {
    const nums = eff.isHit
      ? [eff.hitDigit, eff.hitDigit, eff.hitDigit]
      : evaMissDigits(eff.tenpai);
    finals = nums;
    reachKeys = nums[0] === nums[2] ? ["mid"] : [];
    winKeys = eff.isHit ? ["mid"] : [];
    setCol = (col, n, hot, win) =>
      evaPlainSet(
        col + 1,
        n,
        getDigitClass(n, mode) +
          (hot && hot.length ? " hot" : "") +
          (win && win.length ? " win" : ""),
      );
    frameOf = (col, n) => n;
    step = (col, n) => evaReelNext(n);
    centerSeq = () => {
      let n = nums[1];
      const seq = [];
      for (let s = 0; s < 4; s++) {
        n = evaReelPrev(n);
        seq.unshift(n);
      }
      return seq;
    };
  }
  const hotOf = (col) => (col === 1 ? [] : reachKeys);

  if (opts.instant) {
    [0, 1, 2].forEach((col) => setCol(col, finals[col], null, winKeys));
    await evaSleep(5);
    return;
  }

  const ov = document.getElementById("effect-overlay");
  // 文字を出し、その段にボイスがあれば最初の 1 つを鳴らす（eva-voice.js）
  const show = (t) => {
    evaShowText(ov, t);
    const v = Array.isArray(t) && t.find((s) => s.voice);
    if (v) evaPlayVoice(v.voice);
  };
  const steps = opts.steps || [];
  const pre = evaChunkSteps(
    steps.filter((s) => s.phase === "pre"),
    EVA_STEP_MAX,
  );
  const reachText = [
    { text: label },
    ...steps.filter((s) => s.phase === "reach"),
  ].filter((s) => s.text);
  const post = evaChunkSteps(
    steps.filter((s) => s.phase === "post"),
    EVA_STEP_MAX,
  );

  const frames = [0, 1, 2].map(() =>
    grid ? Math.floor(Math.random() * EVA_REEL_LEN) : evaRandDigit(),
  );
  const spinning = [true, true, true];
  const timer = setInterval(() => {
    [0, 1, 2].forEach((col) => {
      if (!spinning[col]) return;
      frames[col] = step(col, frames[col]);
      setCol(col, frameOf(col, frames[col]));
    });
  }, EVA_REEL_TICK_MS);

  // リーチ前の予告：全部の列が回っている間に 1 段ずつ
  for (const t of pre) {
    show(t);
    await evaSleep(EVA_STEP_MS);
  }
  // 全回転リーチ：3 列とも同じ図柄を並べてゆっくり 1 周させ、7 で止まって震える
  if (eff.reachId === "zenkaiten" && eff.isHit) {
    clearInterval(timer);
    if (eff.sp && opts.onSp) opts.onSp();
    await evaZenkaitenLap(eff, show, reachText, grid);
    return;
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
    // SP リーチに発展したら当該保留を消す（script.js の vanishCurrentHold）
    if (eff.sp && opts.onSp) opts.onSp();
    if (reachText.length) {
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
    // 中は最後の数コマをだんだん遅くして止める
    const seq = centerSeq();
    for (let s = 0; s < seq.length; s++) {
      setCol(1, frameOf(1, seq[s]));
      await evaSleep(120 + s * 90);
    }
  }
  // 復活当り：中が 1 コマ手前（ハズレ目）でいったん止まり、リーチの光も消えて間を置いてから、
  // 閃光と告知音で当り図柄へ滑り込む（ハズレからのメリハリ。ユーザー方針 2026-10-03）
  const revive =
    reach && eff.isHit && !eff.bosoShown && Math.random() < EVA_REVIVE_RATE;
  const screenEl = document.getElementById("screen");
  if (revive) {
    setCol(0, finals[0]);
    setCol(2, finals[2]);
    await evaSleep(EVA_REVIVE_WAIT_MS);
    eff.revived = true;
    if (screenEl) screenEl.classList.add("fx-revive");
    show([{ text: "復活！！", color: "gold" }]);
    evaPlayNotice("impact", 1); // 復活の合図は 1 回
    await evaSleep(150);
  }
  // 止まったらリーチの光を消し、当りならその段を光らせる
  [0, 1, 2].forEach((col) => setCol(col, finals[col], null, winKeys));
  if (revive) {
    await evaSleep(EVA_REVIVE_SHOW_MS);
    if (screenEl) screenEl.classList.remove("fx-revive");
  }
  // 暴走図柄の当りは確変濃厚
  if (eff.bosoShown) {
    show([{ text: "暴走ボーナス\n確変濃厚", color: "rainbow" }]);
    await evaSleep(EVA_STEP_MS);
  }
  show("");
}

// 全回転リーチ：3 列とも同じ図柄（3×3 は中段）を並べ、当り図柄の次から 1 周ゆっくり回して
// 最後は当り図柄（7）で止めて震わせる。後半ほどゆっくり
const EVA_ZENKAI_STEP_MS = 260;
const EVA_ZENKAI_SHAKE_MS = 900;
async function evaZenkaitenLap(eff, show, reachText, grid) {
  if (reachText.length) show(reachText);
  const target = eff.hitDigit;
  const setAll = (n, win) => {
    if (grid) {
      [0, 1, 2].forEach((col) =>
        evaGridSetCol(col, [null, n, null], null, win ? ["mid"] : null),
      );
    } else {
      [1, 2, 3].forEach((i) =>
        evaPlainSet(i, n, getDigitClass(n, mode) + (win ? " win" : "")),
      );
    }
  };
  for (let k = 1; k <= 8; k++) {
    setAll(evaWrap(target + k), false);
    await evaSleep(EVA_ZENKAI_STEP_MS + Math.max(0, k - 5) * 110);
  }
  setAll(target, true);
  const d1 = document.getElementById("d1");
  const box = d1 && d1.parentElement;
  if (box && box.classList) box.classList.add("zen-shake");
  await evaSleep(EVA_ZENKAI_SHAKE_MS);
  if (box && box.classList) box.classList.remove("zen-shake");
  show("");
}

// ハズレ図柄（数字 3 つ・ST 中）：リーチは左右を揃え、中は当り図柄の 1 コマ先（ズレ目）。
// 7 のリーチは 10R 濃厚なのでハズレでは作らない（3×3 と同じ。ユーザー指摘 2026-10-03）
function evaMissDigits(tenpai) {
  if (tenpai) {
    const r = evaRandDigit([7]);
    return [r, evaReelNext(r), r];
  }
  const d1 = evaRandDigit();
  return [d1, evaRandDigit(), evaRandDigit([d1])];
}
