#!/usr/bin/env bash
set -e
REPO="$HOME/Desktop/ChordHand"
SRC="/Users/mac/Library/Application Support/Claude/local-agent-mode-sessions/6207fcc4-992f-4658-af2b-59fe15006966/39aa454b-c175-458d-a0e3-78cc60114497/local_1be66b40-3467-4d1f-a05b-d86a084f4848/outputs/PartyKeys/"
MSG="${*:-update}"

if [ ! -d "$SRC" ]; then
  echo "⚠️  Claude 源目录不在：$SRC" >&2
  echo "   换新会话后把 push.sh 里的 SRC 路径改掉就行" >&2
  exit 1
fi

echo "→ 同步 Claude 会话文件到 $REPO …"
rsync -av --delete \
  --exclude='.git' \
  --exclude='push.sh' \
  --exclude='.DS_Store' \
  "$SRC" "$REPO/"

cd "$REPO"
git add -A

if git diff --cached --quiet; then
  echo "✓ 没有变化，跳过 commit"
  exit 0
fi

git commit -m "$MSG"
git push
echo ""
echo "✓ 已推送 → Vercel 自动部署"
echo "   https://chordhand.vercel.app"
echo "   https://chordhand.partykeys.org"
