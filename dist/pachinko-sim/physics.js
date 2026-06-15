// ========================================
// physics.js — パチンコ玉の物理演算エンジン（v3: 実機画像準拠）
// ========================================

// 玉クラス
export class Ball {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 3.5;
        this.active = true;
        this.age = 0;
    }

    update(gravity, damping, boardBounds) {
        if (!this.active) return;

        this.vy += gravity;
        this.vx *= damping;
        this.vy *= damping;
        this.x += this.vx;
        this.y += this.vy;
        this.age++;

        // 盤面の円形境界に沿った反射
        const cx = boardBounds.cx;
        const cy = boardBounds.cy;
        const r = boardBounds.r;
        const dx = this.x - cx;
        const dy = this.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist + this.radius > r) {
            // 円の内側に押し戻す
            const nx = dx / dist;
            const ny = dy / dist;
            this.x = cx + nx * (r - this.radius - 1);
            this.y = cy + ny * (r - this.radius - 1);

            // 反射
            const dot = this.vx * nx + this.vy * ny;
            this.vx -= 1.6 * dot * nx;
            this.vy -= 1.6 * dot * ny;
            this.vx *= 0.5;
            this.vy *= 0.5;
        }

        // 底部アウト
        if (this.y > boardBounds.cy + boardBounds.r + 10) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        const grad = ctx.createRadialGradient(
            this.x - 1, this.y - 1, 0,
            this.x, this.y, this.radius
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.2, '#eaeaea');
        grad.addColorStop(0.6, '#b0b0b0');
        grad.addColorStop(1, '#606060');

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
    }
}

// 釘クラス
export class Nail {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius || 2;
    }

    draw(ctx) {
        const grad = ctx.createRadialGradient(
            this.x - 0.5, this.y - 0.5, 0,
            this.x, this.y, this.radius
        );
        grad.addColorStop(0, '#e8d080');
        grad.addColorStop(1, '#906820');
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
    }
}

// 風車クラス
export class Windmill {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius || 7;
        this.angle = 0;
        this.spinSpeed = 0;
    }

    update() {
        this.angle += this.spinSpeed;
        this.spinSpeed *= 0.93;
    }

    spin(direction) {
        this.spinSpeed += direction * 0.25;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        for (let i = 0; i < 4; i++) {
            ctx.save();
            ctx.rotate((Math.PI / 2) * i);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-2.5, -this.radius);
            ctx.lineTo(2.5, -this.radius);
            ctx.closePath();
            ctx.fillStyle = i % 2 === 0 ? '#e04040' : '#ffffff';
            ctx.fill();
            ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#c0a040';
        ctx.fill();
        ctx.strokeStyle = '#806020';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
    }
}

// ========================================
// 盤面レイアウト（エヴァ15 実機画像準拠）
// ========================================
export class BoardLayout {
    constructor(boardCenter, boardRadius, lcdBounds) {
        this.nails = [];
        this.windmills = [];
        this.cx = boardCenter.x;
        this.cy = boardCenter.y;
        this.r = boardRadius;
        this.lcd = lcdBounds; // {x, y, w, h}
        this.generate();
    }

    // 盤面内にあるかチェック
    isInBoard(x, y, margin) {
        const dx = x - this.cx;
        const dy = y - this.cy;
        return Math.sqrt(dx * dx + dy * dy) < this.r - (margin || 15);
    }

    // 液晶エリアと重なるかチェック
    isInLCD(x, y, pad) {
        const p = pad || 8;
        return x > this.lcd.x - p && x < this.lcd.x + this.lcd.w + p &&
               y > this.lcd.y - p && y < this.lcd.y + this.lcd.h + p;
    }

