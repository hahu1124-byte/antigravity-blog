// ========================================
// reels.js — 図柄変動・リール制御
// ========================================

// リール1本
class Reel {
    constructor(index) {
        this.index = index; // 0=左, 1=中, 2=右
        this.figures = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        this.position = 0;      // 現在の表示位置（連続値）
        this.speed = 0;         // スクロール速度
        this.targetFigure = 0;  // 停止予定の図柄
        this.state = 'idle';    // idle, spinning, stopping, stopped
        this.stopTimer = 0;
    }

    start(speed) {
        this.speed = speed || 12 + Math.random() * 4;
        this.state = 'spinning';
        this.stopTimer = 0;
    }

    stop(targetFigure, delay) {
        this.targetFigure = targetFigure;
        this.stopTimer = delay || 0;
        this.state = 'stopping';
    }

    update() {
        if (this.state === 'idle' || this.state === 'stopped') return;

        if (this.state === 'stopping') {
            if (this.stopTimer > 0) {
                this.stopTimer--;
                // まだ回り続ける
                this.position = (this.position + this.speed) % (this.figures.length * 30);
                return;
            }
            // 減速
            this.speed *= 0.92;
            if (this.speed < 0.5) {
                this.position = this.targetFigure * 30;
                this.speed = 0;
                this.state = 'stopped';
                return;
            }
        }

        this.position = (this.position + this.speed) % (this.figures.length * 30);
    }

    getCurrentFigure() {
        return Math.floor((this.position / 30) % this.figures.length);
    }

