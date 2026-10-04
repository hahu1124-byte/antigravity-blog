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
// ST の高速区間（残り 163〜101）で演出の無いハズレの回転：1 回転 0.8 秒（左→右→中）。待機は script.js で 0.2 秒
const EVA_QUICK_LEFT_MS = 450;
const EVA_QUICK_RIGHT_MS = 650;
const EVA_QUICK_CENTER_MS = 800;
// 高速区間の無演出即当り：回っているところから、7 が左・中・右の順に止まる
const EVA_INSTANT_FIRST_MS = 450; // 左が止まるまで
const EVA_INSTANT_STEP_MS = 280; // 次の列が止まるまで
const EVA_STEP_MS = 450; // 液晶に出す演出の文字 1 段の時間
const EVA_STEP_MAX = 4; // リーチ前・リーチ後それぞれの最大段数（多いときはまとめる）
// 確変の当りのうち暴走図柄（1・3・5）で見せる割合（シンクロ経由の当りは必ず暴走）
const EVA_BOSO_SHOW_RATE = 0.12;
// 偶数図柄の当りのうち上段 4・下段 2 の大当り濃厚リーチで揃える割合。
// これ以外の当りでは上段 4・下段 2 のリーチにしない（偶然の分が重なって多すぎた。ユーザー指摘 2026-10-03）
const EVA_SURE_REACH_RATE = 0.05;
// リーチのうちダブルライン（上段と下段が同時にリーチ）にする割合
const EVA_DOUBLE_REACH_RATE = 0.15;
// リーチの当りのうち、いったんハズレ目で止まってから復活する割合と、その間（ミリ秒）。
// 当りのうち 3%（どのリーチでも。ユーザー方針 2026-10-04）
const EVA_REVIVE_RATE = 0.03;
const EVA_REVIVE_WAIT_MS = 900;
const EVA_REVIVE_SHOW_MS = 1100; // 「復活！！」と当り図柄を見せる時間
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

// 図柄拡大の回転中（通常時・時短中）："on" / "red" / null。次の回転まで 1×1 のまま
let evaZoomNow = null;
function evaSetZoom(z) {
  evaZoomNow = z && mode !== "ST" ? z : null;
  const d1 = document.getElementById("d1");
  const box = d1 && d1.parentElement;
  if (!box || !box.classList) return;
  box.classList.toggle("zoom", !!evaZoomNow);
  box.classList.toggle("zoom-red", evaZoomNow === "red");
}

