#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env if present
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

DATABASE_URL="${DATABASE_URL:-postgres://crm_user:crm_password@localhost:5432/crm_db}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/crm_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Starting backup..."
echo "  Database: ${DATABASE_URL%%@*}@***"
echo "  Output:   $BACKUP_FILE"

pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup completed successfully ($FILESIZE)"
echo "File: $BACKUP_FILE"

# Keep only last 7 backups
cd "$BACKUP_DIR"
ls -1t crm_backup_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm --
echo "Old backups cleaned (keeping last 7)"
