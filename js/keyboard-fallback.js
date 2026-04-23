// =============================================================
// keyboard-fallback.js — 电脑键盘模拟 MIDI 输入 (v4: 可开可关)
//   A S D F G H J K → 8 个白键 (C D E F G A B C)
//   W E   T Y U     → 5 个黑键 (C# D# F# G# A#)
// 自动跟随当前八度
// =============================================================

import { midi, getRange } from "./midi-input.js";

/** 相对 offset（相对当前八度最低音 C） */
const REL_MAP = {
  a: 0,  // C
  w: 1,  // C#
  s: 2,  // D
  e: 3,  // D#
  d: 4,  // E
  f: 5,  // F
  t: 6,  // F#
  g: 7,  // G
  y: 8,  // G#
  h: 9,  // A
  u: 10, // A#
  j: 11, // B
  k: 12, // 高八度 C（第 13 个音）
};

let _enabled = false;
let _pressed = new Set();
let _onDown = null;
let _onUp = null;

export function isKeyboardFallbackEnabled() { return _enabled; }

export function enableKeyboardFallback() {
  if (_enabled) return;
  _enabled = true;
  _pressed = new Set();

  _onDown = (e) => {
    if (e.repeat) return;
    // 不拦截输入框输入等
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const k = e.key.toLowerCase();
    if (REL_MAP[k] !== undefined) {
      const { min } = getRange();
      const n = min + REL_MAP[k];
      if (!_pressed.has(k)) {
        _pressed.add(k);
        midi.injectNoteOn(n, 100);
      }
    }
  };
  _onUp = (e) => {
    const k = e.key.toLowerCase();
    if (REL_MAP[k] !== undefined) {
      const { min } = getRange();
      const n = min + REL_MAP[k];
      if (_pressed.has(k)) {
        _pressed.delete(k);
        midi.injectNoteOff(n);
      }
    }
  };

  window.addEventListener("keydown", _onDown);
  window.addEventListener("keyup", _onUp);
}

export function disableKeyboardFallback() {
  if (!_enabled) return;
  _enabled = false;
  if (_onDown) window.removeEventListener("keydown", _onDown);
  if (_onUp) window.removeEventListener("keyup", _onUp);
  _onDown = _onUp = null;
  // 把所有"按着"的音关掉，避免卡音
  const { min } = getRange();
  for (const k of _pressed) {
    const n = min + REL_MAP[k];
    midi.injectNoteOff(n);
  }
  _pressed.clear();
}
