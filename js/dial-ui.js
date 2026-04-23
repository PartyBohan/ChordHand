// =============================================================
// dial-ui.js — 中央控制盘渲染 (v6: 性能优化版)
//   - 外环 6 区: add9 / maj7 / sus4 / dim / min7 / dom7
//   - 中心 2 区: 上半 Major / 下半 minor
//   - 静态层（扇形边框 + 标签 + 中心描边）画到离屏 canvas，永远不重画
//   - 每帧只画"动态层"：选中高亮 + cursor
// =============================================================

import { QUADRANT } from "./mode-machine.js";

const OUTER_ZONES = [
  { q: QUADRANT.ADD9, deg: 30,  label: "Add9", sub: "明亮·九度" },
  { q: QUADRANT.MAJ7, deg: 90,  label: "Maj7", sub: "温暖·大七" },
  { q: QUADRANT.SUS4, deg: 150, label: "sus4", sub: "悬浮·四度" },
  { q: QUADRANT.DIM,  deg: 210, label: "dim",  sub: "紧张·减七" },
  { q: QUADRANT.MIN7, deg: 270, label: "m7",   sub: "温柔·小七" },
  { q: QUADRANT.DOM7, deg: 330, label: "7",    sub: "蓝调·属七" },
];

export class ChordDial {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this._w = 0;
    this._h = 0;
    this._dpr = 0;
    // 离屏缓存画布（静态层）
    this._staticCanvas = document.createElement("canvas");
    this._staticCtx = this._staticCanvas.getContext("2d");
    this._staticValid = false;

    // 上次绘制参数缓存（dirty check）
    this._lastQ = null;
    this._lastPX = -999;
    this._lastPY = -999;
    this._lastFlash = 0;
    this._lastActive = false;

