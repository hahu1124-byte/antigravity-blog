// ========================================
// 定数・状態
// ========================================
const STEPS = 16;
const PARTS = [
    { id: 'kick', name: 'Kick', color: 'var(--clr-kick)' },
    { id: 'snare', name: 'Snare', color: 'var(--clr-snare)' },
    { id: 'hihatC', name: 'HH Close', color: 'var(--clr-hihat-c)' },
    { id: 'hihatO', name: 'HH Open', color: 'var(--clr-hihat-o)' },
    { id: 'clap', name: 'Clap', color: 'var(--clr-clap)' },
    { id: 'tom', name: 'Tom', color: 'var(--clr-tom)' },
];

// パターンデータ: parts[partId][stepIndex] = true/false
const pattern = {};
PARTS.forEach(p => { pattern[p.id] = new Array(STEPS).fill(false); });

// 各パートの音量 (0-1)
const partVolume = {};
PARTS.forEach(p => { partVolume[p.id] = 0.8; });

let bpm = 120;
let swing = 0;       // 0-100
let masterVol = 0.8;
let isPlaying = false;
let currentStep = -1;
let nextNoteTime = 0;
let timerID = null;

// トラック音量・状態
const trackState = {
    drum: { vol: 0.8, muted: false, soloed: false },
    melody: { vol: 0.8, muted: false, soloed: false },
    bass: { vol: 0.8, muted: false, soloed: false },
};

// ベースパターンデータ
const bassNotes = new Array(STEPS).fill(null);
let bassInitialized = false;

// Web Audio & Bus ノード
let ctx;
let masterGain, drumBus, melodyBus, bassBus;
// エフェクトノード
let fxFilter, fxDistortion, fxDelayNode, fxDelayFeedback, fxDelayDry, fxDelayWet;
let fxReverbConvolver, fxReverbDry, fxReverbWet;
let fxInitialized = false;

function getCtx() {
    if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        initAudioRouting();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

// オーディオルーティング初期化
function initAudioRouting() {
    const c = ctx;

    // マスターゲイン
    masterGain = c.createGain();
    masterGain.gain.value = masterVol;

    // トラックバス
    drumBus = c.createGain();
    drumBus.gain.value = trackState.drum.vol;
    melodyBus = c.createGain();
    melodyBus.gain.value = trackState.melody.vol;
    bassBus = c.createGain();
    bassBus.gain.value = trackState.bass.vol;

    // Bus → masterGain
    drumBus.connect(masterGain);
    melodyBus.connect(masterGain);
    bassBus.connect(masterGain);

    // エフェクトチェーン構築
    buildFxChain();
}

// エフェクトチェーン: masterGain → Filter → Distortion → Delay → Reverb → destination
function buildFxChain() {
    const c = ctx;

    // Filter
    fxFilter = c.createBiquadFilter();
    fxFilter.type = 'lowpass';
    fxFilter.frequency.value = 8000;
    fxFilter.Q.value = 1.0;

    // Distortion
    fxDistortion = c.createWaveShaper();
    fxDistortion.curve = makeDistortionCurve(0);
    fxDistortion.oversample = '4x';

    // Delay (dry/wet パラレル)
    fxDelayNode = c.createDelay(2.0);
    fxDelayNode.delayTime.value = 0.3;
    fxDelayFeedback = c.createGain();
    fxDelayFeedback.gain.value = 0.4;
    fxDelayDry = c.createGain();
    fxDelayDry.gain.value = 1.0;
    fxDelayWet = c.createGain();
    fxDelayWet.gain.value = 0.0; // OFF by default

    // Reverb (dry/wet パラレル)
    fxReverbConvolver = c.createConvolver();
    fxReverbConvolver.buffer = createReverbIR(c, 1.5);
    fxReverbDry = c.createGain();
    fxReverbDry.gain.value = 1.0;
    fxReverbWet = c.createGain();
    fxReverbWet.gain.value = 0.0; // OFF by default

    // --- 接続 ---
    // masterGain → Filter → Distortion → (Delay split) → (Reverb split) → destination
    // Filter OFF = バイパス (高カットオフで音が変わらない)
    masterGain.connect(fxFilter);
    fxFilter.connect(fxDistortion);

    // Delay: dry + wet (feedback loop)
    fxDistortion.connect(fxDelayDry);
    fxDistortion.connect(fxDelayNode);
    fxDelayNode.connect(fxDelayFeedback);
    fxDelayFeedback.connect(fxDelayNode); // feedback loop
    fxDelayNode.connect(fxDelayWet);

    // Delay out → Reverb merger (GainNode)
    const delayMerge = c.createGain();
    fxDelayDry.connect(delayMerge);
    fxDelayWet.connect(delayMerge);

    // Reverb: dry + wet
    delayMerge.connect(fxReverbDry);
    delayMerge.connect(fxReverbConvolver);
    fxReverbConvolver.connect(fxReverbWet);

    fxReverbDry.connect(c.destination);
    fxReverbWet.connect(c.destination);

    fxInitialized = true;
}

// ディストーションカーブ生成
function makeDistortionCurve(amount) {
    const k = amount;
    const samples = 44100;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = k === 0 ? x : ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return curve;
}

// リバーブIR生成（指数減衰ノイズ）
function createReverbIR(c, decay) {
    const sampleRate = c.sampleRate;
    const length = sampleRate * decay;
    const buf = c.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        }
    }
    return buf;
}

// エフェクトパラメータ更新
function updateFx() {
    if (!fxInitialized) return;

    // Filter
    const filterOn = document.getElementById('fxFilterOn').checked;
    const filterType = document.getElementById('fxFilterType').value;
    const cutoff = parseInt(document.getElementById('fxFilterCutoff').value);
    const q = parseInt(document.getElementById('fxFilterQ').value) / 10;
    fxFilter.type = filterOn ? filterType : 'lowpass';
    fxFilter.frequency.value = filterOn ? cutoff : 20000;
    fxFilter.Q.value = filterOn ? q : 0.1;
    document.getElementById('fxFilterCutoffVal').textContent = cutoff;
    document.getElementById('fxFilterQVal').textContent = q.toFixed(1);

    // Distortion
    const distOn = document.getElementById('fxDistOn').checked;
    const distAmount = parseInt(document.getElementById('fxDistAmount').value);
    fxDistortion.curve = makeDistortionCurve(distOn ? distAmount : 0);
    document.getElementById('fxDistAmountVal').textContent = distAmount;

    // Delay
    const delayOn = document.getElementById('fxDelayOn').checked;
    const delayTime = parseInt(document.getElementById('fxDelayTime').value);
    const delayFB = parseInt(document.getElementById('fxDelayFB').value);
    const delayMix = parseInt(document.getElementById('fxDelayMix').value);
    fxDelayNode.delayTime.value = delayTime / 1000;
    fxDelayFeedback.gain.value = delayFB / 100;
    fxDelayWet.gain.value = delayOn ? delayMix / 100 : 0;
    fxDelayDry.gain.value = delayOn ? 1 - (delayMix / 200) : 1;
    document.getElementById('fxDelayTimeVal').textContent = delayTime + 'ms';
    document.getElementById('fxDelayFBVal').textContent = delayFB + '%';
    document.getElementById('fxDelayMixVal').textContent = delayMix + '%';

    // Reverb
    const reverbOn = document.getElementById('fxReverbOn').checked;
    const reverbDecay = parseInt(document.getElementById('fxReverbDecay').value) / 10;
    const reverbMix = parseInt(document.getElementById('fxReverbMix').value);
    if (reverbOn) {
        fxReverbConvolver.buffer = createReverbIR(ctx, reverbDecay);
        fxReverbWet.gain.value = reverbMix / 100;
        fxReverbDry.gain.value = 1 - (reverbMix / 200);
    } else {
        fxReverbWet.gain.value = 0;
        fxReverbDry.gain.value = 1;
    }
    document.getElementById('fxReverbDecayVal').textContent = reverbDecay.toFixed(1) + 's';
    document.getElementById('fxReverbMixVal').textContent = reverbMix + '%';
}

// エフェクトパネル折りたたみ
function toggleFxPanel() {
    document.getElementById('fxPanel').classList.toggle('open');
}

// トラック音量設定
function setTrackVol(track, val) {
    trackState[track].vol = val / 100;
    applyTrackStates();
}

// ミュート/ソロ
function toggleMute(track) {
    trackState[track].muted = !trackState[track].muted;
    applyTrackStates();
}

function toggleSolo(track) {
    trackState[track].soloed = !trackState[track].soloed;
    applyTrackStates();
}

function applyTrackStates() {
    const tracks = ['drum', 'melody', 'bass'];
    const buses = { drum: drumBus, melody: melodyBus, bass: bassBus };
    const anySolo = tracks.some(t => trackState[t].soloed);

    tracks.forEach(t => {
        if (!buses[t]) return;
        let gain = trackState[t].vol;
        if (trackState[t].muted) gain = 0;
        else if (anySolo && !trackState[t].soloed) gain = 0;
        buses[t].gain.value = gain;

        // UI更新
        const cap = t.charAt(0).toUpperCase() + t.slice(1);
        const muteBtn = document.getElementById('mute' + cap);
        const soloBtn = document.getElementById('solo' + cap);
        if (muteBtn) muteBtn.classList.toggle('muted', trackState[t].muted);
        if (soloBtn) soloBtn.classList.toggle('soloed', trackState[t].soloed);
    });

    if (masterGain) masterGain.gain.value = masterVol;
}

