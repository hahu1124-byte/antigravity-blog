// 目押しチャレンジの出玉の試算（リールは回さず、成立役だけで遊技を進める）
// 使い方: node scripts/sim-meoshi.mjs [ゲーム数（既定 500 万）]
// 打ち方 2 通り: 完全攻略（小役は全部取る・チェリーは角で 4 枚・ボーナスはすぐ揃える・BIG の枚数調整・
// REG の 1 枚役ハズシ・花火チャレンジのリプレイハズシは成功）と、技術介入なし（氷は 1/3 取りこぼし・
// チェリーは中段の 2 枚・技術介入はしない）
const base = new URL("../src/game/meoshi/", import.meta.url).href;
const {
  SETTINGS,
  drawNormal,
  drawBB,
  drawRB,
  nextRt,
  RT_GAMES,
  CHAL_EXTEND_LEFT,
} = await import(base + "game-rules.js");
const { BIG_END_PAYOUT, BB_VITA_PAY, REG_END_GAMES, REG_END_WINS, BONUS_BET } =
  await import(base + "reel-data.js");

const N = Number(process.argv[2]) || 5_000_000;
const BET = 3;
// 1geki の出玉率（通常・完全攻略）
const TARGET = {
  1: [98.6, 100.2],
  2: [100.4, 102.0],
  5: [103.0, 104.6],
  6: [106.4, 108.0],
};

function run(setting, perfect) {
  let coinIn = 0;
  let coinOut = 0;
  let replay = false;
  let held = null; // 持ち越し中のボーナス
  let rt = null;
  let normalGames = 0;
  let normalIn = 0;
  let normalOut = 0;
  const bonusStats = { big: { n: 0, net: 0 }, reg: { n: 0, net: 0 } };
  const rtStats = { chal: 0, game: 0, net: 0 };
  let games = 0;

  const pay = (small) => {
    if (small === "fuurin") return 8;
    if (small === "kori") return perfect || Math.random() > 1 / 3 ? 15 : 0;
    if (small === "cherry") return perfect ? 4 : 2;
    return 0;
  };

  function playBonus(type) {
    let net = 0;
    if (type === "big") {
      let count = 0;
      let adjusted = !perfect; // 技術介入なしは枚数調整をしない
      while (count <= BIG_END_PAYOUT) {
        coinIn += BONUS_BET;
        net -= BONUS_BET;
        const f = drawBB(setting);
        let p = 0;
        if (f !== "bara") {
          if (!adjusted) {
            p = BB_VITA_PAY;
            adjusted = true;
          } else {
            p = 15;
            count += 15;
          }
        }
        coinOut += p;
        net += p;
      }
    } else {
      let g = 0;
      let wins = 0;
      while (g < REG_END_GAMES && wins < REG_END_WINS) {
        g++;
        coinIn += BONUS_BET;
        net -= BONUS_BET;
        const f = drawRB(setting);
        let p = 0;
        if (f === "one") p = perfect ? 0 : 1;
        else if (f !== "none") p = 15;
        if (p) wins++;
        coinOut += p;
        net += p;
      }
    }
    bonusStats[type].n++;
    bonusStats[type].net += net;
  }

  while (games < N) {
    games++;
    const bet = replay ? 0 : BET;
    replay = false;
    // RT 中の増減は、このゲームの掛け枚数も含めて数える
    const rtBefore = coinOut - coinIn;
    coinIn += bet;
    const inRt = rt ? rt.type : null;
    if (!inRt) {
      normalGames++;
      normalIn += bet;
    }
    const { bonus, small } = drawNormal(setting, inRt);
    if (bonus && !held) held = bonus;
    let out = 0;
    let aligned = false;
    if (small === "replay" || small === "rtReplay") {
      replay = true;
      aligned = true;
    } else if (small === "jacIn") {
      // 完全攻略: 残り 8G まではハズして花火チャレンジを続け、それ以降は揃えて花火GAME へ。技術介入なし: いつも揃える。
      // ハズしても再遊技（1geki: 移行リプレイの欄は「逆押しのときに出るリプレイ」）。残りは 1 減る（nextRt）
      const hazushi = perfect && rt.left >= CHAL_EXTEND_LEFT;
      replay = true;
      aligned = !hazushi;
    } else if (small) {
      out = pay(small);
    } else if (held) {
      // 小役が無いゲームでボーナスを揃える（完全攻略はすぐ。技術介入なしも同じとする）
      coinOut += out;
      if (!inRt) normalOut += out;
      const type = held === "reg" ? "reg" : "big";
      held = null;
      if (rt) rtStats.net += coinOut - coinIn - rtBefore;
      rt = null;
      playBonus(type);
      if (type === "big") {
        rt = { type: "chal", left: RT_GAMES };
        rtStats.chal++;
      }
      continue;
    }
    coinOut += out;
    if (!inRt) normalOut += out;
    if (rt) {
      const before = rt.type;
      rt = nextRt(rt, { jacIn: small === "jacIn", aligned });
      if (rt && rt.type === "game" && before === "chal") rtStats.game++;
      rtStats.net += coinOut - coinIn - rtBefore;
    }
  }
  return {
    rate: (coinOut / coinIn) * 100,
    base: 50 / ((normalIn - normalOut) / normalGames),
    big: bonusStats.big,
    reg: bonusStats.reg,
    rt: rtStats,
    games,
  };
}

const t0 = performance.now();
console.log(
  `試算 ${N.toLocaleString()} ゲーム × 設定 ${SETTINGS.length} × 打ち方 2`,
);
for (const s of SETTINGS) {
  for (const perfect of [false, true]) {
    const r = run(s, perfect);
    const target = TARGET[s][perfect ? 1 : 0];
    console.log(
      `設定${s} ${perfect ? "完全攻略" : "技術介入なし"}: 出玉率 ${r.rate.toFixed(1)}%（1geki ${target}%・差 ${(r.rate - target).toFixed(1)}）` +
        `  BIG 純増 ${(r.big.net / r.big.n).toFixed(1)}  REG 純増 ${(r.reg.net / r.reg.n).toFixed(1)}` +
        `  RT 1 回の増減 ${(r.rt.net / Math.max(1, r.rt.chal)).toFixed(1)}（花火GAME 到達 ${((r.rt.game / Math.max(1, r.rt.chal)) * 100).toFixed(0)}%）` +
        `  通常時のベース ${r.base.toFixed(1)}G/50枚`,
    );
  }
}
console.log(`${((performance.now() - t0) / 1000).toFixed(1)} 秒`);
