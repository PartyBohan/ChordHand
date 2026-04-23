// =============================================================
// i18n.js — 中英双语系统
//   - 默认跟随系统语言（navigator.language）
//   - 系统非中文 → 英文
//   - 用 localStorage 记住用户手选
//   - 文本通过 data-i18n="key" 标注
//   - 属性通过 data-i18n-attr="title:key,placeholder:key2" 标注
// =============================================================

const DICT = {
  en: {
    page_title: "PartyKeys — Gesture × Keys",
    brand_name: "PartyKeys",
    brand_tag: "ChordHand",
    // Hero
    hero_brand_name: "PartyKeys",
    hero_brand_sub: "ChordHand",
    slogan_main: "One hand plays. The other paints.",
    slogan_sub: "Notes in your fingers, chord colors in the air.",
    start: "Start",
    start_hint: "Tap to begin",
    hero_foot: 'First launch requires <b>Camera</b> + <b>MIDI</b> permissions · Chrome / Edge only',
    // Controlbar
    label_octave: "Octave",
    label_volume: "Volume",
    label_voice: "Voice",
    label_rhythm: "Rhythm",
    voice_piano: "Piano",
    voice_ep: "E-Piano",
    voice_organ: "Organ",
    voice_pad: "Pad",
    voice_vocal: "Vocal",
    btn_bass: "🎸 Bass",
    btn_drum: "🥁 Drum",
    tip_oct_down: "Octave down",
    tip_oct_up: "Octave up",
    tip_bass: "Play bass root on chord trigger",
    tip_drum: "Hit a drum on every note",
    // Topbar
    btn_kbd: "Keyboard Mode",
    btn_kbd_title: "Use computer keyboard as MIDI",
    btn_kbd_active: "Keyboard ✓",
    btn_kbd_active_status: "Computer keyboard enabled",
    kbd_tip_title: "Play without a MIDI keyboard",
    kbd_tip_white: "White",
    kbd_tip_black: "Black",
    btn_help_title: "Help",
    // Statuses
    chip_midi_prefix: "MIDI",
    chip_cam_prefix: "Camera",
    midi_waiting: "Waiting for permission…",
    midi_denied: "Permission denied",
    midi_unsupported: "Browser not supported",
    midi_none: "No MIDI device",
    midi_pk: "PartyKeys connected",
    midi_generic_suffix: "connected",
    midi_not_connected: "Not connected",
    cam_waiting: "Waiting for permission…",
    cam_connected: "Camera connected",
    cam_denied: "Permission denied",
    cam_not_connected: "Not connected",
    // Mode chip
    mode_idle: "Idle",
    mode_normal: "Normal",
    mode_chord: "Chord",
    // Dial caption
    dial_left_plays: "Left hand plays · ",
    dial_right_plays: "Right hand plays · ",
    dial_left_gesture: "left hand → any zone triggers",
    dial_right_gesture: "right hand → any zone triggers",
    dial_hint_default: "Raise a hand to pick a chord",
    // Loading
    loading_brand: "Starting PartyKeys",
    loading_audio: "Starting audio engine",
    loading_model: "Downloading hand model",
    loading_model_sub: "(~5MB, first launch only)",
    loading_camera: "Requesting camera access",
    loading_midi: "Requesting MIDI access",
    loading_hint: "First launch takes 5–20s; cached afterwards.",
    // Help panel
    help_title: "Quick Start",
    help_badge_normal: "NORMAL",
    help_badge_chord: "CHORD",
    help_normal: "<b>Both hands on the keyboard</b> → normal MIDI notes.",
    help_chord: "<b>One hand plays, the other hovers</b><br/><small>The raised hand picks chord color in <b>8 zones</b>:<br/>· Center top = <span class='tag'>Major</span>　Center bottom = <span class='tag'>minor</span><br/>· Outer 6 (clockwise): <span class='tag'>Maj7</span> · <span class='tag'>Add9</span> · <span class='tag'>7</span> · <span class='tag'>m7</span> · <span class='tag'>dim</span> · <span class='tag'>sus4</span><br/>Pressing a note triggers the whole chord rooted on it.</small>",
    help_foot: "Top bar: octave · volume · voice (Piano / E-Piano / Organ / Pad / Vocal) · bass/drum one-shot.",
    help_kbd: "No PartyKeys? Tap <b>Keyboard Mode</b> and use <kbd>A S D F G H J K</kbd> for 8 white keys, <kbd>W E T Y U</kbd> for 5 black keys (follows current octave).",
    help_close: "Got it",
  },
  zh: {
    page_title: "音乐密码 — 手势 × 琴键 交互乐器",
    brand_name: "音乐密码",
    brand_tag: "ChordHand",
    hero_brand_name: "音乐密码",
    hero_brand_sub: "ChordHand",
    slogan_main: "一手弹琴，一手涂色",
    slogan_sub: "指尖弹音符，空中涂抹和弦色彩",
    start: "启 动",
    start_hint: "点击开始",
    hero_foot: "首次启动需要授权 <b>摄像头</b> 与 <b>MIDI</b> · 仅支持 Chrome / Edge",
    label_octave: "八度",
    label_volume: "音量",
    label_voice: "音色",
    label_rhythm: "节奏",
    voice_piano: "钢琴",
    voice_ep: "电钢",
    voice_organ: "风琴",
    voice_pad: "Pad",
    voice_vocal: "人声",
    btn_bass: "🎸 贝斯",
    btn_drum: "🥁 鼓",
    tip_oct_down: "低一个八度",
    tip_oct_up: "高一个八度",
    tip_bass: "按和弦时打一下贝斯根音",
    tip_drum: "每次按键打一下鼓（同音连弹切换军鼓/底鼓）",
    btn_kbd: "键盘模式",
    btn_kbd_title: "用电脑键盘模拟琴键",
    btn_kbd_active: "键盘 ✓",
    btn_kbd_active_status: "电脑键盘已启用",
    kbd_tip_title: "没有 MIDI 键盘？用电脑键盘弹",
    kbd_tip_white: "白键",
    kbd_tip_black: "黑键",
    btn_help_title: "帮助",
    chip_midi_prefix: "MIDI",
    chip_cam_prefix: "摄像头",
    midi_waiting: "等待授权…",
    midi_denied: "权限被拒绝",
    midi_unsupported: "浏览器不支持",
    midi_none: "未检测到 MIDI 设备",
    midi_pk: "PartyKeys 已连接",
    midi_generic_suffix: "已连接",
    midi_not_connected: "未连接",
    cam_waiting: "等待授权…",
    cam_connected: "摄像头已连接",
    cam_denied: "权限被拒绝",
    cam_not_connected: "未连接",
    mode_idle: "待机",
    mode_normal: "普通",
    mode_chord: "和弦模式",
    dial_left_plays: "左手弹琴 · ",
    dial_right_plays: "右手弹琴 · ",
    dial_left_gesture: "左手移动到任意区即触发",
    dial_right_gesture: "右手移动到任意区即触发",
    dial_hint_default: "抬起一只手指向方位",
    loading_brand: "音乐密码 正在启动",
    loading_audio: "启动音频引擎",
    loading_model: "下载手势识别模型",
    loading_model_sub: "(~5MB，仅首次)",
    loading_camera: "请求摄像头授权",
    loading_midi: "请求 MIDI 授权",
    loading_hint: "首次启动最慢 5–20 秒，之后模型走浏览器缓存秒开。",
    help_title: "玩法速览",
    help_badge_normal: "普通",
    help_badge_chord: "和弦",
    help_normal: "<b>双手都在键盘上</b> —— 正常 MIDI 单音发声。",
    help_chord: "<b>一只手弹琴 + 另一只手抬起</b><br/><small>抬起的那只手在 <b>8 个区域</b>切换和弦色彩：<br/>· 中心上半 = <span class='tag'>Major</span>　中心下半 = <span class='tag'>minor</span><br/>· 外环 6 区（顺时针从上起）：<span class='tag'>Maj7</span> · <span class='tag'>Add9</span> · <span class='tag'>7</span> · <span class='tag'>m7</span> · <span class='tag'>dim</span> · <span class='tag'>sus4</span><br/>按一个单音，整组和弦以该音为根音触发。</small>",
    help_foot: "顶部控制条：调八度 · 调音量 · 换音色（钢琴/电钢/风琴/Pad/人声）· 开关贝斯/鼓 one-shot。",
    help_kbd: "没有 PartyKeys 键盘？点「键盘模式」，用 <kbd>A S D F G H J K</kbd> 8 个白键（C→C），<kbd>W E T Y U</kbd> 5 个黑键。",
    help_close: "知道了",
  },
};

