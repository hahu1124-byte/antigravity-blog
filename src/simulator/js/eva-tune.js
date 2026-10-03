/* --- EVA15風 演出の出現率の倍率（scripts/eva-tools/tune-freq.cjs --write が書き出す。手で直さない） --- */

// 目標（eva-effects.js の EVA_FREQ_TARGETS_N：通常時の当りのうち何%に出るか）に合わせて解いた、
// 演出のまとまりごとの出現率の倍率。キーは層の key（層に groups があれば "key/group"）。
// 載っていないまとまりは 1。信頼度 100% の演出と fixed の演出には掛けない（eva-engine.js の evaScaleOf）
const EVA_FREQ_SCALE = {
  n: {},
  s: {},
};
