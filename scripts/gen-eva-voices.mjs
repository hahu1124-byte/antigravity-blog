// EVA15風シミュの演出ボイスを VOICEVOX ENGINE で作る（src/simulator/voice/<id>.mp3）。
// 対応表は src/simulator/js/eva-voice.js（役ごとの声 EVA_VOICE_ROLES と音声の一覧 EVA_VOICES）。
//
// 使い方：VOICEVOX ENGINE（H:/voicevox_engine/windows-cpu/run.exe）を起動してから
//   node scripts/gen-eva-voices.mjs          … まだ無い音声だけ作る
//   node scripts/gen-eva-voices.mjs --force  … 全部作り直す
//   node scripts/gen-eva-voices.mjs --only next-kitai,next-service … 指定した音声だけ作り直す
// mp3 への変換に ffmpeg を使う。途中の wav は archive/scratch に置いて最後に消す。
// 音声に prosody（eva-voice.js）があれば、1 音（モーラ）ずつの高さと長さ・読点の間をその値にする
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const ENGINE = process.env.VOICEVOX_URL || "http://127.0.0.1:50021";
const OUT_DIR = "src/simulator/voice";
const TMP_DIR = process.env.VOICE_TMP || "../../archive/scratch/eva-voice-wav";
const force = process.argv.includes("--force");
const onlyArg = process.argv.find((a, i) => process.argv[i - 1] === "--only");
const only = onlyArg ? onlyArg.split(",") : null;

// eva-voice.js をブラウザと同じように読み込み、対応表を取り出す
const ctx = vm.createContext({ document: undefined });
vm.runInContext(fs.readFileSync("src/simulator/js/eva-voice.js", "utf8"), ctx, {
  filename: "eva-voice.js",
});
const { EVA_VOICES, EVA_VOICE_ROLES } = vm.runInContext(
  "({ EVA_VOICES, EVA_VOICE_ROLES })",
  ctx,
);

// prosody：{ scale：高さの倍率, moras：[[高さHz（0＝無声・null＝そのまま）, 長さ秒] …], pauses：[読点の間（秒） …] }
function applyProsody(query, p, text) {
  const moras = query.accent_phrases.flatMap((ap) => ap.moras);
  if (p.moras.length > moras.length) {
    throw new Error(
      `prosody の音の数（${p.moras.length}）がセリフ（${moras.length}）より多い: ${text}`,
    );
  }
  const scale = p.scale || 1;
  p.moras.forEach((spec, i) => {
    if (!spec) return;
    const [hz, sec] = spec;
    const m = moras[i];
    if (hz !== null && hz !== undefined) {
      m.pitch = hz > 0 ? Math.log(hz * scale) : 0;
    }
    if (sec) {
      // 子音は元の長さを上限に、音全体の半分まで。残りを母音にする
      const c = m.consonant ? Math.min(m.consonant_length || 0, sec * 0.5) : 0;
      if (m.consonant) m.consonant_length = c;
      m.vowel_length = Math.max(0.02, sec - c);
    }
  });
  let k = 0;
  for (const ap of query.accent_phrases) {
    if (!ap.pause_mora) continue;
    const s = p.pauses && p.pauses[k++];
    if (s !== undefined && s !== null) ap.pause_mora.vowel_length = s;
  }
}

async function synth(text, speaker, prosody) {
  const q = await fetch(
    `${ENGINE}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`,
    { method: "POST" },
  );
  if (!q.ok) throw new Error(`audio_query ${q.status}: ${text}`);
  const query = await q.json();
  if (prosody) applyProsody(query, prosody, text);
  const s = await fetch(`${ENGINE}/synthesis?speaker=${speaker}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!s.ok) throw new Error(`synthesis ${s.status}: ${text}`);
  return Buffer.from(await s.arrayBuffer());
}

const started = Date.now();
console.log(`[voice] 開始 ${new Date(started).toISOString()}`);
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });
let made = 0;
let skipped = 0;
for (const v of EVA_VOICES) {
  const role = EVA_VOICE_ROLES[v.role];
  if (!role || !role.speaker) {
    console.warn(`[voice] 役の声が未設定のため飛ばす: ${v.id}（${v.role}）`);
    skipped++;
    continue;
  }
  const out = path.join(OUT_DIR, `${v.id}.mp3`);
  const wanted = only ? only.includes(v.id) : force || !fs.existsSync(out);
  if (!wanted) {
    skipped++;
    continue;
  }
  const wav = path.join(TMP_DIR, `${v.id}.wav`);
  fs.writeFileSync(wav, await synth(v.line, role.speaker, v.prosody));
  // モノラル 64kbps の mp3（1〜3 秒で 10〜30KB 程度）
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    wav,
    "-ac",
    "1",
    "-b:a",
    "64k",
    out,
  ]);
  fs.rmSync(wav);
  made++;
  console.log(`[voice] ${v.id}（${v.role}）: ${v.line}`);
}
fs.rmSync(TMP_DIR, { recursive: true, force: true });
const ended = Date.now();
console.log(
  `[voice] 終了 ${new Date(ended).toISOString()} 作成 ${made} 件・飛ばした ${skipped} 件・${((ended - started) / 1000).toFixed(1)} 秒`,
);
