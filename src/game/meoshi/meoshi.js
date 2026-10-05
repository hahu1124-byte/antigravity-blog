// 目押しチャレンジ: 画面・入力・遊技の進行
import {
  FRAMES,
  FRAME_MS,
  BIG_END_PAYOUT,
  REG_END_PAYOUT,
  ROLES,
  REELS,
  REACH_SHOW_RATE,
  SETTINGS,
  BETS,
  LOTTERY_BY_SETTING,
  LOTTERY_DENOM,
  payOf,
} from "./reel-data.js";
import {
  pushedFrame,
  pushOffsetMs,
  decideStop,
  judge,
  drawFlag,
  prepare,
  reachAt,
  reachKindOf,
  FLAG_SETS,
  mod,
} from "./stop-control.js";
import { REACH_KINDS } from "./reach-data.js";
import { ReelRenderer, ArrayRenderer, loadSymbols } from "./render.js";
import { sfx, unlockAudio, setSoundEnabled } from "./audio.js";

const BASE = new URL("./", import.meta.url).href;
const STORE_KEY = "meoshi-v1";
const $ = (id) => document.getElementById(id);

// ---- 保存（使えない環境でも動くように try で囲む） ----
const DEFAULTS = {
  latency: 0,
  sound: true,
  ghost: true,
  target: "S",
  history: [],
  play: null,
  bet: 3, // 遊技の掛け枚数（1 か 3）
  reachHint: true, // リーチ目が出たら知らせる
  setting: "?", // 遊技の設定（"1"・"2"・"5"・"6" か、伏せて決める "?"）
};
const store = (() => {
  try {
    return {
      ...DEFAULTS,
      ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}"),
    };
  } catch (e) {
    return { ...DEFAULTS };
  }
})();
// 壊れた値が保存されていたら直す（掛け枚数が 1・3 以外だと判定ができない）
if (!BETS.includes(store.bet)) store.bet = 3;
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {
    // 保存できなくても遊べる
  }
}
setSoundEnabled(store.sound);

// ---- リール ----
// 回転中は phase（回転開始時の位置）と t0（回転開始の時刻）から位置を計算する。
// 押したら stopAt（止まる位置。巻き戻らない連続値）を決め、そこまで同じ速さで進んで止まる
const reels = [0, 1, 2].map(() => ({
  spinning: false,
  phase: 0,
  t0: 0,
  stopAt: null,
  rest: Math.floor(Math.random() * FRAMES),
}));

function posAt(r, t) {
  const R = reels[r];
  if (!R.spinning) return R.rest;
  const p = R.phase + (t - R.t0) / FRAME_MS;
  return R.stopAt !== null && p > R.stopAt ? R.stopAt : p;
}
const moving = (r, t) =>
  reels[r].spinning &&
  (reels[r].stopAt === null || posAt(r, t) < reels[r].stopAt);
const anySpinning = () => reels.some((R) => R.spinning);

function startSpin(now) {
  for (const R of reels) {
    R.phase = R.rest;
    R.t0 = now;
    R.stopAt = null;
    R.spinning = true;
    R.stopSounded = false;
  }
}

// ---- 画面の状態 ----
let mode = "practice";
let litLines = [];
let litUntil = 0;
let flashUntil = 0;
let finishing = false;

const renderer = new ReelRenderer($("moReels"));
// 配列の表（PC だけ。スマホの幅では CSS で隠し、描かない）
const arrayView = new ArrayRenderer($("moArray"));
const arrayShown = () => $("moArray").offsetParent !== null;
function resizeAll() {
  renderer.resize();
  if (arrayShown()) arrayView.resize();
}
resizeAll();
window.addEventListener("resize", resizeAll);
// CSS が当たる前に幅を測っていることがあるので、読み込み後にも測り直す
window.addEventListener("load", resizeAll);

function frame() {
  const now = performance.now();
  const positions = [0, 1, 2].map((r) => posAt(r, now));
  renderer.draw(positions, {
    spinning: store.ghost ? [0, 1, 2].map((r) => moving(r, now)) : null,
    lines: now < litUntil ? litLines : null,
    flash: now < flashUntil ? (flashUntil - now) / 400 : 0,
  });
  if (arrayShown()) arrayView.draw(positions);
  // 全部のリールが止まりきったら 1 ゲームを締める
  if (
    anySpinning() &&
    !finishing &&
    reels.every((R) => R.stopAt !== null) &&
    [0, 1, 2].every((r) => !moving(r, now))
  ) {
    finishing = true;
    if (reels.some((R) => !R.stopSounded)) sfx.stop();
    for (const R of reels) {
      R.rest = mod(R.stopAt);
      R.spinning = false;
      R.stopAt = null;
    }
    finishGame();
    finishing = false;
  }
  updateStopButtons(now);
  requestAnimationFrame(frame);
}