let _lang = "en";

export function detectLang() {
  try {
    const saved = localStorage.getItem("chordhand_lang");
    if (saved === "zh" || saved === "en") return saved;
  } catch {}
  const sys = (navigator.language || "").toLowerCase();
  return sys.startsWith("zh") ? "zh" : "en";
}

export function getLang() {
  return _lang;
}

export function t(key) {
  return (DICT[_lang] && DICT[_lang][key]) || key;
}

export function setLang(lang) {
  if (lang !== "en" && lang !== "zh") lang = "en";
  _lang = lang;
  try { localStorage.setItem("chordhand_lang", lang); } catch {}
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.body.dataset.lang = lang;
  // 翻译 textContent
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    const val = DICT[lang][key];
    if (val === undefined) return;
    if (val.indexOf("<") >= 0) el.innerHTML = val;
    else el.textContent = val;
  });
  // 翻译属性
  document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    const spec = el.dataset.i18nAttr || "";
    spec.split(",").forEach((pair) => {
      const parts = pair.split(":").map((x) => x.trim());
      if (parts.length !== 2) return;
      const [attr, key] = parts;
      const val = DICT[lang][key];
      if (val !== undefined) el.setAttribute(attr, val);
    });
  });
  // 页面标题
  if (DICT[lang].page_title) document.title = DICT[lang].page_title;
  // 激活语言按钮
  document.querySelectorAll(".lang-pill").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });
  // 广播
  window.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
}
