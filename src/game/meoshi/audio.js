// 目押しチャレンジ: 効果音（WebAudio で合成。音声ファイルは使わない）
// リール始動音・リプレイ音は、参考動画 https://www.youtube.com/watch?v=-PsvVY0tLLc
// （18〜19 秒がリプレイ音、20〜21 秒が通常の消化時の音）を周波数・長さ・音量で測って合成した
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

// 段の変わり目の切れ目（秒）。参考動画の音は段が変わるたびに一瞬音が細くなる
const STEP_GAP = 0.005;

// 音量を段々に下げる形（phrase 用）。dur を steps の数で等分し、
// 段 i は vol×steps[i] で始まって段の中で ×fall まで下がり、最後の 5ms で切れ目を作る。
// attack が 0 より大きければ段の頭で 0.3 倍から attack 秒かけて上げる。最後の段は 0 まで下げる
function shapeSteps(p, t, dur, vol, steps, fall, attack) {
  const len = dur / steps.length;
  steps.forEach((s, i) => {
    const t0 = t + i * len;
    const v = vol * s;
    if (attack > 0) {
      p.setValueAtTime(v * 0.3, t0);
      p.linearRampToValueAtTime(v, t0 + attack);
    } else {
      p.setValueAtTime(v, t0);
    }
    p.exponentialRampToValueAtTime(v * fall, t0 + len - STEP_GAP);
    p.linearRampToValueAtTime(
      i === steps.length - 1 ? 0 : v * fall * 0.1,
      t0 + len,
    );
  });
}

// 1 音。at は今からの秒。
// steps を渡したときだけ shapeSteps の形にする。渡さなければ今まで通り 0.001 まで指数で下げる
function tone(
  freq,
  dur,
  {
    type = "square",
    vol = 0.5,
    at = 0,
    slideTo = 0,
    steps = null,
    fall = 1,
    attack = 0,
  } = {},
) {
  const c = audioCtx();
  if (!c || !enabled) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  if (steps) {
    shapeSteps(g.gain, t, dur, vol, steps, fall, attack);
  } else {
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  }
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

// 2 音ずつ重ねた矩形波の短いフレーズ。notes は [[高さ1, 高さ2, 長さ秒], ...]
// （参考動画の音を周波数・音量の変化で測り、同じ高さ・長さ・形を合成で作ったもの。動画の音そのものは使っていない）
// fall: 途中の音が 1 音の間に下がる割合（終わりの音量 / 頭の音量）
// last: 最後の音の段ごとの音量（頭の音量に掛ける倍率。最後の音の長さを段の数で等分する）
// lastFall: 最後の音の 1 段の中で下がる割合
// attack: 音の頭の立ち上がり秒
// click: 段の頭で鳴らす低い「カチ」（190Hz）の音量。0 なら鳴らさない
function phrase(
  notes,
  vol,
  { fall = 1, last = [1], lastFall = 1, attack = 0, click = 0 } = {},
) {
  let at = 0;
  notes.forEach(([f1, f2, dur], i) => {
    const isLast = i === notes.length - 1;
    const steps = isLast ? last : [1];
    const shape = { at, steps, fall: isLast ? lastFall : fall, attack };
    tone(f1, dur, { type: "square", vol, ...shape });
    tone(f2, dur, { type: "square", vol, ...shape });
    if (click) {
      steps.forEach((s, k) =>
        tone(190, 0.02, {
          type: "triangle",
          vol: click * s,
          at: at + (k * dur) / steps.length,
        }),
      );
    }
    at += dur;
  });
}

export const sfx = {
  // リール始動音（レバーを叩いてリールが回り始めたとき。遅れのゲームは 0.8 秒後に鳴る）。
  // ド＋ソ → ミ＋シ → レ＋ソ（0.1 秒ずつ、ほぼ平らに鳴る）→ ミ＋ラが 0.1 秒ごとに約 -5dB ずつ
  // 7 段で下がって消える。段の頭ごとに低い「カチ」が入る
  lever() {
    noise(0.03, { vol: 0.35, freq: 1200 });
    phrase(
      [
        [523, 784, 0.1],
        [659, 988, 0.1],
        [587, 784, 0.1],
        [659, 880, 0.7],
      ],
      0.1,
      {
        fall: 0.75,
        last: [1, 0.54, 0.29, 0.16, 0.085, 0.046, 0.025],
        lastFall: 0.8,
        click: 0.3,
      },
    );
  },
  stop() {
    noise(0.03, { vol: 0.5, freq: 3000 });
    tone(900, 0.04, { type: "square", vol: 0.15 });
  },
  // リプレイ音: 4 度離れた 2 音が 0.1 秒ずつ 4 つ上がり（1 音ごとに約 -7dB 下がる）、
  // 最後の 1 つが 0.4 秒伸びて 0.1 秒ごとの段で消える
  replay() {
    phrase(
      [
        [880, 1175, 0.1],
        [988, 1319, 0.1],
        [1047, 1397, 0.1],
        [1175, 1568, 0.1],
        [988, 1319, 0.4],
      ],
      0.1,
      {
        fall: 0.45,
        last: [1, 0.75, 0.28, 0.1],
        lastFall: 0.6,
        attack: 0.012,
      },
    );
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