function updateStopButtons(now) {
  // 停止音は押した瞬間ではなく、すべり終えて絵が止まった瞬間に鳴らす
  for (let r = 0; r < 3; r++) {
    const R = reels[r];
    if (R.spinning && R.stopAt !== null && !R.stopSounded && !moving(r, now)) {
      R.stopSounded = true;
      sfx.stop();
    }
  }
  document.querySelectorAll(".mo-stop").forEach((b) => {
    const r = Number(b.dataset.reel);
    b.classList.toggle("ready", reels[r].spinning && reels[r].stopAt === null);
  });
  $("moLever").classList.toggle("ready", !anySpinning());
}

function message(text) {
  $("moMessage").textContent = text;
}

// ---- 練習モード ----
const TARGETS = {
  S: { name: "赤7", syms: ["S"] },
  D: { name: "女の子", syms: ["D", "d"] },
  N: { name: "暖簾", syms: ["N"] },
  I: { name: "氷", syms: ["I"] },
  C: { name: "チェリー", syms: ["C"] },
};
const practiceResults = [null, null, null];

function practicePush(r, pos, pushed) {
  const syms = TARGETS[store.target].syms;
  let best = null;
  for (let k = 0; k < FRAMES; k++) {
    if (!syms.includes(REELS[r][k])) continue;
    const o = pushOffsetMs(pos, k);
    if (best === null || Math.abs(o) < Math.abs(best)) best = o;
  }
  reels[r].stopAt = pushed;
  const n = Math.round(best / FRAME_MS);
  practiceResults[r] = { offset: best, frames: n };
  store.history.push({ o: Math.round(best * 10) / 10, r, t: store.target });
  if (store.history.length > 300)
    store.history.splice(0, store.history.length - 300);
  save();
  if (n === 0) sfx.hit();
  else sfx.miss();
  renderPracticeResults();
}

function resultLabel(res) {
  if (!res) return "";
  const ms = `${res.offset >= 0 ? "+" : ""}${res.offset.toFixed(0)}ms`;
  if (res.frames === 0) return `<b class="ok">ビタ</b> ${ms}`;
  const where = res.frames === -1 ? "上段" : res.frames === 1 ? "下段" : "枠外";
  return `<b class="ng">${Math.abs(res.frames)}コマ${res.frames < 0 ? "早い" : "遅い"}</b> ${where} ${ms}`;
}

function renderPracticeResults() {
  document
    .querySelectorAll(".mo-result")
    .forEach((el, r) => (el.innerHTML = resultLabel(practiceResults[r])));
  const recent = store.history.slice(-50);
  const n = recent.length;
  if (!n) {
    $("moStats").innerHTML = "<p class='mo-note'>まだ記録がありません。</p>";
    return;
  }
  const mean = recent.reduce((a, h) => a + h.o, 0) / n;
  const sd = Math.sqrt(recent.reduce((a, h) => a + (h.o - mean) ** 2, 0) / n);
  const hit = recent.filter((h) => Math.abs(h.o) <= FRAME_MS / 2).length;
  const lean = Math.abs(mean) < 3 ? "ちょうど" : mean < 0 ? "早め" : "遅め";
  $("moStats").innerHTML = `
    <div class="mo-stat"><span>ビタ成功率</span><b>${((hit / n) * 100).toFixed(0)}%</b></div>
    <div class="mo-stat"><span>平均のずれ</span><b>${mean >= 0 ? "+" : ""}${mean.toFixed(1)}ms</b><small>${lean}</small></div>
    <div class="mo-stat"><span>ばらつき</span><b>±${sd.toFixed(1)}ms</b></div>
    <div class="mo-stat"><span>回数</span><b>${n}</b><small>直近50回</small></div>`;
}

