/* --- 動き (JavaScript) --- */

// ============================================================
// 機種データ定義
// ============================================================
const MACHINES = {
  eva: {
    title: "EVANGELION Sim -2025 Final-",
    theme: "theme-eva",
    specs: { n: 319.7, s: 99.4, st: 163, jt: 100 },
    type: "ST",
    modeLabel(m) {
      return m;
    },
    createJobHits(mode) {
      const rMain = Math.random() * 100;
      const rSub = Math.random() * 100;
      let res = {
        trust: 0,
        name: [],
        holdType: "none",
        vibe: false,
        vibeColor: "none",
        flash: false,
        text: "",
        isRushSure: false,
      };
      if (mode === "通常" || mode === "時短") {
        if (rMain < 1) {
          res.name.push("全回転リーチ");
          res.isRushSure = true;
          res.text = "祝";
          res.trust = 100;
        } else if (rMain < 3) {
          res.name.push("突発当り");
          res.isRushSure = true;
          res.vibe = true;
          res.vibeColor = "rainbow";
          res.trust = 100;
        } else if (rMain < 6) {
          res.name.push("虹レバ");
          res.vibe = true;
          res.vibeColor = "rainbow";
          res.isRushSure = true;
          res.trust = 100;
        } else if (rMain < 10) {
          res.name.push("渚カヲル");
          res.isRushSure = true;
          res.trust = 100;
        } else if (rMain < 15) {
          res.name.push("最終号機リーチ");
          res.text = "最終号機\n画ブレ金";
          res.vibe = true;
          res.vibeColor = "red";
          res.trust = 98.0;
        } else if (rMain < 25) {
          res.name.push("赤レバ");
          res.vibe = true;
          res.vibeColor = "red";
          res.trust = 96.5;
        } else if (rMain < 40) {
          res.name.push("白レバ");
          res.vibe = true;
          res.vibeColor = "white";
          res.trust = 90.0;
        } else if (rMain < 55) {
          res.name.push("レイ背景");
          res.text = "レイ背景";
          res.trust = 85.0;
        }
        if (rSub < 30.4) {
          res.name.push("ロンギヌスの槍保留");
          res.holdType = "vibe";
          res.trust = Math.max(res.trust, 95.0);
        } else if (rSub < 56.0) {
          res.name.push("震える保留");
          res.holdType = "vibe";
          res.trust = Math.max(res.trust, 80.0);
        } else if (rSub < 85.4) {
          res.name.push("カウントダウン");
          res.text = (res.text ? res.text + "\n" : "") + "３２１０";
          res.trust = Math.max(res.trust, 92.0);
        } else if (rSub < 95.0) {
          res.name.push("赤保留");
          res.holdType = "red";
          res.trust = Math.max(res.trust, 90.0);
        }
      } else {
        if (rMain < 5) {
          res.name.push("突発当り");
          res.vibe = true;
          res.vibeColor = "rainbow";
          res.trust = 100;
        } else if (rMain < 15) {
          res.name.push("ST次回予告");
          res.text = "次回予告";
          res.trust = 100;
        } else if (rMain < 30) {
          res.name.push("STレイ背景");
          res.text = "レイ背景";
          res.trust = 100;
        } else if (rMain < 50) {
          res.name.push("ST赤レバ");
          res.vibe = true;
          res.vibeColor = "red";
          res.trust = 99.0;
        }
        if (rSub < 60) {
          res.name.push("ST赤保留");
          res.holdType = "red";
          res.trust = Math.max(res.trust, 95.0);
        }
      }
      return res;
    },
    createJobMiss(mode) {
      const rMain = Math.random() * 100;
      const rSub = Math.random() * 100;
      let res = {
        trust: 0,
        name: [],
        holdType: "none",
        vibe: false,
        vibeColor: "none",
        flash: false,
        text: "",
        isRushSure: false,
      };
      if (mode === "通常" || mode === "時短") {
        if (rMain < 0.001) {
          res.name.push("最終号機リーチ");
          res.text = "最終号機\n画ブレ銀";
          res.trust = 98.0;
        } else if (rMain < 0.005) {
          res.name.push("赤レバ");
          res.vibe = true;
          res.vibeColor = "red";
          res.trust = 96.5;
        } else if (rMain < 0.012) {
          res.name.push("白レバ");
          res.vibe = true;
          res.vibeColor = "white";
          res.trust = 90.0;
        } else if (rMain < 0.035) {
          res.name.push("レイ背景");
          res.text = "レイ背景";
          res.trust = 85.0;
        }
        if (rSub < 0.005) {
          res.name.push("ロンギヌスの槍保留");
          res.holdType = "vibe";
          res.trust = Math.max(res.trust, 95.0);
        } else if (rSub < 0.025) {
          res.name.push("震える保留");
          res.holdType = "vibe";
          res.trust = Math.max(res.trust, 80.0);
        } else if (rSub < 0.033) {
          res.name.push("カウントダウン");
          res.text = (res.text ? res.text + "\n" : "") + "３２１・";
          res.trust = Math.max(res.trust, 92.0);
        } else if (rSub < 0.04) {
          res.name.push("赤保留");
          res.holdType = "red";
          res.trust = Math.max(res.trust, 90.0);
        } else if (rSub < 0.84) {
          res.name.push("緑保留");
          res.holdType = "green";
          res.trust = Math.max(res.trust, 11.0);
        } else if (rSub < 4.84) {
          res.name.push("青保留");
          res.holdType = "blue";
          res.trust = Math.max(res.trust, 3.0);
        }
        if (res.name.length === 0) {
          res.name.push("通常");
          res.trust = 0.1;
        }
      } else {
        if (rSub < 0.032) {
          res.name.push("ST赤保留");
          res.holdType = "red";
          res.trust = Math.max(res.trust, 95.0);
        } else if (rSub < 1.032) {
          res.name.push("ST緑保留");
          res.holdType = "green";
          res.trust = Math.max(res.trust, 20.0);
        }
        if (res.name.length === 0) {
          res.name.push("通常");
          res.trust = 0.1;
        }
      }
      return res;
    },
    async resolveHit(ctx) {
      const { eff, hitDigit } = ctx;
      let bonusBall = 0;
      let rushBonus = 0;
      let isST = false;
      let needsUpgrade = false;
      const originalHit = hitDigit;
      if (eff.saibare) {
        addLog(">> 先バレ発生！！");
      }
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
    specs: { n: 349.9, s: 99.9, st: 145, jt: 0 },
    type: "MIXED",
    modeLabel(m) {
      return m === "ST" ? rushStyle : m;
    },
    createJobRoll(mode, isRight = false) {
      const pick = (patterns) => {
        const total = patterns.reduce((sum, p) => sum + p.weight, 0);
        let r = Math.random() * total;
        for (const p of patterns) {
          r -= p.weight;
          if (r < 0) return p;
        }
        return patterns[patterns.length - 1];
      };

      const baseOdds =
        mode === "通常" || mode === "時短" ? this.specs.n : this.specs.s;
      const baseHit = Math.random() < 1 / baseOdds;

      const hitPatterns = [
        {
          weight: 2,
          name: ["先バレ"],
          trust: 92,
          flash: true,
          vibe: true,
          vibeColor: "red",
          saibare: true,
        },
        {
          weight: 3,
          name: ["ベアトリスランプ"],
          trust: 92,
          holdType: "vibe",
        },
        {
          weight: 5,
          name: ["強欲保留"],
          trust: 76,
          holdType: "red",
        },
        {
          weight: 10,
          name: ["死に戻り保留"],
          trust: 58,
          holdType: "green",
        },
        {
          weight: 20,
          name: ["エミリア保留"],
          trust: 18,
          holdType: "blue",
        },
        {
          weight: 9960,
          name: ["スバルATTACK"],
          trust: 0.1,
        },
      ];

      const missPatterns = [
        {
          weight: 40,
          name: ["通常"],
          trust: 0.1,
        },
        {
          weight: 25,
          name: ["エミリア保留(煽り)"],
          trust: 18,
          holdType: "blue",
        },
        {
          weight: 20,
          name: ["死に戻り保留(煽り)"],
          trust: 10,
          holdType: "green",
        },
        {
          weight: 10,
          name: ["強欲保留(煽り)"],
          trust: 8,
          holdType: "red",
        },
        {
          weight: 5,
          name: ["ベアトリスランプ(煽り)"],
          trust: 12,
          holdType: "vibe",
          vibe: true,
        },
      ];

      const hitRushPatterns = [
        {
          weight: 2,
          name: ["強欲RUSH先バレ"],
          trust: 92,
          flash: true,
          vibe: true,
          vibeColor: "red",
          saibare: true,
        },
        {
          weight: 4,
          name: ["超強欲3000BONUS"],
          trust: 76,
          vibe: true,
          vibeColor: "rainbow",
          text: "3000+",
        },
        {
          weight: 8,
          name: ["Re:ゼロBONUS"],
          trust: 58,
        },
        {
          weight: 10,
          name: ["ドナぷる"],
          trust: 18,
        },
        {
          weight: 20,
          name: ["落ちブル"],
          trust: 10,
          text: "落ちブル",
        },
        {
          weight: 9956,
          name: ["BONUS"],
          trust: 0.1,
        },
      ];

      const missRushPatterns = [
        {
          weight: 55,
          name: ["RUSH継続"],
          trust: 18,
        },
        {
          weight: 25,
          name: ["ドキドキRUSH"],
          trust: 10,
        },
        {
          weight: 20,
          name: ["通常"],
          trust: 0.1,
        },
      ];

      const pool =
        mode === "通常" || mode === "時短"
          ? baseHit
            ? optSaibare
              ? hitPatterns
              : hitPatterns.filter((p) => p.name[0] !== "先バレ")
            : missPatterns
          : baseHit
            ? optSaibare
              ? hitRushPatterns
              : hitRushPatterns.filter((p) => p.name[0] !== "強欲RUSH先バレ")
            : missRushPatterns;

      const pat = pick(pool);
      const isHit = baseHit ? Math.random() < pat.trust / 100 : false;
      return {
        isHit,
        isRight,
        heavy: pat.trust >= 50,
        name: [...pat.name],
        trust: pat.trust,
        vibe: pat.vibe || false,
        vibeColor: pat.vibeColor || "none",
        flash: pat.flash || false,
        text: pat.text || "",
        holdType: pat.holdType || "none",
        currentView: "none",
        isRushSure: pat.isRushSure || false,
        saibare: pat.saibare || false,
      };
    },
    createJobHits(mode) {
      const rMain = Math.random() * 100;
      const rSub = Math.random() * 100;
      let res = {
        trust: 0,
        name: [],
        holdType: "none",
        vibe: false,
        vibeColor: "none",
        flash: false,
        text: "",
        isRushSure: false,
      };
      if (mode === "通常") {
        if (optSaibare && rMain < 93.8) {
          res.name.push("先バレ");
          res.flash = true;
          res.vibe = true;
          res.vibeColor = "red";
          res.trust = 40;
        }
        if (rMain < 6) {
          res.name.push("強欲SP");
          res.vibe = true;
          res.vibeColor = "red";
          res.trust = Math.max(res.trust, 78);
        } else if (rMain < 18) {
          res.name.push("死に戻りSP");
          res.trust = Math.max(res.trust, 52);
        } else if (rMain < 36) {
          res.name.push("俺を選べSP");
          res.vibe = true;
          res.vibeColor = "red";
          res.trust = Math.max(res.trust, 26);
        } else if (rMain < 56) {
          res.name.push("氷結の絆SP");
          res.trust = Math.max(res.trust, 18);
        } else {
          res.name.push("スバルATTACK");
          res.trust = Math.max(res.trust, 10);
        }
        if (rSub < 15) {
          res.name.push("ベアトリスランプ");
          res.holdType = "vibe";
          res.trust = Math.max(res.trust, 92);
        } else if (rSub < 40) {
          res.name.push("強欲保留");
          res.holdType = "red";
          res.trust = Math.max(res.trust, 76);
        } else if (rSub < 68) {
          res.name.push("死に戻り保留");
          res.holdType = "green";
          res.trust = Math.max(res.trust, 58);
        } else if (rSub < 88) {
          res.name.push("エミリア保留");
          res.holdType = "blue";
          res.trust = Math.max(res.trust, 18);
        }
      } else {
        isST = true;
        isRightUpgrade = true;
        if (mode === "通常") {
          rushStyle = Math.random() < 0.5 ? "強欲RUSH" : "ドキドキRUSH";
          rushCount = 1;
          addLog(`>> 右打ち残保留（特図2）で引き戻し！！ 【${originalHit}】`);
        } else if (mode === "時短") {
          addLog(`>> 時短引き戻し成功！ 【${originalHit}】`);
        } else {
          rushCount++;
        }
        if (rushStyle === "強欲RUSH") {
          if (rMain < 25) {
            res.name.push("超強欲3000BONUS");
            res.vibe = true;
            res.vibeColor = "rainbow";
            res.text = "3000+";
            res.trust = 100;
          } else if (rMain < 60) {
            res.name.push("Re:ゼロBONUS");
            res.trust = 100;
          } else {
            res.name.push("BONUS");
            res.trust = 100;
          }
          if (rSub < 32) {
            res.name.push("強欲保留");
            res.holdType = "red";
            res.trust = Math.max(res.trust, 95);
          }
        } else {
          if (rMain < 20) {
            res.name.push("ドナぷる");
            res.vibe = true;
            res.vibeColor = "red";
            res.trust = 100;
          } else if (rMain < 52) {
            res.name.push("落ちブル");
            res.text = "落ちブル";
            res.trust = 100;
          } else {
            res.name.push("エミリア告知");
            res.trust = 100;
          }
          if (rSub < 32) {
            res.name.push("落ちブルアップ");
            res.holdType = "blue";
            res.trust = Math.max(res.trust, 95);
          }
        }
      }
      return res;
    },
    createJobMiss(mode) {
      const rMain = Math.random() * 100;
      const rSub = Math.random() * 100;
      let res = {
        trust: 0,
        name: [],
        holdType: "none",
        vibe: false,
        vibeColor: "none",
        flash: false,
        text: "",
        isRushSure: false,
      };
      if (mode === "通常") {
        if (rMain < 1) {
          res.name.push("テンパイ煽り");
          res.trust = 8;
        } else if (rMain < 4) {
          res.name.push("死に戻り失敗");
          res.trust = 12;
        } else if (rMain < 7) {
          res.name.push("空回り保留");
          res.trust = 10;
        }
        if (rSub < 0.8) {
          res.name.push("ベアトリスランプ");
          res.holdType = "vibe";
          res.trust = Math.max(res.trust, 92);
        } else if (rSub < 2.5) {
          res.name.push("強欲保留");
          res.holdType = "red";
          res.trust = Math.max(res.trust, 76);
        } else if (rSub < 6) {
          res.name.push("死に戻り保留");
          res.holdType = "green";
          res.trust = Math.max(res.trust, 58);
        } else if (rSub < 12) {
          res.name.push("エミリア保留");
          res.holdType = "blue";
          res.trust = Math.max(res.trust, 18);
        }
        if (res.name.length === 0) {
          res.name.push("通常");
          res.trust = 0.1;
        }
      } else {
        if (rushStyle === "強欲RUSH") {
          if (rSub < 0.05) {
            res.name.push("強欲保留");
            res.holdType = "red";
            res.trust = Math.max(res.trust, 90);
          } else if (rSub < 0.9) {
            res.name.push("死に戻り保留");
            res.holdType = "green";
            res.trust = Math.max(res.trust, 18);
          }
        } else {
          if (rSub < 0.05) {
            res.name.push("落ちブルアップ");
            res.holdType = "blue";
            res.trust = Math.max(res.trust, 90);
          } else if (rSub < 0.9) {
            res.name.push("ドナぷる");
            res.holdType = "green";
            res.trust = Math.max(res.trust, 18);
          }
        }
        if (res.name.length === 0) {
          res.name.push("通常");
          res.trust = 0.1;
        }
      }
      return res;
    },
    async resolveHit(ctx) {
      const { eff, hitDigit } = ctx;
      let bonusBall = 0;
      let rushBonus = 0;
      let isST = false;
      let needsUpgrade = false;
      const originalHit = hitDigit;
      if (eff.saibare) {
        addLog(">> 先バレ発生！！");
      }

      if (!eff.isRight) {
        rushCount = 1;
        addLog(">> 大兎殲滅戦BONUS！");
        if (eff.isRushSure) {
          isST = true;
          bonusBall = 420;
          addLog(">> ジャッジ成功！！ RUSH突入！");
        } else if (originalHit === 7) {
          isST = true;
          bonusBall = 1400;
          addLog(">> 全回転！！");
        } else if (originalHit % 2 !== 0) {
          isST = true;
          bonusBall = 420;
        } else if (Math.random() < 0.2) {
          isST = true;
          needsUpgrade = true;
          bonusBall = 420;
        } else {
          bonusBall = 420;
        }
      } else {
        if (rushStyle === "強欲RUSH") {
          const r = Math.random();
          if (r < 0.25) {
            bonusBall = 3000;
            addLog(">> 超強欲3000BONUS！！");
            while (Math.random() < 0.25) {
              rushBonus += 1500;
              addLog(">> 超強欲フリーズ！！ +1500上乗せ！");
            }
            bonusBall += rushBonus;
            document.getElementById("machine").classList.add("vibe-rainbow");
            document.getElementById("lamp").classList.add("lamp-active");
            [1, 2, 3].forEach((i) => {
              const el = document.getElementById("d" + i);
              el.innerText = hitDigit;
              el.className = "digit gold";
            });
            await new Promise((r) => setTimeout(r, 1000));
            document.getElementById("machine").classList.remove("vibe-rainbow");
            document.getElementById("lamp").classList.remove("lamp-active");
            addLog(`>> 出玉: ${bonusBall}個 RUSH継続！`);
          } else if (r < 0.8) {
            bonusBall = 1500;
            addLog(`>> Re:ゼロBONUS！ 出玉: ${bonusBall}個 RUSH継続！`);
          } else {
            bonusBall = 300;
            addLog(`>> BONUS 出玉: ${bonusBall}個 RUSH継続！`);
          }
        } else {
          const r = Math.random();
          if (r < 0.2) {
            bonusBall = 3000;
            addLog(">> ドナぷる発生！ 3000BONUS！！");
          } else if (r < 0.75) {
            bonusBall = 1500;
            addLog(`>> Re:ゼロBONUS！ 出玉: ${bonusBall}個 RUSH継続！`);
          } else {
            bonusBall = 300;
            addLog(`>> BONUS 出玉: ${bonusBall}個 RUSH継続！`);
          }
        }
        totalBall += bonusBall;
        currentRot = 0;
        rushCount++;
        if (isST) {
          if (mode !== "ST") {
            rushStyle = Math.random() < 0.5 ? "強欲RUSH" : "ドキドキRUSH";
            addLog(`>> ${rushStyle}突入！`);
          }
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
  rushSeriesCount = 0,
  rushStartBall = 0;

// ============================================================
// 正しい抽選フロー：先に当たり外れを決め、演出を機種別に抽選
// ============================================================
function createJob(isRight = false) {
  let res;
  if (typeof M.createJobRoll === "function") {
    res = M.createJobRoll(mode, isRight);
  } else {
    const isHit =
      Math.random() <
      1 / (mode === "通常" || mode === "時短" ? SPECS.n : SPECS.s);
    let extras = isHit ? M.createJobHits(mode) : M.createJobMiss(mode);
    res = {
      isHit,
      isRight,
      heavy: false,
      name: extras.name || [],
      trust: extras.trust || 0,
      vibe: extras.vibe || false,
      vibeColor: extras.vibeColor || "none",
      flash: extras.flash || false,
      text: extras.text || "",
      holdType: extras.holdType || "none",
      currentView: "none",
      isRushSure: extras.isRushSure || false,
      saibare: false,
    };
  }

  // 保留の見た目決定
  if (res.holdType === "red" || (res.vibe && !res.isRushSure)) {
    let rr = Math.random();
    res.currentView = rr < 0.4 ? "blue" : rr < 0.8 ? "green" : "red";
  } else if (res.holdType === "vibe") {
    res.currentView = "vibe";
  } else {
    res.currentView = res.holdType;
  }

  res.heavy = res.trust >= 50;
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
    const modeLabel = M.modeLabel(mode);
    const rushNetBall = Math.floor(totalBall - rushStartBall);
    addLog(
      `【${modeLabel}終了】 ${currentRushHits}連 出玉: ${rushNetBall.toLocaleString()}個`,
    );
    rushSeriesCount++;
    historyData.push(firstHitRot);
    historyLabels.push(`${rushSeriesCount}回目(${currentRushHits}連)`);
    hChart.update();
    mode = "通常";
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
  // trustが50以上（激熱以上）、または当落が確定している場合のみログに出力
  if (eff.trust >= 50.0 || eff.isHit) {
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
    if (j && j.trust >= 50.0) {
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
        if (rand < 3) hitDigit = 7;
        else if (rand < 44) {
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
  rushSeriesCount = 0;
  firstHitRot = 0;
  rushStartBall = 0;
  document.getElementById("max-hamari-box").innerText = "最大ハマリ: 0";
  document.getElementById("log").innerHTML = "> システム起動完了";
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
