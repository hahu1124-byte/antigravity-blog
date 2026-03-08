/**
 * パチンコ放置ゲーム — ステート管理・セーブ/ロード
 */

// ============================================================
// ゲームステート
// ============================================================

let YEN_PER_BALL = 1;

const DEFAULT_STATE = {
    balls: 500,
    totalBalls: 0,
    totalInvest: 0,
    spins: 0,
    jackpots: 0,
    spinRate: 1,
    jackpotProb: 656 / 65536,
    jackpotPayout: 465,
    costPerSpin: 10,
    sinceLastJackpot: 0,


    // 借金システム
    debt: 0,
    lastDebtTime: 0,
    debtStartTime: 0,
    lastInterest: 0,
    accumulatedInterest: 0,

    // Phase 2: モード
    mode: MODE_NORMAL,
    rushChain: 0,
    stRemaining: 0,
    jitanRemaining: 0,
    yutimeGauge: 0,
    totalRushChains: 0,
    currentRushPayout: 0,
    yutimeTriggered: false,

    // Phase 2: プレステージ
    prestiges: 0,
    totalLifetimeJackpots: 0,

    // Phase 3: 機種
    currentMachineId: 'amadeji',
    unlockedMachines: ['amadeji'],

    // Phase 3: 自動化
    autoBuyer: false,
    autoBuyerExcludes: [],
    autoPrestige: false,

    upgrades: {
        spinRate: 0,
        jackpotProb: 0,
        jackpotPayout: 0,

        kakuhenBoost: 0,
        stSpins: 0,
        kakuhenCont: 0,
        costReduction: 0,
        autoBuyer: 0,
        autoPrestige: 0,
        critical: 0,
    },
    lastSave: Date.now(),
    playTime: 0,
    startedAt: Date.now(),

    // アチーブメント（プレステージで初期化しない永続データ）
    achievements: {},
    reelClicks: 0,
    lifetimeMaxUpgrades: {},
};

let state = { ...DEFAULT_STATE };

// ============================================================
// Premium状態
// ============================================================

let isPremium = false;
let cloudSaveTimer = 0;

// ============================================================
// セーブ/ロード
// ============================================================

function saveGame() {
    state.lastSave = Date.now();
    state.yenPerBall = YEN_PER_BALL;
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        showSaveStatus('保存済み ✓');
    } catch (e) {
        console.warn('セーブ失敗:', e);
    }

    // クラウドセーブ（有料ユーザーのみ、間隔制限付き）
    const now = Date.now();
    if (isPremium && now - cloudSaveTimer >= CLOUD_SAVE_INTERVAL) {
        cloudSaveTimer = now;
        sendCloudSave();
    }
}

function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;

        const saved = JSON.parse(raw);
        state = {
            ...DEFAULT_STATE,
            ...saved,
            upgrades: { ...DEFAULT_STATE.upgrades, ...saved.upgrades },
            unlockedMachines: saved.unlockedMachines || ['amadeji'],
            currentMachineId: saved.currentMachineId || 'amadeji',
            achievements: saved.achievements || {},
            reelClicks: saved.reelClicks || 0,
            lifetimeMaxUpgrades: saved.lifetimeMaxUpgrades || {},
        };
        applyAllUpgrades();
        checkMachineUnlocks();
        if (saved.yenPerBall) {
            YEN_PER_BALL = saved.yenPerBall;
        }
        return true;
    } catch (e) {
        console.warn('ロード失敗:', e);
        return false;
    }
}

function resetGame() {
    if (!confirm('本当にデータをリセットしますか？\nすべての進行状況が失われます。')) return;
    localStorage.removeItem(SAVE_KEY);
    YEN_PER_BALL = 1;
    state = {
        ...DEFAULT_STATE,
        upgrades: { ...DEFAULT_STATE.upgrades },
        unlockedMachines: ['amadeji'],
        lastSave: Date.now(),
        startedAt: Date.now(),
    };
    applyAllUpgrades();
    renderShop();
    renderMachineSelector();
    saveGame();
}

// ============================================================
// オフライン差分計算
// ============================================================

function calculateOffline() {
    const now = Date.now();
    const elapsed = (now - state.lastSave) / 1000;

    if (elapsed < 10) return;

    const maxOffline = 24 * 3600;
    const offlineSeconds = Math.min(elapsed, maxOffline);
    const effectiveRate = isPremium ? state.spinRate * PREMIUM_SPEED_MULTIPLIER : state.spinRate;
    const offlineSpins = Math.floor(effectiveRate * offlineSeconds);

    if (offlineSpins <= 0) return;

    const prob = getCurrentProb();
    const expectedJackpots = offlineSpins * prob;
    const randomFactor = 1 + (Math.random() - 0.5) * 0.4;
    const actualJackpots = Math.max(0, Math.round(expectedJackpots * randomFactor));

    let totalPayout = 0;
    let lastMode = state.mode;
    for (let i = 0; i < actualJackpots; i++) {
        const type = rollJackpotType();
        const payout = getJackpotPayout(type);
        totalPayout += payout;
        lastMode = (type === MODE_NORMAL) ? MODE_NORMAL : type;
    }

    const avgCostRate = 0.55;
    const totalCost = offlineSpins * state.costPerSpin * avgCostRate;
    const netGain = totalPayout - totalCost;

    state.balls += netGain;
    if (state.balls < 0) state.balls = 0;
    state.totalBalls += totalPayout;
    state.totalInvest += totalCost;
    state.spins += offlineSpins;
    state.jackpots += actualJackpots;
    state.totalLifetimeJackpots += actualJackpots;
    state.playTime += offlineSeconds;

    if (actualJackpots > 0) {
        state.mode = lastMode;
        if (lastMode === MODE_ST) {
            state.stRemaining = getMaxStSpins();
        }
    }

    checkMachineUnlocks();

    const premiumLabel = isPremium ? ' 💎x2' : '';
    dom.offlineDetail.innerHTML = `
        ${formatTime(offlineSeconds)}の間に…<br>
        🎰 ${formatNum(offlineSpins)}回転${premiumLabel}<br>
        🎉 大当たり ${actualJackpots}回<br>
        💰 収支: ${netGain >= 0 ? '+' : ''}${formatYen(netGain)}
    `;
    dom.offlineBanner.classList.remove('hidden');
}
