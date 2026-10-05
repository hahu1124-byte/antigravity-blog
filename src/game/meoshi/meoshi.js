// 目押しチャレンジ: 画面・入力・遊技の進行
import {
  FRAMES,
  FRAME_MS,
  BIG_END_PAYOUT,
  BB_VITA_PAY,
  REG_END_GAMES,
  REG_END_WINS,
  TRIPLE_DON,
  BONUS_BET,
  ROLES,
  REELS,
  REACH_SHOW_RATE,
  DELAY_MS,
  DELAY_RATE,
  BETS,
  LINES,
  LINES_BY_BET,
  payOf,
} from "./reel-data.js";
import {
  SETTINGS,
  drawNormal,
  drawBB,
  drawRB,
  theoryOdds,
  nextRt,
  RT_GAMES,
  CHAL_EXTEND_LEFT,
} from "./game-rules.js";
import {
  pushedFrame,
  pushOffsetMs,
  decideStop,
  judge,
  prepare,
  reachAt,
  reachKindOf,
  symAt,
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
  speed: 1, // オートの速さ（1 等速・2 高速消化・20 超高速消化）
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
const SPEEDS = [1, 2, 20];
if (!SPEEDS.includes(store.speed)) store.speed = 1;
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

// ---- 時計 ----
// リールの回転とオートの待ち時間は、この時計で進める。高速消化（オート中だけ）は実時間の speed 倍で進む。
// 手で打つときはいつも等速なので、押した時刻（event.timeStamp）は toClock で直すだけでよい
let clockNow = performance.now();
let clockReal = clockNow;
const rate = () => (autoMode !== "off" && mode === "play" ? store.speed : 1);
const toClock = (real) => clockNow + (real - clockReal) * rate();

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

// 1 秒あたりに締めたゲーム数（高速消化の実測表示）
const gameTimes = [];

function frame() {
  const real = performance.now();
  // タブが裏にあった間などは、まとめて進めない
  let remain = Math.min(real - clockReal, 100) * rate();
  clockReal = real;
  // 描画 1 回の間に、半コマずつ時計を進めて止まり・オートを処理する（高速でも押す位置を飛ばさない）。
  // 計算が描画に間に合わない分は捨てる（固まらないように。そのぶん実際の速さは下がる）
  do {
    const step = Math.min(remain, FRAME_MS / 2);
    clockNow += step;
    remain -= step;
    tick(clockNow);
  } while (remain > 0 && performance.now() - real < 12);
  const now = clockNow;
  const positions = [0, 1, 2].map((r) => posAt(r, now));
  renderer.draw(positions, {
    spinning: store.ghost ? [0, 1, 2].map((r) => moving(r, now)) : null,
    lines: now < litUntil ? litLines : null,
    flash: now < flashUntil ? (flashUntil - now) / 400 : 0,
  });
  if (arrayShown()) arrayView.draw(positions);
  updateStopButtons();
  renderSpeedNow(real);
  requestAnimationFrame(frame);
}

function tick(now) {
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
  // 停止音は押した瞬間ではなく、すべり終えて絵が止まった瞬間に鳴らす
  for (let r = 0; r < 3; r++) {
    const R = reels[r];
    if (R.spinning && R.stopAt !== null && !R.stopSounded && !moving(r, now)) {
      R.stopSounded = true;
      sfx.stop();
    }
  }
  autoTick(now);
}

function updateStopButtons() {
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
  games: 0, // 通常時と RT のゲーム数（ボーナス中は数えない）
  normalGames: 0, // RT を除いた通常時のゲーム数（小役の確率の分母）
  diff: 0,
  bigDon: 0,
  bigSeven: 0,
  reg: 0,
  rt: null, // { type: "chal"|"game", left }
  bonusFlag: null,
  notice: null,
  lamp: false,
  replay: false,
  bonus: null,
  setting: pickSetting(),
  revealed: false,
  // ボーナスの履歴（新しい順）。{ type, flag, start（前のボーナスからのゲーム数）, total（当選時の総ゲーム数）,
  //   paid（獲得枚数）, net（純増）, inRt（当選したときの RT）, chal・game（後の RT のゲーム数）, rtOpen }
  history: [],
  lastBonusAt: 0, // 前のボーナスが揃ったときの総ゲーム数
});
const HISTORY_MAX = 200;
// 設定の選び方: 1・2・5・6 はその設定、"?" は 1・2・5・6 から伏せて選ぶ（「設定を見る」で開ける）
function pickSetting() {
  const c = store.setting;
  if (c !== "?" && SETTINGS.includes(Number(c))) return Number(c);
  return SETTINGS[Math.floor(Math.random() * SETTINGS.length)];
}
let play = store.play || NEW_PLAY();
if (!SETTINGS.includes(play.setting)) play.setting = pickSetting();
// BIG をドン・赤7 に分ける前に保存したデータは、作り直す（数え方が変わったため）
if (play.bigDon === undefined || play.normalGames === undefined) {
  play = NEW_PLAY();
  store.play = play;
}
// 履歴を足す前に保存したデータは、空の履歴から始める
if (!Array.isArray(play.history)) play.history = [];
if (!Number.isFinite(play.lastBonusAt)) play.lastBonusAt = play.games;
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
  // リプレイのときは前のゲームと同じ枚数が自動で掛かる（メダルは減らない）。ボーナス中は自動で BONUS_BET 枚
  const bet = play.bonus
    ? BONUS_BET
    : play.replay
      ? play.replayBet || store.bet
      : store.bet;
  if (!play.replay) play.diff -= bet;
  play.replay = false;
  if (play.bonus) {
    const B = play.bonus;
    if (B.type === "big") {
      // BIG 中: 風鈴A（平行）・風鈴B（斜め）は 15 枚、バラケ目は小役が揃わず払い出しなし（ユーザー説明）
      const f = drawBB(play.setting);
      current = {
        allowed: f === "bara" ? [] : ["bonusFuurin"],
        mode: "bonus",
        bet,
        bbFlag: f,
      };
      if (f !== "bara" && !B.vitaDone) {
        // 枚数調整（1 回だけ）。成功するまでは毎ゲーム、左第一停止で中段に赤7 をビタ押しすると 14 枚役
        // （中・右は平行風鈴か斜め風鈴に止まる）。外したらふつうに風鈴 15 枚
        current.tech = "bbVita";
        current.techOk = false;
        message("BB中：左リール中段に赤7をビタ押し！（成功まで毎ゲーム）");
      }
    } else {
      // REG 中: 1 枚役（予告音・3 連ドン狙いで外せる）・共通 15 枚（予告音）・特殊役（崩れ目 15 枚）・風鈴・ハズレ
      const f = drawRB(play.setting);
      current =
        f === "one"
          ? { allowed: [], mode: "bonus", bet, free: true, tech: "rbOne" }
          : {
              allowed: f === "none" ? [] : ["bonusFuurin"],
              mode: "bonus",
              bet,
            };
      current.rbFlag = f;
      if (f === "one" || f === "common" || f === "bara") {
        sfx.notice();
        message("予告音！左リールに3連ドン狙い");
      }
    }
  } else {
    play.games++;
    const rtType = play.rt ? play.rt.type : null;
    if (!rtType) play.normalGames++;
    const { bonus, small } = drawNormal(play.setting, rtType);
    let fresh = false;
    if (bonus && !play.bonusFlag) {
      play.bonusFlag = bonus;
      fresh = true;
    }
    // 移行リプレイ・RT リプレイは、止め方はリプレイと同じ
    const ctrlSmall =
      small === "jacIn" || small === "rtReplay" ? "replay" : small;
    // 成立した回数（取りこぼしも数える。確率の表のかっこ内に出す）。小役は RT 中を除く
    play.flagCounts = play.flagCounts || {};
    const countUp = (f) => (play.flagCounts[f] = (play.flagCounts[f] || 0) + 1);
    if (fresh) countUp(bonus);
    if (small && !rtType) countUp(small);
    // ボーナス成立中の止め方の目印:
    //   リーチ目かランプでボーナスが分かった後は、ボーナス図柄を引き込む（"pull"。小役が成立していないゲームだけ）
    //   まだ分かっていないうちは、一定の割合でリーチ目の形を優先して止める（"reach"）
    let mark = null;
    if (play.bonusFlag) {
      if ((play.reachSeen || play.lamp) && !ctrlSmall) mark = "pull";
      else if (!play.reachSeen && Math.random() < REACH_SHOW_RATE)
        mark = "reach";
    }
    current = {
      allowed: [play.bonusFlag, ctrlSmall, mark].filter(Boolean),
      mode: "normal",
      bet,
      small,
      bonus: fresh ? bonus : null,
      rt: rtType,
    };
    // 花火チャレンジの移行リプレイ: 残り 7G までは逆押しナビ（左を最後に上段暖簾でハズすと延命）、
    // 残り 6G からは順押しナビ（揃えて花火GAME へ）
    if (small === "jacIn") {
      current.navi = play.rt.left >= CHAL_EXTEND_LEFT ? "reverse" : "forward";
      message(
        current.navi === "reverse"
          ? "逆押しナビ：中・右を先に、左リール上段に暖簾を狙ってハズす"
          : "順押しナビ：揃えて花火GAMEへ",
      );
    }
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
    // 遅れ（リール始動音が遅れる）: チェリーかボーナスが成立したゲームで抽選する
    current.delay =
      (ctrlSmall === "cherry" && Math.random() < DELAY_RATE.cherry) ||
      (fresh && Math.random() < DELAY_RATE.bonus);
  }
  if (!current.free) prepare(current.allowed, current.mode, current.bet);
  renderBet();
  // リール始動音。遅れのゲームはリールが回り始めてから 0.8 秒後に鳴る
  if (current.delay) setTimeout(() => sfx.lever(), DELAY_MS / rate());
  else sfx.lever();
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
  const bet = play.bonus
    ? BONUS_BET
    : play.replay
      ? play.replayBet || store.bet
      : store.bet;
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

