#!/usr/bin/env bash
# Postgres isolado: enum client_charge antes da tabela.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${MIGRATION_TEST_DB:-dryos_client_charges}"

if ! sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "SKIP: postgres not running"
  exit 2
fi

run_sql() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" "$@"
}

has_enum_label() {
  local typ="$1" label="$2"
  run_sql -tAc "
    SELECT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = '${typ}' AND e.enumlabel = '${label}'
    );
  "
}

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME};"
run_sql -f "${ROOT}/scripts/isolated-pg-bootstrap.sql"

echo "Applying migrations up to client_charges (incremental)..."
while IFS= read -r -d '' f; do
  base="$(basename "$f")"
  echo "  ${base}"
  run_sql -f "$f"
  if [[ "$base" == "20261110100001_client_charges.sql" ]]; then
    break
  fi
done < <(find "${ROOT}/supabase/migrations" -maxdepth 1 -name '*.sql' -print0 | sort -z)

if [[ "$(has_enum_label activity_subject_type client_charge)" != "t" ]]; then
  echo "FAIL: activity_subject_type sem client_charge"
  exit 1
fi

run_sql -tAc "SELECT to_regclass('public.client_charges') IS NOT NULL;"
run_sql -tAc "
  SELECT COUNT(*) FROM pg_indexes
  WHERE indexname = 'uq_client_charges_contract_type_competence';
" | grep -q 1

echo "OK: migrations 20261110100000 + 20261110100001 validadas."
