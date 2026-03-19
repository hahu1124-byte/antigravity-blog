// ========================================
// game.js — メインゲームループ（v3: 実機画像準拠）
// ========================================

import { Ball, BoardLayout, Pocket, collideBallNail, collideBallWindmill } from './physics.js';
import { ReelSet } from './reels.js';

// ========== 定数 ==========
const BOARD_SIZE = 340;
const BOARD_CX = BOARD_SIZE / 2;
const BOARD_CY = BOARD_SIZE / 2;
const BOARD_R = BOARD_SIZE / 2 - 8;
const GRAVITY = 0.14;
const DAMPING = 0.999;
const MAX_BALLS = 12;
const LAUNCH_INTERVAL = 7;

// エヴァ15 スペック
const SPEC = {
    prob: 319.7,
    probRush: 99.4,
    stCount: 163,
    stEntryRate: 0.59,
    rounds10R: 0.59,
    prize: { heso: 5, denchu: 1, attacker: 15, normal: 5 },
};

// 液晶エリア（盤面上部中央寄り、画像に合わせて大きめ）
const LCD = { x: 55, y: 40, w: 175, h: 120 };

// 盤面の円形境界
const BOUNDS = { cx: BOARD_CX, cy: BOARD_CY, r: BOARD_R };

// ========== ゲーム状態 ==========
const state = {
    balls: [],
    board: null,
    pockets: [],
    reelSet: null,
    holdCount: 0,
    maxHold: 4,
    totalBalls: 1000,
    handlePower: 0.5,
    autoLaunch: false, // トグル式ON/OFF
    launchCounter: 0,
    mode: 'normal',
    bonusRound: 0,
    bonusMaxRound: 10,
    bonusCount: 0,
    bonusMaxCount: 10,
    bonusType: '10R',
    rushRemaining: 0,
    isRush: false,
    totalSpins: 0,
    totalHits: 0,
    totalPayout: 0,
    canvas: null,
    ctx: null,
    frameCount: 0,
    announceText: '',
    announceTimer: 0,
};

// ========== 初期化 ==========
export function init(canvas) {
    state.canvas = canvas;
    state.ctx = canvas.getContext('2d');
    canvas.width = BOARD_SIZE;
    canvas.height = BOARD_SIZE;

    // 盤面レイアウト
    state.board = new BoardLayout({ x: BOARD_CX, y: BOARD_CY }, BOARD_R, LCD);

    // 入賞口の配置（画像に基づく）
    const cx = BOARD_CX;

    // ヘソ（下部中央、画像の①マーク位置）
    const hesoY = LCD.y + LCD.h + 80;
    state.pockets.push(new Pocket(
        cx - 8, hesoY, 16, 7, 'heso',
        { color: '#e04040', label: 'START' }
    ));

    // 電チュー（右下、画像の「特2電チュー」位置）
    state.pockets.push(new Pocket(
        LCD.x + LCD.w + 25, LCD.y + LCD.h + 50, 18, 7, 'denchu',
        { color: '#40a0e0', label: '電チュー', isOpen: false }
    ));

    // アタッカー（右側、画像の「アタッカー」位置 — 縦長）
    state.pockets.push(new Pocket(
        LCD.x + LCD.w + 30, LCD.y + 10, 8, 40, 'attacker',
        { color: '#e04040', label: 'ATK', isOpen: false, vertical: true }
    ));

    // 一般入賞口（⑤マーク位置に基づく）
    // 左下
    state.pockets.push(new Pocket(45, hesoY - 25, 12, 6, 'normal', { color: '#60a060' }));
    state.pockets.push(new Pocket(60, hesoY + 8, 12, 6, 'normal', { color: '#60a060' }));
    // 下部
    state.pockets.push(new Pocket(cx - 35, hesoY + 16, 12, 6, 'normal', { color: '#60a060' }));
    state.pockets.push(new Pocket(cx + 23, hesoY + 16, 12, 6, 'normal', { color: '#60a060' }));

    // サブデジ入賞口（右下、画像の①位置）
    state.pockets.push(new Pocket(
        LCD.x + LCD.w + 20, hesoY + 10, 14, 6, 'heso',
        { color: '#c04080' }
    ));

    // リール
    state.reelSet = new ReelSet();
    state.reelSet.onComplete = handleSpinResult;

    setupEvents();
    requestAnimationFrame(gameLoop);
}

