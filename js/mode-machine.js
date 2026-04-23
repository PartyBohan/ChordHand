// =============================================================
// mode-machine.js — 模式判定 + 位置派生 (v5: 简化版)
// ✱ 8 区：中心上=Major / 中心下=minor，外环 6 区 (add9,maj7,sus4,dim,min7,dom7)
// ✱ 不做手势（握拳/张开）识别 —— 抬起的手就是一颗球，球在哪区就是哪区
// =============================================================

/** 画面 Y 阈值 */
const Y_ON_KEYBOARD = 0.68;
const Y_RAISED = 0.58;

/** 手势作用区（屏幕归一化） */
let _padCenterX = 0.5;     // 可动态调整（左/中/右）
const PAD_CENTER_Y = 0.38;
const PAD_HALF_W = 0.22;
const PAD_HALF_H = 0.22;

/** 中心区半径（pad 内归一化距离 0..1）—— 缩小中心 = 外环更好瞄准 */
const CENTER_RADIUS = 0.45;

/** 位置预设 —— 对应屏幕上圆环的位置 */
export const PAD_POSITIONS = Object.freeze({
  left:   0.25,   // 画面左四分之一
  center: 0.50,
  right:  0.75,   // 画面右四分之一
});

/** 动态调整 pad 中心 X */
export function setPadCenterX(x) {
  _padCenterX = Math.max(0.1, Math.min(0.9, x));
  PAD_LAYOUT.CENTER_X = _padCenterX;
}

export const MODE = Object.freeze({
  IDLE: "idle",
  NORMAL: "normal",
  CHORD: "chord",
});

/** 8 个区域 */
export const QUADRANT = Object.freeze({
  CENTER_UP: "center_up",     // Major
  CENTER_DOWN: "center_down", // minor
  ADD9: "add9",   // 上右
  MAJ7: "maj7",   // 上
  SUS4: "sus4",   // 上左
  DIM:  "dim",    // 下左
  MIN7: "min7",   // 下
  DOM7: "dom7",   // 下右
});

export const QUADRANT_TO_CHORD = {
  center_up:   "major",
  center_down: "minor",
  add9: "add9",
  maj7: "maj7",
  sus4: "sus4",
  dim:  "dim",
  min7: "min7",
  dom7: "dom7",
};

/**
 * 外环 6 区 — 用"数学角度"（0°=右, 90°=上, 逆时针增加）
 * 每个扇区中心角 + 半宽 30°（共 60° × 6 = 360°）
 */
const OUTER_SECTORS = [
  { q: QUADRANT.ADD9, deg: 30 },
  { q: QUADRANT.MAJ7, deg: 90 },
  { q: QUADRANT.SUS4, deg: 150 },
  { q: QUADRANT.DIM,  deg: 210 },
  { q: QUADRANT.MIN7, deg: 270 },
  { q: QUADRANT.DOM7, deg: 330 },
];

export class ModeMachine extends EventTarget {
  constructor() {
    super();
    this.state = {
      mode: MODE.IDLE,
      gestureHand: null,
      playingHand: null,
      quadrant: null,
      padX: 0,
      padY: 0,
      padActive: false,
      volume: 0.85,
      chordDist: 0,
    };
    this._modeStableSince = 0;
    this._candidateMode = MODE.IDLE;
    this._gestureHandStable = null;
    this._debounceMs = 180;
  }

  update(hands, ts) {
    const s = this.state;
    const leftOnKb = hands.left && hands.left.palm.y > Y_ON_KEYBOARD;
    const rightOnKb = hands.right && hands.right.palm.y > Y_ON_KEYBOARD;
    const leftRaised = hands.left && hands.left.palm.y < Y_RAISED;
    const rightRaised = hands.right && hands.right.palm.y < Y_RAISED;

    let cand = MODE.IDLE;
    let gestureHand = null;

    if (leftOnKb && rightOnKb) {
      cand = MODE.NORMAL;
    } else if (leftOnKb && rightRaised) {
      cand = MODE.CHORD;
      gestureHand = "right";
    } else if (rightOnKb && leftRaised) {
      cand = MODE.CHORD;
      gestureHand = "left";
    } else if (rightRaised) {
      cand = MODE.CHORD;
      gestureHand = "right";
    } else if (leftRaised) {
      cand = MODE.CHORD;
      gestureHand = "left";
    }

    if (cand !== this._candidateMode || gestureHand !== this._gestureHandStable) {
      this._candidateMode = cand;
      this._gestureHandStable = gestureHand;
      this._modeStableSince = ts;
    }
    const stable = ts - this._modeStableSince >= this._debounceMs;
    if (stable && s.mode !== cand) {
      const prev = s.mode;
      s.mode = cand;
      this.dispatchEvent(
        new CustomEvent("modechange", { detail: { from: prev, to: cand } })
      );
    }

    if (s.mode === MODE.CHORD && gestureHand) {
      s.gestureHand = gestureHand;
      s.playingHand = gestureHand === "right" ? "left" : "right";
      this._derivePosition(hands[gestureHand]);
    } else {
      s.gestureHand = null;
      s.playingHand = null;
      s.quadrant = null;
      s.padActive = false;
    }

    this.dispatchEvent(new CustomEvent("update", { detail: s }));
  }

  _derivePosition(hand) {
    const s = this.state;
    if (!hand) {
      s.padActive = false;
      s.quadrant = null;
      return;
    }
    const rawX = (hand.palm.x - _padCenterX) / PAD_HALF_W;
    const rawY = -(hand.palm.y - PAD_CENTER_Y) / PAD_HALF_H;
    s.padX = Math.max(-1, Math.min(1, rawX));
    s.padY = Math.max(-1, Math.min(1, rawY));
    s.padActive = true;

    const dist = Math.min(1, Math.hypot(s.padX, s.padY));
    s.chordDist = dist;

    // 中心区：上半 = Major, 下半 = minor
    if (dist < CENTER_RADIUS) {
      s.quadrant = s.padY >= 0 ? QUADRANT.CENTER_UP : QUADRANT.CENTER_DOWN;
      return;
    }
    // 外环 6 区：每 60° 一格，中心角 30/90/150/210/270/330
    const ang = Math.atan2(s.padY, s.padX); // -π..π
    let deg = (ang * 180) / Math.PI;
    if (deg < 0) deg += 360;
    const idx = Math.floor(deg / 60) % 6;
    s.quadrant = OUTER_SECTORS[idx].q;
  }
}

export const PAD_LAYOUT = {
  CENTER_X: _padCenterX,
  CENTER_Y: PAD_CENTER_Y,
  HALF_W: PAD_HALF_W,
  HALF_H: PAD_HALF_H,
  CENTER_RADIUS,
};

export const modeMachine = new ModeMachine();
