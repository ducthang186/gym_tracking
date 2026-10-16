#!/usr/bin/env bash
# Chạy trên MÁY CỦA BẠN (macOS): kéo backup và ảnh từ máy chủ về, cảnh báo nếu có gì bất thường.
# Chạy mỗi giờ bằng launchd (ops/vn.latis.pullbackup.plist). Bật FileVault vì ảnh nằm không mã hoá trên đĩa này.
set -uo pipefail
SERVER="backup@latis.vn"                 # tài khoản chỉ-đọc trên máy chủ
HEALTH_URL="https://latis.vn/api/v1/health"
DEST="$HOME/latis-backups"
MAX_AGE_MIN=$((14 * 60))                 # backup chạy 6 giờ/lần → quá 14 giờ là bất thường
mkdir -p "$DEST/db" "$DEST/storage"

notify() { osascript -e "display notification \"$1\" with title \"LATIS\"" 2>/dev/null || echo "$1"; }

curl -fsS -m 10 "$HEALTH_URL" > /dev/null || notify "Máy chủ không phản hồi /health"

rsync -az --ignore-existing "$SERVER:/var/backups/latis/" "$DEST/db/"         || notify "Kéo backup DB thất bại"
rsync -az                   "$SERVER:/var/lib/latis/storage/" "$DEST/storage/" || notify "Kéo ảnh thất bại"

# Backup hỏng âm thầm là kịch bản phổ biến nhất → luôn kiểm tra tuổi bản mới nhất.
if [ -z "$(find "$DEST/db" -name 'latis-*.dump.age' -mmin -"$MAX_AGE_MIN" | head -1)" ]; then
  notify "CẢNH BÁO: backup mới nhất đã quá cũ"
fi

find "$DEST/db" -name 'latis-*.dump.age' -mtime +60 -delete
