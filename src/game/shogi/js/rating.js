// あなたの強さの判定（レーティング・Elo 方式）。記録はこの端末だけ（localStorage）
// 各段のレーティング（levels.js の rating）は、CPU 同士の自動対戦の勝率から決めた
const KEY = "gp-shogi-rating";

// 勝率 p（0〜1）の差をレーティングの差に直す（p が 0.5 未満なら負）
export function eloDiff(p) {
  const q = Math.min(0.99, Math.max(0.01, p));
  return -400 * Math.log10((1 - q) / q);
}

// a が b に勝つ見込み（0〜1）
export function expected(a, b) {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

// 1 局の結果で更新する。score は勝ち 1・引き分け 0.5・負け 0
// 最初の 10 局は動きを大きく（K=48）、それ以降は K=24
export function updateRating(r, opponent, score) {
  const k = r.games < 10 ? 48 : 24;
  const delta = Math.round(k * (score - expected(r.rating, opponent)));
  return { rating: r.rating + delta, games: r.games + 1, delta };
}

// いちばん近い段（目安。実際の段級位とは別）
export function nearestLevel(rating, levels) {
  return levels.reduce((best, l) =>
    Math.abs(l.rating - rating) < Math.abs(best.rating - rating) ? l : best,
  );
}

export function loadRating(startRating) {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (r && Number.isFinite(r.rating) && Number.isFinite(r.games)) return r;
  } catch (e) {}
  return { rating: startRating, games: 0 };
}

export function saveRating(r) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ rating: r.rating, games: r.games }),
    );
  } catch (e) {}
}

export function clearRating() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {}
}
