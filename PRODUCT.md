# PartyKeys · ChordHand

<p align="center"><img src="logo.svg" width="88" alt="PartyKeys" /></p>

<p align="center">
  <b>One hand plays. The other paints.</b><br/>
  <i>一手弹琴，一手涂色 —— 空气中的和弦色彩器</i>
</p>

<p align="center">
  🌐 <a href="https://chordhand.partykeys.org">chordhand.partykeys.org</a>
</p>

---

## 1. 产品定位 · Product Vision

**中文**
PartyKeys ChordHand（中文名「音乐密码」）是一件**浏览器端的手势乐器**。用户一只手在 MIDI 键盘上按根音，另一只手抬起进入摄像头画面，通过手的位置选择和弦色彩。不需要和弦理论基础，也能"画"出 Maj7、Add9、m7、sus4、dim、Dom7 等不同的音乐情绪。

**English**
PartyKeys ChordHand is a **browser-based gesture instrument**. One hand plays the root note on your MIDI keyboard, the other hand moves through the camera view to pick a chord color. No music theory needed — you can "paint" complex jazz chords (Maj7, Add9, m7, sus4, dim, Dom7) just by moving a hand through the air.

---

## 2. 核心体验 · Core Experience

```
MIDI 键盘(单音) + 空中手势(和弦色彩) = 实时编排的和弦进行
MIDI keyboard root + gesture color = live-arranged chord progression
```

| 步骤 Step | 操作 Action | 中文 | English |
|---|---|---|---|
| ① | 启动 | 点击页面中央启动键，授权摄像头和 MIDI | Click the center Start button, grant camera + MIDI access |
| ② | 按根音 | 在键盘上按一个单音，比如 C | Play a root note on your MIDI keyboard, e.g. C |
| ③ | 抬起另一只手 | 手掌进入摄像头画面 | Raise your other hand into the camera view |
| ④ | 移动选择 | 手在 8 个区域切换色彩 | Move through 8 zones to pick a chord color |
| ⑤ | 听 | 听根音 + 选中色彩的和弦 | Hear the full chord built on your root |

**中心 = 大三/小三**（Major / minor）· **外环 = 6 种色彩延伸**（Maj7 / Add9 / 7 / m7 / dim / sus4）

---

## 3. 功能清单 · Feature List

### 3.1 8 区和弦盘 · 8-Zone Chord Dial

| 区 Zone | 和弦 Chord | 情绪 Emotion (ZH) | Emotion (EN) | 颜色 Hue |
|---|---|---|---|---|
| **中心上** Center top | Major (大三) | — | — | 蓝 Blue |
| **中心下** Center bottom | minor (小三) | — | — | 紫 Purple |
| 右上 Upper-right | Add9 | 开心 | Happy | 🟡 黄 (45°) |
| 正上 Top | Maj7 | 温暖 | Warm | 🟠 橙 (28°) |
| 左上 Upper-left | sus4 | 期待 | Hopeful | 🔵 天蓝 (200°) |
| 左下 Lower-left | dim | 紧张 | Tense | 🔴 红 (0°) |
| 正下 Bottom | m7 | 忧郁 | Sad | 🟣 靛 (230°) |
| 右下 Lower-right | 7 (Dom7) | 蓝调 | Blues | 🟣 紫 (280°) |

**标签模式切换 · Label Mode Toggle**
- `情绪 Emotion` (默认 default): 显示情绪词 + 情绪色底纹 / shows emotion words + tinted background
- `和弦 Chord`: 显示 Maj7/Add9 等和弦名 / shows standard chord names

### 3.2 音色库 · Instrument Library

5 种内置合成音色（Web Audio API 手工合成）:

| 键 Key | 中文 | English | 特征 Character |
|---|---|---|---|
| `piano` | 钢琴 | Piano | 多泛音 + 短 decay / bright attack, short decay |
| `ep` | 电钢 | E-Piano | Rhodes 风 —— tine 金属铛 + 5.5Hz tremolo + 长 sustain |
| `acoustic` | 木吉他 | Acoustic | 箱体共鸣峰 120Hz + 指尖噪声 + 2s 尾音 |
| `electric` | 电吉他 | Electric | Mid-boost 1.4kHz + sawtooth 咬弦 + 2.4s sustain |
| `pad` | Pad | Pad | 缓起 + 低通扫描 + 重混响 |

### 3.3 节奏点缀 · Rhythm Accents

- **🎸 贝斯 / Bass**: 每次触发和弦打一下根音下移两个八度的贝斯音
- **🥁 鼓 / Drum**: 每次按键打一下鼓；**同一个音连弹**时会在"军鼓（动）"和"底鼓（大）"之间自动交替，形成"动—大—动—大"的节奏型

