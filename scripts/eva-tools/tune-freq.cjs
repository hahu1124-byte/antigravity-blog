// EVA15風シミュ：演出のまとまりごとの出現率の倍率を、目標（通常時の当りのうち何%に出るか）に合わせて解く（段2）。
// 使い方（ブログのリポジトリで）：node scripts/eva-tools/tune-freq.cjs [--write]
//   目標は eva-effects.js の EVA_FREQ_TARGETS_N、結果の倍率は src/simulator/js/eva-tune.js の EVA_FREQ_SCALE
//   （--write で書き出す。付けなければ表を出すだけ）。
// 当りのうち何%に出るかは eva-engine.js の evaGroupShares で数え上げる（乱数を回さない）。
// 当り確率は今までどおり alpha（全体の係数）が守るので、倍率を上げた分は目標の無い演出が縮む。
// 出現率の合計が 1 を超える（SP リーチの回転に乗せきれない）まとまりは、入る所で止めて「上限」と出す。
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const write = process.argv.includes("--write");
// --iter N：反復の上限（0 なら今の倍率のまま表を出す）
const iterArg = process.argv.indexOf("--iter");
const maxIter = iterArg >= 0 ? Number(process.argv[iterArg + 1]) : 60;
const jsDir = "src/simulator/js";
const ctx = vm.createContext({ console, Math, currentRot: 0 });
for (const f of [
  "eva-effects.js",
  "eva-tune.js",
  "eva-voice.js",
  "eva-engine.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(jsDir, f), "utf8"), ctx, {
    filename: f,
  });
}

ctx.MAX_ITER = maxIter;
// --floor A：alpha（目標の無い演出とリーチの係数）がこれを下回ったら止める
const floorArg = process.argv.indexOf("--floor");
ctx.ALPHA_FLOOR = floorArg >= 0 ? Number(process.argv[floorArg + 1]) : 0.1;
const t0 = Date.now();
const res = vm.runInContext(
  `(() => {
    const targets = EVA_FREQ_TARGETS_N;
    const keys = Object.keys(targets);
    const labels = new Map(
      [...EVA_LAYERS_N, ...EVA_LINKED_N].map((L) => [L.key, L.label]),
    );
    const labelOf = (k) => labels.get(k.split("/")[0]);
    const scale = { ...EVA_FREQ_SCALE.n };
    for (const k of keys) if (!(k in scale)) scale[k] = 1;
    const capped = new Set();
    const calib = (sc) => evaCalibrate({ ...EVA_SPEC_N, scale: sc }, 0);
    const sudden = (T) => (T.base0 * T.expect.none) / T.pHit;
    // 満杯の層：どこかのリーチの回転で「なし」が 1% 未満（それ以上は出せない。evaCalibrate は
    // その手前で alpha を止めるので、満杯のまま倍率を上げると他の演出が縮み、突発当りが増える）
    const fullLayers = (T) => {
      const full = new Set();
      for (const L of T.free) {
        if (!L.isReach && L.probs[L.probs.length - 1] < 0.01) full.add(L.key);
      }
      for (const L of T.linked) {
        L.probsByReach.forEach((ps, r) => {
          if (T.reach.probs[r] > 0 && ps[ps.length - 1] < 0.01) full.add(L.key);
        });
      }
      return full;
    };
    // SP リーチ（全回転を含む）が何回転に 1 回か。alpha に比例して減るので一緒に見る
    const spEvery = (T) =>
      1 /
      T.reach.states.reduce(
        (sum, rs, i) =>
          rs.id === "zenkaiten" || EVA_SP_REACHES.includes(rs.id)
            ? sum + T.reach.probs[i]
            : sum,
        0,
      );
    let T = calib(scale);
    let shares = evaGroupShares(T, keys);
    const log = [];
    let stop = "";
    for (let it = 0; it < MAX_ITER; it++) {
      const full = fullLayers(T);
      const worst = Math.max(
        0,
        ...keys
          .filter((k) => !capped.has(k))
          .map((k) => Math.abs(shares[k] * 100 - targets[k])),
      );
      log.push({
        it,
        alpha: T.alpha,
        sudden: sudden(T),
        sp: spEvery(T),
        worst,
        full: [...full],
      });
      if (worst < 0.2) break;
      // 当りの予算切れ：目標を上げるほど他の演出とリーチが縮む。ここより下は SP リーチが減りすぎる
      if (T.alpha < ALPHA_FLOOR) {
        stop = "alpha が " + ALPHA_FLOOR + " を下回ったので止めた（当りの予算切れ）";
        break;
      }
      const next = { ...scale };
      for (const k of keys) {
        if (shares[k] <= 0) continue;
        // 満杯の層で目標に届いていないまとまりは、少し下げて満杯をほどき、以後は上げない（上限）
        if (full.has(k.split("/")[0]) && shares[k] * 100 < targets[k]) {
          next[k] = scale[k] * 0.97;
          capped.add(k);
          continue;
        }
        // 1 回の変化は 0.5〜2 倍まで（一度に大きく上げると alpha が崩れ、信頼度 100% の演出が
        // 縮んだ SP リーチの回転に収まらなくなる）
        const step = Math.min(
          2,
          Math.max(0.5, Math.pow(targets[k] / (shares[k] * 100), 0.8)),
        );
        next[k] = scale[k] * step;
        if (capped.has(k) && next[k] > scale[k]) next[k] = scale[k];
      }
      // 表を作れなければ一歩を半分にする
      let Tn = null;
      for (let h = 0; h < 8 && !Tn; h++) {
        try {
          Tn = calib(next);
        } catch (e) {
          if (h === 7) throw e;
          for (const k of keys) next[k] = Math.sqrt(next[k] * scale[k]);
        }
      }
      Object.assign(scale, next);
      T = Tn;
      shares = evaGroupShares(T, keys);
    }
    // ブラウザは通常（400 回転以下・401 回転以上）・時短・ST の 4 つの表を作るので、全部作れるか確かめる
    const check = [
      ["通常 401 回転以上", { ...EVA_SPEC_N, scale }, 401],
      ["時短", { ...EVA_SPEC_J, scale }, 0],
    ].map(([name, spec, rot]) => {
      try {
        const t = evaCalibrate(spec, rot);
        return name + " OK（alpha=" + t.alpha.toFixed(3) + "）";
      } catch (e) {
        return name + " 作れない：" + e.message;
      }
    });
    return {
      rows: keys.map((k) => ({
        key: k,
        label: labelOf(k) + (k.includes("/") ? "/" + k.split("/")[1] : ""),
        target: targets[k],
        got: shares[k] * 100,
        scale: scale[k],
        capped: capped.has(k),
      })),
      scale,
      alpha: T.alpha,
      sudden: sudden(T),
      sp: spEvery(T),
      full: [...fullLayers(T)].map((k) => labels.get(k) || k),
      stop,
      check,
      log,
    };
  })()`,
  ctx,
);
const sec = ((Date.now() - t0) / 1000).toFixed(1);

