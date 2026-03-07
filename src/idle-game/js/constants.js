/**
 * パチンコ放置ゲーム — 定数・機種データ・アップグレード定義
 */

// ============================================================
// モード定数
// ============================================================

const MODE_NORMAL = 'normal';
const MODE_KAKUHEN = 'kakuhen';
const MODE_ST = 'st';
const MODE_JITAN = 'jitan';

const KAKUHEN_PROB_MULTIPLIER = 10;
const YUTIME_MULTIPLIER = 2.5;
const PRESTIGE_BASE_THRESHOLD = 100;
const PRESTIGE_THRESHOLD_STEP = 50;
const PRESTIGE_BONUS_RATE = 0.05;

// ============================================================
// ゲームバージョン・借金定数
// ============================================================

const GAME_VERSION = 'v0.9.9';
const DEBT_UNIT_YEN = 1000;
const DEBT_REPAY_UNIT_YEN = 500;
const DEBT_INTEREST_RATE = 0.05;
const DEBT_INTERVAL_MS = 60000;
const PREMIUM_SPEED_MULTIPLIER = 2.0;
const JITAN_SPINS = 10000;
const JITAN_BASE_SPINS = 100;
const JITAN_REF_DENOM = 319;
const JITAN_COST_MULTIPLIER = 0.5;

const SAVE_KEY = 'gp-idle-game-save';
const SAVE_INTERVAL = 30000;
const CLOUD_SAVE_INTERVAL = 60000;

// ============================================================
// 機種データ
// ============================================================

const MACHINES = [
    {
        id: 'amadeji',
        name: '🟢 甘デジ',
        desc: 'ST偏重・安定連荘型',
        prob: 656 / 65536,  // 1/99.902
        payout: 465,
        cost: 10,
        kakuhenRate: 0.15,
        stRate: 0.40,
        jitanRate: 0.20,
        kakuhenContinueRate: 0.65,
        baseStSpins: 10,
        yutimeThreshold: 247,
        unlockCondition: () => true,
        unlockText: '初期台',
    },
    {
        id: 'lightmiddle',
        name: '🔵 ライトミドル',
        desc: 'バランス型',
        prob: 328 / 65536,  // 1/199.805
        payout: 936,
        cost: 10.75,
        kakuhenRate: 0.25,
        stRate: 0.30,
        jitanRate: 0.20,
        kakuhenContinueRate: 0.65,
        baseStSpins: 21,
        yutimeThreshold: 497,
        unlockCondition: (s) => s.totalLifetimeJackpots >= 30,
        unlockText: '累計大当たり30回',
    },
    {
        id: 'middle',
        name: '🟣 ミドル',
        desc: 'スタンダード',
        prob: 205 / 65536,  // 1/319.688
        payout: 1500,
        cost: 11.5,
        kakuhenRate: 0.35,
        stRate: 0.25,
        jitanRate: 0.20,
        kakuhenContinueRate: 0.65,
        baseStSpins: 33,
        yutimeThreshold: 957,
        unlockCondition: (s) => s.totalLifetimeJackpots >= 80,
        unlockText: '累計大当たり80回',
    },
    {
        id: 'max',
        name: '🔴 MAXタイプ',
        desc: '確変ループ特化型',
        prob: 164 / 65536,  // 1/399.610
        payout: 1876,
        cost: 12.25,
        kakuhenRate: 0.50,
        stRate: 0.15,
        jitanRate: 0.15,
        kakuhenContinueRate: 0.65,
        baseStSpins: 41,
        yutimeThreshold: 1197,
        unlockCondition: (s) => s.prestiges >= 1,
        unlockText: 'プレステージ1回',
    },
    {
        id: 'supermax',
        name: '🌟 超MAX',
        desc: '確変ループ全振り・ロマン型',
        prob: 131 / 65536,  // 1/500.275
        payout: 2347,
        cost: 13,
        kakuhenRate: 0.60,
        stRate: 0.10,
        jitanRate: 0.10,
        kakuhenContinueRate: 0.65,
        baseStSpins: 52,
        yutimeThreshold: 1497,
        unlockCondition: (s) => s.prestiges >= 3,
        unlockText: 'プレステージ3回',
    },
];

// ============================================================
// アップグレード定義
// ============================================================