### 3.4 键盘映射 · Keyboard Mapping

支持 13 个音（C → 下一个 C，含首尾）。动态八度切换 `C2-C3` 到 `C6-C7`。

**电脑键盘 Fallback**（无 MIDI 设备时）:
```
白键 White:  A  S  D  F  G  H  J  K    (C D E F G A B C)
黑键 Black:  W  E     T  Y  U          (C♯ D♯ F♯ G♯ A♯)
```

### 3.5 手势盘位置 · Hand Zone Position

左侧 3 段按钮切换手势盘在屏幕上的位置（避免挡脸）：
- `偏左 Left` — 圆环移到屏幕左侧，手抬到画面左边使用
- `居中 Middle` — 默认
- `偏右 Right` — 圆环移到屏幕右侧

圆环的视觉位置 + 手势判定中心**同步移动**，检测和视觉永远对齐。

### 3.6 外环粘滞墙 · Outer Ring Sticky Wall

外环选中任一和弦后，**手不小心滑出检测区**或**瞬时被遮挡**时，系统会保留上一次选中的和弦最多 **1 秒**，避免抖动误切。用户继续弹键盘仍然能准确触发预期的和弦。

### 3.7 摄像头透明度 · Camera Opacity

右侧垂直拉条，实时调节摄像头画面透明度（0–100%），默认 22%。

### 3.8 语言切换 · Language Toggle

- 默认跟随系统语言（`navigator.language`），非中文一律默认英文
- 顶栏右上 `EN / 中` 任意切换，选择会存在 `localStorage`
- 英文品牌名 **PartyKeys**，中文品牌名 **音乐密码**

---

## 4. 使用指南 · User Guide

### 4.1 上手 5 步 · Getting Started

**ZH**
1. 浏览器打开 https://chordhand.partykeys.org
2. 连接 MIDI 键盘（PartyKeys 36 Keys 或任意通用 MIDI 设备）
3. 点中央大圆按钮，授权摄像头 + MIDI
4. 看到首次引导，点 "开始"
5. 一只手按琴键，另一只手举起到画面中

**EN**
1. Open https://chordhand.partykeys.org in Chrome/Edge
2. Plug in your MIDI keyboard
3. Click the big center Start button, grant camera + MIDI permissions
4. See the onboarding, click "Let's play"
5. Play a root on the keyboard, raise the other hand into the camera

### 4.2 顶栏控制 · Top Controls

| 位置 Position | 控件 Control | 用途 Purpose |
|---|---|---|
| 左 Left | Logo + Brand | 品牌标识 |
| 中 Center | 3 状态 chip | MIDI / 摄像头 / 当前模式 |
| 右 Right | `EN / 中`, 键盘模式, `?` | 语言、键盘 fallback、帮助 |

### 4.3 中下条 · Sub-bar

**八度 Octave** · **音量 Volume** · **音色 Instrument** · **节奏 Rhythm**

---

## 5. 键盘 Fallback · Keyboard Fallback Mode

没有 MIDI 键盘时，点顶栏 `键盘模式 / Keyboard Mode`，浮窗会展示键位图：

```
  白键 White:  [A] [S] [D] [F] [G] [H] [J] [K]
                C   D   E   F   G   A   B   C
  黑键 Black:  [W][E]    [T][Y][U]
                C♯  D♯    F♯  G♯  A♯
```

**再点一次**切回 MIDI 模式（按钮文字变成 "MIDI Mode / MIDI 模式"）。

---

## 6. 技术架构 · Technical Architecture

### 6.1 技术栈 · Stack

- **纯静态网页** — 无打包步骤，直接静态文件部署
- **ES Modules** — 原生浏览器 module，不走任何 bundler
- **Web MIDI API** — MIDI 输入
- **Web Audio API** — 所有音色手工合成（无音频文件）
- **MediaPipe Tasks Vision 0.10.14** — HandLandmarker，走 GPU delegate
- **Canvas 2D** — 和弦盘 / 键盘可视化 / 手部叠加

### 6.2 文件结构 · File Structure

```
ChordHand/
├── index.html              # 入口 + 启动阻塞检查
├── logo.svg                # 品牌 Logo
├── vercel.json             # Vercel 配置（缓存 + headers）
├── css/
│   └── styles.css          # 全部样式
├── js/
│   ├── main.js             # 应用入口 + 事件编排
│   ├── i18n.js             # 中英双语字典 + 动态切换
│   ├── midi-input.js       # Web MIDI 封装 + 13 音 fold
│   ├── hand-tracker.js     # MediaPipe 双手追踪 (30fps)
│   ├── mode-machine.js     # 模式判定 + 位置派生 + 粘滞墙
│   ├── audio-engine.js     # 5 音色 + 混响 + one-shot drum/bass
│   ├── dial-ui.js          # 8 区和弦盘 (离屏静态缓存)
│   ├── hud-ui.js           # 底部彩虹键盘
│   └── keyboard-fallback.js # 电脑键盘模拟 MIDI
├── PRODUCT.md              # 本文档
├── DEPLOY.md               # 部署攻略
└── README.md               # 项目入口
```

