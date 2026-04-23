// =============================================================
// dial-ui.js — 中央控制盘 (v8)
//   - 外环标签全部画在动态层（消除选中时的"双字/重影"）
//   - 选中时文字放大保持清晰（用 font-size 直接变，不用 scale/blur）
//   - 中心 Major/minor：英文只显示 "Major"/"minor"；中文显示"大三和弦"+副标 Major
//   - 副标字号加大（10px → 13px）
// =============================================================

import { QUADRANT } from "./mode-machine.js";
import { t, getLang } from "./i18n.js";

const OUTER_ZONES = [
  { q: QUADRANT.ADD9, deg: 30,  chord: "Add9", subKey: "chord_sub_add9", emoKey: "emotion_add9", hue: 45  },
  { q: QUADRANT.MAJ7, deg: 90,  chord: "Maj7", subKey: "chord_sub_maj7", emoKey: "emotion_maj7", hue: 28  },
  { q: QUADRANT.SUS4, deg: 150, chord: "sus4", subKey: "chord_sub_sus4", emoKey: "emotion_sus4", hue: 200 },
  { q: QUADRANT.DIM,  deg: 210, chord: "dim",  subKey: "chord_sub_dim",  emoKey: "emotion_dim",  hue: 0   },
  { q: QUADRANT.MIN7, deg: 270, chord: "m7",   subKey: "chord_sub_min7", emoKey: "emotion_min7", hue: 230 },
  { q: QUADRANT.DOM7, deg: 330, chord: "7",    subKey: "chord_sub_dom7", emoKey: "emotion_dom7", hue: 280 },
];

export class ChordDial {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this._w = 0;
    this._h = 0;
    this._dpr = 0;
    this._staticCanvas = document.createElement("canvas");
    this._staticCtx = this._staticCanvas.getContext("2d");
    this._staticValid = false;
    this._labelMode = "emotion";

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

  setLabelMode(mode) {
    if (mode !== "emotion" && mode !== "chord") return;
    if (mode === this._labelMode) return;
    this._labelMode = mode;
    this.invalidate();
  }

  invalidate() {
    this._staticValid = false;
    this._lastQ = null;
    this._lastPX = -999;
    this._lastPY = -999;
    this._lastActive = false;
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
    this._staticCanvas.width = r.width * dpr;
    this._staticCanvas.height = r.height * dpr;
    this._staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._staticValid = false;
  }

