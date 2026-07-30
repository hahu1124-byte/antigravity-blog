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

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

// メロディパターン: melodyNotes[step] = MIDIノート番号 or null
const melodyNotes = new Array(STEPS).fill(null);

// ピアノロール設定
const PR_ROWS = 24; // 2オクターブ分
const PR_CELL_W = 48; // ステップの幅 px
const PR_CELL_H = 20; // 音程行の高さ px

let pianoCanvas, pianoCtx;

function getMelodyConfig() {
  return {
    waveform: document.getElementById("melodyWaveform").value,
    instrument: document.getElementById("melodyWaveform").value,
    scale: document.getElementById("melodyScale").value,
    key: parseInt(document.getElementById("melodyKey").value),
    octave: parseInt(document.getElementById("melodyOctave").value),
    adsr: {
      a: parseInt(document.getElementById("adsrA").value) / 1000,
      d: parseInt(document.getElementById("adsrD").value) / 1000,
      s: parseInt(document.getElementById("adsrS").value) / 100,
      r: parseInt(document.getElementById("adsrR").value) / 1000,
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
  const container = document.getElementById("pianoKeys");
  container.innerHTML = "";
  const notes = getVisibleNotes();
  notes.forEach((midi) => {
    const el = document.createElement("div");
    el.className = "piano-key";
    const noteClass = midi % 12;
    if ([1, 3, 6, 8, 10].includes(noteClass)) {
      el.classList.add("black-key");
    }
    if (isInScale(midi)) {
      el.classList.add("scale-note");
    }
    el.textContent = midiToName(midi);
    // クリックで音のプレビュー
    el.addEventListener("click", () => {
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
        c.fillStyle = isBlack
          ? "rgba(99,102,241,0.08)"
          : "rgba(99,102,241,0.04)";
      } else {
        c.fillStyle = isBlack
          ? "rgba(255,255,255,0.03)"
          : "rgba(255,255,255,0.01)";
      }
      c.fillRect(x, y, PR_CELL_W, PR_CELL_H);

      // グリッド線
      c.strokeStyle =
        col % 4 === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)";
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
    c.fillStyle = "rgba(99,102,241,0.7)";
    c.beginPath();
    c.roundRect(x, y, w2, h2, 3);
    c.fill();

    // グロー
    c.shadowColor = "rgba(99,102,241,0.5)";
    c.shadowBlur = 8;
    c.fill();
    c.shadowBlur = 0;
  }

  // 再生位置ハイライト
  if (isPlaying && currentStep >= 0) {
    c.fillStyle = "rgba(34,197,94,0.1)";
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
    case "epiano": {
      // FM合成エレクトリックピアノ（Rhodes風）
      const modulator = c.createOscillator();
      const modGain = c.createGain();
      const carrier = c.createOscillator();
      const gainNode = c.createGain();

      // モジュレーター: キャリア周波数の2倍
      modulator.type = "sine";
      modulator.frequency.setValueAtTime(freq * 2, time);
      modGain.gain.setValueAtTime(freq * 1.5, time);
      modGain.gain.exponentialRampToValueAtTime(
        freq * 0.1,
        time + duration * 0.8,
      );

      // キャリア
      carrier.type = "sine";
      carrier.frequency.setValueAtTime(freq, time);

      // FM接続: modulator → modGain → carrier.frequency
      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      // ADSR
      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.linearRampToValueAtTime(
        vol * 0.7,
        time + Math.min(a, 0.005),
      );
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
    case "organ": {
      // 加算合成オルガン（Hammond風 ドローバー9本）
      const drawbars = [1, 3, 2, 4, 3, 2, 1, 1, 1]; // 相対レベル
      const harmonics = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8]; // 倍音比
      const totalLevel = drawbars.reduce((a, b) => a + b, 0);
      const gainNode = c.createGain();

      drawbars.forEach((level, i) => {
        const osc = c.createOscillator();
        const oscGain = c.createGain();
        osc.type = "sine";
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
    case "strings": {
      // デチューンSawtooth（ストリングスアンサンブル風）
      const gainNode = c.createGain();
      const lpf = c.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.setValueAtTime(3000, time);
      lpf.Q.value = 0.5;

      const detunes = [-12, -5, 0, 5, 12]; // セント単位
      detunes.forEach((dt) => {
        const osc = c.createOscillator();
        osc.type = "sawtooth";
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
      gainNode.gain.linearRampToValueAtTime(
        vol * 0.7,
        time + Math.max(a, 0.08),
      );
      gainNode.gain.linearRampToValueAtTime(
        vol * s * 0.7,
        time + Math.max(a, 0.08) + d,
      );
      gainNode.gain.setValueAtTime(vol * s * 0.7, time + duration);
      gainNode.gain.linearRampToValueAtTime(0.001, time + totalDur);

      lpf.connect(gainNode).connect(bus);
      break;
    }
    case "brass": {
      // Sawtooth + バンドパスフィルタ（ブラスセクション風）
      const osc = c.createOscillator();
      const osc2 = c.createOscillator();
      const bpf = c.createBiquadFilter();
      const gainNode = c.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, time);
      osc2.type = "sawtooth";
      osc2.frequency.setValueAtTime(freq * 1.002, time); // わずかにデチューン

      bpf.type = "lowpass";
      // フィルタースウィープ（ブラスのアタック感）
      bpf.frequency.setValueAtTime(300, time);
      bpf.frequency.linearRampToValueAtTime(freq * 4, time + Math.max(a, 0.06));
      bpf.frequency.linearRampToValueAtTime(
        freq * 2,
        time + Math.max(a, 0.06) + d,
      );
      bpf.Q.value = 1.5;

      const oscGain1 = c.createGain();
      oscGain1.gain.value = 0.35;
      const oscGain2 = c.createGain();
      oscGain2.gain.value = 0.25;

      osc.connect(oscGain1).connect(bpf);
      osc2.connect(oscGain2).connect(bpf);

      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.linearRampToValueAtTime(
        vol * 0.7,
        time + Math.max(a, 0.03),
      );
      gainNode.gain.linearRampToValueAtTime(
        vol * s * 0.6,
        time + Math.max(a, 0.03) + d,
      );
      gainNode.gain.setValueAtTime(vol * s * 0.6, time + duration);
      gainNode.gain.linearRampToValueAtTime(0.001, time + totalDur);

      bpf.connect(gainNode).connect(bus);
      osc.start(time);
      osc2.start(time);
      osc.stop(time + totalDur + 0.01);
      osc2.stop(time + totalDur + 0.01);
      break;
    }
    case "bell": {
      // FM合成ベル/マリンバ（非整数比でメタリックな音色）
      const modulator = c.createOscillator();
      const modGain = c.createGain();
      const carrier = c.createOscillator();
      const gainNode = c.createGain();

      // 非整数比 = メタリック/ベルっぽい音
      modulator.type = "sine";
      modulator.frequency.setValueAtTime(freq * 3.5, time);
      modGain.gain.setValueAtTime(freq * 2.0, time);
      modGain.gain.exponentialRampToValueAtTime(
        freq * 0.01,
        time + duration * 1.5,
      );

      carrier.type = "sine";
      carrier.frequency.setValueAtTime(freq, time);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      // ベルは瞬時アタック + 長い減衰
      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.linearRampToValueAtTime(vol * 0.6, time + 0.002);
      gainNode.gain.exponentialRampToValueAtTime(
        vol * 0.1,
        time + duration * 0.5,
      );
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
  document.getElementById("adsrAVal").textContent =
    document.getElementById("adsrA").value + "ms";
  document.getElementById("adsrDVal").textContent =
    document.getElementById("adsrD").value + "ms";
  document.getElementById("adsrSVal").textContent =
    document.getElementById("adsrS").value + "%";
  document.getElementById("adsrRVal").textContent =
    document.getElementById("adsrR").value + "ms";
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
      const idx = scaleNotes.length - 1 - (i % scaleNotes.length);
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
    const chords = [
      [0, 4, 7],
      [7, 11, 14],
      [9, 12, 16],
      [5, 9, 12],
    ];
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
        const idx =
          i % 2 === 0
            ? i % scaleNotes.length
            : scaleNotes.length - 1 - (i % scaleNotes.length);
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
    const melody = [
      0,
      2,
      4,
      7,
      null,
      null,
      null,
      null,
      7,
      5,
      4,
      2,
      0,
      null,
      null,
      null,
    ];
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
        melodyNotes[i] =
          i % 2 === 0
            ? base + scaleNotes[2 % scaleNotes.length]
            : base + scaleNotes[3 % scaleNotes.length];
      } else {
        melodyNotes[i] = i % 2 === 0 ? base + root : base + second;
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
  for (let i = 0; i < STEPS; i++)
    melodyNotes[i] = melody[i] != null ? base + melody[i] : null;
};
MELODY_PRESETS.ambient_drift = function () {
  const cfg = getMelodyConfig();
  const base = (cfg.octave + 1) * 12 + cfg.key;
  const melody = [
    0,
    null,
    null,
    7,
    null,
    null,
    4,
    null,
    null,
    null,
    12,
    null,
    null,
    9,
    null,
    null,
  ];
  for (let i = 0; i < STEPS; i++)
    melodyNotes[i] = melody[i] != null ? base + melody[i] : null;
};
MELODY_PRESETS.dance_hook = function () {
  const cfg = getMelodyConfig();
  const base = (cfg.octave + 1) * 12 + cfg.key;
  const melody = [0, 0, 12, 12, 7, 7, 5, null, 0, 0, 12, 12, 10, 10, 7, null];
  for (let i = 0; i < STEPS; i++)
    melodyNotes[i] = melody[i] != null ? base + melody[i] : null;
};
MELODY_PRESETS.cinematic = function () {
  const cfg = getMelodyConfig();
  const base = (cfg.octave + 1) * 12 + cfg.key;
  const melody = [
    0,
    null,
    7,
    null,
    12,
    null,
    11,
    null,
    9,
    null,
    7,
    null,
    4,
    null,
    0,
    null,
  ];
  for (let i = 0; i < STEPS; i++)
    melodyNotes[i] = melody[i] != null ? base + melody[i] : null;
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
  document.getElementById("melodyPresetSelect").value = "";
}

function clearMelody() {
  for (let i = 0; i < STEPS; i++) melodyNotes[i] = null;
  drawPianoRoll();
  document.getElementById("melodyPresetSelect").value = "";
}

// メロディエディタ初期化
function initMelodyEditor() {
  pianoCanvas = document.getElementById("pianoCanvas");
  pianoCtx = pianoCanvas.getContext("2d");

  pianoCanvas.addEventListener("click", onCanvasClick);
  pianoCanvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    onCanvasClick(e);
  });

  // オクターブ変更時のリビルド
  document.getElementById("melodyOctave").addEventListener("change", () => {
    buildPianoKeys();
    clampMelodyNotesToView();
    drawPianoRoll();
  });

  buildPianoKeys();
  drawPianoRoll();
}