// ========== イベント ==========
function setupEvents() {
    const handleSlider = document.getElementById('handle-slider');
    const launchBtn = document.getElementById('launch-btn');
    const buyBtn = document.getElementById('buy-btn');

    if (handleSlider) {
        handleSlider.addEventListener('input', (e) => {
            state.handlePower = e.target.value / 100;
        });
    }

    if (launchBtn) {
        // トグル式ON/OFF
        launchBtn.addEventListener('click', () => {
            state.autoLaunch = !state.autoLaunch;
            launchBtn.textContent = state.autoLaunch ? '⏹ 発射 STOP' : '▶ 発射 START';
            launchBtn.classList.toggle('btn-active', state.autoLaunch);
        });
    }

    if (buyBtn) {
        buyBtn.addEventListener('click', () => {
            state.totalBalls += 250;
            updateUI();
        });
    }
}

// ========== 発射（左下から上へ弧を描く）==========
function launchBall() {
    if (state.totalBalls <= 0) return;
    if (state.balls.filter(b => b.active).length >= MAX_BALLS) return;

    // 発射起点: 盤面左下（実機の発射レール上端）
    const startX = 22;
    const startY = BOARD_CY + BOARD_R - 40;

    // 左下から右上方向へ弧を描く
    const power = state.handlePower;
    const speed = 5 + power * 7;
    // 約60度〜75度の角度で右上へ
    const angle = -1.1 - power * 0.25;

    const ball = new Ball(
        startX + Math.random() * 2,
        startY,
        Math.cos(angle) * speed * 0.5,
        Math.sin(angle) * speed
    );
    state.balls.push(ball);
    state.totalBalls--;
}

// ========== ステージ衝突 ==========
function checkStage(ball) {
    const stageX = LCD.x + 15;
    const stageY = LCD.y + LCD.h + 2;
    const stageW = LCD.w - 30;
    const stageH = 5;

    if (ball.y + ball.radius > stageY &&
        ball.y - ball.radius < stageY + stageH &&
        ball.x > stageX && ball.x < stageX + stageW) {
        ball.y = stageY - ball.radius;
        ball.vy = -Math.abs(ball.vy) * 0.15;
        const center = stageX + stageW / 2;
        ball.vx += (center - ball.x) * 0.006;
        ball.vx *= 0.8;
    }
}

// ========== 入賞処理 ==========
function handlePocketEntry(ball, pocket) {
    ball.active = false;
    switch (pocket.type) {
        case 'heso':
            if (state.holdCount < state.maxHold) {
                state.holdCount++;
                state.totalBalls += SPEC.prize.heso;
            }
            break;
        case 'denchu':
            if (state.holdCount < state.maxHold) {
                state.holdCount++;
                state.totalBalls += SPEC.prize.denchu;
            }
            break;
        case 'attacker':
            state.bonusCount++;
            state.totalBalls += SPEC.prize.attacker;
            state.totalPayout += SPEC.prize.attacker;
            if (state.bonusCount >= state.bonusMaxCount) {
                state.bonusRound++;
                state.bonusCount = 0;
                if (state.bonusRound >= state.bonusMaxRound) endBonus();
            }
            break;
        case 'normal':
            state.totalBalls += SPEC.prize.normal;
            break;
    }
}

// ========== 変動 ==========
function startSpin() {
    if (state.holdCount <= 0 || !state.reelSet.isIdle() || state.mode === 'bonus') return;
    state.holdCount--;
    state.totalSpins++;
    const prob = state.isRush ? SPEC.probRush : SPEC.prob;
    const isHit = Math.random() < (1 / prob);
    state.reelSet.startSpin(isHit);
    state.mode = 'spinning';
}

function handleSpinResult(result) {
    if (result.isHit) {
        state.totalHits++;
        startBonus();
    } else {
        if (state.isRush) {
            state.rushRemaining--;
            if (state.rushRemaining <= 0) { endRush(); } else { state.mode = 'rush'; }
        } else {
            state.mode = 'normal';
        }
    }
}

function startBonus() {
    const is10R = Math.random() < SPEC.rounds10R;
    state.bonusType = is10R ? '10R' : '3R';
    state.bonusMaxRound = is10R ? 10 : 3;
    state.mode = 'bonus';
    state.bonusRound = 0;
    state.bonusCount = 0;
    state.bonusMaxCount = 10;
    const attacker = state.pockets.find(p => p.type === 'attacker');
    if (attacker) attacker.isOpen = true;
    setAnnounce(`大当たり! ${state.bonusType}`, 90);
}

