// 将棋 CPU 対局の画面: 盤の操作・CPU（Worker）とのやり取り・思考時間・評価値・レーティング・CPU 同士の対局・棋譜
import {
  Position,
  legalMoves,
  moveFrom,
  moveTo,
  isDrop,
  dropType,
  moveToUsi,
  moveToKif,
  BLACK,
  WHITE,
  HAND_TYPES,
  BOARD_CHAR,
  KIF_NAME,
} from "../../../lab/shogi/js/core.js";
import { LEVELS, EVAL_LEVEL } from "./levels.js";
import { START, record, initialRecord, judge, toKif } from "./rules.js";
import { toBlack, evalText, barRatio, graphSvg } from "./evalbar.js";
import {
  loadRating,
  saveRating,
  clearRating,
  updateRating,
  nearestLevel,
} from "./rating.js";

const $ = (id) => document.getElementById(id);
const PROMOTE = 1 << 14;
const ZEN = "０１２３４５６７８９";
const KAN = "〇一二三四五六七八九";
const LEVEL_KEY = "gp-shogi-level";
const EVAL_KEY = "gp-shogi-eval";
// 初めての人のレーティング（入門 Lv3 と同じ）
const START_RATING = LEVELS.find(
  (l) => l.group === "入門" && l.lv === 3,
).rating;

let start = null; // 初形
let pos = null; // 今の局面
let moves = []; // 指した手
let kifs = []; // 手ごとの表記（▲７六歩 など）
let history = []; // 終局判定用 { key, check, side }
let mode = "human"; // "human"（あなた 対 CPU）| "cpu"（CPU 対 CPU）
let userSide = BLACK; // あなたの手番（CPU 対 CPU では盤の下に先手）
let cpuLevels = [null, null]; // 手番ごとの CPU の段階（人の手番は null）
let over = null; // 終局 { kind, winner }
let sel = null; // 選んだ駒 { sq } または持ち駒 { drop: 駒 }
let pending = null; // 成る／成らないの選択待ち { promote, plain }
let paused = false; // CPU 対 CPU の一時停止
let usedUndo = false; // 待ったを使った対局はレーティングに数えない
let ratingNote = ""; // 終局のときのレーティングの増減
let thinkingId = 0; // CPU に頼んだ手の番号（古い返事を捨てるため）
let thinking = false;
let worker = null;
// 思考時間: 手ごとの消費時間（ms）・今の手番が始まった時刻・CPU が指すまで待つ時間
let times = [];
let turnStart = 0;
let cpuDelay = 0;
let delayTimer = null;
// 評価値: 手数ごとの先手から見た評価値（初形が 0 番）。評価用は 2 本目の Worker
let evals = [];
let evalWorker = null;
let showEval = true;

