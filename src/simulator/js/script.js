/* --- 動き (JavaScript) --- */

// ============================================================
// 機種データ定義
// ============================================================
const REZERO_SAIBARE_TRUST = 0.4;
const REZERO_SAIBARE_HIT_RATE = 0.938;
const FREEZE_BONUS_ANIMATION_MS = 1000;
const POST_BONUS_HOLD_MS = 500;

// missRateForTrust: 「この演出が出た時の信頼度(trust)」を満たすために、
// ハズレ側でその演出が出現すべき確率をベイズの定理から逆算する。
// （リゼロの先バレ演出のみで使用。通常の演出テーブルは信頼度帯方式に統一済み）
function missRateForTrust(hitRate, trust, odds) {
  const hitProbability = 1 / odds;
  const missProbability = 1 - hitProbability;
  return (hitProbability * hitRate * (1 - trust)) / (trust * missProbability);
}

async function showFreezeBonus() {
  const overlay = document.getElementById("freeze-bonus-overlay");
  if (!overlay) return;
  overlay.classList.remove("freeze-bonus-active");
  void overlay.offsetWidth;
  overlay.style.display = "block";
  overlay.classList.add("freeze-bonus-active");
  await new Promise((resolve) =>
    setTimeout(resolve, FREEZE_BONUS_ANIMATION_MS),
  );
  overlay.classList.remove("freeze-bonus-active");
  overlay.style.display = "none";
}

// ============================================================
// 信頼度帯抽選エンジン（2^n整数カウント方式）
//
// 「当り確率」「各演出の出現率」「信頼度(trust)表示」を別々に手打ちすると
// 三者が矛盾しうるため、単一の整数テーブルから全て導出する。
// 各帯は { hit本数, miss本数 } を持ち、trust = hit/(hit+miss) は自動導出値。
// Σ(hit+miss) は機種のbit幅（2^n）に厳密一致させ、Σhit が目標当り本数になる。
// 1回のMath.random()*2^n で帯を引き、その帯のhit本数/総本数で当落を即確定する
// （＝当落と信頼度が構造的に一致する）。
// ============================================================
function finalizeBands(rows) {
  return rows.map((r) => ({
    ...r,
    trust: (r.hit / (r.hit + r.miss)) * 100,
  }));
}
function bandHitTotal(bands) {
  return bands.reduce((s, b) => s + b.hit, 0);
}
function bandGrandTotal(bands) {
  return bands.reduce((s, b) => s + b.hit + b.miss, 0);
}
function oddsFromBands(bands) {
  return bandGrandTotal(bands) / bandHitTotal(bands);
}
function drawBand(bands) {
  const total = bandGrandTotal(bands);
  let r = Math.floor(Math.random() * total);
  for (const b of bands) {
    const span = b.hit + b.miss;
    if (r < span) return { band: b, isHit: r < b.hit };
    r -= span;
  }
  // 丸め誤差対策のフォールバック（理論上到達しない）
  const last = bands[bands.length - 1];
  return { band: last, isHit: false };
}

// --- リゼロ機 通常 帯テーブル（2^20=1048576, 当り2997本 → 1/349.875） ---
const REZERO_BANDS_N = finalizeBands([
  {
    name: "ベアトリスランプ",
    hit: 450,
    miss: 39,
    effects: { name: ["ベアトリスランプ"], flash: true },
  },
  {
    name: "強欲SP",
    hit: 300,
    miss: 85,
    effects: { name: ["強欲SP"], vibe: true, vibeColor: "red" },
  },
  {
    name: "死に戻りSP",
    hit: 450,
    miss: 415,
    effects: { name: ["死に戻りSP"] },
  },
  {
    name: "俺を選べSP",
    hit: 539,
    miss: 1534,
    effects: { name: ["俺を選べSP"], vibe: true, vibeColor: "red" },
  },
  {
    name: "氷結の絆SP",
    hit: 599,
    miss: 2729,
    effects: { name: ["氷結の絆SP"] },
  },
  {
    name: "スバルATTACK",
    hit: 659,
    miss: 5931,
    effects: { name: ["スバルATTACK"] },
  },
  {
    name: "通常(無演出)",
    hit: 0,
    miss: 1034846,
    effects: { name: [] },
  },
]);

// --- リゼロ機 ST(RUSH) 帯テーブル（2^20=1048576, 当り10496本 → 1/99.902） ---
// RUSH中の当りは「継続確定」自体が信頼度100%の演出のため、帯は1本のみ。
// 具体的なボーナス階級（300/1500/3000）は当り確定後に pickRushBonus() で決める。
const REZERO_BANDS_S = finalizeBands([
  {
    name: "RUSH継続(ボーナス)",
    hit: 10496,
    miss: 0,
    effects: {},
  },
  {
    name: "通常(無演出)",
    hit: 0,
    miss: 1038080,
    effects: { name: ["通常"] },
  },
]);

