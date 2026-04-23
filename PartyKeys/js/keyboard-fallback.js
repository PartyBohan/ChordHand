// =============================================================
// keyboard-fallback.js — 电脑键盘模拟 MIDI 输入 (v3, 13 音)
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

export function enableKeyboardFallback() {
  if (_enabled) return;
  _enabled = true;
  const pressed = new Set();

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (REL_MAP[k] !== undefined) {
      const { min } = getRange();
      const n = min + REL_MAP[k];
      if (!pressed.has(k)) {
        pressed.add(k);
        midi.injectNoteOn(n, 100);
      }
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if (REL_MAP[k] !== undefined) {
      const { min } = getRange();
      const n = min + REL_MAP[k];
      if (pressed.has(k)) {
        pressed.delete(k);
        midi.injectNoteOff(n);
      }
    }
  });
}