// ---- CPU（Worker） ----
function createWorker() {
  worker = new Worker(new URL("./cpu-worker.js", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (ev) => {
    const d = ev.data;
    if (d.type === "ready") return;
    if (d.id !== thinkingId) return;
    if (d.type === "error") {
      // 開き直しても答えが出なかったときは、対局を止めないよう合法手から 1 つ選んで指す
      console.warn("CPU のエラー:", d.message);
      const list = legalMoves(pos);
      thinking = false;
      if (!list.length) return render();
      return play(list[Math.floor(Math.random() * list.length)]);
    }
    // どの強さでも考えている感じを出すため、決めた思考時間までは待ってから指す
    const id = d.id;
    const wait = cpuDelay - (performance.now() - turnStart);
    delayTimer = setTimeout(
      () => {
        if (id !== thinkingId) return;
        thinking = false;
        cpuMoved(d.move);
      },
      Math.max(0, wait),
    );
  };
  worker.onerror = (e) => {
    thinking = false;
    setStatus(`CPU を起動できませんでした（${e.message || "読み込みの失敗"}）`);
  };
  worker.postMessage({ type: "warm" });
}

// 考えている途中の CPU は止められないので、作り直す
function resetWorker() {
  if (worker) worker.terminate();
  clearTimeout(delayTimer);
  thinking = false;
  thinkingId++;
  createWorker();
}

// 今の手順を USI の局面にする（千日手をエンジンが分かるように手順ごと）
const positionText = (list = moves) => {
  const usi = list.map(moveToUsi).join(" ");
  return usi ? `${START} moves ${usi}` : START;
};

// CPU の思考時間（演出）: 序盤は短め、指せる手が少ないときも短め、それ以外は 1.5〜4 秒
function thinkTarget() {
  const r = (a, b) => a + Math.random() * (b - a);
  if (legalMoves(pos).length <= 2) return r(600, 1200);
  if (moves.length < 6) return r(800, 1800);
  return r(1500, 4000);
}

function askCpu() {
  thinking = true;
  thinkingId++;
  cpuDelay = thinkTarget();
  worker.postMessage({
    type: "think",
    id: thinkingId,
    position: positionText(),
    level: cpuLevels[pos.side],
  });
  render();
}

// 手番が CPU で、止めていなければ考えさせる
function nextTurn() {
  if (!over && !paused && !thinking && cpuLevels[pos.side]) askCpu();
}

function cpuMoved(usi) {
  const side = pos.side;
  if (usi === "resign") return finish({ kind: "resign", winner: side ^ 1 });
  if (usi === "win") return finish({ kind: "declare", winner: side });
  const m = legalMoves(pos).find((x) => moveToUsi(x) === usi);
  if (m === undefined) {
    setStatus(`CPU の手（${usi}）が指せませんでした`);
    return render();
  }
  play(m);
}

// ---- 評価値（2 本目の Worker） ----
function createEvalWorker() {
  evalWorker = new Worker(new URL("./cpu-worker.js", import.meta.url), {
    type: "module",
  });
  evalWorker.onmessage = (ev) => {
    const d = ev.data;
    if (d.type !== "move" || d.score === null || d.score === undefined) return;
    // 待ったで手順が変わっていたら捨てる（id に手数、position で手順を確かめる）
    const ply = d.id;
    if (ply > moves.length || positionText(moves.slice(0, ply)) !== d.position)
      return;
    evals[ply] = toBlack(d.score, ply % 2 === 0 ? BLACK : WHITE);
    renderEval();
  };
}

// 今の局面の評価を頼む（評価値を表示しないときは頼まない）
function askEval() {
  if (!showEval || !pos) return;
  if (!evalWorker) createEvalWorker();
  const ply = moves.length;
  // 終局の局面は評価しない（詰みは手番側の負け）
  if (over?.kind === "mate") {
    evals[ply] = toBlack(-30000, pos.side);
    return renderEval();
  }
  const position = positionText();
  evalWorker.postMessage({
    type: "think",
    id: ply,
    position,
    level: EVAL_LEVEL,
  });
}

function renderEval() {
  const box = $("gsEval");
  box.hidden = !showEval;
  if (!showEval) return;
  // まだ評価が来ていない手数は、前の値を見せる
  let s = null;
  for (let i = Math.min(moves.length, evals.length - 1); i >= 0; i--)
    if (evals[i] !== undefined) {
      s = evals[i];
      break;
    }
  $("gsEvalFill").style.width = `${(barRatio(s) * 100).toFixed(1)}%`;
  $("gsEvalText").textContent = `評価値 ${evalText(s)}（左が先手・右が後手）`;
  const scores = [];
  for (let i = 0; i <= moves.length; i++) scores.push(evals[i] ?? null);
  $("gsGraph").innerHTML = graphSvg(scores);
}

// ---- 指す ----
function play(m) {
  const side = pos.side;
  const now = performance.now();
  times.push(now - turnStart);
  turnStart = now;
  kifs.push(moveToKif(pos, m, moves.length ? moveTo(moves.at(-1)) : -1));
  pos.doMove(m);
  moves.push(m);
  history.push(record(pos, side));
  sel = null;
  pending = null;
  const o = judge(pos, history);
  if (o) return finish(o);
  askEval();
  render();
  nextTurn();
}

// 初形から list を指し直して、局面・表記・履歴・消費時間を作り直す（待った用）
function replay(list) {
  times = times.slice(0, list.length);
  evals = evals.slice(0, list.length + 1);
  turnStart = performance.now();
  pos = start.clone();
  moves = [];
  kifs = [];
  history = [initialRecord(pos)];
  for (const m of list) {
    const side = pos.side;
    kifs.push(moveToKif(pos, m, moves.length ? moveTo(moves.at(-1)) : -1));
    pos.doMove(m);
    moves.push(m);
    history.push(record(pos, side));
  }
}

// 終局。あなた 対 CPU で待ったを使っていなければ、レーティングを更新する
function finish(o) {
  over = o;
  ratingNote = "";
  if (mode === "human" && o.kind !== "idle") {
    if (usedUndo) ratingNote = "待ったを使ったので、レーティングには数えません";
    else {
      const score = o.winner === null ? 0.5 : o.winner === userSide ? 1 : 0;
      const cpu = cpuLevels[userSide ^ 1];
      const before = loadRating(START_RATING);
      const after = updateRating(before, cpu.rating, score);
      saveRating(after);
      const sign = after.delta >= 0 ? "+" : "−";
      ratingNote = `レーティング ${before.rating} → ${after.rating}（${sign}${Math.abs(after.delta)}）`;
    }
  }
  askEval();
  render();
  renderRating();
}

const userTurn = () =>
  mode === "human" && !over && !thinking && pos && pos.side === userSide;

// 選んだ駒（持ち駒）で指せる手
function candidates() {
  if (!sel) return [];
  return legalMoves(pos).filter((m) =>
    sel.drop
      ? isDrop(m) && dropType(m) === sel.drop
      : !isDrop(m) && moveFrom(m) === sel.sq,
  );
}

// 盤の下に来る側（あなた。CPU 対 CPU では先手）。後手なら盤を回す
const viewSide = () => (mode === "human" ? userSide : BLACK);
const sqAt = (d) => (viewSide() === WHITE ? 80 - d : d);

function onSquare(d) {
  if (!userTurn() || pending) return;
  const sq = sqAt(d);
  const toHere = candidates().filter((m) => moveTo(m) === sq);
  if (toHere.length === 2) {
    // 成る手と成らない手の両方が指せる
    pending = {
      promote: toHere.find((m) => m & PROMOTE),
      plain: toHere.find((m) => !(m & PROMOTE)),
    };
    return render();
  }
  if (toHere.length === 1) return play(toHere[0]);
  const p = pos.board[sq];
  const mine = p && p > 0 === (userSide === BLACK);
  sel = mine && !(sel && sel.sq === sq) ? { sq } : null;
  render();
}

function onHand(pt) {
  if (!userTurn() || pending) return;
  sel = sel && sel.drop === pt ? null : { drop: pt };
  render();
}

// ---- 描画 ----
const squares = [];
function buildBoard() {
  const board = $("gsBoard");
  for (let d = 0; d < 81; d++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sg-sq";
    b.setAttribute("role", "gridcell");
    b.addEventListener("click", () => onSquare(d));
    board.appendChild(b);
    squares.push(b);
  }
}

function render() {
  if (!pos) return;
  const flip = viewSide() === WHITE;
  const last = moves.length ? moves.at(-1) : null;
  const dests = new Set(candidates().map(moveTo));
  const active = userTurn() && !pending;
  for (let d = 0; d < 81; d++) {
    const sq = sqAt(d);
    const el = squares[d];
    const p = pos.board[sq];
    el.classList.toggle("sg-last", last !== null && moveTo(last) === sq);
    el.classList.toggle(
      "sg-from",
      last !== null && !isDrop(last) && moveFrom(last) === sq,
    );
    el.classList.toggle("gs-sel", !!sel && sel.sq === sq);
    el.classList.toggle("gs-dest", dests.has(sq));
    el.disabled = !active;
    if (!p) {
      el.innerHTML = "";
      el.setAttribute("aria-label", `${squareText(sq)} 空き`);
      continue;
    }
    const a = Math.abs(p);
    const owner = p > 0 ? BLACK : WHITE;
    const cls = ["sg-piece"];
    if (owner !== viewSide()) cls.push("sg-white");
    if (a > 8) cls.push("sg-promoted");
    el.innerHTML = `<span class="${cls.join(" ")}">${BOARD_CHAR[a]}</span>`;
    el.setAttribute(
      "aria-label",
      `${squareText(sq)} ${who(owner)}の${KIF_NAME[a]}`,
    );
  }
  $("gsFiles").innerHTML = (flip ? "123456789" : "987654321")
    .split("")
    .map((f) => `<span>${f}</span>`)
    .join("");
  $("gsRanks").innerHTML = (flip ? "九八七六五四三二一" : "一二三四五六七八九")
    .split("")
    .map((r) => `<span>${r}</span>`)
    .join("");
  renderHands(active);
  renderPanel();
  renderEval();
}

const squareText = (sq) => ZEN[9 - (sq % 9)] + KAN[((sq / 9) | 0) + 1];

// その手番の呼び方（「あなた」「CPU」、CPU 対 CPU では「先手（入門 Lv1）」）
function who(side) {
  if (mode === "human") return side === userSide ? "あなた" : "CPU";
  return `${side === BLACK ? "先手" : "後手"}（${cpuLevels[side].name}）`;
}

function renderHands(active) {
  const top = viewSide() ^ 1;
  const opp = pos.hand[top];
  const items = HAND_TYPES.filter((pt) => opp[pt] > 0).map(
    (pt) =>
      `<span>${KIF_NAME[pt]}${opp[pt] > 1 ? `<span class="sg-count">${opp[pt]}</span>` : ""}</span>`,
  );
  $("gsHandTop").innerHTML = items.length
    ? items.join("")
    : `<span class="sg-hand-empty">なし</span>`;
  const mine = pos.hand[viewSide()];
  const buttons = HAND_TYPES.filter((pt) => mine[pt] > 0).map(
    (pt) =>
      `<button type="button" data-pt="${pt}" class="${sel && sel.drop === pt ? "gs-sel" : ""}" ${active ? "" : "disabled"}>${KIF_NAME[pt]}${mine[pt] > 1 ? `<span class="sg-count">${mine[pt]}</span>` : ""}</button>`,
  );
  $("gsHandBottom").innerHTML = buttons.length
    ? buttons.join("")
    : `<span class="sg-hand-empty">なし</span>`;
  $("gsTopLabel").textContent = `${who(top)}の持ち駒`;
  $("gsBottomLabel").textContent = `${who(viewSide())}の持ち駒`;
}

function renderPanel() {
  $("gsPromote").hidden = !pending;
  const human = mode === "human";
  $("gsUndo").hidden = !human;
  $("gsResign").hidden = !human;
  $("gsPause").hidden = human;
  $("gsPause").textContent = paused ? "再開" : "一時停止";
  $("gsPause").disabled = !!over;
  $("gsUndo").disabled =
    !!over || !moves.some((_, i) => sideAt(i) === userSide);
  $("gsResign").disabled = !!over;
  $("gsRatingNote").hidden = !ratingNote;
  $("gsRatingNote").textContent = ratingNote;
  tick();
  $("gsMoves").innerHTML = kifs
    .map(
      (k, i) =>
        `<li class="${i === kifs.length - 1 ? "gs-current" : ""}">${i + 1} ${k}<span class="gs-time">${fmtSec(times[i])}</span></li>`,
    )
    .join("");
  const list = $("gsMoves");
  list.scrollTop = list.scrollHeight;
}

// 状態の行と持ち時間の表示（0.1 秒ごとに書き直す）
function tick() {
  if (!pos || $("gsPlayCard").hidden) return;
  const now = performance.now();
  const st = $("gsStatus");
  st.classList.toggle("gs-end", !!over);
  if (over) st.textContent = overText(over);
  else if (paused) st.textContent = "一時停止中";
  else if (thinking)
    st.textContent = `${who(pos.side)}が考えています… ${((now - turnStart) / 1000).toFixed(1)} 秒`;
  else if (pending) st.textContent = "成るか成らないかを選んでください";
  else if (userTurn())
    st.textContent = `あなたの番です${pos.inCheck() ? "（王手されています）" : ""}　${fmtClock(now - turnStart)}`;
  // 両者の合計の消費時間（今の手番の分も足す。止めている間は足さない）
  const total = [0, 0];
  times.forEach((t, i) => (total[sideAt(i)] += t));
  if (!over && !paused) total[pos.side] += now - turnStart;
  const name = (s) =>
    mode === "human" ? who(s) : s === BLACK ? "先手" : "後手";
  $("gsClock").textContent =
    `${name(viewSide())} ${fmtClock(total[viewSide()])}　／　${name(viewSide() ^ 1)} ${fmtClock(total[viewSide() ^ 1])}`;
}

// 1 手の時間の表示（「3秒」「1分05秒」）
function fmtSec(ms) {
  if (ms === undefined) return "";
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60
    ? `${s}秒`
    : `${Math.floor(s / 60)}分${String(s % 60).padStart(2, "0")}秒`;
}

// 合計の表示（「0:12」「12:05」）
function fmtClock(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// 手順の i 手目を指す側（初形は先手番）
const sideAt = (i) => (i % 2 === 0 ? BLACK : WHITE);

function overText(o) {
  const won = (s) =>
    mode === "human" && s === userSide
      ? "あなたの勝ちです"
      : `${who(s)}の勝ちです`;
  switch (o.kind) {
    case "mate":
      return `${moves.length}手で詰み。${won(o.winner)}`;
    case "resign":
      return mode === "human" && o.winner !== userSide
        ? "投了しました。CPU の勝ちです"
        : `${who(o.winner ^ 1)}が投了しました。${won(o.winner)}`;
    case "declare":
      return `${who(o.winner)}の入玉宣言。${won(o.winner)}`;
    case "perpetual":
      return `連続王手の千日手。${won(o.winner)}`;
    default:
      return "千日手で引き分けです";
  }
}

function setStatus(text) {
  $("gsStatus").textContent = text;
}

// 準備の欄のレーティングの表示
function renderRating() {
  const r = loadRating(START_RATING);
  const near = nearestLevel(r.rating, LEVELS);
  $("gsRating").textContent = r.games
    ? `あなたのレーティング ${r.rating}（${r.games} 局・目安: ${near.name} くらい）`
    : `あなたのレーティング ${r.rating}（まだ対局していません。最初は ${near.name} と同じ）`;
}

// ---- 操作 ----
function startGame() {
  mode = document.querySelector('input[name="gsMode"]:checked').value;
  const l1 = LEVELS[Number($("gsLevel").value)];
  const l2 = LEVELS[Number($("gsLevel2").value)];
  try {
    localStorage.setItem(LEVEL_KEY, String(l1.id));
  } catch (e) {}
  if (mode === "human") {
    const choice = document.querySelector('input[name="gsSide"]:checked').value;
    userSide =
      choice === "white"
        ? WHITE
        : choice === "black"
          ? BLACK
          : Math.random() < 0.5
            ? BLACK
            : WHITE;
    cpuLevels = [null, null];
    cpuLevels[userSide ^ 1] = l1;
  } else {
    userSide = BLACK;
    cpuLevels = [l1, l2];
  }
  if (thinking) resetWorker();
  start = Position.fromSfen(START);
  times = [];
  evals = [];
  replay([]);
  over = null;
  sel = null;
  pending = null;
  paused = false;
  usedUndo = false;
  ratingNote = "";
  $("gsSetupCard").hidden = true;
  $("gsPlayCard").hidden = false;
  $("gsTitle").textContent =
    mode === "human"
      ? `あなた（${userSide === BLACK ? "▲先手" : "△後手"}） 対 CPU（${l1.name}）`
      : `▲${l1.name} 対 △${l2.name}`;
  askEval();
  render();
  nextTurn();
}

function undo() {
  if (over || mode !== "human") return;
  if (thinking) resetWorker();
  // あなたが最後に指した手の前まで戻す
  let k = moves.length - 1;
  while (k >= 0 && sideAt(k) !== userSide) k--;
  if (k < 0) return render();
  usedUndo = true;
  replay(moves.slice(0, k));
  sel = null;
  pending = null;
  render();
}

function resign() {
  if (over || mode !== "human") return;
  if (thinking) resetWorker();
  finish({ kind: "resign", winner: userSide ^ 1 });
}

function togglePause() {
  if (over || mode !== "cpu") return;
  paused = !paused;
  if (paused) {
    // 考え中の CPU は止められないので作り直し、再開したらその局面から考え直す
    if (thinking) resetWorker();
  } else turnStart = performance.now();
  render();
  nextTurn();
}

function newGame() {
  if (thinking) resetWorker();
  pos = null;
  renderRating();
  $("gsSetupCard").hidden = false;
  $("gsPlayCard").hidden = true;
}

function copyKif() {
  if (!start) return;
  const name = (s) =>
    mode === "human" && s === userSide
      ? "あなた"
      : `CPU（${cpuLevels[s].name}）`;
  const endText = over
    ? ({
        mate: "詰み",
        resign: "投了",
        declare: "入玉勝ち",
        perpetual: "反則負け",
      }[over.kind] ?? "千日手")
    : "中断";
  const text = toKif(start, moves, {
    black: name(BLACK),
    white: name(WHITE),
    endText,
    times,
  });
  navigator.clipboard?.writeText(text).then(
    () => setStatus("棋譜（KIF）をコピーしました"),
    () => setStatus("コピーできませんでした"),
  );
}

// 準備の欄: 対局の形で、強さの欄と手番の欄を出し分ける
function renderSetup() {
  const cpuMode =
    document.querySelector('input[name="gsMode"]:checked').value === "cpu";
  $("gsLevelLabel").textContent = cpuMode ? "先手 CPU の強さ" : "CPU の強さ";
  $("gsLevel2Field").hidden = !cpuMode;
  $("gsSideField").hidden = cpuMode;
}

// ---- 起動 ----
function levelOptions() {
  // 段階（入門・初級・上級・最強）ごとにまとめて並べる
  const groups = [...new Set(LEVELS.map((l) => l.group))];
  return groups
    .map(
      (g) =>
        `<optgroup label="${g}">${LEVELS.map((l, i) => (l.group === g ? `<option value="${i}">${l.name}</option>` : "")).join("")}</optgroup>`,
    )
    .join("");
}

function init() {
  buildBoard();
  $("gsLevel").innerHTML = levelOptions();
  $("gsLevel2").innerHTML = levelOptions();
  let saved = 2;
  try {
    saved = Number(localStorage.getItem(LEVEL_KEY)) || 2;
    showEval = localStorage.getItem(EVAL_KEY) !== "0";
  } catch (e) {}
  const idx = Math.max(
    0,
    LEVELS.findIndex((l) => l.id === saved),
  );
  $("gsLevel").value = String(idx);
  $("gsLevel2").value = String(idx);
  $("gsShowEval").checked = showEval;
  setInterval(tick, 100);
  document
    .querySelectorAll('input[name="gsMode"]')
    .forEach((r) => r.addEventListener("change", renderSetup));
  $("gsShowEval").addEventListener("change", () => {
    showEval = $("gsShowEval").checked;
    try {
      localStorage.setItem(EVAL_KEY, showEval ? "1" : "0");
    } catch (e) {}
    if (showEval) askEval();
    renderEval();
  });
  $("gsStart").addEventListener("click", startGame);
  $("gsUndo").addEventListener("click", undo);
  $("gsResign").addEventListener("click", resign);
  $("gsPause").addEventListener("click", togglePause);
  $("gsNew").addEventListener("click", newGame);
  $("gsCopyKif").addEventListener("click", copyKif);
  $("gsRatingReset").addEventListener("click", () => {
    clearRating();
    renderRating();
  });
  $("gsHandBottom").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-pt]");
    if (b) onHand(Number(b.dataset.pt));
  });
  $("gsPromote").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-promote]");
    if (!b || !pending) return;
    play(b.dataset.promote === "1" ? pending.promote : pending.plain);
  });
  createWorker();
  renderSetup();
  renderRating();
  // 盤は初形を出しておく（over を立てて、対局開始までは操作できないようにする）
  start = Position.fromSfen(START);
  pos = start.clone();
  over = { kind: "idle" };
  render();
}

init();
