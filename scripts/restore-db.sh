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

if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup-file>"
    echo ""
    echo "Available backups:"
    ls -1 "$BACKUP_DIR"/crm_backup_*.sql.gz 2>/dev/null || echo "  (none)"
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
read -p "Continue? (y/N) " -r
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" --quiet

echo "Restore completed successfully."
