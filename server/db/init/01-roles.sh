#!/bin/bash
# Tạo role ứng dụng `latis_app` chỉ có quyền DML. Chạy được nhiều lần (idempotent).
#  - Production: docker-entrypoint-initdb.d chạy một lần khi khởi tạo DB trống
#  - Dev:        scripts/dev-db.sh chạy cho cả DB `latis` lẫn `latis_test`
# Biến cần có: POSTGRES_USER, POSTGRES_DB, APP_DB_PASSWORD
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
     -v owner="$POSTGRES_USER" -v db="$POSTGRES_DB" -v app_pw="$APP_DB_PASSWORD" <<'EOSQL'
select format('create role latis_app login password %L', :'app_pw')
where not exists (select 1 from pg_roles where rolname = 'latis_app') \gexec

grant connect on database :"db" to latis_app;
grant usage on schema public to latis_app;

-- Bảng/sequence do chủ sở hữu tạo (qua migration) tự cấp quyền DML cho latis_app.
alter default privileges for role :"owner" in schema public
  grant select, insert, update, delete on tables to latis_app;
alter default privileges for role :"owner" in schema public
  grant usage, select on sequences to latis_app;
EOSQL
