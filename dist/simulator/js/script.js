/* --- 動き (JavaScript) --- */
const SPECS = { n: 319.7, s: 99.4, st: 163, jt: 100 };
let hits = 0, rushCount = 0, currentRot = 0, totalRot = 0, totalBall = 0, currentRushHits = 0, maxHamari = 0;
let mode = '通常', rRem = 0, isAuto = false, autoSpeed = 'slow', isAnim = false;
let lcdCount = 0, optKokuchi = false;
let leftStock = [], rightStock = [];
let activeJob = null;
let slumpData = [0], slumpLabels = ["0"], historyData = [], historyLabels = [];
let sChart, hChart, firstHitRot = 0, rushSeriesCount = 0;

// 正しい抽選フロー：先に当たり外れを決め、それに合わせて演出を抽選する
function createJob(isRight = false) {
    const isHit = Math.random() < (1 / (mode === '通常' || mode === '時短' ? SPECS.n : SPECS.s));
    let res = {
        isHit: isHit,
        isRight: isRight,
        heavy: false,
        name: [],
        trust: 0,
        vibe: false,
        vibeColor: "none",
        flash: false,
        text: "",
        holdType: "none",
        currentView: "none",
        isRushSure: false
    };

    const rMain = Math.random() * 100;
    const rSub = Math.random() * 100;

    if (isHit) {
        // 【当たり時の演出振り分け】
        if (mode === '通常' || mode === '時短') {
            // メインリーチ・背景系
            if (rMain < 1) { res.name.push("全回転リーチ"); res.isRushSure = true; res.text = "祝"; res.trust = Math.max(res.trust, 100); }
            else if (rMain < 3) { res.name.push("突発当り"); res.isRushSure = true; res.vibe = true; res.vibeColor = "rainbow"; res.trust = Math.max(res.trust, 100); }
            else if (rMain < 6) { res.name.push("虹レバ"); res.vibe = true; res.vibeColor = "rainbow"; res.isRushSure = true; res.trust = Math.max(res.trust, 100); }
            else if (rMain < 10) { res.name.push("渚カヲル"); res.isRushSure = true; res.trust = Math.max(res.trust, 100); }
            else if (rMain < 15) { res.name.push("最終号機リーチ"); res.text = "最終号機\n画ブレ金"; res.vibe = true; res.vibeColor = "red"; res.trust = Math.max(res.trust, 98.0); }
            else if (rMain < 25) { res.name.push("赤レバ"); res.vibe = true; res.vibeColor = "red"; res.trust = Math.max(res.trust, 96.5); }
            else if (rMain < 40) { res.name.push("白レバ"); res.vibe = true; res.vibeColor = "white"; res.trust = Math.max(res.trust, 90.0); }
            else if (rMain < 55) { res.name.push("レイ背景"); res.text = "レイ背景"; res.trust = Math.max(res.trust, 85.0); }

            // 先読み・保留系 (全体で約1/1000の出現率になるよう、当たり時の占有率を計算)
            // 約1/320の当たりに対して約30%の占有率を持たせることで、全体1/1000に近付きます
            if (rSub < 30.4) { res.name.push("ロンギヌスの槍保留"); res.holdType = "vibe"; res.trust = Math.max(res.trust, 95.0); }
            else if (rSub < 56.0) { res.name.push("震える保留"); res.holdType = "vibe"; res.trust = Math.max(res.trust, 80.0); }
            else if (rSub < 85.4) { res.name.push("カウントダウン"); res.text = (res.text ? res.text + "\n" : "") + "３２１０"; res.trust = Math.max(res.trust, 92.0); }
            else if (rSub < 95.0) { res.name.push("赤保留"); res.holdType = "red"; res.trust = Math.max(res.trust, 90.0); }
        } else {
            // ST中当たり演出
            if (rMain < 5) { res.name.push("突発当り"); res.vibe = true; res.vibeColor = "rainbow"; res.trust = Math.max(res.trust, 100); }
            else if (rMain < 15) { res.name.push("ST次回予告"); res.text = "次回予告"; res.trust = Math.max(res.trust, 100); }
            else if (rMain < 30) { res.name.push("STレイ背景"); res.text = "レイ背景"; res.trust = Math.max(res.trust, 100); }
            else if (rMain < 50) { res.name.push("ST赤レバ"); res.vibe = true; res.vibeColor = "red"; res.trust = Math.max(res.trust, 99.0); }

            if (rSub < 60) { res.name.push("ST赤保留"); res.holdType = "red"; res.trust = Math.max(res.trust, 95.0); }
        }
    } else {
        // 【外れ時の演出振り分け】
        // ！！修正箇所！！
        // ハズレは当たりに比べて約318倍発生するため、ハズレ時に表示される確率は
        // 当たり時の確率の「318分の1以下」にしなければ、本来の信頼度にはならない（分母の罠の解消）。
        // 目標信頼度 = 当たり時の振り分け / (当たり時振り分け + ハズレ時振り分け比率*318)
        if (mode === '通常' || mode === '時短') {
            // メインリーチ・背景系
            if (rMain < 0.001) { res.name.push("最終号機リーチ"); res.text = "最終号機\n画ブレ銀"; res.trust = Math.max(res.trust, 98.0); }
            else if (rMain < 0.005) { res.name.push("赤レバ"); res.vibe = true; res.vibeColor = "red"; res.trust = Math.max(res.trust, 96.5); }
            else if (rMain < 0.012) { res.name.push("白レバ"); res.vibe = true; res.vibeColor = "white"; res.trust = Math.max(res.trust, 90.0); }
            else if (rMain < 0.035) { res.name.push("レイ背景"); res.text = "レイ背景"; res.trust = Math.max(res.trust, 85.0); }

            // 先読み・保留系 (全体で約1/1000の出現率になるよう、ハズレ時確率を逆算)
            if (rSub < 0.005) { res.name.push("ロンギヌスの槍保留"); res.holdType = "vibe"; res.trust = Math.max(res.trust, 95.0); }
            else if (rSub < 0.025) { res.name.push("震える保留"); res.holdType = "vibe"; res.trust = Math.max(res.trust, 80.0); }
            else if (rSub < 0.033) { res.name.push("カウントダウン"); res.text = (res.text ? res.text + "\n" : "") + "３２１・"; res.trust = Math.max(res.trust, 92.0); }
            else if (rSub < 0.040) { res.name.push("赤保留"); res.holdType = "red"; res.trust = Math.max(res.trust, 90.0); }
            else if (rSub < 0.840) { res.name.push("緑保留"); res.holdType = "green"; res.trust = Math.max(res.trust, 11.0); }
            else if (rSub < 4.840) { res.name.push("青保留"); res.holdType = "blue"; res.trust = Math.max(res.trust, 3.0); }

            if (res.name.length === 0) { res.name.push("通常"); res.trust = 0.1; }
        } else {
            // ST中外れ演出 (ST中はハズレが約98回/1回当たり となるため比率は約98倍)
            // ST赤保留(95.0%目標) 当たり時60%: 60 / (60 + X*98) = 0.95 -> 約 0.032%
            if (rSub < 0.032) { res.name.push("ST赤保留"); res.holdType = "red"; res.trust = Math.max(res.trust, 95.0); }
            // ST緑保留(20.0%目標) 当たり時0%: チャンス演出としてハズレ時 約1.0%
            else if (rSub < 1.032) { res.name.push("ST緑保留"); res.holdType = "green"; res.trust = Math.max(res.trust, 20.0); }
            if (res.name.length === 0) { res.name.push("通常"); res.trust = 0.1; }
        }
    }

    // 保留の見た目決定
    if (res.holdType === "red" || (res.vibe && !res.isRushSure)) {
        let rr = Math.random();
        res.currentView = rr < 0.4 ? "blue" : (rr < 0.8 ? "green" : "red");
    } else if (res.holdType === "vibe") {
        res.currentView = "vibe";
    } else { res.currentView = res.holdType; }

    res.heavy = (res.trust >= 50);
    res.displayName = Array.from(new Set(res.name)).join("+").replace(/ST/g, "") || "通常";
    return res;
}

