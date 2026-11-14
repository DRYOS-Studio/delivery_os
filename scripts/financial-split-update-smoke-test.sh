#!/usr/bin/env bash
# Post financial-split: UPDATE operations/persons/allocations + operation_financials must not error.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${FINANCIAL_SMOKE_DB:-dryos_financial_split_smoke}"

if ! command -v psql >/dev/null 2>&1; then
  echo "SKIP: psql not found"
  exit 2
fi

if ! sudo -u postgres psql -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "SKIP: postgres not running"
  exit 2
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME};"

run_sql() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" "$@"
}

run_sql -f "${ROOT}/scripts/isolated-pg-bootstrap.sql"

while IFS= read -r -d '' f; do
  run_sql -f "$f" >/dev/null
done < <(find "${ROOT}/supabase/migrations" -maxdepth 1 -name '*.sql' -print0 | sort -z)

CLIENT_ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
OP_ID='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
PERSON_ID='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
FRENTE_ID='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
ALLOC_ID='ffffffff-ffff-4fff-8fff-ffffffffffff'

run_sql <<SQL
INSERT INTO public.clients (id, name, slug)
VALUES ('${CLIENT_ID}', 'Smoke Client', 'smoke-client');

INSERT INTO public.operations (id, client_id, product_line, name, status)
VALUES ('${OP_ID}', '${CLIENT_ID}', 'core', 'Smoke Op', 'em_operacao');

INSERT INTO public.operation_financials (
  operation_id, recurrence, monthly_recurring_revenue, tax_rate_pct
) VALUES (
  '${OP_ID}', 'mensal', 500.00, 6.0
);

INSERT INTO public.persons (id, kind, name, specialty)
VALUES ('${PERSON_ID}', 'internal', 'Dev Smoke', 'eng');

INSERT INTO public.person_compensation (person_id, hourly_rate, monthly_compensation)
VALUES ('${PERSON_ID}', 80.0, 8000.0);

INSERT INTO public.frentes (
  id, operation_id, name, cycle_type, domain, phase, actionable_status
) VALUES (
  '${FRENTE_ID}', '${OP_ID}', 'Frente Smoke', 'c', 'infra', 'execucao',
  'aguardando validação do cliente desde hoje'
);

INSERT INTO public.allocations (
  id, person_id, frente_id, role, capacity_weekly_pct, start_date
) VALUES (
  '${ALLOC_ID}', '${PERSON_ID}', '${FRENTE_ID}', 'executor', 50, CURRENT_DATE
);

INSERT INTO public.allocation_cost_metrics (allocation_id, weekly_hours, monthly_cost)
VALUES ('${ALLOC_ID}', 20.0, 4000.0);
SQL

echo "== UPDATE operations (non-financial) =="
run_sql -c "UPDATE public.operations SET name = 'Smoke Op v2' WHERE id = '${OP_ID}';"
echo "OK: operations update"

echo "== UPDATE persons (non-compensation) =="
run_sql -c "UPDATE public.persons SET name = 'Dev Smoke v2' WHERE id = '${PERSON_ID}';"
echo "OK: persons update"

echo "== UPDATE allocations (non-metrics) =="
run_sql -c "UPDATE public.allocations SET capacity_weekly_pct = 60 WHERE id = '${ALLOC_ID}';"
echo "OK: allocations update"

echo "== UPDATE operation_financials (MCP-shaped finance fields) =="
run_sql -c "UPDATE public.operation_financials SET recurrence = 'trimestral', monthly_recurring_revenue = 750.00, tax_rate_pct = 8.5 WHERE operation_id = '${OP_ID}';"
echo "OK: operation_financials update"

echo "== UPSERT operation_financials (update_operation path) =="
run_sql -c "INSERT INTO public.operation_financials (operation_id, recurrence, monthly_recurring_revenue, tax_rate_pct) VALUES ('${OP_ID}', 'mensal', 800, 7) ON CONFLICT (operation_id) DO UPDATE SET recurrence = EXCLUDED.recurrence, monthly_recurring_revenue = EXCLUDED.monthly_recurring_revenue, tax_rate_pct = EXCLUDED.tax_rate_pct;"
echo "OK: operation_financials upsert"

echo ""
echo "ALL PASS: financial-split UPDATE smoke"