const MACHINES = {
  eva: {
    title: "EVANGELION Sim -2025 Final-",
    theme: "theme-eva",
    specs: {
      n: EVA_BIT / EVA_N_HIT,
      s: EVA_BIT / EVA_S_HIT,
      st: 163,
      jt: 100,
    },
    type: "ST",
    modeLabel(m) {
      return m;
    },
    async resolveHit(ctx) {
      const { eff, hitDigit } = ctx;
      let bonusBall = 0;
      let isST = false;
      let needsUpgrade = false;
      let isRightUpgrade = false;
      const originalHit = hitDigit;
      // 電サポ中（ST・時短）の当りか。ヘソの通常当りは時短 500 回（実機の「高ベース中の特図1通常当り」）
      const prevMode = mode;
      const highBase = prevMode !== "通常";
      let jitanCount = SPECS.jt;
      // R数：右打ち（特図2）はすべて 10R、ヘソ（特図1）は 10R確変だけ 10R で他は 3R
      const rounds = eff.isRight || eff.kind === "r10" ? 10 : 3;
      if (!eff.isRight) {
        // ヘソ当りの中身は抽選時の当り種別（eff.kind）で決まっている。連チャン中なら数え続ける
        rushCount = highBase ? rushCount + 1 : 1;
        if (eff.kind === "r10") {
          isST = true;
          bonusBall = 1400;
          addLog(">> 全回転！！");
        } else if (eff.kind === "k3") {
          isST = true;
          bonusBall = 420;
          needsUpgrade = eff.upgrade;
          // 暴走図柄（1・3・5）で止まった当りは暴走ボーナス
          if (eff.bosoShown) addLog(">> 暴走ボーナス！！（確変濃厚）");
        } else {
          isST = false;
          bonusBall = 420;
          if (highBase) jitanCount = EVA_JT_HIGHBASE;
        }
        // ヘソ当りは R 数を液晶とログに出す（確変か通常かは昇格演出で見せる）
        addLog(`>> ヘソ当り ${rounds}R`);
        const ov = document.getElementById("effect-overlay");
        if (ov) {
          ov.innerText = `${rounds} ROUND`;
          ov.style.display = "block";
        }
      } else {
        isST = true;
        bonusBall = 1400;
        isRightUpgrade = true;
        if (eff.bosoShown) addLog(">> 暴走ボーナス！！（確変濃厚）");
        if (mode === "通常") {
          rushCount = 1;
          addLog(`>> 右打ち残保留（特図2）で引き戻し！！ 【${originalHit}】`);
        } else if (mode === "時短") {
          addLog(`>> 時短引き戻し成功！ 【${originalHit}】`);
        } else {
          rushCount++;
        }
      }
      addLog(`>> 当たり！ 【${originalHit}】${lcdCount}回転`);
      totalBall += bonusBall;
      currentRot = 0;
      // 次のモードの確率で残保留を判定し直し、当りがあれば V ストック（保留連確定）を示唆する
      rejudgeStocks(isST ? "s" : "n");
      const vStockEl = document.getElementById("v-stock");
      const hasStockHit = [...rightStock, ...leftStock].some(
        (job) => job.isHit,
      );
      if (hasStockHit) {
        if (vStockEl) vStockEl.style.display = "block";
        addLog(">> Vストック獲得！！（保留連確定）");
      }
      await new Promise((r) => setTimeout(r, 1000));
      const hitOv = document.getElementById("effect-overlay");
      if (hitOv) hitOv.style.display = "none";
      if (prevMode === "通常" && needsUpgrade) {
        let nextOdd = [1, 3, 5, 9][Math.floor(Math.random() * 4)];
        addLog(`>> ${nextOdd}図柄へ昇格！！`);
        document.getElementById("lamp").classList.add("lamp-active");
        evaShowTriple(nextOdd, "digit odd");
        await new Promise((r) => setTimeout(r, 800));
        document.getElementById("lamp").classList.remove("lamp-active");
      }
      if (isRightUpgrade) {
        const machineEl = document.getElementById("machine");
        machineEl.classList.add("vibe-rainbow");
        document.getElementById("lamp").classList.add("lamp-active");
        evaShowTriple(7, "digit gold");
        await new Promise((r) => setTimeout(r, 1000));
        machineEl.classList.remove("vibe-rainbow");
        document.getElementById("lamp").classList.remove("lamp-active");
      }
      if (isST) {
        mode = "ST";
        rRem = SPECS.st;
      } else {
        mode = "時短";
        rRem = jitanCount;
        if (jitanCount !== SPECS.jt) {
          addLog(`>> 電サポ中のヘソ通常当り：時短${jitanCount}回＋残保留`);
        }
      }
      currentRushHits++;
      lcdCount = 0;
      updateUI();
      await new Promise((r) => setTimeout(r, 600));
    },
  },

  rezero: {
    title: "Re:ゼロ Sim -season2-",
    theme: "theme-rezero",
    specs: {
      n: oddsFromBands(REZERO_BANDS_N),
      s: oddsFromBands(REZERO_BANDS_S),
      st: 145,
      jt: 0,
    },
    type: "MIXED",
    bands: { n: REZERO_BANDS_N, s: REZERO_BANDS_S },
    modeLabel(m) {
      return m === "ST" ? rushStyle : m;
    },
    // RUSH中の当りは帯抽選で「継続確定」までしか決まらないため、
    // ボーナス階級（300/1500/3000）はここで別途抽選する。
    pickRushBonus() {
      const rMain = Math.random() * 100;
      if (rushStyle === "強欲RUSH") {
        if (rMain < 25) {
          return {
            bonusType: 3000,
            name: "超強欲3000BONUS",
            vibe: true,
            vibeColor: "rainbow",
            text: "3000+",
          };
        } else if (rMain < 80) {
          return { bonusType: 1500, name: "Re:ゼロBONUS" };
        }
        return { bonusType: 300, name: "BONUS" };
      }
      if (rMain < 25) {
        return {
          bonusType: 3000,
          name: "ドナぷる",
          vibe: true,
          vibeColor: "red",
        };
      } else if (rMain < 80) {
        return { bonusType: 1500, name: "落ちブル", text: "落ちブル" };
      }
      return { bonusType: 300, name: "エミリア告知" };
    },
    postDraw(res, currentMode) {
      if (currentMode === "通常" || !res.isHit) return;
      const b = this.pickRushBonus();
      res.bonusType = b.bonusType;
      res.deferHitLog = true;
      res.name = [b.name];
      res.vibe = b.vibe || false;
      res.vibeColor = b.vibeColor || "none";
      res.text = b.text || "";
      res.trust = 100;
    },
    async resolveHit(ctx) {
      const { eff, hitDigit } = ctx;
      let bonusBall = 0;
      let rushBonus = 0;
      if (!eff.isRight) {
        // 通常時初当り（特図1）: 55%でRUSH、45%で通常へ戻る。
        rushCount = 1;
        addLog(`>> 大兎殲滅戦BONUS！ 【${hitDigit}】${lcdCount}回転`);
        await new Promise((r) => setTimeout(r, 1000));
        if (Math.random() < 0.55) {
          bonusBall = 3000;
          addLog(">> ジャッジ成功！！ RUSH突入！");
          while (Math.random() < 0.25) {
            rushBonus += 1500;
            addLog(">> 超強欲フリーズ！！ +1500上乗せ！");
          }
          bonusBall += rushBonus;
          document.getElementById("machine").classList.add("vibe-rainbow");
          document.getElementById("lamp").classList.add("lamp-active");
          await new Promise((r) => setTimeout(r, 800));
          document.getElementById("machine").classList.remove("vibe-rainbow");
          document.getElementById("lamp").classList.remove("lamp-active");
          addLog(`>> 出玉: ${bonusBall}個`);
          totalBall += bonusBall;
          currentRot = 0;
          mode = "ST";
          rRem = SPECS.st;
          currentRushHits++;
        } else {
          bonusBall = 1500;
          addLog(`>> ジャッジ失敗… 通常へ 出玉: ${bonusBall}個`);
          totalBall += bonusBall;
          currentRot = 0;
          mode = "通常";
          rRem = 0;
          recordInitialHitHistory("通常");
        }
        lcdCount = 0;
        updateUI();
        await new Promise((r) => setTimeout(r, 600));
      } else {
        // RUSH中当り（特図2）: 25%/55%/20%、当選後は145回へ戻す。
        addLog(
          `${M.modeLabel(mode)} ${lcdCount}回転【${eff.displayName}】信頼度:${eff.trust.toFixed(1)}%`,
        );
        if (eff.bonusType === 3000) {
          bonusBall = 3000;
          if (rushStyle === "強欲RUSH") {
            addLog(">> 超強欲3000BONUS！！");
          } else {
            addLog(">> ドナぷる発生！ 3000BONUS！！");
          }
          document.getElementById("machine").classList.add("vibe-rainbow");
          document.getElementById("lamp").classList.add("lamp-active");
          [1, 2, 3].forEach((i) => {
            const el = document.getElementById("d" + i);
            el.innerText = hitDigit;
            el.className = "digit gold";
          });
          await new Promise((resolve) => setTimeout(resolve, 1000));
          while (Math.random() < 0.25) {
            rushBonus += 1500;
            addLog(">> 超強欲フリーズ！！ +1500上乗せ！");
            await showFreezeBonus();
          }
          bonusBall += rushBonus;
          document.getElementById("machine").classList.remove("vibe-rainbow");
          document.getElementById("lamp").classList.remove("lamp-active");
          addLog(`>> 出玉: ${bonusBall}個 RUSH継続！`);
        } else if (eff.bonusType === 1500) {
          bonusBall = 1500;
          addLog(`>> Re:ゼロBONUS！ 出玉: ${bonusBall}個 RUSH継続！`);
        } else {
          bonusBall = 300;
          addLog(`>> BONUS 出玉: ${bonusBall}個 RUSH継続！`);
        }
        totalBall += bonusBall;
        currentRot = 0;
        rushCount++;
        mode = "ST";
        rRem = SPECS.st;
        currentRushHits++;
        lcdCount = 0;
        updateUI();
        await new Promise((resolve) => setTimeout(resolve, POST_BONUS_HOLD_MS));
      }
    },
  },
};

