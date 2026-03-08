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

// 高確率は機種ごとにhighProbで定義（ST当選率65%ベース）

// ============================================================
// ゲームバージョン・借金定数
// ============================================================

const GAME_VERSION = 'v0.14.05';
const DEBT_UNIT_YEN = 1000;
const DEBT_REPAY_UNIT_YEN = 500;
const DEBT_INTEREST_RATE = 0.05;
const DEBT_INTERVAL_MS = 60000;
const PREMIUM_SPEED_MULTIPLIER = 2.0;
const JITAN_SPINS = 10000;
const JITAN_BASE_SPINS = 100;
const JITAN_REF_DENOM = 319;


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
        highProb: 2261 / 65536,  // 1/29.0 → ST30回転で65%
        payout: 465,
        cost: 10,
        costScale: 1.0,
        kakuhenRate: 0.40,
        stRate: 0.30,
        jitanRate: 0.30,
        kakuhenContinueRate: 0.65,
        baseStSpins: 30,
        yutimeThreshold: 249,
        unlockCondition: () => true,
        unlockText: '初期台',
    },
    {
        id: 'lightmiddle',
        name: '🔵 ライトミドル',
        desc: 'バランス型',
        prob: 328 / 65536,  // 1/199.805
        highProb: 1725 / 65536,  // 1/38.0 → ST40回転で65%
        payout: 936,
        cost: 12.5,
        costScale: 1.5,
        kakuhenRate: 0.30,
        stRate: 0.35,
        jitanRate: 0.20,
        kakuhenContinueRate: 0.65,
        baseStSpins: 40,
        yutimeThreshold: 499,
        unlockCondition: (s) => s.prestiges >= 1,
        unlockText: 'プレステージ1回',
    },
    {
        id: 'middle',
        name: '🟣 ミドル',
        desc: 'スタンダード',
        prob: 205 / 65536,  // 1/319.688
        highProb: 1365 / 65536,  // 1/48.0 → ST50回転で65%
        payout: 1500,
        cost: 15,
        costScale: 2.0,
        kakuhenRate: 0.25,
        stRate: 0.35,
        jitanRate: 0.15,
        kakuhenContinueRate: 0.65,
        baseStSpins: 50,
        yutimeThreshold: 959,
        unlockCondition: (s) => s.prestiges >= 3,
        unlockText: 'プレステージ3回',
    },
    {
        id: 'max',
        name: '🔴 MAXタイプ',
        desc: '確変ループ特化型',
        prob: 164 / 65536,  // 1/399.610
        highProb: 1150 / 65536,  // 1/57.0 → ST60回転で65%
        payout: 1876,
        cost: 17.5,
        costScale: 3.0,
        kakuhenRate: 0.15,
        stRate: 0.40,
        jitanRate: 0.05,
        kakuhenContinueRate: 0.65,
        baseStSpins: 60,
        yutimeThreshold: 1198,
        unlockCondition: (s) => s.prestiges >= 7,
        unlockText: 'プレステージ7回',
    },
    {
        id: 'supermax',
        name: '🌟 超MAX',
        desc: '確変ループ全振り・ロマン型',
        prob: 131 / 65536,  // 1/500.275
        highProb: 978 / 65536,  // 1/67.0 → ST70回転で65%
        payout: 2347,
        cost: 20,
        costScale: 5.0,
        kakuhenRate: 0.10,
        stRate: 0.40,
        jitanRate: 0.00,
        kakuhenContinueRate: 0.65,
        baseStSpins: 70,
        yutimeThreshold: 1500,
        unlockCondition: (s) => s.prestiges >= 15,
        unlockText: 'プレステージ15回',
    },
];

// ============================================================
// アップグレード定義
// ============================================================

