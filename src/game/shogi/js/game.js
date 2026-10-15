// 将棋 CPU 対局の画面: 盤の操作・CPU（Worker）とのやり取り・終局・棋譜
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
import { LEVELS } from "./levels.js";
import { START, record, initialRecord, judge, toKif } from "./rules.js";

const $ = (id) => document.getElementById(id);
const PROMOTE = 1 << 14;
const ZEN = "０１２３４５６７８９";
const KAN = "〇一二三四五六七八九";
const LEVEL_KEY = "gp-shogi-level";

let start = null; // 初形
let pos = null; // 今の局面
let moves = []; // 指した手
let kifs = []; // 手ごとの表記（▲７六歩 など）
let history = []; // 終局判定用 { key, check, side }
let userSide = BLACK;
let level = LEVELS[1];
let over = null; // 終局 { kind, winner }
let sel = null; // 選んだ駒 { sq } または持ち駒 { drop: 駒 }
let pending = null; // 成る／成らないの選択待ち { promote, plain }
let thinkingId = 0; // CPU に頼んだ手の番号（古い返事を捨てるため）
let thinking = false;
let worker = null;

// ---- CPU（Worker） ----
function createWorker() {
  worker = new Worker(new URL("./cpu-worker.js", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (ev) => {
    const d = ev.data;
    if (d.type === "ready") return;
    if (d.id !== thinkingId) return;
    thinking = false;
    if (d.type === "error") {
      setStatus(`CPU でエラーが起きました（${d.message}）`);
      return render();
    }
    cpuMoved(d.move);
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
  thinking = false;
  thinkingId++;
  createWorker();
}

function askCpu() {
  thinking = true;
  thinkingId++;
  const usi = moves.map(moveToUsi).join(" ");
  worker.postMessage({
    type: "think",
    id: thinkingId,
    position: usi ? `${START} moves ${usi}` : START,
    level,
  });
  render();
}

function cpuMoved(usi) {
  const cpuSide = userSide ^ 1;
  if (usi === "resign") {
    over = { kind: "resign", winner: userSide };
    return render();
  }
  if (usi === "win") {
    over = { kind: "declare", winner: cpuSide };
    return render();
  }
  const m = legalMoves(pos).find((x) => moveToUsi(x) === usi);
  if (m === undefined) {
    setStatus(`CPU の手（${usi}）が指せませんでした`);
    return render();
  }
  play(m);
}

// ---- 指す ----
function play(m) {
  const side = pos.side;
  kifs.push(moveToKif(pos, m, moves.length ? moveTo(moves.at(-1)) : -1));
  pos.doMove(m);
  moves.push(m);
  history.push(record(pos, side));
  sel = null;
  pending = null;
  over = judge(pos, history);
  render();
  if (!over && pos.side !== userSide) askCpu();
}

// 初形から moves を指し直して、局面・表記・履歴を作り直す（待った用）
function replay(list) {
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

const userTurn = () => !over && !thinking && pos && pos.side === userSide;

// 選んだ駒（持ち駒）で指せる手
function candidates() {
  if (!sel) return [];
  return legalMoves(pos).filter((m) =>
    sel.drop
      ? isDrop(m) && dropType(m) === sel.drop
      : !isDrop(m) && moveFrom(m) === sel.sq,
  );
}

// 盤の表示の位置 d → 局面の升（後手番のときは盤を回す）
const sqAt = (d) => (userSide === WHITE ? 80 - d : d);

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
  const flip = userSide === WHITE;
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
    const theirs = p > 0 !== (userSide === BLACK);
    const cls = ["sg-piece"];
    if (theirs) cls.push("sg-white");
    if (a > 8) cls.push("sg-promoted");
    el.innerHTML = `<span class="${cls.join(" ")}">${BOARD_CHAR[a]}</span>`;
    el.setAttribute(
      "aria-label",
      `${squareText(sq)} ${theirs ? "CPU" : "あなた"}の${KIF_NAME[a]}`,
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
}

const squareText = (sq) => ZEN[9 - (sq % 9)] + KAN[((sq / 9) | 0) + 1];

function renderHands(active) {
  const cpu = pos.hand[userSide ^ 1];
  const items = HAND_TYPES.filter((pt) => cpu[pt] > 0).map(
    (pt) =>
      `<span>${KIF_NAME[pt]}${cpu[pt] > 1 ? `<span class="sg-count">${cpu[pt]}</span>` : ""}</span>`,
  );
  $("gsHandTop").innerHTML = items.length
    ? items.join("")
    : `<span class="sg-hand-empty">なし</span>`;
  const mine = pos.hand[userSide];
  const buttons = HAND_TYPES.filter((pt) => mine[pt] > 0).map(
    (pt) =>
      `<button type="button" data-pt="${pt}" class="${sel && sel.drop === pt ? "gs-sel" : ""}" ${active ? "" : "disabled"}>${KIF_NAME[pt]}${mine[pt] > 1 ? `<span class="sg-count">${mine[pt]}</span>` : ""}</button>`,
  );
  $("gsHandBottom").innerHTML = buttons.length
    ? buttons.join("")
    : `<span class="sg-hand-empty">なし</span>`;
}

function renderPanel() {
  $("gsPromote").hidden = !pending;
  $("gsUndo").disabled =
    !!over || !moves.some((_, i) => sideAt(i) === userSide);
  $("gsResign").disabled = !!over;
  const st = $("gsStatus");
  st.classList.toggle("gs-end", !!over);
  if (over) st.textContent = overText(over);
  else if (thinking) st.textContent = `CPU（${level.name}）が考えています…`;
  else if (pending) st.textContent = "成るか成らないかを選んでください";
  else
    st.textContent = `あなたの番です${pos.inCheck() ? "（王手されています）" : ""}`;
  $("gsMoves").innerHTML = kifs
    .map(
      (k, i) =>
        `<li class="${i === kifs.length - 1 ? "gs-current" : ""}">${i + 1} ${k}</li>`,
    )
    .join("");
  const list = $("gsMoves");
  list.scrollTop = list.scrollHeight;
}

// 手順の i 手目を指す側（初形は先手番）
const sideAt = (i) => (i % 2 === 0 ? BLACK : WHITE);

function overText(o) {
  const who = (s) => (s === userSide ? "あなた" : "CPU");
  switch (o.kind) {
    case "mate":
      return `${moves.length}手で詰み。${who(o.winner)}の勝ちです`;
    case "resign":
      return o.winner === userSide
        ? "CPU が投了しました。あなたの勝ちです"
        : "投了しました。CPU の勝ちです";
    case "declare":
      return "CPU の入玉宣言。CPU の勝ちです";
    case "perpetual":
      return `連続王手の千日手。${who(o.winner)}の勝ちです`;
    default:
      return "千日手で引き分けです";
  }
}

function setStatus(text) {
  $("gsStatus").textContent = text;
}

// ---- 操作 ----
function startGame() {
  level = LEVELS[Number($("gsLevel").value)];
  try {
    localStorage.setItem(LEVEL_KEY, String(level.id));
  } catch (e) {}
  const choice = document.querySelector('input[name="gsSide"]:checked').value;
  userSide =
    choice === "white"
      ? WHITE
      : choice === "black"
        ? BLACK
        : Math.random() < 0.5
          ? BLACK
          : WHITE;
  start = Position.fromSfen(START);
  replay([]);
  over = null;
  sel = null;
  pending = null;
  if (thinking) resetWorker();
  $("gsSetupCard").hidden = true;
  $("gsPlayCard").hidden = false;
  $("gsTitle").textContent =
    `あなた（${userSide === BLACK ? "▲先手" : "△後手"}） 対 CPU（${level.name}）`;
  $("gsTopLabel").textContent = "CPU の持ち駒";
  $("gsBottomLabel").textContent = "あなたの持ち駒";
  render();
  if (pos.side !== userSide) askCpu();
}

function undo() {
  if (over) return;
  if (thinking) resetWorker();
  // あなたが最後に指した手の前まで戻す
  let k = moves.length - 1;
  while (k >= 0 && sideAt(k) !== userSide) k--;
  if (k < 0) return render();
  replay(moves.slice(0, k));
  sel = null;
  pending = null;
  render();
}

function resign() {
  if (over) return;
  if (thinking) resetWorker();
  over = { kind: "resign", winner: userSide ^ 1 };
  render();
}

function newGame() {
  if (thinking) resetWorker();
  pos = null;
  $("gsSetupCard").hidden = false;
  $("gsPlayCard").hidden = true;
}

function copyKif() {
  if (!start) return;
  const cpu = `CPU（${level.name}）`;
  const endText = over
    ? ({
        mate: "詰み",
        resign: "投了",
        declare: "入玉勝ち",
        perpetual: "反則負け",
      }[over.kind] ?? "千日手")
    : "中断";
  const text = toKif(start, moves, {
    black: userSide === BLACK ? "あなた" : cpu,
    white: userSide === WHITE ? "あなた" : cpu,
    endText,
  });
  navigator.clipboard?.writeText(text).then(
    () => setStatus("棋譜（KIF）をコピーしました"),
    () => setStatus("コピーできませんでした"),
  );
}

// ---- 起動 ----
function init() {
  buildBoard();
  const levelSelect = $("gsLevel");
  levelSelect.innerHTML = LEVELS.map(
    (l, i) => `<option value="${i}">${l.id}. ${l.name}</option>`,
  ).join("");
  let saved = 2;
  try {
    saved = Number(localStorage.getItem(LEVEL_KEY)) || 2;
  } catch (e) {}
  levelSelect.value = String(
    Math.max(
      0,
      LEVELS.findIndex((l) => l.id === saved),
    ),
  );
  $("gsStart").addEventListener("click", startGame);
  $("gsUndo").addEventListener("click", undo);
  $("gsResign").addEventListener("click", resign);
  $("gsNew").addEventListener("click", newGame);
  $("gsCopyKif").addEventListener("click", copyKif);
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
  // 盤は初形を出しておく（over を立てて、対局開始までは操作できないようにする）
  start = Position.fromSfen(START);
  pos = start.clone();
  over = { kind: "idle" };
  render();
}

init();
