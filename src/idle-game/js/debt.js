/**
 * パチンコ放置ゲーム — 借金システム
 */

function takeLoan() {
    state.debt += DEBT_UNIT_BALLS;
    state.balls += DEBT_UNIT_BALLS;
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
        state.debt = state.debt * Math.pow(1 + DEBT_INTEREST_RATE, periods);
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
    } else {
        state.debt -= state.balls;
        state.balls = 0;
    }
    saveGame();
}