const UPGRADES = [
    {
        id: 'spinRate',
        name: '⚡ 回転速度UP',
        desc: '毎秒の回転数を指数的に増加',
        icon: '⚡',
        baseCost: 500,
        costMultiplier: 1.25,
        maxLevel: Infinity,
        apply: () => { },
        effectText: (s) => `${s.spinRate.toFixed(2)}回/秒`,
    },
    {
        id: 'jackpotProb',
        name: '🎯 大当たり確率UP',
        desc: '大当たり確率を5%改善',
        icon: '🎯',
        baseCost: 600,
        costMultiplier: 1.6,
        maxLevel: 30,
        apply: () => { },
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
        apply: () => { },
        effectText: (s) => `${formatNum(s.jackpotPayout)}玉`,
    },

    {
        id: 'kakuhenBoost',
        name: '🔥 確変倍率UP',
        desc: '確変/ST中の確率をさらに1.5%改善',
        icon: '🔥',
        baseCost: 1500,
        costMultiplier: 1.8,
        maxLevel: 20,
        apply: () => { },
        effectText: () => `1/${Math.round(1 / getKakuhenProb())}`,
    },
    {
        id: 'stSpins',
        name: '⏱️ ST回転数UP',
        desc: 'STモードの回転数を+6%改善',
        icon: '⏱️',
        baseCost: 1200,
        costMultiplier: 1.6,
        maxLevel: 20,
        apply: () => { },
        effectText: () => `${getMaxStSpins()}回転`,
    },
    {
        id: 'kakuhenCont',
        name: '🔁 確変継続率UP',
        desc: '確変モードの継続率を+2.5%改善',
        icon: '🔁',
        baseCost: 2000,
        costMultiplier: 2.0,
        maxLevel: 10,
        apply: () => { },
        effectText: () => `${(getKakuhenContinueRate() * 100).toFixed(2)}%`,
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
        id: 'costReduction',
        name: '💸 コスト削減',
        desc: '1回転あたりのコストを5%削減（累乗）',
        icon: '💸',
        baseCost: 1500,
        costMultiplier: 1.8,
        maxLevel: 10,
        apply: () => { },
        effectText: (s) => {
            const lv = s.upgrades.costReduction || 0;
            return lv > 0 ? `-${((1 - Math.pow(0.95, lv)) * 100).toFixed(2)}%` : '0.00%';
        },
    },
    {
        id: 'autoBuyer',
        name: '🛒 オートバイヤー',
        desc: '最安のアップグレードを自動購入',
        icon: '🛒',
        baseCost: 500000,
        costMultiplier: 1,
        maxLevel: 1,
        apply: (s) => { s.autoBuyer = s.upgrades.autoBuyer >= 1; },
        effectText: (s) => s.autoBuyer ? 'ON' : 'OFF',
    },
    {
        id: 'autoPrestige',
        name: '🔄 オートプレステージ',
        desc: '条件達成で自動プレステージ（転生50回で解放）',
        icon: '🔄',
        baseCost: 10000000,
        costMultiplier: 1,
        maxLevel: 1,
        hidden: true,
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
        apply: () => { },
        effectText: (s) => `+${(s.upgrades.hyperShooter || 0) * 1.0}回/秒`,
    },
];

// ============================================================
// アチーブメント定義
// ============================================================

// マイルストーン閾値を返す（n=0から）
function achThresholdJackpot(n) { return (n + 1) * 5; }
function achThresholdUpgrade(n) { return n === 0 ? 1 : n * 5; }

const ACHIEVEMENT_DEFS = [
    {
        id: 'jackpots', name: '🎉 大当たりの星', icon: '🎉',
        getValue: (s) => s.totalLifetimeJackpots,
        getThreshold: achThresholdJackpot,
        maxMilestones: Infinity, reward: 100, hidden: false,
    },
    {
        id: 'upg_spinRate', name: '⚡ 高速回転の達人', icon: '⚡',
        getValue: (s) => s.upgrades.spinRate || 0,
        getThreshold: achThresholdUpgrade,
        maxMilestones: Infinity, reward: 100, hidden: false,
    },
    {
        id: 'upg_jackpotProb', name: '🎯 引き寄せの極意', icon: '🎯',
        getValue: (s) => s.upgrades.jackpotProb || 0,
        getThreshold: achThresholdUpgrade,
        maxMilestones: Infinity, reward: 100, hidden: false,
    },
    {
        id: 'upg_jackpotPayout', name: '💰 出玉王の証', icon: '💰',
        getValue: (s) => s.upgrades.jackpotPayout || 0,
        getThreshold: achThresholdUpgrade,
        maxMilestones: Infinity, reward: 100, hidden: false,
    },
    {
        id: 'upg_kakuhenBoost', name: '🔥 灼熱の求道者', icon: '🔥',
        getValue: (s) => s.upgrades.kakuhenBoost || 0,
        getThreshold: achThresholdUpgrade,
        maxMilestones: Infinity, reward: 100, hidden: false,
    },
    {
        id: 'upg_stSpins', name: '⏱️ 時を操る者', icon: '⏱️',
        getValue: (s) => s.upgrades.stSpins || 0,
        getThreshold: achThresholdUpgrade,
        maxMilestones: Infinity, reward: 100, hidden: false,
    },
    {
        id: 'upg_kakuhenCont', name: '🔁 無限連荘の夢', icon: '🔁',
        getValue: (s) => s.upgrades.kakuhenCont || 0,
        getThreshold: achThresholdUpgrade,
        maxMilestones: Infinity, reward: 100, hidden: false,
    },
    {
        id: 'upg_critical', name: '💎 一撃必殺の魂', icon: '💎',
        getValue: (s) => s.upgrades.critical || 0,
        getThreshold: achThresholdUpgrade,
        maxMilestones: Infinity, reward: 100, hidden: false,
    },
    {
        id: 'upg_costReduction', name: '💸 節約の鬼', icon: '💸',
        getValue: (s) => s.upgrades.costReduction || 0,
        getThreshold: achThresholdUpgrade,
        maxMilestones: Infinity, reward: 100, hidden: false,
    },
    // 隠しアチーブメント
    {
        id: 'reelClick', name: '🎰 リールマスター', icon: '🎰',
        getValue: (s) => s.reelClicks || 0,
        getThreshold: (n) => [10, 50, 100][n] ?? null,
        maxMilestones: 3, reward: 300, hidden: true,
    },
];
