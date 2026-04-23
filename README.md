# PartyKeys — 手势 × 琴键 交互乐器

一个围绕 **PartyKeys 36 Keys** MIDI 键盘 + **电脑摄像头** 的浏览器端交互乐器原型。
一只手弹琴，另一只手悬在屏幕前用手势操控声音。

---

## 核心交互

**判定规则**：摄像头追踪双手，通过手的高度决定当前模式：
- 双手都在键盘上 → **普通模式**（正常 MIDI 发声）
- 左手在键盘上 + 右手举起 → **和弦模式**
- 右手在键盘上 + 左手举起 → **旋律模式**

### 🎹 和弦模式（左手弹，右手指方位）
主屏幕出现一个 4 方位圆盘，右手在摄像头前移动选择方位：

| 方位 | 和弦 | 感觉 | 音程 |
|------|------|------|------|
| 上 | Add9 | 快乐明亮 | 根 + 大三 + 五度 + 九度 |
| 右 | M7 | 温暖 | 根 + 大三 + 五度 + 大七 |
| 下 | 7 | 蓝调 | 根 + 大三 + 五度 + 小七 |
| 左 | sus4 | 悬浮 | 根 + 纯四 + 五度 + 八度 |

选中方位后，左手在键盘上弹任何一个单音 → 以该音为根音触发整个和弦。

### 🎵 旋律模式（右手弹，左手控）
右手弹旋律的同时，左手在摄像头前叠加效果：

| 手势 | 效果 |
|------|------|
| 手抬高 | 音量上升 + 混响加深 |
| 手掌张开 | 鼓机 + 贝斯加入 |
| 手腕旋转 | 颤音 / 滑音 |
| 握拳 | 急停刹车（白噪声下扫 + 瞬间静音） |

---

## 运行方式

> ⚠ **不能双击 index.html 直接打开**。浏览器的 `file://` 协议禁用 Web MIDI、摄像头、ES modules。必须用本地 HTTP server 从 `http://localhost:...` 打开。

**最简单 —— macOS 直接双击**：

在 Finder 里双击 **`启动.command`**（首次请 **右键 → 打开**，跳过 Gatekeeper 警告）。
终端会自动打开，HTTP server 起好后浏览器会跳到 `http://localhost:8080`。

**一键启动脚本**（macOS / Linux 终端）：

```bash
cd PartyKeys
chmod +x run.sh   # 首次需要加执行权限
./run.sh          # 启动 HTTP server + 自动开浏览器
```

**或手动**：

```bash
cd PartyKeys
python3 -m http.server 8080
# 浏览器访问 http://localhost:8080
```

**浏览器要求**：**Chrome / Edge** —— Web MIDI API 目前 Firefox / Safari 都不支持。

**权限**：点页面上的「启动」按钮后，浏览器会依次弹出：
1. 摄像头访问 → 允许
2. MIDI 设备访问 → 允许

如果没弹出授权提示，看页面顶部红色警告条——绝大多数情况是 `file://` 协议没用 HTTP server 打开。

### 键位范围

当前版本**只使用一个八度：C4–B4**（MIDI 60–71）。超出此范围的琴键会被折叠到这个八度里。

**没有 PartyKeys 键盘？** 点「电脑键盘模式」：
- 白键：<kbd>A S D F G H J</kbd> → C4 D4 E4 F4 G4 A4 B4
- 黑键：<kbd>W E T Y U</kbd> → C#4 D#4 F#4 G#4 A#4

---

## 技术栈

- **Web MIDI API** — 读 PartyKeys 36 Keys 输入
- **MediaPipe Tasks Vision HandLandmarker**（CDN） — 双手追踪 + 21 关键点
- **Web Audio API** — 钢琴多泛音合成、鼓机（合成）、贝斯、FB-delay 混响、LFO 颤音
- **Vanilla JS (ES Modules)** — 零构建，直接丢 HTTP server 上跑

## 文件结构

```
PartyKeys/
├── index.html               # 入口
├── css/styles.css           # 样式
├── js/
│   ├── main.js              # 主入口：粘合所有模块
│   ├── midi-input.js        # Web MIDI 输入 + keyboard fallback 注入口
│   ├── hand-tracker.js      # MediaPipe 双手追踪
│   ├── mode-machine.js      # 模式状态机 + 手势派生
│   ├── audio-engine.js      # Web Audio 合成引擎（钢琴/鼓/贝斯/效果）
│   ├── dial-ui.js           # 4 方位圆盘 Canvas 渲染
│   ├── hud-ui.js            # 旋律 HUD + 键盘底部可视化
│   └── keyboard-fallback.js # 电脑键盘模拟 MIDI
└── README.md
```

---

## 已知限制 / v2 待办

- 摄像头的「左右手」判定在不同摄像头/分辨率下偶尔会反。如果模式切错，在 `hand-tracker.js` 里把 `swapHandedness` 改成 `false`。
- 鼓机和贝斯 BPM 固定 96，未与当前演奏同步。
- 混响用的是 FB delay，不是真正的卷积混响。若需真实感可以换 ConvolverNode + IR 采样。
- 目前没有发 SysEx 做 LED 反馈。如果想打通，参考 CLAUDE.md 里的 PartyKeys LED 协议，在 `main.js` 的和弦触发处调用 SysEx 点灯。
- 和弦模式下没选中方位（手没举高或太靠近中心）时，退化成弹单音——如果希望强制要求选中才响应，在 `main.js` 的 `noteon` 监听里把 fallback 删掉。
