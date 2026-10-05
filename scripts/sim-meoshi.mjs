// 目押しチャレンジの出玉の試算（リールは回さず、成立役だけで遊技を進める）
// 使い方: node scripts/sim-meoshi.mjs [ゲーム数（既定 500 万）]
// 打ち方 2 通り。どちらも小役は全部取り（チェリーは角で 4 枚）、ボーナスはすぐ揃える
//   完全攻略: BIG の枚数調整・REG の 1 枚役ハズシ・花火チャレンジの JAC IN ハズシを成功させる
//   技術介入なし: それらをしない（1geki の「通常」は完全攻略との差がどの設定でも 1.6% なので、この前提と見る）
// 出玉率は 1geki と同じく、リプレイを「3 枚入れて 3 枚出た」と数える（2026-10-06 の試算で 4 設定とも差 0.4 以内）。
// リプレイを数えない「払い出し ÷ 投入」は参考に出す（リプレイの多い高設定ほど高く出る）
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
// 花火チャレンジで JAC IN をハズす条件「残り x G 以上」（既定はゲームと同じ 7 ＝ 1〜14G 目。8 なら 1〜13G 目）
const EXTEND_LEFT = Number(process.argv[3]) || CHAL_EXTEND_LEFT;
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
  // 内訳: 通常時（RT を除く）の小役ごとの払い出しと、リプレイで遊んだゲーム数（掛け枚数 0）
  const smallOut = { fuurin: 0, kori: 0, cherry: 0 };
  let replays = 0;

  // 小役はどちらの打ち方も全部取る（チェリーは A・B とも角の 4 枚。1geki /2/）
  const pay = (small) => {
    if (small === "fuurin") return 8;
    if (small === "kori") return 15;
    if (small === "cherry") return 4;
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
    if (replay) replays++;
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
      const hazushi = perfect && rt.left >= EXTEND_LEFT;
      replay = true;
      aligned = !hazushi;
    } else if (small) {
      out = pay(small);
      if (!inRt) smallOut[small] += out;
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
    // リプレイを「3 枚入れて 3 枚出た」と数える出玉率（1geki の機械割と同じ数え方）
    rate: ((coinOut + 3 * replays) / (coinIn + 3 * replays)) * 100,
    // 参考: リプレイを数えない「払い出し ÷ 投入」
    rateNoReplay: (coinOut / coinIn) * 100,
    // 1000 ゲームあたりの差枚の内訳（ゲームはボーナス中を除く）
    per1000: {
      normalBet: (-normalIn / games) * 1000,
      ...Object.fromEntries(
        Object.entries(smallOut).map(([k, v]) => [k, (v / games) * 1000]),
      ),
      big: (bonusStats.big.net / games) * 1000,
      reg: (bonusStats.reg.net / games) * 1000,
      rt: (rtStats.net / games) * 1000,
      total: ((coinOut - coinIn) / games) * 1000,
    },
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
    const p = r.per1000;
    const f = (x) => (x >= 0 ? "+" : "") + x.toFixed(0);
    console.log(
      `    参考: リプレイを数えない払い出し ÷ 投入 ${r.rateNoReplay.toFixed(1)}%` +
        `  1000G あたりの差枚: 通常時の投入 ${f(p.normalBet)}・風鈴 ${f(p.fuurin)}・氷 ${f(p.kori)}・チェリー ${f(p.cherry)}` +
        `・BIG ${f(p.big)}・REG ${f(p.reg)}・RT ${f(p.rt)}＝${f(p.total)}`,
    );
  }
}
console.log(`${((performance.now() - t0) / 1000).toFixed(1)} 秒`);