// ========================================
// UI生成
// ========================================
function buildUI() {
    // ビートマーカー
    const marker = document.getElementById('beatMarker');
    for (let i = 0; i < STEPS; i++) {
        const el = document.createElement('span');
        el.className = 'beat-num' + (i % 4 === 0 ? ' downbeat' : '');
        el.textContent = i + 1;
        marker.appendChild(el);
    }

    // グリッド
    const grid = document.getElementById('grid');
    PARTS.forEach((part) => {
        const row = document.createElement('div');
        row.className = 'seq-row';

        // パート名
        const label = document.createElement('div');
        label.className = 'part-label';
        label.textContent = part.name;
        label.style.color = part.color;
        row.appendChild(label);

        // パート音量
        const vol = document.createElement('input');
        vol.type = 'range';
        vol.min = '0';
        vol.max = '100';
        vol.value = '80';
        vol.className = 'part-vol';
        vol.style.accentColor = part.color;
        vol.addEventListener('input', () => {
            partVolume[part.id] = vol.value / 100;
        });
        row.appendChild(vol);

        // ステップ
        const stepsDiv = document.createElement('div');
        stepsDiv.className = 'steps';
        for (let i = 0; i < STEPS; i++) {
            const step = document.createElement('div');
            step.className = 'step';
            step.style.setProperty('--part-color', part.color);
            step.dataset.part = part.id;
            step.dataset.step = i;

            // 4拍区切りの視覚分離
            if (i % 4 === 0 && i > 0) {
                step.style.marginLeft = '4px';
            }

            step.addEventListener('click', () => {
                pattern[part.id][i] = !pattern[part.id][i];
                step.classList.toggle('on', pattern[part.id][i]);
                // クリック時にプレビュー音を鳴らす
                if (pattern[part.id][i]) {
                    playSound(part.id, getCtx().currentTime);
                }
            });

            stepsDiv.appendChild(step);
        }
        row.appendChild(stepsDiv);
        grid.appendChild(row);
    });
}

