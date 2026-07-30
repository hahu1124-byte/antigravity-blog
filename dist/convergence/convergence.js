/**
 * 確率収束シミュレーター
 *
 * パチンコの大当り確率がどれだけの回転数で理論値に収束するかを
 * モンテカルロシミュレーションで可視化する
 */

const ConvergenceApp = {
    canvas: null,
    ctx: null,

    /**
     * 初期化
     */
    init() {
        this.canvas = document.getElementById('main-chart');
        this.ctx = this.canvas.getContext('2d');
        this.syncTheme();
        this.bindEvents();
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    },

    syncTheme() {
        try {
            const theme = localStorage.getItem('gp-theme') || 'dark';
            document.documentElement.setAttribute('data-theme', theme);
        } catch { /* ignore */ }
    },

    bindEvents() {
        document.getElementById('run-btn').addEventListener('click', () => this.run());
    },

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = container.clientWidth * dpr;
        this.canvas.height = 400 * dpr;
        this.ctx.scale(dpr, dpr);
    },

    /**
     * シミュレーション実行
     */
    run() {
        const btn = document.getElementById('run-btn');
        btn.textContent = '⏳ 計算中...';
        btn.classList.add('running');

        // UIを先に更新してからシミュレーション実行
        requestAnimationFrame(() => {
            const prob = parseFloat(document.getElementById('prob-input').value);
            const totalSpins = parseInt(document.getElementById('trial-count').value);
            const simCount = parseInt(document.getElementById('sim-count').value);

            if (prob <= 0 || isNaN(prob)) {
                alert('有効な確率を入力してください');
                btn.textContent = '▶ シミュレーション実行';
                btn.classList.remove('running');
                return;
            }

            const hitRate = 1 / prob; // 1回転あたりの当選確率
            const results = this.simulate(hitRate, totalSpins, simCount);

            document.getElementById('chart-placeholder').classList.add('hidden');
            this.drawChart(results, prob, totalSpins, simCount);
            this.updateStats(results, prob, totalSpins);

            document.getElementById('stats-panel').classList.remove('hidden');
            btn.textContent = '▶ シミュレーション実行';
            btn.classList.remove('running');
        });
    },

    /**
     * モンテカルロシミュレーション
     */
    simulate(hitRate, totalSpins, simCount) {
        const sampleInterval = Math.max(1, Math.floor(totalSpins / 500)); // グラフ用サンプリング
        const results = [];

        for (let sim = 0; sim < simCount; sim++) {
            const dataPoints = [];
            let hits = 0;

            for (let spin = 1; spin <= totalSpins; spin++) {
                if (Math.random() < hitRate) hits++;

                if (spin % sampleInterval === 0 || spin === totalSpins) {
                    dataPoints.push({
                        spin,
                        actualRate: hits / spin,
                        actualProb: spin / Math.max(hits, 1), // 1/X形式
                    });
                }
            }

            results.push({
                dataPoints,
                totalHits: hits,
                finalRate: hits / totalSpins,
                finalProb: totalSpins / Math.max(hits, 1),
            });
        }

        return results;
    },

    /**
     * グラフ描画
     */
    drawChart(results, prob, totalSpins, simCount) {
        this.resizeCanvas();
        const ctx = this.ctx;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = 400;

        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

        // クリア
        ctx.clearRect(0, 0, w, h);

        // マージン
        const margin = { top: 20, right: 30, bottom: 50, left: 65 };
        const plotW = w - margin.left - margin.right;
        const plotH = h - margin.top - margin.bottom;

        const theoreticalRate = 1 / prob;

        // Y軸範囲（確率の±偏差）
        const maxDeviation = Math.max(theoreticalRate * 1.5, theoreticalRate + 3 * Math.sqrt(theoreticalRate * (1 - theoreticalRate) / 100));
        const yMin = Math.max(0, theoreticalRate - (maxDeviation - theoreticalRate));
        const yMax = maxDeviation;

        // スケーリング関数
        const xScale = (spin) => margin.left + (spin / totalSpins) * plotW;
        const yScale = (rate) => margin.top + plotH - ((rate - yMin) / (yMax - yMin)) * plotH;

        // 95%信頼区間帯の描画
        ctx.fillStyle = isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.12)';
        ctx.beginPath();
        const ciPoints = [];
        for (let spin = 100; spin <= totalSpins; spin += Math.max(1, totalSpins / 200)) {
            const se = Math.sqrt(theoreticalRate * (1 - theoreticalRate) / spin);
            ciPoints.push({ spin, upper: theoreticalRate + 1.96 * se, lower: theoreticalRate - 1.96 * se });
        }
        // 上側ライン
        ctx.moveTo(xScale(ciPoints[0].spin), yScale(Math.min(ciPoints[0].upper, yMax)));
        ciPoints.forEach(p => ctx.lineTo(xScale(p.spin), yScale(Math.min(p.upper, yMax))));
        // 下側ライン（逆順）
        for (let i = ciPoints.length - 1; i >= 0; i--) {
            ctx.lineTo(xScale(ciPoints[i].spin), yScale(Math.max(ciPoints[i].lower, yMin)));
        }
        ctx.closePath();
        ctx.fill();

        // 信頼区間の境界線
        ctx.strokeStyle = isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ciPoints.forEach((p, i) => {
            const fn = i === 0 ? 'moveTo' : 'lineTo';
            ctx[fn](xScale(p.spin), yScale(Math.min(p.upper, yMax)));
        });
        ctx.stroke();
        ctx.beginPath();
        ciPoints.forEach((p, i) => {
            const fn = i === 0 ? 'moveTo' : 'lineTo';
            ctx[fn](xScale(p.spin), yScale(Math.max(p.lower, yMin)));
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // 理論確率ライン
        ctx.strokeStyle = isDark ? '#eab308' : '#d97706';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(margin.left, yScale(theoreticalRate));
        ctx.lineTo(margin.left + plotW, yScale(theoreticalRate));
        ctx.stroke();
        ctx.setLineDash([]);

        // 各シミュレーション結果を描画
        const colors = this.generateColors(simCount, isDark);
        results.forEach((result, simIdx) => {
            ctx.strokeStyle = colors[simIdx];
            ctx.lineWidth = 1;
            ctx.globalAlpha = simCount > 20 ? 0.4 : 0.7;
            ctx.beginPath();
            result.dataPoints.forEach((point, i) => {
                const x = xScale(point.spin);
                const y = yScale(Math.max(yMin, Math.min(yMax, point.actualRate)));
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });
        ctx.globalAlpha = 1;

        // X軸
        ctx.fillStyle = isDark ? '#8b8fa0' : '#4a4d5e';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        const xTicks = 5;
        for (let i = 0; i <= xTicks; i++) {
            const spin = Math.round(totalSpins * i / xTicks);
            const x = xScale(spin);
            ctx.fillText(spin >= 1000 ? `${(spin / 1000).toFixed(0)}k` : spin.toString(), x, h - margin.bottom + 18);

            // グリッド線
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(x, margin.top);
            ctx.lineTo(x, margin.top + plotH);
            ctx.stroke();
        }

        // X軸ラベル
        ctx.fillStyle = isDark ? '#6b6f80' : '#8b8fa0';
        ctx.font = '12px sans-serif';
        ctx.fillText('回転数', margin.left + plotW / 2, h - 5);

        // Y軸
        ctx.textAlign = 'right';
        ctx.fillStyle = isDark ? '#8b8fa0' : '#4a4d5e';
        ctx.font = '11px sans-serif';
        const yTicks = 6;
        for (let i = 0; i <= yTicks; i++) {
            const rate = yMin + (yMax - yMin) * i / yTicks;
            const y = yScale(rate);
            const probLabel = rate > 0 ? `1/${(1 / rate).toFixed(0)}` : '∞';
            ctx.fillText(probLabel, margin.left - 8, y + 4);

            // グリッド線
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(margin.left, y);
            ctx.lineTo(margin.left + plotW, y);
            ctx.stroke();
        }

        // Y軸ラベル
        ctx.save();
        ctx.translate(14, margin.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = isDark ? '#6b6f80' : '#8b8fa0';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('実確率', 0, 0);
        ctx.restore();

        // 凡例
        ctx.fillStyle = isDark ? '#eab308' : '#d97706';
        ctx.fillRect(margin.left + plotW - 180, margin.top + 8, 12, 3);
        ctx.fillStyle = isDark ? '#8b8fa0' : '#4a4d5e';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`理論値 1/${prob}`, margin.left + plotW - 163, margin.top + 13);

        ctx.fillStyle = isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.4)';
        ctx.fillRect(margin.left + plotW - 180, margin.top + 24, 12, 8);
        ctx.fillStyle = isDark ? '#8b8fa0' : '#4a4d5e';
        ctx.fillText('95%信頼区間', margin.left + plotW - 163, margin.top + 32);
    },

    /**
     * シミュレーション結果の色を生成
     */
    generateColors(count, isDark) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const hue = (i * 360 / count + 200) % 360;
            const saturation = isDark ? '70%' : '60%';
            const lightness = isDark ? '60%' : '45%';
            colors.push(`hsl(${hue}, ${saturation}, ${lightness})`);
        }
        return colors;
    },

    /**
     * 統計サマリー更新
     */
    updateStats(results, prob, totalSpins) {
        const theoreticalRate = 1 / prob;

        // 平均実確率
        const avgRate = results.reduce((sum, r) => sum + r.finalRate, 0) / results.length;
        const avgProb = 1 / avgRate;

        // 最も偏った試行
        let worstDiff = 0;
        let worstProb = prob;
        results.forEach(r => {
            const diff = Math.abs(r.finalRate - theoreticalRate);
            if (diff > worstDiff) {
                worstDiff = diff;
                worstProb = r.finalProb;
            }
        });

        // 95%信頼区間内に収まった試行数
        const se = Math.sqrt(theoreticalRate * (1 - theoreticalRate) / totalSpins);
        const lower = theoreticalRate - 1.96 * se;
        const upper = theoreticalRate + 1.96 * se;
        const inRange = results.filter(r => r.finalRate >= lower && r.finalRate <= upper).length;
        const inRangePct = (inRange / results.length * 100).toFixed(0);

        // 収束の目安: 偏差率5%以内に収まるまでの回転数を理論的に計算
        // P(|p_hat - p| < 0.05p) ≈ 95% → n ≈ (1.96)^2 * (1-p) / (0.05p)^2
        const targetDeviation = 0.05; // 5%以内
        const convergenceSpins = Math.ceil(Math.pow(1.96, 2) * (1 - theoreticalRate) / Math.pow(targetDeviation * theoreticalRate, 2));

        // UI更新
        document.getElementById('stat-theoretical').textContent = `1/${prob}`;
        document.getElementById('stat-avg').textContent = `1/${avgProb.toFixed(1)}`;
        document.getElementById('stat-avg').className = 'stat-value ' + (Math.abs(avgProb - prob) < prob * 0.05 ? 'positive' : 'warning');

        document.getElementById('stat-worst').textContent = `1/${worstProb.toFixed(1)}`;
        document.getElementById('stat-worst').className = 'stat-value ' + (Math.abs(worstProb - prob) > prob * 0.2 ? 'negative' : 'warning');

        document.getElementById('stat-in-range').textContent = `${inRangePct}% (${inRange}/${results.length})`;
        document.getElementById('stat-in-range').className = 'stat-value ' + (parseInt(inRangePct) >= 90 ? 'positive' : parseInt(inRangePct) >= 70 ? 'warning' : 'negative');

        const convText = convergenceSpins >= 1000000
            ? `約 ${(convergenceSpins / 10000).toFixed(0)}万回転 で理論値±5%に収束（95%信頼度）`
            : `約 ${convergenceSpins.toLocaleString()}回転 で理論値±5%に収束（95%信頼度）`;
        document.getElementById('stat-convergence').textContent = convText;
    },
};

// アプリ起動
document.addEventListener('DOMContentLoaded', () => ConvergenceApp.init());
