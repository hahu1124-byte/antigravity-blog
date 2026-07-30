// ========================================
// 定数・状態
// ========================================
const STEPS = 16;
const PARTS = [
  { id: "kick", name: "Kick", color: "var(--clr-kick)" },
  { id: "snare", name: "Snare", color: "var(--clr-snare)" },
  { id: "hihatC", name: "HH Close", color: "var(--clr-hihat-c)" },
  { id: "hihatO", name: "HH Open", color: "var(--clr-hihat-o)" },
  { id: "clap", name: "Clap", color: "var(--clr-clap)" },
  { id: "tom", name: "Tom", color: "var(--clr-tom)" },
];

// パターンデータ: parts[partId][stepIndex] = true/false
const pattern = {};
PARTS.forEach((p) => {
  pattern[p.id] = new Array(STEPS).fill(false);
});

// 各パートの音量 (0-1)
const partVolume = {};
PARTS.forEach((p) => {
  partVolume[p.id] = 0.8;
});

let bpm = 120;
let swing = 0; // 0-100
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
let fxFilter,
  fxDistortion,
  fxDelayNode,
  fxDelayFeedback,
  fxDelayDry,
  fxDelayWet;
let fxReverbConvolver, fxReverbDry, fxReverbWet;
let fxInitialized = false;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    initAudioRouting();
  }
  if (ctx.state === "suspended") ctx.resume();
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
  fxFilter.type = "lowpass";
  fxFilter.frequency.value = 8000;
  fxFilter.Q.value = 1.0;

  // Distortion
  fxDistortion = c.createWaveShaper();
  fxDistortion.curve = makeDistortionCurve(0);
  fxDistortion.oversample = "4x";

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
    curve[i] =
      k === 0
        ? x
        : ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
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
  const filterOn = document.getElementById("fxFilterOn").checked;
  const filterType = document.getElementById("fxFilterType").value;
  const cutoff = parseInt(document.getElementById("fxFilterCutoff").value);
  const q = parseInt(document.getElementById("fxFilterQ").value) / 10;
  fxFilter.type = filterOn ? filterType : "lowpass";
  fxFilter.frequency.value = filterOn ? cutoff : 20000;
  fxFilter.Q.value = filterOn ? q : 0.1;
  document.getElementById("fxFilterCutoffVal").textContent = cutoff;
  document.getElementById("fxFilterQVal").textContent = q.toFixed(1);

  // Distortion
  const distOn = document.getElementById("fxDistOn").checked;
  const distAmount = parseInt(document.getElementById("fxDistAmount").value);
  fxDistortion.curve = makeDistortionCurve(distOn ? distAmount : 0);
  document.getElementById("fxDistAmountVal").textContent = distAmount;

  // Delay
  const delayOn = document.getElementById("fxDelayOn").checked;
  const delayTime = parseInt(document.getElementById("fxDelayTime").value);
  const delayFB = parseInt(document.getElementById("fxDelayFB").value);
  const delayMix = parseInt(document.getElementById("fxDelayMix").value);
  fxDelayNode.delayTime.value = delayTime / 1000;
  fxDelayFeedback.gain.value = delayFB / 100;
  fxDelayWet.gain.value = delayOn ? delayMix / 100 : 0;
  fxDelayDry.gain.value = delayOn ? 1 - delayMix / 200 : 1;
  document.getElementById("fxDelayTimeVal").textContent = delayTime + "ms";
  document.getElementById("fxDelayFBVal").textContent = delayFB + "%";
  document.getElementById("fxDelayMixVal").textContent = delayMix + "%";

  // Reverb
  const reverbOn = document.getElementById("fxReverbOn").checked;
  const reverbDecay =
    parseInt(document.getElementById("fxReverbDecay").value) / 10;
  const reverbMix = parseInt(document.getElementById("fxReverbMix").value);
  if (reverbOn) {
    fxReverbConvolver.buffer = createReverbIR(ctx, reverbDecay);
    fxReverbWet.gain.value = reverbMix / 100;
    fxReverbDry.gain.value = 1 - reverbMix / 200;
  } else {
    fxReverbWet.gain.value = 0;
    fxReverbDry.gain.value = 1;
  }
  document.getElementById("fxReverbDecayVal").textContent =
    reverbDecay.toFixed(1) + "s";
  document.getElementById("fxReverbMixVal").textContent = reverbMix + "%";
}

// エフェクトパネル折りたたみ
function toggleFxPanel() {
  document.getElementById("fxPanel").classList.toggle("open");
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
  const tracks = ["drum", "melody", "bass"];
  const buses = { drum: drumBus, melody: melodyBus, bass: bassBus };
  const anySolo = tracks.some((t) => trackState[t].soloed);

  tracks.forEach((t) => {
    if (!buses[t]) return;
    let gain = trackState[t].vol;
    if (trackState[t].muted) gain = 0;
    else if (anySolo && !trackState[t].soloed) gain = 0;
    buses[t].gain.value = gain;

    // UI更新
    const cap = t.charAt(0).toUpperCase() + t.slice(1);
    const muteBtn = document.getElementById("mute" + cap);
    const soloBtn = document.getElementById("solo" + cap);
    if (muteBtn) muteBtn.classList.toggle("muted", trackState[t].muted);
    if (soloBtn) soloBtn.classList.toggle("soloed", trackState[t].soloed);
  });

  if (masterGain) masterGain.gain.value = masterVol;
}
