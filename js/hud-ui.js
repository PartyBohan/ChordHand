// =============================================================
// hud-ui.js — 底部虚拟键盘 (v3: 13 音, 动态八度)
// SidePanel 已移除：控制项合并到顶栏
// =============================================================

import { getRange, noteToName } from "./midi-input.js";

// ============ 底部虚拟键盘 (8 白键 + 5 黑键 = 13 个音) ============
export class Keybed {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this._w = 0;
    this._h = 0;
    this._dpr = 0;
    this._resize();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => this._resize());
      ro.observe(canvas);
    }
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (!r.width || !r.height) return;
    if (r.width === this._w && r.height === this._h && dpr === this._dpr) return;
    this._w = r.width;
    this._h = r.height;
    this._dpr = dpr;
    this.canvas.width = r.width * dpr;
    this.canvas.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(active) {
    if (!this._w) this._resize();
    const ctx = this.ctx;
    const W = this._w;
    const H = this._h;
    if (!W) return;
    ctx.clearRect(0, 0, W, H);

    const { min, max } = getRange();
    const WHITE_MODS = [0, 2, 4, 5, 7, 9, 11];
    const BLACK_MODS = [1, 3, 6, 8, 10];
    const BLACK_LEFT = { 1: 0, 3: 2, 6: 5, 8: 7, 10: 9 };

    const whiteNotes = [];
    const blackNotes = [];
    for (let n = min; n <= max; n++) {
      const m = n % 12;
      if (WHITE_MODS.includes(m)) whiteNotes.push(n);
      if (BLACK_MODS.includes(m)) blackNotes.push(n);
    }
    const whiteCount = whiteNotes.length;
    const gap = 3;
    const kw = (W - gap * (whiteCount - 1)) / whiteCount;
    const kh = H;

    // --- 白键（对齐 hero 键盘：饱满矩形 + 底部彩虹高光条，active 变亮白） ---
    for (let i = 0; i < whiteCount; i++) {
      const note = whiteNotes[i];
      const x = i * (kw + gap);
      const isActive = active.has(note);
      // semitone 位置（相对第一个白键的 chromatic）
      const chroma = note - min; // 0..12
      const hue = (chroma * 30) % 360;

      roundedRect(ctx, x, 0, kw, kh, 6);
      // 基色 —— 白键渐变
      const grad = ctx.createLinearGradient(0, 0, 0, kh);
      if (isActive) {
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(1, `hsl(${hue}, 90%, 62%)`);
        ctx.shadowColor = `hsl(${hue}, 92%, 60%)`;
        ctx.shadowBlur = 22;
      } else {
        grad.addColorStop(0, "#f7f8ff");
        grad.addColorStop(0.7, "#dde0f0");
        grad.addColorStop(1, "#b9bfda");
      }
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.shadowBlur = 0;

      // 底部彩虹光带（静态，和 hero 键盘同色）
      if (!isActive) {
        ctx.save();
        roundedRect(ctx, x, kh - 10, kw, 8, 4);
        const glow = ctx.createLinearGradient(0, kh - 10, 0, kh - 2);
        glow.addColorStop(0, `hsla(${hue}, 92%, 60%, 0.3)`);
        glow.addColorStop(1, `hsla(${hue}, 92%, 55%, 0.75)`);
        ctx.fillStyle = glow;
        ctx.fill();
        ctx.restore();
      }

      // 边框
      ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
      ctx.lineWidth = 1;
      roundedRect(ctx, x, 0, kw, kh, 6);
      ctx.stroke();

      // 首尾 C 标音名，按下也标
      const isC = note % 12 === 0;
      if (isC || isActive) {
        ctx.fillStyle = isActive ? "#0a0b1e" : "rgba(10, 11, 30, 0.6)";
        ctx.font = "700 10px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(noteToName(note), x + kw / 2, kh - 14);
      }
    }

    // --- 黑键（深色同色相 + active 变亮） ---
    const blackW = kw * 0.62;
    const blackH = kh * 0.62;
    for (const note of blackNotes) {
      const m = note % 12;
      const leftMod = BLACK_LEFT[m];
      const leftWhite = whiteNotes.findIndex(
        (n) => n % 12 === leftMod && n === note - 1
      );
      if (leftWhite < 0) continue;
      const x = (leftWhite + 1) * (kw + gap) - gap / 2 - blackW / 2;
      const isActive = active.has(note);
      const chroma = note - min;
      const hue = (chroma * 30) % 360;

      roundedRect(ctx, x, 0, blackW, blackH, 4);
      const grad = ctx.createLinearGradient(0, 0, 0, blackH);
      if (isActive) {
        grad.addColorStop(0, `hsl(${hue}, 92%, 75%)`);
        grad.addColorStop(1, `hsl(${hue}, 92%, 55%)`);
        ctx.shadowColor = `hsl(${hue}, 92%, 55%)`;
        ctx.shadowBlur = 20;
      } else {
        grad.addColorStop(0, `hsl(${hue}, 55%, 22%)`);
        grad.addColorStop(1, `hsl(${hue}, 50%, 8%)`);
      }
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.shadowBlur = 0;

      // 底部同色微光
      if (!isActive) {
        ctx.save();
        roundedRect(ctx, x, blackH - 6, blackW, 4, 2);
        ctx.fillStyle = `hsla(${hue}, 92%, 50%, 0.55)`;
        ctx.fill();
        ctx.restore();
      }

      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      roundedRect(ctx, x, 0, blackW, blackH, 4);
      ctx.stroke();
    }
  }
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