// ========================================
// ドラム合成
// ========================================
function playSound(partId, time) {
    const c = getCtx();
    const vol = partVolume[partId];

    switch (partId) {
        case 'kick': {
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(160, time);
            osc.frequency.exponentialRampToValueAtTime(35, time + 0.12);
            gain.gain.setValueAtTime(vol * 0.9, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
            osc.connect(gain).connect(drumBus);
            osc.start(time);
            osc.stop(time + 0.35);

            // クリック成分
            const click = c.createOscillator();
            const cGain = c.createGain();
            click.type = 'square';
            click.frequency.setValueAtTime(1200, time);
            click.frequency.exponentialRampToValueAtTime(200, time + 0.02);
            cGain.gain.setValueAtTime(vol * 0.15, time);
            cGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
            click.connect(cGain).connect(drumBus);
            click.start(time);
            click.stop(time + 0.03);
            break;
        }
        case 'snare': {
            // トーン
            const osc = c.createOscillator();
            const oGain = c.createGain();
            osc.type = 'triangle';
            osc.frequency.value = 200;
            oGain.gain.setValueAtTime(vol * 0.4, time);
            oGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
            osc.connect(oGain).connect(drumBus);
            osc.start(time);
            osc.stop(time + 0.12);

            // ノイズ
            const bufLen = c.sampleRate * 0.15;
            const buf = c.createBuffer(1, bufLen, c.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
            const noise = c.createBufferSource();
            noise.buffer = buf;
            const nGain = c.createGain();
            nGain.gain.setValueAtTime(vol * 0.45, time);
            nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
            const filter = c.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 4000;
            filter.Q.value = 1.2;
            noise.connect(filter).connect(nGain).connect(drumBus);
            noise.start(time);
            break;
        }
        case 'hihatC': {
            const bufLen = c.sampleRate * 0.04;
            const buf = c.createBuffer(1, bufLen, c.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
            const noise = c.createBufferSource();
            noise.buffer = buf;
            const gain = c.createGain();
            gain.gain.setValueAtTime(vol * 0.3, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
            const hp = c.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 8000;
            noise.connect(hp).connect(gain).connect(drumBus);
            noise.start(time);
            break;
        }
        case 'hihatO': {
            const bufLen = c.sampleRate * 0.2;
            const buf = c.createBuffer(1, bufLen, c.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
            const noise = c.createBufferSource();
            noise.buffer = buf;
            const gain = c.createGain();
            gain.gain.setValueAtTime(vol * 0.25, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
            const hp = c.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 7000;
            noise.connect(hp).connect(gain).connect(drumBus);
            noise.start(time);
            break;
        }
        case 'clap': {
            // 3連打ノイズ
            for (let j = 0; j < 3; j++) {
                const bufLen = c.sampleRate * 0.015;
                const buf = c.createBuffer(1, bufLen, c.sampleRate);
                const data = buf.getChannelData(0);
                for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
                const noise = c.createBufferSource();
                noise.buffer = buf;
                const gain = c.createGain();
                const t = time + j * 0.012;
                gain.gain.setValueAtTime(vol * 0.35, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
                const bp = c.createBiquadFilter();
                bp.type = 'bandpass';
                bp.frequency.value = 2500;
                bp.Q.value = 2;
                noise.connect(bp).connect(gain).connect(drumBus);
                noise.start(t);
            }
            // テール
            const tailBufLen = c.sampleRate * 0.15;
            const tailBuf = c.createBuffer(1, tailBufLen, c.sampleRate);
            const tailData = tailBuf.getChannelData(0);
            for (let i = 0; i < tailBufLen; i++) tailData[i] = Math.random() * 2 - 1;
            const tailNoise = c.createBufferSource();
            tailNoise.buffer = tailBuf;
            const tailGain = c.createGain();
            tailGain.gain.setValueAtTime(vol * 0.25, time + 0.035);
            tailGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
            const tailBp = c.createBiquadFilter();
            tailBp.type = 'bandpass';
            tailBp.frequency.value = 2000;
            tailNoise.connect(tailBp).connect(tailGain).connect(drumBus);
            tailNoise.start(time + 0.035);
            break;
        }
        case 'tom': {
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, time);
            osc.frequency.exponentialRampToValueAtTime(80, time + 0.2);
            gain.gain.setValueAtTime(vol * 0.6, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
            osc.connect(gain).connect(drumBus);
            osc.start(time);
            osc.stop(time + 0.3);
            break;
        }
    }
}

// ========================================
// スケジューラー
// ========================================
const SCHEDULE_AHEAD = 0.1;  // 先読み秒数
const LOOK_AHEAD = 25;      // タイマー間隔 ms

function scheduler() {
    const c = getCtx();
    while (nextNoteTime < c.currentTime + SCHEDULE_AHEAD) {
        scheduleStep(currentStep, nextNoteTime);
        advanceStep();
    }
    timerID = setTimeout(scheduler, LOOK_AHEAD);
}

function scheduleStep(step, time) {
    // UIハイライト更新
    requestAnimationFrame(() => highlightStep(step));

    // 各パートの音を鳴らす
    PARTS.forEach(part => {
        if (pattern[part.id][step]) {
            playSound(part.id, time);
        }
    });
}

function advanceStep() {
    const secondsPerBeat = 60.0 / bpm;
    const sixteenthNote = secondsPerBeat / 4;

    currentStep = (currentStep + 1) % STEPS;

    // スウィング: 偶数ステップ（裏拍）のタイミングを遅らせる
    if (currentStep % 2 === 1 && swing > 0) {
        nextNoteTime += sixteenthNote * (1 + swing / 100 * 0.66);
    } else {
        nextNoteTime += sixteenthNote;
    }
}

function highlightStep(step) {
    document.querySelectorAll('.step.current').forEach(el => el.classList.remove('current'));
    document.querySelectorAll(`.step[data-step="${step}"]`).forEach(el => el.classList.add('current'));
}

// ========================================
// 再生制御
// ========================================
function togglePlay() {
    const btn = document.getElementById('playBtn');
    if (isPlaying) {
        // 停止
        isPlaying = false;
        clearTimeout(timerID);
        currentStep = -1;
        document.querySelectorAll('.step.current').forEach(el => el.classList.remove('current'));
        btn.textContent = '▶ Play';
        btn.classList.remove('playing');
    } else {
        // 再生開始
        isPlaying = true;
        const c = getCtx();
        currentStep = 0;
        nextNoteTime = c.currentTime + 0.05;
        btn.textContent = '⏹ Stop';
        btn.classList.add('playing');
        scheduler();
    }
}

function setBPM(val) {
    bpm = parseInt(val);
    document.getElementById('bpmValue').textContent = bpm;
}

function setSwing(val) {
    swing = parseInt(val);
    document.getElementById('swingValue').textContent = swing + '%';
}

function setMasterVol(val) {
    masterVol = parseInt(val) / 100;
    if (masterGain) masterGain.gain.value = masterVol;
}

// ========================================
// プリセット
// ========================================
const PRESETS = {
    rock: {
        kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hihatC: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        hihatO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
    },
    hiphop: {
        kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
        hihatC: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        hihatO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    techno: {
        kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        hihatC: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        hihatO: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
        clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    house: {
        kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        hihatC: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        hihatO: [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
        clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        tom: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    },
    bossa: {
        kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        hihatC: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        hihatO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        clap: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
        tom: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    },
    reggae: {
        kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        hihatC: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
        hihatO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        clap: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
    },
    dnb: {
        kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
        hihatC: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        hihatO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    },
    trap: {
        kick: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hihatC: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        hihatO: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
        clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    },
    jazz: {
        kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        hihatC: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        hihatO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        clap: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
        tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
    },
    latin: {
        kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hihatC: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        hihatO: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
        clap: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
        tom: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    },
    funk: {
        kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
        hihatC: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        hihatO: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    },
    edm: {
        kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        hihatC: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
        hihatO: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
    },
};

function loadPreset(name) {
    if (!name || !PRESETS[name]) return;
    const preset = PRESETS[name];
    PARTS.forEach(part => {
        const data = preset[part.id] || new Array(STEPS).fill(0);
        for (let i = 0; i < STEPS; i++) {
            pattern[part.id][i] = !!data[i];
        }
    });
    updateGridUI();
}

function clearAll() {
    PARTS.forEach(part => {
        for (let i = 0; i < STEPS; i++) pattern[part.id][i] = false;
    });
    updateGridUI();
    document.getElementById('presetSelect').value = '';
}

function randomize() {
    // パートごとに密度を変える
    const densities = { kick: 0.25, snare: 0.15, hihatC: 0.4, hihatO: 0.1, clap: 0.1, tom: 0.08 };
    PARTS.forEach(part => {
        const density = densities[part.id] || 0.2;
        for (let i = 0; i < STEPS; i++) {
            pattern[part.id][i] = Math.random() < density;
        }
    });
    updateGridUI();
    document.getElementById('presetSelect').value = '';
}

function updateGridUI() {
    PARTS.forEach(part => {
        for (let i = 0; i < STEPS; i++) {
            const el = document.querySelector(`.step[data-part="${part.id}"][data-step="${i}"]`);
            if (el) el.classList.toggle('on', pattern[part.id][i]);
        }
    });
}

// ========================================
// タブ切り替え
// ========================================
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === 'tab-' + tabId);
    });
    if (tabId === 'melody' && !melodyInitialized) {
        initMelodyEditor();
        melodyInitialized = true;
    }
    if (tabId === 'bass' && !bassInitialized) {
        initBassEditor();
        bassInitialized = true;
    }
}

// ========================================
// メロディエディタ
// ========================================
let melodyInitialized = false;

// スケール定義（半音のオフセット）
const SCALES = {
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9],
    blues: [0, 3, 5, 6, 7, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// メロディパターン: melodyNotes[step] = MIDIノート番号 or null
const melodyNotes = new Array(STEPS).fill(null);

// ピアノロール設定
const PR_ROWS = 24;        // 2オクターブ分
const PR_CELL_W = 48;      // ステップの幅 px
const PR_CELL_H = 20;      // 音程行の高さ px

let pianoCanvas, pianoCtx;

function getMelodyConfig() {
    return {
        waveform: document.getElementById('melodyWaveform').value,
        instrument: document.getElementById('melodyWaveform').value,
        scale: document.getElementById('melodyScale').value,
        key: parseInt(document.getElementById('melodyKey').value),
        octave: parseInt(document.getElementById('melodyOctave').value),
        adsr: {
            a: parseInt(document.getElementById('adsrA').value) / 1000,
            d: parseInt(document.getElementById('adsrD').value) / 1000,
            s: parseInt(document.getElementById('adsrS').value) / 100,
            r: parseInt(document.getElementById('adsrR').value) / 1000,
        },
    };
}

// MIDIノート番号 → 周波数
function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

// 現在のオクターブ範囲のMIDIノートリスト（高い音が上）
function getVisibleNotes() {
    const cfg = getMelodyConfig();
    const baseNote = (cfg.octave + 1) * 12; // C(oct+1) がベース
    const notes = [];
    for (let i = PR_ROWS - 1; i >= 0; i--) {
        notes.push(baseNote + i);
    }
    return notes;
}

// 指定MIDIノートがスケール内か判定
function isInScale(midi) {
    const cfg = getMelodyConfig();
    const scaleNotes = SCALES[cfg.scale];
    const noteClass = ((midi % 12) - cfg.key + 12) % 12;
    return scaleNotes.includes(noteClass);
}

// MIDIノート番号 → 表示名
function midiToName(midi) {
    return NOTE_NAMES[midi % 12] + Math.floor(midi / 12 - 1);
}

// ピアノキー列の生成
function buildPianoKeys() {
    const container = document.getElementById('pianoKeys');
    container.innerHTML = '';
    const notes = getVisibleNotes();
    notes.forEach(midi => {
        const el = document.createElement('div');
        el.className = 'piano-key';
        const noteClass = midi % 12;
        if ([1, 3, 6, 8, 10].includes(noteClass)) {
            el.classList.add('black-key');
        }
        if (isInScale(midi)) {
            el.classList.add('scale-note');
        }
        el.textContent = midiToName(midi);
        // クリックで音のプレビュー
        el.addEventListener('click', () => {
            playMelodyNote(midi, getCtx().currentTime, 0.3);
        });
        container.appendChild(el);
    });
}

// ピアノロール Canvas の描画
function drawPianoRoll() {
    if (!pianoCanvas) return;
    const w = STEPS * PR_CELL_W;
    const h = PR_ROWS * PR_CELL_H;
    pianoCanvas.width = w;
    pianoCanvas.height = h;
    const c = pianoCtx;

    const notes = getVisibleNotes();
    const cfg = getMelodyConfig();
    const scaleNotes = SCALES[cfg.scale];

    // 背景
    for (let row = 0; row < PR_ROWS; row++) {
        const midi = notes[row];
        const noteClass = ((midi % 12) - cfg.key + 12) % 12;
        const inScale = scaleNotes.includes(noteClass);
        const isBlack = [1, 3, 6, 8, 10].includes(midi % 12);

        for (let col = 0; col < STEPS; col++) {
            const x = col * PR_CELL_W;
            const y = row * PR_CELL_H;

            // 背景色
            if (inScale) {
                c.fillStyle = isBlack ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)';
            } else {
                c.fillStyle = isBlack ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)';
            }
            c.fillRect(x, y, PR_CELL_W, PR_CELL_H);

            // グリッド線
            c.strokeStyle = col % 4 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
            c.strokeRect(x, y, PR_CELL_W, PR_CELL_H);
        }
    }

    // ノートの描画
    for (let col = 0; col < STEPS; col++) {
        const midi = melodyNotes[col];
        if (midi == null) continue;
        const rowIdx = notes.indexOf(midi);
        if (rowIdx === -1) continue;

        const x = col * PR_CELL_W + 2;
        const y = rowIdx * PR_CELL_H + 2;
        const w2 = PR_CELL_W - 4;
        const h2 = PR_CELL_H - 4;

        // ノートブロック
        c.fillStyle = 'rgba(99,102,241,0.7)';
        c.beginPath();
        c.roundRect(x, y, w2, h2, 3);
        c.fill();

        // グロー
        c.shadowColor = 'rgba(99,102,241,0.5)';
        c.shadowBlur = 8;
        c.fill();
        c.shadowBlur = 0;
    }

    // 再生位置ハイライト
    if (isPlaying && currentStep >= 0) {
        c.fillStyle = 'rgba(34,197,94,0.1)';
        c.fillRect(currentStep * PR_CELL_W, 0, PR_CELL_W, h);
    }
}

// Canvas クリックイベント
function onCanvasClick(e) {
    const rect = pianoCanvas.getBoundingClientRect();
    const scaleX = pianoCanvas.width / rect.width;
    const scaleY = pianoCanvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const col = Math.floor(mx / PR_CELL_W);
    const row = Math.floor(my / PR_CELL_H);

    if (col < 0 || col >= STEPS || row < 0 || row >= PR_ROWS) return;

    const notes = getVisibleNotes();
    const midi = notes[row];

    if (e.button === 2 || e.ctrlKey) {
        // 右クリック or Ctrl+クリック: 削除
        melodyNotes[col] = null;
    } else {
        // 左クリック: 配置 (同じ位置なら削除)
        if (melodyNotes[col] === midi) {
            melodyNotes[col] = null;
        } else {
            melodyNotes[col] = midi;
            playMelodyNote(midi, getCtx().currentTime, 0.2);
        }
    }
    drawPianoRoll();
}

// ========================================
// 楽器合成エンジン
// ========================================

// 楽器を判定して適切な合成方式で音を再生
function synthesizeNote(c, bus, midi, time, duration, cfg) {
    const freq = midiToFreq(midi);
    const vol = 0.5;
    const inst = cfg.instrument || cfg.waveform;
    const a = cfg.adsr.a;
    const d = cfg.adsr.d;
    const s = cfg.adsr.s;
    const r = cfg.adsr.r;
    const totalDur = duration + r;

    switch (inst) {
        case 'epiano': {
            // FM合成エレクトリックピアノ（Rhodes風）
            const modulator = c.createOscillator();
            const modGain = c.createGain();
            const carrier = c.createOscillator();
            const gainNode = c.createGain();

            // モジュレーター: キャリア周波数の2倍
            modulator.type = 'sine';
            modulator.frequency.setValueAtTime(freq * 2, time);
            modGain.gain.setValueAtTime(freq * 1.5, time);
            modGain.gain.exponentialRampToValueAtTime(freq * 0.1, time + duration * 0.8);

            // キャリア
            carrier.type = 'sine';
            carrier.frequency.setValueAtTime(freq, time);

            // FM接続: modulator → modGain → carrier.frequency
            modulator.connect(modGain);
            modGain.connect(carrier.frequency);

            // ADSR
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(vol * 0.7, time + Math.min(a, 0.005));
            gainNode.gain.exponentialRampToValueAtTime(vol * s * 0.5, time + a + d);
            gainNode.gain.setValueAtTime(vol * s * 0.5, time + duration);
            gainNode.gain.linearRampToValueAtTime(0.001, time + totalDur);

            carrier.connect(gainNode).connect(bus);
            modulator.start(time);
            carrier.start(time);
            modulator.stop(time + totalDur + 0.01);
            carrier.stop(time + totalDur + 0.01);
            break;
        }
        case 'organ': {
            // 加算合成オルガン（Hammond風 ドローバー9本）
            const drawbars = [1, 3, 2, 4, 3, 2, 1, 1, 1]; // 相対レベル
            const harmonics = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8]; // 倍音比
            const totalLevel = drawbars.reduce((a, b) => a + b, 0);
            const gainNode = c.createGain();

            drawbars.forEach((level, i) => {
                const osc = c.createOscillator();
                const oscGain = c.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq * harmonics[i], time);
                oscGain.gain.setValueAtTime(vol * (level / totalLevel) * 0.6, time);
                osc.connect(oscGain).connect(gainNode);
                osc.start(time);
                osc.stop(time + totalDur + 0.01);
            });

            // オルガンはサステイン強め、即座に立ち上がり
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(vol * 0.6, time + 0.005);
            gainNode.gain.setValueAtTime(vol * 0.6, time + duration);
            gainNode.gain.linearRampToValueAtTime(0.001, time + duration + 0.05);

            gainNode.connect(bus);
            break;
        }
        case 'strings': {
            // デチューンSawtooth（ストリングスアンサンブル風）
            const gainNode = c.createGain();
            const lpf = c.createBiquadFilter();
            lpf.type = 'lowpass';
            lpf.frequency.setValueAtTime(3000, time);
            lpf.Q.value = 0.5;

            const detunes = [-12, -5, 0, 5, 12]; // セント単位
            detunes.forEach(dt => {
                const osc = c.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, time);
                osc.detune.setValueAtTime(dt, time);
                const oscGain = c.createGain();
                oscGain.gain.value = vol * 0.2;
                osc.connect(oscGain).connect(lpf);
                osc.start(time);
                osc.stop(time + totalDur + 0.01);
            });

            // ストリングスはゆっくり立ち上がり
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(vol * 0.7, time + Math.max(a, 0.08));
            gainNode.gain.linearRampToValueAtTime(vol * s * 0.7, time + Math.max(a, 0.08) + d);
            gainNode.gain.setValueAtTime(vol * s * 0.7, time + duration);
            gainNode.gain.linearRampToValueAtTime(0.001, time + totalDur);

            lpf.connect(gainNode).connect(bus);
            break;
        }
        case 'brass': {
            // Sawtooth + バンドパスフィルタ（ブラスセクション風）
            const osc = c.createOscillator();
            const osc2 = c.createOscillator();
            const bpf = c.createBiquadFilter();
            const gainNode = c.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, time);
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(freq * 1.002, time); // わずかにデチューン

            bpf.type = 'lowpass';
            // フィルタースウィープ（ブラスのアタック感）
            bpf.frequency.setValueAtTime(300, time);
            bpf.frequency.linearRampToValueAtTime(freq * 4, time + Math.max(a, 0.06));
            bpf.frequency.linearRampToValueAtTime(freq * 2, time + Math.max(a, 0.06) + d);
            bpf.Q.value = 1.5;

            const oscGain1 = c.createGain();
            oscGain1.gain.value = 0.35;
            const oscGain2 = c.createGain();
            oscGain2.gain.value = 0.25;

            osc.connect(oscGain1).connect(bpf);
            osc2.connect(oscGain2).connect(bpf);

            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(vol * 0.7, time + Math.max(a, 0.03));
            gainNode.gain.linearRampToValueAtTime(vol * s * 0.6, time + Math.max(a, 0.03) + d);
            gainNode.gain.setValueAtTime(vol * s * 0.6, time + duration);
            gainNode.gain.linearRampToValueAtTime(0.001, time + totalDur);

            bpf.connect(gainNode).connect(bus);
            osc.start(time);
            osc2.start(time);
            osc.stop(time + totalDur + 0.01);
            osc2.stop(time + totalDur + 0.01);
            break;
        }
        case 'bell': {
            // FM合成ベル/マリンバ（非整数比でメタリックな音色）
            const modulator = c.createOscillator();
            const modGain = c.createGain();
            const carrier = c.createOscillator();
            const gainNode = c.createGain();

            // 非整数比 = メタリック/ベルっぽい音
            modulator.type = 'sine';
            modulator.frequency.setValueAtTime(freq * 3.5, time);
            modGain.gain.setValueAtTime(freq * 2.0, time);
            modGain.gain.exponentialRampToValueAtTime(freq * 0.01, time + duration * 1.5);

            carrier.type = 'sine';
            carrier.frequency.setValueAtTime(freq, time);

            modulator.connect(modGain);
            modGain.connect(carrier.frequency);

            // ベルは瞬時アタック + 長い減衰
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(vol * 0.6, time + 0.002);
            gainNode.gain.exponentialRampToValueAtTime(vol * 0.1, time + duration * 0.5);
            gainNode.gain.exponentialRampToValueAtTime(0.001, time + totalDur);

            carrier.connect(gainNode).connect(bus);
            modulator.start(time);
            carrier.start(time);
            modulator.stop(time + totalDur + 0.01);
            carrier.stop(time + totalDur + 0.01);
            break;
        }
        default: {
            // 基本波形（sine/square/sawtooth/triangle）
            const osc = c.createOscillator();
            const gainNode = c.createGain();
            osc.type = inst;
            osc.frequency.setValueAtTime(freq, time);

            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(vol, time + a);
            gainNode.gain.linearRampToValueAtTime(vol * s, time + a + d);
            gainNode.gain.setValueAtTime(vol * s, time + duration);
            gainNode.gain.linearRampToValueAtTime(0.001, time + totalDur);

            osc.connect(gainNode).connect(bus);
            osc.start(time);
            osc.stop(time + totalDur + 0.01);
            break;
        }
    }
}

// メロディ音の合成
function playMelodyNote(midi, time, duration) {
    const c = getCtx();
    const cfg = getMelodyConfig();
    synthesizeNote(c, melodyBus, midi, time, duration, cfg);
}

// スケール変更ハンドラ
function onScaleChange() {
    buildPianoKeys();
    drawPianoRoll();
}

// ADSR表示更新
function updateADSRDisplay() {
    document.getElementById('adsrAVal').textContent = document.getElementById('adsrA').value + 'ms';
    document.getElementById('adsrDVal').textContent = document.getElementById('adsrD').value + 'ms';
    document.getElementById('adsrSVal').textContent = document.getElementById('adsrS').value + '%';
    document.getElementById('adsrRVal').textContent = document.getElementById('adsrR').value + 'ms';
}

// メロディプリセット
const MELODY_PRESETS = {
    scale_up: function () {
        const cfg = getMelodyConfig();
        const scaleNotes = SCALES[cfg.scale];
        const base = (cfg.octave + 1) * 12 + cfg.key;
        for (let i = 0; i < STEPS; i++) {
            const idx = i % scaleNotes.length;
            const oct = Math.floor(i / scaleNotes.length);
            melodyNotes[i] = base + scaleNotes[idx] + oct * 12;
        }
    },
    scale_down: function () {
        const cfg = getMelodyConfig();
        const scaleNotes = SCALES[cfg.scale];
        const base = (cfg.octave + 2) * 12 + cfg.key;
        for (let i = 0; i < STEPS; i++) {
            const idx = (scaleNotes.length - 1) - (i % scaleNotes.length);
            const oct = Math.floor(i / scaleNotes.length);
            melodyNotes[i] = base - (12 - scaleNotes[idx]) - oct * 12 + 12;
        }
    },
    arpeggio: function () {
        const cfg = getMelodyConfig();
        const base = (cfg.octave + 1) * 12 + cfg.key;
        // 1-3-5-8パターン
        const degrees = [0, 4, 7, 12, 7, 4, 0, -5];
        for (let i = 0; i < STEPS; i++) {
            melodyNotes[i] = base + degrees[i % degrees.length];
        }
    },
    twinkle: function () {
        const cfg = getMelodyConfig();
        const base = (cfg.octave + 1) * 12 + cfg.key;
        // C C G G A A G - F F E E D D C -
        const melody = [0, 0, 7, 7, 9, 9, 7, null, 5, 5, 4, 4, 2, 2, 0, null];
        for (let i = 0; i < STEPS; i++) {
            melodyNotes[i] = melody[i] != null ? base + melody[i] : null;
        }
    },
    chord_prog: function () {
        const cfg = getMelodyConfig();
        const base = (cfg.octave + 1) * 12 + cfg.key;
        const chords = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];
        for (let i = 0; i < STEPS; i++) {
            const chord = chords[Math.floor(i / 4) % 4];
            melodyNotes[i] = base + chord[i % chord.length];
        }
    },
    synth_riff: function () {
        const cfg = getMelodyConfig();
        const base = (cfg.octave + 1) * 12 + cfg.key;
        const riff = [0, 0, 12, 7, 5, 5, 3, null, 0, 0, 12, 10, 7, 5, 3, 0];
        for (let i = 0; i < STEPS; i++) {
            melodyNotes[i] = riff[i] != null ? base + riff[i] : null;
        }
    },
    melody_bounce: function () {
        const cfg = getMelodyConfig();
        const scaleNotes = SCALES[cfg.scale];
        const base = (cfg.octave + 1) * 12 + cfg.key;
        for (let i = 0; i < STEPS; i++) {
            if (i % 4 === 3) {
                melodyNotes[i] = null;
            } else {
                const idx = (i % 2 === 0) ? i % scaleNotes.length : (scaleNotes.length - 1 - (i % scaleNotes.length));
                melodyNotes[i] = base + scaleNotes[idx] + (i % 2 === 0 ? 12 : 0);
            }
        }
    },
    octave_jump: function () {
        const cfg = getMelodyConfig();
        const base = (cfg.octave + 1) * 12 + cfg.key;
        const pat = [0, 12, 0, 12, 4, 16, 4, 16, 7, 19, 7, 19, 5, 17, 5, null];
        for (let i = 0; i < STEPS; i++) {
            melodyNotes[i] = pat[i] != null ? base + pat[i] : null;
        }
    },
    call_response: function () {
        const cfg = getMelodyConfig();
        const base = (cfg.octave + 1) * 12 + cfg.key;
        const melody = [0, 2, 4, 7, null, null, null, null, 7, 5, 4, 2, 0, null, null, null];
        for (let i = 0; i < STEPS; i++) {
            melodyNotes[i] = melody[i] != null ? base + melody[i] : null;
        }
    },
    trill: function () {
        const cfg = getMelodyConfig();
        const scaleNotes = SCALES[cfg.scale];
        const base = (cfg.octave + 1) * 12 + cfg.key;
        const root = scaleNotes[0];
        const second = scaleNotes.length > 1 ? scaleNotes[1] : root + 2;
        for (let i = 0; i < STEPS; i++) {
            if (i >= 12) {
                melodyNotes[i] = (i % 2 === 0) ? base + scaleNotes[2 % scaleNotes.length] : base + scaleNotes[3 % scaleNotes.length];
            } else {
                melodyNotes[i] = (i % 2 === 0) ? base + root : base + second;
            }
        }
    },
};

