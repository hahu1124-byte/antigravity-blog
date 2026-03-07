/**
 * パチンコ放置ゲーム — コアロジック
 * Phase 3: 機種解放ツリー + 自動化 + バランス調整
 */

// ============================================================
// 定数
// ============================================================

const MODE_NORMAL = 'normal';
const MODE_KAKUHEN = 'kakuhen';
const MODE_ST = 'st';

const BASE_KAKUHEN_PROB = 1 / 39;
const BASE_ST_SPINS = 100;
const YUTIME_MULTIPLIER = 2.5;
const PRESTIGE_BASE_THRESHOLD = 100;
const PRESTIGE_THRESHOLD_STEP = 50;   // Phase 3: 段階的増加
const PRESTIGE_BONUS_RATE = 0.05;

// ============================================================
// 機種データ (Phase 3)
// ============================================================

const MACHINES = [
    {
        id: 'amadeji',
        name: '🟢 甘デジ',
        desc: '低リスク・安定型',
        prob: 1 / 99,
        payout: 465,
        cost: 2,
        kakuhenRate: 0.50,
        stRate: 0.30,
        yutimeMult: 3.0,  // 遊タイム倍率（甘いので甘め）
        unlockCondition: () => true, // 初期台
        unlockText: '初期台',
    },
    {
        id: 'lightmiddle',
        name: '🔵 ライトミドル',
        desc: 'バランス型',
        prob: 1 / 199,
        payout: 936,
        cost: 3,
        kakuhenRate: 0.55,
        stRate: 0.25,
        yutimeMult: 2.5,
        unlockCondition: (s) => s.totalLifetimeJackpots >= 30,
        unlockText: '累計大当たり30回',
    },
    {
        id: 'middle',
        name: '🟣 ミドル',
        desc: 'スタンダード',
        prob: 1 / 319,
        payout: 1500,
        cost: 4,
        kakuhenRate: 0.60,
        stRate: 0.25,
        yutimeMult: 2.5,
        unlockCondition: (s) => s.totalLifetimeJackpots >= 80,
        unlockText: '累計大当たり80回',
    },
    {
        id: 'max',
        name: '🔴 MAXタイプ',
        desc: 'ハイリスク・爆裂型',
        prob: 1 / 399,
        payout: 1876,
        cost: 5,
        kakuhenRate: 0.65,
        stRate: 0.20,
        yutimeMult: 2.0,
        unlockCondition: (s) => s.prestiges >= 1,
        unlockText: 'プレステージ1回',
    },
    {
        id: 'supermax',
        name: '🌟 超MAX',
        desc: '最高リスク・超爆裂',
        prob: 1 / 499,
        payout: 2347,
        cost: 6,
        kakuhenRate: 0.70,
        stRate: 0.15,
        yutimeMult: 1.8,
        unlockCondition: (s) => s.prestiges >= 3,
        unlockText: 'プレステージ3回',
    },
];

// ============================================================
// ゲームステート
// ============================================================

const DEFAULT_STATE = {
    balls: 500,
    totalBalls: 0,
    totalInvest: 0,
    spins: 0,
    jackpots: 0,
    spinRate: 1,
    jackpotProb: 1 / 99,     // 甘デジ初期値
    jackpotPayout: 800,       // 甘デジ初期値
    costPerSpin: 2,           // 甘デジ初期値
    sinceLastJackpot: 0,
    autoInvest: false,

    // Phase 2: モード
    mode: MODE_NORMAL,
    rushChain: 0,
    stRemaining: 0,
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
    autoPrestige: false,

    upgrades: {
        spinRate: 0,
        jackpotProb: 0,
        jackpotPayout: 0,
        autoInvest: 0,
        kakuhenBoost: 0,
        stSpins: 0,
        autoBuyer: 0,       // Phase 3
        autoPrestige: 0,    // Phase 3
        critical: 0,        // Phase 3
    },
    lastSave: Date.now(),
    playTime: 0,
    startedAt: Date.now(),
};

let state = { ...DEFAULT_STATE };

// ============================================================
// Phase 4: Gravity Portal連携（postMessage）
// ============================================================

let isPremium = false;
let cloudSaveTimer = 0;
const CLOUD_SAVE_INTERVAL = 60000; // クラウドセーブ間隔（60秒）

