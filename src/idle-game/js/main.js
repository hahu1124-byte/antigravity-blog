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
        dom.offlineBanner.classList.add('closing');
        dom.offlineBanner.addEventListener('animationend', () => {
            dom.offlineBanner.classList.add('hidden');
            dom.offlineBanner.classList.remove('closing');
            saveGame();
        }, { once: true });
    });

    dom.resetBtn.addEventListener('click', resetGame);
    dom.prestigeBtn.addEventListener('click', doPrestige);

    // 統計ポップアップ
    document.getElementById('statsToggle').addEventListener('click', () => {
        document.getElementById('statsPopup').classList.remove('hidden');
    });
    document.getElementById('statsPopupClose').addEventListener('click', () => {
        document.getElementById('statsPopup').classList.add('hidden');
    });
    document.getElementById('statsPopup').addEventListener('click', (e) => {
        if (e.target.id === 'statsPopup') {
            e.target.classList.add('hidden');
        }
    });

    // 機種情報ポップアップ
    document.getElementById('machineInfoBtn').addEventListener('click', () => {
        renderMachineInfoPopup();
        document.getElementById('machineInfoPopup').classList.remove('hidden');
    });
    document.getElementById('machineInfoClose').addEventListener('click', () => {
        document.getElementById('machineInfoPopup').classList.add('hidden');
    });
    document.getElementById('machineInfoPopup').addEventListener('click', (e) => {
        if (e.target.id === 'machineInfoPopup') {
            e.target.classList.add('hidden');
        }
    });

    // アチーブメントポップアップ
    document.getElementById('achievementBtn').addEventListener('click', () => {
        renderAchievementPopup();
        document.getElementById('achievementPopup').classList.remove('hidden');
    });
    document.getElementById('achievementClose').addEventListener('click', () => {
        document.getElementById('achievementPopup').classList.add('hidden');
    });
    document.getElementById('achievementPopup').addEventListener('click', (e) => {
        if (e.target.id === 'achievementPopup') {
            e.target.classList.add('hidden');
        }
    });

    // リールクリック（隠しアチーブメント用）
    document.getElementById('reelContainer').addEventListener('click', () => {
        state.reelClicks = (state.reelClicks || 0) + 1;
    });

    dom.repayBtn.addEventListener('click', repayDebt);
    dom.repayPartialBtn.addEventListener('click', repayPartial);
    dom.loanBtn.addEventListener('click', takeLoan);

    // ショップクリックイベント（イベント委譲、初回のみ）
    dom.shopGrid.addEventListener('click', (e) => {
        // チェックボックスクリック時はスキップ（change側で処理）
        if (e.target.classList.contains('autobuy-cb')) return;
        const card = e.target.closest('[data-upgrade-id]');
        if (!card) return;
        const upgId = card.dataset.upgradeId;
        // オートバイヤー購入済み: autoBuyerカードクリックでON/OFFトグル
        if (upgId === 'autoBuyer' && state.upgrades.autoBuyer >= 1) {
            state.autoBuyer = !state.autoBuyer;
            if (state.autoBuyer) {
                // ON: 全チェックボックスをON（excludes クリア）
                state.autoBuyerExcludes = [];
            } else {
                // OFF: 全チェックボックスをOFF（全アップグレードを除外）
                state.autoBuyerExcludes = getAllUpgrades().map(u => u.id);
            }
            saveGame();
            renderShop();
            return;
        }
        buyUpgrade(upgId);
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
        dom.rushSummary.classList.add('closing');
        dom.rushSummary.addEventListener('animationend', () => {
            dom.rushSummary.classList.add('hidden');
            dom.rushSummary.classList.remove('closing');
        }, { once: true });
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
