// 詰将棋ソルバーの画面: 盤の編集・解く・手順の再生
import {
  Position,
  BLACK,
  WHITE,
  OU,
  HAND_TYPES,
  PIECE_TOTAL,
  BOARD_CHAR,
  KIF_NAME,
  fillDefenderHand,
  moveToKif,
  moveFrom,
  moveTo,
  isDrop,
} from "./core.js";
import { SAMPLES } from "./samples.js";

const $ = (id) => document.getElementById(id);
const PROMOTABLE = [false, true, true, true, true, false, true, true];
const PALETTE = [1, 2, 3, 4, 5, 6, 7, 8, 0]; // 0 は「消す」
const unpromote = (a) => (a > 8 ? a - 8 : a);
const fmt = (n) => n.toLocaleString("ja-JP");

let editPos = new Position();
let tool = 1;
let owner = BLACK;
let mode = "edit"; // "edit" | "play"
let play = null; // { start, moves, kif, idx }
let worker = null;

// ---- 盤と持ち駒の描画 ----
const squares = [];
function buildBoard() {
  const board = $("sgBoard");
  for (let sq = 0; sq < 81; sq++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sg-sq";
    b.setAttribute("role", "gridcell");
    b.addEventListener("click", () => onSquare(sq));
    board.appendChild(b);
    squares.push(b);
  }
}

function shownPosition() {
  if (mode !== "play") return editPos;
  const pos = play.start.clone();
  for (let i = 0; i < play.idx; i++) pos.doMove(play.moves[i]);
  return pos;
}

function render() {
  const pos = shownPosition();
  const last =
    mode === "play" && play.idx > 0 ? play.moves[play.idx - 1] : null;
  for (let sq = 0; sq < 81; sq++) {
    const p = pos.board[sq];
    const el = squares[sq];
    el.classList.toggle("sg-last", last !== null && moveTo(last) === sq);
    el.classList.toggle(
      "sg-from",
      last !== null && !isDrop(last) && moveFrom(last) === sq,
    );
    if (!p) {
      el.innerHTML = "";
      el.setAttribute("aria-label", "空き");
      continue;
    }
    const a = Math.abs(p);
    const cls = ["sg-piece"];
    if (p < 0) cls.push("sg-white");
    if (a > 8) cls.push("sg-promoted");
    el.innerHTML = `<span class="${cls.join(" ")}">${BOARD_CHAR[a]}</span>`;
    el.setAttribute(
      "aria-label",
      `${p > 0 ? "攻め方" : "受け方"}の${KIF_NAME[a]}`,
    );
  }
  renderHand($("sgHandBlack"), pos.hand[BLACK]);
  renderHand($("sgHandWhite"), pos.hand[WHITE]);
  renderHandEdit();
  if (mode === "play") renderPlay();
}

function renderHand(el, hand) {
  const items = HAND_TYPES.filter((pt) => hand[pt] > 0).map(
    (pt) =>
      `<span>${KIF_NAME[pt]}${hand[pt] > 1 ? `<span class="sg-count">${hand[pt]}</span>` : ""}</span>`,
  );
  el.innerHTML = items.length
    ? items.join("")
    : `<span class="sg-hand-empty">なし</span>`;
}

function renderHandEdit() {
  const auto = $("sgAutoHand").checked;
  const rows = [];
  for (const c of [BLACK, WHITE]) {
    for (const pt of HAND_TYPES) {
      const dis = c === WHITE && auto ? "disabled" : "";
      rows.push(
        `<div class="sg-hand-item"><span>${c === BLACK ? "▲" : "△"}${KIF_NAME[pt]}</span>` +
          `<button type="button" data-c="${c}" data-pt="${pt}" data-d="-1" ${dis} aria-label="減らす">−</button>` +
          `<span>${editPos.hand[c][pt]}</span>` +
          `<button type="button" data-c="${c}" data-pt="${pt}" data-d="1" ${dis} aria-label="増やす">＋</button></div>`,
      );
    }
  }
  $("sgHandEdit").innerHTML = rows.join("");
}