    generate() {
        const cx = this.cx;
        const cy = this.cy;
        const r = this.r;
        const lcd = this.lcd;

        // === 天釘（盤面上部、弧に沿った釘列）===
        for (let i = 0; i < 14; i++) {
            const angle = Math.PI * 0.85 + (Math.PI * 0.3 / 13) * i;
            const nr = r - 20;
            const nx = cx + Math.cos(angle) * nr;
            const ny = cy + Math.sin(angle) * nr;
            if (this.isInBoard(nx, ny) && !this.isInLCD(nx, ny)) {
                this.nails.push(new Nail(nx, ny, 2));
            }
        }

        // === 釘フィールド（千鳥配置、液晶周辺を避ける）===
        // 液晶の左側エリア
        for (let row = 0; row < 14; row++) {
            const y = lcd.y - 10 + row * 14;
            const cols = 3;
            const offset = (row % 2) * 7;
            for (let col = 0; col < cols; col++) {
                const x = 30 + offset + col * 14;
                if (this.isInBoard(x, y, 18) && !this.isInLCD(x, y)) {
                    this.nails.push(new Nail(x, y, 2));
                }
            }
        }

        // 液晶の右側エリア
        for (let row = 0; row < 10; row++) {
            const y = lcd.y + 20 + row * 14;
            const cols = 3;
            const offset = (row % 2) * 7;
            for (let col = 0; col < cols; col++) {
                const x = lcd.x + lcd.w + 12 + offset + col * 14;
                if (this.isInBoard(x, y, 18) && !this.isInLCD(x, y)) {
                    this.nails.push(new Nail(x, y, 2));
                }
            }
        }

        // === 液晶下の道釘（ヘソへの誘導）===
        const hesoRegionY = lcd.y + lcd.h + 15;
        for (let row = 0; row < 5; row++) {
            const y = hesoRegionY + row * 13;
            const count = 10 + row;
            const offset = (row % 2) * 8;
            for (let i = 0; i < count; i++) {
                const x = 40 + offset + i * 16;
                if (x > lcd.x + lcd.w + 40) continue;
                if (Math.abs(x - cx) < 12 && row > 2) continue; // ヘソ直上は空ける
                if (this.isInBoard(x, y, 18)) {
                    this.nails.push(new Nail(x, y, 2));
                }
            }
        }

        // === ヘソ周辺ガイド釘（ハの字）===
        const hesoY = lcd.y + lcd.h + 78;
        this.nails.push(new Nail(cx - 18, hesoY - 10, 2));
        this.nails.push(new Nail(cx + 18, hesoY - 10, 2));
        this.nails.push(new Nail(cx - 28, hesoY - 18, 2));
        this.nails.push(new Nail(cx + 28, hesoY - 18, 2));

        // === 右側ルート（アタッカー・電チューへの道）===
        const rightX = lcd.x + lcd.w + 30;
        for (let i = 0; i < 5; i++) {
            const x = rightX + 10 + (i % 2) * 6;
            const y = lcd.y - 20 + i * 25;
            if (this.isInBoard(x, y, 18)) {
                this.nails.push(new Nail(x, y, 2));
            }
        }

        // === 下部左のこぼし釘 ===
        for (let i = 0; i < 3; i++) {
            const x = 35 + (i % 2) * 6;
            const y = hesoY - 5 + i * 14;
            if (this.isInBoard(x, y, 18)) {
                this.nails.push(new Nail(x, y, 2));
            }
        }

        // === 風車（左液晶下、ヘソへの分岐点）===
        const wmX = lcd.x - 5;
        const wmY = lcd.y + lcd.h + 20;
        if (this.isInBoard(wmX, wmY, 20)) {
            this.windmills.push(new Windmill(wmX, wmY, 7));
        }
    }

    draw(ctx) {
        for (const nail of this.nails) {
            nail.draw(ctx);
        }
        for (const wm of this.windmills) {
            wm.draw(ctx);
        }
    }

    update() {
        for (const wm of this.windmills) {
            wm.update();
        }
    }
}

// 衝突判定
export function collideBallNail(ball, nail) {
    const dx = ball.x - nail.x;
    const dy = ball.y - nail.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = ball.radius + nail.radius;

    if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        ball.x += nx * overlap;
        ball.y += ny * overlap;

        const dot = ball.vx * nx + ball.vy * ny;
        const restitution = 0.3 + Math.random() * 0.25;
        ball.vx -= (1 + restitution) * dot * nx;
        ball.vy -= (1 + restitution) * dot * ny;
        ball.vx += (Math.random() - 0.5) * 0.5;
        return true;
    }
    return false;
}

export function collideBallWindmill(ball, windmill) {
    const dx = ball.x - windmill.x;
    const dy = ball.y - windmill.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = ball.radius + windmill.radius;

    if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        ball.x += nx * overlap;
        ball.y += ny * overlap;

        const dot = ball.vx * nx + ball.vy * ny;
        ball.vx -= 1.3 * dot * nx;
        ball.vy -= 1.3 * dot * ny;
        windmill.spin(dx > 0 ? 1 : -1);
        ball.vx += (dx > 0 ? 1 : -1) * 1.0;
        return true;
    }
    return false;
}

export function collideBallRect(ball, rect) {
    const closestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.height));
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    return Math.sqrt(dx * dx + dy * dy) < ball.radius;
}

// 入賞口
export class Pocket {
    constructor(x, y, width, height, type, options = {}) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
        this.isOpen = options.isOpen !== undefined ? options.isOpen : true;
        this.label = options.label || '';
        this.color = options.color || '#4a90e0';
        this.vertical = options.vertical || false; // 縦長入賞口（アタッカー等）
    }

    get rect() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    draw(ctx) {
        if (!this.isOpen && (this.type === 'denchu' || this.type === 'attacker')) {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
            return;
        }

        const grad = this.vertical
            ? ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y)
            : ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        grad.addColorStop(0, this.color);
        grad.addColorStop(1, '#111');
        ctx.fillStyle = grad;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        if (this.isOpen) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }

        if (this.label) {
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 6px sans-serif';
            ctx.textAlign = 'center';
            if (this.vertical && this.height > 30) {
                // 縦書き風
                ctx.translate(this.x + this.width / 2, this.y + 8);
                for (let i = 0; i < this.label.length; i++) {
                    ctx.fillText(this.label[i], 0, i * 8);
                }
            } else {
                ctx.fillText(this.label, this.x + this.width / 2, this.y + this.height / 2 + 2);
            }
            ctx.restore();
        }
    }

    checkBall(ball) {
        if (!this.isOpen) return false;
        return collideBallRect(ball, this.rect);
    }
}