// ---- 遊技モード ----
const NEW_PLAY = () => ({
  games: 0,
  diff: 0,
  big: 0,
  reg: 0,
  bonusFlag: null,
  notice: null,
  lamp: false,
  replay: false,
  bonus: null,
  setting: pickSetting(),
  revealed: false,
});
// 設定の選び方: 1・2・5・6 はその設定、"?" は 1・2・5・6 から伏せて選ぶ（「設定を見る」で開ける）
function pickSetting() {
  const c = store.setting;
  if (c !== "?" && SETTINGS.includes(Number(c))) return Number(c);
  return SETTINGS[Math.floor(Math.random() * SETTINGS.length)];
}
let play = store.play || NEW_PLAY();
if (!SETTINGS.includes(play.setting)) play.setting = pickSetting();
let current = { allowed: [], mode: "normal", bet: 3 };

function setSetting(c) {
  if (anySpinning()) return;
  store.setting = c;
  play.setting = pickSetting();
  play.revealed = false;
  store.play = play;
  save();
  renderSettingButtons();
  renderPlayStats();
}

function renderSettingButtons() {
  document
    .querySelectorAll(".mo-setting")
    .forEach((b) =>
      b.classList.toggle("active", b.dataset.setting === String(store.setting)),
    );
}

function playLever() {
  // リプレイのときは前のゲームと同じ枚数が自動で掛かる（メダルは減らない）
  const bet = play.replay ? play.replayBet || store.bet : store.bet;
  if (!play.replay) play.diff -= bet;
  play.replay = false;
  if (play.bonus) {
    current = { allowed: ["bonusFuurin"], mode: "bonus", bet };
  } else {
    play.games++;
    const flag = drawFlag(play.setting);
    let fresh = false;
    if ((flag === "big" || flag === "reg") && !play.bonusFlag) {
      play.bonusFlag = flag;
      fresh = true;
    }
    const small = ["replay", "fuurin", "kori", "cherry"].includes(flag)
      ? flag
      : null;
    // ボーナス成立中は、一定の割合でリーチ目の形を優先して止める（"reach" の目印）
    const reach =
      play.bonusFlag && Math.random() < REACH_SHOW_RATE ? "reach" : null;
    current = {
      allowed: [play.bonusFlag, small, reach].filter(Boolean),
      mode: "normal",
      bet,
    };
    // 告知ランプ: 成立したゲームのレバーで 25%・第 3 停止で 50%・残りは持ち越し中のゲームで 1/4 ずつ
    if (fresh) {
      const v = Math.random();
      play.notice = v < 0.25 ? "now" : v < 0.75 ? "after" : "later";
      if (play.notice === "now") lightLamp();
    } else if (
      play.bonusFlag &&
      !play.lamp &&
      play.notice === "later" &&
      Math.random() < 0.25
    ) {
      play.notice = "after";
    }
  }
  prepare(current.allowed, current.mode, current.bet);
  renderBet();
  sfx.lever();
}

// 掛け枚数の切り替え（遊技モードで、リールが止まっているときだけ）
function setBet(bet) {
  if (!BETS.includes(bet)) return;
  if (mode !== "play" || anySpinning() || play.replay) return;
  store.bet = bet;
  save();
  renderBet();
}

function renderBet() {
  const bet = play.replay ? play.replayBet || store.bet : store.bet;
  document
    .querySelectorAll(".mo-bet")
    .forEach((b) =>
      b.classList.toggle("active", Number(b.dataset.bet) === bet),
    );
  $("moBetLamp").textContent = mode === "play" ? `${bet}BET` : "";
}

function lightLamp() {
  if (play.lamp) return;
  play.lamp = true;
  sfx.notice();
  renderLamp();
}

function renderLamp() {
  $("moLamp").classList.toggle("on", mode === "play" && play.lamp);
}