// 止まり終わったゲームで成立していたフラグの表示名（「設定」の右のタイルに出す）
const FLAG_LABEL = {
  bigDon: "ヒバナBIG",
  bigSeven: "赤7BIG",
  reg: "REG",
  replay: "リプレイ",
  jacIn: "移行リプレイ",
  rtReplay: "RTリプレイ",
  fuurin: "風鈴",
  kori: "氷",
  cherry: "チェリー",
};
const BB_FLAG_LABEL = {
  fuurinA: "風鈴（平行）",
  fuurinB: "風鈴（斜め）",
  bara: "バラケ目",
};
const RB_FLAG_LABEL = {
  fuurin: "風鈴（15枚）",
  one: "1枚役",
  common: "共通15枚役",
  bara: "特殊役（崩れ目）",
  none: "ハズレ",
};
function flagLabel() {
  if (current.mode === "bonus") {
    if (current.techOk) return "14枚役（ビタ押し）";
    return current.bbFlag
      ? BB_FLAG_LABEL[current.bbFlag]
      : RB_FLAG_LABEL[current.rbFlag];
  }
  const names = [play.bonusFlag || current.bonus, current.small]
    .filter((f) => FLAG_LABEL[f])
    .map((f) => FLAG_LABEL[f]);
  const label = names.length ? names.join("＋") : "ハズレ";
  // 遅れ（リール始動音が 0.8 秒遅れた）ゲームは印を付ける
  return current.delay ? `${label}（遅れ）` : label;
}

