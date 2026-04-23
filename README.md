# PartyKeys · ChordHand

<p align="center"><img src="logo.svg" width="72" alt="PartyKeys" /></p>

<p align="center">
  <b>One hand plays. The other paints.</b><br/>
  <i>一手弹琴 · 一手指尖涂抹和弦色彩</i>
</p>

<p align="center">
  🌐 <a href="https://chordhand.partykeys.org">chordhand.partykeys.org</a>
</p>

---

## Quick Links · 快速导航

| 文档 Document | 内容 Content |
|---|---|
| 📖 [PRODUCT.md](./PRODUCT.md) | **产品说明书** · 完整双语产品文档、功能清单、使用指南、技术架构 |
| 🚀 [DEPLOY.md](./DEPLOY.md) | **部署攻略** · GitHub → Vercel → 自定义域名 全流程 |
| 💻 [启动.command](./启动.command) / [start.command](./start.command) | **macOS 一键启动本地预览** |

---

## What is this? · 这是什么

**EN** —
A browser-based gesture instrument. One hand plays a root note on your MIDI keyboard, the other hand enters the camera view and picks a chord color by moving through 8 zones: center top = Major, center bottom = minor, outer 6 = Maj7 · Add9 · 7 · m7 · dim · sus4. No music theory needed.

**中文** —
一件浏览器端的手势乐器。一只手在 MIDI 键盘上按根音，另一只手抬进摄像头，在 8 个区域之间移动选择和弦色彩：中心上 = 大三，中心下 = 小三，外环 6 区 = Maj7 · Add9 · 7 · m7 · dim · sus4。不需要和弦理论基础。

---

## Try it · 试一下

### 线上 Online
直接访问 **https://chordhand.partykeys.org**（需 Chrome / Edge + MIDI 键盘）

### 本地 Local
```bash
cd PartyKeys
python3 -m http.server 8080
# 浏览器访问 http://localhost:8080
```

或双击 `启动.command` / `start.command`。

⚠️ **不能双击 `index.html`** — `file://` 协议下浏览器禁用 Web MIDI / 摄像头 / ES Modules。页面会自动弹引导。

---

## Requirements · 运行要求

| | EN | 中文 |
|---|---|---|
| **Browser** | Chrome / Edge (Chromium-based) | Chrome / Edge |
| **Protocol** | HTTPS or localhost | HTTPS 或 localhost |
| **MIDI Device** | Any USB MIDI keyboard (optional — keyboard fallback available) | 任意 USB MIDI 键盘（可选，有电脑键盘 fallback） |
| **Camera** | Any webcam | 任意摄像头 |

Firefox / Safari 不支持（Web MIDI 缺失）。

---

## Feature Highlights · 功能亮点

- 🎹 **5 合成音色** Piano / E-Piano / Acoustic / Electric / Pad
- 🎨 **情绪标签模式** 外环显示 Happy / Warm / Hopeful / Tense / Sad / Blues + 情绪色
- 🔀 **左右中位置切换** 圆环可移到屏幕左/中/右，不挡脸
- 🧲 **1s 粘滞墙** 手滑出外环 1 秒内自动保持，防抖动
- 🎸 **贝斯 + 鼓 one-shot** 每次按键打一下，同音连弹切换军鼓/底鼓
- 🌐 **中英双语** 跟随系统语言，可手动切换
- ⌨️ **键盘 fallback** 无 MIDI 设备时用 `ASDFGHJK + WE TYU`
- 🎥 **摄像头透明度** 可调节画面透明度避免干扰

完整功能列表见 [PRODUCT.md](./PRODUCT.md#3-功能清单--feature-list)。

---

## Architecture Overview · 架构概览

```
用户手势                 MIDI 键盘
    ↓                      ↓
MediaPipe HandLandmarker  Web MIDI API
    ↓                      ↓
  mode-machine.js  ←  midi-input.js
       ↓                  ↓
   dial-ui.js       audio-engine.js  ←  5 音色 + 贝斯 + 鼓
       ↓                  ↓
   Canvas 2D       Web Audio Graph
       ↓                  ↓
     显示                声音
```

详细设计决策 + 文件职责见 [PRODUCT.md § 6](./PRODUCT.md#6-技术架构--technical-architecture)。

---

## Deploy · 部署

推送到 `PartyBohan/ChordHand` 仓库主分支，Vercel 自动部署到 `chordhand.partykeys.org`。

```bash
~/Desktop/ChordHand/push.sh "your commit message"
```

`push.sh` 会自动从 Claude 会话同步最新文件 → git commit → git push → Vercel 在 30 秒内重部署。详见 [DEPLOY.md](./DEPLOY.md)。

---

## License · 许可

Internal prototype · PartyKeys / 视感科技 © 2026

---

<p align="center">
  <i>If you're reading this and want to extend it, start with <a href="./PRODUCT.md">PRODUCT.md § 6</a> for architecture.</i>
</p>
