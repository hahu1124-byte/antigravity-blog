/**
 * パチンコ放置ゲーム — 初期化・イベントリスナー
 */

function init() {
    const hasData = loadGame();

    if (hasData) {
        calculateOffline();
    }

    renderShop();
    renderMachineSelector();

    // イベントリスナー登録（全て初回のみ）
    dom.offlineClose.addEventListener('click', () => {
        dom.offlineBanner.classList.add('hidden');
        saveGame();
    });

    dom.resetBtn.addEventListener('click', resetGame);
    dom.prestigeBtn.addEventListener('click', doPrestige);
    dom.repayBtn.addEventListener('click', repayDebt);
    dom.loanBtn.addEventListener('click', takeLoan);

    // ショップクリックイベント（イベント委譲、初回のみ）
    dom.shopGrid.addEventListener('click', (e) => {
        const card = e.target.closest('[data-upgrade-id]');
        if (!card) return;
        buyUpgrade(card.dataset.upgradeId);
    });

    // レート選択イベント
    dom.rateGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-rate]');
        if (!btn) return;
        switchRate(Number(btn.dataset.rate));
    });

    // バージョン表示
    dom.versionDisplay.textContent = GAME_VERSION;

    // レートボタン初期状態を同期
    dom.rateGrid.querySelectorAll('.rate-btn').forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.rate) === YEN_PER_BALL);
    });

    dom.rushSummaryClose.addEventListener('click', () => {
        dom.rushSummary.classList.add('hidden');
    });

    // Portal postMessage連携
    window.addEventListener('message', handlePortalMessage);
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
