// =============================================================
// audio-engine.js — Web Audio 合成引擎 (v3)
// 新增：
//   - 4 种乐器音色: piano / ep / organ / pad
//   - bass / drum 从循环改成 one-shot (只在触发和弦时打一下头拍)
//   - setMasterVol / setVoice / toggleBassShot / toggleDrumShot
// =============================================================

export const VOICES = ["piano", "ep", "guzheng", "pad", "vocal"];
export const VOICE_LABELS = {
  piano: "钢琴",
  ep: "电钢",
  guzheng: "古筝",
  pad: "Pad",
  vocal: "唱诗班",
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
      case "ep":      return this._epVoice(note, gain);
      case "guzheng": return this._guzhengVoice(note, gain);
      case "pad":     return this._padVoice(note, gain);
      case "vocal":   return this._vocalVoice(note, gain);
      case "piano":
      default:        return this._pianoVoice(note, gain);
    }
  }

  // -- 唱诗班 "啊" (多人齐唱 + 颤音 + 共振峰 + 大混响) --
  _vocalVoice(note, gain) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const freq = midiToFreq(note);
    const { outGain, revSend } = this._makeOutput(0.95); // 极重混响 = 教堂感

    const sourceSum = ctx.createGain();
    sourceSum.gain.value = 0.22;
    const sources = [];

    // --- 颤音 LFO：5.5Hz 约 25 cents 深度，模拟人声 vibrato ---
    const vibrato = ctx.createOscillator();
    vibrato.type = "sine";
    vibrato.frequency.value = 5.5;
    const vibDepth = ctx.createGain();
    vibDepth.gain.value = freq * 0.014; // ~25 cents
    vibrato.connect(vibDepth);
    sources.push({ osc: vibrato });

    // --- 4 路微失调 sawtooth：多人齐唱 chorus 感 ---
    for (const det of [-22, -8, 8, 22]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.detune.value = det;
      vibDepth.connect(osc.frequency);
      osc.connect(sourceSum);
      sources.push({ osc });
    }
    // --- 1 路 triangle 低八度：给胸腔共鸣感 ---
    const sub = ctx.createOscillator();
    sub.type = "triangle";
    sub.frequency.value = freq * 0.5;
    vibDepth.connect(sub.frequency);
    const subG = ctx.createGain();
    subG.gain.value = 0.35;
    sub.connect(subG);
    subG.connect(sourceSum);
    sources.push({ osc: sub });

    // --- "啊" 元音共振峰：F1=730 / F2=1090 / F3=2440 ---
    const FORMANTS = [
      { f: 730,  Q: 10, g: 1.0 },
      { f: 1090, Q: 11, g: 0.65 },
      { f: 2440, Q: 12, g: 0.3 },
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

    // --- 一点气声：白噪声高通，模拟呼吸 ---
    const noise = ctx.createBufferSource();
    noise.buffer = this._getNoiseBuf();
    noise.loop = true;
    const noiseHP = ctx.createBiquadFilter();
    noiseHP.type = "highpass";
    noiseHP.frequency.value = 3000;
    const noiseG = ctx.createGain();
    noiseG.gain.value = 0.025;
    noise.connect(noiseHP);
    noiseHP.connect(noiseG);
    noiseG.connect(mix);
    sources.push({ osc: noise });

    mix.connect(outGain);

    // 启动所有振荡器
    sources.forEach(({ osc }) => { try { osc.start(t0); } catch {} });
    // 慢起慢落 —— 唱诗班典型包络
    this._adsr(outGain, t0, 0.55, 0.38 * gain, 0.9, 2.4);
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

  // -- 古筝 (拨弦亮度扫 + 快起超长尾 + 轻 pitch-drop) --
  _guzhengVoice(note, gain) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const freq = midiToFreq(note);
    const { outGain, revSend } = this._makeOutput(0.45);

    // 亮度扫：high → mid，模拟"嘣"的一下拨弦后归于柔和
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(7000, t0);
    lp.frequency.exponentialRampToValueAtTime(1400, t0 + 1.2);
    lp.Q.value = 1.0;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 110;

    const mid = ctx.createGain();
    mid.gain.value = 1;
    mid.connect(hp);
    hp.connect(lp);
    lp.connect(outGain);

    // 多泛音 + 轻微 detune 让弦更"活"
    const partials = [
      { ratio: 1,     level: 1.00, type: "triangle", det: 0 },
      { ratio: 2,     level: 0.50, type: "triangle", det: -3 },
      { ratio: 3.002, level: 0.32, type: "sine",     det: 4 },
      { ratio: 4,     level: 0.18, type: "sine",     det: 0 },
      { ratio: 5.01,  level: 0.10, type: "sine",     det: -2 },
      { ratio: 6,     level: 0.06, type: "sine",     det: 3 },
    ];
    const oscs = [];
    for (const p of partials) {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.detune.value = p.det;
      // 轻微 pitch drop —— 模拟拨弦瞬间的微微松紧
      const f = freq * p.ratio;
      osc.frequency.setValueAtTime(f * 1.006, t0);
      osc.frequency.exponentialRampToValueAtTime(f, t0 + 0.07);
      const g = ctx.createGain();
      g.gain.value = p.level;
      osc.connect(g);
      g.connect(mid);
      osc.start(t0);
      oscs.push({ osc, g });
    }

    // 快起 + 超长指数衰减（~3 秒尾音）
    this._adsr(outGain, t0, 0.005, 0.58 * gain, 0.04, 3.0);
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
