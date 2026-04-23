// =============================================================
// midi-input.js — Web MIDI 输入封装
// 13 个音：当前八度起的 C 到下一个八度的 C (含首尾)
// 例如 octaveIndex=3 → C3..C4 (MIDI 48..60)
// 可通过 setOctave() 动态切换八度
// =============================================================

let _octaveIndex = 4; // 默认 C4-C5（中间位置，做伴奏适中）
let _min = _octaveIndex * 12;
let _max = _min + 12;

/** 拿当前音符范围（最小/最大 MIDI note，含 13 个音） */
export function getRange() {
  return { min: _min, max: _max };
}
export function getOctaveIndex() {
  return _octaveIndex;
}
/** 切换八度（2..6 合法，默认 3） */
export function setOctaveIndex(idx) {
  _octaveIndex = Math.max(1, Math.min(6, idx | 0));
  _min = _octaveIndex * 12;
  _max = _min + 12;
}

// 向后兼容：早期代码引用的这两个名字
export const MIDI_MIN = 48;
export const MIDI_MAX = 60;

class MidiInput extends EventTarget {
  constructor() {
    super();
    this.access = null;
    this.devices = new Map();
    this.isPartyKeys = false;
    this.deviceName = null;
    this.activeNotes = new Map();
  }

  async init() {
    if (!navigator.requestMIDIAccess) {
      this._setStatus("unsupported", "浏览器不支持 Web MIDI");
      return false;
    }
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this._scan();
      this.access.onstatechange = () => this._scan();
      return true;
    } catch (err) {
      this._setStatus("denied", "MIDI 权限被拒绝");
      return false;
    }
  }

  _scan() {
    const inputs = Array.from(this.access.inputs.values());
    for (const inp of this.devices.values()) inp.onmidimessage = null;
    this.devices.clear();

    if (inputs.length === 0) {
      this._setStatus("none", "未检测到 MIDI 设备");
      this.isPartyKeys = false;
      this.deviceName = null;
      return;
    }
    const pk = inputs.find((d) => /partykey/i.test(d.name));
    const active = pk || inputs[0];
    this.isPartyKeys = !!pk;
    this.deviceName = active.name;

    active.onmidimessage = (e) => this._handleMessage(e);
    this.devices.set(active.id, active);

    this._setStatus(
      pk ? "pk" : "generic",
      pk ? `PartyKeys 已连接` : `${active.name} 已连接`
    );
  }

  _setStatus(kind, text) {
    this.dispatchEvent(new CustomEvent("status", { detail: { kind, text } }));
  }

  _handleMessage(e) {
    const [status, data1, data2] = e.data;
    const cmd = status & 0xf0;
    const note = _foldToRange(data1);

    if (cmd === 0x90 && data2 > 0) {
      this.activeNotes.set(note, { velocity: data2, time: performance.now() });
      this.dispatchEvent(
        new CustomEvent("noteon", { detail: { note, velocity: data2, raw: data1 } })
      );
    } else if (cmd === 0x80 || (cmd === 0x90 && data2 === 0)) {
      this.activeNotes.delete(note);
      this.dispatchEvent(new CustomEvent("noteoff", { detail: { note, raw: data1 } }));
    }
  }

  injectNoteOn(note, velocity = 100) {
    this.activeNotes.set(note, { velocity, time: performance.now() });
    this.dispatchEvent(new CustomEvent("noteon", { detail: { note, velocity } }));
  }
  injectNoteOff(note) {
    this.activeNotes.delete(note);
    this.dispatchEvent(new CustomEvent("noteoff", { detail: { note } }));
  }
}

export const midi = new MidiInput();

export function noteToName(note) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
}

/** 把任意 MIDI note 折叠到当前 [_min, _max] 范围（含首尾 13 个音） */
function _foldToRange(note) {
  let n = note;
  while (n < _min) n += 12;
  while (n > _max) n -= 12;
  return n;
}
