// EVA15風シミュの演出ボイスを VOICEVOX ENGINE で作る（src/simulator/voice/<id>.mp3）。
// 対応表は src/simulator/js/eva-voice.js（役ごとの声 EVA_VOICE_ROLES と音声の一覧 EVA_VOICES）。
//
// 使い方：VOICEVOX ENGINE（H:/voicevox_engine/windows-cpu/run.exe）を起動してから
//   node scripts/gen-eva-voices.mjs          … まだ無い音声だけ作る
//   node scripts/gen-eva-voices.mjs --force  … 全部作り直す
// mp3 への変換に ffmpeg を使う。途中の wav は archive/scratch に置いて最後に消す
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const ENGINE = process.env.VOICEVOX_URL || "http://127.0.0.1:50021";
const OUT_DIR = "src/simulator/voice";
const TMP_DIR = process.env.VOICE_TMP || "../../archive/scratch/eva-voice-wav";
const force = process.argv.includes("--force");

// eva-voice.js をブラウザと同じように読み込み、対応表を取り出す
const ctx = vm.createContext({ document: undefined });
vm.runInContext(fs.readFileSync("src/simulator/js/eva-voice.js", "utf8"), ctx, {
  filename: "eva-voice.js",
});
const { EVA_VOICES, EVA_VOICE_ROLES } = vm.runInContext(
  "({ EVA_VOICES, EVA_VOICE_ROLES })",
  ctx,
);

async function synth(text, speaker) {
  const q = await fetch(
    `${ENGINE}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`,
    { method: "POST" },
  );
  if (!q.ok) throw new Error(`audio_query ${q.status}: ${text}`);
  const query = await q.json();
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
  if (!force && fs.existsSync(out)) {
    skipped++;
    continue;
  }
  const wav = path.join(TMP_DIR, `${v.id}.wav`);
  fs.writeFileSync(wav, await synth(v.line, role.speaker));
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
