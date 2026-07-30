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
  return (
    (hitProbability * hitRate * (1 - trust)) / (trust * missProbability)
  );
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

// --- EVA機 通常/時短 演出軸（2^16=65536, 当り205本 → 1/319.688） ---
// 「保留色・背景予告・カウントダウン・群予告・レバブル・リーチ」は互いに独立した軸として
// それぞれ個別にBayes整合の整数カウントを持つ。1回転につき各軸を独立抽選するため、
// 複数の軸が同時に発火すれば自然に複合演出（例：レイ背景＋赤保留＋赤レバブル）になる。
// リーチ演出のみ軸内が排他（1回転で1種類のみ）。各軸の信頼度は他の軸の結果に一切依存しないため、
// 何個重なっても軸ごとのΣhit=205・Σ(hit+miss)=65536は不変＝当り確率と信頼度表示の矛盾が起きない。
const EVA_BIT_N = 65536;
const EVA_HIT_N = 205; // 通常/時短 1/319.688
const EVA_HIT_S = 659; // ST 1/99.448（ビット幅はEVA_BIT_Nと共通）
function finalizeAxis(hitBudget, bitTotal, states) {
  const hitUsed = states.reduce((s, x) => s + x.hit, 0);
  const missUsed = states.reduce((s, x) => s + x.miss, 0);
  const none = {
    name: "なし",
    hit: hitBudget - hitUsed,
    miss: bitTotal - hitBudget - missUsed,
  };
  return [...states, none].map((s) => ({
    ...s,
    trust: (s.hit / (s.hit + s.miss)) * 100,
  }));
}
function drawAxisComposite(axes, hitTotal, grandTotal) {
  const missTotal = grandTotal - hitTotal;
  const isHit = Math.floor(Math.random() * grandTotal) < hitTotal;
  const picks = {};
  for (const key of Object.keys(axes)) {
    const states = axes[key];
    let r = Math.floor(Math.random() * (isHit ? hitTotal : missTotal));
    let chosen = states[states.length - 1];
    for (const s of states) {
      const span = isHit ? s.hit : s.miss;
      if (r < span) {
        chosen = s;
        break;
      }
      r -= span;
    }
    picks[key] = chosen;
  }
  return { isHit, picks };
}
// --- 通常/時短（EVA_HIT_N=205） ---
// 保留色：赤90%・緑20%・青5%（「レバブル保留」は独立状態を持たず、
// 保留なし×レバブル独立発生の組み合わせ時にcreateEvaJob側で表示のみ格上げする。
// これにより赤/緑/青の信頼度は一切歪まず、レバブル保留の表示信頼度は
// 常にレバブル自身の信頼度と一致する＝逆算不要で確実に一致する）
const EVA_AXIS_HOLD_N = finalizeAxis(EVA_HIT_N, EVA_BIT_N, [
  { name: "赤保留", hit: 90, miss: 10, holdType: "red" },
  { name: "緑保留", hit: 40, miss: 160, holdType: "green" },
  { name: "青保留", hit: 10, miss: 190, holdType: "blue" },
]);
// レバブル：全大当りの約66.7%に絡む。出現数は白＞赤＞虹の順（液晶が揺れるのはレバブル発生時のみ）
const EVA_AXIS_LEVER_N = finalizeAxis(EVA_HIT_N, EVA_BIT_N, [
  { name: "白レバブル", hit: 90, miss: 10, vibe: true, vibeColor: "white" },
  { name: "赤レバブル", hit: 40, miss: 1, vibe: true, vibeColor: "red" },
  {
    name: "虹レバブル",
    hit: 7,
    miss: 0,
    vibe: true,
    vibeColor: "rainbow",
    isRushSure: true,
  },
]);
// 背景予告：レイ背景85%・プレミア背景/渚カヲルは100%＆ST確定
const EVA_AXIS_BG_N = finalizeAxis(EVA_HIT_N, EVA_BIT_N, [
  { name: "レイ背景", hit: 34, miss: 6, text: "レイ背景" },
  {
    name: "プレミア背景",
    hit: 6,
    miss: 0,
    text: "警報プレミア",
    isRushSure: true,
  },
  {
    name: "渚カヲル",
    hit: 6,
    miss: 0,
    text: "来なさい",
    isRushSure: true,
  },
]);
// 先読み予告（カウントダウンを内包）：通常回転数400以下では群予告は出現しない
const EVA_AXIS_PRECURSOR_N_LOW = finalizeAxis(EVA_HIT_N, EVA_BIT_N, [
  { name: "カウントダウン", hit: 26, miss: 14, text: "３２１０" },
]);
const EVA_AXIS_PRECURSOR_N_HIGH = finalizeAxis(EVA_HIT_N, EVA_BIT_N, [
  { name: "カウントダウン", hit: 26, miss: 14, text: "３２１０" },
  { name: "群予告", hit: 15, miss: 5, text: "群予告" },
]);
// リーチ演出（排他）：全回転100%＆ST確定／vsアルミサエル56.8%／vsサハクィエル65.2%／最終号機リーチ70.5%
const EVA_AXIS_REACH_N = finalizeAxis(EVA_HIT_N, EVA_BIT_N, [
  { name: "全回転リーチ", hit: 2, miss: 0, isRushSure: true, text: "祝" },
  { name: "vsアルミサエル", hit: 21, miss: 16 },
  { name: "vsサハクィエル", hit: 15, miss: 8 },
  { name: "最終号機リーチ", hit: 31, miss: 13, text: "最終号機\n画ブレ金" },
]);

