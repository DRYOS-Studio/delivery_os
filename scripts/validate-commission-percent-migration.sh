#!/usr/bin/env bash
# Aplica cadeia pós-#196 (estado produção) + migration de comissão %.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${MIGRATION_TEST_DB:-dryos_commission_pct}"

if ! sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "SKIP: postgres not running"
  exit 2
fi

run_sql() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" "$@"
}

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME};"
run_sql -f "${ROOT}/scripts/isolated-pg-bootstrap.sql"

PROD_GAP_SKIP=(
  '20261106124500_activity_profile_subject.sql'
  '20261109210002_activity_meetings_risks.sql'
  '20261109245900_activity_subject_enum_values.sql'
  '20261109250000_operation_costs_category.sql'
  '20261110020000_operation_cost_commission_percent.sql'
)

while IFS= read -r -d '' f; do
  base="$(basename "$f")"
  for skip in "${PROD_GAP_SKIP[@]}"; do
    [[ "$base" == "$skip" ]] && continue 2
  done
  echo "Applying ${base}..."
  run_sql -f "$f"
done < <(find "${ROOT}/supabase/migrations" -maxdepth 1 -name '*.sql' -print0 | sort -z)

run_sql <<-SQL
ALTER TYPE public.activity_subject_type ADD VALUE IF NOT EXISTS 'meeting';
ALTER TYPE public.activity_subject_type ADD VALUE IF NOT EXISTS 'decision';
ALTER TYPE public.activity_subject_type ADD VALUE IF NOT EXISTS 'operation_risk_blocker';
SQL

echo "Applying enum + custos (como produção)..."
run_sql -f "${ROOT}/supabase/migrations/20261109245900_activity_subject_enum_values.sql"
run_sql -f "${ROOT}/supabase/migrations/20261109250000_operation_costs_category.sql"

echo "Applying 20261110020000_operation_cost_commission_percent.sql..."
run_sql -f "${ROOT}/supabase/migrations/20261110020000_operation_cost_commission_percent.sql"

run_sql -tAc "
  SELECT column_name, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'operation_costs'
    AND column_name IN ('commission_percent', 'amount');
"

echo "OK: migration comissão % aplicada após estado produção."
