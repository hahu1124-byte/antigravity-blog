// ========================================
// プロジェクト保存/読み込み
// ========================================
const STORAGE_PREFIX = "wbm_project_";

function getFullProjectData() {
  const data = {
    version: "0.4.0",
    bpm,
    swing,
    masterVol: Math.round(masterVol * 100),
    drum: {
      pattern: {},
      partVolume: {},
      trackVol: Math.round(trackState.drum.vol * 100),
      muted: trackState.drum.muted,
    },
    melody: {
      notes: [...melodyNotes],
      waveform: document.getElementById("melodyWaveform")?.value || "square",
      scale: document.getElementById("melodyScale")?.value || "major",
      key: parseInt(document.getElementById("melodyKey")?.value || "0"),
      octave: parseInt(document.getElementById("melodyOctave")?.value || "3"),
      adsr: {
        a: parseInt(document.getElementById("adsrA")?.value || "10"),
        d: parseInt(document.getElementById("adsrD")?.value || "100"),
        s: parseInt(document.getElementById("adsrS")?.value || "60"),
        r: parseInt(document.getElementById("adsrR")?.value || "200"),
      },
      trackVol: Math.round(trackState.melody.vol * 100),
      muted: trackState.melody.muted,
    },
    bass: {
      notes: [...bassNotes],
      waveform: document.getElementById("bassWaveform")?.value || "sawtooth",
      scale: document.getElementById("bassScale")?.value || "major",
      key: parseInt(document.getElementById("bassKey")?.value || "0"),
      octave: parseInt(document.getElementById("bassOctave")?.value || "2"),
      adsr: {
        a: parseInt(document.getElementById("bassAdsrA")?.value || "5"),
        d: parseInt(document.getElementById("bassAdsrD")?.value || "80"),
        s: parseInt(document.getElementById("bassAdsrS")?.value || "70"),
        r: parseInt(document.getElementById("bassAdsrR")?.value || "150"),
      },
      trackVol: Math.round(trackState.bass.vol * 100),
      muted: trackState.bass.muted,
    },
    fx: {
      filter: {
        on: document.getElementById("fxFilterOn")?.checked || false,
        type: document.getElementById("fxFilterType")?.value || "lowpass",
        cutoff: parseInt(
          document.getElementById("fxFilterCutoff")?.value || "8000",
        ),
        q: parseInt(document.getElementById("fxFilterQ")?.value || "10"),
      },
      distortion: {
        on: document.getElementById("fxDistOn")?.checked || false,
        amount: parseInt(
          document.getElementById("fxDistAmount")?.value || "30",
        ),
      },
      delay: {
        on: document.getElementById("fxDelayOn")?.checked || false,
        time: parseInt(document.getElementById("fxDelayTime")?.value || "300"),
        feedback: parseInt(document.getElementById("fxDelayFB")?.value || "40"),
        mix: parseInt(document.getElementById("fxDelayMix")?.value || "30"),
      },
      reverb: {
        on: document.getElementById("fxReverbOn")?.checked || false,
        decay: parseInt(
          document.getElementById("fxReverbDecay")?.value || "15",
        ),
        mix: parseInt(document.getElementById("fxReverbMix")?.value || "25"),
      },
    },
  };
  PARTS.forEach((p) => {
    data.drum.pattern[p.id] = [...pattern[p.id]];
    data.drum.partVolume[p.id] = partVolume[p.id];
  });
  return data;
}

function saveProject() {
  const slot = document.getElementById("saveSlot").value;
  const data = getFullProjectData();
  data.savedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_PREFIX + slot, JSON.stringify(data));
    localStorage.setItem(STORAGE_PREFIX + "lastSlot", slot);
    showToast(`💾 Slot ${parseInt(slot) + 1} に保存しました`);
  } catch (e) {
    showToast("❌ 保存に失敗: " + e.message);
  }
}

function loadProjectFromSlot() {
  const slot = document.getElementById("saveSlot").value;
  const raw = localStorage.getItem(STORAGE_PREFIX + slot);
  if (!raw) {
    showToast(`⚠ Slot ${parseInt(slot) + 1} にデータがありません`);
    return;
  }
  try {
    applyProjectData(JSON.parse(raw));
    showToast(`📂 Slot ${parseInt(slot) + 1} をロードしました`);
  } catch (e) {
    showToast("❌ ロードに失敗: " + e.message);
  }
}