// 追加メロディプリセット
MELODY_PRESETS.pop_hook = function () {
    const cfg = getMelodyConfig();
    const base = (cfg.octave + 1) * 12 + cfg.key;
    const melody = [0, 4, 7, 12, 11, 7, 4, 0, 2, 5, 9, 12, 11, 9, 5, 2];
    for (let i = 0; i < STEPS; i++) melodyNotes[i] = base + melody[i];
};
MELODY_PRESETS.funk_lick = function () {
    const cfg = getMelodyConfig();
    const base = (cfg.octave + 1) * 12 + cfg.key;
    const melody = [0, null, 3, 5, 7, null, 5, 3, 0, null, 12, 10, 7, 5, 3, null];
    for (let i = 0; i < STEPS; i++) melodyNotes[i] = melody[i] != null ? base + melody[i] : null;
};
MELODY_PRESETS.ambient_drift = function () {
    const cfg = getMelodyConfig();
    const base = (cfg.octave + 1) * 12 + cfg.key;
    const melody = [0, null, null, 7, null, null, 4, null, null, null, 12, null, null, 9, null, null];
    for (let i = 0; i < STEPS; i++) melodyNotes[i] = melody[i] != null ? base + melody[i] : null;
};
MELODY_PRESETS.dance_hook = function () {
    const cfg = getMelodyConfig();
    const base = (cfg.octave + 1) * 12 + cfg.key;
    const melody = [0, 0, 12, 12, 7, 7, 5, null, 0, 0, 12, 12, 10, 10, 7, null];
    for (let i = 0; i < STEPS; i++) melodyNotes[i] = melody[i] != null ? base + melody[i] : null;
};
MELODY_PRESETS.cinematic = function () {
    const cfg = getMelodyConfig();
    const base = (cfg.octave + 1) * 12 + cfg.key;
    const melody = [0, null, 7, null, 12, null, 11, null, 9, null, 7, null, 4, null, 0, null];
    for (let i = 0; i < STEPS; i++) melodyNotes[i] = melody[i] != null ? base + melody[i] : null;
};

