// =============================================================
// main.js — PartyKeys 应用入口 (v3)
// 移除旋律模式；新增八度/音量/音色/贝斯/鼓 one-shot 控制
// =============================================================

import {
  midi,
  getRange,
  getOctaveIndex,
  setOctaveIndex,
  noteToName,
} from "./midi-input.js";
import { handTracker } from "./hand-tracker.js";
import {
  modeMachine,
  MODE,
  QUADRANT_TO_CHORD,
  PAD_LAYOUT,
} from "./mode-machine.js";
import { audio, VOICES } from "./audio-engine.js";
import { ChordDial } from "./dial-ui.js";
import { Keybed } from "./hud-ui.js";
import { enableKeyboardFallback } from "./keyboard-fallback.js";

// ---------- DOM ----------
const elBtnStart = document.getElementById("btn-start");
const elBtnKbd = document.getElementById("btn-kbd-fallback");
const elBtnHelp = document.getElementById("btn-help");
const elBtnHelpClose = document.getElementById("btn-help-close");
const elHelp = document.getElementById("help-panel");
const elMidiChip = document.getElementById("status-midi");
const elCamChip = document.getElementById("status-camera");
const elModeChip = document.getElementById("status-mode");
const elDial = document.getElementById("chord-dial");
const elVideo = document.getElementById("camera-video");
const elCamCanvas = document.getElementById("camera-overlay");
const elKeybedCanvas = document.getElementById("keybed-canvas");
const elLoading = document.getElementById("loading-overlay");
const elCapPlaying = document.getElementById("cap-playing-hand");
const elCapGesture = document.getElementById("cap-gesture-hand");

// 控制条
const elBtnOctDown = document.getElementById("btn-oct-down");
const elBtnOctUp = document.getElementById("btn-oct-up");
const elOctDisplay = document.getElementById("oct-display");
const elVolSlider = document.getElementById("vol-slider");
const elVolDisplay = document.getElementById("vol-display");
const elVoicePills = document.getElementById("voice-pills");
const elBtnBass = document.getElementById("btn-bass");
const elBtnDrum = document.getElementById("btn-drum");

// ---------- UI 模块 ----------
const chordDial = new ChordDial(document.getElementById("dial-canvas"));
const keybed = new Keybed(elKeybedCanvas);

// ---------- 应用状态 ----------
const state = {
  started: false,
  activeKeybedNotes: new Set(),
  triggerFlash: 0,
};

// =============================================================
// 加载步骤追踪
// =============================================================
function setLoadStep(stepName, status) {
  const el = elLoading.querySelector(`[data-step="${stepName}"]`);
  if (!el) return;
  el.classList.remove("active", "done", "fail");
  if (status) el.classList.add(status);
}
function showLoading(show) {
  elLoading.classList.toggle("hidden", !show);
}

// =============================================================
// 预加载 MediaPipe
// =============================================================
(function idlePreload() {
  const run = () => {
    try { handTracker.preload(); } catch {}
  };
  if ("requestIdleCallback" in window) {
    requestIdleCallback(run, { timeout: 1500 });
  } else {
    setTimeout(run, 300);
  }
})();

// =============================================================
// 启动按钮
// =============================================================
elBtnStart.addEventListener("click", async () => {
  if (state.started) return;
  elBtnStart.disabled = true;
  elBtnStart.textContent = "启动中…";
  showLoading(true);
  setLoadStep("audio", "active");
  setLoadStep("model", null);
  setLoadStep("camera", null);
  setLoadStep("midi", null);

  setMidiStatus("warn", "等待授权…");
  setCamStatus("warn", "等待授权…");

  try {
    await audio.start();
    applyCurrentVol();
    applyCurrentVoice();
    setLoadStep("audio", "done");
  } catch (err) {
    console.error("[audio]", err);
    setLoadStep("audio", "fail");
    elBtnStart.textContent = "音频启动失败";
    elBtnStart.disabled = false;
    return;
  }

  setLoadStep("midi", "active");
  setLoadStep("model", "active");

  const midiPromise = (async () => {
    try {
      const ok = await midi.init();
      setLoadStep("midi", ok ? "done" : "fail");
    } catch (err) {
      setMidiStatus("err", err?.message || "未知错误");
      setLoadStep("midi", "fail");
    }
  })();

  const camPromise = (async () => {
    try {
      await handTracker.init(elVideo, {
        onModel: (s) => setLoadStep("model", s === "loading" ? "active" : s),
        onCamera: (s) => setLoadStep("camera", s === "loading" ? "active" : s),
      });
    } catch (err) { /* steps already updated */ }
  })();

  await Promise.allSettled([midiPromise, camPromise]);
  state.started = true;
  elBtnStart.textContent = "运行中";
  setTimeout(() => showLoading(false), 500);
});

