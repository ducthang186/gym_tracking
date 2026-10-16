#!/usr/bin/env bash
# Postgres cục bộ cho DEV. Tạo một cụm riêng trong server/.pgdata (cổng 54329, chỉ nghe 127.0.0.1)
# nên KHÔNG đụng tới Postgres hệ thống / Homebrew service của bạn.
#
#   npm run db:start     tạo cụm (lần đầu) + khởi động + tạo DB + áp migration
#   npm run db:stop      dừng
#   npm run db:status    xem trạng thái
#   npm run db:migrate   áp migration mới
#   npm run db:reset     XOÁ TOÀN BỘ dữ liệu dev rồi dựng lại
set -euo pipefail

cd "$(dirname "$0")/.."                 # -> thư mục server/
SERVER_DIR="$PWD"
DATA_DIR="$SERVER_DIR/.pgdata"
DB_PORT="${DEV_DB_PORT:-54329}"
DB_MAIN="latis"
DB_TEST="latis_test"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Thiếu '$1'. Cài PostgreSQL (vd: brew install postgresql@18) và đảm bảo nó nằm trong PATH." >&2; exit 1; }; }
need initdb; need pg_ctl; need psql; need createdb; need openssl

rand() { openssl rand -base64 36 | tr -d '/+=\n' | cut -c1-32; }

write_env() {
  [ -f .env ] && return 0
  local owner_pw app_pw jwt
  owner_pw="$(rand)"; app_pw="$(rand)"; jwt="$(openssl rand -base64 48 | tr -d '\n')"
  umask 077
  cat > .env <<EOF
NODE_ENV=development
HOST=127.0.0.1
PORT=3000
APP_ORIGIN=http://localhost:5173
TRUST_PROXY=false
REQUIRE_APPROVAL=false
JWT_SECRET=$jwt

# Kết nối của ứng dụng (role hạn chế)
DATABASE_URL=postgres://latis_app:$app_pw@127.0.0.1:$DB_PORT/$DB_MAIN
TEST_DATABASE_URL=postgres://latis_app:$app_pw@127.0.0.1:$DB_PORT/$DB_TEST

# Chỉ dùng cho migration / script quản trị (chủ sở hữu schema)
DB_OWNER_PASSWORD=$owner_pw
APP_DB_PASSWORD=$app_pw
DATABASE_OWNER_URL=postgres://latis_owner:$owner_pw@127.0.0.1:$DB_PORT/$DB_MAIN
TEST_DATABASE_OWNER_URL=postgres://latis_owner:$owner_pw@127.0.0.1:$DB_PORT/$DB_TEST
EOF
  echo "Đã tạo server/.env (không commit file này)."
}

load_env() { set -a; . ./.env; set +a; }

is_running() { pg_ctl -D "$DATA_DIR" status >/dev/null 2>&1; }

cmd_start() {
  write_env
  load_env
  if [ ! -d "$DATA_DIR" ]; then
    echo "Khởi tạo cụm Postgres mới tại $DATA_DIR ..."
    local pwfile; pwfile="$(mktemp)"; printf '%s' "$DB_OWNER_PASSWORD" > "$pwfile"
    initdb -D "$DATA_DIR" -U latis_owner -A scram-sha-256 --pwfile="$pwfile" -E UTF8 --locale-provider=builtin --locale=C.UTF-8 >/dev/null
    rm -f "$pwfile"
  fi
  if is_running; then
    echo "Postgres dev đã chạy (cổng $DB_PORT)."
  else
    pg_ctl -D "$DATA_DIR" -l "$DATA_DIR/server.log" -w \
      -o "-p $DB_PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" start >/dev/null
    echo "Đã khởi động Postgres dev (cổng $DB_PORT)."
  fi
  export PGHOST=127.0.0.1 PGPORT="$DB_PORT" PGUSER=latis_owner PGPASSWORD="$DB_OWNER_PASSWORD"
  for db in "$DB_MAIN" "$DB_TEST"; do
    psql -d postgres -tAc "select 1 from pg_database where datname='$db'" | grep -q 1 || createdb "$db"
    POSTGRES_USER=latis_owner POSTGRES_DB="$db" APP_DB_PASSWORD="$APP_DB_PASSWORD" \
      bash db/init/01-roles.sh >/dev/null
  done
  cmd_migrate
}

cmd_migrate() {
  load_env
  for url in "$DATABASE_OWNER_URL" "$TEST_DATABASE_OWNER_URL"; do
    DATABASE_URL="$url?sslmode=disable" npx dbmate --migrations-dir db/migrations --no-dump-schema up
  done
}

cmd_stop() {
  if is_running; then pg_ctl -D "$DATA_DIR" -m fast stop >/dev/null && echo "Đã dừng Postgres dev."; else echo "Postgres dev không chạy."; fi
}

cmd_status() {
  if is_running; then echo "Postgres dev đang chạy (cổng $DB_PORT)."; else echo "Postgres dev đang dừng."; fi
}

cmd_reset() {
  read -r -p "Xoá TOÀN BỘ dữ liệu dev trong $DATA_DIR ? gõ 'yes' để xác nhận: " ans
  [ "$ans" = "yes" ] || { echo "Đã huỷ."; exit 1; }
  cmd_stop || true
  rm -rf "$DATA_DIR"
  cmd_start
}

case "${1:-}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  status)  cmd_status ;;
  migrate) cmd_migrate ;;
  reset)   cmd_reset ;;
  *) echo "Dùng: $0 {start|stop|status|migrate|reset}" >&2; exit 1 ;;
esac