console.log(
  `反復 ${res.log.length} 回・${sec} 秒。alpha=${res.alpha.toFixed(3)}（目標の無い演出の係数）・突発当り=当りの ${(res.sudden * 100).toFixed(1)}%`,
);
console.log(
  `SP リーチ 1/${Math.round(res.sp)} 回転・満杯の層：${res.full.join("・") || "なし"}`,
);
if (res.stop) console.log(res.stop);
for (const c of res.check) console.log(c);
if (process.argv.includes("--log")) {
  for (const l of res.log) {
    console.log(
      `  反復 ${l.it} alpha=${l.alpha.toFixed(3)} 突発当り ${(l.sudden * 100).toFixed(1)}% SP 1/${Math.round(l.sp)} 最大のずれ ${l.worst.toFixed(1)}pt 満杯 ${l.full.join(",")}`,
    );
  }
}
console.log("まとまり\t目標\t結果\t倍率\t");
for (const r of res.rows) {
  console.log(
    `${r.label}\t${r.target}%\t${r.got.toFixed(1)}%\t×${r.scale.toFixed(3)}\t${r.capped ? "上限（層が満杯）" : ""}`,
  );
}

if (write) {
  const out = path.join(jsDir, "eva-tune.js");
  const scaleN = Object.fromEntries(
    Object.entries(res.scale).map(([k, v]) => [k, Number(v.toFixed(4))]),
  );
  const src = `/* --- EVA15風 演出の出現率の倍率（scripts/eva-tools/tune-freq.cjs --write が書き出す。手で直さない） --- */

// 目標（eva-effects.js の EVA_FREQ_TARGETS_N：通常時の当りのうち何%に出るか）に合わせて解いた、
// 演出のまとまりごとの出現率の倍率。キーは層の key（層に groups があれば "key/group"）。
// 載っていないまとまりは 1。信頼度 100% の演出と fixed の演出には掛けない（eva-engine.js の evaScaleOf）
const EVA_FREQ_SCALE = ${JSON.stringify({ n: scaleN, s: {} }, null, 2)};
`;
  fs.writeFileSync(out, src, "utf8");
  console.log(`書き出し → ${out}`);
}
