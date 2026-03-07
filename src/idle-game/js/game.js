/**
 * パチンコ放置ゲーム — コアロジック
 * Phase 1: 回転→大当たり→出玉→アップグレードのコアループ
 */

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
    jackpotProb: 1 / 319,    // 大当たり確率
    jackpotPayout: 1500,     // 大当たり時獲得玉数
    costPerSpin: 4,          // 1回転あたりコスト
    sinceLastJackpot: 0,     // 前回大当たりからの回転数
    autoInvest: false,       // オート投資フラグ
    upgrades: {
        spinRate: 0,
        jackpotProb: 0,
        jackpotPayout: 0,
        autoInvest: 0,
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

// ============================================================
// リール表示 (ランダム数字)
// ============================================================

const REEL_SYMBOLS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
let reelUpdateTimer = 0;

function updateReels(dt, isJackpot) {
    reelUpdateTimer += dt;
    if (reelUpdateTimer < 0.08) return; // 80ms間隔で更新
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
// 大当たり演出
// ============================================================

let jackpotAnimTimer = 0;

function showJackpotBanner(payout) {
    dom.jackpotPayoutDisplay.textContent = `+${formatNum(payout)}玉`;
    dom.jackpotBanner.classList.remove('hidden');
    jackpotAnimTimer = 2.0; // 2秒間表示

    // 玉数ポップアップ
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

// ============================================================
// コアゲームループ
// ============================================================

let lastFrameTime = performance.now();
let spinAccumulator = 0;  // 小数点以下の回転蓄積
let jackpotOccurred = false;

function gameLoop(now) {
    const dt = Math.min((now - lastFrameTime) / 1000, 0.1); // 最大100ms
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

    // 回転可能チェック（玉があるか、オート投資ONか）
    const canSpin = state.balls >= state.costPerSpin || state.autoInvest;

    if (canSpin && jackpotAnimTimer <= 0) {
        // 回転蓄積
        spinAccumulator += state.spinRate * dt;
        const spinsThisFrame = Math.floor(spinAccumulator);
        spinAccumulator -= spinsThisFrame;

        let frameJackpots = 0;
        let framePayout = 0;

        for (let i = 0; i < spinsThisFrame; i++) {
            // コスト消費
            state.balls -= state.costPerSpin;
            state.totalInvest += state.costPerSpin;
            state.spins++;
            state.sinceLastJackpot++;

            // オート投資: 玉がマイナスになった場合0にクランプ
            if (state.balls < 0) state.balls = 0;

            // 大当たり判定
            if (Math.random() < state.jackpotProb) {
                state.balls += state.jackpotPayout;
                state.totalBalls += state.jackpotPayout;
                state.jackpots++;
                state.sinceLastJackpot = 0;
                frameJackpots++;
                framePayout += state.jackpotPayout;
            }

            // 玉切れでオート投資なし → 停止
            if (state.balls < state.costPerSpin && !state.autoInvest) {
                spinAccumulator = 0;
                break;
            }
        }

        // 大当たりがあったらアニメーション
        if (frameJackpots > 0) {
            jackpotOccurred = true;
            showJackpotBanner(framePayout);
        }

        // リール更新
        updateReels(dt, jackpotOccurred);
    } else if (!canSpin) {
        // 回転停止中はリールを静止
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
    if (uiUpdateTimer % 3 !== 0) return; // 3フレームに1回更新

    // ステータスバー
    dom.ballCount.textContent = formatNum(state.balls);
    dom.spinCount.textContent = formatNum(state.spins);
    dom.jackpotCount.textContent = formatNum(state.jackpots);

    const profit = state.totalBalls - state.totalInvest;
    dom.profitDisplay.textContent = profit >= 0 ? `+${formatNum(profit)}` : `-${formatNum(Math.abs(profit))}`;
    dom.profitDisplay.className = `status-value ${profit >= 0 ? 'positive' : 'negative'}`;

    // 台情報
    dom.probDisplay.textContent = `1/${Math.round(1 / state.jackpotProb)}`;
    dom.payoutDisplay.textContent = `${formatNum(state.jackpotPayout)}玉`;
    dom.rateDisplay.textContent = `${state.spinRate.toFixed(1)}回/秒`;
    dom.costDisplay.textContent = `${state.costPerSpin}玉`;

    // ハマりゲージ
    const target = Math.round(1 / state.jackpotProb);
    const hamariPct = Math.min((state.sinceLastJackpot / target) * 100, 150);
    dom.hamariCount.textContent = formatNum(state.sinceLastJackpot);
    dom.hamariTarget.textContent = formatNum(target);
    dom.hamariBar.style.width = `${Math.min(hamariPct, 100)}%`;
    dom.hamariBar.className = `meter-fill${hamariPct > 100 ? ' danger' : ''}`;

    // 統計
    dom.totalBallsStat.textContent = formatNum(state.totalBalls);
    dom.totalInvestStat.textContent = formatNum(state.totalInvest);
    dom.jackpotRateStat.textContent = state.spins > 0
        ? `1/${Math.round(state.spins / Math.max(state.jackpots, 1))}`
        : '-';
    dom.playTimeStat.textContent = formatTime(state.playTime);

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

    // 全アップグレードの効果を再適用
    applyAllUpgrades();

    saveGame();
}

function applyAllUpgrades() {
    UPGRADES.forEach(upg => upg.apply(state));
}

// ============================================================
// セーブ/ロード
// ============================================================

const SAVE_KEY = 'gp-idle-game-save';
const SAVE_INTERVAL = 30000; // 30秒

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
        // デフォルト値で欠損を補完
        state = { ...DEFAULT_STATE, ...saved, upgrades: { ...DEFAULT_STATE.upgrades, ...saved.upgrades } };
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
    const elapsed = (now - state.lastSave) / 1000; // 秒

    // 10秒未満なら無視
    if (elapsed < 10) return;

    // オフライン中の回転数（最大24時間分）
    const maxOffline = 24 * 3600;
    const offlineSeconds = Math.min(elapsed, maxOffline);
    const offlineSpins = Math.floor(state.spinRate * offlineSeconds);

    if (offlineSpins <= 0) return;

    // オフライン抽選（確率計算で期待値ベース + ランダム補正）
    const expectedJackpots = offlineSpins * state.jackpotProb;
    // ポアソン分布の近似: 期待値 ± √期待値 のランダム
    const randomFactor = 1 + (Math.random() - 0.5) * 0.4; // ±20%のブレ
    const actualJackpots = Math.max(0, Math.round(expectedJackpots * randomFactor));

    const totalPayout = actualJackpots * state.jackpotPayout;
    const totalCost = offlineSpins * state.costPerSpin;
    const netGain = totalPayout - totalCost;

    // ステートに反映
    state.balls += netGain;
    if (state.balls < 0 && !state.autoInvest) state.balls = 0;
    state.totalBalls += totalPayout;
    state.totalInvest += totalCost;
    state.spins += offlineSpins;
    state.jackpots += actualJackpots;
    state.playTime += offlineSeconds;

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

    // オフラインバナーの閉じるボタン
    dom.offlineClose.addEventListener('click', () => {
        dom.offlineBanner.classList.add('hidden');
        saveGame();
    });

    // リセットボタン
    dom.resetBtn.addEventListener('click', resetGame);

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