// =============================================================
// 键盘 fallback
// =============================================================
elBtnKbd.addEventListener("click", async () => {
  try {
    if (!audio.ctx) {
      await audio.start();
      applyCurrentVol();
      applyCurrentVoice();
    }
    enableKeyboardFallback();
    elBtnKbd.classList.add("btn-primary");
    elBtnKbd.textContent = "键盘 ✓";
    setMidiStatus("ok", "电脑键盘已启用");
  } catch (err) {
    setMidiStatus("err", "启用失败：" + err.message);
  }
});

elBtnHelp.addEventListener("click", () => elHelp.classList.remove("hidden"));
elBtnHelpClose.addEventListener("click", () => elHelp.classList.add("hidden"));

// =============================================================
// 控制条：八度 / 音量 / 音色 / 贝斯 / 鼓
// =============================================================
function refreshOctaveDisplay() {
  const { min, max } = getRange();
  elOctDisplay.textContent = `${noteToName(min)}–${noteToName(max)}`;
}
elBtnOctDown.addEventListener("click", () => {
  setOctaveIndex(getOctaveIndex() - 1);
  refreshOctaveDisplay();
});
elBtnOctUp.addEventListener("click", () => {
  setOctaveIndex(getOctaveIndex() + 1);
  refreshOctaveDisplay();
});
refreshOctaveDisplay();

function applyCurrentVol() {
  const v = parseInt(elVolSlider.value, 10) / 100;
  audio.setMasterVol(v);
  elVolDisplay.textContent = elVolSlider.value;
}
elVolSlider.addEventListener("input", applyCurrentVol);

function applyCurrentVoice() {
  const activePill = elVoicePills.querySelector(".cb-pill.active");
  if (activePill) audio.setVoice(activePill.dataset.voice);
}
elVoicePills.addEventListener("click", (e) => {
  const pill = e.target.closest(".cb-pill");
  if (!pill) return;
  elVoicePills.querySelectorAll(".cb-pill").forEach((p) => p.classList.remove("active"));
  pill.classList.add("active");
  applyCurrentVoice();
});

elBtnBass.addEventListener("click", () => {
  const on = !elBtnBass.classList.contains("active");
  elBtnBass.classList.toggle("active", on);
  audio.setBassShot(on);
});
elBtnDrum.addEventListener("click", () => {
  const on = !elBtnDrum.classList.contains("active");
  elBtnDrum.classList.toggle("active", on);
  audio.setDrumShot(on);
});

// =============================================================
// 状态 chips
// =============================================================
midi.addEventListener("status", (e) => {
  const { kind, text } = e.detail;
  const map = { pk: "ok", generic: "ok", none: "warn", denied: "err", unsupported: "err" };
  setMidiStatus(map[kind] || "warn", text);
});
function setMidiStatus(kind, text) {
  elMidiChip.className = `chip chip-${kind}`;
  elMidiChip.textContent = `MIDI · ${text}`;
}
function setCamStatus(kind, text) {
  elCamChip.className = `chip chip-${kind}`;
  elCamChip.textContent = `摄像头 · ${text}`;
}

handTracker.addEventListener("status", (e) => {
  const { kind, text } = e.detail;
  const cls = kind === "ok" ? "ok" : kind === "error" || kind === "denied" ? "err" : "warn";
  const cleaned = text.replace(/^摄像头[:：]\s*/, "");
  setCamStatus(cls, cleaned);
});

// =============================================================
// 手 → 模式机
// =============================================================
handTracker.addEventListener("frame", (e) => {
  const { hands, ts } = e.detail;
  modeMachine.update(hands, ts);
  renderCameraOverlay(hands);
});

modeMachine.addEventListener("modechange", (e) => {
  const { from, to } = e.detail;
  setModeUI(to);
  if (from === MODE.CHORD) {
    audio.chordActive.forEach((_, root) => audio.chordOff(root));
  }
});

modeMachine.addEventListener("update", (e) => {
  updateDialCaption(e.detail);
});

