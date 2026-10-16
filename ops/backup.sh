#!/usr/bin/env bash
# Backup database (mã hoá bằng khoá CÔNG KHAI của age). Cài ở /opt/latis/backup.sh, chạy bằng cron:
#   0 */6 * * * /opt/latis/backup.sh >> /var/log/latis-backup.log 2>&1
# Khoá RIÊNG để giải mã cất ở trình quản lý mật khẩu / USB, KHÔNG để trên máy chủ.
# Ảnh nằm ở /var/lib/latis/storage và được máy bạn kéo riêng (ops/pull-backup.sh).
set -euo pipefail
cd /opt/latis
OUT_DIR=/var/backups/latis
TS=$(date +%F-%H%M)
mkdir -p "$OUT_DIR"

TMP="$OUT_DIR/.latis-$TS.dump.age.partial"
docker compose exec -T db pg_dump -U latis_owner -Fc latis \
  | age -r "$(cat /opt/latis/age.pub)" -o "$TMP"
mv "$TMP" "$OUT_DIR/latis-$TS.dump.age"        # chỉ đổi tên khi đã ghi xong: không bao giờ có bản dở dang mang tên backup

find "$OUT_DIR" -name 'latis-*.dump.age' -mtime +7 -delete   # giữ 7 ngày trên máy chủ
echo "$(date -Is) backup ok: latis-$TS.dump.age"