function handlePortalMessage(e) {
    if (!e.data?.type) return;

    switch (e.data.type) {
        case 'premium-status':
            isPremium = !!e.data.isPaid;
            updatePremiumUI();
            if (isPremium) {
                // 有料ユーザーはクラウドセーブ読み込みをリクエスト
                window.parent.postMessage({ type: 'load-cloud-save' }, '*');
            }
            break;

        case 'cloud-save-data':
            if (e.data.data) {
                // クラウドデータがローカルより新しい場合のみ適用
                const cloudSave = e.data.data;
                if (cloudSave.lastSave && cloudSave.lastSave > state.lastSave) {
                    state = {
                        ...DEFAULT_STATE,
                        ...cloudSave,
                        upgrades: { ...DEFAULT_STATE.upgrades, ...cloudSave.upgrades },
                        unlockedMachines: cloudSave.unlockedMachines || ['amadeji'],
                        currentMachineId: cloudSave.currentMachineId || 'amadeji',
                    };
                    applyAllUpgrades();
                    checkMachineUnlocks();
                    renderShop();
                    renderMachineSelector();
                    console.log('☁️ クラウドセーブを復元しました');
                }
            }
            break;

        case 'cloud-save-result':
            if (e.data.success) {
                showSaveStatus('☁️ 同期済み');
            }
            break;
    }
}

function updatePremiumUI() {
    let badge = document.getElementById('premiumBadge');
    if (isPremium) {
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'premiumBadge';
            badge.className = 'premium-badge';
            badge.textContent = '💎 プレミアム';
            const statusBar = document.querySelector('.status-bar');
            if (statusBar) statusBar.appendChild(badge);
        }
        badge.style.display = '';
    } else if (badge) {
        badge.style.display = 'none';
    }
}

function showSaveStatus(text) {
    dom.saveStatus.textContent = text;
    setTimeout(() => { dom.saveStatus.textContent = '待機中'; }, 2000);
}

function sendCloudSave() {
    if (!isPremium) return;
    window.parent.postMessage({ type: 'save-game', data: state }, '*');
}

// ============================================================
// 機種ヘルパー
// ============================================================

function getCurrentMachine() {
    return MACHINES.find(m => m.id === state.currentMachineId) || MACHINES[0];
}

function switchMachine(machineId) {
    // RUSH中は切替不可
    if (state.mode !== MODE_NORMAL) return;

    const machine = MACHINES.find(m => m.id === machineId);
    if (!machine) return;
    if (!state.unlockedMachines.includes(machineId)) return;

    state.currentMachineId = machineId;
    // 台スペックを反映
    applyMachineSpecs();
    // ハマリゲージリセット
    state.sinceLastJackpot = 0;
    state.yutimeTriggered = false;

    renderMachineSelector();
    saveGame();
}

function applyMachineSpecs() {
    const m = getCurrentMachine();
    // 基本確率（アップグレード反映）
    state.jackpotProb = m.prob * Math.pow(1.1, state.upgrades.jackpotProb);
    // 基本出玉（アップグレード反映）
    state.jackpotPayout = m.payout + state.upgrades.jackpotPayout * 200;
    // コスト
    state.costPerSpin = m.cost;
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
}

// ============================================================
// アップグレード定義
// ============================================================

