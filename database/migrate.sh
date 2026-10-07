#!/usr/bin/env bash
# Apply numbered SQL migrations in order. Safe to re-run: all migrations in
# database/migrations/ are idempotent (IF NOT EXISTS / DO-guarded, see M034
# header). Used by the `migrate` compose service and CI.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"

# Wait for Postgres (pg_isready via psql fallback).
for i in $(seq 1 30); do
  if psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  echo "migrate: waiting for postgres ($i/30)..."
  sleep 2
  if [ "$i" -eq 30 ]; then
    echo "migrate: postgres never became ready" >&2
    exit 1
  fi
done

count=0
for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "migrate: applying $(basename "$f")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f "$f"
  count=$((count + 1))
done

echo "migrate: applied $count migration files (idempotent re-run safe)"
