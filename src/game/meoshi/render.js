// 目押しチャレンジ: リールの描画（Canvas）
import { REELS, FRAMES, LINES } from "./reel-data.js";

// 暖簾に入れる女の子の名前
export const CHARACTER_NAME = "HIBANA";

const FILES = {
  R: "uchiwa",
  H: "hana",
  F: "fuurin-a",
  G: "fuurin-b",
  D: "girl",
  d: "girl-small",
  N: "noren",
  S: "seven",
  I: "kori",
  C: "cherry",
};

function loadImage(url) {
  return new Promise((ok, ng) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = ng;
    img.src = url;
  });
}

// 暖簾は SVG の中の名前（id="name"）を差し替えてから画像にする
async function loadNoren(url) {
  const text = await (await fetch(url)).text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const el = doc.getElementById("name");
  if (el) el.textContent = CHARACTER_NAME;
  const svg = new XMLSerializer().serializeToString(doc);
  return loadImage(
    URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })),
  );
}

// 図柄の画像を読む。読めなかった図柄は null（文字で代わりに描く）
export async function loadSymbols(base) {
  const out = {};
  await Promise.all(
    Object.entries(FILES).map(async ([sym, file]) => {
      const url = `${base}symbols/${file}.svg`;
      try {
        out[sym] = sym === "N" ? await loadNoren(url) : await loadImage(url);
      } catch (e) {
        out[sym] = null;
      }
    }),
  );
  return out;
}

const FALLBACK_TEXT = {
  R: "目押",
  H: "花",
  F: "風鈴",
  G: "風鈴",
  D: "♀",
  d: "♀",
  N: CHARACTER_NAME,
  S: "7",
  I: "氷",
  C: "🍒",
};