const UPGRADES = [
    {
        id: 'spinRate',
        name: '⚡ 回転速度UP',
        desc: '毎秒の回転数を+0.5増加',
        icon: '⚡',
        baseCost: 300,
        costMultiplier: 1.5,
        maxLevel: 50,
        apply: (s) => { s.spinRate = 1 + s.upgrades.spinRate * 0.5; },
        effectText: (s) => `${s.spinRate.toFixed(1)}回/秒`,
    },
    {
        id: 'jackpotProb',
        name: '🎯 大当たり確率UP',
        desc: '大当たり確率を5%改善',
        icon: '🎯',
        baseCost: 800,
        costMultiplier: 2.0,
        maxLevel: 30,
        apply: (s) => {
            const m = getCurrentMachine();
            s.jackpotProb = m.prob * Math.pow(1.05, s.upgrades.jackpotProb);
        },
        effectText: (s) => `1/${Math.round(1 / s.jackpotProb)}`,
    },
    {
        id: 'jackpotPayout',
        name: '💰 出玉UP',
        desc: '大当たり時の出玉を+5%改善',
        icon: '💰',
        baseCost: 500,
        costMultiplier: 1.8,
        maxLevel: 50,
        apply: (s) => {
            const m = getCurrentMachine();
            const lv = s.upgrades.jackpotPayout || 0;
            const denom = Math.round(1 / m.prob);
            const hiddenRate = Math.pow(denom, 0.1) / 100;
            s.jackpotPayout = Math.floor(m.payout * (1 + lv * (0.05 + hiddenRate)));
        },
        effectText: (s) => `${formatNum(s.jackpotPayout)}玉`,
    },
    {
        id: 'autoInvest',
        name: '🤖 オート投資',
        desc: '玉が無くても自動で収支から補充（借金可能）',
        icon: '🤖',
        baseCost: 5000,
        costMultiplier: 1,
        maxLevel: 1,
        apply: (s) => { s.autoInvest = s.upgrades.autoInvest >= 1; },
        effectText: (s) => s.autoInvest ? 'ON' : 'OFF',
    },
    {
        id: 'kakuhenBoost',
        name: '🔥 確変倍率UP',
        desc: '確変/ST中の確率をさらに1%改善',
        icon: '🔥',
        baseCost: 2000,
        costMultiplier: 2.5,
        maxLevel: 20,
        apply: () => { },
        effectText: () => `1/${Math.round(1 / getKakuhenProb())}`,
    },
    {
        id: 'stSpins',
        name: '⏱️ ST回転数UP',
        desc: 'STモードの回転数を+5%改善',
        icon: '⏱️',
        baseCost: 1500,
        costMultiplier: 2.0,
        maxLevel: 20,
        apply: () => { },
        effectText: () => `${getMaxStSpins()}回転`,
    },
    {
        id: 'kakuhenCont',
        name: '🔁 確変継続率UP',
        desc: '確変モードの継続率を+2%改善',
        icon: '🔁',
        baseCost: 2500,
        costMultiplier: 2.2,
        maxLevel: 10,
        apply: () => { },
        effectText: () => `${Math.round(getKakuhenContinueRate() * 100)}%`,
    },
    {
        id: 'critical',
        name: '💎 クリティカル',
        desc: '大当たり時10%で出玉2倍',
        icon: '💎',
        baseCost: 3000,
        costMultiplier: 2.0,
        maxLevel: 10,
        apply: () => { },
        effectText: () => `${getCriticalChance()}%`,
    },
    {
        id: 'autoBuyer',
        name: '🛒 オートバイヤー',
        desc: '最安のアップグレードを自動購入',
        icon: '🛒',
        baseCost: 10000,
        costMultiplier: 1,
        maxLevel: 1,
        apply: (s) => { s.autoBuyer = s.upgrades.autoBuyer >= 1; },
        effectText: (s) => s.autoBuyer ? 'ON' : 'OFF',
    },
    {
        id: 'autoPrestige',
        name: '🔄 オートプレステージ',
        desc: '条件達成で自動プレステージ',
        icon: '🔄',
        baseCost: 50000,
        costMultiplier: 1,
        maxLevel: 1,
        apply: (s) => { s.autoPrestige = s.upgrades.autoPrestige >= 1; },
        effectText: (s) => s.autoPrestige ? 'ON' : 'OFF',
    },
];

// Premium限定アップグレード
const PREMIUM_UPGRADES = [
    {
        id: 'luckyPayout',
        name: '🍀 ラッキーペイアウト',
        desc: '大当たり出玉+15%（有料限定）',
        icon: '🍀',
        baseCost: 2000,
        costMultiplier: 2.2,
        maxLevel: 10,
        apply: () => { },
        effectText: (s) => `+${(s.upgrades.luckyPayout || 0) * 15}%`,
    },
    {
        id: 'hyperShooter',
        name: '🚀 ハイパーシューター',
        desc: '回転速度+1.0/Lv（有料限定）',
        icon: '🚀',
        baseCost: 1500,
        costMultiplier: 1.8,
        maxLevel: 20,
        apply: (s) => {
            const base = 1 + s.upgrades.spinRate * 0.5;
            s.spinRate = base + (s.upgrades.hyperShooter || 0) * 1.0;
        },
        effectText: (s) => `+${(s.upgrades.hyperShooter || 0) * 1.0}回/秒`,
    },
];
