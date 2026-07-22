// ========================================
// UI生成
// ========================================
function buildUI() {
  // ビートマーカー
  const marker = document.getElementById("beatMarker");
  for (let i = 0; i < STEPS; i++) {
    const el = document.createElement("span");
    el.className = "beat-num" + (i % 4 === 0 ? " downbeat" : "");
    el.textContent = i + 1;
    marker.appendChild(el);
  }

  // グリッド
  const grid = document.getElementById("grid");
  PARTS.forEach((part) => {
    const row = document.createElement("div");
    row.className = "seq-row";

    // パート名
    const label = document.createElement("div");
    label.className = "part-label";
    label.textContent = part.name;
    label.style.color = part.color;
    row.appendChild(label);

    // パート音量
    const vol = document.createElement("input");
    vol.type = "range";
    vol.min = "0";
    vol.max = "100";
    vol.value = "80";
    vol.className = "part-vol";
    vol.style.accentColor = part.color;
    vol.addEventListener("input", () => {
      partVolume[part.id] = vol.value / 100;
    });
    row.appendChild(vol);

    // ステップ
    const stepsDiv = document.createElement("div");
    stepsDiv.className = "steps";
    for (let i = 0; i < STEPS; i++) {
      const step = document.createElement("div");
      step.className = "step";
      step.style.setProperty("--part-color", part.color);
      step.dataset.part = part.id;
      step.dataset.step = i;

      // 4拍区切りの視覚分離
      if (i % 4 === 0 && i > 0) {
        step.style.marginLeft = "4px";
      }

      step.addEventListener("click", () => {
        pattern[part.id][i] = !pattern[part.id][i];
        step.classList.toggle("on", pattern[part.id][i]);
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
    case "kick": {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
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
      click.type = "square";
      click.frequency.setValueAtTime(1200, time);
      click.frequency.exponentialRampToValueAtTime(200, time + 0.02);
      cGain.gain.setValueAtTime(vol * 0.15, time);
      cGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
      click.connect(cGain).connect(drumBus);
      click.start(time);
      click.stop(time + 0.03);
      break;
    }
    case "snare": {
      // トーン
      const osc = c.createOscillator();
      const oGain = c.createGain();
      osc.type = "triangle";
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
      filter.type = "bandpass";
      filter.frequency.value = 4000;
      filter.Q.value = 1.2;
      noise.connect(filter).connect(nGain).connect(drumBus);
      noise.start(time);
      break;
    }
    case "hihatC": {
      const bufLen = c.sampleRate * 0.04;
      const buf = c.createBuffer(1, bufLen, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
      const noise = c.createBufferSource();
      noise.buffer = buf;
      const gain = c.createGain();
      gain.gain.setValueAtTime(vol * 0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 8000;
      noise.connect(hp).connect(gain).connect(drumBus);
      noise.start(time);
      break;
    }
    case "hihatO": {
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
      hp.type = "highpass";
      hp.frequency.value = 7000;
      noise.connect(hp).connect(gain).connect(drumBus);
      noise.start(time);
      break;
    }
    case "clap": {
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
        bp.type = "bandpass";
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
      tailBp.type = "bandpass";
      tailBp.frequency.value = 2000;
      tailNoise.connect(tailBp).connect(tailGain).connect(drumBus);
      tailNoise.start(time + 0.035);
      break;
    }
    case "tom": {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
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
const SCHEDULE_AHEAD = 0.1; // 先読み秒数
const LOOK_AHEAD = 25; // タイマー間隔 ms

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
  PARTS.forEach((part) => {
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
    nextNoteTime += sixteenthNote * (1 + (swing / 100) * 0.66);
  } else {
    nextNoteTime += sixteenthNote;
  }
}

function highlightStep(step) {
  document
    .querySelectorAll(".step.current")
    .forEach((el) => el.classList.remove("current"));
  document
    .querySelectorAll(`.step[data-step="${step}"]`)
    .forEach((el) => el.classList.add("current"));
}

// ========================================
// 再生制御
// ========================================
function togglePlay() {
  const btn = document.getElementById("playBtn");
  if (isPlaying) {
    // 停止
    isPlaying = false;
    clearTimeout(timerID);
    currentStep = -1;
    document
      .querySelectorAll(".step.current")
      .forEach((el) => el.classList.remove("current"));
    btn.textContent = "▶ Play";
    btn.classList.remove("playing");
  } else {
    // 再生開始
    isPlaying = true;
    const c = getCtx();
    currentStep = 0;
    nextNoteTime = c.currentTime + 0.05;
    btn.textContent = "⏹ Stop";
    btn.classList.add("playing");
    scheduler();
  }
}

function setBPM(val) {
  bpm = parseInt(val);
  document.getElementById("bpmValue").textContent = bpm;
}

function setSwing(val) {
  swing = parseInt(val);
  document.getElementById("swingValue").textContent = swing + "%";
}

function setMasterVol(val) {
  masterVol = parseInt(val) / 100;
  if (masterGain) masterGain.gain.value = masterVol;
}