export class ReelRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.symbols = {};
    this.sprites = {};
    this.layout = null;
  }

  setSymbols(images) {
    this.symbols = images;
    this.sprites = {};
  }

  // 表示幅に合わせて大きさを決める。高さは幅から決めて CSS に入れる
  resize() {
    const cssW = this.canvas.clientWidth || 360;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const W = Math.round(cssW * dpr);
    const gap = Math.round(W * 0.025);
    const reelW = Math.floor((W - gap * 4) / 3);
    const cellH = Math.round(reelW * 0.5);
    const padY = Math.round(gap * 1.2);
    const H = cellH * 3 + padY * 2;
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.style.height = `${H / dpr}px`;
    this.layout = { W, H, gap, reelW, cellH, padY, dpr };
    this.sprites = {};
  }

  // 図柄を 1 コマの大きさで描いておく（毎フレーム SVG を描かないように）
  sprite(sym) {
    if (this.sprites[sym]) return this.sprites[sym];
    const { reelW, cellH } = this.layout;
    const c = document.createElement("canvas");
    c.width = reelW;
    c.height = cellH;
    const g = c.getContext("2d");
    const img = this.symbols[sym];
    if (img) {
      g.drawImage(img, 0, 0, reelW, cellH);
    } else {
      g.fillStyle = "#222";
      g.font = `900 ${Math.round(cellH * 0.5)}px sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(FALLBACK_TEXT[sym] || sym, reelW / 2, cellH / 2);
    }
    this.sprites[sym] = c;
    return c;
  }

  // positions: 各リールの回転位置（中段の中心にあるコマの連続値）
  // opts.spinning: 回転中のリール（残像を付ける）、opts.lines: 光らせるライン、opts.flash: 窓全体を光らせる強さ 0〜1
  draw(positions, opts = {}) {
    if (!this.layout) this.resize();
    const { W, H, gap, reelW, cellH, padY } = this.layout;
    const g = this.ctx;
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#0b0b12";
    g.fillRect(0, 0, W, H);
    const midY = padY + cellH * 1.5;
    for (let r = 0; r < 3; r++) {
      const x0 = gap + r * (reelW + gap);
      g.save();
      g.beginPath();
      g.rect(x0, padY, reelW, cellH * 3);
      g.clip();
      // リールの帯（白地に薄い桃色の格子）
      const bg = g.createLinearGradient(x0, 0, x0 + reelW, 0);
      bg.addColorStop(0, "#f3e9ef");
      bg.addColorStop(0.5, "#fffafd");
      bg.addColorStop(1, "#f3e9ef");
      g.fillStyle = bg;
      g.fillRect(x0, padY, reelW, cellH * 3);
      const pos = positions[r];
      const spinning = opts.spinning && opts.spinning[r];
      const first = Math.floor(pos) - 2;
      const last = Math.ceil(pos) + 2;
      for (let k = first; k <= last; k++) {
        const sym = REELS[r][((k % FRAMES) + FRAMES) % FRAMES];
        const y = midY - (k - pos) * cellH - cellH / 2;
        const sp = this.sprite(sym);
        if (spinning) {
          // 回転中は半コマ後ろに薄い残像を重ねる
          g.globalAlpha = 0.3;
          g.drawImage(sp, x0, y - cellH * 0.5);
          g.globalAlpha = 1;
        }
        g.drawImage(sp, x0, y);
      }
      // 円筒の陰（上下を暗く）
      const sh = g.createLinearGradient(0, padY, 0, padY + cellH * 3);
      sh.addColorStop(0, "rgba(0,0,0,0.45)");
      sh.addColorStop(0.18, "rgba(0,0,0,0)");
      sh.addColorStop(0.82, "rgba(0,0,0,0)");
      sh.addColorStop(1, "rgba(0,0,0,0.45)");
      g.fillStyle = sh;
      g.fillRect(x0, padY, reelW, cellH * 3);
      g.restore();
      g.strokeStyle = "#555";
      g.lineWidth = Math.max(1, gap * 0.15);
      g.strokeRect(x0, padY, reelW, cellH * 3);
    }
    // 入賞ライン
    if (opts.lines && opts.lines.length) {
      g.save();
      g.lineCap = "round";
      for (const l of opts.lines) {
        const pts = LINES[l].rows.map((row, r) => [
          gap + r * (reelW + gap) + reelW / 2,
          midY - (row - 1) * cellH,
        ]);
        g.strokeStyle = "rgba(255,60,90,0.85)";
        g.shadowColor = "#ff2050";
        g.shadowBlur = gap;
        g.lineWidth = Math.max(3, cellH * 0.07);
        g.beginPath();
        g.moveTo(
          pts[0][0] - reelW / 2,
          pts[0][1] - (pts[1][1] - pts[0][1]) / 2,
        );
        for (const [x, y] of pts) g.lineTo(x, y);
        g.lineTo(
          pts[2][0] + reelW / 2,
          pts[2][1] + (pts[2][1] - pts[1][1]) / 2,
        );
        g.stroke();
      }
      g.restore();
    }
    // 中段の目印（左右の小さな三角）
    g.fillStyle = "#ffcc33";
    const tri = gap * 0.7;
    g.beginPath();
    g.moveTo(0, midY - tri);
    g.lineTo(tri, midY);
    g.lineTo(0, midY + tri);
    g.fill();
    g.beginPath();
    g.moveTo(W, midY - tri);
    g.lineTo(W - tri, midY);
    g.lineTo(W, midY + tri);
    g.fill();
    if (opts.flash) {
      g.fillStyle = `rgba(255,255,255,${opts.flash * 0.6})`;
      g.fillRect(0, 0, W, H);
    }
  }
}

// リール配列の表（21 番が上・1 番が下）。窓に見えている 3 コマを枠で囲み、回転に合わせて枠を動かす。
// 図柄は下へ流れるので、回るほど見えている番号が増えて枠は上へ進む（21 番の上は 1 番につながる）
export class ArrayRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.symbols = {};
    this.layout = null;
    this.base = null;
  }

  setSymbols(images) {
    this.symbols = images;
    this.base = null;
  }

  resize() {
    const cssW = this.canvas.clientWidth;
    if (!cssW) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const W = Math.round(cssW * dpr);
    const pad = Math.round(4 * dpr);
    const numW = Math.round(W * 0.15);
    const gap = Math.round(3 * dpr);
    const colW = Math.floor((W - numW - pad - gap * 3) / 3);
    const rowH = Math.round(colW / 2);
    const H = rowH * FRAMES + pad * 2;
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.style.height = `${H / dpr}px`;
    this.layout = { W, H, pad, numW, gap, colW, rowH, dpr };
    this.base = null;
    return true;
  }

  colX(r) {
    const { numW, gap, colW } = this.layout;
    return numW + gap + r * (colW + gap);
  }

  // 番号 i（0 始まり）の行の上端
  rowY(i) {
    const { pad, rowH } = this.layout;
    return pad + (FRAMES - 1 - i) * rowH;
  }

  // 番号と図柄の表は変わらないので 1 回だけ描いておく
  buildBase() {
    const { W, H, numW, colW, rowH, dpr } = this.layout;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "#0b0b12";
    g.fillRect(0, 0, W, H);
    g.font = `700 ${Math.round(rowH * 0.5)}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let i = 0; i < FRAMES; i++) {
      const y = this.rowY(i);
      g.fillStyle = "#9a9ab0";
      g.fillText(String(i + 1), numW / 2, y + rowH / 2);
      for (let r = 0; r < 3; r++) {
        const x = this.colX(r);
        g.fillStyle = i % 2 ? "#f6eef3" : "#fffafd";
        g.fillRect(x, y, colW, rowH);
        const sym = REELS[r][i];
        const img = this.symbols[sym];
        if (img)
          g.drawImage(
            img,
            x + colW * 0.04,
            y + rowH * 0.04,
            colW * 0.92,
            rowH * 0.92,
          );
        else {
          g.fillStyle = "#222";
          g.fillText(FALLBACK_TEXT[sym] || sym, x + colW / 2, y + rowH / 2);
        }
      }
    }
    g.strokeStyle = "rgba(0,0,0,0.12)";
    g.lineWidth = Math.max(1, dpr * 0.5);
    for (let i = 1; i < FRAMES; i++) {
      const y = this.rowY(i) + rowH;
      g.beginPath();
      g.moveTo(this.colX(0), y);
      g.lineTo(this.colX(2) + colW, y);
      g.stroke();
    }
    this.base = c;
  }

  // positions: 各リールの回転位置（ReelRenderer.draw と同じ値）
  draw(positions) {
    if (!this.layout && !this.resize()) return;
    if (!this.base) this.buildBase();
    const { W, H, pad, colW, rowH, dpr } = this.layout;
    const g = this.ctx;
    g.clearRect(0, 0, W, H);
    g.drawImage(this.base, 0, 0);
    const total = rowH * FRAMES;
    for (let r = 0; r < 3; r++) {
      const p = ((positions[r] % FRAMES) + FRAMES) % FRAMES;
      // 窓は p-1〜p+1 番。上端は p+1 番の行の上端
      const top = pad + (FRAMES - 2 - p) * rowH;
      const x = this.colX(r);
      g.save();
      g.beginPath();
      g.rect(x - 4 * dpr, pad, colW + 8 * dpr, total);
      g.clip();
      // 表の上下をまたぐときは反対側にも描く
      for (const off of [-total, 0, total]) {
        const y = top + off;
        if (y + rowH * 3 < pad || y > pad + total) continue;
        g.fillStyle = "rgba(255,204,51,0.22)";
        g.fillRect(x, y + rowH, colW, rowH);
        g.strokeStyle = "#ffcc33";
        g.lineWidth = Math.max(2, 2 * dpr);
        g.strokeRect(
          x + g.lineWidth / 2,
          y + g.lineWidth / 2,
          colW - g.lineWidth,
          rowH * 3 - g.lineWidth,
        );
        // 金の枠の外側を黒の細い線（0.5px）で囲む
        const bw = 0.5 * dpr;
        g.strokeStyle = "#000";
        g.lineWidth = bw;
        g.strokeRect(x - bw / 2, y - bw / 2, colW + bw, rowH * 3 + bw);
      }
      g.restore();
    }
  }
}
