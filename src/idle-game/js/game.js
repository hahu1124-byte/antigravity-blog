/**
 * パチンコ放置ゲーム — コアロジック
 * Phase 2: 確変/ST/RUSH + 遊タイム + プレステージ
 */

// ============================================================
// 定数
// ============================================================

const MODE_NORMAL = 'normal';
const MODE_KAKUHEN = 'kakuhen';
const MODE_ST = 'st';

// 大当たり振分け（通常時の大当たりに対して）
const JACKPOT_DIST = {
    kakuhen: 0.60,  // 確変: 60%
    st: 0.25,       // ST: 25%
    normal: 0.15,   // 通常: 15%
};

const BASE_KAKUHEN_PROB = 1 / 39;  // 確変/ST中の確率
const BASE_ST_SPINS = 100;         // STモードの回転数上限
const YUTIME_MULTIPLIER = 2.5;     // 遊タイム発動条件（確率分母 × この倍率）
const PRESTIGE_THRESHOLD = 100;    // プレステージ解放に必要な累計大当たり数
const PRESTIGE_BONUS_RATE = 0.05;  // プレステージ1回あたりの永続ボーナス(5%)

// ============================================================
// ゲームステート
// ============================================================

const DEFAULT_STATE = {
    balls: 500,              // 所持玉数（初期500玉 = パチ屋1000円分）
    totalBalls: 0,           // 累計獲得玉数
    totalInvest: 0,          // 累計投資玉数
    spins: 0,                // 累計回転数
    jackpots: 0,             // 累計大当たり回数
    spinRate: 1,             // 毎秒回転数
    jackpotProb: 1 / 319,    // 通常時大当たり確率
    jackpotPayout: 1500,     // 大当たり時獲得玉数
    costPerSpin: 4,          // 1回転あたりコスト
    sinceLastJackpot: 0,     // 前回大当たりからの回転数
    autoInvest: false,       // オート投資フラグ

    // Phase 2: モードシステム
    mode: MODE_NORMAL,       // 現在のモード
    rushChain: 0,            // 現在のRUSH連荘数
    stRemaining: 0,          // ST残り回転数
    totalRushChains: 0,      // 累計最大連荘数（統計用）
    currentRushPayout: 0,    // 現在のRUSH中累計出玉（サマリー用）
    yutimeTriggered: false,  // 遊タイム発動中フラグ

    // Phase 2: プレステージ
    prestiges: 0,            // プレステージ回数
    totalLifetimeJackpots: 0, // 全プレステージ通しての累計大当たり

    upgrades: {
        spinRate: 0,
        jackpotProb: 0,
        jackpotPayout: 0,
        autoInvest: 0,
        kakuhenBoost: 0,     // Phase 2: 確変倍率UP
        stSpins: 0,          // Phase 2: ST回転数UP
    },
    lastSave: Date.now(),
    playTime: 0,             // プレイ時間（秒）
    startedAt: Date.now(),
};