// ============================================================
// グローバル状態
// ============================================================
let currentMachine = "eva"; // 初期状態はエヴァ15風（ユーザー方針 2026-10-03）
let M = MACHINES[currentMachine];
let SPECS = M.specs;
let rushStyle = "強欲RUSH";

let hits = 0,
  rushCount = 0,
  currentRot = 0,
  totalRot = 0,
  totalBall = 0,
  currentRushHits = 0,
  maxHamari = 0;
let mode = "通常",
  rRem = 0,
  isAuto = false,
  autoSpeed = "slow",
  isAnim = false;
let lcdCount = 0,
  optSaibare = false;
let leftStock = [],
  rightStock = [];
let activeJob = null;
let slumpData = [0],
  slumpLabels = ["0"],
  historyData = [],
  historyLabels = [];
let sChart,
  hChart,
  firstHitRot = 0,
  initialHitCount = 0,
  activeInitialHitNumber = 0,
  rushStartBall = 0;

function recordInitialHitHistory(resultLabel) {
  if (activeInitialHitNumber <= 0) return;
  historyData.push(firstHitRot);
  historyLabels.push(
    `${activeInitialHitNumber} - ${firstHitRot}回転（${resultLabel}）`,
  );
  hChart.update();
  firstHitRot = 0;
  activeInitialHitNumber = 0;
}

function normalRotationAfterModeEnd(endedMode) {
  if (endedMode === "ST") {
    return Math.max(0, currentRot - SPECS.st);
  }
  return currentRot;
}

// ============================================================
// 抽選フロー：信頼度帯（またはEVA通常時は演出軸）を1回引き、
// 当落・信頼度・演出を同時に確定
// ============================================================
function buildResFromBand(band, isHit, isRight) {
  const effects = band.effects;
  return {
    isHit,
    isRight,
    heavy: false,
    name: [...(effects.name || [])],
    trust: band.trust,
    vibe: effects.vibe || false,
    vibeColor: effects.vibeColor || "none",
    flash: effects.flash || false,
    text: effects.text || "",
    holdType: effects.holdType || "none",
    currentView: "none",
    isRushSure: effects.isRushSure || false,
    bonusType: effects.bonusType || null,
    deferHitLog: effects.deferHitLog || false,
    saibare: false,
  };
}

// regimeOverride：確率の状態を指定して抽選する（大当り中に、次のモードの確率で残保留を判定し直すとき）
function createJob(isRight = false, regimeOverride) {
  const regime =
    regimeOverride || (mode === "通常" || mode === "時短" ? "n" : "s");
  let res;
  if (currentMachine === "eva") {
    res = createEvaJob(isRight, regime);
  } else {
    const bands = M.bands[regime];
    const { band, isHit } = drawBand(bands);
    res = buildResFromBand(band, isHit, isRight);
    if (M.postDraw) M.postDraw(res, mode);
    // 保留の見た目決定（EVA-ST/リゼロの帯方式では色そのものに厳密な信頼度を割り当てていないため従来ロジックを維持）
    if (currentMachine === "rezero") {
      res.currentView = "none";
    } else if (res.holdType === "red" || (res.vibe && !res.isRushSure)) {
      let rr = Math.random();
      res.currentView = rr < 0.4 ? "blue" : rr < 0.8 ? "green" : "red";
    } else if (res.holdType === "vibe") {
      res.currentView = "vibe";
    } else {
      res.currentView = res.holdType;
    }
  }

  if (currentMachine === "rezero" && optSaibare && mode === "通常") {
    const saibareRate = res.isHit
      ? REZERO_SAIBARE_HIT_RATE
      : missRateForTrust(
          REZERO_SAIBARE_HIT_RATE,
          REZERO_SAIBARE_TRUST,
          SPECS.n,
        );
    if (Math.random() < saibareRate) {
      res.saibare = true;
      res.flash = true;
      res.vibe = true;
      res.vibeColor = "red";
    }
  }

  res.heavy = res.trust >= 50 || res.saibare || !!res.sure;
  res.displayName =
    Array.from(new Set(res.name)).join("+").replace(/ST/g, "") || "通常";
  return res;
}