// --- 以下、システムロジック (変更なし) ---
async function startProcess() {
    if (!isAuto || isAnim) return;
    if (mode !== '通常' && rRem <= 0) {
        addLog(`【${mode}終了】 ${currentRushHits}連`);
        rushSeriesCount++; historyData.push(firstHitRot); historyLabels.push(`${rushSeriesCount}回目(${currentRushHits}連)`); hChart.update();
        mode = '通常'; currentRushHits = 0; firstHitRot = 0; updateUI();
    }

    if (rightStock.length > 0) {
        activeJob = rightStock.shift();
    } else if (leftStock.length > 0) {
        activeJob = leftStock.shift();
    } else {
        refillStock();
        activeJob = (mode === '通常') ? leftStock.shift() : rightStock.shift();
    }

    if (activeJob) activeJob.currentView = activeJob.holdType;
    refillStock(); updateUI();
    let eff = activeJob;
    if (optKokuchi && eff.isHit) { eff.flash = true; eff.trust = 100; eff.displayName = "インフラ告知"; }
    totalRot++; currentRot++; lcdCount++;
    if (mode !== '通常') { rRem--; }
    if (eff.isRight) { totalBall -= 0.05; } else { totalBall -= 13.8; }
    updateCharts();
    // trustが50以上（激熱以上）、または当落が確定している場合のみログに出力
    if (eff.trust >= 50.0 || eff.isHit) { addLog(`${mode} ${lcdCount}回転【${eff.displayName}】信頼度:${eff.trust.toFixed(1)}%`); }
    const machineEl = document.getElementById('machine'), screenEl = document.getElementById('screen');
    if (eff.vibe) { machineEl.classList.add('vibrate', 'vibe-' + eff.vibeColor); screenEl.classList.add('vibrate', 'vibe-' + eff.vibeColor); }
    const vStockEl = document.getElementById('v-stock');
    if (vStockEl) vStockEl.style.display = 'none';
    if (eff.flash) document.getElementById('lamp').classList.add('lamp-active');
    if (eff.text) { const ov = document.getElementById('effect-overlay'); ov.innerText = eff.text; ov.style.display = 'block'; }
    let currentSpeed = autoSpeed;

    // 消化中(eff) または その次 の変動が信頼度50%以上かチェック
    let hasSakiyomiOrIkiatsu = false;
    let nextJob = rightStock.length > 0 ? rightStock[0] : (leftStock.length > 0 ? leftStock[0] : null);
    for (let j of [eff, nextJob]) {
        if (j && j.trust >= 50.0) {
            hasSakiyomiOrIkiatsu = true;
            break;
        }
    }

    // 高速オート中、先読み演出または激アツが来た場合はそのタイミングで低速にする
    if (autoSpeed === 'fast' && hasSakiyomiOrIkiatsu) {
        currentSpeed = 'slow';
    }

    // スピード調整。高速オート(fast)時は5ms、低速オート・チャンス時(slow)は600ms、激熱(heavy)は1800ms
    let spinTime = (eff.heavy) ? 1800 : (currentSpeed === 'fast' ? 5 : 600);
    let spinInterval = currentSpeed === 'fast' ? 5 : 40;
    let spin = setInterval(() => { [1, 2, 3].forEach(i => { let n = Math.floor(Math.random() * 9) + 1; const el = document.getElementById('d' + i); el.innerText = n; el.className = getDigitClass(n, mode); }); }, spinInterval);
    await new Promise(r => setTimeout(r, spinTime));
    clearInterval(spin);
    let finalNums, hitDigit;
    if (eff.isHit) {
        if (eff.isRushSure && (mode === '通常' || mode === '時短')) {
            hitDigit = [1, 3, 5, 9][Math.floor(Math.random() * 4)];
        } else {
            let rand = Math.random() * 100;
            if (mode === '通常' || mode === '時短') {
                if (rand < 3) hitDigit = 7;
                else if (rand < 44) { hitDigit = [2, 4, 6, 8][Math.floor(Math.random() * 4)]; }
                else { hitDigit = [1, 3, 5, 9][Math.floor(Math.random() * 4)]; }
            } else { hitDigit = (Math.random() < 0.5) ? 3 : 1; }
        }
        finalNums = [hitDigit, hitDigit, hitDigit];
    } else { finalNums = generateFinalDigits(); }
    [1, 3, 2].forEach(i => { const el = document.getElementById('d' + i); el.innerText = finalNums[i - 1]; el.className = getDigitClass(finalNums[i - 1], mode); });
    machineEl.classList.remove('vibrate', 'vibe-white', 'vibe-red', 'vibe-rainbow');
    screenEl.classList.remove('vibrate', 'vibe-white', 'vibe-red', 'vibe-rainbow');
    document.getElementById('lamp').classList.remove('lamp-active');
    document.getElementById('effect-overlay').style.display = 'none';
    if (eff.isHit) {
        isAnim = true; hits++;
        if (mode === '通常') {
            firstHitRot = lcdCount;
            if (currentRot > maxHamari) { maxHamari = currentRot; document.getElementById('max-hamari-box').innerText = `最大ハマリ: ${maxHamari}`; }
        }
        let bonusBall, isST = false, needsUpgrade = false, isRightUpgrade = false, originalHit = hitDigit;
        if (!eff.isRight) {
            rushCount = 1;
            if (eff.isRushSure) { isST = true; bonusBall = 420; addLog(">> プレミアム演出！！"); }
            else if (originalHit === 7) { isST = true; bonusBall = 1400; addLog(">> 全回転！！"); }
            else if (originalHit % 2 !== 0) { isST = true; bonusBall = 420; }
            else { if (Math.random() < 0.20) { isST = true; needsUpgrade = true; bonusBall = 420; } else { isST = false; bonusBall = 420; } }
        } else {
            isST = true; bonusBall = 1400; isRightUpgrade = true;
            if (mode === '通常') {
                rushCount = 1;
                addLog(`>> 右打ち残保留（特図2）で引き戻し！！ 【${originalHit}】`);
            } else if (mode === '時短') {
                addLog(`>> 時短引き戻し成功！ 【${originalHit}】`);
            } else {
                rushCount++;
            }
        }
        addLog(`>> 当たり！ 【${originalHit}】${lcdCount}回転`);
        totalBall += bonusBall; currentRot = 0;

        if (mode !== '通常') {
            const hasStockHit = rightStock.some(job => job.isHit);
            if (hasStockHit && vStockEl) {
                vStockEl.style.display = 'block';
                addLog(">> Vストック獲得！！（保留連確定）");
            }
        }

        await new Promise(r => setTimeout(r, 1000));
        if (mode === '通常' && needsUpgrade) {
            let nextOdd = [1, 3, 5, 9][Math.floor(Math.random() * 4)];
            addLog(`>> ${nextOdd}図柄へ昇格！！`);
            document.getElementById('lamp').classList.add('lamp-active');
            [1, 2, 3].forEach(i => { const el = document.getElementById('d' + i); el.innerText = nextOdd; el.className = 'digit odd'; });
            await new Promise(r => setTimeout(r, 800));
            document.getElementById('lamp').classList.remove('lamp-active');
        }
        if (isRightUpgrade) {
            machineEl.classList.add('vibe-rainbow');
            document.getElementById('lamp').classList.add('lamp-active');
            [1, 2, 3].forEach(i => { const el = document.getElementById('d' + i); el.innerText = 7; el.className = 'digit gold'; });
            await new Promise(r => setTimeout(r, 1000));
            machineEl.classList.remove('vibe-rainbow');
            document.getElementById('lamp').classList.remove('lamp-active');
        }
        if (isST) { mode = 'ST'; rRem = SPECS.st; } else { mode = '時短'; rRem = SPECS.jt; }
        currentRushHits++; lcdCount = 0; updateUI();
        await new Promise(r => setTimeout(r, 600));
    }
    isAnim = false; updateUI(); updateAutoBtns();
    // 次回転への待機時間も調整（高速時は5ms、低速時は150ms）
    let nextDelay = (currentSpeed === 'fast') ? 5 : 150;
    if (isAuto) setTimeout(startProcess, nextDelay);
}

