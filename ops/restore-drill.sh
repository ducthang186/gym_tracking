#!/usr/bin/env bash
# Bài tập restore (system.md 15.2): giải mã một bản backup và nạp vào database thử trên máy bạn.
# Backup chưa từng restore thử thì CHƯA phải là backup. Lặp lại mỗi quý.
#   ops/restore-drill.sh ~/latis-backups/db/latis-2026-10-05-0200.dump.age ~/khoa-rieng-age.txt
set -euo pipefail
BACKUP="${1:?đường dẫn tới file .dump.age}"
KEY="${2:?đường dẫn tới khoá riêng age}"
DB="latis_restore_test"

age -d -i "$KEY" -o /tmp/latis-restore.dump "$BACKUP"
dropdb --if-exists "$DB" && createdb "$DB"
pg_restore --no-owner -d "$DB" /tmp/latis-restore.dump
psql "$DB" -c "select (select count(*) from users) as users, (select count(*) from food_log_entries) as food_entries, (select count(*) from body_metrics) as metrics;"
rm -f /tmp/latis-restore.dump
echo "Restore thành công vào database '$DB'. Xoá bằng: dropdb $DB"
