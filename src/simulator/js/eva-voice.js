/* --- EVA15風 演出のボイス（VOICEVOX で作った音声を鳴らす） --- */

// ============================================================
// 役ごとの声（VOICEVOX のキャラとスタイル）。ユーザー指定 2026-10-03：
//   ミサト＝九州そら（あまあま）、レイ＝ナースロボ＿タイプＴ（楽々）、カヲル＝玄野武宏（喜び）。
//   ゲンドウ＝麒ヶ島宗麟（ノーマル。他キャラのセリフあてが規約で明記して可・申請不要）、
//   アナウンス＝Voidoll（ノーマル。個人利用は申請不要）。No.7・青山龍星は規約上の不安があり差し替え。
//   指定の無い役（アスカ・シンジなど）はアナウンスの声。
// speaker は VOICEVOX ENGINE のスタイル ID（scripts/gen-eva-voices.mjs が音声を作るときに使う）。
// credit はページに出すクレジット表記（各規約の例の形。VirVox の 2 人と Voidoll は CV 名まで入れる）
// ============================================================
const EVA_VOICE_ROLES = {
  misato: { speaker: 15, credit: "VOICEVOX:九州そら" },
  rei: { speaker: 48, credit: "VOICEVOX:ナースロボ＿タイプＴ" },
  kaworu: { speaker: 39, credit: "VOICEVOX:玄野武宏(CV:ガロ)" },
  gendo: { speaker: 53, credit: "VOICEVOX:麒ヶ島宗麟(CV:レオブラック)" },
  announce: { speaker: 89, credit: "VOICEVOX:Voidoll(CV:丹下桜)" },
};

// 音声の一覧：id（voice/<id>.mp3）・役・読み上げる文（読みを直すためにかなや数字に置き換える）・
// 対応する演出の文字（eva-effects.js の state.text と同じもの）。
// リーチの演出（リーチ名・リーチボイス・カットイン・SP 発展）には付けない（ユーザー方針 2026-10-03）。
// 次回予告とタイトル予告はミサトの次回予告の固定セリフ（1geki の次回予告「ボイス」）：
//   通常「この次も期待してね～」（58.6%）、大当り濃厚は「この次もサービス、サービス」（プレミア）
// 「さーて、この次もぉ、サービス、サービスゥ！」の読みは劇場版（ニコニコ動画 sm10857450 の 25.45〜28.05 秒）を
// 測って合わせる（ユーザー方針 2026-10-03）。prosody：VOICEVOX の 1 音（モーラ）ずつの [高さHz, 長さ秒]
// （高さ 0 は無声、null はそのまま）と読点の間（秒）。高さは scale 倍する（本家は 360〜730Hz。
// 聞き比べで九州そら あまあまのまま本家と同じ高さ＝1.0 を選んだ。ユーザー選択 2026-10-03）。
// scripts/gen-eva-voices.mjs が audio_query に当てはめる
// 音声ファイルの版（作り直したら上げる。eva-voice.js の再生で ?v= に付ける）
const EVA_VOICE_VER = "20261003-sate";
const EVA_SATE_PROSODY = [
  [392, 0.16], // さ（364→421）
  [630, 0.14], // ー（533→727 へ一気に上がる）
  [590, 0.2], // て
  [440, 0.06], // こ
  [325, 0.12], // の（低く）
  [490, 0.11], // つ
  [420, 0.14], // ぎ
  [370, 0.13], // も
  [690, 0.11], // ぉ（しゃくり上げる）
];
const EVA_VOICES = [
  // ミサト：次回予告・タイトル予告（通常）。「さーて、この次もぉ」は劇場版の読みに合わせる
  {
    id: "next-kitai",
    role: "misato",
    line: "さーて、この次もぉ、期待してね〜",
    prosody: { scale: 1, moras: EVA_SATE_PROSODY, pauses: [0.1, 0.3] },
    texts: [
      "次回予告\nレイ、心のむこうに",
      "次回予告\nアスカ、来日",
      "次回予告\n男の戰い",
      "次回予告\n涙",
      "次回予告\n奇跡の価値は",
      "次回予告\nAir",
      "レイ、心のむこうに",
      "アスカ、来日",
      "男の戰い",
      "Air",
      "涙",
      "奇跡の価値は",
      // 赤の警報から出たタイトル予告
      "警報\nレイ、心のむこうに",
      "警報\nアスカ、来日",
      "警報\n男の戰い",
      "警報\nAir",
      "警報\n涙",
      "警報\n奇跡の価値は",
      "次回予告\nこの次も期待してね",
    ],
  },
  // ミサト：大当り濃厚（サービス、サービス・黒地の次回予告・最後のシ者・発展先と矛盾のタイトル）
  {
    id: "next-service",
    role: "misato",
    line: "さーて、この次もぉ、サービス、サービスゥ！",
    prosody: {
      scale: 1,
      moras: [
        ...EVA_SATE_PROSODY,
        [520, 0.08], // サ（1 回目は速く、高めから下がる）
        [495, 0.06], // ー
        [450, 0.12], // ビ（ささやくように小さい）
        [0, 0.1], // ス（無声）
        [490, 0.1], // サ（2 回目）
        [560, 0.11], // ー
        [550, 0.15], // ビ
        [590, 0.1], // ス
        [480, 0.25], // ゥ（伸ばして下げる）
      ],
      pauses: [0.1, 0.3, 0.01],
    },
    texts: [
      "次回予告\nサービス、サービス",
      "次回予告",
      "最後のシ者",
      "タイトル予告",
      // 段3 で足した濃厚の次回予告・タイトル予告（最後のシ者・ランプ矛盾・対応リーチの無いタイトル）
      "次回予告\n最後のシ者",
      "次回予告\nランプ矛盾",
      "次回予告\nランプ 最後のシ者",
      "タイトル予告\nランプ矛盾",
      "使徒、襲来",
      "瞬間、心、重ねて",
      "まごころを、君に",
      "警報(朱)\nまさか暴走",
      "次回予告\nこの次もサービス、サービス",
    ],
  },
  // ゲンドウ
  {
    id: "gendo-seele",
    role: "gendo",
    line: "ゼーレからの、贈り物だよ",
    texts: ["ゼーレからの贈り物だよ"],
  },
  {
    id: "gendo-scenario",
    role: "gendo",
    line: "すべては、ゼーレのシナリオ通りに",
    texts: ["すべてはゼーレのシナリオ通りに"],
  },
  {
    id: "gendo-clock",
    role: "gendo",
    line: "時計の針は、元には戻らない",
    texts: ["時計の針は元に戻らない"],
  },
  // アナウンス（警報の読み上げ。指定の無い役のセリフもここ）
  {
    id: "alert",
    role: "announce",
    line: "警報、警報",
    texts: [
      "警報\nイスラフェル",
      "警報\nレリエル",
      "警報\nゼルエル",
      "警報\nアルミサエル",
      "警報\nサハクィエル",
      "警報\n量産機",
      "警報\nカヲル",
      "警報\nサキエル",
      "警報(朱)\nタイトル予告",
      "警報\nシンクロ",
      "警報(朱)\n使徒予告",
      "警報(朱)\nカヲル",
      "警報\nLv.4",
    ],
  },
  // ミッションモード前兆の当該（4/4 で成功・継続。ST の擬似連の層は 2026-10-04 に削除）
  {
    id: "caution",
    role: "announce",
    line: "コーション",
    texts: ["CAUTION\n4/4", "CAUTION\n継続"],
  },
];

