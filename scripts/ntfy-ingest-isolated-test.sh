#!/usr/bin/env bash
# Disposable Postgres: valida migrations ntfy (20261110200000+).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${NTFY_INGEST_TEST_DB:-dryos_ntfy_ingest}"

fail() { echo "ASSERT FAIL: $*" >&2; exit 1; }
pass() { echo "ASSERT OK: $*"; }

if ! command -v psql >/dev/null 2>&1; then
  echo "SKIP: psql not found"
  exit 2
fi
if ! sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "SKIP: postgres not running"
  exit 2
fi

run_sql() { sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" "$@"; }

reset_db() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME};"
  run_sql -f "${ROOT}/scripts/isolated-pg-bootstrap.sql"
}

apply_all_migrations() {
  while IFS= read -r -d '' f; do
    echo "Applying $(basename "$f")..."
    run_sql -f "$f"
  done < <(find "${ROOT}/supabase/migrations" -maxdepth 1 -name '*.sql' -print0 | sort -z)
}

reset_db
apply_all_migrations

run_sql -tAc "SELECT 1 FROM pg_type WHERE typname='sla_incident_source'" | grep -q 1 \
  || fail "sla_incident_source missing"
run_sql -tAc "SELECT 1 FROM pg_tables WHERE tablename='operation_ntfy_topics'" | grep -q 1 \
  || fail "operation_ntfy_topics missing"
run_sql -tAc "SELECT 1 FROM pg_tables WHERE tablename='ntfy_message_receipts'" | grep -q 1 \
  || fail "ntfy_message_receipts missing"

pass "ntfy migrations applied on isolated Postgres"
