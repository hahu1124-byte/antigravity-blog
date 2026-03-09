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
    lifetimeBallsStat: $('lifetimeBallsStat'),
    lifetimeInvestStat: $('lifetimeInvestStat'),
    lifetimeJackpotRateStat: $('lifetimeJackpotRateStat'),
    lifetimePlayTimeStat: $('lifetimePlayTimeStat'),
    resetBtn: $('resetBtn'),
    saveStatus: $('saveStatus'),
    // Phase 2
    modeIndicator: $('modeIndicator'),
    rushBanner: $('rushBanner'),
    rushChainDisplay: $('rushChainDisplay'),
    rushProbDisplay: $('rushProbDisplay'),
    rushContDisplay: $('rushContDisplay'),
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
    jackpotNotify: $('jackpotNotify'),
    achNotify: $('achNotify'),
    achievementBtn: $('achievementBtn'),
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
    lastJackpotInfo = `🎉 +${formatNum(payout)}`;
    jackpotAnimTimer = 1.0;
    // フローティング通知に表示
    dom.jackpotNotify.textContent = lastJackpotInfo;
    dom.jackpotNotify.className = 'jackpot-notify';
    dom.jackpotNotify.classList.remove('hidden', 'closing');
}

function showRushSummary(chains, totalPayout) {
    lastJackpotInfo = `🏆 ${chains}連荘 +${formatNum(totalPayout)}`;
    jackpotAnimTimer = 1.0;
    // フローティング通知に表示
    dom.jackpotNotify.textContent = lastJackpotInfo;
    dom.jackpotNotify.className = 'jackpot-notify rush-notify';
    dom.jackpotNotify.classList.remove('hidden', 'closing');
}

let yutimeAnimTimer = 0;

// アチーブメント解放通知
let achNotifyTimer = 0;
let prevClaimableTotal = -1; // 初回スキップ用

function showAchNotify(text) {
    dom.achNotify.textContent = text;
    dom.achNotify.classList.remove('hidden', 'closing');
    achNotifyTimer = 1.5;
}

function checkAchNotify() {
    let total = 0;
    ACHIEVEMENT_DEFS.forEach(def => {
        // 大当たり回数は頻繁すぎるため通知対象外
        if (def.id === 'jackpots') return;
        total += getAchClaimableCount(def);
    });
    if (prevClaimableTotal >= 0 && total > prevClaimableTotal) {
        showAchNotify('🏆 アチーブメント解放！');
    }
    prevClaimableTotal = total;
}