// 演出の文字 → 音声の id
const EVA_VOICE_BY_TEXT = {};
for (const v of EVA_VOICES) {
  for (const t of v.texts) EVA_VOICE_BY_TEXT[t] = v.id;
}
function evaVoiceOf(text) {
  return (text && EVA_VOICE_BY_TEXT[text]) || null;
}

// ============================================================
// 再生。ボタンで ON/OFF（初期は ON）。同時に重ねず、新しい声が来たら前の声を止める。
// 音は Web Audio（AudioContext）で鳴らす。スマホのブラウザ（特に iPhone の Safari）は、画面をタップした
// 処理の中で鳴らし始めた音しか許さない。演出のタイミング（タイマーの中）で初めて鳴らす <audio> は断られて
// 無音になっていた（PC の Chrome は一度クリックすれば後から鳴らせるので気づかなかった。ユーザー指摘 2026-10-04）。
// AudioContext はタップ・クリック・キー操作の処理の中で resume しておけば、その後はタイマーの中からでも鳴る。
// iPhone は <audio> の volume も変えられない（告知音の音量・フェードが効かない）ので、音量は GainNode で下げる。
// なお Web Audio は iPhone のマナーモード中は鳴らない
// ============================================================
let evaVoiceOn = true;
const evaAudio = {
  ctx: null,
  buffers: {}, // URL → 読み込んだ音（AudioBuffer）
  loading: {}, // URL → 読み込み中の Promise
  voice: null, // 鳴っている声（evaStartSound の返り値）
  notices: [], // 鳴っている告知音
};
// 読み込み中に頼まれた音は読み込み後に鳴らすが、これより遅れたら演出とずれるので鳴らさない
const EVA_AUDIO_LATE_MS = 1500;

