// =============================================================
// dial-ui.js — 中央控制盘渲染 (v7: 和弦 / 情绪 双标签模式)
//   - 默认 "emotion" 模式：外环 6 区显示情绪词 + 情绪色
//   - "chord" 模式：显示和弦名 Add9/Maj7/... 用中性色
//   - 中心 Major / minor 永不改变
//   - 静态层用离屏 canvas 缓存，每帧只画选中高亮 + 光标
// =============================================================

import { QUADRANT } from "./mode-machine.js";
import { t } from "./i18n.js";

// ——— 外环 6 区：chord 名 + emotion 名 + 该情绪的基础色相 ———
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
    this._labelMode = "emotion"; // "emotion" | "chord"

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

  /** 设置外环标签模式 "emotion" | "chord" */
  setLabelMode(mode) {
    if (mode !== "emotion" && mode !== "chord") return;
    if (mode === this._labelMode) return;
    this._labelMode = mode;
    this.invalidate();
  }

  /** 语言切换或模式切换时调用，强制重画静态层和一切 */
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

    // 6 扇区底色：情绪模式用情绪色，和弦模式用中性白
    for (const zone of OUTER_ZONES) {
      const a0 = (-(zone.deg + 30) * Math.PI) / 180;
      const a1 = (-(zone.deg - 30) * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(cx, cy, R, Math.min(a0, a1), Math.max(a0, a1), false);
      ctx.arc(cx, cy, centerR, Math.max(a0, a1), Math.min(a0, a1), true);
      ctx.closePath();
      if (emotion) {
        // 情绪色径向渐变（中心深 → 外圈淡）
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

    // 6 个外环标签（未选中状态）
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const zone of OUTER_ZONES) {
      const ang = (-zone.deg * Math.PI) / 180;
      const rLabel = (R + centerR) / 2;
      const tx = cx + Math.cos(ang) * rLabel;
      const ty = cy + Math.sin(ang) * rLabel;
      // 主标签
      const mainText = emotion ? t(zone.emoKey) : zone.chord;
      const subText  = emotion ? zone.chord       : t(zone.subKey);
      if (emotion) {
        ctx.fillStyle = `hsla(${zone.hue}, 90%, 78%, 0.95)`;
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
      }
      ctx.font = "700 18px -apple-system, sans-serif";
      ctx.fillText(mainText, tx, ty - 5);
      // 副标签
      ctx.fillStyle = emotion
        ? "rgba(255, 255, 255, 0.45)"
        : "rgba(255, 255, 255, 0.42)";
      ctx.font = "500 10px -apple-system, sans-serif";
      ctx.fillText(subText, tx, ty + 11);
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

    // 中心 Major / minor（永不改变）
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
      if (emotion) {
        grad.addColorStop(0, `hsla(${zone.hue}, 92%, 65%, 0.8)`);
        grad.addColorStop(1, `hsla(${zone.hue}, 85%, 50%, 0.15)`);
        if (triggerFlash > 0.05) {
          ctx.shadowColor = `hsla(${zone.hue}, 92%, 60%, 0.85)`;
          ctx.shadowBlur = 14 + triggerFlash * 24;
        }
      } else {
        grad.addColorStop(0, "rgba(244, 114, 182, 0.55)");
        grad.addColorStop(1, "rgba(167, 139, 250, 0.08)");
        if (triggerFlash > 0.05) {
          ctx.shadowColor = "rgba(244, 114, 182, 0.75)";
          ctx.shadowBlur = 12 + triggerFlash * 24;
        }
      }
      ctx.fillStyle = grad;
      ctx.fill();
      // 选中的 label 放大 + 更亮
      const ang = (-zone.deg * Math.PI) / 180;
      const rLabel = (R + centerR) / 2;
      const tx = cx + Math.cos(ang) * rLabel;
      const ty = cy + Math.sin(ang) * rLabel;
      ctx.shadowBlur = 0;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.font = "700 22px -apple-system, sans-serif";
      ctx.fillText(emotion ? t(zone.emoKey) : zone.chord, tx, ty - 5);
      ctx.fillStyle = emotion
        ? `hsla(${zone.hue}, 95%, 80%, 0.95)`
        : "rgba(244, 114, 182, 0.95)";
      ctx.font = "500 10px -apple-system, sans-serif";
      ctx.fillText(emotion ? zone.chord : t(zone.subKey), tx, ty + 11);
      ctx.restore();
    }

    // 中心上下半（覆盖静态层文字以应用选中 highlight）
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

    // 中心文字 —— 永远是 Major / minor 不受标签模式影响
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

    // 光标
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
