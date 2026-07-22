// ========================================
// WAVエクスポート
// ========================================
async function exportWAV() {
  const btn = document.getElementById("exportBtn");
  const progress = document.getElementById("exportProgress");
  const statusEl = document.getElementById("exportStatus");
  btn.disabled = true;
  progress.classList.add("active");
  statusEl.textContent = "レンダリング中...";
  try {
    const loops = parseInt(document.getElementById("loopCount").value);
    const secondsPerBeat = 60.0 / bpm;
    const sixteenthNote = secondsPerBeat / 4;
    const loopDuration = STEPS * sixteenthNote;
    const tailSeconds = 2.0;
    const totalDuration = loopDuration * loops + tailSeconds;
    const sampleRate = 44100;
    const offCtx = new OfflineAudioContext(
      2,
      Math.ceil(totalDuration * sampleRate),
      sampleRate,
    );
    const offMasterGain = offCtx.createGain();
    offMasterGain.gain.value = masterVol;
    const offDrumBus = offCtx.createGain();
    offDrumBus.gain.value = trackState.drum.muted ? 0 : trackState.drum.vol;
    const offMelodyBus = offCtx.createGain();
    offMelodyBus.gain.value = trackState.melody.muted
      ? 0
      : trackState.melody.vol;
    const offBassBus = offCtx.createGain();
    offBassBus.gain.value = trackState.bass.muted ? 0 : trackState.bass.vol;
    const anySolo = ["drum", "melody", "bass"].some(
      (t) => trackState[t].soloed,
    );
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
    const filterOn = document.getElementById("fxFilterOn").checked;
    offFilter.type = filterOn
      ? document.getElementById("fxFilterType").value
      : "lowpass";
    offFilter.frequency.value = filterOn
      ? parseInt(document.getElementById("fxFilterCutoff").value)
      : 20000;
    offFilter.Q.value = filterOn
      ? parseInt(document.getElementById("fxFilterQ").value) / 10
      : 0.1;
    const offDist = offCtx.createWaveShaper();
    const distOn = document.getElementById("fxDistOn").checked;
    offDist.curve = makeDistortionCurve(
      distOn ? parseInt(document.getElementById("fxDistAmount").value) : 0,
    );
    offDist.oversample = "4x";
    const offDelay = offCtx.createDelay(2.0);
    const delayOn = document.getElementById("fxDelayOn").checked;
    offDelay.delayTime.value =
      parseInt(document.getElementById("fxDelayTime").value) / 1000;
    const offDelayFB = offCtx.createGain();
    offDelayFB.gain.value =
      parseInt(document.getElementById("fxDelayFB").value) / 100;
    const delayMix = parseInt(document.getElementById("fxDelayMix").value);
    const offDelayDry = offCtx.createGain();
    offDelayDry.gain.value = delayOn ? 1 - delayMix / 200 : 1;
    const offDelayWet = offCtx.createGain();
    offDelayWet.gain.value = delayOn ? delayMix / 100 : 0;
    const offReverbConv = offCtx.createConvolver();
    const reverbOn = document.getElementById("fxReverbOn").checked;
    const reverbDecay =
      parseInt(document.getElementById("fxReverbDecay").value) / 10;
    const reverbMix = parseInt(document.getElementById("fxReverbMix").value);
    offReverbConv.buffer = createReverbIR(offCtx, reverbDecay);
    const offReverbDry = offCtx.createGain();
    offReverbDry.gain.value = reverbOn ? 1 - reverbMix / 200 : 1;
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
    statusEl.textContent = "ノートをスケジュール中...";
    await new Promise((r) => setTimeout(r, 10));
    for (let loop = 0; loop < loops; loop++) {
      let noteTime = loop * loopDuration;
      for (let step = 0; step < STEPS; step++) {
        PARTS.forEach((part) => {
          if (pattern[part.id][step])
            scheduleOfflineDrum(
              offCtx,
              offDrumBus,
              part.id,
              noteTime,
              partVolume[part.id],
            );
        });
        if (melodyNotes[step] != null)
          scheduleOfflineSynth(
            offCtx,
            offMelodyBus,
            melodyNotes[step],
            noteTime,
            sixteenthNote * 0.9,
            getMelodyConfig(),
          );
        if (bassNotes[step] != null)
          scheduleOfflineSynth(
            offCtx,
            offBassBus,
            bassNotes[step],
            noteTime,
            sixteenthNote * 0.9,
            getBassConfig(),
          );
        if ((step + 1) % 2 === 1 && swing > 0)
          noteTime += sixteenthNote * (1 + (swing / 100) * 0.66);
        else noteTime += sixteenthNote;
      }
    }
    statusEl.textContent = "オーディオレンダリング中...";
    await new Promise((r) => setTimeout(r, 10));
    const renderedBuffer = await offCtx.startRendering();
    statusEl.textContent = "WAVエンコード中...";
    await new Promise((r) => setTimeout(r, 10));
    const wavBlob = encodeWAV(renderedBuffer);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wbm_${bpm}bpm_${loops}loop.wav`;
    a.click();
    URL.revokeObjectURL(url);
    statusEl.textContent = "完了！";
    showToast("✅ WAVファイルをダウンロードしました");
    setTimeout(() => progress.classList.remove("active"), 1500);
  } catch (err) {
    console.error("Export failed:", err);
    statusEl.textContent = "エラー: " + err.message;
    showToast("❌ エクスポートに失敗しました");
    setTimeout(() => progress.classList.remove("active"), 3000);
  } finally {
    btn.disabled = false;
  }
}

function scheduleOfflineDrum(c, bus, partId, time, vol) {
  switch (partId) {
    case "kick": {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(160, time);
      osc.frequency.exponentialRampToValueAtTime(35, time + 0.12);
      gain.gain.setValueAtTime(vol * 0.9, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
      osc.connect(gain).connect(bus);
      osc.start(time);
      osc.stop(time + 0.35);
      const click = c.createOscillator();
      const cGain = c.createGain();
      click.type = "square";
      click.frequency.setValueAtTime(1200, time);
      click.frequency.exponentialRampToValueAtTime(200, time + 0.02);
      cGain.gain.setValueAtTime(vol * 0.15, time);
      cGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
      click.connect(cGain).connect(bus);
      click.start(time);
      click.stop(time + 0.03);
      break;
    }
    case "snare": {
      const osc = c.createOscillator();
      const oGain = c.createGain();
      osc.type = "triangle";
      osc.frequency.value = 200;
      oGain.gain.setValueAtTime(vol * 0.4, time);
      oGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      osc.connect(oGain).connect(bus);
      osc.start(time);
      osc.stop(time + 0.12);
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
      noise.connect(filter).connect(nGain).connect(bus);
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
      noise.connect(hp).connect(gain).connect(bus);
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
      noise.connect(hp).connect(gain).connect(bus);
      noise.start(time);
      break;
    }
    case "clap": {
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
        noise.connect(bp).connect(gain).connect(bus);
        noise.start(t);
      }
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
      tailNoise.connect(tailBp).connect(tailGain).connect(bus);
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
      osc.connect(gain).connect(bus);
      osc.start(time);
      osc.stop(time + 0.3);
      break;
    }
  }
}

function scheduleOfflineSynth(c, bus, midi, time, duration, cfg) {
  // 楽器合成エンジンを共有使用（オンライン/オフライン両対応）
  synthesizeNote(c, bus, midi, time, duration, cfg);
}

function encodeWAV(audioBuffer) {
  const numCh = audioBuffer.numberOfChannels;
  const sr = audioBuffer.sampleRate;
  const bps = 16;
  const ba = numCh * 2;
  const nf = audioBuffer.length;
  const ds = nf * ba;
  const bs = 44 + ds;
  const buf = new ArrayBuffer(bs);
  const v = new DataView(buf);
  function ws(o, s) {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  }
  ws(0, "RIFF");
  v.setUint32(4, bs - 8, true);
  ws(8, "WAVE");
  ws(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, numCh, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * ba, true);
  v.setUint16(32, ba, true);
  v.setUint16(34, bps, true);
  ws(36, "data");
  v.setUint32(40, ds, true);
  const chs = [];
  for (let c = 0; c < numCh; c++) chs.push(audioBuffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < nf; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, chs[c][i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([buf], { type: "audio/wav" });
}