    draw(ctx, x, y, width, height) {
        // リール背景
        ctx.fillStyle = '#111';
        ctx.fillRect(x, y, width, height);

        // 図柄を3つ描画（上・中・下）
        const figureHeight = height / 3;
        const currentPos = this.position % (this.figures.length * 30);
        const idx = Math.floor(currentPos / 30);
        const offset = (currentPos % 30) / 30 * figureHeight;

        for (let i = -1; i <= 3; i++) {
            const figIdx = ((idx + i) % this.figures.length + this.figures.length) % this.figures.length;
            const fy = y + i * figureHeight - offset;

            if (fy + figureHeight < y || fy > y + height) continue;

            // 図柄の描画
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, width, height);
            ctx.clip();

            const fig = this.figures[figIdx];
            const isOdd = fig % 2 === 1;

            // 奇数は赤、偶数は青
            ctx.fillStyle = isOdd ? '#ff3333' : '#3366ff';
            ctx.font = `bold ${figureHeight * 0.7}px 'Arial Black', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(fig.toString(), x + width / 2, fy + figureHeight / 2);

            // ライン区切り
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, fy + figureHeight);
            ctx.lineTo(x + width, fy + figureHeight);
            ctx.stroke();

            ctx.restore();
        }

        // 中央ライン（当たりライン）
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.moveTo(x, y + height / 2);
        ctx.lineTo(x + width, y + height / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 枠
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
    }
}

// リールセット（3リール管理）
export class ReelSet {
    constructor() {
        this.reels = [new Reel(0), new Reel(1), new Reel(2)];
        this.state = 'idle'; // idle, spinning, reach, result
        this.result = null;  // { isHit, figures: [l, m, r] }
        this.onComplete = null; // コールバック
        this.reachTimer = 0;
        this.flashTimer = 0;
        this.isHit = false;
    }

    // 変動開始
    startSpin(isHit, hitFigure) {
        this.state = 'spinning';
        this.result = null;
        this.isHit = isHit;
        this.flashTimer = 0;

        // 全リール開始
        this.reels[0].start(14);
        this.reels[1].start(16);
        this.reels[2].start(15);

        if (isHit) {
            // 大当たり: 3つ揃い
            const fig = hitFigure !== undefined ? hitFigure : Math.floor(Math.random() * 10);
            this.reels[0].stop(fig, 30);   // 左を早めに停止
            this.reels[2].stop(fig, 55);   // 右を少し遅れて停止（リーチ演出のため）
            this.reels[1].stop(fig, 120);  // 中は最後にゆっくり停止
        } else {
            // ハズレ
            const leftFig = Math.floor(Math.random() * 10);
            let rightFig, midFig;

            // リーチになるかどうか（30%の確率でリーチハズレ）
            const isReach = Math.random() < 0.3;

            if (isReach) {
                rightFig = leftFig; // 左右同図柄
                // 中リールは必ず外す
                do {
                    midFig = Math.floor(Math.random() * 10);
                } while (midFig === leftFig);
                this.reels[0].stop(leftFig, 30);
                this.reels[2].stop(rightFig, 55);
                this.reels[1].stop(midFig, 100); // リーチ演出で少し長め
            } else {
                // バラケ目
                do {
                    rightFig = Math.floor(Math.random() * 10);
                } while (rightFig === leftFig);
                midFig = Math.floor(Math.random() * 10);
                this.reels[0].stop(leftFig, 25);
                this.reels[2].stop(rightFig, 45);
                this.reels[1].stop(midFig, 60);
            }
        }
    }

    update() {
        if (this.state === 'idle' || this.state === 'result') return;

        for (const reel of this.reels) {
            reel.update();
        }

        // 左右が止まって中がまだ回っている = リーチ判定
        if (this.reels[0].state === 'stopped' &&
            this.reels[2].state === 'stopped' &&
            this.reels[1].state !== 'stopped') {
            if (this.reels[0].targetFigure === this.reels[2].targetFigure) {
                this.state = 'reach';
            }
        }

        // 全リール停止
        if (this.reels.every(r => r.state === 'stopped')) {
            const figures = this.reels.map(r => r.targetFigure);
            const isHit = figures[0] === figures[1] && figures[1] === figures[2];
            this.result = { isHit, figures };
            this.state = 'result';
            this.flashTimer = isHit ? 60 : 30; // 大当たりは長めに表示

            if (this.onComplete) {
                this.onComplete(this.result);
            }
        }
    }

    // 結果表示のフラッシュタイマー更新
    updateFlash() {
        if (this.flashTimer > 0) {
            this.flashTimer--;
            if (this.flashTimer <= 0) {
                this.state = 'idle';
                // リールをリセット
                for (const reel of this.reels) {
                    reel.state = 'idle';
                }
            }
        }
    }

    isIdle() {
        return this.state === 'idle';
    }

    isSpinning() {
        return this.state === 'spinning' || this.state === 'reach';
    }

    draw(ctx, x, y, width, height) {
        const reelWidth = (width - 8) / 3;
        const gap = 4;

        // 背景
        const bgGrad = ctx.createLinearGradient(x, y, x, y + height);
        bgGrad.addColorStop(0, '#1a1a2e');
        bgGrad.addColorStop(1, '#16213e');
        ctx.fillStyle = bgGrad;
        // 角丸矩形
        const r = 8;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + width - r, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + r);
        ctx.lineTo(x + width, y + height - r);
        ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        ctx.lineTo(x + r, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.fill();

        // リーチ演出
        if (this.state === 'reach') {
            this.reachTimer = (this.reachTimer || 0) + 1;
            const glow = Math.sin(this.reachTimer * 0.15) * 0.5 + 0.5;
            ctx.strokeStyle = `rgba(255, 200, 0, ${glow})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + width - r, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + r);
            ctx.lineTo(x + width, y + height - r);
            ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
            ctx.lineTo(x + r, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.stroke();
        }

        // 大当たりフラッシュ
        if (this.state === 'result' && this.result?.isHit && this.flashTimer > 0) {
            const flash = Math.sin(this.flashTimer * 0.5) * 0.3 + 0.3;
            ctx.fillStyle = `rgba(255, 215, 0, ${flash})`;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + width - r, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + r);
            ctx.lineTo(x + width, y + height - r);
            ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
            ctx.lineTo(x + r, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.fill();
        }

        // 各リール描画
        for (let i = 0; i < 3; i++) {
            const rx = x + 4 + i * (reelWidth + gap / 2);
            this.reels[i].draw(ctx, rx, y + 6, reelWidth - gap / 2, height - 12);
        }

        // 枠
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + width - r, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + r);
        ctx.lineTo(x + width, y + height - r);
        ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        ctx.lineTo(x + r, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.stroke();

        // リーチ中のテキスト
        if (this.state === 'reach') {
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('★ REACH ★', x + width / 2, y - 6);
        }

        // 大当たり結果表示
        if (this.state === 'result' && this.result?.isHit && this.flashTimer > 0) {
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.strokeText('★ 大当たり ★', x + width / 2, y - 6);
            ctx.fillText('★ 大当たり ★', x + width / 2, y - 6);
        }

        // アイドル時の表示
        if (this.state === 'idle') {
            ctx.fillStyle = '#aaa';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('READY', x + width / 2, y + height / 2 + 4);
        }
    }
}