function loadMelodyPreset(name) {
    if (!name || !MELODY_PRESETS[name]) return;
    MELODY_PRESETS[name]();
    // ノートが表示範囲に入るよう調整
    clampMelodyNotesToView();
    drawPianoRoll();
}

function clampMelodyNotesToView() {
    const notes = getVisibleNotes();
    const minNote = Math.min(...notes);
    const maxNote = Math.max(...notes);
    for (let i = 0; i < STEPS; i++) {
        if (melodyNotes[i] != null) {
            while (melodyNotes[i] < minNote) melodyNotes[i] += 12;
            while (melodyNotes[i] > maxNote) melodyNotes[i] -= 12;
        }
    }
}

function randomizeMelody() {
    const cfg = getMelodyConfig();
    const scaleNotes = SCALES[cfg.scale];
    const base = (cfg.octave + 1) * 12 + cfg.key;
    for (let i = 0; i < STEPS; i++) {
        if (Math.random() < 0.7) {
            const deg = scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
            const octShift = Math.floor(Math.random() * 2) * 12;
            melodyNotes[i] = base + deg + octShift;
        } else {
            melodyNotes[i] = null; // 休符
        }
    }
    clampMelodyNotesToView();
    drawPianoRoll();
    document.getElementById('melodyPresetSelect').value = '';
}

function clearMelody() {
    for (let i = 0; i < STEPS; i++) melodyNotes[i] = null;
    drawPianoRoll();
    document.getElementById('melodyPresetSelect').value = '';
}

// メロディエディタ初期化
function initMelodyEditor() {
    pianoCanvas = document.getElementById('pianoCanvas');
    pianoCtx = pianoCanvas.getContext('2d');

    pianoCanvas.addEventListener('click', onCanvasClick);
    pianoCanvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        onCanvasClick(e);
    });

    // オクターブ変更時のリビルド
    document.getElementById('melodyOctave').addEventListener('change', () => {
        buildPianoKeys();
        clampMelodyNotesToView();
        drawPianoRoll();
    });

    buildPianoKeys();
    drawPianoRoll();
}

// ========================================
// ベースエディタ
// ========================================
let bassCanvas, bassCtx;

function getBassConfig() {
    return {
        waveform: document.getElementById('bassWaveform').value,
        instrument: document.getElementById('bassWaveform').value,
        scale: document.getElementById('bassScale').value,
        key: parseInt(document.getElementById('bassKey').value),
        octave: parseInt(document.getElementById('bassOctave').value),
        adsr: {
            a: parseInt(document.getElementById('bassAdsrA').value) / 1000,
            d: parseInt(document.getElementById('bassAdsrD').value) / 1000,
            s: parseInt(document.getElementById('bassAdsrS').value) / 100,
            r: parseInt(document.getElementById('bassAdsrR').value) / 1000,
        },
    };
}

function getBassVisibleNotes() {
    const cfg = getBassConfig();
    const baseNote = (cfg.octave + 1) * 12;
    const notes = [];
    for (let i = PR_ROWS - 1; i >= 0; i--) {
        notes.push(baseNote + i);
    }
    return notes;
}

function isBassInScale(midi) {
    const cfg = getBassConfig();
    const scaleNotes = SCALES[cfg.scale];
    const noteClass = ((midi % 12) - cfg.key + 12) % 12;
    return scaleNotes.includes(noteClass);
}

function buildBassPianoKeys() {
    const container = document.getElementById('bassPianoKeys');
    container.innerHTML = '';
    const notes = getBassVisibleNotes();
    notes.forEach(midi => {
        const el = document.createElement('div');
        el.className = 'piano-key';
        const noteClass = midi % 12;
        if ([1, 3, 6, 8, 10].includes(noteClass)) el.classList.add('black-key');
        if (isBassInScale(midi)) el.classList.add('scale-note');
        el.textContent = midiToName(midi);
        el.addEventListener('click', () => {
            playBassNote(midi, getCtx().currentTime, 0.3);
        });
        container.appendChild(el);
    });
}

function drawBassRoll() {
    if (!bassCanvas) return;
    const w = STEPS * PR_CELL_W;
    const h = PR_ROWS * PR_CELL_H;
    bassCanvas.width = w;
    bassCanvas.height = h;
    const c = bassCtx;
    const notes = getBassVisibleNotes();
    const cfg = getBassConfig();
    const scaleNotes = SCALES[cfg.scale];

    for (let row = 0; row < PR_ROWS; row++) {
        const midi = notes[row];
        const noteClass = ((midi % 12) - cfg.key + 12) % 12;
        const inScale = scaleNotes.includes(noteClass);
        const isBlack = [1, 3, 6, 8, 10].includes(midi % 12);
        for (let col = 0; col < STEPS; col++) {
            const x = col * PR_CELL_W;
            const y = row * PR_CELL_H;
            if (inScale) {
                c.fillStyle = isBlack ? 'rgba(249,115,22,0.08)' : 'rgba(249,115,22,0.04)';
            } else {
                c.fillStyle = isBlack ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)';
            }
            c.fillRect(x, y, PR_CELL_W, PR_CELL_H);
            c.strokeStyle = col % 4 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
            c.strokeRect(x, y, PR_CELL_W, PR_CELL_H);
        }
    }

    for (let col = 0; col < STEPS; col++) {
        const midi = bassNotes[col];
        if (midi == null) continue;
        const rowIdx = notes.indexOf(midi);
        if (rowIdx === -1) continue;
        const x = col * PR_CELL_W + 2;
        const y = rowIdx * PR_CELL_H + 2;
        c.fillStyle = 'rgba(249,115,22,0.7)';
        c.beginPath();
        c.roundRect(x, y, PR_CELL_W - 4, PR_CELL_H - 4, 3);
        c.fill();
        c.shadowColor = 'rgba(249,115,22,0.5)';
        c.shadowBlur = 8;
        c.fill();
        c.shadowBlur = 0;
    }

    if (isPlaying && currentStep >= 0) {
        c.fillStyle = 'rgba(34,197,94,0.1)';
        c.fillRect(currentStep * PR_CELL_W, 0, PR_CELL_W, h);
    }
}

function onBassCanvasClick(e) {
    const rect = bassCanvas.getBoundingClientRect();
    const scaleX = bassCanvas.width / rect.width;
    const scaleY = bassCanvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const col = Math.floor(mx / PR_CELL_W);
    const row = Math.floor(my / PR_CELL_H);
    if (col < 0 || col >= STEPS || row < 0 || row >= PR_ROWS) return;
    const notes = getBassVisibleNotes();
    const midi = notes[row];
    if (e.button === 2 || e.ctrlKey) {
        bassNotes[col] = null;
    } else {
        if (bassNotes[col] === midi) {
            bassNotes[col] = null;
        } else {
            bassNotes[col] = midi;
            playBassNote(midi, getCtx().currentTime, 0.2);
        }
    }
    drawBassRoll();
}

