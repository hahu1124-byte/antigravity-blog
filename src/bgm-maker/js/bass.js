// ========================================
// ベースエディタ
// ========================================
let bassCanvas, bassCtx;

function getBassConfig() {
  return {
    waveform: document.getElementById("bassWaveform").value,
    instrument: document.getElementById("bassWaveform").value,
    scale: document.getElementById("bassScale").value,
    key: parseInt(document.getElementById("bassKey").value),
    octave: parseInt(document.getElementById("bassOctave").value),
    adsr: {
      a: parseInt(document.getElementById("bassAdsrA").value) / 1000,
      d: parseInt(document.getElementById("bassAdsrD").value) / 1000,
      s: parseInt(document.getElementById("bassAdsrS").value) / 100,
      r: parseInt(document.getElementById("bassAdsrR").value) / 1000,
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
  const container = document.getElementById("bassPianoKeys");
  container.innerHTML = "";
  const notes = getBassVisibleNotes();
  notes.forEach((midi) => {
    const el = document.createElement("div");
    el.className = "piano-key";
    const noteClass = midi % 12;
    if ([1, 3, 6, 8, 10].includes(noteClass)) el.classList.add("black-key");
    if (isBassInScale(midi)) el.classList.add("scale-note");
    el.textContent = midiToName(midi);
    el.addEventListener("click", () => {
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
        c.fillStyle = isBlack
          ? "rgba(249,115,22,0.08)"
          : "rgba(249,115,22,0.04)";
      } else {
        c.fillStyle = isBlack
          ? "rgba(255,255,255,0.03)"
          : "rgba(255,255,255,0.01)";
      }
      c.fillRect(x, y, PR_CELL_W, PR_CELL_H);
      c.strokeStyle =
        col % 4 === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)";
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
    c.fillStyle = "rgba(249,115,22,0.7)";
    c.beginPath();
    c.roundRect(x, y, PR_CELL_W - 4, PR_CELL_H - 4, 3);
    c.fill();
    c.shadowColor = "rgba(249,115,22,0.5)";
    c.shadowBlur = 8;
    c.fill();
    c.shadowBlur = 0;
  }

  if (isPlaying && currentStep >= 0) {
    c.fillStyle = "rgba(34,197,94,0.1)";
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
  document.getElementById("bassAdsrAVal").textContent =
    document.getElementById("bassAdsrA").value + "ms";
  document.getElementById("bassAdsrDVal").textContent =
    document.getElementById("bassAdsrD").value + "ms";
  document.getElementById("bassAdsrSVal").textContent =
    document.getElementById("bassAdsrS").value + "%";
  document.getElementById("bassAdsrRVal").textContent =
    document.getElementById("bassAdsrR").value + "ms";
}

// ベースプリセット
const BASS_PRESETS = {
  root_octave: function () {
    const cfg = getBassConfig();
    const base = (cfg.octave + 1) * 12 + cfg.key;
    for (let i = 0; i < STEPS; i++) {
      bassNotes[i] = i % 2 === 0 ? base : base + 12;
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
    const pat = [
      null,
      0,
      null,
      0,
      null,
      0,
      null,
      0,
      null,
      0,
      null,
      0,
      null,
      0,
      null,
      0,
    ];
    for (let i = 0; i < STEPS; i++) {
      bassNotes[i] = pat[i] != null ? base + pat[i] : null;
    }
  },
  reggae_bass: function () {
    const cfg = getBassConfig();
    const base = (cfg.octave + 1) * 12 + cfg.key;
    const pat = [
      0,
      null,
      null,
      7,
      null,
      null,
      5,
      null,
      0,
      null,
      null,
      3,
      null,
      null,
      5,
      null,
    ];
    for (let i = 0; i < STEPS; i++) {
      bassNotes[i] = pat[i] != null ? base + pat[i] : null;
    }
  },
  slap: function () {
    const cfg = getBassConfig();
    const base = (cfg.octave + 1) * 12 + cfg.key;
    const pat = [
      0,
      null,
      12,
      null,
      0,
      0,
      null,
      12,
      null,
      null,
      0,
      null,
      12,
      0,
      null,
      null,
    ];
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
  const pat = [
    0,
    null,
    0,
    12,
    null,
    0,
    0,
    12,
    0,
    null,
    0,
    12,
    null,
    0,
    0,
    null,
  ];
  for (let i = 0; i < STEPS; i++)
    bassNotes[i] = pat[i] != null ? base + pat[i] : null;
};
BASS_PRESETS.deep_sub = function () {
  const cfg = getBassConfig();
  const base = (cfg.octave + 1) * 12 + cfg.key;
  const pat = [
    0,
    null,
    null,
    null,
    0,
    null,
    null,
    5,
    null,
    null,
    0,
    null,
    null,
    null,
    7,
    null,
  ];
  for (let i = 0; i < STEPS; i++)
    bassNotes[i] = pat[i] != null ? base + pat[i] : null;
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
  document.getElementById("bassPresetSelect").value = "";
}

function clearBass() {
  for (let i = 0; i < STEPS; i++) bassNotes[i] = null;
  drawBassRoll();
  document.getElementById("bassPresetSelect").value = "";
}

function initBassEditor() {
  bassCanvas = document.getElementById("bassCanvas");
  bassCtx = bassCanvas.getContext("2d");
  bassCanvas.addEventListener("click", onBassCanvasClick);
  bassCanvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    onBassCanvasClick(e);
  });
  document.getElementById("bassOctave").addEventListener("change", () => {
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