const UPGRADES = [
    {
        id: 'spinRate',
        name: '⚡ 回転速度UP',
        desc: '毎秒の回転数を+0.5増加',
        icon: '⚡',
        baseCost: 300,
        costMultiplier: 1.5,
        maxLevel: 50,
        apply: (s) => { s.spinRate = 1 + s.upgrades.spinRate * 0.5; },
        effectText: (s) => `${s.spinRate.toFixed(1)}回/秒`,
    },
    {
        id: 'jackpotProb',
        name: '🎯 大当たり確率UP',
        desc: '大当たり確率を10%改善',
        icon: '🎯',
        baseCost: 800,
        costMultiplier: 2.0,
        maxLevel: 30,
        apply: (s) => {
            const m = getCurrentMachine();
            s.jackpotProb = m.prob * Math.pow(1.1, s.upgrades.jackpotProb);
        },
        effectText: (s) => `1/${Math.round(1 / s.jackpotProb)}`,
    },
    {
        id: 'jackpotPayout',
        name: '💰 出玉UP',
        desc: '大当たり時の獲得玉を+200',
        icon: '💰',
        baseCost: 500,
        costMultiplier: 1.8,
        maxLevel: 50,
        apply: (s) => {
            const m = getCurrentMachine();
            s.jackpotPayout = m.payout + s.upgrades.jackpotPayout * 200;
        },
        effectText: (s) => `${formatNum(s.jackpotPayout)}玉`,
    },
    {
        id: 'autoInvest',
        name: '🤖 オート投資',
        desc: '玉がなくても自動で回転を継続',
        icon: '🤖',
        baseCost: 5000,
        costMultiplier: 1,
        maxLevel: 1,
        apply: (s) => { s.autoInvest = s.upgrades.autoInvest >= 1; },
        effectText: (s) => s.autoInvest ? 'ON' : 'OFF',
    },
    {
        id: 'kakuhenBoost',
        name: '🔥 確変倍率UP',
        desc: '確変/ST中の確率をさらに10%改善',
        icon: '🔥',
        baseCost: 2000,
        costMultiplier: 2.5,
        maxLevel: 20,
        apply: () => { },
        effectText: () => `1/${Math.round(1 / getKakuhenProb())}`,
    },
    {
        id: 'stSpins',
        name: '⏱️ ST回転数UP',
        desc: 'STモードの回転数上限を+10',
        icon: '⏱️',
        baseCost: 1500,
        costMultiplier: 2.0,
        maxLevel: 20,
        apply: () => { },
        effectText: () => `${getMaxStSpins()}回転`,
    },
    {
        id: 'critical',
        name: '💎 クリティカル',
        desc: '大当たり時10%で出玉2倍',
        icon: '💎',
        baseCost: 3000,
        costMultiplier: 2.0,
        maxLevel: 10,
        apply: () => { },
        effectText: () => `${getCriticalChance()}%`,
    },
    {
        id: 'autoBuyer',
        name: '🛒 オートバイヤー',
        desc: '最安のアップグレードを自動購入',
        icon: '🛒',
        baseCost: 10000,
        costMultiplier: 1,
        maxLevel: 1,
        apply: (s) => { s.autoBuyer = s.upgrades.autoBuyer >= 1; },
        effectText: (s) => s.autoBuyer ? 'ON' : 'OFF',
    },
    {
        id: 'autoPrestige',
        name: '🔄 オートプレステージ',
        desc: '条件達成で自動プレステージ',
        icon: '🔄',
        baseCost: 50000,
        costMultiplier: 1,
        maxLevel: 1,
        apply: (s) => { s.autoPrestige = s.upgrades.autoPrestige >= 1; },
        effectText: (s) => s.autoPrestige ? 'ON' : 'OFF',
    },
];

// ============================================================
// DOM要素キャッシュ
// ============================================================

const $ = (id) => document.getElementById(id);

const dom = {
    ballCount: $('ballCount'),
    spinCount: $('spinCount'),
    jackpotCount: $('jackpotCount'),
    profitDisplay: $('profitDisplay'),
    reel1: $('reel1'),
    reel2: $('reel2'),
    reel3: $('reel3'),
    jackpotBanner: $('jackpotBanner'),
    jackpotPayoutDisplay: $('jackpotPayoutDisplay'),
    jackpotTypeDisplay: $('jackpotTypeDisplay'),
    probDisplay: $('probDisplay'),
    payoutDisplay: $('payoutDisplay'),
    rateDisplay: $('rateDisplay'),
    costDisplay: $('costDisplay'),
    hamariCount: $('hamariCount'),
    hamariTarget: $('hamariTarget'),
    hamariBar: $('hamariBar'),
    shopGrid: $('shopGrid'),
    offlineBanner: $('offlineBanner'),
    offlineDetail: $('offlineDetail'),
    offlineClose: $('offlineClose'),
    totalBallsStat: $('totalBallsStat'),
    totalInvestStat: $('totalInvestStat'),
    jackpotRateStat: $('jackpotRateStat'),
    playTimeStat: $('playTimeStat'),
    resetBtn: $('resetBtn'),
    saveStatus: $('saveStatus'),
    // Phase 2
    modeIndicator: $('modeIndicator'),
    rushBanner: $('rushBanner'),
    rushChainDisplay: $('rushChainDisplay'),
    rushProbDisplay: $('rushProbDisplay'),
    lcdScreen: $('lcdScreen'),
    prestigeBtn: $('prestigeBtn'),
    prestigeCount: $('prestigeCount'),
    prestigeBonus: $('prestigeBonus'),
    rushSummary: $('rushSummary'),
    rushSummaryDetail: $('rushSummaryDetail'),
    rushSummaryClose: $('rushSummaryClose'),
    yutimeBanner: $('yutimeBanner'),
    // Phase 3
    machineGrid: $('machineGrid'),
    machineName: $('machineName'),
};