function playBassNote(midi, time, duration) {
    const c = getCtx();
    const cfg = getBassConfig();
    synthesizeNote(c, bassBus, midi, time, duration, cfg);
}

function onBassScaleChange() {
    buildBassPianoKeys();
    drawBassRoll();
}

function updateBassADSRDisplay() {
    document.getElementById('bassAdsrAVal').textContent = document.getElementById('bassAdsrA').value + 'ms';
    document.getElementById('bassAdsrDVal').textContent = document.getElementById('bassAdsrD').value + 'ms';
    document.getElementById('bassAdsrSVal').textContent = document.getElementById('bassAdsrS').value + '%';
    document.getElementById('bassAdsrRVal').textContent = document.getElementById('bassAdsrR').value + 'ms';
}

// ベースプリセット
const BASS_PRESETS = {
    root_octave: function () {
        const cfg = getBassConfig();
        const base = (cfg.octave + 1) * 12 + cfg.key;
        for (let i = 0; i < STEPS; i++) {
            bassNotes[i] = (i % 2 === 0) ? base : base + 12;
        }
    },
    walking: function () {
        const cfg = getBassConfig();
        const scaleNotes = SCALES[cfg.scale];
        const base = (cfg.octave + 1) * 12 + cfg.key;
        for (let i = 0; i < STEPS; i++) {
            if (i % 4 === 0) {
                bassNotes[i] = base; // ルート
            } else {
                const deg = scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
                bassNotes[i] = base + deg;
            }
        }
    },
    eighth: function () {
        const cfg = getBassConfig();
        const base = (cfg.octave + 1) * 12 + cfg.key;
        // 8分音符パターン（全ステップにルートとオクターブ交互）
        const pattern = [0, 0, 7, 7, 0, 0, 5, 5, 0, 0, 7, 7, 0, 0, 12, 12];
        for (let i = 0; i < STEPS; i++) {
            bassNotes[i] = base + pattern[i % pattern.length];
        }
    },
    synth_bass: function () {
        const cfg = getBassConfig();
        const base = (cfg.octave + 1) * 12 + cfg.key;
        const pat = [null, 0, null, 0, null, 0, null, 0, null, 0, null, 0, null, 0, null, 0];
        for (let i = 0; i < STEPS; i++) {
            bassNotes[i] = pat[i] != null ? base + pat[i] : null;
        }
    },
    reggae_bass: function () {
        const cfg = getBassConfig();
        const base = (cfg.octave + 1) * 12 + cfg.key;
        const pat = [0, null, null, 7, null, null, 5, null, 0, null, null, 3, null, null, 5, null];
        for (let i = 0; i < STEPS; i++) {
            bassNotes[i] = pat[i] != null ? base + pat[i] : null;
        }
    },
    slap: function () {
        const cfg = getBassConfig();
        const base = (cfg.octave + 1) * 12 + cfg.key;
        const pat = [0, null, 12, null, 0, 0, null, 12, null, null, 0, null, 12, 0, null, null];
        for (let i = 0; i < STEPS; i++) {
            bassNotes[i] = pat[i] != null ? base + pat[i] : null;
        }
    },
    arpeggiated: function () {
        const cfg = getBassConfig();
        const scaleNotes = SCALES[cfg.scale];
        const base = (cfg.octave + 1) * 12 + cfg.key;
        const degrees = [0, 2, 4, 2];
        for (let i = 0; i < STEPS; i++) {
            const idx = degrees[i % degrees.length] % scaleNotes.length;
            bassNotes[i] = base + scaleNotes[idx];
        }
    },
    pedal: function () {
        const cfg = getBassConfig();
        const base = (cfg.octave + 1) * 12 + cfg.key;
        for (let i = 0; i < STEPS; i++) {
            bassNotes[i] = base;
        }
    },
};

// 追加ベースプリセット
BASS_PRESETS.disco_octave = function () {
    const cfg = getBassConfig();
    const base = (cfg.octave + 1) * 12 + cfg.key;
    const pat = [0, null, 0, 12, null, 0, 0, 12, 0, null, 0, 12, null, 0, 0, null];
    for (let i = 0; i < STEPS; i++) bassNotes[i] = pat[i] != null ? base + pat[i] : null;
};
BASS_PRESETS.deep_sub = function () {
    const cfg = getBassConfig();
    const base = (cfg.octave + 1) * 12 + cfg.key;
    const pat = [0, null, null, null, 0, null, null, 5, null, null, 0, null, null, null, 7, null];
    for (let i = 0; i < STEPS; i++) bassNotes[i] = pat[i] != null ? base + pat[i] : null;
};
BASS_PRESETS.driving = function () {
    const cfg = getBassConfig();
    const base = (cfg.octave + 1) * 12 + cfg.key;
    const pat = [0, 0, 0, 0, 5, 5, 5, 5, 7, 7, 7, 7, 5, 5, 3, 3];
    for (let i = 0; i < STEPS; i++) bassNotes[i] = base + pat[i];
};

function loadBassPreset(name) {
    if (!name || !BASS_PRESETS[name]) return;
    BASS_PRESETS[name]();
    clampBassNotesToView();
    drawBassRoll();
}

function clampBassNotesToView() {
    const notes = getBassVisibleNotes();
    const minNote = Math.min(...notes);
    const maxNote = Math.max(...notes);
    for (let i = 0; i < STEPS; i++) {
        if (bassNotes[i] != null) {
            while (bassNotes[i] < minNote) bassNotes[i] += 12;
            while (bassNotes[i] > maxNote) bassNotes[i] -= 12;
        }
    }
}

function randomizeBass() {
    const cfg = getBassConfig();
    const scaleNotes = SCALES[cfg.scale];
    const base = (cfg.octave + 1) * 12 + cfg.key;
    for (let i = 0; i < STEPS; i++) {
        if (Math.random() < 0.6) {
            const deg = scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
            bassNotes[i] = base + deg;
        } else {
            bassNotes[i] = null;
        }
    }
    clampBassNotesToView();
    drawBassRoll();
    document.getElementById('bassPresetSelect').value = '';
}

function clearBass() {
    for (let i = 0; i < STEPS; i++) bassNotes[i] = null;
    drawBassRoll();
    document.getElementById('bassPresetSelect').value = '';
}

function initBassEditor() {
    bassCanvas = document.getElementById('bassCanvas');
    bassCtx = bassCanvas.getContext('2d');
    bassCanvas.addEventListener('click', onBassCanvasClick);
    bassCanvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        onBassCanvasClick(e);
    });
    document.getElementById('bassOctave').addEventListener('change', () => {
        buildBassPianoKeys();
        clampBassNotesToView();
        drawBassRoll();
    });
    buildBassPianoKeys();
    drawBassRoll();
}

// ========================================
// スケジューラー拡張 — メロディ＋ベース再生統合
// ========================================
const origScheduleStep = scheduleStep;
scheduleStep = function (step, time) {
    origScheduleStep(step, time);
    const sixteenthNote = 60.0 / bpm / 4;

    // メロディの音を鳴らす
    if (melodyNotes[step] != null) {
        playMelodyNote(melodyNotes[step], time, sixteenthNote * 0.9);
    }

    // ベースの音を鳴らす
    if (bassNotes[step] != null) {
        playBassNote(bassNotes[step], time, sixteenthNote * 0.9);
    }

    // ピアノロールの再生位置を更新
    if (melodyInitialized) {
        requestAnimationFrame(() => drawPianoRoll());
    }
    if (bassInitialized) {
        requestAnimationFrame(() => drawBassRoll());
    }
};