function buildPalette() {
  const el = $("sgPalette");
  for (const pt of PALETTE) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sg-tool" + (pt === tool ? " sg-active" : "");
    b.textContent = pt ? BOARD_CHAR[pt] : "消す";
    b.addEventListener("click", () => {
      tool = pt;
      el.querySelectorAll(".sg-tool").forEach((x) =>
        x.classList.toggle("sg-active", x === b),
      );
    });
    el.appendChild(b);
  }
}

// ---- 編集 ----
function usedCount(pos, includeWhiteHand) {
  const used = new Int8Array(9);
  for (let sq = 0; sq < 81; sq++)
    if (pos.board[sq]) used[unpromote(Math.abs(pos.board[sq]))]++;
  for (let pt = 1; pt <= 7; pt++) {
    used[pt] += pos.hand[BLACK][pt];
    if (includeWhiteHand) used[pt] += pos.hand[WHITE][pt];
  }
  return used;
}

function afterEdit() {
  if ($("sgAutoHand").checked) fillDefenderHand(editPos);
  setStatus("");
  render();
}

function onSquare(sq) {
  if (mode !== "edit") return;
  const cur = editPos.board[sq];
  if (tool === 0) {
    editPos.setSquare(sq, 0);
    return afterEdit();
  }
  const sign = owner === BLACK ? 1 : -1;
  let next = sign * tool;
  if (
    cur &&
    Math.sign(cur) === sign &&
    unpromote(Math.abs(cur)) === tool &&
    PROMOTABLE[tool]
  ) {
    next = Math.abs(cur) > 8 ? sign * tool : sign * (tool + 8);
  }
  // 駒の数の上限（盤＋持ち駒）
  const trial = editPos.clone();
  if (tool === OU) {
    for (let s = 0; s < 81; s++)
      if (trial.board[s] === sign * OU) trial.setSquare(s, 0);
  }
  trial.setSquare(sq, next);
  const used = usedCount(trial, !$("sgAutoHand").checked);
  for (let pt = 1; pt <= 7; pt++) {
    if (used[pt] > PIECE_TOTAL[pt]) {
      return setStatus(
        `${KIF_NAME[pt]}は全部で ${PIECE_TOTAL[pt]} 枚までです`,
        true,
      );
    }
  }
  editPos = trial;
  afterEdit();
}

function onHandButton(ev) {
  const b = ev.target.closest("button[data-pt]");
  if (!b || mode !== "edit") return;
  const c = Number(b.dataset.c),
    pt = Number(b.dataset.pt),
    d = Number(b.dataset.d);
  const n = editPos.hand[c][pt] + d;
  if (n < 0) return;
  const trial = editPos.clone();
  trial.setHand(c, pt, n);
  if (
    usedCount(trial, !$("sgAutoHand").checked || c === WHITE)[pt] >
    PIECE_TOTAL[pt]
  ) {
    return setStatus(
      `${KIF_NAME[pt]}は全部で ${PIECE_TOTAL[pt]} 枚までです`,
      true,
    );
  }
  editPos = trial;
  afterEdit();
}

function loadSfen(sfen, note = "") {
  let pos = Position.fromSfen(sfen);
  if (pos.side === WHITE) {
    // 後手が攻める局面は盤を回して先手が攻める形にする
    const r = new Position();
    for (let sq = 0; sq < 81; sq++) r.board[80 - sq] = -pos.board[sq];
    r.hand[BLACK].set(pos.hand[WHITE]);
    r.hand[WHITE].set(pos.hand[BLACK]);
    r.rehash();
    pos = r;
    note = "後手番の局面だったので、盤を回して先手（▲）が攻める形にしました。";
  }
  const filled = pos.clone();
  fillDefenderHand(filled);
  const same = HAND_TYPES.every(
    (pt) => filled.hand[WHITE][pt] === pos.hand[WHITE][pt],
  );
  const empty = HAND_TYPES.every((pt) => pos.hand[WHITE][pt] === 0);
  $("sgAutoHand").checked = same || empty;
  editPos = pos;
  toEdit();
  afterEdit();
  if (note) setStatus(note);
}

