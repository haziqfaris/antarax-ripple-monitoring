#!/usr/bin/env bash
# A local Postgres 16 for development and tests, in .pgdata on port 54329.
# Prints the two URLs to put in .env.local: the owner (migrations, scripts) and the console's role.
set -euo pipefail
cd "$(dirname "$0")/.."
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${PGPORT_LOCAL:-54329}"
DATA="$PWD/.pgdata"
run() { if [ "$(id -u)" = "0" ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
if [ ! -d "$DATA" ]; then
  mkdir -p "$DATA"; [ "$(id -u)" = "0" ] && chown postgres "$DATA"
  run "$BIN/initdb -D '$DATA' -U outcomes_owner --auth=trust -E UTF8 >/dev/null"
fi
run "$BIN/pg_ctl -D '$DATA' -o '-p $PORT -k /tmp' -l '$DATA/log' status >/dev/null" || run "$BIN/pg_ctl -D '$DATA' -o '-p $PORT -k /tmp' -l '$DATA/log' -w start >/dev/null"
PSQL="$BIN/psql -h localhost -p $PORT -U outcomes_owner -v ON_ERROR_STOP=1 -q"
$PSQL -d postgres -tc "select 1 from pg_database where datname = 'outcomes'" | grep -q 1 || $PSQL -d postgres -c "create database outcomes"
MIGRATE_DATABASE_URL="postgres://outcomes_owner@localhost:$PORT/outcomes" npx tsx db/migrate.ts
$PSQL -d outcomes -tc "select 1 from pg_roles where rolname = 'outcomes_web'" | grep -q 1 || $PSQL -d outcomes -c "create role outcomes_web login password 'local-only' in role outcomes_app"
echo "MIGRATE_DATABASE_URL=postgres://outcomes_owner@localhost:$PORT/outcomes"
echo "DATABASE_URL=postgres://outcomes_web:local-only@localhost:$PORT/outcomes"