// --- ST（EVA_HIT_S=659）：通常時の各信頼度に+25pt（上限100%） ---
// ST中は「なし」の割合をできる限り減らす（各軸を大幅増量。信頼度100%の状態はmiss不要なので
// 制約なく増量できる分、他の状態より優先的に厚くしている）
const EVA_AXIS_HOLD_S = finalizeAxis(EVA_HIT_S, EVA_BIT_N, [
  { name: "赤保留", hit: 300, miss: 0, holdType: "red" }, // 100%
  { name: "緑保留", hit: 200, miss: 244, holdType: "green" }, // 45.0%
  { name: "青保留", hit: 100, miss: 233, holdType: "blue" }, // 30.0%
]);
const EVA_AXIS_LEVER_S = finalizeAxis(EVA_HIT_S, EVA_BIT_N, [
  { name: "白レバブル", hit: 420, miss: 0, vibe: true, vibeColor: "white" },
  { name: "赤レバブル", hit: 180, miss: 0, vibe: true, vibeColor: "red" },
  {
    name: "虹レバブル",
    hit: 50,
    miss: 0,
    vibe: true,
    vibeColor: "rainbow",
    isRushSure: true,
  },
]);
const EVA_AXIS_BG_S = finalizeAxis(EVA_HIT_S, EVA_BIT_N, [
  { name: "レイ背景", hit: 420, miss: 0, text: "レイ背景" },
  { name: "プレミア背景", hit: 120, miss: 0, text: "警報プレミア", isRushSure: true },
  { name: "渚カヲル", hit: 100, miss: 0, text: "来なさい", isRushSure: true },
]);
// STでは400回転ゲートは適用しない（RUSH中は経過回転の意味合いが通常時と異なるため）
const EVA_AXIS_PRECURSOR_S = finalizeAxis(EVA_HIT_S, EVA_BIT_N, [
  { name: "カウントダウン", hit: 420, miss: 47, text: "３２１０" }, // 89.9%
  { name: "群予告", hit: 180, miss: 0, text: "群予告" }, // 100%
]);
const EVA_AXIS_REACH_S = finalizeAxis(EVA_HIT_S, EVA_BIT_N, [
  { name: "全回転リーチ", hit: 32, miss: 0, isRushSure: true, text: "祝" },
  { name: "vsアルミサエル", hit: 180, miss: 40 }, // 81.8%
  { name: "vsサハクィエル", hit: 184, miss: 20 }, // 90.2%
  { name: "最終号機リーチ", hit: 252, miss: 12, text: "最終号機\n画ブレ金" }, // 95.5%
]);

const EVA_AXIS_ORDER = ["hold", "background", "precursor", "lever", "reach"];

