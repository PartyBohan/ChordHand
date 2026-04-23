// =============================================================
// hand-tracker.js — MediaPipe Hands 封装
// 使用 @mediapipe/tasks-vision HandLandmarker (via CDN, 动态导入)
// 每帧发出 'frame' 事件，带左右手的关键点和推导特征
// =============================================================

// 动态导入在 init() 里执行，避免 CDN 失败导致整个 app 无法启动
const TASKS_VISION_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

class HandTracker extends EventTarget {
  constructor() {
    super();
    this.video = null;
    this.landmarker = null;
    this.running = false;
    this.lastTs = 0;
    /** 镜像摄像头画面时要不要翻转 handedness 标签 */
    this.swapHandedness = true; // 默认 webcam 是自拍视角，需要翻转
    this._rafId = null;
    // 预加载的 promise（页面打开就跑，用户点启动时可能已经完成）
    this._modulePromise = null;
    this._filesetPromise = null;
  }

  /**
   * 提前预热：页面空闲时就开始拉 MediaPipe 模块和 WASM fileset。
   * 失败静默（真正需要时会在 init 里重试并报错）。
   */
  preload() {
    if (!this._modulePromise) {
      this._modulePromise = import(/* @vite-ignore */ TASKS_VISION_CDN).catch(
        (e) => {
          this._modulePromise = null;
          throw e;
        }
      );
    }
    // fileset 依赖 module 完成
    if (!this._filesetPromise) {
      this._filesetPromise = this._modulePromise.then((mod) =>
        mod.FilesetResolver.forVisionTasks(WASM_BASE)
      );
    }
    return this._modulePromise;
  }

