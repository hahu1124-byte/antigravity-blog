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
        dom.reel1.className = 'reel';
        dom.reel2.className = 'reel';
        dom.reel3.className = 'reel';
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
        [MODE_KAKUHEN]: `確変 ${formatNum(state.sinceLastJackpot)}回転`,
        [MODE_ST]: `ST(残${state.stRemaining})`,
        [MODE_JITAN]: state.yutimeTriggered
            ? `遊タイム(残${formatNum(state.jitanRemaining)})`
            : `時短(残${formatNum(state.jitanRemaining)})`,
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
    dom.probDisplay.textContent = `1/${(1 / getCurrentProb()).toFixed(3)}`;
    dom.payoutDisplay.textContent = `${formatNum(state.jackpotPayout)}玉`;
    dom.rateDisplay.textContent = `${state.spinRate.toFixed(1)}回/秒`;
    dom.costDisplay.textContent = `${state.costPerSpin}玉`;

    // ハマりゲージ（遊タイム）
    const yutimeThreshold = getEffectiveYutimeThreshold();
    const hamariPct = Math.min((state.yutimeGauge / yutimeThreshold) * 100, 100);
    dom.hamariCount.textContent = formatNum(state.yutimeGauge);
    dom.hamariTarget.textContent = formatNum(yutimeThreshold);
    dom.hamariBar.style.width = `${hamariPct}%`;

    if (state.yutimeGauge >= yutimeThreshold) {
        dom.hamariBar.className = 'meter-fill yutime';
    } else if (state.yutimeGauge >= Math.round(1 / m.prob)) {
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

    // 借金表示: 収支がマイナスの時だけ表示
    if (profit < 0) {
        dom.debtSection.classList.remove('hidden');
        dom.debtAmount.textContent = state.debt > 0 ? formatYenRaw(state.debt) : '¥0';
        const minutesElapsed = state.debtStartTime > 0
            ? Math.floor((Date.now() - state.debtStartTime) / 60000)
            : 0;
        if (state.debt > 0) {
            // 複利で増えた分を計算（借金合計 - 元本 = 利息分）
            // 元本 = debt / (1+r)^periods だが、正確な追跡は難しいので累計と現在の差で表示
            const periods = minutesElapsed;
            const interestGrown = periods > 0
                ? Math.floor(state.debt - state.debt / Math.pow(1 + DEBT_INTEREST_RATE, periods))
                : 0;
            dom.debtInterest.textContent = `複利5%/分(+${formatYenRaw(interestGrown)})`;
        } else {
            dom.debtInterest.textContent = '利息なし';
        }
        dom.repayBtn.disabled = state.balls <= 0 || state.debt <= 0;
        const repayBalls = getDebtRepayBalls();
        dom.repayPartialBtn.disabled = state.balls < repayBalls || state.debt <= 0;
        dom.repayPartialBtn.textContent = `💴 ¥${DEBT_REPAY_UNIT_YEN.toLocaleString('ja-JP')}返済`;
    } else {
        dom.debtSection.classList.add('hidden');
    }

    // プレステージ（統計ポップアップ: 回数とボーナスのみ）
    const pThreshold = getPrestigeThreshold();
    dom.prestigeCount.textContent = state.prestiges;
    dom.prestigeBonus.textContent = `x${Math.pow(1.03, state.prestiges).toFixed(2)}`;

    // プレステージセクション（機種選択〜ショップ間: 条件達成時のみ表示）
    const canPrestige = state.jackpots >= pThreshold;
    const prestigeSection = document.getElementById('prestigeSection');
    if (canPrestige) {
        prestigeSection.classList.remove('hidden');
        dom.prestigeBtn.disabled = false;
        dom.prestigeBtn.textContent = `⭐ プレステージ実行（${state.jackpots}/${pThreshold}）`;
    } else {
        prestigeSection.classList.add('hidden');
        dom.prestigeBtn.disabled = true;
        dom.prestigeBtn.textContent = `🔒 大当たり ${state.jackpots}/${pThreshold} でプレステージ解放`;
    }

    updateShopUI();
}

// ============================================================
// 機種選択UI
// ============================================================

function renderMachineSelector() {
    dom.machineGrid.innerHTML = '';

    // 解放済み機種がある場合はセクションを表示
    const unlockedCount = state.unlockedMachines.length;
    const machineSection = document.getElementById('machineSection');
    if (unlockedCount >= 1) {
        machineSection.classList.remove('hidden');
    } else {
        machineSection.classList.add('hidden');
    }

    MACHINES.forEach(m => {
        const isUnlocked = state.unlockedMachines.includes(m.id);
        const isActive = state.currentMachineId === m.id;
        if (!isUnlocked || !isActive) return; // 選択中の機種のみ表示

        const card = document.createElement('div');
        card.className = 'machine-card active';

        card.innerHTML = `
            <div class="machine-header">
                <span class="machine-title">${m.name}</span>
                <span class="machine-active-badge">稼働中</span>
            </div>
            <div class="machine-specs">
                <span>確率 1/${(1 / m.prob).toFixed(3)}</span>
                <span>出玉 ${formatNum(m.payout)}</span>
                <span>コスト ${m.cost}玉</span>
            </div>
            <div class="machine-desc">${m.desc}</div>
        `;

        dom.machineGrid.appendChild(card);
    });

    // 機種情報ポップアップの中身を生成
    renderMachineInfoPopup();
}

