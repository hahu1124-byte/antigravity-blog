/**
 * パチンコ放置ゲーム — 定数・機種データ・アップグレード定義
 */

// ============================================================
// モード定数
// ============================================================

const MODE_NORMAL = 'normal';
const MODE_KAKUHEN = 'kakuhen';
const MODE_ST = 'st';

const BASE_KAKUHEN_PROB = 1 / 39;
const BASE_ST_SPINS = 100;
const YUTIME_MULTIPLIER = 2.5;
const PRESTIGE_BASE_THRESHOLD = 100;
const PRESTIGE_THRESHOLD_STEP = 50;
const PRESTIGE_BONUS_RATE = 0.05;

// ============================================================
// ゲームバージョン・借金定数
// ============================================================

const GAME_VERSION = 'v0.6';
const DEBT_UNIT_YEN = 1000;
const DEBT_REPAY_UNIT_YEN = 500;
const DEBT_INTEREST_RATE = 0.05;
const DEBT_INTERVAL_MS = 60000;
const PREMIUM_SPEED_MULTIPLIER = 2.0;

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
        desc: '低リスク・安定型',
        prob: 1 / 99,
        payout: 465,
        cost: 2,
        kakuhenRate: 0.50,
        stRate: 0.30,
        yutimeThreshold: 250,
        unlockCondition: () => true,
        unlockText: '初期台',
    },
    {
        id: 'lightmiddle',
        name: '🔵 ライトミドル',
        desc: 'バランス型',
        prob: 1 / 199,
        payout: 936,
        cost: 3,
        kakuhenRate: 0.55,
        stRate: 0.25,
        yutimeThreshold: 0,
        yutimeMult: 2.5,
        unlockCondition: (s) => s.totalLifetimeJackpots >= 30,
        unlockText: '累計大当たり30回',
    },
    {
        id: 'middle',
        name: '🟣 ミドル',
        desc: 'スタンダード',
        prob: 1 / 319,
        payout: 1500,
        cost: 4,
        kakuhenRate: 0.60,
        stRate: 0.25,
        yutimeThreshold: 0,
        yutimeMult: 2.5,
        unlockCondition: (s) => s.totalLifetimeJackpots >= 80,
        unlockText: '累計大当たり80回',
    },
    {
        id: 'max',
        name: '🔴 MAXタイプ',
        desc: 'ハイリスク・爆裂型',
        prob: 1 / 399,
        payout: 1876,
        cost: 5,
        kakuhenRate: 0.65,
        stRate: 0.20,
        yutimeThreshold: 0,
        yutimeMult: 2.0,
        unlockCondition: (s) => s.prestiges >= 1,
        unlockText: 'プレステージ1回',
    },
    {
        id: 'supermax',
        name: '🌟 超MAX',
        desc: '最高リスク・超爆裂',
        prob: 1 / 499,
        payout: 2347,
        cost: 6,
        kakuhenRate: 0.70,
        stRate: 0.15,
        yutimeThreshold: 0,
        yutimeMult: 1.8,
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
        desc: '大当たり時の獲得玉を+20',
        icon: '💰',
        baseCost: 500,
        costMultiplier: 1.8,
        maxLevel: 50,
        apply: (s) => {
            const m = getCurrentMachine();
            s.jackpotPayout = m.payout + s.upgrades.jackpotPayout * 20;
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
        desc: 'STモードの回転数上限を+2',
        icon: '⏱️',
        baseCost: 1500,
        costMultiplier: 2.0,
        maxLevel: 20,
        apply: () => { },
        effectText: () => `${getMaxStSpins()}回転`,
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
