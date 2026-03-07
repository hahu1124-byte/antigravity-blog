/**
 * パチンコ放置ゲーム — コアゲームループ
 */

// ============================================================
// 大当たり処理
// ============================================================

function rollJackpotType() {
    const m = getCurrentMachine();
    const r = Math.random();
    if (r < m.kakuhenRate) return MODE_KAKUHEN;
    if (r < m.kakuhenRate + m.stRate) return MODE_ST;
    if (r < m.kakuhenRate + m.stRate + m.jitanRate) return MODE_JITAN;
    return MODE_NORMAL;
}

function getJackpotPayout(type) {
    let base = state.jackpotPayout * getPrestigeMultiplier();
    // Premiumアップグレード: ラッキーペイアウト
    const luckyLv = state.upgrades.luckyPayout || 0;
    if (luckyLv > 0) {
        base = base * (1 + luckyLv * 0.15);
    }
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
        state.jitanRemaining = 0;
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
        state.jitanRemaining = 0;
    } else if (type === MODE_JITAN) {
        // 時短: RUSH中なら終了サマリー表示
        if (wasRush) {
            state.rushChain++;
            state.currentRushPayout += payout;
            showRushSummary(state.rushChain, state.currentRushPayout);
            if (state.rushChain > state.totalRushChains) {
                state.totalRushChains = state.rushChain;
            }
        }
        state.mode = MODE_JITAN;
        state.jitanRemaining = JITAN_SPINS;
        state.rushChain = 0;
        state.currentRushPayout = 0;
        state.stRemaining = 0;
    } else {
        // 純通常: RUSH終了
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
        state.jitanRemaining = 0;
    }

    checkMachineUnlocks();
    return { type, payout };
}

// ============================================================
// 遊タイム
// ============================================================

function getYutimeThreshold(m) {
    if (m.yutimeThreshold > 0) return m.yutimeThreshold;
    return Math.round((1 / m.prob) * m.yutimeMult);
}

function checkYutime() {
    // 遊タイムは通常モードでのみ発動（時短・確変・ST中は発動しない）
    if (state.mode !== MODE_NORMAL) return;
    if (state.yutimeTriggered) return;

    const m = getCurrentMachine();
    const threshold = getYutimeThreshold(m);
    if (state.sinceLastJackpot >= threshold) {
        state.yutimeTriggered = true;
        // 遊タイム → 無限時短（通常確率で10000回転）
        state.mode = MODE_JITAN;
        state.jitanRemaining = JITAN_SPINS;
        state.rushChain = 0;
        state.currentRushPayout = 0;
        state.stRemaining = 0;
        showYutimeBanner();
    }
}

// ============================================================
// 自動化
// ============================================================

let autoBuyTimer = 0;

function processAutoBuyer(dt) {
    if (!state.autoBuyer) return;
    autoBuyTimer += dt;
    if (autoBuyTimer < 1.0) return;
    autoBuyTimer = 0;

    let cheapest = null;
    let cheapestCost = Infinity;

    UPGRADES.forEach(upg => {
        if (state.autoBuyerExcludes.includes(upg.id)) return;
        if (state.upgrades[upg.id] >= upg.maxLevel) return;
        const cost = getUpgradeCost(upg);
        if (cost < cheapestCost && state.balls >= cost) {
            cheapest = upg;
            cheapestCost = cost;
        }
    });

    if (cheapest) {
        state.balls -= cheapestCost;
        state.totalInvest += cheapestCost;
        state.upgrades[cheapest.id]++;
        cheapest.apply(state);
        applyAllUpgrades();
    }
}

function processAutoPrestige() {
    if (!state.autoPrestige) return;
    if (state.jackpots >= getPrestigeThreshold()) {
        executePrestige(true);
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
        const effectiveSpinRate = isPremium ? state.spinRate * PREMIUM_SPEED_MULTIPLIER : state.spinRate;
        spinAccumulator += effectiveSpinRate * dt;
        const spinsThisFrame = Math.floor(spinAccumulator);
        spinAccumulator -= spinsThisFrame;

        let frameJackpots = 0;
        let framePayout = 0;
        let frameJackpotType = null;

        for (let i = 0; i < spinsThisFrame; i++) {
            const isRushMode = state.mode === MODE_KAKUHEN || state.mode === MODE_ST;
            const isJitan = state.mode === MODE_JITAN;
            let actualCost;
            if (isRushMode) {
                actualCost = state.costPerSpin * 0.1;
            } else if (isJitan) {
                actualCost = state.costPerSpin * JITAN_COST_MULTIPLIER;
            } else {
                actualCost = state.costPerSpin;
            }
            state.balls -= actualCost;
            state.totalInvest += actualCost;
            state.spins++;

            // 遊タイムゲージ: 確変/ST中は凍結、通常/時短中は増加
            if (!isRushMode) {
                state.sinceLastJackpot++;
            }

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

            // 時短消化
            if (state.mode === MODE_JITAN) {
                state.jitanRemaining--;
                if (state.jitanRemaining <= 0) {
                    state.mode = MODE_NORMAL;
                    state.jitanRemaining = 0;
                }
            }

            // 玉が0以下になったら自動借金
            if (state.balls < 0 && state.autoInvest) {
                state.balls = 0;
                takeLoan();
            } else if (state.balls < 0) {
                state.balls = 0;
            }

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

    // 自動化処理
    processAutoBuyer(dt);
    processAutoPrestige();

    // 借金利息計算
    processDebtInterest();

    updateUI();
    requestAnimationFrame(gameLoop);
}