function renderMachineInfoPopup() {
    const list = document.getElementById('machineInfoList');
    if (!list) return;
    list.innerHTML = '';

    const lockedCount = MACHINES.length - state.unlockedMachines.length;

    MACHINES.forEach(m => {
        const isUnlocked = state.unlockedMachines.includes(m.id);
        const item = document.createElement('div');
        item.className = `machine-info-item${isUnlocked ? '' : ' locked'}`;

        if (isUnlocked) {
            const isActive = state.currentMachineId === m.id;
            item.innerHTML = `
                <div class="machine-info-name">${m.name}${isActive ? ' <span class="machine-active-badge">稼働中</span>' : ''}</div>
                <div class="machine-info-desc">${m.desc}</div>
                <div class="machine-info-specs">
                    <span>確率 1/${(1 / m.prob).toFixed(3)}</span>
                    <span>出玉 ${formatNum(m.payout)}</span>
                    <span>コスト ${m.cost}玉</span>
                </div>
                <div class="machine-info-specs">
                    <span>確変率 ${Math.round(m.kakuhenRate * 100)}%</span>
                    <span>ST率 ${Math.round(m.stRate * 100)}%</span>
                    <span>時短率 ${Math.round(m.jitanRate * 100)}%</span>
                </div>
                <div class="machine-info-specs">
                    <span>ST回転 ${m.baseStSpins}</span>
                    <span>継続率 ${Math.round(m.kakuhenContinueRate * 100)}%</span>
                    <span>遊タイム ${m.yutimeThreshold}回転</span>
                </div>
            `;
            if (!isActive) {
                item.classList.add('selectable');
                item.addEventListener('click', () => {
                    const isRush = state.mode === MODE_KAKUHEN || state.mode === MODE_ST;
                    if (isRush) {
                        alert('RUSH中は台変更できません');
                        return;
                    }
                    if (confirm('変更する場合は回転数が初期化されますがよろしいですか？')) {
                        switchMachine(m.id);
                        document.getElementById('machineInfoPopup').classList.add('hidden');
                    }
                });
            }
        } else {
            item.innerHTML = `
                <div class="machine-info-name">🔒 ???</div>
                <div class="machine-info-desc">解放条件: ${m.unlockText}</div>
            `;
        }
        list.appendChild(item);
    });

    if (lockedCount > 0) {
        const footer = document.createElement('div');
        footer.className = 'machine-info-footer';
        footer.textContent = `🔒 残り ${lockedCount} 機種が隠されています`;
        list.appendChild(footer);
    }
}

// ============================================================
// ショップUI
// ============================================================

function renderShop() {
    dom.shopGrid.innerHTML = '';
    // 総投資額サマリー
    const summaryEl = document.createElement('div');
    summaryEl.className = 'shop-total-summary';
    summaryEl.id = 'shopTotalSummary';
    summaryEl.textContent = '';
    dom.shopGrid.appendChild(summaryEl);
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
            <div class="shop-spent"></div>
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
        const profit = state.totalBalls - state.totalInvest;
        const canAfford = (state.balls >= cost || profit > 0) && !isMaxed;

        card.className = `shop-card${!canAfford ? ' disabled' : ''}${isMaxed ? ' maxed' : ''}`;

        const levelEl = card.querySelector('.shop-level');
        const costEl = card.querySelector('.shop-cost');
        if (levelEl) levelEl.textContent = `Lv.${level}${upg.maxLevel > 1 ? `/${upg.maxLevel}` : ''} → ${upg.effectText(state)}`;
        if (costEl) costEl.textContent = isMaxed ? '✅ MAX' : `${formatNum(cost)}玉`;

        const spentEl = card.querySelector('.shop-spent');
        if (spentEl) {
            const totalSpent = getUpgradeTotalSpent(upg);
            spentEl.textContent = totalSpent > 0 ? `投資${formatNum(totalSpent)}玉` : '';
        }
    });

    // 総投資額サマリー更新
    const summaryEl = document.getElementById('shopTotalSummary');
    if (summaryEl) {
        let grandTotal = 0;
        getAllUpgrades().forEach(upg => {
            grandTotal += getUpgradeTotalSpent(upg);
        });
        summaryEl.textContent = grandTotal > 0 ? `💎 総アップグレード投資: ${formatNum(grandTotal)}玉` : '';
    }

    // オートバイヤーチェックボックスの表示/非表示
    getAllUpgrades().forEach(upg => {
        const card = dom.shopGrid.querySelector(`[data-upgrade-id="${upg.id}"]`);
        if (!card) return;
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