function getDigitClass(num, currentMode) {
    if (num === 7 && (currentMode !== '通常')) return 'digit gold';
    return (num % 2 !== 0) ? 'digit odd' : 'digit even';
}

function generateFinalDigits() {
    let d1 = Math.floor(Math.random() * 9) + 1;
    let d3 = Math.floor(Math.random() * 9) + 1;
    let d2 = Math.floor(Math.random() * 9) + 1;
    if (Math.random() < 0.25) {
        d3 = d1;
        while (d2 === d1) d2 = Math.floor(Math.random() * 9) + 1;
    } else {
        while (d1 === d3) d3 = Math.floor(Math.random() * 9) + 1;
    }
    if (d1 === d2 && d2 === d3) return generateFinalDigits();
    return [d1, d2, d3];
}

function refillStock() {
    if (mode === '通常') {
        while (leftStock.length < 4) leftStock.push(createJob(false));
    } else {
        while (rightStock.length < 4) rightStock.push(createJob(true));
    }
    updateHesoUI();
}

function updateHesoUI() {
    const isRightMode = mode !== '通常';
    const hesoArea = document.getElementById('heso-area');
    const denchuArea = document.getElementById('denchu-area');

    if (isRightMode) {
        if (hesoArea) hesoArea.style.display = 'none';
        if (denchuArea) denchuArea.style.display = 'flex';
    } else {
        if (hesoArea) hesoArea.style.display = 'flex';
        if (denchuArea) denchuArea.style.display = 'none';
    }

    const countDisplay = document.getElementById('stock-count-display');
    if (countDisplay) {
        countDisplay.innerText = `${leftStock.length} / ${rightStock.length}`;
    }

    // 左保留(ヘソ)の描画
    for (let i = 0; i <= 4; i++) {
        const el = document.getElementById('h' + i);
        if (!el) continue;
        let s = null;
        if (i === 0) {
            s = (activeJob && !activeJob.isRight) ? activeJob : null;
        } else {
            s = leftStock[i - 1] || null;
        }
        el.className = `heso-ball ${i === 0 ? 'heso-current' : ''}`;
        if (s) {
            el.classList.add('heso-' + s.currentView);
        }
    }

    // 右保留(電チュー)の描画
    for (let i = 0; i <= 4; i++) {
        const el = document.getElementById('d_h' + i);
        if (!el) continue;
        let s = null;
        if (i === 0) {
            s = (activeJob && activeJob.isRight) ? activeJob : null;
        } else {
            s = rightStock[i - 1] || null;
        }
        el.className = `heso-ball ${i === 0 ? 'heso-current' : ''}`;
        if (s) {
            el.classList.add('heso-' + s.currentView);
        }
    }
}