// 保留は入賞時に抽選しているため、消化するときに確率状態（通常/ST）が変わっていたら
// その時点の確率で抽選し直す（実機も当否は変動開始時の確率で決まる）。
// ST 終了後の残保留の引き戻しが ST 確率のまま（約3.96%）になるのを防ぐ（実機 約1.2%）
function refreshStaleJob(job) {
  if (!job || currentMachine !== "eva") return job;
  const regimeNow = mode === "通常" || mode === "時短" ? "n" : "s";
  return job.regime === regimeNow
    ? job
    : carryHold(job, createJob(job.isRight));
}

// 作り直した保留の見た目：保留の種類が同じなら、変化の途中経過をそのまま引き継ぐ
// （赤だった保留が一度無地に戻ってまた赤になるのを防ぐ）
function carryHold(oldJob, newJob) {
  if (oldJob.holdType === newJob.holdType && oldJob.holdSeq) {
    newJob.holdSeq = oldJob.holdSeq;
    newJob.holdWhen = oldJob.holdWhen;
    newJob.holdStep = oldJob.holdStep;
    newJob.currentView = oldJob.currentView;
  }
  return newJob;
}

// --- EVA の変化保留（eva-engine.js の evaHoldPlan で決めた流れを見せる） ---
const HOLD_ANIM_MS = 650; // 横回転・槍のアニメの長さ
const HOLD_STOCK_STEP_RATE = 0.5; // 先読み：変動が始まるたびに 1 段進む確率

// 保留の色を 1 段進める。anim：横回転か槍のアニメを付ける
function stepHold(job, anim) {
  const st = job.holdSeq && job.holdSeq[job.holdStep];
  if (!st) return false;
  job.holdStep++;
  const apply = () => {
    if (job.currentView === "gone") return; // SP 発展で消えた後は変えない
    job.currentView = st.view;
    if (anim) {
      job.holdAnim = st.fx;
      const token = (job.holdAnimToken = (job.holdAnimToken || 0) + 1);
      setTimeout(() => {
        if (job.holdAnimToken !== token) return;
        job.holdAnim = null;
        updateHesoUI();
      }, HOLD_ANIM_MS);
    } else {
      job.holdAnim = null;
    }
    updateHesoUI();
  };
  // 槍の変化は液晶全体の槍演出を出し、槍が刺さった瞬間に色を変える（実機の録画と同じ流れ）。
  // ST 中の横回転の変化は、液晶いっぱいに「変化」の立方体が回ってから色を変える
  if (anim && st.fx === "lance") {
    playLanceStage();
    setTimeout(apply, HOLD_LANCE_HIT_MS);
  } else if (anim && st.fx === "spin" && useChangeStage()) {
    playChangeStage();
    setTimeout(apply, HOLD_CHANGE_HIT_MS);
  } else {
    apply();
  }
  return true;
}

// 段 1 つにかかる時間（当該で続けて変えるとき、前の演出が終わってから次を出す）
function holdStepMs(st) {
  if (st.fx === "lance") return HOLD_LANCE_STAGE_MS;
  if (st.fx === "spin" && useChangeStage()) return HOLD_CHANGE_STAGE_MS;
  return HOLD_ANIM_MS;
}

// 液晶全体の「変化」立方体：ST 中の保留変化（実機の録画どおり）
const HOLD_CHANGE_STAGE_MS = 1000; // 演出全体の長さ（style.css の .change-stage と合わせる）
const HOLD_CHANGE_HIT_MS = 800; // 立方体が回りきって保留の色が変わるまで
function useChangeStage() {
  return currentMachine === "eva" && mode === "ST";
}
function playChangeStage() {
  const screen = document.getElementById("screen");
  if (!screen) return;
  let stage = document.getElementById("change-stage");
  if (!stage) {
    stage = document.createElement("div");
    stage.id = "change-stage";
    stage.className = "change-stage";
    const face = (cls, t) => `<div class="cs-face ${cls}">${t}</div>`;
    stage.innerHTML =
      '<div class="cs-cube">' +
      face("cs-front", "変化") +
      face("cs-back", "変化") +
      face("cs-right", "変化") +
      face("cs-left", "変化") +
      face("cs-top", "") +
      face("cs-bottom", "") +
      "</div>";
    screen.appendChild(stage);
  }
  stage.classList.remove("on");
  void stage.offsetWidth;
  stage.classList.add("on");
  const token = (playChangeStage.token = (playChangeStage.token || 0) + 1);
  setTimeout(() => {
    if (playChangeStage.token === token) stage.classList.remove("on");
  }, HOLD_CHANGE_STAGE_MS);
}

// 液晶全体のロンギヌスの槍演出：炎の中を大きな槍が落ちてきて保留に刺さり、閃光が走る
const HOLD_LANCE_STAGE_MS = 1500; // 演出全体の長さ（style.css の .lance-stage と合わせる）
const HOLD_LANCE_HIT_MS = 1000; // 槍が刺さって保留の色が変わるまで
function playLanceStage() {
  const screen = document.getElementById("screen");
  if (!screen) return;
  let stage = document.getElementById("lance-stage");
  if (!stage) {
    stage = document.createElement("div");
    stage.id = "lance-stage";
    stage.className = "lance-stage";
    stage.innerHTML =
      '<div class="ls-fire"></div><div class="ls-spear"></div>' +
      '<div class="ls-flash"></div><div class="ls-text">ロンギヌスの槍</div>';
    screen.appendChild(stage);
  }
  // 続けて出たときもアニメを最初からにする
  stage.classList.remove("on");
  void stage.offsetWidth;
  stage.classList.add("on");
  const token = (playLanceStage.token = (playLanceStage.token || 0) + 1);
  setTimeout(() => {
    if (playLanceStage.token === token) stage.classList.remove("on");
  }, HOLD_LANCE_STAGE_MS);
}