function showYutimeBanner() {
    dom.yutimeBanner.classList.remove('hidden');
    yutimeAnimTimer = 1.5;
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
    dom.ballCount.textContent = ballText;
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
            ? `遊タイム ${formatNum(state.sinceLastJackpot)}回転`
            : `時短 ${formatNum(state.sinceLastJackpot)}回転`,
    };
    dom.modeIndicator.textContent = modeLabels[state.mode] || '通常';
    dom.modeIndicator.className = `mode-badge mode-${state.mode}`;

    // RUSH バナー / 遊タイム・時短バナー（確変/ST区別 + 遊タイム残回転）
    if (isRush) {
        dom.rushBanner.classList.remove('hidden');
        if (state.mode === MODE_KAKUHEN) {
            dom.rushBanner.className = 'rush-kakuhen';
            document.getElementById('rushLabel').textContent = '🔥 確変RUSH';
        } else {
            dom.rushBanner.className = 'rush-st';
            document.getElementById('rushLabel').textContent = '⚡ ST RUSH';
        }
        dom.rushChainDisplay.textContent = `${state.rushChain}連荘中`;
        dom.rushProbDisplay.textContent = `確率 1/${Math.round(1 / getKakuhenProb())}`;
        // 実質継続率: 確変=継続率、ST=ST回転内当選率
        let contRate;
        if (state.mode === MODE_KAKUHEN) {
            contRate = getKakuhenContinueRate();
        } else {
            contRate = 1 - Math.pow(1 - getKakuhenProb(), getMaxStSpins());
        }
        dom.rushContDisplay.textContent = `継続 ${(contRate * 100).toFixed(2)}%`;
        dom.lcdScreen.classList.add('rush-active');
    } else if (isJitan) {
        // 遊タイム・時短中: バナー領域に残回転数を表示
        dom.rushBanner.classList.remove('hidden');
        dom.rushBanner.className = 'rush-jitan';
        document.getElementById('rushLabel').textContent = state.yutimeTriggered ? '⏰ 遊タイム' : '🕐 時短';
        dom.rushChainDisplay.textContent = `残${formatNum(state.jitanRemaining)}回転`;
        dom.rushProbDisplay.textContent = `確率 1/${Math.round(1 / getCurrentProb())}`;
        dom.rushContDisplay.textContent = '';
        dom.lcdScreen.classList.remove('rush-active');
    } else {
        dom.rushBanner.classList.add('hidden');
        dom.lcdScreen.classList.remove('rush-active');
    }

    // 時短中の液晶演出
    if (isJitan) {
        dom.lcdScreen.classList.add('jitan-active');
    } else {
        dom.lcdScreen.classList.remove('jitan-active');
    }

    // 台情報
    dom.probDisplay.textContent = `1/${(1 / getCurrentProb()).toFixed(3)}`;
    dom.payoutDisplay.textContent = `${formatNum(state.jackpotPayout)}玉`;
    dom.rateDisplay.textContent = `${state.spinRate.toFixed(2)}回/秒`;
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

    // 統計（今回の転生）— プレステージ1回以上のときのみ表示
    const currentStatsSection = document.querySelector('.popup-prestige-stats');
    if (currentStatsSection) {
        if (state.prestiges > 0) {
            currentStatsSection.classList.remove('hidden');
        } else {
            currentStatsSection.classList.add('hidden');
        }
    }
    dom.totalBallsStat.textContent = formatNum(state.totalBalls);
    dom.totalInvestStat.textContent = formatNum(state.totalInvest);
    dom.jackpotRateStat.textContent = state.spins > 0
        ? `1/${Math.round(state.spins / Math.max(state.jackpots, 1))}`
        : '-';
    dom.playTimeStat.textContent = formatTime(state.playTime);

    // 統計（通算 = 生涯統計 + 現在のプレステージ分）
    const ltBalls = (state.lifetimeTotalBalls || 0) + state.totalBalls;
    const ltInvest = (state.lifetimeTotalInvest || 0) + state.totalInvest;
    const ltSpins = (state.lifetimeSpins || 0) + state.spins;
    const ltJackpots = (state.lifetimeJackpots || 0) + state.jackpots;
    const ltPlayTime = (state.lifetimePlayTime || 0) + state.playTime;
    dom.lifetimeBallsStat.textContent = formatNum(ltBalls);
    dom.lifetimeInvestStat.textContent = formatNum(ltInvest);
    dom.lifetimeJackpotRateStat.textContent = ltSpins > 0
        ? `1/${Math.round(ltSpins / Math.max(ltJackpots, 1))}`
        : '-';
    dom.lifetimePlayTimeStat.textContent = formatTime(ltPlayTime);

    // 借金表示: 常時表示
    dom.debtAmount.textContent = state.debt > 0 ? formatYenRaw(state.debt) : '¥0';
    if (state.debt > 0) {
        const lastYen = (state.lastInterest * YEN_PER_BALL).toFixed(0);
        const totalYen = (state.accumulatedInterest * YEN_PER_BALL).toFixed(0);
        const elapsedSec = state.debtStartTime > 0 ? Math.floor((Date.now() - state.debtStartTime) / 1000) : 0;
        const elapsedText = elapsedSec > 0 ? ` / 経過${formatTime(elapsedSec)}` : '';
        dom.debtInterest.textContent = `複利5%/分 (利息: +¥${lastYen} / 累計: +¥${totalYen}${elapsedText})`;
    } else {
        dom.debtInterest.textContent = '利息なし';
    }
    dom.repayBtn.disabled = state.balls <= 0 || state.debt <= 0;
    const repayBalls = getDebtRepayBalls();
    dom.repayPartialBtn.disabled = state.balls < repayBalls || state.debt <= 0;
    dom.repayPartialBtn.textContent = `💴 ${formatNum(repayBalls)}玉返済`;

    // プレステージ（統計ポップアップ: 回数とボーナスのみ）
    const pThreshold = getPrestigeThreshold();
    dom.prestigeCount.textContent = state.prestiges;
    const pN = state.prestiges;
    const pMult = Math.pow(1.03, 1.03 * pN * Math.sqrt(pN));
    dom.prestigeBonus.textContent = `x${pMult.toFixed(2)}`;
    // ボーナス詳細表示
    const bonusDetail = document.getElementById('prestigeBonusDetail');
    if (bonusDetail) {
        if (state.prestiges > 0) {
            bonusDetail.textContent = `出玉 x${pMult.toFixed(2)} / 回転速度 x${pMult.toFixed(2)}`;
        } else {
            bonusDetail.textContent = '出玉・回転速度に乗算';
        }
    }

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

    // アチーブメントボタン活性/非活性
    if (dom.achievementBtn) {
        let hasClaimable = false;
        ACHIEVEMENT_DEFS.forEach(def => {
            if (getAchClaimableCount(def) > 0) hasClaimable = true;
        });
        if (hasClaimable) {
            dom.achievementBtn.classList.remove('ach-inactive');
            dom.achievementBtn.classList.add('ach-active');
        } else {
            dom.achievementBtn.classList.remove('ach-active');
            dom.achievementBtn.classList.add('ach-inactive');
        }
    }
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
            // 計算値
            const stCont = 1 - Math.pow(1 - m.highProb, m.baseStSpins);
            const jitanSpins = Math.round(JITAN_BASE_SPINS / (m.prob * JITAN_REF_DENOM));
            const jitanCont = m.jitanRate > 0 ? (1 - Math.pow(1 - m.prob, jitanSpins)) : 0;
            const normalRate = Math.max(0, 1 - m.kakuhenRate - m.stRate - m.jitanRate);
            item.innerHTML = `
                <div class="machine-info-name">${m.name}${isActive ? ' <span class="machine-active-badge">稼働中</span>' : ''}</div>
                <div class="machine-info-desc">${m.desc}</div>
                <div class="machine-info-specs">
                    <span>確率 1/${(1 / m.prob).toFixed(3)}</span>
                    <span>出玉 ${formatNum(m.payout)}</span>
                    <span>コスト ${m.cost}玉</span>
                </div>
                <div class="machine-info-specs">
                    <span>確変率 ${(m.kakuhenRate * 100).toFixed(2)}%</span>
                    <span>確変継続率 ${(m.kakuhenContinueRate * 100).toFixed(2)}%</span>
                </div>
                <div class="machine-info-specs">
                    <span>ST率 ${(m.stRate * 100).toFixed(2)}%</span>
                    <span>ST回転 ${m.baseStSpins}</span>
                </div>
                <div class="machine-info-specs">
                    <span>高確率 1/${(1 / m.highProb).toFixed(2)}</span>
                    <span>ST継続率 ${(stCont * 100).toFixed(2)}%</span>
                </div>
                <div class="machine-info-specs">
                    <span>時短率 ${(m.jitanRate * 100).toFixed(2)}%</span>
                    <span>時短 ${jitanSpins}回転</span>
                    <span>引戻率 ${(jitanCont * 100).toFixed(2)}%</span>
                </div>
                <div class="machine-info-specs">
                    <span>遊タイム ${m.yutimeThreshold}回転</span>
                    <span>時短無 ${(normalRate * 100).toFixed(2)}%</span>
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
            <div class="shop-autobuy-check ${state.upgrades.autoBuyer >= 1 ? '' : 'hidden'}">
                <input type="checkbox" class="autobuy-cb" data-upg-id="${upg.id}"
                    ${!state.autoBuyerExcludes.includes(upg.id) ? 'checked' : ''}>
            </div>
            <div class="shop-icon">${upg.icon}</div>
            <div class="shop-info">
                <div class="shop-name">${upg.name}${upg.maxLevel > 1 ? `（${upg.maxLevel === Infinity ? '∞' : upg.maxLevel}）` : ''}</div>
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
        if (levelEl) {
            if (isMaxed) {
                levelEl.textContent = `Lv.${level} (${upg.effectText(state)}) ✅ MAX`;
            } else {
                const currentEffect = upg.effectText(state);
                // 次Lvの効果を一時計算（全アップグレードを再適用して正確な値を出す）
                state.upgrades[upg.id] = level + 1;
                applyAllUpgrades();
                const nextEffect = upg.effectText(state);
                // 元に戻す
                state.upgrades[upg.id] = level;
                applyAllUpgrades();
                const maxLabel = upg.maxLevel !== Infinity ? `/${upg.maxLevel}` : '';
                levelEl.textContent = `Lv.${level}${maxLabel} (${currentEffect}) → Lv.${level + 1} (${nextEffect})`;
            }
        }
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
        summaryEl.textContent = `💎 総アップグレード投資: ${formatNum(grandTotal)}玉`;
    }

    // オートバイヤーチェックボックスの表示/非表示（購入済みなら常時表示）
    const autoBuyerPurchased = state.upgrades.autoBuyer >= 1;
    getAllUpgrades().forEach(upg => {
        const card = dom.shopGrid.querySelector(`[data-upgrade-id="${upg.id}"]`);
        if (!card) return;
        const cbWrap = card.querySelector('.shop-autobuy-check');
        if (cbWrap) {
            if (autoBuyerPurchased) {
                cbWrap.classList.remove('hidden');
                // チェックボックスの状態を同期
                const cb = cbWrap.querySelector('.autobuy-cb');
                if (cb) cb.checked = !state.autoBuyerExcludes.includes(upg.id);
            } else {
                cbWrap.classList.add('hidden');
            }
        }

        // autoBuyerカード自体のレベル表示を更新
        if (upg.id === 'autoBuyer' && autoBuyerPurchased) {
            const levelEl = card.querySelector('.shop-level');
            if (levelEl) {
                levelEl.textContent = state.autoBuyer ? '🛒 ON（タップでOFF）' : '🛒 OFF（タップでON）';
            }
            const costEl = card.querySelector('.shop-cost');
            if (costEl) costEl.textContent = state.autoBuyer ? '✅ ON' : '❌ OFF';
            card.className = `shop-card${state.autoBuyer ? ' maxed' : ''}`;
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

// ============================================================
// アチーブメントポップアップ
// ============================================================

function renderAchievementPopup() {
    const list = document.getElementById('achievementList');
    const summary = document.getElementById('achBonusSummary');
    if (!list) return;
    list.innerHTML = '';

    const totalBonus = getAchievementBonusBalls();
    summary.textContent = `初期所持玉ボーナス: +${formatNum(totalBonus)}玉`;

    let totalClaimable = 0;

    ACHIEVEMENT_DEFS.forEach(def => {
        const claimed = state.achievements[def.id] || 0;
        const claimable = getAchClaimableCount(def);
        const value = def.getValue(state);
        const nextThreshold = getAchNextThreshold(def);
        const isRevealed = !def.hidden || claimed > 0 || claimable > 0;

        const item = document.createElement('div');

        if (!isRevealed) {
            // 隠しアチーブメント（未発見）
            item.className = 'ach-item ach-hidden';
            item.innerHTML = `
                <div class="ach-icon">❓</div>
                <div class="ach-info">
                    <div class="ach-name">？？？</div>
                    <div class="ach-desc">隠しアチーブメント</div>
                </div>
            `;
        } else if (claimable > 0) {
            // クレーム可能
            totalClaimable += claimable;
            const reward = claimable * def.reward;
            item.className = 'ach-item ach-claimable';
            item.innerHTML = `
                <div class="ach-icon">${def.icon}</div>
                <div class="ach-info">
                    <div class="ach-name">${def.name}</div>
                    <div class="ach-desc">${def.hidden ? '隠し' : ''} 達成${claimed}回 → ${claimed + claimable}回</div>
                    <div class="ach-progress">現在: ${formatNum(value)}</div>
                </div>
                <div class="ach-reward">
                    <span class="ach-reward-text">+${formatNum(reward)}玉</span>
                    <span class="ach-claim-label">タップで獲得</span>
                </div>
            `;
            item.addEventListener('click', () => {
                const r = claimAchievement(def.id);
                if (r > 0) {
                    renderAchievementPopup();
                }
            });
        } else {
            // ロック中 or 全達成済み
            const nextTh = nextThreshold;
            item.className = 'ach-item ach-locked';
            const progressText = nextTh !== null && nextTh !== undefined
                ? `${formatNum(value)} / ${formatNum(nextTh)}`
                : '全マイルストーン達成 ✅';
            const isComplete = nextTh === null || nextTh === undefined;
            if (isComplete) item.classList.add('ach-complete');
            item.innerHTML = `
                <div class="ach-icon">${def.icon}</div>
                <div class="ach-info">
                    <div class="ach-name">${def.name}</div>
                    <div class="ach-desc">達成${claimed}回 (報酬: ${def.hidden ? '各+300玉' : '各+100玉'})</div>
                    <div class="ach-progress">${progressText}</div>
                </div>
            `;
        }

        list.appendChild(item);
    });
}