// 通常時・時短中は 3×3、ST 中と図柄拡大の回転は数字 3 つ（図柄拡大は縦長の 1×1）
function evaUseGrid() {
  return mode !== "ST" && !evaZoomNow;
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
    // 上段 4・下段 2 の濃厚リーチは spec.line で指定したときだけ（たまたまその段になった当りは引き直す）
    if (!spec.line && isHit && EVA_SURE_REACH[line] === hitDigit) continue;
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

// 3×3 の図柄の色。7 は通常時以外（時短・ST）なら金色（数字 3 つの getDigitClass と同じ。ユーザー方針 2026-10-03）
function evaCellClass(n) {
  if (n === 7 && typeof mode !== "undefined" && mode !== "通常") return "gold";
  return n % 2 !== 0 ? "odd" : "even";
}

// 列 col のリールで、図柄 d の 2 セル上・2 セル下に来る図柄（間にブランクを挟む隣の数字）。
// 左（col 0）は上から 1→2→3 の並び、中・右は 9→8→7 の並び
function evaReelAbove(col, d) {
  return col === 0 ? evaReelPrev(d) : evaReelNext(d);
}
function evaReelBelow(col, d) {
  return col === 0 ? evaReelNext(d) : evaReelPrev(d);
}

// 窓の外に少しだけ見える上下の段（リールの続き）。上下が数字ならその外はブランク、
// 上下がブランクならその外は隣の数字（ユーザー方針 2026-10-03）
function evaPeekOf(col, cells) {
  const [t, m, b] = cells;
  const above = t === null && m !== null ? evaReelAbove(col, m) : null;
  const below = b === null && m !== null ? evaReelBelow(col, m) : null;
  return [above, below];
}

// 列 col（0〜2）に 3 段（null はブランク）を出す。hot の段は光らせる（リーチ）、win の段は当りの光。
// 窓の上下には 1 段ずつ少しだけはみ出して見える段（peek）を付ける（省けばリールの並びから決める）
function evaGridSetCol(col, cells, hot, win, peek) {
  const el = document.getElementById("d" + (col + 1));
  if (!el) return;
  el.className = "digit grid-col";
  const [above, below] = peek || evaPeekOf(col, cells);
  const cell = (n, key, extra) => {
    if (n === null) return `<span class="cell blank${extra}">◆</span>`;
    const cls = ["cell", evaCellClass(n)];
    if (key && hot && hot.includes(key)) cls.push("hot");
    if (key && win && win.includes(key)) cls.push("win");
    return `<span class="${cls.join(" ")}${extra}">${n}</span>`;
  };
  el.innerHTML =
    cell(above, null, " peek") +
    cells.map((n, row) => cell(n, EVA_ROWS[row], "")).join("") +
    cell(below, null, " peek");
}

// --- 数字 3 つ（ST 中） ---
function evaPlainSet(i, n, cls) {
  const el = document.getElementById("d" + i);
  if (!el) return;
  el.className = cls || getDigitClass(n, mode);
  // 図柄拡大中は数字を縦に伸ばす（style.css の .zoom-glyph）
  if (evaZoomNow) el.innerHTML = `<span class="zoom-glyph">${n}</span>`;
  else el.innerText = n;
}

// 待機中の図柄（起動・機種選択・リセット時）：中段に 3・5・7（上段・下段はブランク）
function evaDisplayIdle() {
  evaSetZoom(null);
  evaSpark(null);
  evaSetBg(null);
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

// 段の文字の「ノイズ」を見せ方に直す（「ノイズ」という文字は出さない。ユーザー方針 2026-10-04）：
//   「ノイズ\n小／中／大」で始まる段は背景ノイズ違和感 → bg に強さ（液晶全体にノイズ。evaBgNoise）
//   それ以外で「ノイズ」の行がある段、または noise の付いた段 → 残りの文字にノイズを掛ける（noise に強さ）
const EVA_NOISE_LEVEL = { 小: "s", 中: "m", 大: "l" };
function evaParseNoise(it) {
  const lines = String((it && it.text) || "").split("\n");
  if (lines[0] === "ノイズ" && EVA_NOISE_LEVEL[lines[1]]) {
    return {
      bg: EVA_NOISE_LEVEL[lines[1]],
      lines: lines.slice(2),
      noise: null,
    };
  }
  const noisy = lines.some((l) => l.includes("ノイズ"));
  return {
    bg: null,
    lines: lines.filter((l) => !l.includes("ノイズ")),
    noise: (it && it.noise) || (noisy ? "m" : null),
  };
}

// 液晶の文字を出す。lines は文字列か [{ text, color, noise }] の配列。色は style.css の .tc-*、
// ノイズは .tx-noise（文字にモザイクのノイズとちらつき。色はその文字の色）
function evaShowText(ov, lines) {
  if (!ov) return;
  const items = typeof lines === "string" ? [{ text: lines }] : lines || [];
  ov.textContent = "";
  for (const it of items) {
    const p = evaParseNoise(it);
    for (const row of p.lines) {
      if (!row) continue;
      const div = document.createElement("div");
      const cls = [];
      if (it.color) cls.push("tc-" + it.color);
      if (p.noise) cls.push("tx-noise", "tx-noise-" + p.noise);
      if (cls.length) div.className = cls.join(" ");
      div.textContent = row;
      ov.appendChild(div);
    }
  }
  ov.style.display = ov.childNodes.length ? "block" : "none";
}

// 背景ノイズ違和感：液晶全体にモザイクと走査線のノイズ（level：s・m・l で濃さ、color：段の色）
const EVA_BG_NOISE_MS = 900;
function evaBgNoise(level, color) {
  const screen = document.getElementById("screen");
  if (!screen || !screen.appendChild) return;
  let el = document.getElementById("bg-noise");
  if (!el) {
    el = document.createElement("div");
    el.id = "bg-noise";
    screen.appendChild(el);
  }
  el.className = `bg-noise on bn-${level}${color ? " bn-" + color : ""}`;
  const token = (evaBgNoise.token = (evaBgNoise.token || 0) + 1);
  setTimeout(() => {
    if (evaBgNoise.token === token) el.className = "bg-noise";
  }, EVA_BG_NOISE_MS);
}

// 変動音オフ：画面全体が白黒になり、戻るときに白か赤に光る（color）
const EVA_MONO_MS = 1600;
function evaMono(color) {
  const screen = document.getElementById("screen");
  if (!screen || !screen.classList) return;
  screen.classList.add("fx-mono");
  const token = (evaMono.token = (evaMono.token || 0) + 1);
  setTimeout(() => {
    if (evaMono.token !== token) return;
    screen.classList.remove("fx-mono");
    evaWhiteout(color === "red" ? "red" : null);
  }, EVA_MONO_MS);
}

// 1 回転の液晶。opts.steps：[{ phase: "pre"|"reach"|"post", text }]。
// リーチ前の予告は回っている間に、リーチ名は左右が揃ったときに、
// リーチ後の予告とチャンスアップは中が回っている間に順番に出す
// 前兆（先読み系）の専用画面：図柄を隠し、段に付いた液晶の効果（ドックンの炎など）を出す。
// 返り値の関数で元に戻す（当該の効果として最初から付いているクラスは外さない）
const EVA_TAKEOVER_MS = 900; // 専用画面を出している時間
function evaTakeover(items) {
  const screen = document.getElementById("screen");
  if (!screen || !screen.classList) return () => {};
  const added = [];
  const add = (c) => {
    if (!c || (screen.classList.contains && screen.classList.contains(c)))
      return;
    screen.classList.add(c);
    added.push(c);
  };
  add("lead-takeover");
  for (const s of items) add(s.fx);
  return () => screen.classList.remove(...added);
}

// 液晶の背景の画像（格納庫背景など。style.css の .screen.bg-*、画像は img/）。
// 段で出たら、その変動が終わって次の変動が始まるまで出しておく
const EVA_BG_IMAGES = ["hangar-zero", "hangar-ni", "hangar-sho", "hangar-4"];
function evaSetBg(name) {
  const screen = document.getElementById("screen");
  if (!screen || !screen.classList) return;
  for (const b of EVA_BG_IMAGES) screen.classList.remove("bg-" + b);
  if (name) screen.classList.add("bg-" + name);
}

// 次回予告：図柄をいきなり消して黒地に「予告」の画面（img/yokoku.jpg）と曲（se/next-yokoku.mp3・26.9 秒）。
// 残り 6 秒でその次回予告のタイトル（「奇跡の価値は」など）に切り替え、ミサトのボイスを鳴らす。
// 曲が終わったら図柄の画面に戻る（ユーザー方針 2026-10-03）。サウンド OFF でも同じ長さで画面だけ流す
// 曲は頭の無音（1.1 秒）を削って 26.9 秒（画面の切り替えと音がずれないように。ユーザー指摘 2026-10-03）
const EVA_NEXT_MOVIE_MS = 26900;
const EVA_NEXT_TITLE_AT_MS = 20900; // 残り 6 秒でタイトルへ
const EVA_NEXT_TITLE_MAX_PX = 67; // タイトルの字の大きさの上限（短いタイトル）
async function evaPlayNextMovie(item) {
  const screen = document.getElementById("screen");
  if (!screen || !screen.appendChild) return;
  let el = document.getElementById("next-movie");
  if (!el) {
    el = document.createElement("div");
    el.id = "next-movie";
    el.className = "next-movie";
    el.innerHTML = '<div class="nm-title"></div>';
    screen.appendChild(el);
  }
  // タイトルは文字の 2 行目（「次回予告\n奇跡の価値は」なら「奇跡の価値は」）。無ければ「予告」のまま
  const lines = String(item.text || "").split("\n");
  const title = lines.length > 1 ? lines.slice(1).join("\n") : "";
  const titleEl = el.firstChild;
  if (titleEl) {
    titleEl.textContent = title;
    // 1 行に収める（「サービス、サービス」が折り返さないよう、画面の幅と文字数から字の大きさを決める）
    const longest = Math.max(1, ...title.split("\n").map((s) => s.length));
    const w = screen.clientWidth || 0;
    titleEl.style.fontSize = w
      ? `${Math.min(EVA_NEXT_TITLE_MAX_PX, (w * 0.86) / longest)}px`
      : "";
  }
  el.className = "next-movie on";
  screen.classList.add("movie-next");
  evaPlayNotice("next", 1);
  await evaSleep(title ? EVA_NEXT_TITLE_AT_MS : EVA_NEXT_MOVIE_MS);
  if (title) {
    el.className = "next-movie on titled";
    if (item.voice) evaPlayVoice(item.voice);
    await evaSleep(EVA_NEXT_MOVIE_MS - EVA_NEXT_TITLE_AT_MS);
  }
  el.className = "next-movie";
  screen.classList.remove("movie-next");
}

// 復活当りの「復活！！」（style.css の .revive-banner）
function evaReviveBanner(on) {
  const screen = document.getElementById("screen");
  if (!screen || !screen.appendChild) return;
  let el = document.getElementById("revive-banner");
  if (!el) {
    el = document.createElement("div");
    el.id = "revive-banner";
    el.className = "revive-banner";
    el.textContent = "復活！！";
    screen.appendChild(el);
  }
  el.classList.toggle("on", !!on);
}

// --- 図柄のキラキラ（図柄停止時発光）とシャッター ---
// 図柄停止時発光の段が出た変動は、図柄が全部止まったらその色のキラキラを付ける（次の変動の始めまで）
let evaSparkPending = null;
function evaSpark(color) {
  const d1 = document.getElementById("d1");
  const box = d1 && d1.parentElement;
  if (!box || !box.classList) return;
  for (const c of ["green", "red", "rainbow"]) {
    box.classList.toggle("spark-" + c, c === color);
  }
}

// ST の残り回転の告知：液晶の真ん中に大きく「残り N」（N は今の残り回転。実機の動画 2026-10-04）。
// ふだんは残り 100・50・10 のときだけ出る（EVA_REMAIN_ANNOUNCE）。それ以外の回転で出るのは違和感で、
// 高速区間の無演出即当りの前に出る（kind "white"）
const EVA_REMAIN_MS = 1000;
const EVA_REMAIN_ANNOUNCE = [100, 50, 10];

// ST の残り回数の違和感（残り回数表示の赤文字・ノイズ大／小・ガタガタ・虹文字）：左下の残り回転の表示に掛ける。
// その変動の間だけ（次の変動の始めに evaRunDisplay が消す）。kind：red・noise-l・noise-s・shake・rainbow
function evaMarkRemain(kind) {
  const el = document.getElementById("st-remain");
  if (!el || !el.classList) return;
  for (const k of ["red", "noise-l", "noise-s", "shake", "rainbow"]) {
    el.classList.toggle("sr-" + k, k === kind);
  }
}
function evaShowRemain(kind) {
  const screen = document.getElementById("screen");
  if (!screen || !screen.appendChild) return;
  let el = document.getElementById("remain-panel");
  if (!el) {
    el = document.createElement("div");
    el.id = "remain-panel";
    el.innerHTML = '<div class="rp-label">残り</div><div class="rp-num"></div>';
    screen.appendChild(el);
  }
  // 出す数は左下の残り回転と同じ「この変動を消化する前の残り」（rRem は変動の始めに 1 減らしてあるので +1。
  // そのまま出すと左下より 1 少なくずれていた。ユーザー指摘 2026-10-04）
  if (el.lastChild) el.lastChild.textContent = String(rRem + 1);
  el.className = "remain-panel on rp-" + kind;
  const token = (evaShowRemain.token = (evaShowRemain.token || 0) + 1);
  setTimeout(() => {
    if (evaShowRemain.token === token) el.className = "remain-panel";
  }, EVA_REMAIN_MS);
}

// 画面が白く光る（無演出即当りで 7 が止まる前）。color "red" なら赤く光る（変動音オフの赤）
const EVA_WHITEOUT_MS = 450;
function evaWhiteout(color) {
  const screen = document.getElementById("screen");
  if (!screen || !screen.appendChild) return;
  let el = document.getElementById("whiteout");
  if (!el) {
    el = document.createElement("div");
    el.id = "whiteout";
    screen.appendChild(el);
  }
  el.className = "whiteout";
  void el.offsetWidth; // 続けて出たときもアニメを最初からにする
  el.className = "whiteout on" + (color === "red" ? " wo-red" : "");
  setTimeout(() => (el.className = "whiteout"), EVA_WHITEOUT_MS);
}

// ST のリーチ時シャッター：上・左下・右下の 3 枚が液晶の中央へ閉まり、少し止まって開く。
// 半透明で、種類（通常・赤・金・ダミープラグ）ごとの色は style.css の .shutter-stage.shutter-*
const EVA_SHUTTER_MS = 1500; // 閉まって開くまで（style.css の shutter-close と合わせる）
function evaPlayShutter(kind) {
  const screen = document.getElementById("screen");
  if (!screen || !screen.appendChild) return;
  let stage = document.getElementById("shutter-stage");
  if (!stage) {
    stage = document.createElement("div");
    stage.id = "shutter-stage";
    stage.innerHTML =
      '<div class="sh-panel sh-top"></div>' +
      '<div class="sh-panel sh-bl"></div>' +
      '<div class="sh-panel sh-br"></div>';
    screen.appendChild(stage);
  }
  stage.className = "shutter-stage " + kind;
  void stage.offsetWidth; // 続けて出たときもアニメを最初からにする
  stage.classList.add("on");
  const token = (evaPlayShutter.token = (evaPlayShutter.token || 0) + 1);
  setTimeout(() => {
    if (evaPlayShutter.token === token) stage.classList.remove("on");
  }, EVA_SHUTTER_MS);
}

// キャラ連続：図柄を隠して窓にキャラと「×k」→ 図柄が戻って回り、左・中が同じ数字で右だけ 1 つずれて仮停止
// → 次のキャラ、を n 回くり返す（擬似連のように続き、回を追うごとに ×1・×2… と分かる。実機の動画 2026-10-04）。
// 最後のキャラの後は図柄が回ったまま、ふだんの止まり方へ戻る。ctl：回っている図柄の止め・仮停止・再開
const EVA_CHARA_SHOW_MS = 1200; // キャラの窓を出している時間
const EVA_CHARA_SPIN_MS = 700; // 図柄が戻って回る時間
const EVA_CHARA_STOP_MS = 650; // 仮停止を見せる時間
async function evaPlayChara(item, ctl) {
  const c = item.chara;
  const who = Array.isArray(c.who)
    ? c.who[Math.floor(Math.random() * c.who.length)]
    : c.who;
  const screen = document.getElementById("screen");
  let el = document.getElementById("chara-window");
  if (!el && screen && screen.appendChild) {
    el = document.createElement("div");
    el.id = "chara-window";
    el.innerHTML = '<div class="cw-who"></div><div class="cw-count"></div>';
    screen.appendChild(el);
  }
  for (let k = 1; k <= c.n; k++) {
    ctl.pause();
    const color = (c.colors && c.colors[k - 1]) || "";
    if (el && el.firstChild) {
      el.firstChild.textContent = who;
      el.lastChild.textContent = "×" + k;
      el.className = "chara-window on" + (color ? " cw-" + color : "");
    }
    if (screen && screen.classList) screen.classList.add("chara-on");
    if (k === 1 && item.voice) evaPlayVoice(item.voice);
    await evaSleep(EVA_CHARA_SHOW_MS);
    if (el) el.className = "chara-window";
    if (screen && screen.classList) screen.classList.remove("chara-on");
    ctl.resume();
    await evaSleep(EVA_CHARA_SPIN_MS);
    if (k < c.n) {
      ctl.fakeStop();
      await evaSleep(EVA_CHARA_STOP_MS);
    }
  }
  return (
    c.n * (EVA_CHARA_SHOW_MS + EVA_CHARA_SPIN_MS) +
    (c.n - 1) * EVA_CHARA_STOP_MS
  );
}

async function evaRunDisplay(eff, opts) {
  evaSpark(null);
  evaSetBg(null);
  evaMarkRemain(null);
  // 残り 100・50・10 は毎回、変動の始めに真ん中で告知する
  if (
    !opts.instant &&
    typeof mode !== "undefined" &&
    mode === "ST" &&
    EVA_REMAIN_ANNOUNCE.includes(rRem + 1)
  ) {
    evaShowRemain("white");
  }
  evaSparkPending = null;
  await evaRunDisplayMain(eff, opts);
  if (evaSparkPending && !opts.instant) evaSpark(evaSparkPending);
}

async function evaRunDisplayMain(eff, opts) {
  // 図柄拡大は 3×3 をやめ、1 列 1 つの縦長の図柄で回す（瞬時表示では拡大しない）
  evaSetZoom(opts.instant ? null : eff.zoom);
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
    if (!Array.isArray(t)) return;
    // シャッターはその段で閉まる。図柄停止時発光は図柄が止まったときに光らせる
    const sh = t.find((s) => s.stage);
    if (sh) evaPlayShutter(sh.stage);
    const sp = t.find((s) => s.spark);
    if (sp) evaSparkPending = sp.spark;
    const bg = t.find((s) => s.bg);
    if (bg) evaSetBg(bg.bg);
    const rm = t.find((s) => s.remain);
    if (rm) evaMarkRemain(rm.remain);
    const mono = t.find((s) => s.mono);
    if (mono) evaMono(mono.mono);
    for (const s of t) {
      const p = evaParseNoise(s);
      if (p.bg) evaBgNoise(p.bg, s.color);
    }
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

  // キャラ連続の仮停止（擬似連のズレ目。7 は 10R 濃厚の見た目なので使わない。ユーザー指摘 2026-10-04）：
  // 3×3 は、左が数字 a を上段か下段に止め、中は左と同じ段か中段に a、右は必ず中段に a で止める
  // （左・中が横か斜めに並び、右だけ 1 段ずれる。右の a は中段だけで上下はブランクなので、どのラインも揃わない）。
  // 数字 3 つ（ST・図柄拡大）は左・中が a、右だけ隣の数字
  const charaCtl = {
    pause() {
      spinning.fill(false);
    },
    resume() {
      spinning.fill(true);
    },
    fakeStop() {
      spinning.fill(false);
      const a = evaRandDigit([7]);
      if (grid) {
        const leftRow = Math.random() < 0.5 ? 0 : 2;
        const rows = [leftRow, Math.random() < 0.5 ? leftRow : 1, 1];
        rows.forEach((row, col) => {
          frames[col] = evaPosOf(col, a, row);
          setCol(col, frameOf(col, frames[col]));
        });
        return;
      }
      const right = evaWrap(a + (Math.random() < 0.5 ? 1 : -1));
      const nums = [a, a, right === 7 ? evaWrap(a - 1) : right];
      nums.forEach((n, col) => {
        frames[col] = n;
        setCol(col, frameOf(col, frames[col]));
      });
    },
  };

  // リーチ前の予告：全部の列が回っている間に 1 段ずつ。
  // 前兆（先読み系）の段は図柄を隠し、その演出の専用画面（ドックンなら炎だけ）に切り替える
  let preUsed = 0;
  for (const t of pre) {
    const take = Array.isArray(t) && t.some((s) => s.takeover);
    const movie = Array.isArray(t) && t.find((s) => s.movie === "next");
    const chara = Array.isArray(t) && t.find((s) => s.chara);
    if (chara) {
      // キャラ連続：同じ段の他の文字を先に出してから、キャラと仮停止をくり返す
      const rest = t.filter((s) => s !== chara);
      if (rest.length) {
        show(rest);
        await evaSleep(EVA_STEP_MS);
        preUsed += EVA_STEP_MS;
      }
      show("");
      preUsed += await evaPlayChara(chara, charaCtl);
    } else if (movie) {
      // 次回予告：図柄を消して「予告」の画面と曲。同じ段の他の文字はその後に出す
      show("");
      await evaPlayNextMovie(movie);
      // ST の新次回予告（濃厚）：タイトルの後、リーチを経ずにいきなり図柄が揃う
      if (movie.nextHit && eff.isHit) {
        clearInterval(timer);
        spinning.fill(false);
        evaPlayNotice("impact", 1);
        [0, 1, 2].forEach((col) => setCol(col, finals[col], null, winKeys));
        return;
      }
      const rest = t.filter((s) => s !== movie);
      if (rest.length) {
        show(rest);
        await evaSleep(EVA_STEP_MS);
      }
      preUsed += EVA_NEXT_MOVIE_MS;
    } else if (take) {
      const undo = evaTakeover(t);
      show(t);
      await evaSleep(EVA_TAKEOVER_MS);
      undo();
      preUsed += EVA_TAKEOVER_MS;
    } else {
      show(t);
      await evaSleep(EVA_STEP_MS);
      preUsed += EVA_STEP_MS;
    }
  }
  // ST の高速区間の無演出即当り：回っている途中で液晶の真ん中に「残り N」が大きく出て、画面が白く光り、
  // 7 が左・中・右の順に止まって揃う（告知音・文字なし。実機の動画 2026-10-04）
  if (eff.instant777) {
    await evaSleep(EVA_INSTANT_FIRST_MS);
    evaShowRemain("white");
    await evaSleep(EVA_REMAIN_MS);
    evaWhiteout();
    await evaSleep(EVA_WHITEOUT_MS / 2);
    for (const col of [0, 1, 2]) {
      spinning[col] = false;
      setCol(col, finals[col], null, col === 2 ? winKeys : null);
      if (col < 2) await evaSleep(EVA_INSTANT_STEP_MS);
    }
    clearInterval(timer);
    [0, 1, 2].forEach((col) => setCol(col, finals[col], null, winKeys));
    return;
  }
  // 当該保留の変化（script.js の finishHold）が終わるまでは図柄を止めない（opts.holdMs：変動の始めからの時間）
  const holdLeft = () => Math.max(0, (opts.holdMs || 0) - preUsed);
  // 全回転リーチ：3 列とも同じ図柄を並べてゆっくり 1 周させ、7 で止まって震える
  if (eff.reachId === "zenkaiten" && eff.isHit) {
    await evaSleep(holdLeft());
    clearInterval(timer);
    if (eff.sp && opts.onSp) opts.onSp();
    await evaZenkaitenLap(eff, show, reachText, grid);
    return;
  }
  // ST の高速区間の演出の無いハズレは 1 回転 0.8 秒（opts.quick。script.js が決める）
  const leftMs = opts.quick ? EVA_QUICK_LEFT_MS : EVA_REEL_LEFT_MS;
  const rightMs = opts.quick ? EVA_QUICK_RIGHT_MS : EVA_REEL_RIGHT_MS;
  const centerMs = opts.quick ? EVA_QUICK_CENTER_MS : EVA_REEL_CENTER_MS;
  const reach = reachKeys.length > 0;
  // ST（数字 3 つ）はリーチ以外のとき左→中→右の順に止まる。リーチのときだけ左→右→中（実機。ユーザー指摘 2026-10-04）
  const lcr = !grid && !reach;
  await evaSleep(Math.max(0, leftMs - preUsed, holdLeft()));
  show("");
  spinning[0] = false;
  setCol(0, finals[0]);
  await evaSleep(rightMs - leftMs);
  if (lcr) {
    spinning[1] = false;
    setCol(1, finals[1]);
  } else {
    spinning[2] = false;
    setCol(0, finals[0], hotOf(0));
    setCol(2, finals[2], hotOf(2));
  }

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
    await evaSleep(centerMs - rightMs);
  }
  clearInterval(timer);
  spinning[1] = false;
  spinning[2] = false;

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
    // 「復活！！」は閃光より手前の専用の大きな文字で出す（演出文字の枠だと閃光で潰れて読めなかった。
    // ユーザー指摘 2026-10-03）
    show("");
    evaReviveBanner(true);
    evaPlayNotice("impact", 1); // 復活の合図は 1 回
    await evaSleep(150);
  }
  // 止まったらリーチの光を消し、当りならその段を光らせる
  [0, 1, 2].forEach((col) => setCol(col, finals[col], null, winKeys));
  if (revive) {
    await evaSleep(EVA_REVIVE_SHOW_MS);
    if (screenEl) screenEl.classList.remove("fx-revive");
    evaReviveBanner(false);
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

// --- 昇格演出 ---
// ヘソの偶数図柄の当りは必ず昇格演出を挟む（奇数図柄・暴走図柄の当りは挟まない。ユーザー方針 2026-10-03）。
// 実機の録画（E:/rec 2026-10-03 21-44-54）どおり：白く光った後、炎の背景の上で 3×3 の図柄が
// 3 列そろったまま縦に流れ、中段が奇数図柄で止まれば「確変GET」、偶数図柄で止まれば時短。
// チャンスアップは背景がオール赤。昇格の仕上げは録画の 4 つ：
//   普通に止まる／滑り（偶数で止まってからズルッと奇数へ）／槍（槍が貫いて図柄が大きく出る）／一撃（流れている途中で白く光って奇数）
// 滑り・槍・一撃とオール赤の昇格しない回は出さない／ほとんど出さない（「激熱昇格」）
const EVA_UPGRADE_ALLRED_IF_UP = 0.3; // 昇格するときオール赤になる割合
const EVA_UPGRADE_ALLRED_IF_DOWN = 0.03; // 昇格しないときオール赤になる割合
// 昇格するときの仕上げの振り分け（合計 1）
const EVA_UPGRADE_FINISH = [
  ["stop", 0.5],
  ["slide", 0.2],
  ["lance", 0.15],
  ["ichigeki", 0.15],
];
const EVA_UPGRADE_FLASH_MS = 350; // 始まりの白い光
// 通常時（3×3）は 1 周ほどを時間をかけてなめらかに流し、だんだん遅くなって止める（ユーザー方針 2026-10-03）
const EVA_UPGRADE_SCROLL_BASE_MS = 4200; // 流れる時間（1 周）
const EVA_UPGRADE_SCROLL_STEP_MS = 180; // 1 周を超える 1 段ごとに足す時間
const EVA_UPGRADE_SCROLL_EASE = "cubic-bezier(0.25, 0.55, 0.3, 1)"; // 止まり際がゆっくり
const EVA_UPGRADE_ROW_PX = 62; // 1 段の高さ（style.css の --cell-h。測れたら測った値）
const EVA_UPGRADE_PEEK_PX = 20; // 窓の上下にはみ出して見える高さ（--cell-peek。測れたら測った値）
const EVA_UPGRADE_STEP_MS = 260; // 数字 3 つの表示で 1 段進む時間（最初）
const EVA_UPGRADE_SLOW_MS = 90; // 止まる手前で 1 段ごとに足す時間
const EVA_UPGRADE_SLIDE_WAIT_MS = 700; // 滑りの前の止まっている間
const EVA_UPGRADE_SLIDE_MS = 450; // 滑りでズルッと 1 段動く時間
const EVA_UPGRADE_ZOOM_MS = 1000; // 槍の後に図柄が大きく出る時間
const EVA_UPGRADE_RESULT_MS = 1100; // 結果を見せる時間

// 3 列とも同じ図柄で、上段・中段・下段を出す（中段が n。リールの並びどおり上が n+1・下が n-1）。
// 数字 3 つの表示（ST 中のヘソ当りなど）なら中段の n だけ
function evaUpgradeRows(n, win) {
  if (evaUseGrid()) {
    // 昇格演出の帯はブランクを挟まず数字が続くので、はみ出す段も続きの数字
    const cells = [evaReelNext(n), n, evaReelPrev(n)];
    const peek = [evaWrap(n + 2), evaWrap(n - 2)];
    [0, 1, 2].forEach((col) =>
      evaGridSetCol(col, cells, null, win ? ["mid"] : null, peek),
    );
  } else {
    [1, 2, 3].forEach((i) =>
      evaPlainSet(i, n, getDigitClass(n, "通常") + (win ? " win" : "")),
    );
  }
}

// 3×3 の 3 列を、中段が from から steps 段先の図柄になるまでなめらかに流す（上から下へ。上段が次に中段へ来る）。
// 各列の中に図柄を縦に並べた帯を作り、translateY を CSS の transition で動かす。
// ms：流れる時間。途中で止めるとき（一撃）は evaUpgradeRows で帯ごと差し替える
function evaUpgradeScroll(from, steps, ms, ease) {
  // 帯の上から：steps+2 段先 … from の 2 つ手前。窓には 3 段と、その上下に少しはみ出す 1 段ずつが見える。
  // 最初は from が中段、最後は from+steps が中段
  const seq = [];
  for (let i = steps + 2; i >= -2; i--) seq.push(evaWrap(from + i));
  const cells = seq
    .map((n) => `<span class="cell ${evaCellClass(n)}">${n}</span>`)
    .join("");
  const strips = [];
  [1, 2, 3].forEach((i) => {
    const el = document.getElementById("d" + i);
    if (!el) return;
    el.className = "digit grid-col upg-scroll";
    el.innerHTML = `<div class="upg-strip">${cells}</div>`;
    if (el.firstChild) strips.push(el.firstChild);
  });
  const first = strips[0];
  const c = first && first.children;
  const row =
    c && c.length > 1 && c[1].offsetTop > c[0].offsetTop
      ? c[1].offsetTop - c[0].offsetTop
      : EVA_UPGRADE_ROW_PX;
  // 窓の上下にはみ出して見える高さ（窓の高さ − 3 段）÷ 2
  const win = first && first.parentElement && first.parentElement.clientHeight;
  const peek = win > 3 * row ? (win - 3 * row) / 2 : EVA_UPGRADE_PEEK_PX;
  // 中段が from+k のとき、帯の一番上から steps-k 番目の段（上にはみ出す段）の上端を窓の peek-row に合わせる
  const at = (k) => peek - row - (steps - k) * row;
  for (const s of strips) {
    s.style.transition = "none";
    s.style.transform = `translateY(${at(0)}px)`;
  }
  if (first) void first.offsetHeight; // 最初の位置を確定させてから動かす
  for (const s of strips) {
    s.style.transition = `transform ${ms}ms ${ease || EVA_UPGRADE_SCROLL_EASE}`;
    s.style.transform = `translateY(${at(steps)}px)`;
  }
}

function evaUpgradeFinish() {
  let r = Math.random();
  for (const [id, p] of EVA_UPGRADE_FINISH) {
    if (r < p) return id;
    r -= p;
  }
  return "stop";
}

// digit：止まっている偶数図柄。up：昇格するか。fast：高速オート（演出を省いて結果だけ）。
// jitan：昇格しなかったときの時短回数（今は表示に使っていない）。返り値：{ digit：最後の図柄, allRed, finish }
async function evaPlayUpgrade(digit, up, fast, jitan) {
  const allRed =
    Math.random() <
    (up ? EVA_UPGRADE_ALLRED_IF_UP : EVA_UPGRADE_ALLRED_IF_DOWN);
  const finish = up ? evaUpgradeFinish() : "stop";
  // 滑りは「奇数の 1 つ手前の偶数」で止まるので、手前が 9 になる 1 は使わない
  const odds = finish === "slide" ? [3, 5, 9] : [1, 3, 5, 9];
  const finalDigit = up
    ? odds[Math.floor(Math.random() * odds.length)]
    : [2, 4, 6, 8][Math.floor(Math.random() * 4)];
  if (fast) {
    evaUpgradeRows(finalDigit, up);
    return { digit: finalDigit, allRed, finish };
  }
  const ov = document.getElementById("effect-overlay");
  const screenEl = document.getElementById("screen");
  const bg = allRed ? "fx-upg-allred" : "fx-upg-flame";
  const setFx = (on, ...cls) => {
    if (screenEl) screenEl.classList[on ? "add" : "remove"](...cls);
  };
  evaSetZoom(null);
  evaSpark(null);
  evaSetBg(null);
  evaShowText(ov, "");
  // 白く光ってから炎の背景へ
  setFx(true, "fx-upg-white");
  await evaSleep(EVA_UPGRADE_FLASH_MS);
  setFx(false, "fx-upg-white");
  setFx(true, bg);
  // 昇格演出の中では文字を出さない（図柄が変わるのを見れば分かる。ユーザー方針 2026-10-03）

  // どこで止まるか：滑りは 1 つ手前の偶数、槍はいったん偶数で止まる、一撃は途中で切り上げる
  const stopAt =
    finish === "slide"
      ? evaReelPrev(finalDigit)
      : finish === "lance"
        ? [2, 4, 6, 8][Math.floor(Math.random() * 4)]
        : finalDigit;
  const dist = (((stopAt - digit) % 9) + 9) % 9;
  const steps = 9 + dist; // 1 周ほど流してから止める
  if (evaUseGrid()) {
    // 3×3：時間をかけてなめらかに 1 周ほど流れ、だんだん遅くなって止まる
    const ms = EVA_UPGRADE_SCROLL_BASE_MS + dist * EVA_UPGRADE_SCROLL_STEP_MS;
    evaUpgradeScroll(digit, steps, ms);
    // 一撃は流れている途中（6 割ほど）で白く光って切り上げる
    await evaSleep(finish === "ichigeki" ? ms * 0.6 : ms);
    if (finish !== "ichigeki") evaUpgradeRows(stopAt, false);
  } else {
    // 数字 3 つ（電サポ中のヘソ当り）：1 段ずつ進めて止める
    const cut = finish === "ichigeki" ? Math.max(3, steps - 6) : steps;
    let n = digit;
    for (let s = 1; s <= cut; s++) {
      n = evaReelNext(n);
      evaUpgradeRows(n, false);
      const left = steps - s;
      await evaSleep(
        EVA_UPGRADE_STEP_MS + Math.max(0, 5 - left) * EVA_UPGRADE_SLOW_MS,
      );
    }
  }
  let n = stopAt;
  if (finish === "slide") {
    // 偶数で止まって、間を置いてからズルッと奇数へ（1 段だけ流れる）
    await evaSleep(EVA_UPGRADE_SLIDE_WAIT_MS);
    n = finalDigit;
    if (evaUseGrid()) {
      evaUpgradeScroll(stopAt, 1, EVA_UPGRADE_SLIDE_MS, "ease-out");
      await evaSleep(EVA_UPGRADE_SLIDE_MS);
    } else {
      evaUpgradeRows(n, false);
      await evaSleep(EVA_UPGRADE_SLIDE_MS);
    }
  } else if (finish === "lance") {
    await evaSleep(EVA_UPGRADE_SLIDE_WAIT_MS);
    // 槍が貫いて、赤い画面に図柄が大きく出てから 3×3 に戻る
    setFx(true, "fx-lance");
    await evaSleep(700);
    setFx(false, "fx-lance");
    setFx(true, "fx-upg-allred");
    evaSetZoom("red");
    n = finalDigit;
    [1, 2, 3].forEach((i) => evaPlainSet(i, n, "digit odd"));
    await evaSleep(EVA_UPGRADE_ZOOM_MS);
    evaSetZoom(null);
  } else if (finish === "ichigeki") {
    // 流れている途中で白く光り、いきなり奇数図柄
    setFx(true, "fx-upg-white");
    await evaSleep(EVA_UPGRADE_FLASH_MS);
    setFx(false, "fx-upg-white");
    n = finalDigit;
  }
  setFx(false, "fx-upg-flame", "fx-upg-allred");
  evaUpgradeRows(finalDigit, up);
  if (up) {
    const lamp = document.getElementById("lamp");
    if (lamp) lamp.classList.add("lamp-active");
    evaPlayNotice("impact", 1);
    await evaSleep(EVA_UPGRADE_RESULT_MS);
    if (lamp) lamp.classList.remove("lamp-active");
  } else {
    // 昇格しなかったときは文字を出さずにそのまま時短へ（「時短 100回」の表示は要らない。ユーザー方針 2026-10-04）
    await evaSleep(EVA_UPGRADE_RESULT_MS);
  }
  evaShowText(ov, "");
  return { digit: finalDigit, allRed, finish };
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