function finishPlay(stops) {
  const bet = current.bet;
  const wins = judge(stops, current.mode, bet);
  const payTotal = Math.min(
    15,
    wins.reduce((a, w) => a + payOf(w.role, bet), 0),
  );
  // 入賞ラインはボーナスが揃ったときだけ光らせる（小役では出さない）
  litLines = wins
    .filter((w) => ROLES[w.role].kind === "bonus")
    .map((w) => w.line);
  litUntil = performance.now() + 1200;
  if (play.bonus) {
    const pay = payTotal;
    const B = play.bonus;
    B.games++;
    B.paid += pay;
    play.diff += pay;
    if (pay) {
      B.wins++;
      sfx.payout(pay);
    }
    // 2015 年版はどちらも払い出し枚数で終わる（BIG 344 枚・REG 105 枚を超えたら）
    const end = B.type === "big" ? BIG_END_PAYOUT : REG_END_PAYOUT;
    const label = B.type === "big" ? "BIG" : "REG";
    if (B.paid > end) {
      message(`${label} 終了 ${B.paid}枚獲得`);
      play.bonus = null;
    } else {
      message(`${label} 中 ${B.paid}/${end}枚`);
    }
  } else {
    const bonusWin = wins.find((w) => ROLES[w.role].kind === "bonus");
    if (bonusWin) {
      const type = ROLES[bonusWin.role].flag;
      play[type]++;
      play.bonus = { type, paid: 0, games: 0, wins: 0 };
      play.bonusFlag = null;
      play.notice = null;
      play.lamp = false;
      flashUntil = performance.now() + 400;
      sfx.bonus();
      message(type === "big" ? "BIG BONUS!" : "REG BONUS!");
    } else if (wins.some((w) => ROLES[w.role].kind === "replay")) {
      play.replay = true;
      play.replayBet = bet;
      sfx.replay();
      message("リプレイ");
    } else if (wins.length) {
      play.diff += payTotal;
      sfx.payout(payTotal);
      message(`${ROLES[wins[0].role].name} ${payTotal}枚`);
    } else {
      message(play.bonusFlag && play.lamp ? "ボーナスを揃えよう" : "");
    }
    // 小役の入賞回数（確率の表に出す）
    const smallWin = wins.find((w) => ROLES[w.role].kind !== "bonus");
    if (smallWin) {
      const f = ROLES[smallWin.role].flag;
      play.counts = play.counts || {};
      play.counts[f] = (play.counts[f] || 0) + 1;
    }
    // リーチ目（ボーナス成立中にしか出ない形）
    const k = bonusWin ? -1 : reachAt(stops, bet);
    if (k >= 0 && store.reachHint) {
      const kind = REACH_KINDS[reachKindOf(k)] || "";
      message(`リーチ目！（${kind}）`);
    }
    if (play.bonusFlag && !play.lamp && play.notice === "after") lightLamp();
  }
  renderLamp();
  store.play = play;
  save();
  renderPlayStats();
}

function renderPlayStats() {
  const total = play.big + play.reg;
  const odds = (n) => (n ? `1/${(play.games / n).toFixed(1)}` : "-");
  const B = play.bonus;
  $("moPlayStats").innerHTML = `
    <div class="mo-stat"><span>ゲーム数</span><b>${play.games}</b></div>
    <div class="mo-stat"><span>BIG</span><b>${play.big}</b><small>${odds(play.big)}</small></div>
    <div class="mo-stat"><span>REG</span><b>${play.reg}</b><small>${odds(play.reg)}</small></div>
    <div class="mo-stat"><span>合算</span><b>${odds(total)}</b></div>
    <div class="mo-stat"><span>差枚</span><b class="${play.diff >= 0 ? "ok" : "ng"}">${play.diff >= 0 ? "+" : ""}${play.diff}</b></div>
    <div class="mo-stat"><span>状態</span><b>${B ? (B.type === "big" ? "BIG 中" : "REG 中") : play.replay ? "リプレイ" : "通常"}</b></div>
    <div class="mo-stat"><span>設定</span><b>${store.setting === "?" && !play.revealed ? "?" : play.setting}</b></div>`;
  renderOddsTable();
}

// 役ごとの確率の表（実戦の入賞回数と、設定が見えているときは設定の値）
const ODDS_ROWS = [
  ["BIG", ["big"]],
  ["REG", ["reg"]],
  ["合算", ["big", "reg"]],
  ["リプレイ", ["replay"]],
  ["風鈴", ["fuurin"]],
  ["氷", ["kori"]],
  ["チェリー", ["cherry"]],
];
function renderOddsTable() {
  const shown = !(store.setting === "?" && !play.revealed);
  const lottery = LOTTERY_BY_SETTING[play.setting];
  const counts = { ...(play.counts || {}), big: play.big, reg: play.reg };
  const fmt = (x) => (x ? `1/${x.toFixed(1)}` : "-");
  const rows = ODDS_ROWS.map(([label, flags]) => {
    const n = flags.reduce((a, f) => a + (counts[f] || 0), 0);
    const w = flags.reduce(
      (a, f) => a + lottery.find((e) => e.flag === f).weight,
      0,
    );
    return `<tr><th>${label}</th><td>${n}</td><td>${n ? fmt(play.games / n) : "-"}</td><td>${shown ? fmt(LOTTERY_DENOM / w) : "?"}</td></tr>`;
  }).join("");
  $("moOdds").innerHTML = `
    <thead><tr><th></th><th>回数</th><th>実戦</th><th>設定値</th></tr></thead>
    <tbody>${rows}</tbody>`;
}