let state = { ...DEFAULT_STATE };

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
        apply: (s) => { s.jackpotProb = (1 / 319) * Math.pow(1.1, s.upgrades.jackpotProb); },
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
        apply: (s) => { s.jackpotPayout = 1500 + s.upgrades.jackpotPayout * 200; },
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
        apply: () => { /* 動的計算で使用 */ },
        effectText: (s) => {
            const prob = getKakuhenProb();
            return `1/${Math.round(1 / prob)}`;
        },
    },
    {
        id: 'stSpins',
        name: '⏱️ ST回転数UP',
        desc: 'STモードの回転数上限を+20',
        icon: '⏱️',
        baseCost: 1500,
        costMultiplier: 2.0,
        maxLevel: 20,
        apply: () => { /* 動的計算で使用 */ },
        effectText: (s) => `${getMaxStSpins()}回転`,
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
    // Phase 2 DOM
    modeIndicator: $('modeIndicator'),
    rushBanner: $('rushBanner'),
    rushChainDisplay: $('rushChainDisplay'),
    rushProbDisplay: $('rushProbDisplay'),
    lcdScreen: $('lcdScreen'),
    prestigeBtn: $('prestigeBtn'),
    prestigeCount: $('prestigeCount'),
    prestigeBonus: $('prestigeBonus'),
    prestigeSection: $('prestigeSection'),
    rushSummary: $('rushSummary'),
    rushSummaryDetail: $('rushSummaryDetail'),
    rushSummaryClose: $('rushSummaryClose'),
    yutimeBanner: $('yutimeBanner'),
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

/** プレステージボーナス倍率を取得 */
function getPrestigeMultiplier() {
    return 1 + state.prestiges * PRESTIGE_BONUS_RATE;
}

/** 確変/ST中の確率を取得（アップグレード + プレステージボーナス反映） */
function getKakuhenProb() {
    const base = BASE_KAKUHEN_PROB;
    const upgBoost = Math.pow(1.1, state.upgrades.kakuhenBoost);
    return base * upgBoost * getPrestigeMultiplier();
}

/** ST最大回転数を取得 */
function getMaxStSpins() {
    return BASE_ST_SPINS + state.upgrades.stSpins * 20;
}

/** 現在の実効確率を取得（モードに応じて） */
function getCurrentProb() {
    if (state.mode === MODE_KAKUHEN || state.mode === MODE_ST) {
        return getKakuhenProb();
    }
    return state.jackpotProb * getPrestigeMultiplier();
}

// ============================================================
// リール表示 (ランダム数字)
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
// 大当たり処理 (Phase 2: 振分け + モード遷移)
// ============================================================

/**
 * 大当たりの種類を抽選する
 * - 確変/ST中の大当たりも同じ振分けを使用
 */
function rollJackpotType() {
    const r = Math.random();
    if (r < JACKPOT_DIST.kakuhen) return MODE_KAKUHEN;
    if (r < JACKPOT_DIST.kakuhen + JACKPOT_DIST.st) return MODE_ST;
    return MODE_NORMAL;
}

/**
 * 大当たり時の出玉を計算
 * - 確変大当たり: 1.5倍
 * - ST/通常: 1.0倍
 */
function getJackpotPayout(type) {
    const base = state.jackpotPayout * getPrestigeMultiplier();
    if (type === MODE_KAKUHEN) return Math.floor(base * 1.5);
    return Math.floor(base);
}

/**
 * 大当たりを処理し、モード遷移を実行
 */
function processJackpot() {
    const type = rollJackpotType();
    const payout = getJackpotPayout(type);
    const wasRush = state.mode === MODE_KAKUHEN || state.mode === MODE_ST;

    // 出玉加算
    state.balls += payout;
    state.totalBalls += payout;
    state.jackpots++;
    state.totalLifetimeJackpots++;
    state.sinceLastJackpot = 0;
    state.yutimeTriggered = false;

    // モード遷移
    if (type === MODE_KAKUHEN) {
        // 確変突入
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
        // ST突入
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
        // 通常大当たり → RUSH終了
        if (wasRush) {
            state.rushChain++;
            state.currentRushPayout += payout;
            // RUSH結果サマリー表示
            showRushSummary(state.rushChain, state.currentRushPayout);
            // 最大連荘記録更新
            if (state.rushChain > state.totalRushChains) {
                state.totalRushChains = state.rushChain;
            }
        }
        state.mode = MODE_NORMAL;
        state.rushChain = 0;
        state.currentRushPayout = 0;
        state.stRemaining = 0;
    }

    return { type, payout };
}

// ============================================================
// 遊タイム判定
// ============================================================

function checkYutime() {
    if (state.mode !== MODE_NORMAL) return;
    if (state.yutimeTriggered) return;

    const threshold = Math.round((1 / state.jackpotProb) * YUTIME_MULTIPLIER);
    if (state.sinceLastJackpot >= threshold) {
        // 遊タイム発動！→ ST突入
        state.yutimeTriggered = true;
        state.mode = MODE_ST;
        state.stRemaining = getMaxStSpins();
        state.rushChain = 0;
        state.currentRushPayout = 0;

        // 遊タイムバナー表示
        showYutimeBanner();
    }
}

// ============================================================
// 演出: 大当たりバナー / RUSHサマリー / 遊タイム
// ============================================================

let jackpotAnimTimer = 0;

function showJackpotBanner(type, payout) {
    dom.jackpotPayoutDisplay.textContent = `+${formatNum(payout)}玉`;

    // 大当たりタイプ表示
    const typeLabels = {
        [MODE_KAKUHEN]: '🔥 確変大当たり！',
        [MODE_ST]: '⚡ ST大当たり！',
        [MODE_NORMAL]: '🎉 大当たり！',
    };
    dom.jackpotTypeDisplay.textContent = typeLabels[type] || '🎉 大当たり！';
    dom.jackpotBanner.classList.remove('hidden');
    jackpotAnimTimer = 2.0;

    showBallPopup(payout);
}

function showBallPopup(amount) {
    const popup = document.createElement('div');
    popup.className = 'ball-popup';
    popup.textContent = `+${formatNum(amount)}`;
    popup.style.left = '50%';
    popup.style.top = '30%';
    popup.style.transform = 'translateX(-50%)';
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 1000);
}

