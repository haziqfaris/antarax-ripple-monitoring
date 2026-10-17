#!/usr/bin/env bash
# V-28: a backup you can restore. pg_dump in custom format to BACKUP_DIR (default ./backups), named by time.
# Restore drill: createdb outcomes_restore && pg_restore --no-owner -d outcomes_restore <file>, then compare counts.
# Production: run it daily from a scheduled job and copy the file to R2 (PRD §15.2); keep 35 days.
set -euo pipefail
: "${MIGRATE_DATABASE_URL:?Set MIGRATE_DATABASE_URL (the owner)}"
DIR="${BACKUP_DIR:-./backups}"; mkdir -p "$DIR"
FILE="$DIR/outcomes-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --file="$FILE" "$MIGRATE_DATABASE_URL"
echo "$FILE"