// 解く前の確かめ。問題があれば文言を返す
function validate(pos) {
  if (pos.king[WHITE] < 0) return "受け方（△）の玉を置いてください";
  for (let sq = 0; sq < 81; sq++) {
    const p = pos.board[sq],
      r = (sq / 9) | 0;
    const a = Math.abs(p);
    if (p > 0 && (((a === 1 || a === 2) && r === 0) || (a === 3 && r <= 1)))
      return "攻め方の駒に、動けない段にいるものがあります";
    if (p < 0 && (((a === 1 || a === 2) && r === 8) || (a === 3 && r >= 7)))
      return "受け方の駒に、動けない段にいるものがあります";
  }
  for (const s of [1, -1])
    for (let col = 0; col < 9; col++) {
      let n = 0;
      for (let r = 0; r < 9; r++) if (pos.board[r * 9 + col] === s) n++;
      if (n > 1) return "二歩になっている筋があります";
    }
  if (pos.inCheck(WHITE)) return "受け方の玉に、すでに王手がかかっています";
  return null;
}

// ---- 解く ----
function solve() {
  const pos = editPos.clone();
  pos.side = BLACK;
  pos.rehash();
  if ($("sgAutoHand").checked) fillDefenderHand(pos);
  const err = validate(pos);
  if (err) return setStatus(err, true);
  stopWorker();
  worker = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });
  $("sgSolve").disabled = true;
  $("sgStop").hidden = false;
  setStatus("考え中…");
  worker.onmessage = (ev) => {
    const d = ev.data;
    if (d.type === "progress")
      return setStatus(
        `考え中… ${fmt(d.nodes)} 局面（${(d.ms / 1000).toFixed(1)} 秒）`,
      );
    stopWorker();
    if (d.type === "error") return setStatus(`エラー: ${d.message}`, true);
    showResult(pos, d);
  };
  worker.onerror = (e) => {
    stopWorker();
    setStatus(`エラー: ${e.message || "ソルバーを起動できませんでした"}`, true);
  };
  worker.postMessage({
    sfen: pos.toSfen(),
    timeLimitMs: Number($("sgLimit").value),
  });
}

function stopWorker() {
  if (worker) worker.terminate();
  worker = null;
  $("sgSolve").disabled = false;
  $("sgStop").hidden = true;
}

function showResult(start, r) {
  const stat = `${fmt(r.nodes)} 局面・${(r.ms / 1000).toFixed(2)} 秒`;
  if (r.status === "nomate") return setStatus(`詰みません（${stat}）`);
  if (r.status === "timeout")
    return setStatus(
      `時間内に答えが出ませんでした（${stat}）。上限を延ばすと解けることがあります。`,
      true,
    );
  setStatus(`詰みました（${stat}）`);
  const kif = [];
  const p = start.clone();
  let prev = -1;
  for (const m of r.moves) {
    kif.push(moveToKif(p, m, prev));
    prev = moveTo(m);
    p.doMove(m);
  }
  play = { start, moves: r.moves, kif, idx: 0 };
  mode = "play";
  $("sgEditCard").hidden = true;
  $("sgResultCard").hidden = false;
  $("sgResultTitle").textContent = `${r.len}手詰`;
  const notes = [];
  if (r.futile) notes.push("無駄合（取られるだけの合駒）を除いた手順です。");
  if (r.approx)
    notes.push(
      "時間内に手順を絞りきれなかったので、最短・最長の手順とは限りません。",
    );
  $("sgResultNote").textContent = notes.join(" ");
  $("sgMoves").innerHTML = kif
    .map(
      (k, i) =>
        `<li><button type="button" data-idx="${i + 1}">${i + 1}. ${k}</button></li>`,
    )
    .join("");
  render();
}