function endBonus() {
    const attacker = state.pockets.find(p => p.type === 'attacker');
    if (attacker) attacker.isOpen = false;
    if (Math.random() < SPEC.stEntryRate) {
        state.isRush = true;
        state.rushRemaining = SPEC.stCount;
        state.mode = 'rush';
        const denchu = state.pockets.find(p => p.type === 'denchu');
        if (denchu) denchu.isOpen = true;
        setAnnounce('IMPACT MODE!', 90);
    } else {
        state.isRush = false;
        state.mode = 'normal';
        const denchu = state.pockets.find(p => p.type === 'denchu');
        if (denchu) denchu.isOpen = false;
        setAnnounce('通常モード', 50);
    }
}

function endRush() {
    state.isRush = false;
    state.mode = 'normal';
    const denchu = state.pockets.find(p => p.type === 'denchu');
    if (denchu) denchu.isOpen = false;
    setAnnounce('RUSH 終了', 50);
}

function setAnnounce(text, frames) {
    state.announceText = text;
    state.announceTimer = frames;
}

// ========== ゲームループ ==========
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    state.frameCount++;

    // 自動発射
    if (state.autoLaunch && state.handlePower > 0) {
        state.launchCounter++;
        if (state.launchCounter >= LAUNCH_INTERVAL) {
            launchBall();
            state.launchCounter = 0;
        }
    }

    // 玉更新
    for (const ball of state.balls) {
        if (!ball.active) continue;
        ball.update(GRAVITY, DAMPING, BOUNDS);

        for (const nail of state.board.nails) { collideBallNail(ball, nail); }
        for (const wm of state.board.windmills) { collideBallWindmill(ball, wm); }
        checkStage(ball);
        for (const pocket of state.pockets) {
            if (pocket.checkBall(ball)) { handlePocketEntry(ball, pocket); break; }
        }
    }

    state.board.update();
    if (state.frameCount % 60 === 0) { state.balls = state.balls.filter(b => b.active); }

    state.reelSet.update();
    state.reelSet.updateFlash();
    if (state.holdCount > 0 && state.reelSet.isIdle() && state.mode !== 'bonus') { startSpin(); }
    if (state.announceTimer > 0) state.announceTimer--;
    if (state.frameCount % 15 === 0) updateUI();
}

// ========== 描画 ==========
function draw() {
    const ctx = state.ctx;

    // 外側（筐体色）
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

    // 盤面（円形）
    drawBoard(ctx);

    // 発射レール
    drawLaunchRail(ctx);

    // 釘・風車
    state.board.draw(ctx);

    // ステージ
    drawStage(ctx);

    // 入賞口
    for (const pocket of state.pockets) { pocket.draw(ctx); }

    // 保留ランプ
    drawHoldLamps(ctx);

    // 液晶
    drawLCD(ctx);
    state.reelSet.draw(ctx, LCD.x + 10, LCD.y + 16, LCD.w - 20, LCD.h - 28);

    // 玉
    for (const ball of state.balls) { ball.draw(ctx); }

    // アウト穴
    drawOutHole(ctx);

    // オーバーレイ
    if (state.mode === 'bonus') drawBonusOverlay(ctx);
    if (state.isRush && state.mode !== 'bonus') drawRushIndicator(ctx);
    if (state.announceTimer > 0) drawAnnounce(ctx);
}

function drawBoard(ctx) {
    // 盤面は円形（実機のガラスの中）
    ctx.save();
    ctx.beginPath();
    ctx.arc(BOARD_CX, BOARD_CY, BOARD_R, 0, Math.PI * 2);

    // 緑の盤面
    const boardGrad = ctx.createRadialGradient(BOARD_CX, BOARD_CY, 0, BOARD_CX, BOARD_CY, BOARD_R);
    boardGrad.addColorStop(0, '#1e4a2e');
    boardGrad.addColorStop(1, '#0e2a1a');
    ctx.fillStyle = boardGrad;
    ctx.fill();

    // 外レール（金属色の円弧）
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
}

