/**
 * パチンコ放置ゲーム — UI更新・ショップ・機種選択・演出
 */

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
    // 借金
    debtSection: $('debtSection'),
    debtAmount: $('debtAmount'),
    debtInterest: $('debtInterest'),
    repayBtn: $('repayBtn'),
    repayPartialBtn: $('repayPartialBtn'),
    loanBtn: $('loanBtn'),
    // レート選択
    rateSection: $('rateSection'),
    rateGrid: $('rateGrid'),
    versionDisplay: $('versionDisplay'),
};

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
// 演出
// ============================================================

let jackpotAnimTimer = 0;
let lastJackpotInfo = null;

function showJackpotBanner(type, payout) {
    const typeIcons = {
        [MODE_KAKUHEN]: '🔥',
        [MODE_ST]: '⚡',
        [MODE_JITAN]: '🕐',
        [MODE_NORMAL]: '🎉',
    };
    lastJackpotInfo = `${typeIcons[type] || '🎉'} +${formatNum(payout)}`;
    jackpotAnimTimer = 1.5;
}

function showRushSummary(chains, totalPayout) {
    lastJackpotInfo = `🏆 ${chains}連荘 +${formatNum(totalPayout)}`;
    jackpotAnimTimer = 3.0;
}

let yutimeAnimTimer = 0;

function showYutimeBanner() {
    dom.yutimeBanner.classList.remove('hidden');
    yutimeAnimTimer = 3.0;
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
    const profitYen = formatYen(profit);
    dom.profitDisplay.textContent = profit >= 0 ? `+${profitYen}` : profitYen;
    dom.profitDisplay.className = `status-value ${profit >= 0 ? 'positive' : 'negative'}`;

    // モードインジケーター
    const isRush = state.mode === MODE_KAKUHEN || state.mode === MODE_ST;
    const isJitan = state.mode === MODE_JITAN;
    const modeLabels = {
        [MODE_NORMAL]: `通常 ${formatNum(state.sinceLastJackpot)}回転`,
        [MODE_KAKUHEN]: `確変 ${formatNum(state.kakuhenSpins)}回転`,
        [MODE_ST]: `ST(残${state.stRemaining})`,
        [MODE_JITAN]: `時短(残${formatNum(state.jitanRemaining)})`,
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

    // ハマりゲージ
    const yutimeThreshold = getYutimeThreshold(m);
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

    // 借金表示
    const showDebt = state.debt > 0 || (state.balls < state.costPerSpin && profit < 0);
    if (showDebt) {
        dom.debtSection.classList.remove('hidden');
        dom.debtAmount.textContent = state.debt > 0 ? formatYen(state.debt) : '¥0';
        const minutesElapsed = state.debtStartTime > 0
            ? Math.floor((Date.now() - state.debtStartTime) / 60000)
            : 0;
        dom.debtInterest.textContent = state.debt > 0 ? `複利5%/分 (経過${minutesElapsed}分)` : '借金なし';
        dom.repayBtn.disabled = state.balls <= 0 || state.debt <= 0;
        const repayBalls = getDebtRepayBalls();
        dom.repayPartialBtn.disabled = state.balls < repayBalls || state.debt <= 0;
        dom.repayPartialBtn.textContent = `💴 ¥${DEBT_REPAY_UNIT_YEN.toLocaleString('ja-JP')}返済`;
        dom.loanBtn.textContent = `💸 ¥${DEBT_UNIT_YEN.toLocaleString('ja-JP')}借りる`;
    } else {
        dom.debtSection.classList.add('hidden');
    }

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
// 機種選択UI
// ============================================================

function renderMachineSelector() {
    dom.machineGrid.innerHTML = '';
    MACHINES.forEach(m => {
        const isUnlocked = state.unlockedMachines.includes(m.id);
        const isActive = state.currentMachineId === m.id;
        const isRush = state.mode !== MODE_NORMAL && state.mode !== MODE_JITAN;

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
    getAllUpgrades().forEach(upg => {
        const card = document.createElement('div');
        card.className = 'shop-card';
        card.dataset.upgradeId = upg.id;
        card.innerHTML = `
            <div class="shop-autobuy-check ${state.autoBuyer ? '' : 'hidden'}">
                <input type="checkbox" class="autobuy-cb" data-upg-id="${upg.id}"
                    ${!state.autoBuyerExcludes.includes(upg.id) ? 'checked' : ''}>
            </div>
            <div class="shop-icon">${upg.icon}</div>
            <div class="shop-info">
                <div class="shop-name">${upg.name}</div>
                <div class="shop-desc">${upg.desc}</div>
                <div class="shop-level"></div>
            </div>
            <div class="shop-cost"></div>
        `;
        dom.shopGrid.appendChild(card);
    });

    // チェックボックスのイベント（カードクリックと分離）
    dom.shopGrid.querySelectorAll('.autobuy-cb').forEach(cb => {
        cb.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        cb.addEventListener('change', (e) => {
            toggleAutoBuyTarget(e.target.dataset.upgId, e.target.checked);
        });
    });

    updateShopUI();
}

function updateShopUI() {
    getAllUpgrades().forEach(upg => {
        const card = dom.shopGrid.querySelector(`[data-upgrade-id="${upg.id}"]`);
        if (!card) return;

        const level = state.upgrades[upg.id] || 0;
        const isMaxed = level >= upg.maxLevel;
        const cost = getUpgradeCost(upg);
        const canAfford = state.balls >= cost && !isMaxed;

        card.className = `shop-card${!canAfford ? ' disabled' : ''}${isMaxed ? ' maxed' : ''}`;

        const levelEl = card.querySelector('.shop-level');
        const costEl = card.querySelector('.shop-cost');
        if (levelEl) levelEl.textContent = `Lv.${level}${upg.maxLevel > 1 ? `/${upg.maxLevel}` : ''} → ${upg.effectText(state)}`;
        if (costEl) costEl.textContent = isMaxed ? '✅ MAX' : `${formatNum(cost)}玉`;

        // オートバイヤーチェックボックスの表示/非表示
        const cbWrap = card.querySelector('.shop-autobuy-check');
        if (cbWrap) {
            if (state.autoBuyer) {
                cbWrap.classList.remove('hidden');
            } else {
                cbWrap.classList.add('hidden');
            }
        }
    });
}

function toggleAutoBuyTarget(upgId, isChecked) {
    if (isChecked) {
        state.autoBuyerExcludes = state.autoBuyerExcludes.filter(id => id !== upgId);
    } else {
        if (!state.autoBuyerExcludes.includes(upgId)) {
            state.autoBuyerExcludes.push(upgId);
        }
    }
    saveGame();
}
