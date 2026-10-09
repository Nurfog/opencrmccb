#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env WITHOUT executing it: only plain KEY=value lines are imported
# (sourcing .env would run arbitrary shell code).
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    while IFS='=' read -r key value; do
        case "$key" in
            ''|'#'*) : ;;
            *[!A-Z0-9_]*|'') : ;;
            *) export "$key=$value" ;;
        esac
    done < <(grep -E '^[A-Z_][A-Z0-9_]*=' "$PROJECT_DIR/.env" || true)
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

# Optional encryption
if [ -n "${BACKUP_ENCRYPTION_PASSWORD:-}" ]; then
    gpg --batch --yes --passphrase "$BACKUP_ENCRYPTION_PASSWORD" --symmetric "$BACKUP_FILE"
    rm "$BACKUP_FILE"
    BACKUP_FILE="${BACKUP_FILE}.gpg"
    echo "Encrypted backup with GPG"
fi

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup completed successfully ($FILESIZE)"
echo "File: $BACKUP_FILE"

# Keep only last 7 backups (newline-safe rotation over both extensions)
find "$BACKUP_DIR" -maxdepth 1 -name 'crm_backup_*.sql.gz*' -printf '%T@ %p\n' 2>/dev/null \
    | sort -n | head -n -7 | cut -d' ' -f2- \
    | while IFS= read -r old; do rm -f -- "$old"; done
echo "Old backups cleaned (keeping last 7)"