function evaAudioCtx() {
  if (evaAudio.ctx) return evaAudio.ctx;
  const AC =
    typeof window !== "undefined" &&
    (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    evaAudio.ctx = new AC();
  } catch (e) {
    return null;
  }
  return evaAudio.ctx;
}

// ?v= は作り直した音声をブラウザに古いまま残さないため（作り直したら EVA_VOICE_VER を上げる）
function evaVoiceUrl(id) {
  return `voice/${id}.mp3?v=${EVA_VOICE_VER}`;
}

// 音声を読み込んで AudioBuffer にする（1 回だけ。失敗したら null で、次に頼まれたとき読み直す）
function evaLoadBuffer(url) {
  if (evaAudio.buffers[url]) return Promise.resolve(evaAudio.buffers[url]);
  if (evaAudio.loading[url]) return evaAudio.loading[url];
  const ctx = evaAudioCtx();
  if (!ctx || typeof fetch === "undefined") return Promise.resolve(null);
  const p = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.arrayBuffer();
    })
    // 古い Safari の decodeAudioData は Promise を返さないのでコールバックで受ける
    .then((data) => new Promise((ok, ng) => ctx.decodeAudioData(data, ok, ng)))
    .then((buf) => (evaAudio.buffers[url] = buf))
    .catch(() => null)
    .then((buf) => {
      delete evaAudio.loading[url];
      return buf;
    });
  evaAudio.loading[url] = p;
  return p;
}

// 音を 1 つ鳴らす。返り値は止めるための札 { stopped, src, gain, onended }（鳴らせない環境では null）。
// onended を入れておくと鳴り終わったときに呼ぶ（止めたときは呼ばない）
function evaStartSound(url, volume) {
  const ctx = evaAudioCtx();
  if (!ctx) return null;
  const h = { stopped: false, src: null, gain: null, onended: null };
  const asked = Date.now();
  const start = (buf) => {
    if (!buf || h.stopped || !evaVoiceOn) return;
    if (Date.now() - asked > EVA_AUDIO_LATE_MS) return;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.connect(ctx.destination);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gain);
    src.onended = () => {
      if (!h.stopped && h.onended) h.onended();
    };
    src.start(0);
    h.src = src;
    h.gain = gain;
  };
  const buf = evaAudio.buffers[url];
  if (buf) start(buf);
  else evaLoadBuffer(url).then(start);
  return h;
}

function evaStopSound(h) {
  if (!h) return;
  h.stopped = true;
  if (h.src) {
    try {
      h.src.stop();
    } catch (e) {
      // 止まっている音は止めなくてよい
    }
  }
}

// 全部の音を先に読み込んでおく（初めて操作されたとき。鳴らすときに読み込みを待たないように）
function evaPreloadSounds() {
  for (const v of EVA_VOICES) evaLoadBuffer(evaVoiceUrl(v.id));
  for (const s of Object.values(EVA_NOTICE_SOUNDS)) evaLoadBuffer(s.file);
}

// タップ・クリック・キー操作のたびに呼ぶ（その処理の中で resume しないとスマホでは鳴らない）
function evaUnlockAudio() {
  const ctx = evaAudioCtx();
  if (!ctx) return;
  if (ctx.state !== "running") {
    const p = ctx.resume();
    if (p && p.catch) p.catch(() => {});
    // 古い iPhone は無音を 1 回鳴らさないと鳴るようにならない
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
    } catch (e) {
      // 鳴らせなくてもよい
    }
  }
  if (!evaUnlockAudio.loaded) {
    evaUnlockAudio.loaded = true;
    evaPreloadSounds();
  }
}

if (typeof document !== "undefined" && document.addEventListener) {
  // ボタンの onclick より先に呼ぶ（capture）。どのボタンを押しても鳴るようになる
  for (const type of ["touchend", "click", "keydown"]) {
    document.addEventListener(type, evaUnlockAudio, true);
  }
  // iPhone は裏に回すと止まるので、戻ったら鳴るように戻す（まだ一度も操作されていなければ何もしない）
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && evaAudio.ctx) evaUnlockAudio();
  });
}

function evaPlayVoice(id) {
  if (!evaVoiceOn || !id) return;
  evaStopSound(evaAudio.voice);
  evaAudio.voice = evaStartSound(evaVoiceUrl(id), 1);
}

// クレジット表記（使っている役の声だけ。音声素材としての配布ではない旨も添える）
function evaRenderVoiceCredit() {
  const el =
    typeof document !== "undefined" && document.getElementById("voice-credit");
  if (!el) return;
  // 実際に音声を使っている役だけ
  const credits = [
    ...new Set(
      EVA_VOICES.map((v) => EVA_VOICE_ROLES[v.role].credit).filter(Boolean),
    ),
  ];
  el.textContent =
    "演出ボイス：" +
    credits.join(" / ") +
    "（シミュレーター内の演出用です。音声素材としての配布・二次利用はできません）";
}
evaRenderVoiceCredit();

