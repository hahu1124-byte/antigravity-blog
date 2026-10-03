/* --- EVA15風 液晶の図柄リール --- */

// ============================================================
// 3 列のリールを縦に流し、左 → 右 → 中の順に止める。
// 各列は止まっている図柄の上下に前後の図柄を小さく出す（エヴァ15の液晶のような見た目）。
// リーチの回転は左右が同じ図柄で止まって「リーチ」になり、中だけが回り続ける。
// 中はハズレなら当り図柄を 1 コマ通り過ぎて止まる（ズレ目）。
// ============================================================

const EVA_REEL_TICK_MS = 45; // 回っている間の 1 コマの時間
const EVA_REEL_LEFT_MS = 360; // 左が止まるまで
const EVA_REEL_RIGHT_MS = 520; // 右が止まるまで
const EVA_REEL_CENTER_MS = 640; // リーチでないとき中が止まるまで
const EVA_REEL_REACH_MS = 900; // ノーマルリーチの中の回転時間（右が止まってから）
const EVA_REEL_SP_MS = 1900; // SP リーチ・激アツの中の回転時間（右が止まってから）
const EVA_STEP_MS = 450; // 液晶に出す演出の文字 1 段の時間
const EVA_STEP_MAX = 4; // リーチ前・リーチ後それぞれの最大段数（多いときはまとめる）

function evaReelNext(n) {
  return (n % 9) + 1;
}
function evaReelPrev(n) {
  return n === 1 ? 9 : n - 1;
}

// 列 i（1〜3）に図柄 n を出す。上が次の図柄、下が前の図柄（下へ流れる）
function evaReelSet(i, n, cls) {
  const el = document.getElementById("d" + i);
  if (!el) return;
  el.className = (cls || getDigitClass(n, mode)) + " reel";
  el.innerHTML =
    `<span class="reel-side">${evaReelNext(n)}</span>` +
    `<span class="reel-cur">${n}</span>` +
    `<span class="reel-side">${evaReelPrev(n)}</span>`;
}

// 待機中の図柄（機種選択・リセット時）
function evaReelIdle(nums) {
  [1, 2, 3].forEach((i) => evaReelSet(i, nums[i - 1]));
}

function evaSleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 回転させて final（[左, 中, 右]）で止める。opts.instant は高速オートの演出なし回転
// 多すぎる段は前からまとめて最大 max 段にする（1 回転が長くなりすぎないように）
function evaChunkSteps(texts, max) {
  if (texts.length <= max) return texts;
  const size = Math.ceil(texts.length / max);
  const out = [];
  for (let i = 0; i < texts.length; i += size) {
    out.push(texts.slice(i, i + size).join("\n"));
  }
  return out;
}

// opts.steps：[{ phase: "pre"|"reach"|"post", text }]。リーチ前の予告は回っている間に、
// リーチ名は左右が揃ったときに、リーチ後の予告とチャンスアップは中が回っている間に順番に出す
async function evaRunReels(final, opts) {
  const container = document.querySelector(".digit-container");
  const ov = document.getElementById("effect-overlay");
  const show = (t) => {
    if (!ov) return;
    ov.innerText = t || "";
    ov.style.display = t ? "block" : "none";
  };
  const pos = [1, 2, 3].map(() => Math.floor(Math.random() * 9) + 1);
  if (opts.instant) {
    [1, 2, 3].forEach((i) => evaReelSet(i, final[i - 1]));
    await evaSleep(5);
    return;
  }
  const steps = opts.steps || [];
  const pre = evaChunkSteps(
    steps.filter((s) => s.phase === "pre").map((s) => s.text),
    EVA_STEP_MAX,
  );
  const reachText = steps
    .filter((s) => s.phase === "reach")
    .map((s) => s.text)
    .join("\n");
  const post = evaChunkSteps(
    steps.filter((s) => s.phase === "post").map((s) => s.text),
    EVA_STEP_MAX,
  );

  const spinning = [true, true, true];
  const timer = setInterval(() => {
    [0, 1, 2].forEach((k) => {
      if (!spinning[k]) return;
      pos[k] = evaReelNext(pos[k]);
      evaReelSet(k + 1, pos[k]);
    });
  }, EVA_REEL_TICK_MS);

  // リーチ前の予告：全部の列が回っている間に 1 段ずつ
  for (const t of pre) {
    show(t);
    await evaSleep(EVA_STEP_MS);
  }
  await evaSleep(Math.max(0, EVA_REEL_LEFT_MS - pre.length * EVA_STEP_MS));
  show("");
  spinning[0] = false;
  evaReelSet(1, final[0]);
  await evaSleep(EVA_REEL_RIGHT_MS - EVA_REEL_LEFT_MS);
  spinning[2] = false;
  evaReelSet(3, final[2]);

  const reach = final[0] === final[2];
  if (reach) {
    if (container) container.classList.add("reach-on");
    // リーチ名 → リーチ後の予告・チャンスアップ。中の回転は SP・激アツなら長く
    const total = opts.heavy ? EVA_REEL_SP_MS : EVA_REEL_REACH_MS;
    let used = 0;
    if (reachText) {
      show(reachText);
      await evaSleep(EVA_STEP_MS);
      used += EVA_STEP_MS;
    }
    for (const t of post) {
      show(t);
      await evaSleep(EVA_STEP_MS);
      used += EVA_STEP_MS;
    }
    await evaSleep(Math.max(0, total - used));
  } else {
    await evaSleep(EVA_REEL_CENTER_MS - EVA_REEL_RIGHT_MS);
  }
  clearInterval(timer);
  spinning[1] = false;

  if (reach) {
    // 中は最後の 4 コマをだんだん遅くして止める（ズレ目は当り図柄を 1 コマ通り過ぎる）
    const steps = [];
    let n = final[1];
    for (let s = 0; s < 4; s++) {
      steps.unshift(n);
      n = evaReelPrev(n);
    }
    for (let s = 0; s < steps.length; s++) {
      evaReelSet(2, steps[s]);
      await evaSleep(120 + s * 90);
    }
  }
  evaReelSet(2, final[1]);
  if (container) container.classList.remove("reach-on");
  show("");
}