// 当該になった保留の残りの段。高速オートは最後の色をすぐ出す（タイマーを残さない）
function finishHold(job, instant) {
  if (!job || !job.holdSeq) return;
  const rest = job.holdSeq.length - job.holdStep;
  if (rest <= 0) return;
  if (instant) {
    job.holdStep = job.holdSeq.length;
    job.currentView = job.holdSeq[job.holdSeq.length - 1].view;
    job.holdAnim = null;
    updateHesoUI();
    return;
  }
  // 前の段の演出（横回転・変化の立方体・槍）が終わってから次の段を出す
  let at = 0;
  for (let i = job.holdStep; i < job.holdSeq.length; i++) {
    setTimeout(() => stepHold(job, true), at);
    at += holdStepMs(job.holdSeq[i]);
  }
}

// 先読み：保留にいる間、変動が始まるたびに確率で 1 段ずつ変わる
function advanceStockHolds(anim) {
  for (const job of [...leftStock, ...rightStock]) {
    if (job.holdWhen !== "stock" || !job.holdSeq) continue;
    if (job.holdStep >= job.holdSeq.length) continue;
    if (Math.random() < HOLD_STOCK_STEP_RATE) stepHold(job, anim);
  }
}

// 保留を消化したとき、残りの保留が 1 つずつ左（当該の位置）へ詰まるアニメ（style.css の .hold-shift）
const HOLD_SHIFT_MS = 320;
function animateHoldShift(from) {
  const area = document.getElementById(
    from === "right" ? "denchu-area" : "heso-area",
  );
  if (!area) return;
  area.classList.remove("hold-shift");
  void area.offsetWidth; // 続けて消化したときもアニメを最初からにする
  area.classList.add("hold-shift");
  const token = (animateHoldShift.token = (animateHoldShift.token || 0) + 1);
  setTimeout(() => {
    if (animateHoldShift.token === token) area.classList.remove("hold-shift");
  }, HOLD_SHIFT_MS);
}

// SP リーチに発展したら当該保留を消す（次の保留を消化する流れを見せる）
function vanishCurrentHold(job) {
  if (!job || activeJob !== job) return;
  if (job.holdSeq) job.holdStep = job.holdSeq.length; // 残りの変化は打ち切る
  job.holdAnim = null;
  job.currentView = "gone";
  updateHesoUI();
}

// 確率の状態が変わる瞬間（大当りで ST へ・ST/時短の終了で通常へ）に、残保留をその確率で判定し直す。
// 大当り中に残保留の当否が決まるので、V ストック・保留連の示唆が出せる
function rejudgeStocks(regime) {
  if (currentMachine !== "eva") return;
  const fix = (job) =>
    job.regime === regime
      ? job
      : carryHold(job, createJob(job.isRight, regime));
  leftStock = leftStock.map(fix);
  rightStock = rightStock.map(fix);
}

function trustLabel(eff) {
  // 右打ち（ST・時短・残保留）の当りはすべて 10R 確変なので、種別まで書かずに「当り濃厚」とする
  if (eff.sure && eff.isRight) return "当り濃厚";
  return eff.sure ? eff.sure : `信頼度:${eff.trust.toFixed(1)}%`;
}