// ============================================================
// 一発告知音（パチンコ エヴァンゲリオン公式サイトのダウンロードコンテンツ
// https://eva-project.jp/download/#sound 。ユーザー方針 2026-10-03。出典はページ下の注意書き）。
// 原音は大きいので音量を下げ（平均 -9〜-11dB → ボイスと同じくらいに）、着メロの 2 曲は 5 秒でフェードアウト。
// 保留を消化した瞬間（変動開始）に鳴らす
// ============================================================
const EVA_NOTICE_SOUNDS = {
  // インパクトフラッシュは一発告知のとき 2 回続けて鳴らす（ユーザー方針 2026-10-03）
  impact: { file: "se/sound_01.mp3", volume: 0.3, maxMs: 0, times: 2 },
  ninth: { file: "se/sound_02.mp3", volume: 0.25, maxMs: 5000 }, // 着メロ 交響曲第九番
  gospel: { file: "se/sound_03.mp3", volume: 0.25, maxMs: 5000 }, // 着メロ 諸人こぞりて
  // 次回予告の曲（鷺巣詩郎「次回予告 (F-2 30秒バージョン)」の 0〜28 秒。音量はそろえて切り出し済み）
  next: { file: "se/next-yokoku.mp3", volume: 0.45, maxMs: 0 },
};
// 演出（state.id）→ 告知音。ここに無い一発告知（100% の演出）はインパクトフラッシュの音
const EVA_NOTICE_BY_STATE = {
  "impact-flash": "impact",
  "fukuin-air": "gospel",
  "kaworu-digit": "ninth",
  "kaworu-button": "ninth",
};
// 告知音を鳴らす層（通常時の一発告知・ST の一発告知/枠フラッシュ）
const EVA_NOTICE_LAYERS = ["oneshot", "flash"];
const EVA_NOTICE_FADE_MS = 800;

// その回転の告知音（eva-engine.js が job.notice に入れる）。インパクトフラッシュを優先
function evaNoticeOf(shown) {
  let notice = null;
  for (const { layer, state } of shown) {
    if (!EVA_NOTICE_LAYERS.includes(layer.key) || state.trust < 100) continue;
    const id = EVA_NOTICE_BY_STATE[state.id] || "impact";
    if (id === "impact" && state.id === "impact-flash") return "impact";
    if (!notice) notice = id;
  }
  return notice;
}

// 鳴っている告知音をすべて止める
function evaStopNotices() {
  for (const h of evaAudio.notices) evaStopSound(h);
  evaAudio.notices = [];
}

// 少しずつ小さくして止める（着メロの maxMs）
function evaFadeStop(h) {
  if (!h || h.stopped || !h.gain || !evaAudio.ctx) return;
  const t = evaAudio.ctx.currentTime;
  const end = t + EVA_NOTICE_FADE_MS / 1000;
  const g = h.gain.gain;
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(0, end);
  h.stopped = true; // 鳴り終わりでもう一度鳴らさない
  try {
    h.src.stop(end);
  } catch (e) {
    // 止まっている音は止めなくてよい
  }
}

// times：続けて鳴らす回数（省くと音ごとの既定。復活当りの合図などは 1 回）。
// 前の告知音は止めてから鳴らす
function evaPlayNotice(id, times) {
  const snd = EVA_NOTICE_SOUNDS[id];
  if (!evaVoiceOn || !snd) return;
  evaStopNotices();
  // 鳴り終わったら残りの回数だけ頭からもう一度
  let rest = times || snd.times || 1;
  const play = () => {
    if (rest-- <= 0 || !evaVoiceOn) return;
    const h = evaStartSound(snd.file, snd.volume);
    if (!h) return;
    h.onended = play;
    evaAudio.notices.push(h);
    if (snd.maxMs) setTimeout(() => evaFadeStop(h), snd.maxMs);
  };
  play();
}

// ボイスと告知音をまとめて ON/OFF
function evaToggleVoice() {
  evaVoiceOn = !evaVoiceOn;
  if (!evaVoiceOn) {
    evaStopSound(evaAudio.voice);
    evaAudio.voice = null;
    evaStopNotices();
  }
  const btn = document.getElementById("btn-voice");
  if (btn) {
    btn.classList.toggle("active", evaVoiceOn);
    btn.innerText = evaVoiceOn ? "サウンド ON" : "サウンド OFF";
  }
}