function renderPlay() {
  $("sgPly").textContent =
    play.idx === 0 ? "初形" : `${play.idx} / ${play.moves.length} 手目`;
  $("sgMoves")
    .querySelectorAll("button")
    .forEach((b) =>
      b.classList.toggle("sg-current", Number(b.dataset.idx) === play.idx),
    );
}

function step(kind) {
  if (mode !== "play") return;
  const n = play.moves.length;
  play.idx =
    kind === "first"
      ? 0
      : kind === "last"
        ? n
        : kind === "prev"
          ? Math.max(0, play.idx - 1)
          : Math.min(n, play.idx + 1);
  render();
}

function toEdit() {
  mode = "edit";
  play = null;
  $("sgEditCard").hidden = false;
  $("sgResultCard").hidden = true;
}

function setStatus(text, error = false) {
  const el = $("sgStatus");
  el.textContent = text;
  el.classList.toggle("sg-error", error);
}

// ---- 起動 ----
function init() {
  buildBoard();
  buildPalette();
  const sel = $("sgSample");
  sel.innerHTML =
    `<option value="">— 自分で作る（空の盤）—</option>` +
    SAMPLES.map((s, i) => `<option value="${i}">${s.title}</option>`).join("");
  sel.addEventListener("change", () => {
    stopWorker();
    if (sel.value === "") {
      editPos = new Position();
      $("sgSampleNote").textContent = "";
      $("sgAutoHand").checked = true;
      toEdit();
      return afterEdit();
    }
    const s = SAMPLES[Number(sel.value)];
    $("sgSampleNote").textContent = s.note;
    loadSfen(s.sfen);
  });
  document.querySelectorAll('input[name="sgOwner"]').forEach((r) =>
    r.addEventListener("change", () => {
      owner = Number(
        document.querySelector('input[name="sgOwner"]:checked').value,
      );
    }),
  );
  $("sgHandEdit").addEventListener("click", onHandButton);
  $("sgAutoHand").addEventListener("change", afterEdit);
  $("sgClear").addEventListener("click", () => {
    editPos = new Position();
    sel.value = "";
    $("sgSampleNote").textContent = "";
    afterEdit();
  });
  $("sgSfenLoad").addEventListener("click", () => {
    try {
      sel.value = "";
      $("sgSampleNote").textContent = "";
      loadSfen($("sgSfenText").value);
    } catch (e) {
      setStatus(e.message, true);
    }
  });
  $("sgSfenCopy").addEventListener("click", () => {
    const pos = editPos.clone();
    pos.side = BLACK;
    pos.rehash();
    $("sgSfenText").value = pos.toSfen();
    navigator.clipboard?.writeText(pos.toSfen()).then(
      () => setStatus("SFEN をクリップボードにコピーしました"),
      () => {},
    );
  });
  $("sgSolve").addEventListener("click", solve);
  $("sgStop").addEventListener("click", () => {
    stopWorker();
    setStatus("中止しました");
  });
  $("sgBackEdit").addEventListener("click", () => {
    toEdit();
    render();
  });
  document
    .querySelectorAll("[data-step]")
    .forEach((b) => b.addEventListener("click", () => step(b.dataset.step)));
  $("sgMoves").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-idx]");
    if (!b) return;
    play.idx = Number(b.dataset.idx);
    render();
  });
  document.addEventListener("keydown", (ev) => {
    if (mode !== "play" || ev.target.closest("textarea, select, input")) return;
    if (ev.key === "ArrowLeft") step("prev");
    if (ev.key === "ArrowRight") step("next");
  });
  if (SAMPLES.length) {
    sel.value = "0";
    sel.dispatchEvent(new Event("change"));
  } else afterEdit();
}

init();