### 6.3 关键设计决策 · Design Decisions

1. **手势识别限 30fps** — MediaPipe 推理最耗 CPU，30fps 对手势判定足够，大幅降低持续占用
2. **Dial 静态层离屏缓存** — 几何 + 底色一次性画到 offscreen canvas，每帧只画选中高亮 + 光标 + 标签
3. **标签全部在动态层** — 避免静态层小字 vs 动态层大字的"双字重影"
4. **模式判定 180ms 去抖** — 手短暂跨过 Y 阈值不会误切模式
5. **外环 1s 粘滞** — 滑动过程短暂丢手不会误清除 quadrant
6. **离屏 canvas 尺寸只在 ResizeObserver 事件时 setTransform** — 避免每帧 `getBoundingClientRect` 造成的 layout 抖动
7. **Hero 启动屏启动后 `display:none`** — 彩虹键盘 + 启动按钮动画彻底从合成层移除
8. **键盘模式可切回** — `enableKeyboardFallback / disableKeyboardFallback` 成对，切换时把按着的虚拟音全 noteOff 防止卡音

---

## 7. 浏览器支持 · Browser Support

| 浏览器 Browser | 支持 Supported | 原因 Reason |
|---|---|---|
| Chrome 90+ | ✅ | 完全支持 |
| Edge 90+ | ✅ | 完全支持 |
| Firefox | ❌ | 不支持 Web MIDI |
| Safari | ❌ | 不支持 Web MIDI |
| 手机浏览器 Mobile | ⚠️ 有限 | 摄像头 + MIDI 支持参差 |

**必需条件 Required**:
- HTTPS (localhost 也行)
- Chromium 内核浏览器
- 摄像头 + MIDI 权限

页面会在启动时做阻塞性检测，不满足会直接显示引导浮层。

---

## 8. 部署 · Deployment

### 8.1 线上地址 · Production URL

- `https://chordhand.partykeys.org` — 主域 custom domain
- `https://chordhand.vercel.app` — Vercel 默认域

### 8.2 推送流程 · Push Workflow

```bash
# 一键同步 Claude 会话 + commit + push
~/Desktop/ChordHand/push.sh "commit message"

# 或不带 message 默认 "update"
~/Desktop/ChordHand/push.sh
```

Vercel 收到 push 后约 30 秒自动部署。

### 8.3 本地开发 · Local Dev

```bash
cd ~/Desktop/ChordHand
python3 -m http.server 8080
# 浏览器访问 http://localhost:8080
```

或双击 `start.command` / `启动.command`。

详细部署步骤（含首次设置、DNS、Vercel Root Directory 等）见 [DEPLOY.md](./DEPLOY.md)。

---

## 9. 版本历史 · Changelog

### v1.0 (2026-04)
- ✅ 8 区和弦盘（中心 Major/minor + 外环 6 色彩）
- ✅ 5 种音色（piano / e-piano / acoustic / electric / pad）
- ✅ 13 音 + 动态八度切换
- ✅ 中英双语 + 跟随系统
- ✅ 彩虹键盘开机屏 + 固定发光
- ✅ 外环情绪标签 + 情绪色
- ✅ 手势盘左中右位置切换
- ✅ 外环 1s 粘滞墙
- ✅ 贝斯 + 鼓 one-shot（同音连弹军鼓/底鼓交替）
- ✅ 键盘 fallback（可切回 MIDI）
- ✅ 摄像头透明度调节
- ✅ 首次使用引导

---

## 10. 名词表 · Glossary

| 术语 Term | 中文 | 说明 Description |
|---|---|---|
| Root | 根音 | 和弦的最低基础音，由 MIDI 键盘单音决定 |
| Chord color | 和弦色彩 | 在根音上叠加的音程组合（Maj7/Add9/m7 等） |
| Quadrant | 象限 | 8 区和弦盘的任一个区域 |
| Pad | 手势判定区 | 摄像头画面中用来映射手位置的矩形区域 |
| Sticky wall | 粘滞墙 | 外环选中后的 1 秒保持机制 |
| Hero screen | 开机屏 | 启动前的全屏欢迎界面 |

---

<p align="center">
  <i>Made with ❤️ by PartyKeys · 视感科技</i>
</p>