// ---- 入力 ----
function lever(t) {
  if (anySpinning() || calib.active) return;
  unlockAudio();
  if (mode === "practice") {
    practiceResults.fill(null);
    renderPracticeResults();
    sfx.lever();
  } else {
    document
      .querySelectorAll(".mo-result")
      .forEach((el) => (el.innerHTML = ""));
    playLever();
  }
  litUntil = 0;
  startSpin(performance.now());
}

function push(r, timeStamp) {
  const R = reels[r];
  if (!R.spinning || R.stopAt !== null) return;
  unlockAudio();
  // 画面と入力の遅れを引いた時刻で、そのときの位置を計算する
  const t = Math.max(R.t0, timeStamp - store.latency);
  const pos = R.phase + (t - R.t0) / FRAME_MS;
  const pushed = pushedFrame(pos);
  if (mode === "practice") {
    practicePush(r, pos, pushed);
    return;
  }
  const stops = reels.map((x) => (x.stopAt === null ? null : mod(x.stopAt)));
  const res = decideStop(
    stops,
    r,
    pushed,
    current.allowed,
    current.mode,
    current.bet,
  );
  R.stopAt = pushed + res.slip;
  // リールの下に、押してから何コマすべったかを出す
  document.querySelectorAll(".mo-result")[r].innerHTML =
    res.slip === 0 ? "すべりなし" : `${res.slip}コマすべり`;
}

function finishGame() {
  if (mode === "play") finishPlay(reels.map((R) => R.rest));
}

const KEY_STOP = {
  KeyZ: 0,
  ArrowLeft: 0,
  KeyX: 1,
  ArrowDown: 1,
  KeyC: 2,
  ArrowRight: 2,
};
window.addEventListener("keydown", (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if ($("moSettings").open || (e.target && e.target.tagName === "INPUT"))
    return;
  if (calib.active) {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      calibPress(e.timeStamp);
    } else if (e.code === "Escape") endCalib(false);
    return;
  }
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "Enter") {
    e.preventDefault();
    lever(e.timeStamp);
  } else if (e.code === "Digit1" || e.code === "Numpad1") {
    setBet(1);
  } else if (e.code === "Digit3" || e.code === "Numpad3") {
    setBet(3);
  } else if (e.code in KEY_STOP) {
    e.preventDefault();
    push(KEY_STOP[e.code], e.timeStamp);
  }
});

$("moLever").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  lever(e.timeStamp);
});
document.querySelectorAll(".mo-stop").forEach((b) =>
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    push(Number(b.dataset.reel), e.timeStamp);
  }),
);

// ---- モード切替 ----
function setMode(m) {
  if (anySpinning()) return;
  mode = m;
  document
    .querySelectorAll(".mo-tab")
    .forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
  $("moPractice").hidden = m !== "practice";
  $("moPlay").hidden = m !== "play";
  litUntil = 0;
  // 練習の判定文は練習モードの前のゲームの分だけ出す
  practiceResults.fill(null);
  renderPracticeResults();
  message(
    m === "practice"
      ? "狙った図柄を中段に止めよう"
      : play.bonus
        ? "ボーナス中"
        : "",
  );
  renderLamp();
  renderBet();
}
document
  .querySelectorAll(".mo-tab")
  .forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

function renderTargets() {
  $("moTargets").innerHTML = Object.entries(TARGETS)
    .map(
      ([k, v]) =>
        `<button type="button" class="mo-target${k === store.target ? " active" : ""}" data-target="${k}">${v.name}</button>`,
    )
    .join("");
  document.querySelectorAll(".mo-target").forEach((b) =>
    b.addEventListener("click", () => {
      store.target = b.dataset.target;
      save();
      renderTargets();
    }),
  );
}

$("moResetPractice").addEventListener("click", () => {
  store.history = [];
  save();
  renderPracticeResults();
});
$("moResetPlay").addEventListener("click", () => {
  if (anySpinning()) return;
  play = NEW_PLAY();
  store.play = play;
  save();
  renderPlayStats();
  renderLamp();
  message("");
});
document
  .querySelectorAll(".mo-setting")
  .forEach((b) =>
    b.addEventListener("click", () => setSetting(b.dataset.setting)),
  );
