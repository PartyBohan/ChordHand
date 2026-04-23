# 架构与设计决策 · Architecture & Design Decisions

> 项目固化文档 —— 记录关键设计思路、踩过的坑、性能优化点。
> 所有未来的迭代都应先读这份文档再改代码。

---

## 1. 模块职责 · Module Responsibilities

| 文件 File | 职责 Responsibility | 对外 API |
|---|---|---|
| `main.js` | 应用入口 + 事件编排 + DOM 交互 | 无（`<script type="module">` 直接加载） |
| `i18n.js` | 双语字典 + 动态切换 + `data-i18n` / `data-i18n-attr` 驱动 | `detectLang()`, `setLang()`, `getLang()`, `t()` |
| `midi-input.js` | Web MIDI 封装 + 13 音 fold + 八度切换 | `midi`（EventTarget）, `getRange()`, `setOctaveIndex()` |
| `hand-tracker.js` | MediaPipe HandLandmarker 封装 + 30fps throttle + 坐标翻转 | `handTracker`（EventTarget "frame"） |
| `mode-machine.js` | 模式判定（IDLE/NORMAL/CHORD）+ 8 区 quadrant 派生 + 粘滞墙 | `modeMachine`, `setPadCenterX()`, `MODE`, `QUADRANT`, `QUADRANT_TO_CHORD` |
| `audio-engine.js` | Web Audio 合成 + 5 音色 + 贝斯/鼓 one-shot | `audio` 单例, `VOICES` |
| `dial-ui.js` | 8 区和弦盘 Canvas 渲染（离屏静态 + 动态层） | `ChordDial` 类, `setLabelMode()`, `invalidate()` |
| `hud-ui.js` | 底部彩虹键盘 Canvas | `Keybed` 类 |
| `keyboard-fallback.js` | 电脑键盘模拟 MIDI 注入 | `enableKeyboardFallback()`, `disableKeyboardFallback()` |

---

## 2. 关键数据流 · Data Flow

```
每帧 (per frame):
  MediaPipe.detectForVideo()
    → handTracker._processResult()
      → hands: { left: {palm, landmarks, ...} | null, right: ... }
        → modeMachine.update(hands, ts)
          ├─ 模式判定（Y 阈值 + 180ms 去抖）
          ├─ _derivePosition(hand, ts)
          │    ├─ 粘滞墙检查（外环 1s）
          │    ├─ 计算 padX, padY (clamped to ±1)
          │    ├─ 计算 dist
          │    ├─ if dist < CENTER_RADIUS → CENTER_UP/DOWN
          │    └─ else → 外环 60° 分扇区
          └─ dispatchEvent("update", state)

MIDI noteon:
  midi._handleMessage → fold 到当前八度 → "noteon" event
    → main.js 监听 → if mode=CHORD && quadrant → audio.chordOn()
                  → else → audio.noteOn()
```

---

## 3. 性能优化记录 · Performance Fixes

### 3.1 Dial 静态层离屏缓存
**问题**: 每帧 `getBoundingClientRect()` + `canvas.width=...` 强制 layout + 清空 canvas，是主要卡顿源。
**方案**: 构造时一次性 `_syncSize()`，之后用 `ResizeObserver` 监听尺寸变化。正常绘制完全不 touch layout。
**位置**: `dial-ui.js` `_syncSize()`
**收益**: GPU/CPU per-frame 消耗显著降低

### 3.2 标签全部画到动态层
**问题**: 静态层画了小字 non-selected，动态层又画了大字 selected，半透明渐变透出底下那份小字 → 双字叠影。
**方案**: 静态层只画几何 + 底色，**所有文字**（外环 6 标签 + 中心 Major/minor）全部在动态层绘制。
**位置**: `dial-ui.js` `_drawStatic()` vs `draw()`

### 3.3 30fps 节流
**问题**: MediaPipe 推理 + Canvas 渲染 + Web Audio 调度并行在 60fps 下满负荷。
**方案**:
- `hand-tracker._loop` 用 `ts - lastTs > 32` 限 30fps
- `main.js renderLoop` 也限 30fps
**位置**: `hand-tracker.js`, `main.js`

### 3.4 Dial dirty check
**问题**: 手静止时也每帧重画 dial。
**方案**: 比对 `quadrant / padX / padY / triggerFlash / padActive` 上次值，没变就 `return`。
**位置**: `dial-ui.js draw()`

### 3.5 Hero 启动后 display:none
**问题**: 彩虹键盘 + 启动按钮的 CSS 动画即便 `opacity:0` 仍在合成线程运行。
**方案**: `handleStart` 结束后 `elHero.style.display = "none"`。
**位置**: `main.js handleStart()`

### 3.6 Keybed 只在 noteon/off 时重画
**问题**: 底部键盘每帧重画，但没按键时画面永远一样。
**方案**: `state.keybedDirty` flag，noteon/noteoff 时置 true。
**位置**: `main.js`

### 3.7 移除 canvas desynchronized + shadowBlur
**问题**: `{ desynchronized: true }` 在某些驱动上导致 buffer 累积；canvas `shadowBlur` 在 fillText 周围产生重影。
**方案**: 用默认 context，用径向渐变替代 shadowBlur。
**位置**: `main.js` camera overlay context 创建；`dial-ui.js` 所有 shadowBlur

---

## 4. 关键设计决策 · Design Decisions

### 4.1 模式判定用 Y 阈值
- `Y_ON_KEYBOARD = 0.68`：手腕 Y > 0.68 算"在键盘上"
- `Y_RAISED = 0.58`：手腕 Y < 0.58 算"抬起"
- 中间区是缓冲带，防止边界抖动
- 180ms 去抖：模式切换需要稳定 180ms 才真正变化