  /** 静态层：只画不变的几何 + 底色，不画任何标签（标签放到动态层，消除"放大时底下还残留一份小字"的重影） */
  _drawStatic() {
    const ctx = this._staticCtx;
    const w = this._w, h = this._h;
    const emotion = this._labelMode === "emotion";
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

    // 外圈描边
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // 6 扇区底色
    for (const zone of OUTER_ZONES) {
      const a0 = (-(zone.deg + 30) * Math.PI) / 180;
      const a1 = (-(zone.deg - 30) * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(cx, cy, R, Math.min(a0, a1), Math.max(a0, a1), false);
      ctx.arc(cx, cy, centerR, Math.max(a0, a1), Math.min(a0, a1), true);
      ctx.closePath();
      if (emotion) {
        const g = ctx.createRadialGradient(cx, cy, centerR, cx, cy, R);
        g.addColorStop(0, `hsla(${zone.hue}, 85%, 55%, 0.32)`);
        g.addColorStop(1, `hsla(${zone.hue}, 75%, 45%, 0.12)`);
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
      }
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

    this._staticValid = true;
  }

  draw(state, triggerFlash = 0) {
    if (!this._w) this._syncSize();
    if (!this._w) return;

    const dx = state.padX - this._lastPX;
    const dy = state.padY - this._lastPY;
    const flashDiff = Math.abs(triggerFlash - this._lastFlash);
    const posMoved = dx * dx + dy * dy > 0.00001;
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
    const emotion = this._labelMode === "emotion";
    ctx.clearRect(0, 0, w, h);

    if (!this._staticValid) this._drawStatic();
    ctx.drawImage(this._staticCanvas, 0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.48;
    const centerR = R * 0.50;

    // === 1. 选中外环扇形的 highlight 渐变（无 shadowBlur，避免重影）===
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
      if (emotion) {
        grad.addColorStop(0, `hsla(${zone.hue}, 92%, 62%, 0.82)`);
        grad.addColorStop(1, `hsla(${zone.hue}, 85%, 48%, 0.18)`);
      } else {
        grad.addColorStop(0, "rgba(244, 114, 182, 0.6)");
        grad.addColorStop(1, "rgba(167, 139, 250, 0.08)");
      }
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    // === 2. 所有 6 个外环标签（统一在动态层画 —— 不会和静态重影）===
    //     选中的用更大 + 纯白，非选中用默认；副标字号全部加大
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const zone of OUTER_ZONES) {
      const isSel = state.quadrant === zone.q;
      const ang = (-zone.deg * Math.PI) / 180;
      const rLabel = (R + centerR) / 2;
      const tx = cx + Math.cos(ang) * rLabel;
      const ty = cy + Math.sin(ang) * rLabel;

      const mainText = emotion ? t(zone.emoKey) : zone.chord;
      const subText  = emotion ? zone.chord       : t(zone.subKey);

      // 主标签
      if (isSel) {
        // 放大到 28px + 纯白，清晰锐利
        ctx.fillStyle = "#fff";
        ctx.font = "800 28px -apple-system, sans-serif";
      } else if (emotion) {
        ctx.fillStyle = `hsla(${zone.hue}, 90%, 78%, 0.95)`;
        ctx.font = "700 20px -apple-system, sans-serif";
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
        ctx.font = "700 20px -apple-system, sans-serif";
      }
      ctx.fillText(mainText, tx, ty - 8);

      // 副标签 —— 字号从 10px 加到 13px
      if (isSel) {
        ctx.fillStyle = emotion
          ? `hsla(${zone.hue}, 95%, 85%, 0.95)`
          : "rgba(244, 114, 182, 0.95)";
        ctx.font = "600 14px -apple-system, sans-serif";
      } else {
        ctx.fillStyle = emotion
          ? "rgba(255, 255, 255, 0.55)"
          : "rgba(255, 255, 255, 0.55)";
        ctx.font = "500 13px -apple-system, sans-serif";
      }
      ctx.fillText(subText, tx, ty + 13);
    }

    // === 3. 中心上/下半圆（覆盖静态描边，支持选中高亮） ===
    const upSel = state.quadrant === QUADRANT.CENTER_UP;
    const dnSel = state.quadrant === QUADRANT.CENTER_DOWN;

    // 上半 Major
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, Math.PI, true);
    ctx.closePath();
    const upGrad = ctx.createRadialGradient(cx, cy - centerR * 0.3, 0, cx, cy, centerR);
    if (upSel) {
      upGrad.addColorStop(0, "rgba(56, 189, 248, 0.7)");
      upGrad.addColorStop(1, "rgba(34, 211, 238, 0.15)");
    } else {
      upGrad.addColorStop(0, "rgba(40, 48, 100, 0.85)");
      upGrad.addColorStop(1, "rgba(24, 30, 70, 0.55)");
    }
    ctx.fillStyle = upGrad;
    ctx.fill();
    ctx.restore();

    // 下半 minor
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, Math.PI, false);
    ctx.closePath();
    const dnGrad = ctx.createRadialGradient(cx, cy + centerR * 0.3, 0, cx, cy, centerR);
    if (dnSel) {
      dnGrad.addColorStop(0, "rgba(167, 139, 250, 0.75)");
      dnGrad.addColorStop(1, "rgba(139, 92, 246, 0.15)");
    } else {
      dnGrad.addColorStop(0, "rgba(35, 30, 75, 0.9)");
      dnGrad.addColorStop(1, "rgba(20, 18, 50, 0.6)");
    }
    ctx.fillStyle = dnGrad;
    ctx.fill();
    ctx.restore();

    // === 4. 中心文字 —— 语言感知 ===
    //   英文：只显示 "Major" / "minor"，无副标
    //   中文：主标 "大三和弦" / "小三和弦"，副标小字 "Major" / "minor"
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const isZh = getLang() === "zh";

    if (isZh) {
      // 上半
      ctx.fillStyle = upSel ? "#fff" : "rgba(255, 255, 255, 0.9)";
      ctx.font = `800 ${upSel ? 32 : 28}px -apple-system, sans-serif`;
      ctx.fillText("大三和弦", cx, cy - centerR * 0.4);
      ctx.fillStyle = upSel ? "rgba(56, 189, 248, 0.95)" : "rgba(255, 255, 255, 0.55)";
      ctx.font = "600 14px -apple-system, sans-serif";
      ctx.fillText("Major", cx, cy - centerR * 0.12);

      // 下半
      ctx.fillStyle = dnSel ? "#fff" : "rgba(255, 255, 255, 0.9)";
      ctx.font = `800 ${dnSel ? 32 : 28}px -apple-system, sans-serif`;
      ctx.fillText("小三和弦", cx, cy + centerR * 0.22);
      ctx.fillStyle = dnSel ? "rgba(167, 139, 250, 0.95)" : "rgba(255, 255, 255, 0.55)";
      ctx.font = "600 14px -apple-system, sans-serif";
      ctx.fillText("minor", cx, cy + centerR * 0.5);
    } else {
      // 只显示英文主标，放大占据中心
      ctx.fillStyle = upSel ? "#fff" : "rgba(255, 255, 255, 0.92)";
      ctx.font = `800 ${upSel ? 44 : 40}px -apple-system, sans-serif`;
      ctx.fillText("Major", cx, cy - centerR * 0.28);

      ctx.fillStyle = dnSel ? "#fff" : "rgba(255, 255, 255, 0.92)";
      ctx.font = `800 ${dnSel ? 44 : 40}px -apple-system, sans-serif`;
      ctx.fillText("minor", cx, cy + centerR * 0.32);
    }

    // === 5. 光标 ===
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