    this._syncSize();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => this._syncSize());
      ro.observe(canvas);
    }
    window.addEventListener("resize", () => this._syncSize());
  }

  _syncSize() {
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
    // 离屏也一起重建
    this._staticCanvas.width = r.width * dpr;
    this._staticCanvas.height = r.height * dpr;
    this._staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._staticValid = false;
  }

  /** 静态层：扇形边框 + 分界线 + 标签 + 中心描边 + 背景光晕 */
  _drawStatic() {
    const ctx = this._staticCtx;
    const w = this._w, h = this._h;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.48;
    const centerR = R * 0.50;

    // 背景光晕
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    bgGrad.addColorStop(0, "rgba(56, 189, 248, 0.06)");
    bgGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 14, 0, Math.PI * 2);
    ctx.fill();

    // 外圈
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // 6 扇区底色（未选中）
    for (const zone of OUTER_ZONES) {
      const a0 = (-(zone.deg + 30) * Math.PI) / 180;
      const a1 = (-(zone.deg - 30) * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(cx, cy, R, Math.min(a0, a1), Math.max(a0, a1), false);
      ctx.arc(cx, cy, centerR, Math.max(a0, a1), Math.min(a0, a1), true);
      ctx.closePath();
      ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
      ctx.fill();
    }

    // 分界线
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    for (const d of [0, 60, 120, 180, 240, 300]) {
      const a = (-d * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * centerR, cy + Math.sin(a) * centerR);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 6 个外环标签（未选中状态）
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const zone of OUTER_ZONES) {
      const ang = (-zone.deg * Math.PI) / 180;
      const rLabel = (R + centerR) / 2;
      const tx = cx + Math.cos(ang) * rLabel;
      const ty = cy + Math.sin(ang) * rLabel;
      ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
      ctx.font = "700 18px -apple-system, sans-serif";
      ctx.fillText(zone.label, tx, ty - 5);
      ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
      ctx.font = "500 10px -apple-system, sans-serif";
      ctx.fillText(zone.sub, tx, ty + 11);
    }

    // 中心圆描边 + 水平分割线
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(cx - centerR, cy);
    ctx.lineTo(cx + centerR, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // 中心"Major / minor"文字（未选中基础状态）
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "800 34px -apple-system, sans-serif";
    ctx.fillText("Major", cx, cy - centerR * 0.48);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "500 11px -apple-system, sans-serif";
    ctx.fillText("大三和弦", cx, cy - centerR * 0.2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "800 34px -apple-system, sans-serif";
    ctx.fillText("minor", cx, cy + centerR * 0.28);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "500 11px -apple-system, sans-serif";
    ctx.fillText("小三和弦", cx, cy + centerR * 0.56);

    this._staticValid = true;
  }

  draw(state, triggerFlash = 0) {
    if (!this._w) this._syncSize();
    if (!this._w) return;

    // Dirty check：quadrant/padX/padY/flash/padActive 都没变 → 直接跳过
    const dx = state.padX - this._lastPX;
    const dy = state.padY - this._lastPY;
    const flashDiff = Math.abs(triggerFlash - this._lastFlash);
    const posMoved = dx * dx + dy * dy > 0.00001; // 约 0.3% 变化
    if (
      state.quadrant === this._lastQ &&
      !posMoved &&
      flashDiff < 0.01 &&
      state.padActive === this._lastActive
    ) {
      return;
    }
    this._lastQ = state.quadrant;
    this._lastPX = state.padX;
    this._lastPY = state.padY;
    this._lastFlash = triggerFlash;
    this._lastActive = state.padActive;

    const ctx = this.ctx;
    const w = this._w, h = this._h;
    ctx.clearRect(0, 0, w, h);

    // === 1. 画静态层（缓存） ===
    if (!this._staticValid) this._drawStatic();
    ctx.drawImage(this._staticCanvas, 0, 0, w, h);

    // === 2. 动态层：选中区高亮 + 中心填充 + 光标 ===
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.48;
    const centerR = R * 0.50;

    // 选中的外环扇形
    for (const zone of OUTER_ZONES) {
      if (state.quadrant !== zone.q) continue;
      const a0 = (-(zone.deg + 30) * Math.PI) / 180;
      const a1 = (-(zone.deg - 30) * Math.PI) / 180;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, Math.min(a0, a1), Math.max(a0, a1), false);
      ctx.arc(cx, cy, centerR, Math.max(a0, a1), Math.min(a0, a1), true);
      ctx.closePath();
      const grad = ctx.createRadialGradient(cx, cy, centerR, cx, cy, R);
      grad.addColorStop(0, "rgba(244, 114, 182, 0.55)");
      grad.addColorStop(1, "rgba(167, 139, 250, 0.08)");
      ctx.fillStyle = grad;
      // shadowBlur 只在 flash 时使用
      if (triggerFlash > 0.05) {
        ctx.shadowColor = "rgba(244, 114, 182, 0.75)";
        ctx.shadowBlur = 12 + triggerFlash * 24;
      }
      ctx.fill();
      // 选中的 label 放大 + 变白
      const ang = (-zone.deg * Math.PI) / 180;
      const rLabel = (R + centerR) / 2;
      const tx = cx + Math.cos(ang) * rLabel;
      const ty = cy + Math.sin(ang) * rLabel;
      ctx.shadowBlur = 0;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.font = "700 22px -apple-system, sans-serif";
      ctx.fillText(zone.label, tx, ty - 5);
      ctx.fillStyle = "rgba(244, 114, 182, 0.95)";
      ctx.font = "500 10px -apple-system, sans-serif";
      ctx.fillText(zone.sub, tx, ty + 11);
      ctx.restore();
    }

    // 中心上下半圆（无论选中与否都画 —— 背景色是静态层的字，需要覆盖渐变）
    const upSel = state.quadrant === QUADRANT.CENTER_UP;
    const dnSel = state.quadrant === QUADRANT.CENTER_DOWN;

    // 上半（Major）
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, Math.PI, true);
    ctx.closePath();
    const upGrad = ctx.createRadialGradient(cx, cy - centerR * 0.3, 0, cx, cy, centerR);
    if (upSel) {
      upGrad.addColorStop(0, "rgba(56, 189, 248, 0.7)");
      upGrad.addColorStop(1, "rgba(34, 211, 238, 0.15)");
      if (triggerFlash > 0.05) {
        ctx.shadowColor = "rgba(56, 189, 248, 0.8)";
        ctx.shadowBlur = 14 + triggerFlash * 24;
      }
    } else {
      upGrad.addColorStop(0, "rgba(40, 48, 100, 0.85)");
      upGrad.addColorStop(1, "rgba(24, 30, 70, 0.55)");
    }
    ctx.fillStyle = upGrad;
    ctx.fill();
    ctx.restore();

    // 下半（minor）
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, Math.PI, false);
    ctx.closePath();
    const dnGrad = ctx.createRadialGradient(cx, cy + centerR * 0.3, 0, cx, cy, centerR);
    if (dnSel) {
      dnGrad.addColorStop(0, "rgba(167, 139, 250, 0.75)");
      dnGrad.addColorStop(1, "rgba(139, 92, 246, 0.15)");
      if (triggerFlash > 0.05) {
        ctx.shadowColor = "rgba(167, 139, 250, 0.8)";
        ctx.shadowBlur = 14 + triggerFlash * 24;
      }
    } else {
      dnGrad.addColorStop(0, "rgba(35, 30, 75, 0.9)");
      dnGrad.addColorStop(1, "rgba(20, 18, 50, 0.6)");
    }
    ctx.fillStyle = dnGrad;
    ctx.fill();
    ctx.restore();

    // 中心文字（盖在渐变上）
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = upSel ? "#fff" : "rgba(255, 255, 255, 0.85)";
    ctx.font = `800 ${upSel ? 38 : 34}px -apple-system, sans-serif`;
    ctx.fillText("Major", cx, cy - centerR * 0.48);
    ctx.fillStyle = upSel ? "rgba(56, 189, 248, 0.95)" : "rgba(255, 255, 255, 0.5)";
    ctx.font = "500 11px -apple-system, sans-serif";
    ctx.fillText("大三和弦", cx, cy - centerR * 0.2);

    ctx.fillStyle = dnSel ? "#fff" : "rgba(255, 255, 255, 0.85)";
    ctx.font = `800 ${dnSel ? 38 : 34}px -apple-system, sans-serif`;
    ctx.fillText("minor", cx, cy + centerR * 0.28);
    ctx.fillStyle = dnSel ? "rgba(167, 139, 250, 0.95)" : "rgba(255, 255, 255, 0.5)";
    ctx.font = "500 11px -apple-system, sans-serif";
    ctx.fillText("小三和弦", cx, cy + centerR * 0.56);

    // 光标（手的位置）
    if (state.padActive) {
      drawCursor(
        ctx,
        cx + state.padX * R * 0.88,
        cy - state.padY * R * 0.88,
        "#38bdf8"
      );
    }
  }
}

function drawCursor(ctx, px, py, color) {
  ctx.save();
  const grad = ctx.createRadialGradient(px, py, 0, px, py, 24);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(px, py, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const DialUI = ChordDial;