function setModeUI(mode) {
  const labels = { idle: "待机", normal: "普通", chord: "和弦模式" };
  elModeChip.textContent = labels[mode] || "普通";
  elDial.classList.toggle("hidden", mode !== MODE.CHORD);
}

function updateDialCaption(s) {
  if (s.mode === MODE.CHORD && s.gestureHand) {
    const playHand = s.playingHand === "left" ? "左手" : "右手";
    const gestureHand = s.gestureHand === "left" ? "左手" : "右手";
    elCapPlaying.textContent = `${playHand}弹琴 · `;
    elCapGesture.textContent = `${gestureHand}移动到任意区即触发`;
  }
}

// =============================================================
// MIDI note → audio
// =============================================================
midi.addEventListener("noteon", (e) => {
  const { note, velocity } = e.detail;
  state.activeKeybedNotes.add(note);

  const s = modeMachine.state;
  if (s.mode === MODE.CHORD && s.quadrant) {
    const chordType = QUADRANT_TO_CHORD[s.quadrant];
    audio.chordOn(note, chordType, velocity);
    audio.triggerBassShot(note);
    audio.triggerDrumShot(note);
    state.triggerFlash = 1;
  } else {
    audio.noteOn(note, velocity);
    // Normal 模式下也可以触发节奏点缀
    audio.triggerBassShot(note);
    audio.triggerDrumShot(note);
  }
});

midi.addEventListener("noteoff", (e) => {
  const { note } = e.detail;
  state.activeKeybedNotes.delete(note);
  if (audio.chordActive.has(note)) audio.chordOff(note);
  else audio.noteOff(note);
});

// =============================================================
// 渲染循环
// =============================================================
function renderLoop() {
  if (state.triggerFlash > 0) {
    state.triggerFlash *= 0.88;
    if (state.triggerFlash < 0.02) state.triggerFlash = 0;
  }
  const s = modeMachine.state;
  if (s.mode === MODE.CHORD) chordDial.draw(s, state.triggerFlash);
  keybed.draw(state.activeKeybedNotes);
  requestAnimationFrame(renderLoop);
}
renderLoop();

// =============================================================
// 摄像头叠加
// =============================================================
function renderCameraOverlay(hands) {
  const canvas = elCamCanvas;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  if (
    canvas.width !== canvas.clientWidth * dpr ||
    canvas.height !== canvas.clientHeight * dpr
  ) {
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  const px = (lm) => lm.x * w;
  const py = (lm) => lm.y * h;

  // 手势操作区提示
  const padX = (PAD_LAYOUT.CENTER_X - PAD_LAYOUT.HALF_W) * w;
  const padY = (PAD_LAYOUT.CENTER_Y - PAD_LAYOUT.HALF_H) * h;
  const padW = PAD_LAYOUT.HALF_W * 2 * w;
  const padH = PAD_LAYOUT.HALF_H * 2 * h;
  ctx.save();
  ctx.strokeStyle = "rgba(167, 139, 250, 0.12)";
  ctx.setLineDash([3, 6]);
  ctx.lineWidth = 1;
  ctx.strokeRect(padX, padY, padW, padH);
  ctx.restore();

  for (const side of ["left", "right"]) {
    const hand = hands[side];
    if (!hand) continue;
    const color = side === "left" ? "#38bdf8" : "#f472b6";
    const points = hand.landmarks;
    const CONN = [
      [0, 1, 2, 3, 4],
      [0, 5, 6, 7, 8],
      [0, 9, 10, 11, 12],
      [0, 13, 14, 15, 16],
      [0, 17, 18, 19, 20],
      [5, 9, 13, 17],
    ];
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.75;
    for (const chain of CONN) {
      ctx.beginPath();
      ctx.moveTo(px(points[chain[0]]), py(points[chain[0]]));
      for (let i = 1; i < chain.length; i++) {
        ctx.lineTo(px(points[chain[i]]), py(points[chain[i]]));
      }
      ctx.stroke();
    }
    ctx.fillStyle = color;
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(px(p), py(p), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = "bold 13px -apple-system,sans-serif";
    ctx.fillText(side === "left" ? "左手" : "右手", px(hand.palm) - 16, py(hand.palm) - 20);
    ctx.restore();
  }
}

// 初始显示
setModeUI(MODE.NORMAL);
setMidiStatus("warn", "未连接");
setCamStatus("warn", "未连接");
