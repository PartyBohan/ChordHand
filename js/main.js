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
import { enableKeyboardFallback, disableKeyboardFallback } from "./keyboard-fallback.js";
import { detectLang, setLang, getLang, t } from "./i18n.js";

// =============================================================
// 启动时先初始化语言：跟随系统 / localStorage，默认英语
// =============================================================
setLang(detectLang());
document.querySelectorAll(".lang-pill").forEach((b) => {
  b.addEventListener("click", () => setLang(b.dataset.lang));
});

// ---------- DOM ----------
const elBtnStart = document.getElementById("btn-start");
const elHero = document.getElementById("hero-screen");
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
  // 保存最后一次的状态 kind，用于语言切换时重新渲染文本
  midi: { kind: "warn", key: "midi_not_connected", text: "" },
  cam:  { kind: "warn", key: "cam_not_connected", text: "" },
  mode: MODE.NORMAL,
  kbdActive: false,
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
async function handleStart() {
  if (state.started) return;
  elBtnStart.disabled = true;
  const startText = elBtnStart.querySelector(".hero-start-text");
  if (startText) startText.textContent = getLang() === "zh" ? "启动中…" : "Starting…";
  // 淡出 hero 屏
  if (elHero) elHero.classList.add("hidden");
  showLoading(true);
  setLoadStep("audio", "active");
  setLoadStep("model", null);
  setLoadStep("camera", null);
  setLoadStep("midi", null);

  setMidiStatusByKey("warn", "midi_waiting");
  setCamStatusByKey("warn", "cam_waiting");

  try {
    await audio.start();
    applyCurrentVol();
    applyCurrentVoice();
    setLoadStep("audio", "done");
  } catch (err) {
    console.error("[audio]", err);
    setLoadStep("audio", "fail");
    if (startText) startText.textContent = getLang() === "zh" ? "音频失败" : "Audio failed";
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
  if (startText) startText.textContent = getLang() === "zh" ? "运行中" : "Running";
  setTimeout(() => showLoading(false), 500);
}

elBtnStart.addEventListener("click", handleStart);

// =============================================================
// 键盘 fallback
// =============================================================
elBtnKbd.addEventListener("click", async () => {
  try {
    if (state.kbdActive) {
      // 关掉键盘模式 → 切回 MIDI
      disableKeyboardFallback();
      state.kbdActive = false;
      elBtnKbd.classList.remove("btn-primary");
      updateKbdBtnLabel();
      setMidiStatusByKey("warn", "btn_kbd_disabled_status");
      // 让 midi-input 重新 scan 一次，恢复外部设备状态显示
      if (midi.access) {
        try { midi._scan(); } catch {}
      }
      return;
    }
    // 开启键盘模式
    if (!audio.ctx) {
      await audio.start();
      applyCurrentVol();
      applyCurrentVoice();
    }
    enableKeyboardFallback();
    state.kbdActive = true;
    elBtnKbd.classList.add("btn-primary");
    updateKbdBtnLabel();
    setMidiStatusByKey("ok", "btn_kbd_active_status");
  } catch (err) {
    setMidiStatusRaw("err", err.message || "error");
  }
});

function updateKbdBtnLabel() {
  const labelSpan = elBtnKbd.querySelector("[data-i18n]");
  if (!labelSpan) return;
  if (state.kbdActive) {
    // 显示成"切回 MIDI"提示
    labelSpan.textContent = t("btn_kbd_active");
    labelSpan.dataset.i18n = "btn_kbd_active";
    elBtnKbd.dataset.i18nAttr = "title:btn_kbd_active_title";
    elBtnKbd.setAttribute("title", t("btn_kbd_active_title"));
  } else {
    labelSpan.textContent = t("btn_kbd");
    labelSpan.dataset.i18n = "btn_kbd";
    elBtnKbd.dataset.i18nAttr = "title:btn_kbd_title";
    elBtnKbd.setAttribute("title", t("btn_kbd_title"));
  }
}

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

// ---------- 摄像头透明度 ----------
const elCamOpacity = document.getElementById("cam-opacity");
const elCamOpacityVal = document.getElementById("cam-opacity-val");
function applyCamOpacity() {
  const v = parseInt(elCamOpacity.value, 10) / 100;
  elVideo.style.opacity = String(v);
  elCamOpacityVal.textContent = elCamOpacity.value;
}
elCamOpacity.addEventListener("input", applyCamOpacity);
applyCamOpacity();

// =============================================================
// 状态 chips（i18n-aware）
// =============================================================
const MIDI_KIND_TO_KEY = {
  pk:          "midi_pk",
  generic:     "__generic__",   // 用设备名 + 后缀
  none:        "midi_none",
  denied:      "midi_denied",
  unsupported: "midi_unsupported",
};
const MIDI_KIND_TO_CHIP = {
  pk: "ok", generic: "ok", none: "warn", denied: "err", unsupported: "err",
};

midi.addEventListener("status", (e) => {
  const { kind } = e.detail;
  const chipCls = MIDI_KIND_TO_CHIP[kind] || "warn";
  if (kind === "generic") {
    // 保留设备名
    const devName = (midi.deviceName || "MIDI").replace(/\s*\(.*?\)\s*$/, "");
    state.midi = { kind: chipCls, key: null, text: `${devName} · ${t("midi_generic_suffix")}` };
  } else {
    state.midi = { kind: chipCls, key: MIDI_KIND_TO_KEY[kind] || null, text: "" };
  }
  renderMidiChip();
});

function setMidiStatusByKey(chipCls, key) {
  state.midi = { kind: chipCls, key, text: "" };
  renderMidiChip();
}
function setMidiStatusRaw(chipCls, text) {
  state.midi = { kind: chipCls, key: null, text };
  renderMidiChip();
}
function renderMidiChip() {
  const s = state.midi;
  const prefix = t("chip_midi_prefix");
  const text = s.key ? t(s.key) : s.text;
  elMidiChip.className = `chip chip-${s.kind}`;
  elMidiChip.textContent = `${prefix} · ${text}`;
}

function setCamStatusByKey(chipCls, key) {
  state.cam = { kind: chipCls, key, text: "" };
  renderCamChip();
}
function setCamStatusRaw(chipCls, text) {
  state.cam = { kind: chipCls, key: null, text };
  renderCamChip();
}
function renderCamChip() {
  const s = state.cam;
  const prefix = t("chip_cam_prefix");
  const text = s.key ? t(s.key) : s.text;
  elCamChip.className = `chip chip-${s.kind}`;
  elCamChip.textContent = `${prefix} · ${text}`;
}

handTracker.addEventListener("status", (e) => {
  const { kind } = e.detail;
  if (kind === "ok") setCamStatusByKey("ok", "cam_connected");
  else if (kind === "loading") setCamStatusByKey("warn", "cam_waiting");
  else if (kind === "denied") setCamStatusByKey("err", "cam_denied");
  else setCamStatusByKey("warn", "cam_not_connected");
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
  state.mode = mode;
  const keyMap = { idle: "mode_idle", normal: "mode_normal", chord: "mode_chord" };
  elModeChip.textContent = t(keyMap[mode] || "mode_normal");
  elDial.classList.toggle("hidden", mode !== MODE.CHORD);
}

function updateDialCaption(s) {
  if (s.mode === MODE.CHORD && s.gestureHand) {
    elCapPlaying.textContent = t(
      s.playingHand === "left" ? "dial_left_plays" : "dial_right_plays"
    );
    elCapGesture.textContent = t(
      s.gestureHand === "left" ? "dial_left_gesture" : "dial_right_gesture"
    );
  } else {
    elCapPlaying.textContent = "";
    elCapGesture.textContent = t("dial_hint_default");
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

  // 手势操作区提示 —— 加亮，方便用户找到
  const padX = (PAD_LAYOUT.CENTER_X - PAD_LAYOUT.HALF_W) * w;
  const padY = (PAD_LAYOUT.CENTER_Y - PAD_LAYOUT.HALF_H) * h;
  const padW = PAD_LAYOUT.HALF_W * 2 * w;
  const padH = PAD_LAYOUT.HALF_H * 2 * h;
  ctx.save();
  // 主框：紫色虚线
  ctx.strokeStyle = "rgba(167, 139, 250, 0.55)";
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  ctx.strokeRect(padX, padY, padW, padH);
  // 四角高亮
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(244, 114, 182, 0.9)";
  ctx.lineWidth = 3;
  const CL = 20;
  const corners = [
    [padX, padY, 1, 1],
    [padX + padW, padY, -1, 1],
    [padX, padY + padH, 1, -1],
    [padX + padW, padY + padH, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + CL * dy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + CL * dx, cy);
    ctx.stroke();
  }
  // 标签
  ctx.fillStyle = "rgba(244, 114, 182, 0.95)";
  ctx.font = "700 11px -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  const label = t("pad_zone_label");
  ctx.fillText(label, padX + 6, padY - 4);
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
    const label = getLang() === "zh"
      ? (side === "left" ? "左手" : "右手")
      : (side === "left" ? "L" : "R");
    ctx.fillText(label, px(hand.palm) - 16, py(hand.palm) - 20);
    ctx.restore();
  }
}

// =============================================================
// 语言切换时：重新渲染那些通过 JS 设置文本的地方
// =============================================================
window.addEventListener("langchange", () => {
  renderMidiChip();
  renderCamChip();
  setModeUI(state.mode);
  updateDialCaption(modeMachine.state);
  // 重新应用键盘模式按钮的正确 label（data-i18n 会在 setLang 里刷，所以这步只是防御）
  updateKbdBtnLabel();
});

// 初始显示
setModeUI(MODE.NORMAL);
setMidiStatusByKey("warn", "midi_not_connected");
setCamStatusByKey("warn", "cam_not_connected");