// ============================================================
// ユーティリティ
// ============================================================

function formatNum(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
    return Math.floor(n).toLocaleString('ja-JP');
}

function formatTime(seconds) {
    seconds = Math.floor(seconds);
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}時間${m}分`;
}

function getPrestigeMultiplier() {
    return 1 + state.prestiges * PRESTIGE_BONUS_RATE;
}

function getKakuhenProb() {
    return BASE_KAKUHEN_PROB * Math.pow(1.1, state.upgrades.kakuhenBoost) * getPrestigeMultiplier();
}

function getMaxStSpins() {
    return BASE_ST_SPINS + state.upgrades.stSpins * 10;
}

function getCriticalChance() {
    return state.upgrades.critical * 10; // 10%刻み
}

function getPrestigeThreshold() {
    return PRESTIGE_BASE_THRESHOLD + state.prestiges * PRESTIGE_THRESHOLD_STEP;
}

function getStartingBalls() {
    return 500 + state.prestiges * 200;
}

function getCurrentProb() {
    if (state.mode === MODE_KAKUHEN || state.mode === MODE_ST) {
        return getKakuhenProb();
    }
    return state.jackpotProb * getPrestigeMultiplier();
}

// ============================================================
// リール表示
// ============================================================

const REEL_SYMBOLS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
let reelUpdateTimer = 0;

function updateReels(dt, isJackpot) {
    reelUpdateTimer += dt;
    if (reelUpdateTimer < 0.08) return;
    reelUpdateTimer = 0;

    if (isJackpot) {
        dom.reel1.textContent = '7';
        dom.reel2.textContent = '7';
        dom.reel3.textContent = '7';
        dom.reel1.className = 'reel jackpot';
        dom.reel2.className = 'reel jackpot';
        dom.reel3.className = 'reel jackpot';
    } else {
        dom.reel1.textContent = REEL_SYMBOLS[Math.floor(Math.random() * 10)];
        dom.reel2.textContent = REEL_SYMBOLS[Math.floor(Math.random() * 10)];
        dom.reel3.textContent = REEL_SYMBOLS[Math.floor(Math.random() * 10)];
        dom.reel1.className = 'reel spinning';
        dom.reel2.className = 'reel spinning';
        dom.reel3.className = 'reel spinning';
    }
}

// ============================================================
// 大当たり処理 (機種スペック参照)
// ============================================================

function rollJackpotType() {
    const m = getCurrentMachine();
    const r = Math.random();
    if (r < m.kakuhenRate) return MODE_KAKUHEN;
    if (r < m.kakuhenRate + m.stRate) return MODE_ST;
    return MODE_NORMAL;
}

function getJackpotPayout(type) {
    let base = state.jackpotPayout * getPrestigeMultiplier();
    if (type === MODE_KAKUHEN) base = Math.floor(base * 1.5);

    // クリティカル判定
    if (Math.random() * 100 < getCriticalChance()) {
        base = Math.floor(base * 2);
    }

    return Math.floor(base);
}

function processJackpot() {
    const type = rollJackpotType();
    const payout = getJackpotPayout(type);
    const wasRush = state.mode === MODE_KAKUHEN || state.mode === MODE_ST;

    state.balls += payout;
    state.totalBalls += payout;
    state.jackpots++;
    state.totalLifetimeJackpots++;
    state.sinceLastJackpot = 0;
    state.yutimeTriggered = false;

    if (type === MODE_KAKUHEN) {
        if (!wasRush) {
            state.rushChain = 1;
            state.currentRushPayout = payout;
        } else {
            state.rushChain++;
            state.currentRushPayout += payout;
        }
        state.mode = MODE_KAKUHEN;
        state.stRemaining = 0;
    } else if (type === MODE_ST) {
        if (!wasRush) {
            state.rushChain = 1;
            state.currentRushPayout = payout;
        } else {
            state.rushChain++;
            state.currentRushPayout += payout;
        }
        state.mode = MODE_ST;
        state.stRemaining = getMaxStSpins();
    } else {
        if (wasRush) {
            state.rushChain++;
            state.currentRushPayout += payout;
            showRushSummary(state.rushChain, state.currentRushPayout);
            if (state.rushChain > state.totalRushChains) {
                state.totalRushChains = state.rushChain;
            }
        }
        state.mode = MODE_NORMAL;
        state.rushChain = 0;
        state.currentRushPayout = 0;
        state.stRemaining = 0;
    }

    // 機種解放チェック
    checkMachineUnlocks();

    return { type, payout };
}

// ============================================================
// 遊タイム
// ============================================================

function checkYutime() {
    if (state.mode !== MODE_NORMAL) return;
    if (state.yutimeTriggered) return;

    const m = getCurrentMachine();
    const threshold = Math.round((1 / m.prob) * m.yutimeMult);
    if (state.sinceLastJackpot >= threshold) {
        state.yutimeTriggered = true;
        state.mode = MODE_ST;
        state.stRemaining = getMaxStSpins();
        state.rushChain = 0;
        state.currentRushPayout = 0;
        showYutimeBanner();
    }
}

// ============================================================
// 演出
// ============================================================

let jackpotAnimTimer = 0;
let lastJackpotInfo = null;

function showJackpotBanner(type, payout) {
    // ステータスバーの所持玉横に一時表示するだけ
    const typeIcons = {
        [MODE_KAKUHEN]: '🔥',
        [MODE_ST]: '⚡',
        [MODE_NORMAL]: '🎉',
    };
    lastJackpotInfo = `${typeIcons[type] || '🎉'} +${formatNum(payout)}`;
    jackpotAnimTimer = 1.5;
}

function showRushSummary(chains, totalPayout) {
    // ステータスバーにインライン表示（ポップアップなし）
    lastJackpotInfo = `🏆 ${chains}連荘 +${formatNum(totalPayout)}`;
    jackpotAnimTimer = 3.0;
}

let yutimeAnimTimer = 0;

function showYutimeBanner() {
    dom.yutimeBanner.classList.remove('hidden');
    yutimeAnimTimer = 3.0;
}

// ============================================================
// 自動化 (Phase 3)
// ============================================================

let autoBuyTimer = 0;

function processAutoBuyer(dt) {
    if (!state.autoBuyer) return;
    autoBuyTimer += dt;
    if (autoBuyTimer < 1.0) return; // 1秒間隔
    autoBuyTimer = 0;

    // 購入可能な最安アップグレードを探す
    let cheapest = null;
    let cheapestCost = Infinity;

    UPGRADES.forEach(upg => {
        if (state.upgrades[upg.id] >= upg.maxLevel) return;
        const cost = getUpgradeCost(upg);
        if (cost < cheapestCost && state.balls >= cost) {
            cheapest = upg;
            cheapestCost = cost;
        }
    });

    if (cheapest) {
        state.balls -= cheapestCost;
        state.upgrades[cheapest.id]++;
        cheapest.apply(state);
        applyAllUpgrades();
    }
}

function processAutoPrestige() {
    if (!state.autoPrestige) return;
    if (state.jackpots >= getPrestigeThreshold()) {
        executePrestige(true); // 自動
    }
}

// ============================================================
// コアゲームループ
// ============================================================

let lastFrameTime = performance.now();
let spinAccumulator = 0;
let jackpotOccurred = false;
let lastJackpotType = null;

function gameLoop(now) {
    const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
    lastFrameTime = now;

    state.playTime += dt;

    // 大当たり表示タイマー
    if (jackpotAnimTimer > 0) {
        jackpotAnimTimer -= dt;
        if (jackpotAnimTimer <= 0) {
            lastJackpotInfo = null;
            jackpotOccurred = false;
        }
    }
    if (yutimeAnimTimer > 0) {
        yutimeAnimTimer -= dt;
        if (yutimeAnimTimer <= 0) {
            dom.yutimeBanner.classList.add('hidden');
        }
    }

    const canSpin = state.balls >= state.costPerSpin || state.autoInvest;

    if (canSpin) {
        spinAccumulator += state.spinRate * dt;
        const spinsThisFrame = Math.floor(spinAccumulator);
        spinAccumulator -= spinsThisFrame;

        let frameJackpots = 0;
        let framePayout = 0;
        let frameJackpotType = null;

        for (let i = 0; i < spinsThisFrame; i++) {
            state.balls -= state.costPerSpin;
            state.totalInvest += state.costPerSpin;
            state.spins++;
            state.sinceLastJackpot++;

            // ST消化
            if (state.mode === MODE_ST) {
                state.stRemaining--;
                if (state.stRemaining <= 0) {
                    if (state.rushChain > 0) {
                        showRushSummary(state.rushChain, state.currentRushPayout);
                        if (state.rushChain > state.totalRushChains) {
                            state.totalRushChains = state.rushChain;
                        }
                    }
                    state.mode = MODE_NORMAL;
                    state.rushChain = 0;
                    state.currentRushPayout = 0;
                }
            }

            if (state.balls < 0) state.balls = 0;

            const prob = getCurrentProb();
            if (Math.random() < prob) {
                const result = processJackpot();
                frameJackpots++;
                framePayout += result.payout;
                frameJackpotType = result.type;
            }

            checkYutime();

            if (state.balls < state.costPerSpin && !state.autoInvest) {
                spinAccumulator = 0;
                break;
            }
        }

        if (frameJackpots > 0) {
            jackpotOccurred = true;
            lastJackpotType = frameJackpotType;
            showJackpotBanner(frameJackpotType, framePayout);
        }

        updateReels(dt, jackpotOccurred);
    } else if (!canSpin) {
        dom.reel1.className = 'reel';
        dom.reel2.className = 'reel';
        dom.reel3.className = 'reel';
    }

    // Phase 3: 自動化処理
    processAutoBuyer(dt);
    processAutoPrestige();

    updateUI();
    requestAnimationFrame(gameLoop);
}

// ============================================================
// UI更新
// ============================================================

let uiUpdateTimer = 0;

function updateUI() {
    uiUpdateTimer++;
    if (uiUpdateTimer % 3 !== 0) return;

    const m = getCurrentMachine();

    // ステータスバー
    const ballText = formatNum(state.balls);
    dom.ballCount.textContent = lastJackpotInfo
        ? `${ballText}  ${lastJackpotInfo}`
        : ballText;
    dom.spinCount.textContent = formatNum(state.spins);
    dom.jackpotCount.textContent = formatNum(state.jackpots);

    const profit = state.totalBalls - state.totalInvest;
    dom.profitDisplay.textContent = profit >= 0 ? `+${formatNum(profit)}` : `-${formatNum(Math.abs(profit))}`;
    dom.profitDisplay.className = `status-value ${profit >= 0 ? 'positive' : 'negative'}`;

    // モードインジケーター
    const isRush = state.mode === MODE_KAKUHEN || state.mode === MODE_ST;
    const modeLabels = {
        [MODE_NORMAL]: '通常',
        [MODE_KAKUHEN]: '確変',
        [MODE_ST]: `ST(残${state.stRemaining})`,
    };
    dom.modeIndicator.textContent = modeLabels[state.mode] || '通常';
    dom.modeIndicator.className = `mode-badge mode-${state.mode}`;

    // RUSH バナー
    if (isRush) {
        dom.rushBanner.classList.remove('hidden');
        dom.rushChainDisplay.textContent = `${state.rushChain}連荘中`;
        dom.rushProbDisplay.textContent = `確率 1/${Math.round(1 / getKakuhenProb())}`;
        dom.lcdScreen.classList.add('rush-active');
    } else {
        dom.rushBanner.classList.add('hidden');
        dom.lcdScreen.classList.remove('rush-active');
    }

    // 台情報
    dom.probDisplay.textContent = `1/${Math.round(1 / getCurrentProb())}`;
    dom.payoutDisplay.textContent = `${formatNum(state.jackpotPayout)}玉`;
    dom.rateDisplay.textContent = `${state.spinRate.toFixed(1)}回/秒`;
    dom.costDisplay.textContent = `${state.costPerSpin}玉`;
    dom.machineName.textContent = m.name;

    // ハマりゲージ
    const yutimeThreshold = Math.round((1 / m.prob) * m.yutimeMult);
    const hamariPct = Math.min((state.sinceLastJackpot / yutimeThreshold) * 100, 100);
    dom.hamariCount.textContent = formatNum(state.sinceLastJackpot);
    dom.hamariTarget.textContent = formatNum(yutimeThreshold);
    dom.hamariBar.style.width = `${hamariPct}%`;

    if (state.sinceLastJackpot >= yutimeThreshold) {
        dom.hamariBar.className = 'meter-fill yutime';
    } else if (state.sinceLastJackpot >= Math.round(1 / m.prob)) {
        dom.hamariBar.className = 'meter-fill danger';
    } else {
        dom.hamariBar.className = 'meter-fill';
    }

    // 統計
    dom.totalBallsStat.textContent = formatNum(state.totalBalls);
    dom.totalInvestStat.textContent = formatNum(state.totalInvest);
    dom.jackpotRateStat.textContent = state.spins > 0
        ? `1/${Math.round(state.spins / Math.max(state.jackpots, 1))}`
        : '-';
    dom.playTimeStat.textContent = formatTime(state.playTime);

    // プレステージ
    const pThreshold = getPrestigeThreshold();
    dom.prestigeCount.textContent = state.prestiges;
    dom.prestigeBonus.textContent = `+${(state.prestiges * PRESTIGE_BONUS_RATE * 100).toFixed(0)}%`;

    const canPrestige = state.jackpots >= pThreshold;
    dom.prestigeBtn.disabled = !canPrestige;
    dom.prestigeBtn.textContent = canPrestige
        ? `⭐ プレステージ（${state.jackpots}/${pThreshold}）`
        : `🔒 大当たり ${state.jackpots}/${pThreshold} でプレステージ解放`;

    updateShopUI();
}

// ============================================================
// 機種選択UI (Phase 3)
// ============================================================

function renderMachineSelector() {
    dom.machineGrid.innerHTML = '';
    MACHINES.forEach(m => {
        const isUnlocked = state.unlockedMachines.includes(m.id);
        const isActive = state.currentMachineId === m.id;
        const isRush = state.mode !== MODE_NORMAL;

        const card = document.createElement('div');
        card.className = `machine-card${isActive ? ' active' : ''}${!isUnlocked ? ' locked' : ''}${isRush && !isActive ? ' rush-disabled' : ''}`;

        if (isUnlocked) {
            card.innerHTML = `
                <div class="machine-header">
                    <span class="machine-title">${m.name}</span>
                    ${isActive ? '<span class="machine-active-badge">稼働中</span>' : ''}
                </div>
                <div class="machine-specs">
                    <span>確率 1/${Math.round(1 / m.prob)}</span>
                    <span>出玉 ${formatNum(m.payout)}</span>
                    <span>コスト ${m.cost}玉</span>
                </div>
                <div class="machine-desc">${m.desc}</div>
            `;
            if (!isActive && !isRush) {
                card.addEventListener('click', () => switchMachine(m.id));
            }
        } else {
            card.innerHTML = `
                <div class="machine-header">
                    <span class="machine-title">🔒 ???</span>
                </div>
                <div class="machine-unlock-text">${m.unlockText}で解放</div>
            `;
        }

        dom.machineGrid.appendChild(card);
    });
}

// ============================================================
// ショップUI
// ============================================================

function renderShop() {
    dom.shopGrid.innerHTML = '';
    UPGRADES.forEach(upg => {
        const card = document.createElement('div');
        card.className = 'shop-card';
        card.dataset.upgradeId = upg.id;
        card.addEventListener('click', () => buyUpgrade(upg.id));
        dom.shopGrid.appendChild(card);
    });
    updateShopUI();
}

function updateShopUI() {
    UPGRADES.forEach(upg => {
        const card = dom.shopGrid.querySelector(`[data-upgrade-id="${upg.id}"]`);
        if (!card) return;

        const level = state.upgrades[upg.id];
        const isMaxed = level >= upg.maxLevel;
        const cost = getUpgradeCost(upg);
        const canAfford = state.balls >= cost && !isMaxed;

        card.className = `shop-card${!canAfford ? ' disabled' : ''}${isMaxed ? ' maxed' : ''}`;

        card.innerHTML = `
            <div class="shop-icon">${upg.icon}</div>
            <div class="shop-info">
                <div class="shop-name">${upg.name}</div>
                <div class="shop-desc">${upg.desc}</div>
                <div class="shop-level">Lv.${level}${upg.maxLevel > 1 ? `/${upg.maxLevel}` : ''} → ${upg.effectText(state)}</div>
            </div>
            <div class="shop-cost">${isMaxed ? '✅ MAX' : `${formatNum(cost)}玉`}</div>
        `;
    });
}

function getUpgradeCost(upg) {
    return Math.floor(upg.baseCost * Math.pow(upg.costMultiplier, state.upgrades[upg.id]));
}

function buyUpgrade(id) {
    const upg = UPGRADES.find(u => u.id === id);
    if (!upg) return;
    if (state.upgrades[upg.id] >= upg.maxLevel) return;

    const cost = getUpgradeCost(upg);
    if (state.balls < cost) return;

    state.balls -= cost;
    state.upgrades[upg.id]++;
    upg.apply(state);
    applyAllUpgrades();
    saveGame();
}

function applyAllUpgrades() {
    UPGRADES.forEach(upg => upg.apply(state));
    applyMachineSpecs();
}

// ============================================================
// プレステージ
// ============================================================

function executePrestige(isAuto = false) {
    const threshold = getPrestigeThreshold();
    if (state.jackpots < threshold) return;

    if (!isAuto) {
        const startBalls = getStartingBalls() + 200; // 次回分
        if (!confirm(`プレステージを実行しますか？\n\n・全アップグレード・玉数・回転数がリセットされます\n・永続ボーナス +${PRESTIGE_BONUS_RATE * 100}% が付与されます\n・次回初期持玉: ${startBalls}玉\n・現在: ${state.prestiges} → ${state.prestiges + 1}`)) return;
    }

    const newPrestiges = state.prestiges + 1;
    const lifetimeJackpots = state.totalLifetimeJackpots;
    const unlockedMachines = [...state.unlockedMachines];

    state = {
        ...DEFAULT_STATE,
        balls: 500 + newPrestiges * 200,
        prestiges: newPrestiges,
        totalLifetimeJackpots: lifetimeJackpots,
        unlockedMachines: unlockedMachines,
        currentMachineId: 'amadeji', // 甘デジに戻る
        lastSave: Date.now(),
        startedAt: Date.now(),
    };

    applyMachineSpecs();
    checkMachineUnlocks();
    renderShop();
    renderMachineSelector();
    saveGame();
}

function doPrestige() {
    executePrestige(false);
}

// ============================================================
// セーブ/ロード
// ============================================================

const SAVE_KEY = 'gp-idle-game-save';
const SAVE_INTERVAL = 30000;

function saveGame() {
    state.lastSave = Date.now();
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
        };
        applyAllUpgrades();
        checkMachineUnlocks();
        return true;
    } catch (e) {
        console.warn('ロード失敗:', e);
        return false;
    }
}

function resetGame() {
    if (!confirm('本当にデータをリセットしますか？\nすべての進行状況が失われます。')) return;
    localStorage.removeItem(SAVE_KEY);
    state = { ...DEFAULT_STATE, lastSave: Date.now(), startedAt: Date.now() };
    renderShop();
    renderMachineSelector();
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
    const offlineSpins = Math.floor(state.spinRate * offlineSeconds);

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

    const totalCost = offlineSpins * state.costPerSpin;
    const netGain = totalPayout - totalCost;

    state.balls += netGain;
    if (state.balls < 0 && !state.autoInvest) state.balls = 0;
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

    const sign = netGain >= 0 ? '+' : '';
    dom.offlineDetail.innerHTML = `
        ${formatTime(offlineSeconds)}の間に…<br>
        🎰 ${formatNum(offlineSpins)}回転<br>
        🎉 大当たり ${actualJackpots}回<br>
        💰 収支: ${sign}${formatNum(netGain)}玉
    `;
    dom.offlineBanner.classList.remove('hidden');
}

// ============================================================
// 初期化
// ============================================================

function init() {
    const hasData = loadGame();

    if (hasData) {
        calculateOffline();
    }

    renderShop();
    renderMachineSelector();

    dom.offlineClose.addEventListener('click', () => {
        dom.offlineBanner.classList.add('hidden');
        saveGame();
    });

    dom.resetBtn.addEventListener('click', resetGame);
    dom.prestigeBtn.addEventListener('click', doPrestige);

    dom.rushSummaryClose.addEventListener('click', () => {
        dom.rushSummary.classList.add('hidden');
    });

    // Phase 4: Gravity Portal postMessage連携
    window.addEventListener('message', handlePortalMessage);
    // 親ウィンドウにプレミアムステータスを要求
    if (window.parent !== window) {
        window.parent.postMessage({ type: 'get-premium-status' }, '*');
    }

    setInterval(saveGame, SAVE_INTERVAL);

    window.addEventListener('beforeunload', saveGame);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') saveGame();
    });

    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
