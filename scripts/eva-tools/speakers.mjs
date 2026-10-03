// VOICEVOX の全キャラ・全スタイルで同じセリフを audio_query し、声の高さ（有声の音の平均・最低・最高 Hz）を並べる。
// 使い方：node speakers.mjs [セリフ]
const text = process.argv[2] || "さーて、この次もぉ、サービス、サービスゥ！";
const E = "http://127.0.0.1:50021";
const speakers = await (await fetch(`${E}/speakers`)).json();
const rows = [];
for (const sp of speakers) {
  for (const st of sp.styles) {
    if (st.type && st.type !== "talk") continue;
    const r = await fetch(
      `${E}/audio_query?text=${encodeURIComponent(text)}&speaker=${st.id}`,
      { method: "POST" },
    );
    if (!r.ok) continue;
    const q = await r.json();
    const hz = q.accent_phrases
      .flatMap((ap) => ap.moras)
      .filter((m) => m.pitch > 0)
      .map((m) => Math.exp(m.pitch));
    if (!hz.length) continue;
    const avg = hz.reduce((a, b) => a + b, 0) / hz.length;
    rows.push({
      name: `${sp.name}（${st.name}）`,
      id: st.id,
      avg,
      min: Math.min(...hz),
      max: Math.max(...hz),
    });
  }
}
rows.sort((a, b) => b.avg - a.avg);
for (const r of rows) {
  console.log(
    `${r.avg.toFixed(0)}Hz\t${r.min.toFixed(0)}〜${r.max.toFixed(0)}\tid=${r.id}\t${r.name}`,
  );
}
