/**
 * パチンコ放置ゲーム — 借金システム
 */

function getDebtLoanBalls() {
    return Math.floor(DEBT_UNIT_YEN / YEN_PER_BALL);
}

function getDebtRepayBalls() {
    return Math.floor(DEBT_REPAY_UNIT_YEN / YEN_PER_BALL);
}

function takeLoan() {
    const loanBalls = getDebtLoanBalls();
    state.debt += loanBalls;
    state.balls += loanBalls;
    state.totalInvest += loanBalls; // 借金を収支に反映
    if (state.lastDebtTime === 0) {
        state.lastDebtTime = Date.now();
    }
    if (state.debtStartTime === 0) {
        state.debtStartTime = Date.now();
    }
}

function processDebtInterest() {
    if (state.debt <= 0) return;
    const now = Date.now();
    if (state.lastDebtTime === 0) state.lastDebtTime = now;
    const elapsed = now - state.lastDebtTime;
    if (elapsed >= DEBT_INTERVAL_MS) {
        const periods = Math.floor(elapsed / DEBT_INTERVAL_MS);
        const before = state.debt;
        state.debt = state.debt * Math.pow(1 + DEBT_INTEREST_RATE, periods);
        state.lastInterest = state.debt - before;
        state.accumulatedInterest += state.debt - before;
        state.lastDebtTime = now - (elapsed % DEBT_INTERVAL_MS);
    }
}

function repayDebt() {
    if (state.debt <= 0) return;
    const debtBalls = Math.ceil(state.debt);
    if (state.balls >= debtBalls) {
        state.balls -= debtBalls;
        state.debt = 0;
        state.lastDebtTime = 0;
        state.debtStartTime = 0;
        state.lastInterest = 0;
        state.accumulatedInterest = 0;
    } else {
        state.debt -= state.balls;
        state.balls = 0;
    }
    saveGame();
}

function repayPartial() {
    if (state.debt <= 0) return;
    const repayBalls = getDebtRepayBalls();
    if (state.balls < repayBalls) return;
    if (state.debt <= repayBalls) {
        // 残債が返済単位以下なら全額返済
        repayDebt();
        return;
    }
    state.balls -= repayBalls;
    state.debt -= repayBalls;
    saveGame();
}
