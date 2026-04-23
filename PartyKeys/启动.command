#!/bin/bash
# PartyKeys — macOS 双击启动脚本
# 首次使用：右键 → 打开（跳过 Gatekeeper）；之后直接双击即可

set -e
cd "$(dirname "$0")"

PORT=8080
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  PORT=8081
fi
URL="http://localhost:$PORT"

echo "================================================"
echo "  PartyKeys — 本地服务器已启动"
echo "  地址: $URL"
echo "  关闭此窗口即可停止"
echo "================================================"

(sleep 1.5 && open "$URL") &

if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server $PORT
elif command -v python >/dev/null 2>&1; then
  python -m http.server $PORT
else
  echo ""
  echo "❌ 未找到 python。macOS 自带 python3，请确认没被卸载。"
  echo "   或者安装 Node 后运行: npx serve ."
  read -n 1 -s -r -p "按任意键关闭窗口..."
  exit 1
fi
