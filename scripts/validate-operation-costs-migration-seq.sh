#!/usr/bin/env bash
# Postgres isolado: enum sem 'profile' (pula 20261106124500), depois 09245900 + 09250000.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${MIGRATION_TEST_DB:-dryos_op_costs_enum}"

if ! sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "SKIP: postgres not running"
  exit 2
fi

run_sql() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" "$@"
}

has_enum_label() {
  local label="$1"
  run_sql -tAc "
    SELECT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'activity_subject_type' AND e.enumlabel = '${label}'
    );
  "
}

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME};"
run_sql -f "${ROOT}/scripts/isolated-pg-bootstrap.sql"

STOP_AFTER='20261109240000_profile_display_name.sql'
SKIP_MIGRATIONS=(
  '20261106124500_activity_profile_subject.sql'
  '20261109210002_activity_meetings_risks.sql'
  '20261109230000_client_journey_and_meeting_kind.sql'
  '20261109245900_activity_subject_enum_values.sql'
  '20261109250000_operation_costs_category.sql'
)

while IFS= read -r -d '' f; do
  base="$(basename "$f")"
  for skip in "${SKIP_MIGRATIONS[@]}"; do
    [[ "$base" == "$skip" ]] && continue 2
  done
  if [[ "$base" > "$STOP_AFTER" ]]; then
    continue
  fi
  echo "Applying ${base}..."
  run_sql -f "$f"
done < <(find "${ROOT}/supabase/migrations" -maxdepth 1 -name '*.sql' -print0 | sort -z)

echo "Labels meeting/decision/risk (como em produção antes dos custos)..."
run_sql <<-SQL
ALTER TYPE public.activity_subject_type ADD VALUE IF NOT EXISTS 'meeting';
ALTER TYPE public.activity_subject_type ADD VALUE IF NOT EXISTS 'decision';
ALTER TYPE public.activity_subject_type ADD VALUE IF NOT EXISTS 'operation_risk_blocker';
SQL

if [[ "$(has_enum_label profile)" == "t" ]]; then
  echo "FAIL: não deveria existir profile antes de 09245900"
  exit 1
fi
echo "OK: activity_subject_type sem 'profile'"

echo "Applying 20261109245900_activity_subject_enum_values.sql..."
run_sql -f "${ROOT}/supabase/migrations/20261109245900_activity_subject_enum_values.sql"

for label in profile operation_cost; do
  if [[ "$(has_enum_label "$label")" != "t" ]]; then
    echo "FAIL: falta enum ${label} após 09245900"
    exit 1
  fi
done

echo "Applying 20261109250000_operation_costs_category.sql..."
run_sql -f "${ROOT}/supabase/migrations/20261109250000_operation_costs_category.sql"

run_sql -tAc "SELECT pg_get_functiondef('public.can_read_activity_subject(public.activity_subject_type, uuid)'::regprocedure) IS NOT NULL;"
echo "OK: sequência enum → custos aplicada (sem 20261106124500)."
