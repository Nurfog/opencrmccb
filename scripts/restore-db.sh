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

NON_INTERACTIVE="${CI:-}"
EXTRA_ARGS=()
for arg in "$@"; do
    case "$arg" in
        -y|--yes) NON_INTERACTIVE=1 ;;
        *) EXTRA_ARGS+=("$arg") ;;
    esac
done

if [ "${#EXTRA_ARGS[@]}" -lt 1 ]; then
    echo "Usage: $0 [--yes] <backup-file>"
    echo ""
    echo "Available backups:"
    ls -1 "$BACKUP_DIR"/crm_backup_*.sql.gz* 2>/dev/null || echo "  (none)"
    exit 1
fi

BACKUP_FILE="${EXTRA_ARGS[0]}"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "Restoring from: $BACKUP_FILE"
echo "  Target: ${DATABASE_URL%%@*}@***"
echo ""
echo "WARNING: This will overwrite the current database."

if [ -z "$NON_INTERACTIVE" ]; then
    read -p "Continue? (y/N) " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# Safety dump before overwriting (skipped in CI via --yes only if explicitly asked?
# No: always dump unless RESTORE_NO_SAFETY_DUMP=1 — restores must be reversible).
if [ -z "${RESTORE_NO_SAFETY_DUMP:-}" ]; then
    SAFETY_FILE="$BACKUP_DIR/crm_backup_pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
    echo "Taking pre-restore safety dump: $SAFETY_FILE"
    pg_dump "$DATABASE_URL" | gzip > "$SAFETY_FILE"
fi

# Decrypt on the fly when the backup was GPG-encrypted by backup-db.sh
if [[ "$BACKUP_FILE" == *.gpg ]]; then
    if [ -z "${BACKUP_ENCRYPTION_PASSWORD:-}" ]; then
        echo "Error: backup is GPG-encrypted but BACKUP_ENCRYPTION_PASSWORD is not set."
        exit 1
    fi
    gpg --batch --yes --passphrase "$BACKUP_ENCRYPTION_PASSWORD" -d "$BACKUP_FILE" \
        | gunzip -c \
        | psql "$DATABASE_URL" --quiet --set ON_ERROR_STOP=on --single-transaction
else
    gunzip -c "$BACKUP_FILE" \
        | psql "$DATABASE_URL" --quiet --set ON_ERROR_STOP=on --single-transaction
fi

echo "Restore completed successfully."
