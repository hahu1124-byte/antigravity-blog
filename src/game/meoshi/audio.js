// 目押しチャレンジ: 効果音（WebAudio で合成。音声ファイルは使わない）
let ctx = null;
let master = null;
let enabled = true;

function audioCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch (e) {
    return null;
  }
  return ctx;
}

export function setSoundEnabled(on) {
  enabled = on;
}

// タップ・キー操作のたびに呼ぶ（その処理の中で resume しないとスマホでは鳴らない）
export function unlockAudio() {
  const c = audioCtx();
  if (!c || c.state === "running") return;
  const p = c.resume();
  if (p && p.catch) p.catch(() => {});
  // 古い iPhone は無音を 1 回鳴らさないと鳴るようにならない
  try {
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  } catch (e) {
    // 鳴らせなくてもよい
  }
}

// 1 音。at は今からの秒
function tone(
  freq,
  dur,
  { type = "square", vol = 0.5, at = 0, slideTo = 0 } = {},
) {
  const c = audioCtx();
  if (!c || !enabled) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// 短い雑音（レバーの「ガシャ」）
function noise(dur, { vol = 0.4, at = 0, freq = 1800 } = {}) {
  const c = audioCtx();
  if (!c || !enabled) return;
  const t = c.currentTime + at;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t);
}

export const sfx = {
  // リール始動音（レバーを叩いてリールが回り始めたとき。遅れのゲームは 0.8 秒後に鳴る）
  lever() {
    noise(0.07, { vol: 0.6, freq: 1200 });
    tone(140, 0.12, { type: "triangle", vol: 0.5 });
    tone(660, 0.18, { type: "square", vol: 0.18, at: 0.04, slideTo: 1320 });
    tone(1320, 0.12, { type: "square", vol: 0.14, at: 0.22 });
  },
  stop() {
    noise(0.03, { vol: 0.5, freq: 3000 });
    tone(900, 0.04, { type: "square", vol: 0.15 });
  },
  replay() {
    tone(1320, 0.08, { type: "square", vol: 0.2 });
    tone(1760, 0.1, { type: "square", vol: 0.2, at: 0.08 });
  },
  // 払い出し 1 枚ごとに「ピッ」
  payout(n) {
    for (let i = 0; i < Math.min(n, 15); i++)
      tone(2093, 0.04, { type: "square", vol: 0.15, at: i * 0.06 });
  },
  // 告知ランプ（上がっていく音）
  notice() {
    tone(500, 0.5, { type: "sawtooth", vol: 0.25, slideTo: 2400 });
    tone(2400, 0.4, { type: "square", vol: 0.18, at: 0.5 });
  },
  // ボーナスが揃った
  bonus() {
    const notes = [784, 988, 1175, 1568, 1175, 1568, 2093];
    notes.forEach((f, i) =>
      tone(f, 0.16, { type: "square", vol: 0.22, at: i * 0.11 }),
    );
  },
  // ビタ押し練習の判定
  hit() {
    tone(1568, 0.07, { type: "square", vol: 0.2 });
    tone(2093, 0.12, { type: "square", vol: 0.2, at: 0.06 });
  },
  miss() {
    tone(220, 0.15, { type: "triangle", vol: 0.3 });
  },
  // 遅延補正のメトロノーム（at は今からの秒）
  click(at = 0) {
    tone(1760, 0.03, { type: "square", vol: 0.2, at });
  },
};
