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
// 対応する演出の文字（eva-effects.js の state.text と同じもの）
const EVA_VOICES = [
  // ミサト
  { id: "reach", role: "misato", line: "リーチ！", texts: ["リーチ！"] },
  {
    id: "chotto",
    role: "misato",
    line: "ちょっち、期待して",
    texts: ["ちょっち期待して"],
  },
  {
    id: "service",
    role: "misato",
    line: "サービス、サービス！",
    texts: ["サービス、サービス", "次回予告\nサービス、サービス"],
  },
  {
    id: "mirai",
    role: "misato",
    line: "あなた達に、未来を託すわ",
    texts: ["あなた達に未来を託すわ"],
  },
  { id: "next", role: "misato", line: "次回予告", texts: ["次回予告"] },
  {
    id: "next-rei",
    role: "misato",
    line: "次回、レイ、心のむこうに。",
    texts: ["次回予告\nレイ、心のむこうに"],
  },
  {
    id: "next-asuka",
    role: "misato",
    line: "次回、アスカ、来日。",
    texts: ["次回予告\nアスカ、来日"],
  },
  {
    id: "next-otoko",
    role: "misato",
    line: "次回、男の戦い。",
    texts: ["次回予告\n男の戰い"],
  },
  {
    id: "next-namida",
    role: "misato",
    line: "次回、涙。",
    texts: ["次回予告\n涙"],
  },
  {
    id: "next-kiseki",
    role: "misato",
    line: "次回、奇跡の価値は。",
    texts: ["次回予告\n奇跡の価値は"],
  },
  {
    id: "next-air",
    role: "misato",
    line: "次回、エアー。",
    texts: ["次回予告\nAir"],
  },
  // レイ
  {
    id: "rei-shitomeru",
    role: "rei",
    line: "必ず、仕留めるわ",
    texts: ["必ず仕留めるわ"],
  },
  // カヲル
  { id: "kaworu-come", role: "kaworu", line: "来なさい", texts: ["来なさい"] },
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
  // アナウンス（指定の無い役のセリフもここ）
  {
    id: "asuka-indo",
    role: "announce",
    line: "引導を、渡してあげるわ",
    texts: ["引導を渡してあげるわ"],
  },
  {
    id: "shinji-senmetsu",
    role: "announce",
    line: "必ず、殲滅する",
    texts: ["必ず殲滅する"],
  },
  {
    id: "alert",
    role: "announce",
    line: "警報、警報",
    texts: [
      "警報",
      "警報\nイスラフェル",
      "警報\nレリエル",
      "警報\nゼルエル",
      "警報\nアルミサエル",
      "警報\nサハクィエル",
      "警報\n量産機",
      "警報\nカヲル",
      "警報\nサキエル",
      "警報(朱)\nタイトル予告",
    ],
  },
  { id: "caution", role: "announce", line: "コーション", texts: ["CAUTION"] },
  {
    id: "title-rei",
    role: "announce",
    line: "レイ、心のむこうに",
    texts: ["レイ、心のむこうに"],
  },
  {
    id: "title-asuka",
    role: "announce",
    line: "アスカ、来日",
    texts: ["アスカ、来日"],
  },
  {
    id: "title-otoko",
    role: "announce",
    line: "男の戦い",
    texts: ["男の戰い"],
  },
  { id: "title-air", role: "announce", line: "エアー", texts: ["Air"] },
  { id: "title-namida", role: "announce", line: "涙", texts: ["涙"] },
  {
    id: "title-kiseki",
    role: "announce",
    line: "奇跡の価値は",
    texts: ["奇跡の価値は"],
  },
  {
    id: "title-last",
    role: "announce",
    line: "最後のシシャ",
    texts: ["最後のシ者", "タイトルランプ\n最後のシ者"],
  },
  {
    id: "reach-final",
    role: "announce",
    line: "最終号機リーチ",
    texts: ["最終号機リーチ"],
  },
  {
    id: "reach-sho",
    role: "announce",
    line: "初号機リーチ",
    texts: ["初号機リーチ"],
  },
  {
    id: "reach-zero",
    role: "announce",
    line: "ゼロ号機リーチ",
    texts: ["零号機リーチ"],
  },
  {
    id: "reach-ni",
    role: "announce",
    line: "ニ号機リーチ",
    texts: ["弐号機リーチ"],
  },
  {
    id: "reach-synchro",
    role: "announce",
    line: "シンクロリーチ",
    texts: ["シンクロリーチ"],
  },
  {
    id: "reach-dummy",
    role: "announce",
    line: "ダミー初号機リーチ",
    texts: ["ダミー初号機リーチ"],
  },
  {
    id: "reach-zenkaiten",
    role: "announce",
    line: "全回転リーチ",
    texts: ["全回転リーチ\n祝"],
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
// 再生。ボタンで ON/OFF（初期は ON。オートボタンを押した後に鳴るので、ブラウザの自動再生制限に
// かからない）。同時に重ねず、新しい声が来たら前の声を止める
// ============================================================
let evaVoiceOn = true;
let evaVoicePlaying = null;
const evaVoiceCache = {};

function evaPlayVoice(id) {
  if (!evaVoiceOn || !id || typeof Audio === "undefined") return;
  let a = evaVoiceCache[id];
  if (!a) {
    a = new Audio(`voice/${id}.mp3`);
    a.preload = "auto";
    evaVoiceCache[id] = a;
  }
  if (evaVoicePlaying && evaVoicePlaying !== a) evaVoicePlaying.pause();
  evaVoicePlaying = a;
  try {
    a.currentTime = 0;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    // 再生できない環境では鳴らさない
  }
}

// クレジット表記（使っている役の声だけ。音声素材としての配布ではない旨も添える）
function evaRenderVoiceCredit() {
  const el =
    typeof document !== "undefined" && document.getElementById("voice-credit");
  if (!el) return;
  const credits = [
    ...new Set(
      Object.values(EVA_VOICE_ROLES)
        .map((r) => r.credit)
        .filter(Boolean),
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
  impact: { file: "se/sound_01.mp3", volume: 0.3, maxMs: 0 }, // インパクトフラッシュ
  ninth: { file: "se/sound_02.mp3", volume: 0.25, maxMs: 5000 }, // 着メロ 交響曲第九番
  gospel: { file: "se/sound_03.mp3", volume: 0.25, maxMs: 5000 }, // 着メロ 諸人こぞりて
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

const evaNoticeCache = {};
let evaNoticeTimer = null;
function evaPlayNotice(id) {
  const snd = EVA_NOTICE_SOUNDS[id];
  if (!evaVoiceOn || !snd || typeof Audio === "undefined") return;
  let a = evaNoticeCache[id];
  if (!a) {
    a = new Audio(snd.file);
    a.preload = "auto";
    evaNoticeCache[id] = a;
  }
  clearInterval(evaNoticeTimer);
  try {
    a.volume = snd.volume;
    a.currentTime = 0;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    return;
  }
  if (!snd.maxMs) return;
  // 着メロは maxMs で少しずつ小さくして止める
  setTimeout(() => {
    const step = snd.volume / (EVA_NOTICE_FADE_MS / 50);
    evaNoticeTimer = setInterval(() => {
      a.volume = Math.max(0, a.volume - step);
      if (a.volume <= 0) {
        clearInterval(evaNoticeTimer);
        a.pause();
      }
    }, 50);
  }, snd.maxMs);
}

// ボイスと告知音をまとめて ON/OFF
function evaToggleVoice() {
  evaVoiceOn = !evaVoiceOn;
  if (!evaVoiceOn) {
    if (evaVoicePlaying) evaVoicePlaying.pause();
    for (const a of Object.values(evaNoticeCache)) a.pause();
  }
  const btn = document.getElementById("btn-voice");
  if (btn) {
    btn.classList.toggle("active", evaVoiceOn);
    btn.innerText = evaVoiceOn ? "サウンド ON" : "サウンド OFF";
  }
}
