// =============================================================
// dial-ui.js — 中央控制盘渲染 (v5: 8 区 · 简化版)
//   - 外环 6 区: add9 / maj7 / sus4 / dim / min7 / dom7
//   - 中心 2 区: 上半 Major / 下半 minor（面积再扩大）
//   - 不再识别握拳 / 不再画红 X
// =============================================================

import { QUADRANT } from "./mode-machine.js";

/** 外环 6 区 —— deg 用"数学角度"(0=右,90=上)，显示时取负转 canvas */
const OUTER_ZONES = [
  { q: QUADRANT.ADD9, deg: 30,  label: "Add9", sub: "明亮·九度" },
  { q: QUADRANT.MAJ7, deg: 90,  label: "Maj7", sub: "温暖·大七" },
  { q: QUADRANT.SUS4, deg: 150, label: "sus4", sub: "悬浮·四度" },
  { q: QUADRANT.DIM,  deg: 210, label: "dim",  sub: "紧张·减七" },
  { q: QUADRANT.MIN7, deg: 270, label: "m7",   sub: "温柔·小七" },
  { q: QUADRANT.DOM7, deg: 330, label: "7",    sub: "蓝调·属七" },
];

function setupCanvas(canvas) {
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = r.width * dpr;
  canvas.height = r.height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height };
}

export class ChordDial {
  constructor(canvas) {
    this.canvas = canvas;
  }

  draw(state, triggerFlash = 0) {
    const { ctx, w, h } = setupCanvas(this.canvas);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.45;
    const centerR = R * 0.62; // 中心区再扩大（原 0.48）

    // 背景光晕
    ctx.save();
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    bgGrad.addColorStop(0, "rgba(56, 189, 248, 0.06)");
    bgGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 外圈描边
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // === 6 个外环扇形（甜甜圈扇区） ===
    for (const zone of OUTER_ZONES) {
      const selected = state.quadrant === zone.q;
      const a0 = (-(zone.deg + 30) * Math.PI) / 180;
      const a1 = (-(zone.deg - 30) * Math.PI) / 180;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, Math.min(a0, a1), Math.max(a0, a1), false);
      ctx.arc(cx, cy, centerR, Math.max(a0, a1), Math.min(a0, a1), true);
      ctx.closePath();
      if (selected) {
        const grad = ctx.createRadialGradient(cx, cy, centerR, cx, cy, R);
        grad.addColorStop(0, "rgba(244, 114, 182, 0.55)");
        grad.addColorStop(1, "rgba(167, 139, 250, 0.08)");
        ctx.fillStyle = grad;
        ctx.shadowColor = "rgba(244, 114, 182, 0.8)";
        ctx.shadowBlur = 24 + triggerFlash * 40;
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
      }
      ctx.fill();
      ctx.restore();
    }

    // 6 条分界线
    ctx.save();
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
    ctx.restore();

    // 外环标签
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const zone of OUTER_ZONES) {
      const selected = state.quadrant === zone.q;
      const ang = (-zone.deg * Math.PI) / 180;
      const rLabel = (R + centerR) / 2;
      const tx = cx + Math.cos(ang) * rLabel;
      const ty = cy + Math.sin(ang) * rLabel;
      ctx.fillStyle = selected ? "#fff" : "rgba(255, 255, 255, 0.78)";
      ctx.font = `700 ${selected ? 22 : 18}px -apple-system, sans-serif`;
      ctx.fillText(zone.label, tx, ty - 5);
      ctx.fillStyle = selected
        ? "rgba(244, 114, 182, 0.95)"
        : "rgba(255, 255, 255, 0.42)";
      ctx.font = "500 10px -apple-system, sans-serif";
      ctx.fillText(zone.sub, tx, ty + 11);
    }
    ctx.restore();

    // === 中心大区：上 Major / 下 minor ===
    const upSel = state.quadrant === QUADRANT.CENTER_UP;
    const dnSel = state.quadrant === QUADRANT.CENTER_DOWN;

    // 上半
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, Math.PI, true);
    ctx.closePath();
    const upGrad = ctx.createRadialGradient(cx, cy - centerR * 0.3, 0, cx, cy, centerR);
    if (upSel) {
      upGrad.addColorStop(0, "rgba(56, 189, 248, 0.7)");
      upGrad.addColorStop(1, "rgba(34, 211, 238, 0.15)");
      ctx.shadowColor = "rgba(56, 189, 248, 0.85)";
      ctx.shadowBlur = 28 + triggerFlash * 40;
    } else {
      upGrad.addColorStop(0, "rgba(40, 48, 100, 0.85)");
      upGrad.addColorStop(1, "rgba(24, 30, 70, 0.55)");
    }
    ctx.fillStyle = upGrad;
    ctx.fill();
    ctx.restore();

    // 下半
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, Math.PI, false);
    ctx.closePath();
    const dnGrad = ctx.createRadialGradient(cx, cy + centerR * 0.3, 0, cx, cy, centerR);
    if (dnSel) {
      dnGrad.addColorStop(0, "rgba(167, 139, 250, 0.75)");
      dnGrad.addColorStop(1, "rgba(139, 92, 246, 0.15)");
      ctx.shadowColor = "rgba(167, 139, 250, 0.85)";
      ctx.shadowBlur = 28 + triggerFlash * 40;
    } else {
      dnGrad.addColorStop(0, "rgba(35, 30, 75, 0.9)");
      dnGrad.addColorStop(1, "rgba(20, 18, 50, 0.6)");
    }
    ctx.fillStyle = dnGrad;
    ctx.fill();
    ctx.restore();

    // 中心描边 + 横分隔线
    ctx.save();
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
    ctx.restore();

    // 中心文字
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = upSel ? "#fff" : "rgba(255, 255, 255, 0.85)";
    ctx.font = `800 ${upSel ? 38 : 34}px -apple-system, sans-serif`;
    ctx.fillText("Major", cx, cy - centerR * 0.48);
    ctx.fillStyle = upSel
      ? "rgba(56, 189, 248, 0.95)"
      : "rgba(255, 255, 255, 0.5)";
    ctx.font = "500 11px -apple-system, sans-serif";
    ctx.fillText("大三和弦", cx, cy - centerR * 0.2);

    ctx.fillStyle = dnSel ? "#fff" : "rgba(255, 255, 255, 0.85)";
    ctx.font = `800 ${dnSel ? 38 : 34}px -apple-system, sans-serif`;
    ctx.fillText("minor", cx, cy + centerR * 0.28);
    ctx.fillStyle = dnSel
      ? "rgba(167, 139, 250, 0.95)"
      : "rgba(255, 255, 255, 0.5)";
    ctx.font = "500 11px -apple-system, sans-serif";
    ctx.fillText("小三和弦", cx, cy + centerR * 0.56);
    ctx.restore();

    // 控制点（手的位置）—— 只要 pad 激活就画，永远蓝色
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
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  const grad = ctx.createRadialGradient(px, py, 0, px, py, 24);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(px, py, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function hexToRgba(hex, a) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

export const DialUI = ChordDial;
