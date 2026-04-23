# 部署攻略 — chordhand.partykeys.org

> 目标：把当前 `PartyKeys/` 目录发到 **https://chordhand.partykeys.org**
> 技术栈：纯静态（HTML + JS + CSS，无构建），Vercel 拖一下就能跑。

---

## 一、前提条件（5 分钟自查）

- [ ] 有 GitHub 账号（建议用 `PartyBohan` 组织，和已有的 PartyKeysArcade 放一起）
- [ ] 有 Vercel 账号，且已授权 GitHub（https://vercel.com/new）
- [ ] 有 `partykeys.org` 域名的 **DNS 控制台访问权**（Cloudflare / Namecheap / GoDaddy 都行）
- [ ] 本地装了 `git` 和 Chrome（Web MIDI 只有 Chromium 系能用）

---

## 二、推荐路径：独立仓库 → Vercel → 绑子域

### Step 1　把 `PartyKeys/` 推到 GitHub 新仓库

在 GitHub 网页上 **New repository**：
- Owner：`PartyBohan`（或个人账号）
- Repo name：`ChordHand`（建议和线上子域对齐，便于维护）
- Public / Private 都行，Vercel 都能 deploy
- **不要**勾 "Add README / .gitignore / license"（我们已经有了）

终端里：

```bash
cd ~/Desktop/PartyKeys     # ← 你本地的这个目录

# 第一次初始化
git init
git branch -M main
git add .
git commit -m "initial: ChordHand v1 — 8 区和弦 · 简化版"

# 关联远端
git remote add origin git@github.com:PartyBohan/ChordHand.git
# 或 HTTPS：
# git remote add origin https://github.com/PartyBohan/ChordHand.git

git push -u origin main
```

> 已经是 git 仓库就跳过 `git init/branch`，直接 `add/commit/push`。

### Step 2　Vercel 新建项目

1. 打开 https://vercel.com/new
2. **Import Git Repository** → 选 `PartyBohan/ChordHand`
3. 配置：
   - **Project Name**：`chordhand`（小写，会成为默认预览子域名 `chordhand.vercel.app`）
   - **Framework Preset**：`Other`（纯静态）
   - **Root Directory**：**留空**（默认，因为 `index.html` 在仓库根）
   - **Build Command**：空
   - **Output Directory**：空
4. 点 **Deploy**，等 30 秒，拿到一个 `chordhand-xxxx.vercel.app`
5. 打开预览链接，确认：
   - 页面能打开
   - 点"启动"弹 MIDI 授权 + 摄像头授权
   - 和弦盘能显示

> 如果 PartyKeysArcade 之前踩过 **Root Directory 设错** 的坑（空目录导致部署空白），记得这里就保持空白。

### Step 3　绑自定义域名

**在 Vercel 项目里：**

- `Settings` → `Domains` → `Add Domain`
- 输入 `chordhand.partykeys.org` → `Add`
- Vercel 会提示你去 DNS 配置一条 **CNAME 记录**：

  ```
  Host:  chordhand
  Type:  CNAME
  Value: cname.vercel-dns.com
  TTL:   Auto（或 300）
  ```

**在你的 DNS 控制台**（以 Cloudflare 为例）：

1. 登录 https://dash.cloudflare.com → 选 `partykeys.org`
2. 左栏 → `DNS` → `Records` → `Add record`
3. 填：
   - Type: `CNAME`
   - Name: `chordhand`
   - Target: `cname.vercel-dns.com`
   - **Proxy status: DNS only（灰色云）** ← 重要！Vercel 要直通，不走 Cloudflare 代理
4. 保存，5–30 分钟内生效

> **验证**：终端跑 `dig chordhand.partykeys.org CNAME +short`，应该看到 `cname.vercel-dns.com`。
> 回 Vercel 的 Domains 页，域名旁边的"Invalid Configuration"会变成"Valid"、自动签 HTTPS 证书（Let's Encrypt，1–3 分钟）。

### Step 4　打开 https://chordhand.partykeys.org 验收