function createEvaJob(isRight, regime) {
  const hitBudget = regime === "n" ? EVA_HIT_N : EVA_HIT_S;
  const axes =
    regime === "n"
      ? {
          hold: EVA_AXIS_HOLD_N,
          background: EVA_AXIS_BG_N,
          precursor:
            currentRot > 400
              ? EVA_AXIS_PRECURSOR_N_HIGH
              : EVA_AXIS_PRECURSOR_N_LOW,
          lever: EVA_AXIS_LEVER_N,
          reach: EVA_AXIS_REACH_N,
        }
      : {
          hold: EVA_AXIS_HOLD_S,
          background: EVA_AXIS_BG_S,
          precursor: EVA_AXIS_PRECURSOR_S,
          lever: EVA_AXIS_LEVER_S,
          reach: EVA_AXIS_REACH_S,
        };
  const { isHit, picks } = drawAxisComposite(axes, hitBudget, EVA_BIT_N);

  // 保留が無地(なし)で、なおかつレバブルが独立して発生した場合のみ「レバブル保留」に表示格上げする。
  // 赤/緑/青保留は一切書き換えないため信頼度は歪まず、レバブル保留の信頼度は
  // 下のmax()計算でlever軸の値がそのまま採用される（＝レバブルの信頼度と常に一致）
  if (picks.hold.name === "なし" && picks.lever.name !== "なし") {
    picks.hold = { ...picks.hold, name: "レバブル保留", holdType: "vibe" };
  }

  let name = [];
  let trust = 0,
    holdType = "none",
    vibe = false,
    vibeColor = "none",
    text = "",
    isRushSure = false,
    flash = false;
  let bestVibeTrust = -1;
  for (const key of EVA_AXIS_ORDER) {
    const p = picks[key];
    if (p.name === "なし") continue;
    name.push(p.name);
    trust = Math.max(trust, p.trust);
    if (p.holdType) holdType = p.holdType;
    if (p.isRushSure) isRushSure = true;
    if (p.flash) flash = true;
    if (p.text) text = text ? text + "\n" + p.text : p.text;
    // 液晶の揺れ（vibe）はレバブル軸由来の場合のみ発生させる
    if (key === "lever" && p.vibe && p.trust > bestVibeTrust) {
      vibe = true;
      vibeColor = p.vibeColor;
      bestVibeTrust = p.trust;
    }
  }
  return {
    isHit,
    isRight,
    heavy: false,
    name,
    trust,
    vibe,
    vibeColor,
    flash,
    text,
    holdType,
    // 保留色軸そのものが既にBayes整合の信頼度を持つため、見た目をそのまま採用する
    currentView: holdType,
    isRushSure,
    bonusType: null,
    deferHitLog: false,
    saibare: false,
  };
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
      n: EVA_BIT_N / EVA_HIT_N,
      s: EVA_BIT_N / EVA_HIT_S,
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
      if (!eff.isRight) {
        rushCount = 1;
        if (eff.isRushSure) {
          isST = true;
          bonusBall = 420;
          addLog(">> プレミアム演出！！");
        } else if (originalHit === 7) {
          isST = true;
          bonusBall = 1400;
          addLog(">> 全回転！！");
        } else if (originalHit % 2 !== 0) {
          isST = true;
          bonusBall = 420;
        } else {
          if (Math.random() < 0.2) {
            isST = true;
            needsUpgrade = true;
            bonusBall = 420;
          } else {
            isST = false;
            bonusBall = 420;
          }
        }
      } else {
        isST = true;
        bonusBall = 1400;
        isRightUpgrade = true;
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
      const vStockEl = document.getElementById("v-stock");
      if (mode !== "通常") {
        const hasStockHit = rightStock.some((job) => job.isHit);
        if (hasStockHit && vStockEl) {
          vStockEl.style.display = "block";
          addLog(">> Vストック獲得！！（保留連確定）");
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
      if (mode === "通常" && needsUpgrade) {
        let nextOdd = [1, 3, 5, 9][Math.floor(Math.random() * 4)];
        addLog(`>> ${nextOdd}図柄へ昇格！！`);
        document.getElementById("lamp").classList.add("lamp-active");
        [1, 2, 3].forEach((i) => {
          const el = document.getElementById("d" + i);
          el.innerText = nextOdd;
          el.className = "digit odd";
        });
        await new Promise((r) => setTimeout(r, 800));
        document.getElementById("lamp").classList.remove("lamp-active");
      }
      if (isRightUpgrade) {
        const machineEl = document.getElementById("machine");
        machineEl.classList.add("vibe-rainbow");
        document.getElementById("lamp").classList.add("lamp-active");
        [1, 2, 3].forEach((i) => {
          const el = document.getElementById("d" + i);
          el.innerText = 7;
          el.className = "digit gold";
        });
        await new Promise((r) => setTimeout(r, 1000));
        machineEl.classList.remove("vibe-rainbow");
        document.getElementById("lamp").classList.remove("lamp-active");
      }
      if (isST) {
        mode = "ST";
        rRem = SPECS.st;
      } else {
        mode = "時短";
        rRem = SPECS.jt;
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
let currentMachine = "rezero";
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

function createJob(isRight = false) {
  const regime = mode === "通常" || mode === "時短" ? "n" : "s";
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

  res.heavy = res.trust >= 50 || res.saibare;
  res.displayName =
    Array.from(new Set(res.name)).join("+").replace(/ST/g, "") || "通常";
  return res;
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
    lcdCount = normalRotationAfterModeEnd(endedMode);
    currentRushHits = 0;
    firstHitRot = 0;
    updateUI();
  }

  if (rightStock.length > 0) {
    activeJob = rightStock.shift();
  } else if (leftStock.length > 0) {
    activeJob = leftStock.shift();
  } else {
    refillStock();
    activeJob = mode === "通常" ? leftStock.shift() : rightStock.shift();
  }

  if (activeJob) activeJob.currentView = activeJob.holdType;
  refillStock();
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
      `${modeLabel} ${lcdCount}回転【${eff.displayName}】信頼度:${eff.trust.toFixed(1)}%`,
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
  if (eff.text) {
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
    if (j && (j.trust >= 50.0 || j.saibare)) {
      hasSakiyomiOrIkiatsu = true;
      break;
    }
  }

  // 高速オート中、先読み演出または激アツが来た場合はそのタイミングで低速にする
  if (autoSpeed === "fast" && hasSakiyomiOrIkiatsu) {
    currentSpeed = "slow";
  }

  // スピード調整。高速オート(fast)時は5ms、低速オート・チャンス時(slow)は600ms、激熱(heavy)は1800ms
  let spinTime = eff.heavy ? 1800 : currentSpeed === "fast" ? 5 : 600;
  let spinInterval = currentSpeed === "fast" ? 5 : 40;
  let spin = setInterval(() => {
    [1, 2, 3].forEach((i) => {
      let n = Math.floor(Math.random() * 9) + 1;
      const el = document.getElementById("d" + i);
      el.innerText = n;
      el.className = getDigitClass(n, mode);
    });
  }, spinInterval);
  await new Promise((r) => setTimeout(r, spinTime));
  clearInterval(spin);
  let finalNums, hitDigit;
  if (eff.isHit) {
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
  [1, 3, 2].forEach((i) => {
    const el = document.getElementById("d" + i);
    el.innerText = finalNums[i - 1];
    el.className = getDigitClass(finalNums[i - 1], mode);
  });
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
  // 次回転への待機時間も調整（高速時は5ms、低速時は150ms）
  let nextDelay = currentSpeed === "fast" ? 5 : 150;
  if (isAuto) setTimeout(startProcess, nextDelay);
}

// ============================================================
// ユーティリティ
// ============================================================
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

function refillStock() {
  if (mode === "通常") {
    while (leftStock.length < 4) leftStock.push(createJob(false));
  } else {
    while (rightStock.length < 4) rightStock.push(createJob(true));
  }
  updateHesoUI();
}

function updateHesoUI() {
  const isRightMode = mode !== "通常";
  const hesoArea = document.getElementById("heso-area");
  const denchuArea = document.getElementById("denchu-area");
  if (isRightMode) {
    if (hesoArea) hesoArea.style.display = "none";
    if (denchuArea) denchuArea.style.display = "flex";
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
    el.className = `heso-ball ${i === 0 ? "heso-current" : ""}`;
    if (s) el.classList.add("heso-" + s.currentView);
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
    el.className = `heso-ball ${i === 0 ? "heso-current" : ""}`;
    if (s) el.classList.add("heso-" + s.currentView);
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

function addLog(m) {
  const l = document.getElementById("log");
  l.innerHTML = `> ${m}<br>${l.innerHTML}`;
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
  refillStock();
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
  refillStock();
  updateUI();
};