  /**
   * 初始化：加载模型 + 申请摄像头。
   * 通过 onProgress 回调汇报进度给 UI。
   * @param {HTMLVideoElement} videoEl
   * @param {{ onModel?: (stage: string) => void, onCamera?: (stage: string) => void }} cb
   */
  async init(videoEl, cb = {}) {
    this.video = videoEl;
    const { onModel = () => {}, onCamera = () => {} } = cb;

    this._setStatus("loading", "摄像头: 加载 MediaPipe…");
    onModel("loading");

    // 1) 确保 module + fileset 就绪（预加载可能已完成）
    let mod, fileset;
    try {
      if (!this._modulePromise) this.preload();
      mod = await this._modulePromise;
      fileset = await this._filesetPromise;
      if (!mod.HandLandmarker || !mod.FilesetResolver) {
        throw new Error("MediaPipe 模块导出缺失");
      }
    } catch (err) {
      this._setStatus("error", "MediaPipe 加载失败: " + err.message);
      onModel("fail");
      throw err;
    }

    // 2) 创建 landmarker（GPU → CPU fallback）
    try {
      try {
        this.landmarker = await mod.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 2,
        });
      } catch {
        this.landmarker = await mod.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numHands: 2,
        });
      }
    } catch (err) {
      this._setStatus("error", "摄像头: 模型加载失败 " + err.message);
      onModel("fail");
      throw err;
    }
    onModel("done");

    // 3) 摄像头权限
    onCamera("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: false,
      });
      this.video.srcObject = stream;
      await new Promise((res) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          res();
        };
      });
    } catch (err) {
      this._setStatus("denied", "摄像头: 授权被拒绝");
      onCamera("fail");
      throw err;
    }

    this._setStatus("ok", "摄像头已连接");
    onCamera("done");
    this._loop();
    this.running = true;
    return true;
  }

  _setStatus(kind, text) {
    this.dispatchEvent(
      new CustomEvent("status", { detail: { kind, text } })
    );
  }

  _loop = () => {
    if (!this.video || this.video.readyState < 2) {
      this._rafId = requestAnimationFrame(this._loop);
      return;
    }

    const ts = performance.now();
    // 30fps —— MediaPipe 推理 + overlay 绘制成本减半，手势判定完全够用
    if (ts - this.lastTs > 32) {
      this.lastTs = ts;
      const result = this.landmarker.detectForVideo(this.video, ts);
      const hands = this._processResult(result);
      this.dispatchEvent(new CustomEvent("frame", { detail: { hands, ts } }));
    }
    this._rafId = requestAnimationFrame(this._loop);
  };

  /**
   * 把 MediaPipe 结果处理成：
   * { left: {...features}, right: {...features} }  （可能缺一只或两只）
   */
  _processResult(result) {
    const out = { left: null, right: null };
    if (!result || !result.landmarks || result.landmarks.length === 0) {
      return out;
    }

    for (let i = 0; i < result.landmarks.length; i++) {
      const rawLm = result.landmarks[i];
      // 画面是镜像显示的（CSS scaleX(-1)），把 x 也翻转，让所有下游逻辑都在
      // "用户视角" 工作：x=0 是用户的左，x=1 是用户的右
      const lm = rawLm.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }));

      const handedness = result.handednesses?.[i]?.[0]?.categoryName || "Right";
      let side = handedness.toLowerCase(); // 'left' or 'right'
      // x 已经翻转 → handedness 也要翻转才能对上 "用户身体的左右"
      if (this.swapHandedness) side = side === "left" ? "right" : "left";

      out[side] = this._features(lm);
    }

    return out;
  }

  /**
   * 从 21 个关键点推导特征
   * 输入坐标范围：x/y 在 [0,1] 归一化空间
   */
  _features(lm) {
    // 21 个点: 0=wrist, 5=indexMCP, 9=middleMCP, 13=ringMCP, 17=pinkyMCP
    // 指尖: 4=thumb, 8=index, 12=middle, 16=ring, 20=pinky
    const wrist = lm[0];
    const idxMCP = lm[5];
    const midMCP = lm[9];
    const ringMCP = lm[13];
    const pinkyMCP = lm[17];

    // 手掌中心 = 5个基部点平均
    const palm = {
      x: (wrist.x + idxMCP.x + midMCP.x + ringMCP.x + pinkyMCP.x) / 5,
      y: (wrist.y + idxMCP.y + midMCP.y + ringMCP.y + pinkyMCP.y) / 5,
      z: (wrist.z + idxMCP.z + midMCP.z + ringMCP.z + pinkyMCP.z) / 5,
    };

    // 手掌尺寸（用于归一化手指距离）
    const palmSize = dist2(idxMCP, pinkyMCP) + dist2(wrist, midMCP);

    // 每根手指的"张开度" = 指尖到手掌中心距离 / 手掌尺寸
    const fingerTips = [4, 8, 12, 16, 20];
    const openness = fingerTips.map(
      (i) => dist2(lm[i], palm) / Math.max(palmSize, 0.001)
    );
    // 0-4: thumb, index, middle, ring, pinky
    // 伸直大概 ~1.3-1.8，弯曲 ~0.6-0.9
    const avgOpen = (openness[1] + openness[2] + openness[3] + openness[4]) / 4;
    // 握拳：4 指都弯曲
    const isFist = avgOpen < 0.85;
    // 张开：4 指都伸直
    const isOpen = avgOpen > 1.25;

    // 手腕旋转角度 = 食指MCP - 小指MCP 这条线相对水平线的角度
    // 注意 y 轴向下，所以取反
    const rotRad = Math.atan2(
      -(idxMCP.y - pinkyMCP.y),
      idxMCP.x - pinkyMCP.x
    );
    // 0 度 = 手水平（食指在右，小指在左），±90 度 = 手竖直

    // 食指指向方向（MCP → TIP 的向量）
    const idxDir = {
      x: lm[8].x - idxMCP.x,
      y: lm[8].y - idxMCP.y,
    };

    return {
      landmarks: lm,
      palm, // {x, y, z} in [0,1]
      openness, // [thumb, index, middle, ring, pinky]
      avgOpen,
      isFist,
      isOpen,
      rotRad, // -π..π
      rotDeg: (rotRad * 180) / Math.PI,
      idxDir, // 食指方向向量
      idxTip: lm[8],
    };
  }

  stop() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this.video?.srcObject) {
      this.video.srcObject.getTracks().forEach((t) => t.stop());
    }
  }
}

function dist2(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export const handTracker = new HandTracker();
