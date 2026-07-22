#!/usr/bin/env bash
# Postgres logical backup for Scanny (hosted / Compose).
# Usage:
#   ./scripts/backup-postgres.sh
#   POSTGRES_CONTAINER=scanny-postgres ./scripts/backup-postgres.sh
# Schedule (example cron, daily 02:15 UTC):
#   15 2 * * * /opt/scanny/scripts/backup-postgres.sh >> /var/log/scanny-backup.log 2>&1

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
CONTAINER="${POSTGRES_CONTAINER:-}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/scanny_$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

if [[ -n "$CONTAINER" ]]; then
  echo "Backing up via docker exec ($CONTAINER) -> $OUT"
  docker exec "$CONTAINER" pg_dump -U "${POSTGRES_USER:-scanny}" -d "${POSTGRES_DB:-scanny}" --no-owner --no-acl \
    | gzip -c > "$OUT"
elif command -v pg_dump >/dev/null 2>&1; then
  echo "Backing up via local pg_dump -> $OUT"
  PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_dump \
    -h "${POSTGRES_HOST:-localhost}" \
    -p "${POSTGRES_PORT:-5432}" \
    -U "${POSTGRES_USER:-scanny}" \
    -d "${POSTGRES_DB:-scanny}" \
    --no-owner --no-acl \
    | gzip -c > "$OUT"
else
  echo "Neither POSTGRES_CONTAINER nor pg_dump available." >&2
  exit 1
fi

# Prune old backups
find "$BACKUP_DIR" -type f -name 'scanny_*.sql.gz' -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true

echo "OK $OUT ($(du -h "$OUT" | cut -f1))"