function exportProjectJSON() {
  const blob = new Blob([JSON.stringify(getFullProjectData(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wbm_project_${bpm}bpm.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("📤 プロジェクトJSONをエクスポートしました");
}

function importProjectJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      applyProjectData(JSON.parse(e.target.result));
      showToast("📥 プロジェクトをインポートしました");
    } catch {
      showToast("❌ JSONの読み込みに失敗");
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

function applyProjectData(data) {
  if (data.bpm) {
    bpm = data.bpm;
    document.getElementById("bpmSlider").value = bpm;
    document.getElementById("bpmValue").textContent = bpm;
  }
  if (data.swing != null) {
    swing = data.swing;
    document.getElementById("swingSlider").value = swing;
    document.getElementById("swingValue").textContent = swing + "%";
  }
  if (data.masterVol != null) {
    masterVol = data.masterVol / 100;
    document.getElementById("masterVolSlider").value = data.masterVol;
    if (masterGain) masterGain.gain.value = masterVol;
  }
  if (data.drum) {
    if (data.drum.pattern) {
      PARTS.forEach((p) => {
        if (data.drum.pattern[p.id]) {
          for (let i = 0; i < STEPS; i++)
            pattern[p.id][i] = !!data.drum.pattern[p.id][i];
        }
      });
      updateGridUI();
    }
    if (data.drum.partVolume)
      PARTS.forEach((p) => {
        if (data.drum.partVolume[p.id] != null)
          partVolume[p.id] = data.drum.partVolume[p.id];
      });
    if (data.drum.trackVol != null) {
      trackState.drum.vol = data.drum.trackVol / 100;
      document.getElementById("drumVolSlider").value = data.drum.trackVol;
    }
    if (data.drum.muted != null) trackState.drum.muted = data.drum.muted;
  }
  if (data.melody) {
    if (data.melody.notes) {
      for (let i = 0; i < STEPS; i++)
        melodyNotes[i] =
          data.melody.notes[i] != null ? data.melody.notes[i] : null;
    }
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el && val != null) el.value = val;
    };
    setEl("melodyWaveform", data.melody.waveform);
    setEl("melodyScale", data.melody.scale);
    setEl("melodyKey", data.melody.key);
    setEl("melodyOctave", data.melody.octave);
    if (data.melody.adsr) {
      setEl("adsrA", data.melody.adsr.a);
      setEl("adsrD", data.melody.adsr.d);
      setEl("adsrS", data.melody.adsr.s);
      setEl("adsrR", data.melody.adsr.r);
      updateADSRDisplay();
    }
    if (data.melody.trackVol != null) {
      trackState.melody.vol = data.melody.trackVol / 100;
      document.getElementById("melodyVolSlider").value = data.melody.trackVol;
    }
    if (data.melody.muted != null) trackState.melody.muted = data.melody.muted;
    if (melodyInitialized) {
      buildPianoKeys();
      drawPianoRoll();
    }
  }
  if (data.bass) {
    if (data.bass.notes) {
      for (let i = 0; i < STEPS; i++)
        bassNotes[i] = data.bass.notes[i] != null ? data.bass.notes[i] : null;
    }
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el && val != null) el.value = val;
    };
    setEl("bassWaveform", data.bass.waveform);
    setEl("bassScale", data.bass.scale);
    setEl("bassKey", data.bass.key);
    setEl("bassOctave", data.bass.octave);
    if (data.bass.adsr) {
      setEl("bassAdsrA", data.bass.adsr.a);
      setEl("bassAdsrD", data.bass.adsr.d);
      setEl("bassAdsrS", data.bass.adsr.s);
      setEl("bassAdsrR", data.bass.adsr.r);
      updateBassADSRDisplay();
    }
    if (data.bass.trackVol != null) {
      trackState.bass.vol = data.bass.trackVol / 100;
      document.getElementById("bassVolSlider").value = data.bass.trackVol;
    }
    if (data.bass.muted != null) trackState.bass.muted = data.bass.muted;
    if (bassInitialized) {
      buildBassPianoKeys();
      drawBassRoll();
    }
  }
  if (data.fx) {
    const setChk = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = val;
    };
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val != null) el.value = val;
    };
    if (data.fx.filter) {
      setChk("fxFilterOn", data.fx.filter.on);
      setVal("fxFilterType", data.fx.filter.type);
      setVal("fxFilterCutoff", data.fx.filter.cutoff);
      setVal("fxFilterQ", data.fx.filter.q);
    }
    if (data.fx.distortion) {
      setChk("fxDistOn", data.fx.distortion.on);
      setVal("fxDistAmount", data.fx.distortion.amount);
    }
    if (data.fx.delay) {
      setChk("fxDelayOn", data.fx.delay.on);
      setVal("fxDelayTime", data.fx.delay.time);
      setVal("fxDelayFB", data.fx.delay.feedback);
      setVal("fxDelayMix", data.fx.delay.mix);
    }
    if (data.fx.reverb) {
      setChk("fxReverbOn", data.fx.reverb.on);
      setVal("fxReverbDecay", data.fx.reverb.decay);
      setVal("fxReverbMix", data.fx.reverb.mix);
    }
    if (fxInitialized) updateFx();
  }
  applyTrackStates();
}

function showToast(msg) {
  const t = document.getElementById("saveToast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

function autoRestore() {
  const ls = localStorage.getItem(STORAGE_PREFIX + "lastSlot");
  if (ls == null) return;
  const raw = localStorage.getItem(STORAGE_PREFIX + ls);
  if (!raw) return;
  try {
    applyProjectData(JSON.parse(raw));
    document.getElementById("saveSlot").value = ls;
  } catch (e) {}
}
