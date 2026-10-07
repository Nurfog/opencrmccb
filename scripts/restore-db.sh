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

AUTO_YES=false
if [ "${1:-}" = "--yes" ]; then
    AUTO_YES=true
    shift
fi

if [ $# -lt 1 ]; then
    echo "Usage: $0 [--yes] <backup-file>"
    echo ""
    echo "Available backups:"
    ls -1 "$BACKUP_DIR"/crm_backup_*.sql.gz "$BACKUP_DIR"/crm_backup_*.sql.gz.gpg 2>/dev/null || echo "  (none)"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "Restoring from: $BACKUP_FILE"
echo "  Target: ${DATABASE_URL%%@*}@***"
echo ""
echo "WARNING: This will overwrite the current database."
echo "A safety pre-restore backup will be taken first."
if [ "$AUTO_YES" = true ]; then
    echo "--yes supplied, skipping confirmation prompt."
else
    read -p "Continue? (y/N) " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

SAFETY_BACKUP="$BACKUP_DIR/pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
echo "Taking safety pre-restore backup: $SAFETY_BACKUP"
pg_dump "$DATABASE_URL" | gzip > "$SAFETY_BACKUP"
echo "Safety backup done."

if [[ "$BACKUP_FILE" == *.gpg ]]; then
    if [ -z "${BACKUP_ENCRYPTION_PASSWORD:-}" ]; then
        echo "Error: BACKUP_FILE is encrypted (*.gpg) but BACKUP_ENCRYPTION_PASSWORD is not set."
        exit 1
    fi
    gpg -d --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_ENCRYPTION_PASSWORD" "$BACKUP_FILE" | gunzip -c | psql "$DATABASE_URL" --quiet --set ON_ERROR_STOP=1 --single-transaction
else
    gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" --quiet --set ON_ERROR_STOP=1 --single-transaction
fi

echo "Restore completed successfully."