function showRushSummary(chains, totalPayout) {
    dom.rushSummaryDetail.innerHTML = `
        <div class="rush-summary-stat">
            <span class="rush-summary-label">連荘数</span>
            <span class="rush-summary-value">${chains}連荘</span>
        </div>
        <div class="rush-summary-stat">
            <span class="rush-summary-label">RUSH出玉合計</span>
            <span class="rush-summary-value rush-payout">+${formatNum(totalPayout)}玉</span>
        </div>
    `;
    dom.rushSummary.classList.remove('hidden');
}

let yutimeAnimTimer = 0;

function showYutimeBanner() {
    dom.yutimeBanner.classList.remove('hidden');
    yutimeAnimTimer = 3.0;
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

    // プレイ時間更新
    state.playTime += dt;

    // 大当たりバナーのタイマー
    if (jackpotAnimTimer > 0) {
        jackpotAnimTimer -= dt;
        if (jackpotAnimTimer <= 0) {
            dom.jackpotBanner.classList.add('hidden');
            jackpotOccurred = false;
        }
    }

    // 遊タイムバナーのタイマー
    if (yutimeAnimTimer > 0) {
        yutimeAnimTimer -= dt;
        if (yutimeAnimTimer <= 0) {
            dom.yutimeBanner.classList.add('hidden');
        }
    }

    // 回転可能チェック
    const canSpin = state.balls >= state.costPerSpin || state.autoInvest;

    if (canSpin && jackpotAnimTimer <= 0) {
        // 回転蓄積
        spinAccumulator += state.spinRate * dt;
        const spinsThisFrame = Math.floor(spinAccumulator);
        spinAccumulator -= spinsThisFrame;

        let frameJackpots = 0;
        let framePayout = 0;
        let frameJackpotType = null;

        for (let i = 0; i < spinsThisFrame; i++) {
            // コスト消費
            state.balls -= state.costPerSpin;
            state.totalInvest += state.costPerSpin;
            state.spins++;
            state.sinceLastJackpot++;

            // ST回転数消化
            if (state.mode === MODE_ST) {
                state.stRemaining--;
                if (state.stRemaining <= 0) {
                    // ST終了 → RUSH結果表示
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

            // オート投資: 玉がマイナスになった場合0にクランプ
            if (state.balls < 0) state.balls = 0;

            // 大当たり判定（モードに応じた確率）
            const prob = getCurrentProb();
            if (Math.random() < prob) {
                const result = processJackpot();
                frameJackpots++;
                framePayout += result.payout;
                frameJackpotType = result.type;
            }

            // 遊タイム判定（通常モード時のみ）
            checkYutime();

            // 玉切れでオート投資なし → 停止
            if (state.balls < state.costPerSpin && !state.autoInvest) {
                spinAccumulator = 0;
                break;
            }
        }

        // 大当たりがあったらアニメーション
        if (frameJackpots > 0) {
            jackpotOccurred = true;
            lastJackpotType = frameJackpotType;
            showJackpotBanner(frameJackpotType, framePayout);
        }

        // リール更新
        updateReels(dt, jackpotOccurred);
    } else if (!canSpin) {
        dom.reel1.className = 'reel';
        dom.reel2.className = 'reel';
        dom.reel3.className = 'reel';
    }

    // UI更新
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

    // ステータスバー
    dom.ballCount.textContent = formatNum(state.balls);
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
    const currentProb = getCurrentProb();
    dom.probDisplay.textContent = `1/${Math.round(1 / currentProb)}`;
    dom.payoutDisplay.textContent = `${formatNum(state.jackpotPayout)}玉`;
    dom.rateDisplay.textContent = `${state.spinRate.toFixed(1)}回/秒`;
    dom.costDisplay.textContent = `${state.costPerSpin}玉`;

    // ハマりゲージ
    const target = Math.round(1 / state.jackpotProb);
    const yutimeThreshold = Math.round(target * YUTIME_MULTIPLIER);
    const hamariPct = Math.min((state.sinceLastJackpot / yutimeThreshold) * 100, 100);
    dom.hamariCount.textContent = formatNum(state.sinceLastJackpot);
    dom.hamariTarget.textContent = formatNum(yutimeThreshold);
    dom.hamariBar.style.width = `${hamariPct}%`;

    // ハマリゲージの色（通常→警告→遊タイム）
    if (state.sinceLastJackpot >= yutimeThreshold) {
        dom.hamariBar.className = 'meter-fill yutime';
    } else if (state.sinceLastJackpot >= target) {
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

    // プレステージセクション
    dom.prestigeCount.textContent = state.prestiges;
    dom.prestigeBonus.textContent = `+${(state.prestiges * PRESTIGE_BONUS_RATE * 100).toFixed(0)}%`;

    // プレステージボタンの有効/無効
    const canPrestige = state.jackpots >= PRESTIGE_THRESHOLD;
    dom.prestigeBtn.disabled = !canPrestige;
    dom.prestigeBtn.textContent = canPrestige
        ? `⭐ プレステージ（${state.jackpots}/${PRESTIGE_THRESHOLD}）`
        : `🔒 大当たり ${state.jackpots}/${PRESTIGE_THRESHOLD} でプレステージ解放`;

    // ショップのコスト表示更新
    updateShopUI();
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

    const level = state.upgrades[upg.id];
    if (level >= upg.maxLevel) return;

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
}

// ============================================================
// プレステージ
// ============================================================

function doPrestige() {
    if (state.jackpots < PRESTIGE_THRESHOLD) return;
    if (!confirm(`プレステージを実行しますか？\n\n・全アップグレード・玉数・回転数がリセットされます\n・永続ボーナス +${PRESTIGE_BONUS_RATE * 100}% が付与されます\n・現在のプレステージ: ${state.prestiges} → ${state.prestiges + 1}`)) return;

    const newPrestiges = state.prestiges + 1;
    const lifetimeJackpots = state.totalLifetimeJackpots;

    // リセット（プレステージ回数と累計大当たりは保持）
    state = {
        ...DEFAULT_STATE,
        prestiges: newPrestiges,
        totalLifetimeJackpots: lifetimeJackpots,
        lastSave: Date.now(),
        startedAt: Date.now(),
    };

    renderShop();
    saveGame();
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
        dom.saveStatus.textContent = '保存済み ✓';
        setTimeout(() => { dom.saveStatus.textContent = '待機中'; }, 2000);
    } catch (e) {
        console.warn('セーブ失敗:', e);
    }
}

function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;

        const saved = JSON.parse(raw);
        // デフォルト値で欠損を補完（Phase 1→2移行時の互換性）
        state = {
            ...DEFAULT_STATE,
            ...saved,
            upgrades: { ...DEFAULT_STATE.upgrades, ...saved.upgrades },
        };
        applyAllUpgrades();
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

    // オフライン中の確率（モードに応じて）
    const prob = getCurrentProb();
    const expectedJackpots = offlineSpins * prob;
    const randomFactor = 1 + (Math.random() - 0.5) * 0.4;
    const actualJackpots = Math.max(0, Math.round(expectedJackpots * randomFactor));

    // 大当たりごとに振分け（簡易版：平均出玉で計算）
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

    // ステートに反映
    state.balls += netGain;
    if (state.balls < 0 && !state.autoInvest) state.balls = 0;
    state.totalBalls += totalPayout;
    state.totalInvest += totalCost;
    state.spins += offlineSpins;
    state.jackpots += actualJackpots;
    state.totalLifetimeJackpots += actualJackpots;
    state.playTime += offlineSeconds;

    // オフライン後のモードはリセット（簡易処理）
    if (actualJackpots > 0) {
        state.mode = lastMode;
        if (lastMode === MODE_ST) {
            state.stRemaining = getMaxStSpins();
        }
    }

    // オフラインバナー表示
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

    // ショップ描画
    renderShop();

    // イベントリスナー
    dom.offlineClose.addEventListener('click', () => {
        dom.offlineBanner.classList.add('hidden');
        saveGame();
    });

    dom.resetBtn.addEventListener('click', resetGame);

    dom.prestigeBtn.addEventListener('click', doPrestige);

    dom.rushSummaryClose.addEventListener('click', () => {
        dom.rushSummary.classList.add('hidden');
    });

    // 自動セーブ
    setInterval(saveGame, SAVE_INTERVAL);

    // ページ離脱時セーブ
    window.addEventListener('beforeunload', saveGame);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') saveGame();
    });

    // ゲームループ開始
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// DOM準備完了で初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
