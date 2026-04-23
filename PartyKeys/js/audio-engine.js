// =============================================================
// audio-engine.js — Web Audio 合成引擎 (v3)
// 新增：
//   - 4 种乐器音色: piano / ep / organ / pad
//   - bass / drum 从循环改成 one-shot (只在触发和弦时打一下头拍)
//   - setMasterVol / setVoice / toggleBassShot / toggleDrumShot
// =============================================================

export const VOICES = ["piano", "ep", "organ", "pad", "vocal"];
export const VOICE_LABELS = {
  piano: "钢琴",
  ep: "电钢",
  organ: "风琴",
  pad: "Pad",
  vocal: "人声",
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.keysBus = null;
    this.drumsBus = null;
    this.bassBus = null;
    this.reverbBus = null;
    this.active = new Map();
    this.chordActive = new Map();

    this.params = {
      masterVol: 0.85,
      bassShot: false, // 是否在触发和弦时打 bass
      drumShot: false, // 是否在触发和弦时打 kick
      voice: "piano", // piano / ep / organ / pad
      reverbAmount: 0.2,
    };
  }

  async start() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.params.masterVol;
    this.master.connect(ctx.destination);

    this.keysBus = ctx.createGain();
    this.keysBus.gain.value = 0.9;
    this.keysBus.connect(this.master);

    this.drumsBus = ctx.createGain();
    this.drumsBus.gain.value = 0.7;
    this.drumsBus.connect(this.master);

    this.bassBus = ctx.createGain();
    this.bassBus.gain.value = 0.65;
    this.bassBus.connect(this.master);

    // 简易混响
    this.reverbBus = ctx.createGain();
    this.reverbBus.gain.value = this.params.reverbAmount;
    this.reverbBus.connect(this.master);
    const rvDelay = ctx.createDelay(1.0);
    rvDelay.delayTime.value = 0.12;
    const rvFb = ctx.createGain();
    rvFb.gain.value = 0.55;
    const rvLP = ctx.createBiquadFilter();
    rvLP.type = "lowpass";
    rvLP.frequency.value = 3000;
    this.reverbBus.connect(rvDelay);
    rvDelay.connect(rvLP);
    rvLP.connect(rvFb);
    rvFb.connect(rvDelay);
    rvLP.connect(this.master);
  }

  setParams(partial) {
    Object.assign(this.params, partial);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.params.masterVol, t, 0.08);
    this.reverbBus.gain.setTargetAtTime(this.params.reverbAmount, t, 0.1);
  }

  /** 直接设置主音量 0..1 */
  setMasterVol(v) {
    this.params.masterVol = Math.max(0, Math.min(1, v));
    if (this.ctx) {
      this.master.gain.setTargetAtTime(this.params.masterVol, this.ctx.currentTime, 0.05);
    }
  }
  setVoice(v) {
    if (VOICES.includes(v)) this.params.voice = v;
  }
  setBassShot(on) { this.params.bassShot = !!on; }
  setDrumShot(on) { this.params.drumShot = !!on; }

  // ==========================================================
  // 单音
  // ==========================================================
  noteOn(note, velocity = 100) {
    if (!this.ctx) return;
    if (this.active.has(note)) this.noteOff(note);
    const voice = this._makeVoice(note, velocity / 127);
    this.active.set(note, voice);
  }
  noteOff(note) {
    const voice = this.active.get(note);
    if (!voice) return;
    voice.release();
    this.active.delete(note);
  }

  chordOn(rootNote, chordType, velocity = 100) {
    const intervals = CHORDS[chordType] || CHORDS.maj7;
    const voices = [];
    const scale = velocity / 127;
    for (const iv of intervals) {
      const n = rootNote + iv;
      if (n < 24 || n > 108) continue;
      const v = this._makeVoice(n, scale * 0.75);
      voices.push({ note: n, voice: v });
    }
    this.chordActive.set(rootNote, voices);
  }
  chordOff(rootNote) {
    const voices = this.chordActive.get(rootNote);
    if (!voices) return;
    voices.forEach((v) => v.voice.release());
    this.chordActive.delete(rootNote);
  }

  allOff() {
    this.active.forEach((v) => v.release());
    this.active.clear();
    this.chordActive.forEach((arr) => arr.forEach((x) => x.voice.release()));
    this.chordActive.clear();
  }

  // ==========================================================
  // 音色调度：根据 voice 选择对应的 voice 工厂
  // ==========================================================
  _makeVoice(note, gain) {
    switch (this.params.voice) {
      case "ep":    return this._epVoice(note, gain);
      case "organ": return this._organVoice(note, gain);
      case "pad":   return this._padVoice(note, gain);
      case "vocal": return this._vocalVoice(note, gain);
      case "piano":
      default:      return this._pianoVoice(note, gain);
    }
  }

  // -- 人声 "啊" (唱诗班 formant 共振峰) --
  _vocalVoice(note, gain) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const freq = midiToFreq(note);
    const { outGain, revSend } = this._makeOutput(0.7); // 大混响做教堂感

    // 声源: 2 个微失调 sawtooth + 1 个 square 加厚
    const sourceSum = ctx.createGain();
    sourceSum.gain.value = 0.45;
    const sources = [];
    for (const det of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.detune.value = det;
      osc.connect(sourceSum);
      sources.push({ osc });
    }
    const sq = ctx.createOscillator();
    sq.type = "square";
    sq.frequency.value = freq;
    const sqG = ctx.createGain();
    sqG.gain.value = 0.2;
    sq.connect(sqG);
    sqG.connect(sourceSum);
    sources.push({ osc: sq });

    // formant 滤波器组并行 —— 元音 "啊" 的三个共振峰
    const FORMANTS = [
      { f: 730, Q: 7, g: 1.0 },  // F1
      { f: 1090, Q: 8, g: 0.55 }, // F2
      { f: 2440, Q: 9, g: 0.25 }, // F3
    ];
    const mix = ctx.createGain();
    mix.gain.value = 1;
    for (const fm of FORMANTS) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = fm.f;
      bp.Q.value = fm.Q;
      const g = ctx.createGain();
      g.gain.value = fm.g;
      sourceSum.connect(bp);
      bp.connect(g);
      g.connect(mix);
    }
    // 加一点点高通后的清声做"齿擦"
    const hpass = ctx.createBiquadFilter();
    hpass.type = "highpass";
    hpass.frequency.value = 3200;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.08;
    sourceSum.connect(hpass);
    hpass.connect(airGain);
    airGain.connect(mix);

    mix.connect(outGain);

    // 慢起慢收 — 唱诗班感
    sources.forEach(({ osc }) => osc.start(t0));
    this._adsr(outGain, t0, 0.35, 0.42 * gain, 0.75, 1.6);
    return this._voiceHandle(sources, outGain, revSend);
  }

  // -- 钢琴 (亮, 短 decay) --
  _pianoVoice(note, gain) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const freq = midiToFreq(note);
    const { outGain, revSend } = this._makeOutput(0.35);
    const partials = [
      { ratio: 1, level: 1.0 },
      { ratio: 2, level: 0.45 },
      { ratio: 3, level: 0.22 },
      { ratio: 4, level: 0.12 },
    ];
    const oscs = this._spawnOscs(partials, freq, "sine", outGain, t0);
    this._adsr(outGain, t0, 0.008, 0.45 * gain, 0.4, 0.4);
    return this._voiceHandle(oscs, outGain, revSend);
  }

  // -- 电钢 (圆润, 带轻微 wow) --
  _epVoice(note, gain) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const freq = midiToFreq(note);
    const { outGain, revSend } = this._makeOutput(0.28);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    lp.Q.value = 0.7;
    // 重新接线：所有泛音 → lp → outGain
    const midGain = ctx.createGain();
    midGain.gain.value = 1;
    midGain.connect(lp);
    lp.connect(outGain);

    const partials = [
      { ratio: 1, level: 1.0 },
      { ratio: 2, level: 0.38 },
      { ratio: 3.01, level: 0.12 }, // 微微失调带一点 tine
    ];
    const oscs = this._spawnOscs(partials, freq, "sine", midGain, t0);
    // 加 triangle 下混给它一点温度
    const tri = ctx.createOscillator();
    tri.type = "triangle";
    tri.frequency.value = freq;
    const tg = ctx.createGain();
    tg.gain.value = 0.25;
    tri.connect(tg);
    tg.connect(midGain);
    tri.start(t0);
    oscs.push({ osc: tri, g: tg });

    this._adsr(outGain, t0, 0.01, 0.40 * gain, 0.35, 0.6);
    return this._voiceHandle(oscs, outGain, revSend);
  }

  // -- 风琴 (持续,叠八度五度) --
  _organVoice(note, gain) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const freq = midiToFreq(note);
    const { outGain, revSend } = this._makeOutput(0.22);
    const partials = [
      { ratio: 1, level: 1.0 },
      { ratio: 2, level: 0.75 },
      { ratio: 3, level: 0.5 },
      { ratio: 4, level: 0.4 },
    ];
    const oscs = this._spawnOscs(partials, freq, "sine", outGain, t0);
    // 风琴：快速起音，几乎没有衰减
    this._adsr(outGain, t0, 0.02, 0.32 * gain, 1.0, 0.85);
    return this._voiceHandle(oscs, outGain, revSend);
  }

  // -- Pad (缓起, 低通扫描) --
  _padVoice(note, gain) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const freq = midiToFreq(note);
    const { outGain, revSend } = this._makeOutput(0.55);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(300, t0);
    lp.frequency.linearRampToValueAtTime(1800, t0 + 1.5);
    lp.Q.value = 1;
    const mid = ctx.createGain();
    mid.gain.value = 1;
    mid.connect(lp);
    lp.connect(outGain);

    const oscs = [];
    // 2 个 sawtooth 微微失调 + 一个低八度 sine
    for (const det of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.detune.value = det;
      const g = ctx.createGain();
      g.gain.value = 0.35;
      osc.connect(g);
      g.connect(mid);
      osc.start(t0);
      oscs.push({ osc, g });
    }
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = freq / 2;
    const sg = ctx.createGain();
    sg.gain.value = 0.3;
    sub.connect(sg);
    sg.connect(mid);
    sub.start(t0);
    oscs.push({ osc: sub, g: sg });

    // 慢起慢收
    this._adsr(outGain, t0, 0.6, 0.36 * gain, 1.6, 1.2);
    return this._voiceHandle(oscs, outGain, revSend);
  }

  _makeOutput(reverbSend = 0.35) {
    const ctx = this.ctx;
    const outGain = ctx.createGain();
    outGain.gain.value = 0;
    outGain.connect(this.keysBus);
    const revSend = ctx.createGain();
    revSend.gain.value = reverbSend;
    outGain.connect(revSend);
    revSend.connect(this.reverbBus);
    return { outGain, revSend };
  }
  _spawnOscs(partials, freq, type, dest, t0) {
    const ctx = this.ctx;
    const oscs = [];
    for (const p of partials) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq * p.ratio;
      const g = ctx.createGain();
      g.gain.value = p.level;
      osc.connect(g);
      g.connect(dest);
      osc.start(t0);
      oscs.push({ osc, g });
    }
    return oscs;
  }
  _adsr(g, t0, attack, peak, decayTo, decayTime) {
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, peak * decayTo),
      t0 + attack + decayTime
    );
  }
  _voiceHandle(oscs, outGain, revSend) {
    const ctx = this.ctx;
    return {
      oscs,
      outGain,
      release: () => {
        const tr = ctx.currentTime;
        outGain.gain.cancelScheduledValues(tr);
        outGain.gain.setValueAtTime(outGain.gain.value, tr);
        outGain.gain.exponentialRampToValueAtTime(0.0001, tr + 0.4);
        setTimeout(() => {
          oscs.forEach(({ osc }) => {
            try { osc.stop(); osc.disconnect(); } catch {}
          });
          outGain.disconnect();
          revSend.disconnect();
        }, 600);
      },
    };
  }

  // ==========================================================
  // One-shot 鼓 & 贝斯（外部在 chord 触发时调用）
  // 策略：默认军鼓"动"；若当前音 == 上一次打鼓的音 → 底鼓"大"
  //      相同音第三次再回到军鼓，形成"动-大-动-大"的交替
  // ==========================================================
  triggerDrumShot(note) {
    if (!this.ctx || !this.params.drumShot) return;
    const t = this.ctx.currentTime + 0.005;
    const isRepeat = note != null && note === this._lastDrumNote;
    if (isRepeat) {
      // "大" — 底鼓
      this._kick(t);
      // 相同音再来一次 → 下次又回到军鼓
      this._lastDrumNote = null;
    } else {
      // "动" — 军鼓 + 轻 hat
      this._snare(t);
      this._hat(t, 0.022);
      this._lastDrumNote = note ?? null;
    }
  }
  triggerBassShot(rootNote) {
    if (!this.ctx || !this.params.bassShot) return;
    // 贝斯根音：根音下移两个八度，但不低于 MIDI 28
    const n = Math.max(28, rootNote - 24);
    this._bassHit(n, this.ctx.currentTime + 0.005);
  }

  _kick(t) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    g.gain.setValueAtTime(0.95, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g);
    g.connect(this.drumsBus);
    osc.start(t);
    osc.stop(t + 0.35);
  }
  _snare(t) {
    const ctx = this.ctx;
    // 正弦 "tone" 成分 —— 180→100Hz 的短促下滑，给"动"的实心感
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.08);
    const oscG = ctx.createGain();
    oscG.gain.setValueAtTime(0.55, t);
    oscG.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(oscG);
    oscG.connect(this.drumsBus);
    osc.start(t);
    osc.stop(t + 0.15);

    // 噪声 burst —— 中高频给"啪"感
    const src = ctx.createBufferSource();
    src.buffer = this._getNoiseBuf();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2000;
    bp.Q.value = 0.9;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1200;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.55, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(bp);
    bp.connect(hp);
    hp.connect(ng);
    ng.connect(this.drumsBus);
    src.start(t);
    src.stop(t + 0.18);
  }
  _hat(t, level = 0.03) {
    const ctx = this.ctx;
    const buf = this._getNoiseBuf();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level * 8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.drumsBus);
    src.start(t);
    src.stop(t + 0.09);
  }
  _getNoiseBuf() {
    if (this._noiseBuf) return this._noiseBuf;
    const ctx = this.ctx;
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;
    return buf;
  }

  // ==========================================================
  // 急停：握拳触发，瞬间 allOff + 下扫噪声
  // ==========================================================
  brake() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.allOff();
    const src = this.ctx.createBufferSource();
    src.buffer = this._getNoiseBuf();
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(4500, t);
    bp.frequency.exponentialRampToValueAtTime(220, t + 0.32);
    bp.Q.value = 4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.45);
  }

  _bassHit(note, t) {
    const ctx = this.ctx;
    const freq = midiToFreq(note);
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.6, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.bassBus);
    osc.start(t);
    osc.stop(t + 0.75);
  }
}

export const CHORDS = {
  major: [0, 4, 7, 12],     // 大三 + 八度
  minor: [0, 3, 7, 12],     // 小三 + 八度
  add9:  [0, 4, 7, 14],     // 大三 + 9
  maj7:  [0, 4, 7, 11],     // 大三 + 大七
  dom7:  [0, 4, 7, 10],     // 属七
  min7:  [0, 3, 7, 10],     // 小七
  dim:   [0, 3, 6, 9],      // 减七（Full dim7）
  sus4:  [0, 5, 7, 12],     // 挂四
};

export const CHORD_LABELS = {
  major: "Maj",
  minor: "min",
  add9: "Add9",
  maj7: "Maj7",
  dom7: "7",
  min7: "m7",
  dim: "dim",
  sus4: "sus4",
};

export function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export const audio = new AudioEngine();
