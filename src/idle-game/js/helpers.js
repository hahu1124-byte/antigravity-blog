/**
 * パチンコ放置ゲーム — ユーティリティ・ヘルパー関数
 */

// ============================================================
// フォーマット
// ============================================================

function formatNum(n) {
    if (n >= 1e8) return (n / 1e8).toFixed(1) + '億';
    if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
    return Math.floor(n).toLocaleString('ja-JP');
}

function formatYen(balls) {
    const yen = Math.floor(balls * YEN_PER_BALL);
    if (Math.abs(yen) >= 1e8) return '¥' + (yen / 1e8).toFixed(1) + '億';
    if (Math.abs(yen) >= 1e4) return '¥' + (yen / 1e4).toFixed(1) + '万';
    return '¥' + yen.toLocaleString('ja-JP');
}

// 借金UI専用: 万表示しない円フォーマット
function formatYenRaw(balls) {
    const yen = Math.floor(balls * YEN_PER_BALL);
    return '¥' + yen.toLocaleString('ja-JP');
}

function formatTime(seconds) {
    seconds = Math.floor(seconds);
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}時間${m}分`;
}

// ============================================================
// 計算ヘルパー
// ============================================================

function getPrestigeMultiplier() {
    const n = state.prestiges;
    return Math.pow(1.03, 1.03 * n * Math.sqrt(n));
}

function getKakuhenProb() {
    const m = getCurrentMachine();
    return m.highProb * Math.pow(1.015, state.upgrades.kakuhenBoost);
}

function getMaxStSpins() {
    const m = getCurrentMachine();
    return Math.round(m.baseStSpins * (1 + (state.upgrades.stSpins || 0) * 0.06));
}

function getKakuhenContinueRate() {
    const m = getCurrentMachine();
    return Math.min(m.kakuhenContinueRate + (state.upgrades.kakuhenCont || 0) * 0.025, 0.95);
}

function getJitanSpins() {
    const m = getCurrentMachine();
    return Math.round(JITAN_BASE_SPINS / (m.prob * JITAN_REF_DENOM));
}

// 遊タイム閾値: アップグレード後の確率を反映した回数
function getEffectiveYutimeThreshold() {
    const m = getCurrentMachine();
    const baseThreshold = m.yutimeThreshold;
    const baseDenom = 1 / m.prob; // 機種の元々の分母
    const upgradedDenom = 1 / state.jackpotProb; // アップグレード後の分母
    // 確率が上がった分、遊タイム到達回転数を比例的に下げる
    return Math.floor(baseThreshold * (upgradedDenom / baseDenom));
}

function getUpgradeTotalSpent(upg) {
    const level = state.upgrades[upg.id] || 0;
    if (level === 0) return 0;
    if (upg.costMultiplier === 1) return upg.baseCost * level;
    return Math.floor(upg.baseCost * (Math.pow(upg.costMultiplier, level) - 1) / (upg.costMultiplier - 1));
}

function getCriticalChance() {
    return state.upgrades.critical * 10;
}

function getPrestigeThreshold() {
    return Math.round(20 + Math.pow(state.prestiges, 1.15));
}

function getStartingBalls() {
    return 500 + state.prestiges * 500 + getAchievementBonusBalls();
}

function getCurrentProb() {
    if (state.mode === MODE_KAKUHEN || state.mode === MODE_ST) {
        return getKakuhenProb();
    }
    // 時短モードは通常確率を使用
    return state.jackpotProb;
}

// ============================================================
// 機種ヘルパー
// ============================================================

function getCurrentMachine() {
    return MACHINES.find(m => m.id === state.currentMachineId) || MACHINES[0];
}

function applyMachineSpecs() {
    const m = getCurrentMachine();
    const pMult = getPrestigeMultiplier();
    state.jackpotProb = m.prob * Math.pow(1.05, state.upgrades.jackpotProb);
    const lv = state.upgrades.jackpotPayout || 0;
    const denom = Math.round(1 / m.prob);
    const hiddenRate = Math.pow(denom, 0.1) / 100;
    state.jackpotPayout = Math.floor(m.payout * (1 + lv * (0.05 + hiddenRate)) * pMult);
    state.costPerSpin = m.cost * Math.pow(0.95, state.upgrades.costReduction || 0);
    // 回転速度: ベース + アップグレード の全体にプレステージ乗算
    const spinLv = state.upgrades.spinRate || 0;
    const spinBonus = spinLv > 0 ? 0.5 * (Math.pow(1.05, spinLv) - 1) / 0.05 : 0;
    const hyperLv = state.upgrades.hyperShooter || 0;
    state.spinRate = (1 + spinBonus + hyperLv * 1.0) * pMult;
}

function switchMachine(machineId) {
    // 確変/ST中は台変更不可、通常/時短中は可能
    if (state.mode === MODE_KAKUHEN || state.mode === MODE_ST) return;
    const machine = MACHINES.find(m => m.id === machineId);
    if (!machine) return;
    if (!state.unlockedMachines.includes(machineId)) return;

    state.currentMachineId = machineId;
    applyMachineSpecs();
    state.sinceLastJackpot = 0;
    state.yutimeGauge = 0;
    state.yutimeTriggered = false;
    renderMachineSelector();
    saveGame();
}

function checkMachineUnlocks() {
    let newUnlock = false;
    MACHINES.forEach(m => {
        if (!state.unlockedMachines.includes(m.id) && m.unlockCondition(state)) {
            state.unlockedMachines.push(m.id);
            newUnlock = true;
        }
    });
    if (newUnlock) {
        renderMachineSelector();
    }
    checkRateUnlock();
}

function checkRateUnlock() {
    // レート個別解放: ¥2=P15, ¥4=P30
    dom.rateSection.classList.remove('hidden');
    const rate2Btn = dom.rateGrid.querySelector('[data-rate="2"]');
    const rate4Btn = dom.rateGrid.querySelector('[data-rate="4"]');
    if (rate2Btn) {
        if (state.prestiges >= 15) {
            rate2Btn.classList.remove('locked-rate');
            rate2Btn.disabled = false;
        } else {
            rate2Btn.classList.add('locked-rate');
            rate2Btn.disabled = true;
        }
    }
    if (rate4Btn) {
        if (state.prestiges >= 30) {
            rate4Btn.classList.remove('locked-rate');
            rate4Btn.disabled = false;
        } else {
            rate4Btn.classList.add('locked-rate');
            rate4Btn.disabled = true;
        }
    }
}

function switchRate(rate) {
    if (state.mode === MODE_KAKUHEN || state.mode === MODE_ST) return;
    // ロックされたレートは選択不可
    if (rate >= 2 && state.prestiges < 15) return;
    if (rate >= 4 && state.prestiges < 30) return;
    YEN_PER_BALL = rate;
    dom.rateGrid.querySelectorAll('.rate-btn').forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.rate) === rate);
    });
    saveGame();
}

// ============================================================
// アップグレード
// ============================================================

function getAllUpgrades() {
    const base = isPremium ? [...UPGRADES, ...PREMIUM_UPGRADES] : UPGRADES;
    return base.filter(upg => {
        if (upg.hidden && state.prestiges < 50) return false;
        return true;
    });
}

function getUpgradeCost(upg) {
    const m = getCurrentMachine();
    return Math.floor(upg.baseCost * Math.pow(upg.costMultiplier, state.upgrades[upg.id] || 0) * (m.costScale || 1));
}

function buyUpgrade(id) {
    const upg = getAllUpgrades().find(u => u.id === id);
    if (!upg) return;
    const level = state.upgrades[upg.id] || 0;
    if (level >= upg.maxLevel) return;

    const cost = getUpgradeCost(upg);
    const profit = state.totalBalls - state.totalInvest;

    // 高額単発アイテム（maxLevel=1）は借金購入不可
    if (upg.maxLevel === 1) {
        if (state.balls < cost) return;
    } else {
        // 収支プラスなら借金で購入可能
        if (state.balls < cost) {
            if (profit <= 0) return;
            while (state.balls < cost) {
                takeLoan();
            }
        }
    }

    state.balls -= cost;
    state.totalInvest += cost;
    state.upgrades[upg.id] = level + 1;
    // 生涯最高レベルをトラッキング（アチーブメント用）
    if (!state.lifetimeMaxUpgrades) state.lifetimeMaxUpgrades = {};
    state.lifetimeMaxUpgrades[upg.id] = Math.max(state.lifetimeMaxUpgrades[upg.id] || 0, state.upgrades[upg.id]);
    upg.apply(state);
    applyAllUpgrades();
    saveGame();
}

function applyAllUpgrades() {
    getAllUpgrades().forEach(upg => upg.apply(state));
    applyMachineSpecs();
}

// ============================================================
// プレステージ
// ============================================================

function executePrestige(isAuto = false) {
    const threshold = getPrestigeThreshold();
    if (state.jackpots < threshold) return;

    if (!isAuto) {
        // 確認ポップアップ中はゲームループを一時停止
        prestigePaused = true;
        const startBalls = getStartingBalls() + 500;
        const nextMultiplier = Math.pow(1.03, state.prestiges + 1);
        if (!confirm(`プレステージを実行しますか？\n\n・アップグレード・玉数・回転数がリセットされます\n・収支がリセットされます（借金は引き継ぎ）\n・出玉ボーナス x${nextMultiplier.toFixed(2)} になります\n・次回初期持玉: ${startBalls}玉（${formatYen(startBalls)}）\n・現在: ${state.prestiges} → ${state.prestiges + 1}`)) {
            // キャンセル → 即座に再開
            prestigePaused = false;
            return;
        }
    }


    const newPrestiges = state.prestiges + 1;
    const lifetimeJackpots = state.totalLifetimeJackpots;
    const unlockedMachines = [...state.unlockedMachines];
    const keepMachineId = state.currentMachineId;

    // 収支リセット、借金は引き継ぐ
    const keepDebt = state.debt;
    const keepDebtStartTime = state.debtStartTime;
    const keepLastDebtTime = state.lastDebtTime;

    // 自動化系アップグレードをプレステージ後も引き継ぐ
    const keepAutoBuyer = state.upgrades.autoBuyer || 0;
    const keepAutoPrestige = state.upgrades.autoPrestige || 0;

    const keepExcludes = [...state.autoBuyerExcludes];

    // アチーブメント・リールクリック・生涯最高レベルは永続
    const keepAchievements = { ...state.achievements };
    const keepReelClicks = state.reelClicks || 0;
    const keepLifetimeMax = { ...(state.lifetimeMaxUpgrades || {}) };

    // 生涯統計に現在のプレステージ分を加算
    const keepLifetimeTotalBalls = (state.lifetimeTotalBalls || 0) + state.totalBalls;
    const keepLifetimeTotalInvest = (state.lifetimeTotalInvest || 0) + state.totalInvest;
    const keepLifetimeSpins = (state.lifetimeSpins || 0) + state.spins;
    const keepLifetimeJackpots = (state.lifetimeJackpots || 0) + state.jackpots;
    const keepLifetimePlayTime = (state.lifetimePlayTime || 0) + state.playTime;

    state = {
        ...DEFAULT_STATE,
        balls: 500 + newPrestiges * 500 + getAchievementBonusBalls(),
        prestiges: newPrestiges,
        totalLifetimeJackpots: lifetimeJackpots,
        unlockedMachines: unlockedMachines,
        currentMachineId: keepMachineId,
        lastSave: Date.now(),
        startedAt: Date.now(),
        // 収支リセット（totalBalls/totalInvestは初期値0に戻る）
        // 借金引き継ぎ
        debt: keepDebt,
        debtStartTime: keepDebtStartTime,
        lastDebtTime: keepLastDebtTime,
        // 自動化引き継ぎ
        autoBuyer: keepAutoBuyer >= 1,
        autoPrestige: keepAutoPrestige >= 1,
        autoBuyerExcludes: keepExcludes,
        // アチーブメント永続
        achievements: keepAchievements,
        lifetimeMaxUpgrades: keepLifetimeMax,
        // 生涯統計保持
        lifetimeTotalBalls: keepLifetimeTotalBalls,
        lifetimeTotalInvest: keepLifetimeTotalInvest,
        lifetimeSpins: keepLifetimeSpins,
        lifetimeJackpots: keepLifetimeJackpots,
        lifetimePlayTime: keepLifetimePlayTime,
        reelClicks: keepReelClicks,
        upgrades: {
            ...DEFAULT_STATE.upgrades,
            autoBuyer: keepAutoBuyer,
            autoPrestige: keepAutoPrestige,
        },
    };

    applyMachineSpecs();
    checkMachineUnlocks();
    renderShop();
    renderMachineSelector();
    saveGame();

    // プレステージ完了後3秒間はゲームループを一時停止
    prestigePaused = true;
    prestigePauseTimer = PRESTIGE_PAUSE_DURATION;
}

function doPrestige() {
    executePrestige(false);
}

// ============================================================
// アチーブメントヘルパー
// ============================================================

function getAchClaimableCount(def) {
    const claimed = state.achievements[def.id] || 0;
    const value = def.getValue(state);
    let count = 0;
    let i = claimed;
    while (i < (def.maxMilestones || Infinity)) {
        const threshold = def.getThreshold(i);
        if (threshold === null || threshold === undefined) break;
        if (value >= threshold) {
            count++;
            i++;
        } else {
            break;
        }
    }
    return count;
}

function getAchNextThreshold(def) {
    const claimed = state.achievements[def.id] || 0;
    return def.getThreshold(claimed);
}

function claimAchievement(defId) {
    const def = ACHIEVEMENT_DEFS.find(d => d.id === defId);
    if (!def) return 0;
    const count = getAchClaimableCount(def);
    if (count <= 0) return 0;
    const totalReward = count * def.reward;
    state.achievements[def.id] = (state.achievements[def.id] || 0) + count;
    state.balls += totalReward;
    saveGame();
    return totalReward;
}

function getAchievementBonusBalls() {
    let bonus = 0;
    ACHIEVEMENT_DEFS.forEach(def => {
        const claimed = state.achievements[def.id] || 0;
        bonus += claimed * def.reward;
    });
    return bonus;
}