// ============================================================
// メインループ
// ============================================================
async function startProcess() {
  if (!isAuto || isAnim) return;
  if (mode !== "通常" && rRem <= 0) {
    const endedMode = mode;
    const modeLabel = M.modeLabel(mode);
    const rushNetBall = Math.floor(totalBall - rushStartBall);
    addLog(
      `【${modeLabel}終了】 ${currentRushHits}連 出玉: ${rushNetBall.toLocaleString()}個`,
    );
    recordInitialHitHistory(`${currentRushHits}連`);
    mode = "通常";
    // 残保留は通常の確率で判定し直す（ST 確率のまま消化しない）
    rejudgeStocks("n");
    lcdCount = normalRotationAfterModeEnd(endedMode);
    currentRushHits = 0;
    firstHitRot = 0;
    updateUI();
  }

  let from;
  if (rightStock.length > 0) {
    activeJob = rightStock.shift();
    from = "right";
  } else if (leftStock.length > 0) {
    activeJob = leftStock.shift();
    from = "left";
  } else {
    refillStock();
    from = mode === "通常" ? "left" : "right";
    activeJob = from === "left" ? leftStock.shift() : rightStock.shift();
  }

  activeJob = refreshStaleJob(activeJob);
  // 残りの保留が当該の位置へ詰まる（高速オートは毎回動くと見づらいので省く）
  if (currentMachine === "eva" && autoSpeed !== "fast") animateHoldShift(from);
  // EVA は当該の色を finishHold で変える（変化保留）。他の機種は入賞時の色のまま
  if (activeJob && currentMachine !== "eva")
    activeJob.currentView = activeJob.holdType;
  // 先読みの変化は前から居た保留だけ（入賞した瞬間には変わらない）
  if (currentMachine === "eva") advanceStockHolds(autoSpeed !== "fast");
  refillStock(from);
  updateUI();
  let eff = activeJob;
  totalRot++;
  currentRot++;
  lcdCount++;
  if (mode !== "通常") {
    rRem--;
  }
  if (eff.isRight) {
    totalBall -= 0.05;
  } else {
    totalBall -= 13.8;
  }
  updateCharts();
  if (eff.saibare) {
    addLog(`${M.modeLabel(mode)} ${lcdCount}回転【先バレ】信頼度:40.0%`);
  }
  // trustが50以上（激熱以上）、または当落が確定している場合のみログに出力
  if ((eff.trust >= 50.0 || eff.isHit) && !eff.deferHitLog) {
    const modeLabel = M.modeLabel(mode);
    addLog(
      `${modeLabel} ${lcdCount}回転【${eff.displayName}】${trustLabel(eff)}`,
    );
  }
  const machineEl = document.getElementById("machine"),
    screenEl = document.getElementById("screen");
  if (eff.vibe) {
    machineEl.classList.add("vibrate", "vibe-" + eff.vibeColor);
    screenEl.classList.add("vibrate", "vibe-" + eff.vibeColor);
  }
  const vStockEl = document.getElementById("v-stock");
  if (vStockEl) vStockEl.style.display = "none";
  if (eff.flash) document.getElementById("lamp").classList.add("lamp-active");
  // 演出ごとの液晶の効果（福音エアー・インパクトフラッシュなど。style.css の fx-*）
  const fxClasses = eff.fx || [];
  if (fxClasses.length) screenEl.classList.add(...fxClasses);
  // EVA は演出の文字を回転中に順番に出す（eva-reel.js）。リゼロは今どおり最初にまとめて出す
  if (eff.text && currentMachine !== "eva") {
    const ov = document.getElementById("effect-overlay");
    ov.innerText = eff.text;
    ov.style.display = "block";
  }
  let currentSpeed = autoSpeed;

  // 消化中(eff) または その次 の変動が信頼度50%以上かチェック
  let hasSakiyomiOrIkiatsu = false;
  let nextJob =
    rightStock.length > 0
      ? rightStock[0]
      : leftStock.length > 0
        ? leftStock[0]
        : null;
  for (let j of [eff, nextJob]) {
    if (j && (j.trust >= 50.0 || j.saibare || j.sure)) {
      hasSakiyomiOrIkiatsu = true;
      break;
    }
  }

  // 高速オート中、先読み演出または激アツが来た場合はそのタイミングで低速にする
  if (autoSpeed === "fast" && hasSakiyomiOrIkiatsu) {
    currentSpeed = "slow";
  }

  // スピード調整。高速オート(fast)時は5ms、低速オート・チャンス時(slow)は600ms、激熱(heavy)は1800ms
  let finalNums, hitDigit;
  if (currentMachine === "eva") {
    // EVA は当り種別から図柄を抽選時に決めている（10R=7・3R確変=奇数/昇格用の偶数・3R通常=偶数）。
    // 液晶は通常時・時短中が 3×3（5 ライン）、ST 中が数字 3 つ。左→右→中の順に止める（eva-reel.js）
    const instant = currentSpeed === "fast" && !eff.heavy;
    // 当該で変わる保留（シフト変化・当該変化）と、先読みで変わりきらなかった残り
    finishHold(eff, instant);
    // 保留に居る先読み（カウントダウンの 3→2→1 など）はこの変動のリーチ前に出す
    const leadSteps = takeLeadSteps(eff);
    // 一発告知音：保留を消化した瞬間に鳴らす（インパクトフラッシュ・福音エアーなど）
    if (eff.notice && !instant) evaPlayNotice(eff.notice);
    await evaRunDisplay(eff, {
      instant,
      heavy: eff.heavy,
      steps: [...leadSteps, ...(eff.steps || [])],
      onSp: () => vanishCurrentHold(eff),
    });
    if (eff.isHit) hitDigit = eff.bosoShown ? "1・3・5" : eff.hitDigit;
  } else {
    await spinPlainDigits(eff, currentSpeed);
  }
  if (currentMachine === "eva") {
    // 図柄はリールで表示済み
  } else if (eff.isHit) {
    if (eff.isRushSure && (mode === "通常" || mode === "時短")) {
      hitDigit = [1, 3, 5, 9][Math.floor(Math.random() * 4)];
    } else {
      let rand = Math.random() * 100;
      if (mode === "通常" || mode === "時短") {
        // プレミア演出(isRushSure、全hit中約9.96%)も56%の枠内に含めた上で
        // 全体が全回転3%・ST突入56%(内20%が偶数図柄からの昇格)・時短41%になるよう
        // 非プレミア母集団(残り約90.04%)向けに調整した閾値
        if (rand < 3.332) hitDigit = 7;
        else if (rand < 60.248) {
          hitDigit = [2, 4, 6, 8][Math.floor(Math.random() * 4)];
        } else {
          hitDigit = [1, 3, 5, 9][Math.floor(Math.random() * 4)];
        }
      } else {
        hitDigit = Math.random() < 0.5 ? 3 : 1;
      }
    }
    finalNums = [hitDigit, hitDigit, hitDigit];
  } else {
    finalNums = generateFinalDigits();
  }
  if (currentMachine !== "eva") {
    [1, 3, 2].forEach((i) => {
      const el = document.getElementById("d" + i);
      el.innerText = finalNums[i - 1];
      el.className = getDigitClass(finalNums[i - 1], mode);
    });
  }
  machineEl.classList.remove(
    "vibrate",
    "vibe-white",
    "vibe-red",
    "vibe-rainbow",
  );
  screenEl.classList.remove(
    "vibrate",
    "vibe-white",
    "vibe-red",
    "vibe-rainbow",
    ...fxClasses,
  );
  document.getElementById("lamp").classList.remove("lamp-active");
  document.getElementById("effect-overlay").style.display = "none";
  if (eff.isHit) {
    isAnim = true;
    hits++;
    if (mode === "通常") {
      initialHitCount++;
      activeInitialHitNumber = initialHitCount;
      firstHitRot = lcdCount;
      rushStartBall = totalBall;
      if (currentRot > maxHamari) {
        maxHamari = currentRot;
        document.getElementById("max-hamari-box").innerText =
          `最大ハマリ: ${maxHamari}`;
      }
    }
    await M.resolveHit({ eff, hitDigit });
  }
  isAnim = false;
  updateUI();
  updateAutoBtns();
  // 次回転への待機時間（高速時は5ms、低速時は図柄が止まってから0.5秒）
  let nextDelay = currentSpeed === "fast" ? 5 : 500;
  if (isAuto) setTimeout(startProcess, nextDelay);
}

// ============================================================
// ユーティリティ
// ============================================================
// リゼロ機の回転（3 つの数字を同時に回して同時に止める従来の表示）
async function spinPlainDigits(eff, currentSpeed) {
  // 高速オート(fast)時は5ms、低速オート・チャンス時(slow)は600ms、激熱(heavy)は1800ms
  const spinTime = eff.heavy ? 1800 : currentSpeed === "fast" ? 5 : 600;
  const spinInterval = currentSpeed === "fast" ? 5 : 40;
  const spin = setInterval(() => {
    [1, 2, 3].forEach((i) => {
      const n = Math.floor(Math.random() * 9) + 1;
      const el = document.getElementById("d" + i);
      el.innerText = n;
      el.className = getDigitClass(n, mode);
    });
  }, spinInterval);
  await new Promise((r) => setTimeout(r, spinTime));
  clearInterval(spin);
}

