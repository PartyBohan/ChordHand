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
  setPadCenterX,
  PAD_POSITIONS,
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
const elOnboard = document.getElementById("onboarding-panel");
const elBtnOnboardClose = document.getElementById("btn-onboard-close");
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
  keybedDirty: true,       // 只在音符集合变化时重画底部键盘
  triggerFlash: 0,
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
      setMidiStatusRaw("err", err?.message || "error");
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
  setTimeout(() => {
    showLoading(false);
    // 彻底把 hero 屏从渲染树拿掉，防止它在后面继续吃 GPU
    if (elHero) elHero.style.display = "none";
    // 首次进入 → 弹引导；如果用户之前看过就不再弹
    let seen = false;
    try { seen = localStorage.getItem("chordhand_onboarded") === "1"; } catch {}
    if (!seen) {
      elOnboard.classList.remove("hidden");
    }
  }, 500);
}

elBtnOnboardClose.addEventListener("click", () => {
  elOnboard.classList.add("hidden");
  try { localStorage.setItem("chordhand_onboarded", "1"); } catch {}
});

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

// ---------- 手势位置：左 / 中 / 右 ----------
const elPadPosPanel = document.getElementById("pad-pos-panel");
const DIAL_SHIFT = { left: "-22vw", center: "0px", right: "22vw" };
if (elPadPosPanel) {
  elPadPosPanel.addEventListener("click", (e) => {
    const btn = e.target.closest(".pad-pos-pill");
    if (!btn) return;
    const pos = btn.dataset.pos;
    const x = PAD_POSITIONS[pos];
    if (x == null) return;
    setPadCenterX(x);
    elDial.style.setProperty("--dial-shift", DIAL_SHIFT[pos] || "0px");
    elPadPosPanel.querySelectorAll(".pad-pos-pill").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
  });
}

// ---------- 外环标签模式：情绪 / 和弦 ----------
const elRingModePanel = document.getElementById("ring-mode-panel");
if (elRingModePanel) {
  elRingModePanel.addEventListener("click", (e) => {
    const btn = e.target.closest(".ring-mode-pill");
    if (!btn) return;
    const mode = btn.dataset.mode; // "emotion" | "chord"
    chordDial.setLabelMode(mode);
    elRingModePanel.querySelectorAll(".ring-mode-pill").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
  });
}
// 默认 emotion 模式（HTML 上已经 active）
chordDial.setLabelMode("emotion");

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
  state.keybedDirty = true;

  const s = modeMachine.state;
  if (s.mode === MODE.CHORD && s.quadrant) {
    const chordType = QUADRANT_TO_CHORD[s.quadrant];
    audio.chordOn(note, chordType, velocity);
    audio.triggerBassShot(note);
    audio.triggerDrumShot(note);
    state.triggerFlash = 1;
  } else {
    audio.noteOn(note, velocity);
    audio.triggerBassShot(note);
    audio.triggerDrumShot(note);
  }
});

midi.addEventListener("noteoff", (e) => {
  const { note } = e.detail;
  state.activeKeybedNotes.delete(note);
  state.keybedDirty = true;
  if (audio.chordActive.has(note)) audio.chordOff(note);
  else audio.noteOff(note);
});

// =============================================================
// 渲染循环 —— 30fps 节流 + 极轻量：
//   · dial.draw 内部有 dirty check，没变化直接跳过
//   · keybed 只在 keybedDirty 时画
//   · trigger flash 仍以 rAF 频率衰减
// =============================================================
let _lastFrame = 0;
function renderLoop(ts) {
  if (state.triggerFlash > 0) {
    state.triggerFlash *= 0.88;
    if (state.triggerFlash < 0.02) state.triggerFlash = 0;
  }
  // 限 30fps
  if (ts - _lastFrame >= 32) {
    _lastFrame = ts;
    const s = modeMachine.state;
    if (s.mode === MODE.CHORD) chordDial.draw(s, state.triggerFlash);
    if (state.keybedDirty) {
      keybed.draw(state.activeKeybedNotes);
      state.keybedDirty = false;
    }
  }
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

// 窗口变化时也需要重画一次 keybed
window.addEventListener("resize", () => {
  state.keybedDirty = true;
});

// =============================================================
// 摄像头叠加 —— 精简版：只画关键点，不再每帧重跑 DPR + 无手时跳过
// =============================================================
const _camCtx = elCamCanvas.getContext("2d");
let _camW = 0, _camH = 0, _camDPR = 0;

const HAND_CONN = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [0, 9, 10, 11, 12],
  [0, 13, 14, 15, 16],
  [0, 17, 18, 19, 20],
  [5, 9, 13, 17],
];

function renderCameraOverlay(hands) {
  const canvas = elCamCanvas;
  const dpr = window.devicePixelRatio || 1;
  // 只有尺寸真正变化时才 resize + setTransform
  if (
    canvas.clientWidth !== _camW ||
    canvas.clientHeight !== _camH ||
    dpr !== _camDPR
  ) {
    _camW = canvas.clientWidth;
    _camH = canvas.clientHeight;
    _camDPR = dpr;
    canvas.width = _camW * dpr;
    canvas.height = _camH * dpr;
    _camCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const w = _camW, h = _camH, ctx = _camCtx;
  ctx.clearRect(0, 0, w, h);

  // 两只手都没检测到 → 直接返回，省掉后面的 save/restore 等开销
  if (!hands.left && !hands.right) return;

  for (const side of ["left", "right"]) {
    const hand = hands[side];
    if (!hand) continue;
    const color = side === "left" ? "#38bdf8" : "#f472b6";
    const points = hand.landmarks;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.75;
    for (const chain of HAND_CONN) {
      ctx.beginPath();
      const p0 = points[chain[0]];
      ctx.moveTo(p0.x * w, p0.y * h);
      for (let i = 1; i < chain.length; i++) {
        const p = points[chain[i]];
        ctx.lineTo(p.x * w, p.y * h);
      }
      ctx.stroke();
    }
    ctx.fillStyle = color;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
      ctx.fill();
    }
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
  updateKbdBtnLabel();
  // 圆环标签里的情绪词/副标题随语言切换 → 重建静态层
  chordDial.invalidate();
});

// 初始显示
setModeUI(MODE.NORMAL);
setMidiStatusByKey("warn", "midi_not_connected");
setCamStatusByKey("warn", "cam_not_connected");