// ========================================
// WAVエクスポート
// ========================================
async function exportWAV() {
    const btn = document.getElementById('exportBtn');
    const progress = document.getElementById('exportProgress');
    const statusEl = document.getElementById('exportStatus');
    btn.disabled = true;
    progress.classList.add('active');
    statusEl.textContent = 'レンダリング中...';
    try {
        const loops = parseInt(document.getElementById('loopCount').value);
        const secondsPerBeat = 60.0 / bpm;
        const sixteenthNote = secondsPerBeat / 4;
        const loopDuration = STEPS * sixteenthNote;
        const tailSeconds = 2.0;
        const totalDuration = loopDuration * loops + tailSeconds;
        const sampleRate = 44100;
        const offCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);
        const offMasterGain = offCtx.createGain();
        offMasterGain.gain.value = masterVol;
        const offDrumBus = offCtx.createGain();
        offDrumBus.gain.value = trackState.drum.muted ? 0 : trackState.drum.vol;
        const offMelodyBus = offCtx.createGain();
        offMelodyBus.gain.value = trackState.melody.muted ? 0 : trackState.melody.vol;
        const offBassBus = offCtx.createGain();
        offBassBus.gain.value = trackState.bass.muted ? 0 : trackState.bass.vol;
        const anySolo = ['drum', 'melody', 'bass'].some(t => trackState[t].soloed);
        if (anySolo) {
            if (!trackState.drum.soloed) offDrumBus.gain.value = 0;
            if (!trackState.melody.soloed) offMelodyBus.gain.value = 0;
            if (!trackState.bass.soloed) offBassBus.gain.value = 0;
        }
        offDrumBus.connect(offMasterGain);
        offMelodyBus.connect(offMasterGain);
        offBassBus.connect(offMasterGain);
        // FXチェーン
        const offFilter = offCtx.createBiquadFilter();
        const filterOn = document.getElementById('fxFilterOn').checked;
        offFilter.type = filterOn ? document.getElementById('fxFilterType').value : 'lowpass';
        offFilter.frequency.value = filterOn ? parseInt(document.getElementById('fxFilterCutoff').value) : 20000;
        offFilter.Q.value = filterOn ? parseInt(document.getElementById('fxFilterQ').value) / 10 : 0.1;
        const offDist = offCtx.createWaveShaper();
        const distOn = document.getElementById('fxDistOn').checked;
        offDist.curve = makeDistortionCurve(distOn ? parseInt(document.getElementById('fxDistAmount').value) : 0);
        offDist.oversample = '4x';
        const offDelay = offCtx.createDelay(2.0);
        const delayOn = document.getElementById('fxDelayOn').checked;
        offDelay.delayTime.value = parseInt(document.getElementById('fxDelayTime').value) / 1000;
        const offDelayFB = offCtx.createGain();
        offDelayFB.gain.value = parseInt(document.getElementById('fxDelayFB').value) / 100;
        const delayMix = parseInt(document.getElementById('fxDelayMix').value);
        const offDelayDry = offCtx.createGain();
        offDelayDry.gain.value = delayOn ? 1 - (delayMix / 200) : 1;
        const offDelayWet = offCtx.createGain();
        offDelayWet.gain.value = delayOn ? delayMix / 100 : 0;
        const offReverbConv = offCtx.createConvolver();
        const reverbOn = document.getElementById('fxReverbOn').checked;
        const reverbDecay = parseInt(document.getElementById('fxReverbDecay').value) / 10;
        const reverbMix = parseInt(document.getElementById('fxReverbMix').value);
        offReverbConv.buffer = createReverbIR(offCtx, reverbDecay);
        const offReverbDry = offCtx.createGain();
        offReverbDry.gain.value = reverbOn ? 1 - (reverbMix / 200) : 1;
        const offReverbWet = offCtx.createGain();
        offReverbWet.gain.value = reverbOn ? reverbMix / 100 : 0;
        offMasterGain.connect(offFilter);
        offFilter.connect(offDist);
        offDist.connect(offDelayDry);
        offDist.connect(offDelay);
        offDelay.connect(offDelayFB);
        offDelayFB.connect(offDelay);
        offDelay.connect(offDelayWet);
        const offDelayMerge = offCtx.createGain();
        offDelayDry.connect(offDelayMerge);
        offDelayWet.connect(offDelayMerge);
        offDelayMerge.connect(offReverbDry);
        offDelayMerge.connect(offReverbConv);
        offReverbConv.connect(offReverbWet);
        offReverbDry.connect(offCtx.destination);
        offReverbWet.connect(offCtx.destination);
        statusEl.textContent = 'ノートをスケジュール中...';
        await new Promise(r => setTimeout(r, 10));
        for (let loop = 0; loop < loops; loop++) {
            let noteTime = loop * loopDuration;
            for (let step = 0; step < STEPS; step++) {
                PARTS.forEach(part => {
                    if (pattern[part.id][step]) scheduleOfflineDrum(offCtx, offDrumBus, part.id, noteTime, partVolume[part.id]);
                });
                if (melodyNotes[step] != null) scheduleOfflineSynth(offCtx, offMelodyBus, melodyNotes[step], noteTime, sixteenthNote * 0.9, getMelodyConfig());
                if (bassNotes[step] != null) scheduleOfflineSynth(offCtx, offBassBus, bassNotes[step], noteTime, sixteenthNote * 0.9, getBassConfig());
                if ((step + 1) % 2 === 1 && swing > 0) noteTime += sixteenthNote * (1 + swing / 100 * 0.66);
                else noteTime += sixteenthNote;
            }
        }
        statusEl.textContent = 'オーディオレンダリング中...';
        await new Promise(r => setTimeout(r, 10));
        const renderedBuffer = await offCtx.startRendering();
        statusEl.textContent = 'WAVエンコード中...';
        await new Promise(r => setTimeout(r, 10));
        const wavBlob = encodeWAV(renderedBuffer);
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wbm_${bpm}bpm_${loops}loop.wav`;
        a.click();
        URL.revokeObjectURL(url);
        statusEl.textContent = '完了！';
        showToast('✅ WAVファイルをダウンロードしました');
        setTimeout(() => progress.classList.remove('active'), 1500);
    } catch (err) {
        console.error('Export failed:', err);
        statusEl.textContent = 'エラー: ' + err.message;
        showToast('❌ エクスポートに失敗しました');
        setTimeout(() => progress.classList.remove('active'), 3000);
    } finally { btn.disabled = false; }
}

function scheduleOfflineDrum(c, bus, partId, time, vol) {
    switch (partId) {
        case 'kick': {
            const osc = c.createOscillator(); const gain = c.createGain();
            osc.type = 'sine'; osc.frequency.setValueAtTime(160, time); osc.frequency.exponentialRampToValueAtTime(35, time + 0.12);
            gain.gain.setValueAtTime(vol * 0.9, time); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
            osc.connect(gain).connect(bus); osc.start(time); osc.stop(time + 0.35);
            const click = c.createOscillator(); const cGain = c.createGain();
            click.type = 'square'; click.frequency.setValueAtTime(1200, time); click.frequency.exponentialRampToValueAtTime(200, time + 0.02);
            cGain.gain.setValueAtTime(vol * 0.15, time); cGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
            click.connect(cGain).connect(bus); click.start(time); click.stop(time + 0.03); break;
        }
        case 'snare': {
            const osc = c.createOscillator(); const oGain = c.createGain();
            osc.type = 'triangle'; osc.frequency.value = 200;
            oGain.gain.setValueAtTime(vol * 0.4, time); oGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
            osc.connect(oGain).connect(bus); osc.start(time); osc.stop(time + 0.12);
            const bufLen = c.sampleRate * 0.15; const buf = c.createBuffer(1, bufLen, c.sampleRate); const data = buf.getChannelData(0);
            for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
            const noise = c.createBufferSource(); noise.buffer = buf;
            const nGain = c.createGain(); nGain.gain.setValueAtTime(vol * 0.45, time); nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
            const filter = c.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 4000; filter.Q.value = 1.2;
            noise.connect(filter).connect(nGain).connect(bus); noise.start(time); break;
        }
        case 'hihatC': {
            const bufLen = c.sampleRate * 0.04; const buf = c.createBuffer(1, bufLen, c.sampleRate); const data = buf.getChannelData(0);
            for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
            const noise = c.createBufferSource(); noise.buffer = buf;
            const gain = c.createGain(); gain.gain.setValueAtTime(vol * 0.3, time); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
            const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 8000;
            noise.connect(hp).connect(gain).connect(bus); noise.start(time); break;
        }
        case 'hihatO': {
            const bufLen = c.sampleRate * 0.2; const buf = c.createBuffer(1, bufLen, c.sampleRate); const data = buf.getChannelData(0);
            for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
            const noise = c.createBufferSource(); noise.buffer = buf;
            const gain = c.createGain(); gain.gain.setValueAtTime(vol * 0.25, time); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
            const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
            noise.connect(hp).connect(gain).connect(bus); noise.start(time); break;
        }
        case 'clap': {
            for (let j = 0; j < 3; j++) {
                const bufLen = c.sampleRate * 0.015; const buf = c.createBuffer(1, bufLen, c.sampleRate); const data = buf.getChannelData(0);
                for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
                const noise = c.createBufferSource(); noise.buffer = buf;
                const gain = c.createGain(); const t = time + j * 0.012;
                gain.gain.setValueAtTime(vol * 0.35, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
                const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 2;
                noise.connect(bp).connect(gain).connect(bus); noise.start(t);
            }
            const tailBufLen = c.sampleRate * 0.15; const tailBuf = c.createBuffer(1, tailBufLen, c.sampleRate); const tailData = tailBuf.getChannelData(0);
            for (let i = 0; i < tailBufLen; i++) tailData[i] = Math.random() * 2 - 1;
            const tailNoise = c.createBufferSource(); tailNoise.buffer = tailBuf;
            const tailGain = c.createGain(); tailGain.gain.setValueAtTime(vol * 0.25, time + 0.035); tailGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
            const tailBp = c.createBiquadFilter(); tailBp.type = 'bandpass'; tailBp.frequency.value = 2000;
            tailNoise.connect(tailBp).connect(tailGain).connect(bus); tailNoise.start(time + 0.035); break;
        }
        case 'tom': {
            const osc = c.createOscillator(); const gain = c.createGain();
            osc.type = 'sine'; osc.frequency.setValueAtTime(200, time); osc.frequency.exponentialRampToValueAtTime(80, time + 0.2);
            gain.gain.setValueAtTime(vol * 0.6, time); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
            osc.connect(gain).connect(bus); osc.start(time); osc.stop(time + 0.3); break;
        }
    }
}

function scheduleOfflineSynth(c, bus, midi, time, duration, cfg) {
    // 楽器合成エンジンを共有使用（オンライン/オフライン両対応）
    synthesizeNote(c, bus, midi, time, duration, cfg);
}

function encodeWAV(audioBuffer) {
    const numCh = audioBuffer.numberOfChannels; const sr = audioBuffer.sampleRate;
    const bps = 16; const ba = numCh * 2; const nf = audioBuffer.length;
    const ds = nf * ba; const bs = 44 + ds;
    const buf = new ArrayBuffer(bs); const v = new DataView(buf);
    function ws(o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    ws(0, 'RIFF'); v.setUint32(4, bs - 8, true); ws(8, 'WAVE');
    ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, numCh, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * ba, true); v.setUint16(32, ba, true); v.setUint16(34, bps, true);
    ws(36, 'data'); v.setUint32(40, ds, true);
    const chs = []; for (let c = 0; c < numCh; c++) chs.push(audioBuffer.getChannelData(c));
    let off = 44;
    for (let i = 0; i < nf; i++) {
        for (let c = 0; c < numCh; c++) {
            let s = Math.max(-1, Math.min(1, chs[c][i]));
            v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); off += 2;
        }
    }
    return new Blob([buf], { type: 'audio/wav' });
}

// ========================================
// プロジェクト保存/読み込み
// ========================================
const STORAGE_PREFIX = 'wbm_project_';

function getFullProjectData() {
    const data = {
        version: '0.4.0', bpm, swing, masterVol: Math.round(masterVol * 100),
        drum: { pattern: {}, partVolume: {}, trackVol: Math.round(trackState.drum.vol * 100), muted: trackState.drum.muted },
        melody: { notes: [...melodyNotes], waveform: document.getElementById('melodyWaveform')?.value || 'square', scale: document.getElementById('melodyScale')?.value || 'major', key: parseInt(document.getElementById('melodyKey')?.value || '0'), octave: parseInt(document.getElementById('melodyOctave')?.value || '3'), adsr: { a: parseInt(document.getElementById('adsrA')?.value || '10'), d: parseInt(document.getElementById('adsrD')?.value || '100'), s: parseInt(document.getElementById('adsrS')?.value || '60'), r: parseInt(document.getElementById('adsrR')?.value || '200') }, trackVol: Math.round(trackState.melody.vol * 100), muted: trackState.melody.muted },
        bass: { notes: [...bassNotes], waveform: document.getElementById('bassWaveform')?.value || 'sawtooth', scale: document.getElementById('bassScale')?.value || 'major', key: parseInt(document.getElementById('bassKey')?.value || '0'), octave: parseInt(document.getElementById('bassOctave')?.value || '2'), adsr: { a: parseInt(document.getElementById('bassAdsrA')?.value || '5'), d: parseInt(document.getElementById('bassAdsrD')?.value || '80'), s: parseInt(document.getElementById('bassAdsrS')?.value || '70'), r: parseInt(document.getElementById('bassAdsrR')?.value || '150') }, trackVol: Math.round(trackState.bass.vol * 100), muted: trackState.bass.muted },
        fx: { filter: { on: document.getElementById('fxFilterOn')?.checked || false, type: document.getElementById('fxFilterType')?.value || 'lowpass', cutoff: parseInt(document.getElementById('fxFilterCutoff')?.value || '8000'), q: parseInt(document.getElementById('fxFilterQ')?.value || '10') }, distortion: { on: document.getElementById('fxDistOn')?.checked || false, amount: parseInt(document.getElementById('fxDistAmount')?.value || '30') }, delay: { on: document.getElementById('fxDelayOn')?.checked || false, time: parseInt(document.getElementById('fxDelayTime')?.value || '300'), feedback: parseInt(document.getElementById('fxDelayFB')?.value || '40'), mix: parseInt(document.getElementById('fxDelayMix')?.value || '30') }, reverb: { on: document.getElementById('fxReverbOn')?.checked || false, decay: parseInt(document.getElementById('fxReverbDecay')?.value || '15'), mix: parseInt(document.getElementById('fxReverbMix')?.value || '25') } },
    };
    PARTS.forEach(p => { data.drum.pattern[p.id] = [...pattern[p.id]]; data.drum.partVolume[p.id] = partVolume[p.id]; });
    return data;
}

function saveProject() {
    const slot = document.getElementById('saveSlot').value;
    const data = getFullProjectData(); data.savedAt = new Date().toISOString();
    try { localStorage.setItem(STORAGE_PREFIX + slot, JSON.stringify(data)); localStorage.setItem(STORAGE_PREFIX + 'lastSlot', slot); showToast(`💾 Slot ${parseInt(slot) + 1} に保存しました`); }
    catch (e) { showToast('❌ 保存に失敗: ' + e.message); }
}

function loadProjectFromSlot() {
    const slot = document.getElementById('saveSlot').value;
    const raw = localStorage.getItem(STORAGE_PREFIX + slot);
    if (!raw) { showToast(`⚠ Slot ${parseInt(slot) + 1} にデータがありません`); return; }
    try { applyProjectData(JSON.parse(raw)); showToast(`📂 Slot ${parseInt(slot) + 1} をロードしました`); }
    catch (e) { showToast('❌ ロードに失敗: ' + e.message); }
}

function exportProjectJSON() {
    const blob = new Blob([JSON.stringify(getFullProjectData(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `wbm_project_${bpm}bpm.json`; a.click(); URL.revokeObjectURL(url);
    showToast('📤 プロジェクトJSONをエクスポートしました');
}

function importProjectJSON(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { try { applyProjectData(JSON.parse(e.target.result)); showToast('📥 プロジェクトをインポートしました'); } catch { showToast('❌ JSONの読み込みに失敗'); } event.target.value = ''; };
    reader.readAsText(file);
}

function applyProjectData(data) {
    if (data.bpm) { bpm = data.bpm; document.getElementById('bpmSlider').value = bpm; document.getElementById('bpmValue').textContent = bpm; }
    if (data.swing != null) { swing = data.swing; document.getElementById('swingSlider').value = swing; document.getElementById('swingValue').textContent = swing + '%'; }
    if (data.masterVol != null) { masterVol = data.masterVol / 100; document.getElementById('masterVolSlider').value = data.masterVol; if (masterGain) masterGain.gain.value = masterVol; }
    if (data.drum) {
        if (data.drum.pattern) { PARTS.forEach(p => { if (data.drum.pattern[p.id]) { for (let i = 0; i < STEPS; i++) pattern[p.id][i] = !!data.drum.pattern[p.id][i]; } }); updateGridUI(); }
        if (data.drum.partVolume) PARTS.forEach(p => { if (data.drum.partVolume[p.id] != null) partVolume[p.id] = data.drum.partVolume[p.id]; });
        if (data.drum.trackVol != null) { trackState.drum.vol = data.drum.trackVol / 100; document.getElementById('drumVolSlider').value = data.drum.trackVol; }
        if (data.drum.muted != null) trackState.drum.muted = data.drum.muted;
    }
    if (data.melody) {
        if (data.melody.notes) { for (let i = 0; i < STEPS; i++) melodyNotes[i] = data.melody.notes[i] != null ? data.melody.notes[i] : null; }
        const setEl = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
        setEl('melodyWaveform', data.melody.waveform); setEl('melodyScale', data.melody.scale); setEl('melodyKey', data.melody.key); setEl('melodyOctave', data.melody.octave);
        if (data.melody.adsr) { setEl('adsrA', data.melody.adsr.a); setEl('adsrD', data.melody.adsr.d); setEl('adsrS', data.melody.adsr.s); setEl('adsrR', data.melody.adsr.r); updateADSRDisplay(); }
        if (data.melody.trackVol != null) { trackState.melody.vol = data.melody.trackVol / 100; document.getElementById('melodyVolSlider').value = data.melody.trackVol; }
        if (data.melody.muted != null) trackState.melody.muted = data.melody.muted;
        if (melodyInitialized) { buildPianoKeys(); drawPianoRoll(); }
    }
    if (data.bass) {
        if (data.bass.notes) { for (let i = 0; i < STEPS; i++) bassNotes[i] = data.bass.notes[i] != null ? data.bass.notes[i] : null; }
        const setEl = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
        setEl('bassWaveform', data.bass.waveform); setEl('bassScale', data.bass.scale); setEl('bassKey', data.bass.key); setEl('bassOctave', data.bass.octave);
        if (data.bass.adsr) { setEl('bassAdsrA', data.bass.adsr.a); setEl('bassAdsrD', data.bass.adsr.d); setEl('bassAdsrS', data.bass.adsr.s); setEl('bassAdsrR', data.bass.adsr.r); updateBassADSRDisplay(); }
        if (data.bass.trackVol != null) { trackState.bass.vol = data.bass.trackVol / 100; document.getElementById('bassVolSlider').value = data.bass.trackVol; }
        if (data.bass.muted != null) trackState.bass.muted = data.bass.muted;
        if (bassInitialized) { buildBassPianoKeys(); drawBassRoll(); }
    }
    if (data.fx) {
        const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
        const setVal = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
        if (data.fx.filter) { setChk('fxFilterOn', data.fx.filter.on); setVal('fxFilterType', data.fx.filter.type); setVal('fxFilterCutoff', data.fx.filter.cutoff); setVal('fxFilterQ', data.fx.filter.q); }
        if (data.fx.distortion) { setChk('fxDistOn', data.fx.distortion.on); setVal('fxDistAmount', data.fx.distortion.amount); }
        if (data.fx.delay) { setChk('fxDelayOn', data.fx.delay.on); setVal('fxDelayTime', data.fx.delay.time); setVal('fxDelayFB', data.fx.delay.feedback); setVal('fxDelayMix', data.fx.delay.mix); }
        if (data.fx.reverb) { setChk('fxReverbOn', data.fx.reverb.on); setVal('fxReverbDecay', data.fx.reverb.decay); setVal('fxReverbMix', data.fx.reverb.mix); }
        if (fxInitialized) updateFx();
    }
    applyTrackStates();
}

function showToast(msg) {
    const t = document.getElementById('saveToast'); t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

function autoRestore() {
    const ls = localStorage.getItem(STORAGE_PREFIX + 'lastSlot');
    if (ls == null) return;
    const raw = localStorage.getItem(STORAGE_PREFIX + ls);
    if (!raw) return;
    try { applyProjectData(JSON.parse(raw)); document.getElementById('saveSlot').value = ls; } catch (e) { }
}

// ========================================
// 初期化
// ========================================
buildUI();
autoRestore();
