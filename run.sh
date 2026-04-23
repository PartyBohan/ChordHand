#!/bin/bash
# PartyKeys 本地启动脚本 — 启动 HTTP server 并打开浏览器
# 用法: ./run.sh  (首次需要 chmod +x run.sh)

set -e

cd "$(dirname "$0")"

PORT=8080

# 检查端口占用
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "⚠ 端口 $PORT 已被占用，换用 8081"
  PORT=8081
fi

URL="http://localhost:$PORT"

echo "================================================"
echo "  PartyKeys — 启动本地服务器"
echo "  地址: $URL"
echo "  按 Ctrl+C 结束"
echo "================================================"
echo ""

# 1.5 秒后打开浏览器（给 server 启动留时间）
(sleep 1.5 && {
  if command -v open >/dev/null 2>&1; then
    open "$URL"     # macOS
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL"  # Linux
  elif command -v start >/dev/null 2>&1; then
    start "$URL"     # Windows (Git Bash)
  fi
}) &

# 启动 Python HTTP server
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server $PORT
elif command -v python >/dev/null 2>&1; then
  python -m http.server $PORT
else
  echo "❌ 找不到 python。请安装 Python 3 或用任何 HTTP server："
  echo "   npx serve .       (需要 Node.js)"
  echo "   php -S localhost:$PORT"
  exit 1
fi
