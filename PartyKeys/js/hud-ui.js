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
    this._resize();
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = r.width * dpr;
    this.canvas.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(active) {
    const ctx = this.ctx;
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);

    const { min, max } = getRange();
    const WHITE_MODS = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
    const BLACK_MODS = [1, 3, 6, 8, 10];
    // 每个黑键挂在哪两个白键之间（左白键的 mod12）
    const BLACK_LEFT = { 1: 0, 3: 2, 6: 5, 8: 7, 10: 9 };

    const whiteNotes = [];
    const blackNotes = [];
    for (let n = min; n <= max; n++) {
      const m = n % 12;
      if (WHITE_MODS.includes(m)) whiteNotes.push(n);
      if (BLACK_MODS.includes(m)) blackNotes.push(n);
    }
    const whiteCount = whiteNotes.length; // 8 (C..C inclusive)
    const kw = W / whiteCount;
    const kh = H;

    // --- 白键 ---
    for (let i = 0; i < whiteCount; i++) {
      const note = whiteNotes[i];
      const x = i * kw;
      const isActive = active.has(note);
      roundedRect(ctx, x + 2, 4, kw - 4, kh - 8, 6);
      if (isActive) {
        const grad = ctx.createLinearGradient(0, 4, 0, kh);
        grad.addColorStop(0, "#fce7f3");
        grad.addColorStop(1, "#f472b6");
        ctx.fillStyle = grad;
        ctx.shadowColor = "rgba(244, 114, 182, 0.8)";
        ctx.shadowBlur = 20;
      } else {
        const grad = ctx.createLinearGradient(0, 4, 0, kh);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(1, "#d1d5e8");
        ctx.fillStyle = grad;
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // 首尾 C 标音名，按下也标
      const isC = note % 12 === 0;
      const showLabel = isC || isActive;
      if (showLabel) {
        ctx.fillStyle = isActive ? "#0a0b1e" : "rgba(10, 11, 30, 0.55)";
        ctx.font = "600 10px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(noteToName(note), x + kw / 2, kh - 8);
      }
    }

    // --- 黑键 ---
    const blackW = kw * 0.6;
    const blackH = kh * 0.62;
    for (const note of blackNotes) {
      const m = note % 12;
      const leftMod = BLACK_LEFT[m];
      const leftWhite = whiteNotes.findIndex(
        (n) => n % 12 === leftMod && n === note - 1
      );
      if (leftWhite < 0) continue;
      const x = (leftWhite + 1) * kw - blackW / 2;
      const isActive = active.has(note);

      roundedRect(ctx, x, 4, blackW, blackH, 4);
      if (isActive) {
        const grad = ctx.createLinearGradient(0, 4, 0, blackH + 4);
        grad.addColorStop(0, "#a78bfa");
        grad.addColorStop(1, "#f472b6");
        ctx.fillStyle = grad;
        ctx.shadowColor = "rgba(244, 114, 182, 0.9)";
        ctx.shadowBlur = 18;
      } else {
        const grad = ctx.createLinearGradient(0, 4, 0, blackH + 4);
        grad.addColorStop(0, "#2a2f52");
        grad.addColorStop(1, "#0a0c22");
        ctx.fillStyle = grad;
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
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
