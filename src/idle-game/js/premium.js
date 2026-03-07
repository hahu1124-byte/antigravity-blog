/**
 * パチンコ放置ゲーム — Premium・Portal連携
 */

function handlePortalMessage(e) {
    if (!e.data?.type) return;

    switch (e.data.type) {
        case 'premium-status':
            isPremium = !!e.data.isPaid;
            updatePremiumUI();
            if (isPremium) {
                window.parent.postMessage({ type: 'load-cloud-save' }, '*');
            }
            break;

        case 'cloud-save-data':
            if (e.data.data) {
                const cloudSave = e.data.data;
                if (cloudSave.lastSave && cloudSave.lastSave > state.lastSave) {
                    state = {
                        ...DEFAULT_STATE,
                        ...cloudSave,
                        upgrades: { ...DEFAULT_STATE.upgrades, ...cloudSave.upgrades },
                        unlockedMachines: cloudSave.unlockedMachines || ['amadeji'],
                        currentMachineId: cloudSave.currentMachineId || 'amadeji',
                    };
                    applyAllUpgrades();
                    checkMachineUnlocks();
                    renderShop();
                    renderMachineSelector();
                    console.log('☁️ クラウドセーブを復元しました');
                }
            }
            break;

        case 'cloud-save-result':
            if (e.data.success) {
                showSaveStatus('☁️ 同期済み');
            }
            break;
    }
}

function updatePremiumUI() {
    let badge = document.getElementById('premiumBadge');
    if (isPremium) {
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'premiumBadge';
            badge.className = 'premium-badge';
            badge.textContent = '💎 プレミアム';
            const statusBar = document.querySelector('.status-bar');
            if (statusBar) statusBar.appendChild(badge);
        }
        badge.style.display = '';
        // Premiumアップグレードが追加されるのでショップ再描画
        renderShop();
    } else if (badge) {
        badge.style.display = 'none';
    }
}

function showSaveStatus(text) {
    dom.saveStatus.textContent = text;
    setTimeout(() => { dom.saveStatus.textContent = '待機中'; }, 2000);
}

function sendCloudSave() {
    if (!isPremium) return;
    window.parent.postMessage({ type: 'save-game', data: state }, '*');
}