$("moRevealSetting").addEventListener("click", () => {
  play.revealed = true;
  store.play = play;
  save();
  renderPlayStats();
});

// ---- 設定 ----
function renderSettings() {
  $("moLatency").value = store.latency;
  $("moSound").checked = store.sound;
  $("moGhost").checked = store.ghost;
  $("moReachHint").checked = store.reachHint;
  $("moLatencyNow").textContent = `${store.latency}ms`;
}
$("moSettingsBtn").addEventListener("click", () => {
  renderSettings();
  $("moSettings").showModal();
});
$("moSettingsClose").addEventListener("click", () => $("moSettings").close());
$("moLatency").addEventListener("change", () => {
  const v = Math.round(Number($("moLatency").value));
  store.latency = Number.isFinite(v) ? Math.max(-100, Math.min(300, v)) : 0;
  save();
  renderSettings();
});
$("moSound").addEventListener("change", () => {
  store.sound = $("moSound").checked;
  setSoundEnabled(store.sound);
  save();
});
$("moGhost").addEventListener("change", () => {
  store.ghost = $("moGhost").checked;
  save();
});
$("moReachHint").addEventListener("change", () => {
  store.reachHint = $("moReachHint").checked;
  save();
});
document
  .querySelectorAll(".mo-bet")
  .forEach((b) =>
    b.addEventListener("click", () => setBet(Number(b.dataset.bet))),
  );

// ---- 遅延補正（光った瞬間に 10 回押して、ずれの中央値を補正値にする） ----
const CALIB_BEAT_MS = 750;
const CALIB_NEED = 10;
const calib = { active: false, start: 0, diffs: [] };

function startCalib() {
  $("moSettings").close();
  unlockAudio();
  calib.active = true;
  calib.start = performance.now() + 1000;
  calib.diffs = [];
  $("moCalib").hidden = false;
  $("moCalibCount").textContent = `0 / ${CALIB_NEED}`;
  $("moCalibResult").textContent = "";
  calibLoop();
}

function calibLoop() {
  if (!calib.active) return;
  const now = performance.now();
  const since = now - calib.start;
  const phase = ((since % CALIB_BEAT_MS) + CALIB_BEAT_MS) % CALIB_BEAT_MS;
  $("moCalibDot").classList.toggle("on", since >= 0 && phase < 90);
  requestAnimationFrame(calibLoop);
}

function calibPress(timeStamp) {
  const since = timeStamp - calib.start;
  if (since < -CALIB_BEAT_MS / 2) return;
  const d = since - Math.round(since / CALIB_BEAT_MS) * CALIB_BEAT_MS;
  // 最初の 2 拍はリズムをつかむ分なので数えない
  if (since < CALIB_BEAT_MS * 1.5) return;
  calib.diffs.push(d);
  $("moCalibCount").textContent = `${calib.diffs.length} / ${CALIB_NEED}`;
  if (calib.diffs.length >= CALIB_NEED) endCalib(true);
}

function endCalib(done) {
  calib.active = false;
  $("moCalibDot").classList.remove("on");
  if (done) {
    const s = calib.diffs.slice().sort((a, b) => a - b);
    const med = (s[4] + s[5]) / 2;
    store.latency = Math.max(-100, Math.min(300, Math.round(med)));
    save();
    $("moCalibResult").textContent = `補正値を ${store.latency}ms にしました`;
    setTimeout(() => ($("moCalib").hidden = true), 1600);
  } else {
    $("moCalib").hidden = true;
  }
}

$("moCalibStart").addEventListener("click", startCalib);
$("moCalibCancel").addEventListener("click", () => endCalib(false));
$("moCalibDot").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  calibPress(e.timeStamp);
});

// ---- 起動 ----
renderTargets();
renderPracticeResults();
renderPlayStats();
renderSettingButtons();
setMode("practice");
requestAnimationFrame(frame);
loadSymbols(BASE).then((imgs) => {
  renderer.setSymbols(imgs);
  arrayView.setSymbols(imgs);
});

// 停止制御の先読みを空き時間に済ませる（1 組 20〜30ms）
let prepIndex = 0;
function prepStep() {
  if (prepIndex >= FLAG_SETS.length) return;
  const s = FLAG_SETS[prepIndex++];
  prepare(s.allowed, s.mode, s.bet);
  setTimeout(prepStep, 30);
}
setTimeout(prepStep, 300);