// 機種に合わせて待機中の図柄を出す（EVA はリール、リゼロは数字だけ）
function renderIdleDigits() {
  const nums = [3, 5, 7];
  if (currentMachine === "eva") {
    evaDisplayIdle();
    return;
  }
  [1, 2, 3].forEach((i) => {
    const el = document.getElementById("d" + i);
    el.innerText = nums[i - 1];
    el.className = getDigitClass(nums[i - 1], "通常");
  });
}

function getDigitClass(num, currentMode) {
  if (num === 7 && currentMode !== "通常") return "digit gold";
  return num % 2 !== 0 ? "digit odd" : "digit even";
}

function generateFinalDigits() {
  let d1 = Math.floor(Math.random() * 9) + 1;
  let d3 = Math.floor(Math.random() * 9) + 1;
  let d2 = Math.floor(Math.random() * 9) + 1;
  if (Math.random() < 0.25) {
    d3 = d1;
    while (d2 === d1) d2 = Math.floor(Math.random() * 9) + 1;
  } else {
    while (d1 === d3) d3 = Math.floor(Math.random() * 9) + 1;
  }
  if (d1 === d2 && d2 === d3) return generateFinalDigits();
  return [d1, d2, d3];
}

// 保留は少しずつ溜まる（いきなり 4 個そろうのは不自然なため）：
//   通常時：1 回転消化するたびに平均 1.5 個（5 割で 2 個）
//   右打ち中：ヘソ保留を 1 個消化する間に右は 2 個、右を 1 個消化すると平均 1.2 個（2 割で 2 個）
// どちらも上限 4 個。保留が 1 つも無いときは回せるように 1 個入れる
const LEFT_REFILL_EXTRA_RATE = 0.5;
const RIGHT_REFILL_FROM_LEFT = 2;
const RIGHT_REFILL_EXTRA_RATE = 0.2;

// from：直前に消化した保留（"left" / "right"。消化していないときは省く）
function refillStock(from) {
  const isLeft = mode === "通常";
  const stock = isLeft ? leftStock : rightStock;
  let add;
  if (isLeft) add = from ? (Math.random() < LEFT_REFILL_EXTRA_RATE ? 2 : 1) : 0;
  else
    add =
      from === "left"
        ? RIGHT_REFILL_FROM_LEFT
        : from === "right"
          ? Math.random() < RIGHT_REFILL_EXTRA_RATE
            ? 2
            : 1
          : 0;
  if (!add && !rightStock.length && !leftStock.length) add = 1;
  while (add-- > 0 && stock.length < 4) {
    const job = createJob(!isLeft);
    // 入賞したこの変動から、消化されるまでの変動に先読みの段を割り振る
    scheduleLeads(job, stock.length + 1);
    stock.push(job);
    slowDownForSakiyomi(job);
  }
  updateHesoUI();
}

// 先読みの段（eva-engine.js の leads）を、入賞した変動から当該の手前までの count 変動に割り振る。
//   入賞時の演出（kind "entry"）：入賞した変動だけ
//   前兆（kind "pre"）：当該の手前へ詰めて並べる（カウントダウンは 3→2→1 の後ろから、他は最大 2 変動繰り返す）
// 当該では前兆の最後の段（カウントダウンの 0 など）を当該の演出として出す
const LEAD_REPEAT_MAX = 2;
function scheduleLeads(job, count) {
  if (!job.leads || !job.leads.length || count <= 0) return;
  const plan = Array.from({ length: count }, () => []);
  for (const l of job.leads) {
    const step = (text) => ({
      phase: "pre",
      text,
      color: l.color,
      voice: l.kind === "entry" ? l.voice : null,
    });
    if (l.kind === "entry") {
      plan[0].push(step(l.text));
      continue;
    }
    const seq = l.seq || Array(Math.min(count, LEAD_REPEAT_MAX)).fill(l.text);
    const use = seq.slice(-count);
    use.forEach((t, i) => plan[count - use.length + i].push(step(t)));
  }
  job.leadPlan = plan;
}

// この変動に出す先読みの段：当該に残った分（入賞してすぐ消化した保留など）と、保留の順に 1 段ずつ
function takeLeadSteps(current) {
  const out = [];
  if (current && current.leadPlan) {
    for (const s of current.leadPlan) out.push(...s);
    current.leadPlan = null;
  }
  for (const job of [...rightStock, ...leftStock]) {
    if (job.leadPlan && job.leadPlan.length) out.push(...job.leadPlan.shift());
  }
  return out;
}

// 高速オート中に当りの保留が入ったら低速オートに切り替える
// （当りまでの保留の先読み・保留変化を見せるため。ユーザー方針 2026-10-03「当たりの保留が入ったら低速オートに」）
function slowDownForSakiyomi(job) {
  if (currentMachine !== "eva" || !isAuto || autoSpeed !== "fast") return;
  if (!job.isHit) return;
  autoSpeed = "slow";
  updateAutoBtns();
  addLog("低速オートに切り替えました");
}

function updateHesoUI() {
  const isRightMode = mode !== "通常";
  const hesoArea = document.getElementById("heso-area");
  const denchuArea = document.getElementById("denchu-area");
  if (isRightMode) {
    if (hesoArea) hesoArea.style.display = "none";
    if (denchuArea) {
      denchuArea.style.display = "flex";
      // EVA の時短中は右打ちの保留も通常時と同じ位置・同じ見た目で出す（ST 中だけ右側の縦並び）
      denchuArea.classList.toggle(
        "right-mode",
        currentMachine !== "eva" || mode === "ST",
      );
    }
  } else {
    if (hesoArea) hesoArea.style.display = "flex";
    if (denchuArea) denchuArea.style.display = "none";
  }
  const countDisplay = document.getElementById("stock-count-display");
  if (countDisplay) {
    countDisplay.innerText = `${leftStock.length} / ${rightStock.length}`;
  }
  for (let i = 0; i <= 4; i++) {
    const el = document.getElementById("h" + i);
    if (!el) continue;
    let s =
      i === 0
        ? activeJob && !activeJob.isRight
          ? activeJob
          : null
        : leftStock[i - 1] || null;
    paintHold(el, s, i === 0);
  }
  for (let i = 0; i <= 4; i++) {
    const el = document.getElementById("d_h" + i);
    if (!el) continue;
    let s =
      i === 0
        ? activeJob && activeJob.isRight
          ? activeJob
          : null
        : rightStock[i - 1] || null;
    paintHold(el, s, i === 0);
  }
}