function toggleAuto(s) {
    if (isAuto && autoSpeed === s) {
        isAuto = false;
    } else {
        isAuto = true;
        autoSpeed = s;
        if (!isAnim) startProcess();
    }
    updateAutoBtns();
}

function updateAutoBtns() {
    document.getElementById('btn-slow').classList.toggle('btn-stop', isAuto && autoSpeed === 'slow');
    document.getElementById('btn-fast').classList.toggle('btn-stop', isAuto && autoSpeed === 'fast');
}

function toggleOpt(t) {
    if (t === 'kokuchi') optKokuchi = !optKokuchi;
    document.getElementById('btn-' + t).classList.toggle('active');
}

function updateUI() {
    document.getElementById('hits').innerText = hits;
    document.getElementById('rush-count').innerText = rushCount;
    document.getElementById('current-rot').innerText = currentRot;
    document.getElementById('total-rot').innerText = totalRot;
    document.getElementById('balance').innerText = Math.floor(totalBall).toLocaleString();
    document.getElementById('sub-display').innerText = mode === '通常' ? `通常:${lcdCount}` : `${mode}:${rRem}`;
    updateHesoUI();
}

function addLog(m) {
    const l = document.getElementById('log');
    l.innerHTML = `> ${m}<br>${l.innerHTML}`;
}

function initCharts() {
    sChart = new Chart(document.getElementById('slumpChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: slumpLabels,
            datasets: [{
                label: '差玉',
                data: slumpData,
                borderColor: '#8a2be2',
                borderWidth: 2,
                fill: false,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    hChart = new Chart(document.getElementById('historyChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: historyLabels,
            datasets: [{
                label: '初当り回転',
                data: historyData,
                backgroundColor: '#ff4444'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function updateCharts() {
    slumpData.push(totalBall);
    slumpLabels.push(totalRot.toString());
    sChart.update('none');
}

function openModal() {
    document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}

function resetData() {
    if (confirm('データをリセットしますか？')) location.reload();
}

// --- ダークモード・ライトモード切り替え ---
function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('btn-theme');
    body.classList.toggle('light-mode');
    if (body.classList.contains('light-mode')) {
        btn.innerText = "ダーク🌙";
    } else {
        btn.innerText = "ライト☀️";
    }
}

window.onload = () => {
    initCharts();
    refillStock();
    updateUI();
};
