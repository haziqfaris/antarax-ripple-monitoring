#!/usr/bin/env bash
# V-30: the loop, end to end, in a browser. A fresh database, three staff, the console (built) and the example
# application, then Playwright. Locally it uses scripts/local-db.sh's Postgres; in CI, E2E_ADMIN_URL points at the service.
set -euo pipefail
cd "$(dirname "$0")/.."
ADMIN="${E2E_ADMIN_URL:-postgres://outcomes_owner@localhost:54329/postgres}"
DB=outcomes_e2e
OWNER_URL="${ADMIN%/*}/$DB"
WEB_URL="$(node -e "const u=new URL(process.argv[1]);u.username='outcomes_web';u.password='local-only';console.log(u.toString())" "$OWNER_URL")"
psql "$ADMIN" -q -c "drop database if exists $DB with (force)" -c "create database $DB"
MIGRATE_DATABASE_URL="$OWNER_URL" npx tsx db/migrate.ts
psql "$OWNER_URL" -q -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname = 'outcomes_web') then create role outcomes_web login password 'local-only' in role outcomes_app; end if; end \$\$"
export DATABASE_URL="$WEB_URL" SEAL_KEY="${SEAL_KEY:-$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")}" CRON_SECRET="${CRON_SECRET:-$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")}" APP_URL=http://localhost:3200 ALERT_TO=ops@reka.example ALLOW_LOCAL_HTTP_LINKS=1
STAFF_PASSWORD="operator password 1" npx tsx scripts/staff-add.ts --email nurul@reka.example --name "Nurul Aina" --role operator
STAFF_PASSWORD="approver password 1" npx tsx scripts/staff-add.ts --email aisyah@reka.example --name "Aisyah Rahman" --role approver
STAFF_PASSWORD="approver password 2" npx tsx scripts/staff-add.ts --email daniel@reka.example --name "Daniel Lim" --role approver
[ -d .next ] && [ -z "${E2E_REBUILD:-}" ] || npx next build >/dev/null
free_port() { fuser -k "$1/tcp" >/dev/null 2>&1 || true; }
free_port 3200; free_port 4010
EXAMPLE_ALLOW_SET_KEY=1 npx tsx scripts/example-link.ts > /tmp/outcomes-example.log 2>&1 & EX=$!
npx next start --port 3200 > /tmp/outcomes-console.log 2>&1 & WEB=$!
trap 'pkill -P $EX 2>/dev/null; pkill -P $WEB 2>/dev/null; kill $EX $WEB 2>/dev/null; free_port 3200; free_port 4010; true' EXIT
for i in $(seq 1 60); do curl -sf -o /dev/null http://localhost:3200/sign-in && break; sleep 1; done
export CRON_SECRET
rm -f test-results/.two-step-keys.json
npx playwright test "$@"