浏览器必须是 **Chrome / Edge**（Safari / Firefox 不支持 Web MIDI，会被启动自检挡住）。

验收清单：

- [ ] 首屏能打开，不是 404 / 白屏
- [ ] 顶栏"启动"按钮可点
- [ ] 启动后 MIDI 授权弹窗出现并能允许
- [ ] 摄像头授权弹窗出现并能允许
- [ ] 状态 chip 三个全变绿（MIDI · 摄像头 · 模式）
- [ ] PartyKeys 36 Keys 连上，按键发声（默认 C4–C5，共 13 音）
- [ ] 抬起一只手 → 中央出现和弦盘 + 一颗蓝球
- [ ] 球移到 8 区 → 和弦色彩切换（Major / minor / Add9 / Maj7 / 7 / m7 / dim / sus4）
- [ ] 连弹两次同一个音 → 鼓声从"动"切到"大"
- [ ] 控制条：八度 ± / 音量 / 5 种音色 / 贝斯 / 鼓 都能切
- [ ] 不会莫名其妙出现红 X（急停已删）

---

## 三、后续改动流程

**就跟 PartyKeysArcade 一样**：

```bash
cd ~/Desktop/PartyKeys
# 改文件...
git add .
git commit -m "fix: XXX"
git push
# Vercel 自动 30 秒内重新部署
```

> 如果改了配置但 Vercel 没自动重新部署，试试：
> `git commit --allow-empty -m "redeploy" && git push`（踩过这个坑）。

---

## 四、排错清单

| 症状 | 可能原因 | 解决 |
|---|---|---|
| 打开白屏 | Root Directory 设错 | Vercel Settings → General → Root Directory 保持空 |
| `chordhand.partykeys.org` 一直 `DNS_PROBE_FINISHED_NXDOMAIN` | DNS 没生效 / Cloudflare 开了橙色云 | 灰色云（DNS only）+ 等 10 分钟 |
| Vercel 显示 "Invalid Configuration" | CNAME 没对上 `cname.vercel-dns.com` | 检查 DNS 记录值，别多空格 |
| 页面能开但点按钮没反应 | 用了 `file://` 打开 或 不是 Chrome | 必须 HTTPS + Chromium 浏览器 |
| MIDI 连上了但按键无声 | 之前某个 tab 占着 MIDI 独占 | 关其他占用 MIDI 的 tab（如 midi_arcade 旧版） |
| MediaPipe 模型加载慢 / 失败 | jsdelivr 被墙 | 用 VPN；或后续换 `cdn.staticfile.org` 镜像 |
| 摄像头授权被拒 | 浏览器记录了"拒绝" | 地址栏左边锁图标 → 权限 → 摄像头改回"询问" |
| 状态 chip 显示 "ROLI Airwave" 之类 | MIDI 过滤没生效 | 代码里已经 `/partykey/i` 过滤，非 PartyKeys 设备只显示"通用 MIDI 已连接" |

---

## 五、可选优化

### 5.1 加一个 favicon

把一个 `favicon.ico` / `favicon.svg` 放到项目根目录，`index.html` 的 `<head>` 加：

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
```

### 5.2 Open Graph（分享时有预览卡片）

`<head>` 里加：

```html
<meta property="og:title" content="PartyKeys · ChordHand">
<meta property="og:description" content="手势 × 琴键 — 一手弹琴，一手指方位触发 8 种和弦色彩。">
<meta property="og:image" content="https://chordhand.partykeys.org/og.png">
<meta property="og:url" content="https://chordhand.partykeys.org">
```

再放一张 `og.png`（1200×630）到根目录。

### 5.3 从 game.partykeys.org 的 hub 挂个入口

PartyKeysArcade 的 `index.html` 里加一张卡片链到 `https://chordhand.partykeys.org`，方便内部导流。

---

## 六、一句话备忘

> 推送 → Vercel 自动部署 → DNS CNAME 到 `cname.vercel-dns.com` → 打开 Chrome 访问 `https://chordhand.partykeys.org`。