### 4.2 外环检测用数学角度（非 canvas 角度）
- `Math.atan2(padY, padX)` 返回 -π..π
- 转 0..360：`if deg < 0: deg += 360`
- 每 60° 一个扇区，中心角 30/90/150/210/270/330
- `idx = Math.floor(deg / 60) % 6`
- 和 canvas 绘图时 y 轴翻转分开处理（绘图时用 `-zone.deg * π/180`）

### 4.3 手势盘位置 = 视觉 + 检测同步
- 点"偏左"时：
  - `setPadCenterX(0.25)` → 检测中心移到画面 x=0.25
  - `--dial-shift: -22vw` CSS 变量 → 圆环视觉向左平移
- 两者对齐，用户手抬到屏幕左边 = 圆环中心 = 检测中心

### 4.4 粘滞墙只对外环生效
- 中心 Major/minor 面积大，不需要保护
- 外环 60° 每扇区较窄，手抖或相机漏帧容易跳出
- 1 秒内保持上一次 quadrant：
  - `hand === null`（漏帧）→ 保持
  - `|rawX| > 1.3` 或 `|rawY| > 1.3`（明显滑出）→ 保持
  - 手正常移动到中心（`dist < CENTER_RADIUS`）→ 立即切换（不粘滞，因为是用户意图）

### 4.5 i18n 用 data-i18n 属性驱动
- 所有可翻译元素加 `data-i18n="key"`，文字内容通过字典映射
- 属性（如 title）加 `data-i18n-attr="title:key,placeholder:key2"`
- `setLang(lang)` 遍历所有 `[data-i18n]` 元素更新 textContent/innerHTML
- 动态渲染的文字（MIDI chip、mode chip、dial caption）在 JS 中用 `t(key)` 拿翻译，并在 `langchange` 事件时重新渲染

### 4.6 Dial 标签模式与情绪色
- 外环有两种显示模式：
  - `emotion`（默认）：情绪词（开心/温暖/期待/紧张/忧郁/蓝调）+ 对应色相底纹
  - `chord`：传统和弦名（Add9/Maj7/sus4/dim/m7/7）+ 中性白
- 中心 Major/minor **永远不变**
- 模式切换触发 `chordDial.invalidate()` → 重建离屏静态层

---

## 5. 已知限制 · Known Limitations

- **手左右判定**：`hand-tracker.js` 的 `swapHandedness = true` 针对自拍视角相机。如果在非镜像环境下手左右反了，切到 `false`
- **摄像头分辨率**：默认请求 1280×720，某些 USB 摄像头可能拿不到这个分辨率，MediaPipe 会自适应
- **MIDI 独占**：某些 DAW 会独占 MIDI 设备，必须退出 DAW 才能在浏览器使用
- **jsdelivr CDN**：MediaPipe 模型从 `cdn.jsdelivr.net` 拉，某些网络环境慢。如果被墙可以换镜像（在 `hand-tracker.js` 里改 `TASKS_VISION_CDN` / `WASM_BASE`）

---

## 6. 扩展指南 · Extension Guide

### 加一种新音色
1. `audio-engine.js`：
   - `VOICES` 数组加新 key
   - `VOICE_LABELS` 加中文标签
   - `_makeVoice()` switch 加 case
   - 写 `_newVoice(note, gain)` 返回 `this._voiceHandle(oscs, outGain, revSend)`
2. `index.html` voice-pills 加按钮 `<button class="cb-pill" data-voice="newKey" data-i18n="voice_newKey">...</button>`
3. `i18n.js` 两套字典都加 `voice_newKey`

### 改外环和弦类型
1. `mode-machine.js`：`QUADRANT` 加/改枚举，`QUADRANT_TO_CHORD` 映射到 `audio-engine.js` 的 `CHORDS` 键
2. `audio-engine.js`：`CHORDS` 字典加新和弦的音程数组
3. `dial-ui.js`：`OUTER_ZONES` 加 `{ q, deg, chord, subKey, emoKey, hue }`

### 改手势判定逻辑
- 所有手势判定都在 `mode-machine.js update()` 和 `_derivePosition()`
- 模式切换去抖时间 `_debounceMs = 180`
- 外环粘滞时间 `OUTER_STICKY_MS = 1000`

### 加新的侧面板控件
- HTML 加到 `#left-controls`（左侧栈）或新建右侧兄弟
- CSS 复用 `.side-panel` 基础类
- JS 用事件代理接上：`elPanel.addEventListener("click", ...)`

---

## 7. 测试清单 · Test Checklist

每次改动后过一遍：

- [ ] 开机屏彩虹键盘渲染正常，启动按钮可点
- [ ] 启动后 MIDI + 摄像头授权弹窗
- [ ] 授权后 chip 变绿
- [ ] 中英切换所有 UI 文字都变
- [ ] 连上 MIDI 键盘，按键发声
- [ ] 抬起一只手 → 圆环出现 + 蓝色光标跟随
- [ ] 光标到 8 个区域 → 高亮正确、标签变大清晰
- [ ] 手滑出检测区 1 秒内 → 保持上一次 quadrant（粘滞）
- [ ] 连续弹同一个音 → 鼓"动—大—动—大"交替
- [ ] 八度 ± 正常
- [ ] 音色切换 5 种都能出声
- [ ] 情绪 ↔ 和弦 标签模式切换后圆环立即更新
- [ ] 左/中/右手势位置按钮都能挪动圆环 + 手势区
- [ ] 摄像头透明度拉条生效
- [ ] 键盘模式启用 + 可切回
- [ ] 帮助面板 + 首次引导能打开 / 关闭

---

<p align="center">
  <i>Last consolidated: 2026-04-23</i>
</p>