// 保留 1 つの見た目。変化中は横回転（「変化」の文字）・槍が刺さった閃光のクラスを付ける
// （槍そのものは液晶全体の playLanceStage で出す）
function paintHold(el, job, isCurrent) {
  el.className = `heso-ball ${isCurrent ? "heso-current" : ""}`;
  if (job) {
    el.classList.add("heso-" + job.currentView);
    if (job.holdAnim) el.classList.add("heso-anim-" + job.holdAnim);
  }
}

function toggleAuto(s) {
  if (isAuto && autoSpeed === s) {
    isAuto = false;
  } else {
    isAuto = true;
    autoSpeed = s;
    if (!isAnim) startProcess();
  }
  updateAutoBtns();
}

function updateAutoBtns() {
  document
    .getElementById("btn-slow")
    .classList.toggle("btn-stop", isAuto && autoSpeed === "slow");
  document
    .getElementById("btn-fast")
    .classList.toggle("btn-stop", isAuto && autoSpeed === "fast");
}

function toggleOpt(t) {
  if (t === "saibare") optSaibare = !optSaibare;
  document.getElementById("btn-" + t).classList.toggle("active");
}

function updateUI() {
  document.getElementById("hits").innerText = hits;
  document.getElementById("rush-count").innerText = rushCount;
  document.getElementById("current-rot").innerText = currentRot;
  document.getElementById("total-rot").innerText = totalRot;
  document.getElementById("balance").innerText =
    Math.floor(totalBall).toLocaleString();
  const modeLabel = M.modeLabel(mode);
  document.getElementById("sub-display").innerText =
    mode === "通常" ? `通常:${lcdCount}` : `${modeLabel}:${rRem}`;
  updateHesoUI();
}

// ログは下に足していき、いちばん下（新しい行）が見えるようにする
function addLog(m) {
  const l = document.getElementById("log");
  l.innerHTML = `${l.innerHTML}<br>> ${m}`;
  l.scrollTop = l.scrollHeight;
}

// ============================================================
// チャート
// ============================================================
function initCharts() {
  const accentColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim() || "#8a2be2";
  sChart = new Chart(document.getElementById("slumpChart").getContext("2d"), {
    type: "line",
    data: {
      labels: slumpLabels,
      datasets: [
        {
          label: "差玉",
          data: slumpData,
          borderColor: accentColor,
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
  hChart = new Chart(document.getElementById("historyChart").getContext("2d"), {
    type: "bar",
    data: {
      labels: historyLabels,
      datasets: [
        {
          label: "初当り回転",
          data: historyData,
          backgroundColor: "#ff4444",
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

function updateCharts() {
  slumpData.push(totalBall);
  slumpLabels.push(totalRot.toString());
  sChart.update("none");
}

// ============================================================
// モーダル操作
// ============================================================
function openModal() {
  document.getElementById("modal-overlay").style.display = "flex";
}

function closeModal() {
  document.getElementById("modal-overlay").style.display = "none";
}

function openMachineModal() {
  // アクティブ機種のボタンを強調
  document.querySelectorAll(".machine-select-btn").forEach((btn) => {
    btn.classList.toggle(
      "active-machine",
      btn.dataset.machine === currentMachine,
    );
  });
  document.getElementById("machine-modal-overlay").style.display = "flex";
}

function closeMachineModal() {
  document.getElementById("machine-modal-overlay").style.display = "none";
}

// ============================================================
// 機種切替
// ============================================================
function selectMachine(id) {
  if (!MACHINES[id]) return;
  currentMachine = id;
  M = MACHINES[id];
  SPECS = M.specs;
  // テーマ切替
  document.body.classList.remove("theme-eva", "theme-rezero");
  document.body.classList.add(M.theme);
  // タイトル更新
  document.title = M.title;
  // データリセット
  resetState();
  closeMachineModal();
}

// ============================================================
// データリセット
// ============================================================
function resetState() {
  isAuto = false;
  isAnim = false;
  hits = 0;
  rushCount = 0;
  currentRot = 0;
  totalRot = 0;
  totalBall = 0;
  currentRushHits = 0;
  maxHamari = 0;
  mode = "通常";
  rRem = 0;
  lcdCount = 0;
  optSaibare = false;
  rushStyle = "強欲RUSH";
  leftStock = [];
  rightStock = [];
  activeJob = null;
  slumpData = [0];
  slumpLabels = ["0"];
  historyData = [];
  historyLabels = [];
  initialHitCount = 0;
  activeInitialHitNumber = 0;
  firstHitRot = 0;
  rushStartBall = 0;
  document.getElementById("max-hamari-box").innerText = "最大ハマリ: 0";
  document.getElementById("log").innerHTML = "> システム起動完了";
  renderIdleDigits();
  const freezeOverlay = document.getElementById("freeze-bonus-overlay");
  if (freezeOverlay) {
    freezeOverlay.classList.remove("freeze-bonus-active");
    freezeOverlay.style.display = "none";
  }
  const saibareBtn = document.getElementById("btn-saibare");
  if (saibareBtn) saibareBtn.classList.remove("active");
  // チャート再構築（テーマ色も反映）
  if (sChart) sChart.destroy();
  if (hChart) hChart.destroy();
  initCharts();
  updateAutoBtns();
  // 保留はオートを押してから溜める（起動・リセット直後は空）
  updateHesoUI();
  updateUI();
}

function resetData() {
  if (confirm("データをリセットしますか？")) resetState();
}

// ============================================================
// ダークモード・ライトモード切り替え
// ============================================================
function toggleTheme() {
  const body = document.body;
  const btn = document.getElementById("btn-theme");
  body.classList.toggle("light-mode");
  btn.innerText = body.classList.contains("light-mode")
    ? "ダーク🌙"
    : "ライト☀️";
}

window.onload = () => {
  document.body.classList.add(M.theme);
  document.title = M.title;
  initCharts();
  renderIdleDigits();
  // 保留はオートを押してから溜める（起動直後は空）
  updateHesoUI();
  updateUI();
};

// 起動直後から通常時の図柄を出す（グラフのライブラリの読み込みを待つ window.onload より前。
// script.js は body の最後で読むので液晶の要素はもうある）
if (document.getElementById("d1")) renderIdleDigits();
