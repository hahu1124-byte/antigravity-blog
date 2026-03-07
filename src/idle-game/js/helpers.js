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
    return Math.pow(1.03, state.prestiges);
}

function getKakuhenProb() {
    const m = getCurrentMachine();
    return m.prob * KAKUHEN_PROB_MULTIPLIER * Math.pow(1.01, state.upgrades.kakuhenBoost);
}

function getMaxStSpins() {
    const m = getCurrentMachine();
    return Math.round(m.baseStSpins * (1 + (state.upgrades.stSpins || 0) * 0.05));
}

function getKakuhenContinueRate() {
    const m = getCurrentMachine();
    return Math.min(m.kakuhenContinueRate + (state.upgrades.kakuhenCont || 0) * 0.02, 0.95);
}

function getJitanSpins() {
    const m = getCurrentMachine();
    return Math.round(JITAN_BASE_SPINS / (m.prob * JITAN_REF_DENOM));
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
    return Math.round(50 + Math.pow(state.prestiges, 1.1));
}

function getStartingBalls() {
    return 500 + state.prestiges * 500;
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
    state.jackpotProb = m.prob * Math.pow(1.05, state.upgrades.jackpotProb);
    const lv = state.upgrades.jackpotPayout || 0;
    const denom = Math.round(1 / m.prob);
    const hiddenRate = Math.pow(denom, 0.1) / 100;
    state.jackpotPayout = Math.floor(m.payout * (1 + lv * (0.05 + hiddenRate)));
    state.costPerSpin = m.cost * Math.pow(0.95, state.upgrades.costReduction || 0);
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
    const allUnlocked = MACHINES.every(m => state.unlockedMachines.includes(m.id));
    if (allUnlocked) {
        dom.rateSection.classList.remove('hidden');
    }
}

function switchRate(rate) {
    if (state.mode === MODE_KAKUHEN || state.mode === MODE_ST) return;
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
    return Math.floor(upg.baseCost * Math.pow(upg.costMultiplier, state.upgrades[upg.id] || 0));
}

function buyUpgrade(id) {
    const upg = getAllUpgrades().find(u => u.id === id);
    if (!upg) return;
    const level = state.upgrades[upg.id] || 0;
    if (level >= upg.maxLevel) return;

    const cost = getUpgradeCost(upg);
    if (state.balls < cost) return;

    state.balls -= cost;
    state.totalInvest += cost;
    state.upgrades[upg.id] = level + 1;
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
        if (!confirm(`プレステージを実行しますか？\n\n・アップグレード・玉数・回転数がリセットされます\n・収支と借金は引き継がれます\n・出玉ボーナス x${nextMultiplier.toFixed(2)} になります\n・次回初期持玉: ${startBalls}玉（${formatYen(startBalls)}）\n・現在: ${state.prestiges} → ${state.prestiges + 1}`)) {
            // キャンセル → 即座に再開
            prestigePaused = false;
            return;
        }
    }


    const newPrestiges = state.prestiges + 1;
    const lifetimeJackpots = state.totalLifetimeJackpots;
    const unlockedMachines = [...state.unlockedMachines];

    // 収支・借金を引き継ぐ
    const keepTotalBalls = state.totalBalls;
    const keepTotalInvest = state.totalInvest;
    const keepDebt = state.debt;
    const keepDebtStartTime = state.debtStartTime;
    const keepLastDebtTime = state.lastDebtTime;

    // 自動化系アップグレードをプレステージ後も引き継ぐ
    const keepAutoBuyer = state.upgrades.autoBuyer || 0;
    const keepAutoPrestige = state.upgrades.autoPrestige || 0;

    const keepExcludes = [...state.autoBuyerExcludes];

    state = {
        ...DEFAULT_STATE,
        balls: 500 + newPrestiges * 500,
        prestiges: newPrestiges,
        totalLifetimeJackpots: lifetimeJackpots,
        unlockedMachines: unlockedMachines,
        currentMachineId: 'amadeji',
        lastSave: Date.now(),
        startedAt: Date.now(),
        // 収支引き継ぎ
        totalBalls: keepTotalBalls,
        totalInvest: keepTotalInvest,
        // 借金引き継ぎ
        debt: keepDebt,
        debtStartTime: keepDebtStartTime,
        lastDebtTime: keepLastDebtTime,
        // 自動化引き継ぎ
        autoBuyer: keepAutoBuyer >= 1,
        autoPrestige: keepAutoPrestige >= 1,

        autoBuyerExcludes: keepExcludes,
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