function drawLaunchRail(ctx) {
    // 左下から上へ弧を描くレール
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    ctx.beginPath();
    // レールの弧（左下から盤面上部へ）
    const startX = 16;
    const startY = BOARD_CY + BOARD_R - 15;
    ctx.moveTo(startX, startY);
    // 左外レールに沿って上昇
    ctx.quadraticCurveTo(8, BOARD_CY, BOARD_CX - 50, BOARD_CY - BOARD_R + 15);
    ctx.stroke();

    // 内レールのハイライト
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX + 2, startY);
    ctx.quadraticCurveTo(10, BOARD_CY, BOARD_CX - 48, BOARD_CY - BOARD_R + 17);
    ctx.stroke();
}

function drawLCD(ctx) {
    ctx.fillStyle = '#050510';
    const pad = 4;
    ctx.fillRect(LCD.x - pad, LCD.y - pad, LCD.w + pad * 2, LCD.h + pad * 2);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(LCD.x - pad, LCD.y - pad, LCD.w + pad * 2, LCD.h + pad * 2);
    ctx.fillStyle = '#444';
    ctx.font = '7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`1/${SPEC.prob}`, LCD.x + LCD.w / 2, LCD.y + 10);
}

function drawStage(ctx) {
    const sx = LCD.x + 15;
    const sy = LCD.y + LCD.h + 2;
    const sw = LCD.w - 30;
    const sh = 5;

    const grad = ctx.createLinearGradient(sx, sy, sx, sy + sh);
    grad.addColorStop(0, '#666');
    grad.addColorStop(0.5, '#aaa');
    grad.addColorStop(1, '#555');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + sw / 2, sy + 3, sx + sw, sy);
    ctx.lineTo(sx + sw, sy + sh);
    ctx.lineTo(sx, sy + sh);
    ctx.closePath();
    ctx.fill();
}

function drawHoldLamps(ctx) {
    const lampY = LCD.y + LCD.h + 14;
    const lampR = 3.5;
    const startX = BOARD_CX - (state.maxHold * 10) / 2;

    for (let i = 0; i < state.maxHold; i++) {
        const x = startX + i * 10 + lampR;
        ctx.beginPath();
        ctx.arc(x, lampY, lampR, 0, Math.PI * 2);
        if (i < state.holdCount) {
            const colors = ['#ff3333', '#3366ff', '#ff3333', '#3366ff'];
            ctx.fillStyle = colors[i];
            ctx.fill();
            ctx.shadowColor = colors[i];
            ctx.shadowBlur = 5;
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = '#1a1a1a';
            ctx.fill();
        }
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }
}

function drawOutHole(ctx) {
    const cx = BOARD_CX;
    const y = BOARD_CY + BOARD_R - 16;
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.ellipse(cx, y, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawBonusOverlay(ctx) {
    ctx.fillStyle = 'rgba(200, 30, 30, 0.9)';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${state.bonusType}  R${state.bonusRound + 1}/${state.bonusMaxRound}`, BOARD_CX, 22);
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.fillText(`${state.bonusCount}/${state.bonusMaxCount}C`, BOARD_CX, 35);
}

function drawRushIndicator(ctx) {
    const glow = Math.sin(state.frameCount * 0.1) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(0, 200, 255, ${glow})`;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`★ IMPACT MODE ★ 残${state.rushRemaining}回`, BOARD_CX, 20);
}

function drawAnnounce(ctx) {
    const alpha = Math.min(1, state.announceTimer / 15);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * alpha})`;
    ctx.fillRect(BOARD_CX - 80, BOARD_CY - 15, 160, 30);
    ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.announceText, BOARD_CX, BOARD_CY);
    ctx.textBaseline = 'alphabetic';
}

function updateUI() {
    const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    set('balls-count', state.totalBalls.toLocaleString());
    set('spins-count', state.totalSpins.toLocaleString());
    set('hits-count', state.totalHits.toLocaleString());
    set('payout-count', state.totalPayout.toLocaleString());

    const modeEl = document.getElementById('mode-display');
    if (modeEl) {
        const names = {
            normal: '通常', spinning: '変動中',
            bonus: `${state.bonusType} R${state.bonusRound + 1}`,
            rush: `IMPACT 残${state.rushRemaining}`,
        };
        modeEl.textContent = names[state.mode] || state.mode;
        modeEl.className = `mode-badge mode-${state.mode}`;
    }
}