function finishPlay(stops) {
  // 揃えたボーナスのフラグは finishPlay の中で消えるので、表示用の名前を先に作る
  play.lastFlag = flagLabel();
  const bet = current.bet;
  // リプレイハズシで止めたゲームは何も揃っていない扱い（左の窓に暖簾・氷・風鈴で、リプレイ図柄が無い）
  const wins = current.hazushi ? [] : judge(stops, current.mode, bet);
  const payTotal = Math.min(
    15,
    wins.reduce((a, w) => a + payOf(w.role, bet), 0),
  );
  // 入賞ラインはボーナスが揃ったときだけ光らせる（小役では出さない）
  litLines = wins
    .filter((w) => ROLES[w.role].kind === "bonus")
    .map((w) => w.line);
  litUntil = clockNow + 1200;
  if (play.bonus) {
    const B = play.bonus;
    let pay = payTotal;
    let note = "";
    if (current.tech === "bbVita") {
      // 成功なら 14 枚役（枚数調整）、外したらふつうに風鈴 15 枚
      if (current.techOk) {
        pay = BB_VITA_PAY;
        // 枚数調整は 1 回だけ。成功したら、あとは逆押し適当打ちで 15 枚
        B.vitaDone = true;
        note = "ビタ押し成功！14枚（枚数調整）";
        sfx.hit();
      } else {
        note = "ビタ押し失敗（15枚）";
        sfx.miss();
      }
    } else if (current.tech === "rbOne") {
      // 左リールの窓（中段の上下）に 3 連ドンのどれかが入っていれば 1 枚役を外せる
      const win = [stops[0] - 1, stops[0], stops[0] + 1].map(mod);
      const dodged = win.some((i) => TRIPLE_DON.includes(i));
      pay = dodged ? 0 : 1;
      note = dodged ? "1枚役ハズシ成功！" : "1枚役が入賞（1回分）";
      if (dodged) sfx.hit();
      else sfx.miss();
    }
    if (current.bbFlag === "bara") note = "バラケ目（払い出しなし）";
    B.games++;
    B.paid += pay;
    B.net = (B.net || 0) + pay - bet;
    // BIG の終了の数（279 枚超え）は、枚数調整の 14 枚役を除いた払い出しで数える
    if (!current.techOk) B.count = (B.count || 0) + pay;
    play.diff += pay;
    if (pay) {
      B.wins++;
      sfx.payout(pay);
    }
    const h = play.history[0];
    if (h) {
      h.paid = B.paid;
      h.net = B.net;
    }
    const label = B.type === "big" ? "BIG" : "REG";
    const over =
      B.type === "big"
        ? B.count > BIG_END_PAYOUT
        : B.games >= REG_END_GAMES || B.wins >= REG_END_WINS;
    const status =
      B.type === "big"
        ? `${B.count || 0}/${BIG_END_PAYOUT}枚`
        : `${B.wins}/${REG_END_WINS}回・${B.games}/${REG_END_GAMES}G`;
    if (over) {
      // BIG の後は花火チャレンジ（RT）。REG の後は通常
      play.rt = B.type === "big" ? { type: "chal", left: RT_GAMES } : null;
      // 履歴: BIG の後の RT のゲーム数をここから数える
      if (h && play.rt) {
        h.chal = 0;
        h.rtOpen = true;
      }
      message(
        `${note ? note + "　" : ""}${label} 終了 ${B.paid}枚（純増 ${B.net}枚）` +
          (play.rt ? "　花火チャレンジへ" : ""),
      );
      play.bonus = null;
      // ボーナスが終わったら 3 枚掛けに戻す
      store.bet = 3;
      renderBet();
    } else {
      message(`${note ? note + "　" : ""}${label} 中 ${status}`);
    }
  } else {
    const bonusWin = wins.find((w) => ROLES[w.role].kind === "bonus");
    const replayWin = wins.some((w) => ROLES[w.role].kind === "replay");
    if (bonusWin) {
      const flag = ROLES[bonusWin.role].flag;
      play[flag]++;
      // 履歴: 前のボーナスの RT はここで終わり（RT 中の当選）、新しい行を足す
      const prev = play.history[0];
      if (prev) prev.rtOpen = false;
      play.history.unshift({
        type: flag === "reg" ? "reg" : "big",
        flag,
        start: play.games - play.lastBonusAt,
        total: play.games,
        paid: 0,
        net: 0,
        inRt: play.rt ? play.rt.type : null,
        chal: null,
        game: null,
        rtOpen: false,
      });
      play.history.length = Math.min(play.history.length, HISTORY_MAX);
      play.lastBonusAt = play.games;
      play.bonus = {
        type: flag === "reg" ? "reg" : "big",
        flag,
        paid: 0,
        count: 0,
        net: 0,
        games: 0,
        wins: 0,
      };
      play.bonusFlag = null;
      play.reachSeen = false;
      play.notice = null;
      play.lamp = false;
      // ボーナスが揃えば RT は終わる
      play.rt = null;
      flashUntil = clockNow + 400;
      sfx.bonus();
      message(`${FLAG_LABEL[flag]} BONUS!`);
    } else if (replayWin) {
      play.replay = true;
      play.replayBet = bet;
      sfx.replay();
      message(
        current.small === "jacIn"
          ? "JAC IN！花火GAMEへ"
          : current.small === "rtReplay"
            ? "RTリプレイ"
            : "リプレイ",
      );
    } else if (wins.length) {
      play.diff += payTotal;
      sfx.payout(payTotal);
      message(`${ROLES[wins[0].role].name} ${payTotal}枚`);
    } else {
      message(play.bonusFlag && play.lamp ? "ボーナスを揃えよう" : "");
    }
    // RT（花火チャレンジ・花火GAME）の残りゲーム数を進める
    if (play.rt && !bonusWin) {
      const before = play.rt;
      play.rt = nextRt(before, {
        jacIn: current.small === "jacIn",
        aligned: replayWin,
      });
      // 履歴: 花火チャレンジ・花火GAME のゲーム数（JAC IN のゲームは花火チャレンジに数える）
      const h = play.history[0];
      if (h && h.rtOpen) {
        if (before.type === "chal") h.chal++;
        else h.game++;
        if (play.rt && play.rt.type === "game" && before.type === "chal")
          h.game = 0;
        if (!play.rt) h.rtOpen = false;
      }
      if (play.rt && play.rt.type === "game" && before.type === "chal")
        message("JAC IN！花火GAME 20G");
      else if (!play.rt)
        message(
          `${before.type === "chal" ? "花火チャレンジ" : "花火GAME"} 終了`,
        );
      else if (current.hazushi) {
        // ハズしても再遊技（1geki: 移行リプレイの欄は「逆押しのときに出るリプレイ」）。移行はしない（残りは 1 減る）
        play.replay = true;
        play.replayBet = bet;
        sfx.replay();
        message("JAC INハズシ成功（リプレイ）");
      }
    }
    // 小役の入賞回数（確率の表に出す。RT 中は数えない）
    const smallWin = wins.find((w) => ROLES[w.role].kind !== "bonus");
    if (smallWin && !current.rt) {
      const f = ROLES[smallWin.role].flag;
      play.counts = play.counts || {};
      play.counts[f] = (play.counts[f] || 0) + 1;
    }
    // リーチ目（ボーナス成立中にしか出ない形）
    // リプレイハズシのゲームは左を手で止めているので、停止制御の保証（ボーナスなしでリーチ目にしない）が無い。
    // リーチ目として扱わない
    const k = bonusWin || current.hazushi ? -1 : reachAt(stops, bet);
    // リーチ目が出たら、次のゲームからボーナス図柄を引き込む
    if (k >= 0) play.reachSeen = true;
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

function stateLabel() {
  const B = play.bonus;
  if (B) return B.type === "big" ? `${FLAG_LABEL[B.flag]} 中` : "REG 中";
  if (play.rt)
    return `${play.rt.type === "chal" ? "花火チャレンジ" : "花火GAME"} 残り${play.rt.left}G`;
  return play.replay ? "リプレイ" : "通常";
}

function renderPlayStats() {
  // ボーナスの回数・確率は下の「役の確率」の表に出すので、ここには出さない
  $("moPlayStats").innerHTML = `
    <div class="mo-stat"><span>総ゲーム数</span><b>${play.games}</b></div>
    <div class="mo-stat"><span>ボーナス後</span><b>${play.games - play.lastBonusAt}G</b></div>
    <div class="mo-stat"><span>差枚</span><b class="${play.diff >= 0 ? "ok" : "ng"}">${play.diff >= 0 ? "+" : ""}${play.diff}</b></div>
    <div class="mo-stat"><span>状態</span><b class="mo-flag">${stateLabel()}</b></div>
    <div class="mo-stat"><span>設定</span><b>${store.setting === "?" && !play.revealed ? "?" : play.setting}</b></div>
    <div class="mo-stat"><span>前のゲームのフラグ</span><b class="mo-flag">${anySpinning() ? "…" : play.lastFlag || "-"}</b></div>`;
  renderOddsTable();
  renderHistory();
}

// ボーナスの履歴（ホールのデータ表示機のように、新しい順）
//   回・種別・スタート（前のボーナスから何 G で当たったか）・獲得枚数・その後の RT
function renderHistory() {
  const H = play.history;
  const n = H.length;
  // BIG の後の RT は、横にはみ出さないよう次の行に出す（REG は RT なし）
  const rtText = (h) => {
    // BIG 中（RT はまだ）。… は数えている途中
    if (h.chal === null) return "BIG 中…";
    const now = h.rtOpen ? "…" : "";
    return h.game === null
      ? `RT: チャレンジ ${h.chal}G${now}`
      : `RT: チャレンジ ${h.chal}G → GAME ${h.game}G${now}`;
  };
  const rows = H.map((h, i) => {
    const big = h.type === "big";
    const kind = big
      ? `<span class="mo-h-big">${h.flag === "bigSeven" ? "赤7" : "ヒバナ"}</span>`
      : `<span class="mo-h-reg">REG</span>`;
    const from = h.inRt
      ? `<small>${h.inRt === "chal" ? "チャレンジ中" : "GAME中"}</small>`
      : "";
    // 差枚はボーナス中の純増（払い出し − 掛けた枚数）
    const net = `<b class="${h.net >= 0 ? "ok" : "ng"}">${h.net >= 0 ? "+" : ""}${h.net}</b>`;
    const main = `<tr class="${big ? "mo-h-has-rt" : ""}"><td>${n - i}</td><td>${kind}</td><td>${h.start}G${from}</td><td>${net}</td></tr>`;
    return big
      ? main + `<tr class="mo-h-sub"><td colspan="4">${rtText(h)}</td></tr>`
      : main;
  }).join("");
  $("moHistory").innerHTML = `
    <thead><tr><th>回</th><th>種別</th><th>スタート</th><th>差枚</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="4" class="mo-h-empty">まだボーナスはありません</td></tr>`}</tbody>`;
}

// 役ごとの確率の表（実戦の入賞回数と、設定が見えているときは設定の値）
// [表示名, 数えるフラグ, 設定値のキー（theoryOdds）, ボーナスか]。小役は RT を除いた通常時のゲーム数で割る
const ODDS_ROWS = [
  ["ヒバナBIG", ["bigDon"], "bigDon", true],
  ["赤7BIG", ["bigSeven"], "bigSeven", true],
  ["REG", ["reg"], "reg", true],
  ["合算", ["bigDon", "bigSeven", "reg"], "bonus", true],
  ["リプレイ", ["replay"], "replay", false],
  ["風鈴", ["fuurin"], "fuurin", false],
  ["氷", ["kori"], "kori", false],
  ["チェリー", ["cherry"], "cherry", false],
];
function renderOddsTable() {
  const shown = !(store.setting === "?" && !play.revealed);
  const theory = theoryOdds(play.setting);
  const counts = {
    ...(play.counts || {}),
    bigDon: play.bigDon,
    bigSeven: play.bigSeven,
    reg: play.reg,
  };
  const flagCounts = play.flagCounts || {};
  const fmt = (x) => (x && isFinite(x) ? `1/${x.toFixed(1)}` : "-");
  const rows = ODDS_ROWS.map(([label, flags, key, isBonus]) => {
    // 入賞（揃えた）回数と、かっこ内に成立した回数（取りこぼしも含む）
    const n = flags.reduce((a, f) => a + (counts[f] || 0), 0);
    const m = flags.reduce((a, f) => a + (flagCounts[f] || 0), 0);
    const g = isBonus ? play.games : play.normalGames;
    return `<tr><th>${label}</th><td>${n}<small>（${m}）</small></td><td>${n ? fmt(g / n) : "-"}<br><small>（${m ? fmt(g / m) : "-"}）</small></td><td>${shown ? fmt(theory[key]) : "?"}</td></tr>`;
  }).join("");
  $("moOdds").innerHTML = `
    <thead><tr><th></th><th>回数<br><small>（成立）</small></th><th>実戦<br><small>（成立）</small></th><th>設定値</th></tr></thead>
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
  // t はこの時計の時刻（手で引いたときは toClock で直してから渡す）
  startSpin(t);
}

function push(r, timeStamp) {
  const R = reels[r];
  if (!R.spinning || R.stopAt !== null) return;
  unlockAudio();
  // 画面と入力の遅れを引いた時刻で、そのときの位置を計算する
  const t = Math.max(R.t0, toClock(timeStamp - store.latency));
  const pos = R.phase + (t - R.t0) / FRAME_MS;
  const pushed = pushedFrame(pos);
  if (mode === "practice") {
    practicePush(r, pos, pushed);
    return;
  }
  stopAtFrame(r, pos, pushed);
}

// リプレイハズシで左リールを止める中段の位置（上段が暖簾＝0 始まりで 8 番）と、受け付ける押したコマ
const HAZUSHI_MID = REELS[0].indexOf("N") - 1;
const HAZUSHI_PUSHES = [HAZUSHI_MID - 1, HAZUSHI_MID];

// 押したコマ pushed（巻き戻らない連続値）からすべりを決めて止める。手で押したときとオートで共通
function stopAtFrame(r, pos, pushed) {
  const R = reels[r];
  const stops = reels.map((x) => (x.stopAt === null ? null : mod(x.stopAt)));
  let res;
  let vitaLabel = "";
  if (current.tech === "bbVita" && r === 0 && stops.every((s) => s === null)) {
    // BB 1G目: 左第一停止で、押したコマがちょうど赤7（すべり 0 で中段に止まる）ならビタ押し成功。
    // 赤7 が中段の真ん中に来る直前の 1 コマ分（約 36ms）に押す必要がある。ずれは練習モードと同じ表示で出す
    const sIdx = REELS[0].indexOf("S");
    const offset = pushOffsetMs(pos, sIdx);
    vitaLabel = resultLabel({
      offset,
      frames: Math.round(offset / FRAME_MS),
    });
    if (symAt(0, pushed) === "S") {
      current.techOk = true;
      res = { slip: 0 };
    }
  }
  if (!res && current.techOk) {
    // 成功後の中・右: 風鈴を下段（平行風鈴）か、右は上段（斜め風鈴）に止める
    res = { slip: vitaFuurinSlip(r, pushed) };
  }
  // 花火チャレンジのリプレイハズシ: 逆押しナビで左を最後に押し、暖簾が枠上〜上段に来る位置（押したコマが
  // 6・7 番）なら、暖簾を上段に止めて移行リプレイを揃えない（左の窓が氷・風鈴・暖簾でリプレイ図柄が無い）
  if (
    !res &&
    current.navi === "reverse" &&
    r === 0 &&
    stops[1] !== null &&
    stops[2] !== null &&
    HAZUSHI_PUSHES.includes(mod(pushed))
  ) {
    res = { slip: HAZUSHI_MID - mod(pushed) };
    current.hazushi = true;
  }
  if (!res)
    // 技術介入のゲーム（RB の 1 枚役）はすべらせず、押した位置で止める
    res = current.free
      ? { slip: 0 }
      : decideStop(
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
    vitaLabel || (res.slip === 0 ? "すべりなし" : `${res.slip}コマすべり`);
}

// ビタ押し成功後の中・右リールのすべり。風鈴が下段に来る位置（右は上段でもよい）を 0〜4 コマから選ぶ
function vitaFuurinSlip(r, pushed) {
  const isF = (i) => ["F", "G"].includes(symAt(r, i));
  for (let s = 0; s <= 4; s++) if (isF(pushed + s - 1)) return s; // 下段
  if (r === 2) for (let s = 0; s <= 4; s++) if (isF(pushed + s + 1)) return s; // 上段（斜め）
  return 0;
}

// ---- オート ----
// "off"・"basic"（最低限の目押し）・"full"（小役からビタ押しまで全部）
let autoMode = "off";
let autoNextAt = 0;
// このゲームの押す順（order）と各リールを押すコマ（pushes。0 始まり）
let autoPlan = null;
const JUN = [0, 1, 2]; // 順押し
const HASAMI = [0, 2, 1]; // ハサミ打ち（左→右→中）
const GYAKU = [2, 1, 0]; // 逆押し（右→中→左）
const idxOf = (r, sym) => REELS[r].indexOf(sym);

function setAuto(m, byUser = true) {
  autoMode = m;
  autoNextAt = clockNow + 300;
  // 音はボタンを押した処理の中で解禁する（ページを開いたときは鳴らせない）
  if (byUser) unlockAudio();
  applySound();
  document
    .querySelectorAll(".mo-auto")
    .forEach((b) => b.classList.toggle("active", b.dataset.auto === m));
}

// オートの速さ（等速・高速消化 ×2・超高速消化 ×20）。手で打つときは効かない
function setSpeed(s) {
  if (!SPEEDS.includes(s)) return;
  store.speed = s;
  save();
  applySound();
  gameTimes.length = 0;
  document
    .querySelectorAll(".mo-speed")
    .forEach((b) =>
      b.classList.toggle("active", Number(b.dataset.speed) === s),
    );
}

// 超高速消化は効果音を出さない（音が重なって鳴り続けるため）
function applySound() {
  setSoundEnabled(store.sound && rate() <= 2);
}

// 高速消化の実際の速さ（直近 3 秒に締めたゲーム数から 1 秒あたりを出す）
let speedNowShown = "";
function renderSpeedNow(real) {
  while (gameTimes.length && gameTimes[0] < real - 3000) gameTimes.shift();
  const text =
    rate() > 1 && gameTimes.length > 1
      ? `実測 ${((gameTimes.length - 1) / ((gameTimes.at(-1) - gameTimes[0]) / 1000)).toFixed(1)} ゲーム/秒`
      : "";
  if (text !== speedNowShown)
    $("moSpeedNow").textContent = speedNowShown = text;
}

// このゲームの押す順と、各リールをどのコマで押すかを決める（レバーの直後に呼ぶ）
// pushes の null は「狙わずにすぐ押す」（適当打ち。待たない分だけ速い）
function planAuto() {
  const rnd = () => ({ order: HASAMI, pushes: [null, null, null] });
  const full = autoMode === "full";
  // BB 中の枚数調整: 完全は左リールの赤7 をちょうどで押す（ビタ）
  if (current.tech === "bbVita")
    return full
      ? { order: HASAMI, pushes: [idxOf(0, "S"), null, null] }
      : rnd();
  // RB の 1 枚役: 完全は左リールの窓に 3 連ドンが入る位置で押す
  if (current.tech === "rbOne")
    return full
      ? { order: HASAMI, pushes: [TRIPLE_DON[1], null, null] }
      : rnd();
  if (current.mode === "bonus") return rnd();
  // 完全: 花火チャレンジの逆押しナビは、中・右をすぐ押してから左の暖簾を上段に狙ってリプレイハズシ
  if (full && current.navi === "reverse")
    return { order: GYAKU, pushes: [HAZUSHI_MID, null, null] };
  // 完全: 押し位置は先に決めず、各リールの番が来たときに「取れる最高の結果を保てる、いちばん早い位置」で押す
  if (full)
    return {
      order: HASAMI,
      pushes: ["best", "best", "best"],
      best: bestScoreFrom([null, null, null], HASAMI),
    };
  // 最低限: ボーナスが分かったら（リーチ目・ランプ）ボーナス図柄を中段の 2 コマ手前で狙い、引き込みに任せる。
  // ドン BIG はドン、赤7 BIG は赤7、REG は「赤7・赤7・暖簾」
  if (play.bonusFlag && (play.reachSeen || play.lamp)) {
    const syms =
      play.bonusFlag === "bigDon"
        ? ["D", "D", "D"]
        : play.bonusFlag === "bigSeven"
          ? ["S", "S", "S"]
          : ["S", "S", "N"];
    return {
      order: JUN,
      pushes: syms.map((s, r) => mod(idxOf(r, s) - 2)),
    };
  }
  // ふだん: 左リール上段に暖簾を狙うハサミ打ち。右はすぐ押す（氷は引き込む）。
  // 中は、左右で氷がテンパイしたときだけ氷を狙い、それ以外はすぐ押す（"kori"）
  return {
    order: HASAMI,
    pushes: [mod(idxOf(0, "N") - 1), "kori", null],
  };
}

// 完全オート: stops（止まっているリール）から、残りのリールを order の順に押したときに取れる最高の得点
function bestScoreFrom(stops, order) {
  const { allowed, mode: m, bet } = current;
  const rest = order.filter((r) => stops[r] === null);
  if (!rest.length) return autoScore(stops);
  const r = rest[0];
  let best = -Infinity;
  for (let p = 0; p < FRAMES; p++) {
    const next = stops.slice();
    next[r] = decideStop(stops, r, p, allowed, m, bet).mid;
    best = Math.max(best, bestScoreFrom(next, order));
  }
  return best;
}

// 今のリールの押す位置（巻き戻らない連続値）を決める。p0 は今押したら押したことになるコマ
function resolveAutoPush(r, p0) {
  const target = autoPlan.pushes[r];
  if (target === null) return p0;
  if (typeof target === "number") return p0 + mod(target - p0);
  const stops = reels.map((x) => (x.stopAt === null ? null : mod(x.stopAt)));
  const { allowed, mode: m, bet } = current;
  if (target === "best") {
    // 今すぐ・1 コマ待つ・2 コマ待つ…の順に試し、取れる最高の得点を保てる最初の位置で押す
    for (let d = 0; d < FRAMES; d++) {
      const next = stops.slice();
      next[r] = decideStop(stops, r, mod(p0 + d), allowed, m, bet).mid;
      if (bestScoreFrom(next, autoPlan.order) >= autoPlan.best) return p0 + d;
    }
    return p0;
  }
  // "kori": 左右で氷がテンパイしているラインがあれば、そのラインの段に中の氷が来る位置を狙う
  let bestAt = null;
  for (const l of LINES_BY_BET[bet]) {
    const rows = LINES[l].rows;
    const left = symAt(0, stops[0] + rows[0] - 1);
    const right = symAt(2, stops[2] + rows[2] - 1);
    if (left !== "I" || !["I", "N"].includes(right)) continue;
    for (let i = 0; i < FRAMES; i++) {
      if (REELS[1][i] !== "I") continue;
      // 氷が rows[1] の段に来る中段の位置。1 コマ手前で押して引き込みに任せる
      const at = p0 + mod(i - (rows[1] - 1) - 1 - p0);
      if (bestAt === null || at < bestAt) bestAt = at;
    }
  }
  return bestAt === null ? p0 : bestAt;
}

// 止まり方の得点: ボーナス揃い ＞ 払い出し ＞ リプレイ。
// 小役も成立しているゲームは小役を先に取る（ボーナスは持ち越すので次のゲームで揃えられる）
function autoScore(stops) {
  const hasSmall = current.allowed.some((f) =>
    ["replay", "fuurin", "kori", "cherry"].includes(f),
  );
  let v = 0;
  for (const w of judge(stops, current.mode, current.bet)) {
    const role = ROLES[w.role];
    v +=
      role.kind === "bonus"
        ? hasSmall
          ? 50
          : 100000
        : role.kind === "replay"
          ? 300
          : payOf(w.role, current.bet) * 100;
  }
  return v;
}

// 毎フレーム呼ぶ。止まっていればレバー、回っていれば順押しで決めたコマが来たところで止める
function autoTick(now) {
  if (autoMode === "off" || mode !== "play" || calib.active) return;
  if (now < autoNextAt) return;
  if (!anySpinning()) {
    // ボーナスを狙うときは 1 枚掛けにする（最低限はリーチ目・ランプで分かってから、完全は成立したら）。
    // ボーナスが終わると 3 枚掛けに戻る（finishPlay）
    const aimBonus =
      !play.bonus &&
      play.bonusFlag &&
      (autoMode === "full" || play.reachSeen || play.lamp);
    if (aimBonus && store.bet !== 1 && !play.replay) {
      store.bet = 1;
      save();
      renderBet();
    }
    lever(now);
    pressFx($("moLever"));
    autoPlan = planAuto();
    autoPlan.at = [];
    autoNextAt = now + 450; // 回り始めてから押し始める
    return;
  }
  if (!autoPlan) return;
  const r = autoPlan.order.find(
    (i) => reels[i].spinning && reels[i].stopAt === null,
  );
  if (r === undefined) return;
  const R = reels[r];
  const pos = R.phase + (now - R.t0) / FRAME_MS;
  // 狙うコマが次に来る位置（巻き戻らない連続値）を 1 回だけ決める
  if (autoPlan.at[r] === undefined) {
    const p0 = pushedFrame(pos);
    // null はすぐ押す・数字はそのコマ・"best"／"kori" はその場で決める（resolveAutoPush）
    autoPlan.at[r] = resolveAutoPush(r, p0);
  }
  const pushed = autoPlan.at[r];
  // 手で押すのと同じく、狙うコマが中段に来る直前（ビタの窓の中）まで待ってから押す。
  // 押した瞬間に下の停止ボタンも押した見た目にする
  if (pos < pushed - 0.6) return;
  stopAtFrame(r, Math.min(pos, pushed), pushed);
  pressFx(document.querySelector(`.mo-stop[data-reel="${r}"]`));
  autoNextAt = now + 200;
}

// ボタンを押した見た目（オートが押したとき）
function pressFx(el) {
  if (!el) return;
  el.classList.add("pressed");
  setTimeout(() => el.classList.remove("pressed"), 160);
}

function finishGame() {
  if (mode === "play") finishPlay(reels.map((R) => R.rest));
  // オートは、止まり終わってから少し待って次のレバー
  autoNextAt = clockNow + (play.bonus ? 500 : 650);
  gameTimes.push(performance.now());
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
    lever(toClock(e.timeStamp));
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
  lever(toClock(e.timeStamp));
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
  if (m !== "play") setAuto("off");
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
  applySound();
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
document
  .querySelectorAll(".mo-auto")
  .forEach((b) => b.addEventListener("click", () => setAuto(b.dataset.auto)));
setAuto("off", false);
document
  .querySelectorAll(".mo-speed")
  .forEach((b) =>
    b.addEventListener("click", () => setSpeed(Number(b.dataset.speed))),
  );
setSpeed(store.speed);
// 初期状態は遊技モード
setMode("play");
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
